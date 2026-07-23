// Live preview: a data table forged from the response shape and a working
// form validated by a REAL zod schema built from the request shape.

import { useMemo, useState } from 'react';
import { Contract, Endpoint } from '../lib/contract';
import { Field, Shape, splitNullable } from '../lib/infer';
import { mockResponse } from '../lib/mock';
import { buildZod } from '../lib/zod-runtime';

function unwrapRows(shape: Shape): { fields: Field[]; rows: Record<string, unknown>[] } | null {
  const { inner } = splitNullable(shape);
  if (inner.kind === 'array' && inner.items.kind === 'object') {
    const rows = mockResponse(inner, 'preview', 6) as Record<string, unknown>[];
    return { fields: inner.items.fields, rows };
  }
  if (inner.kind === 'object') {
    const arrField = inner.fields.find((f) => {
      const s = splitNullable(f.shape).inner;
      return s.kind === 'array' && s.items.kind === 'object';
    });
    if (arrField) {
      const arr = splitNullable(arrField.shape).inner as Extract<Shape, { kind: 'array' }>;
      const rows = mockResponse(arr, arrField.name, 6) as Record<string, unknown>[];
      return { fields: (arr.items as Extract<Shape, { kind: 'object' }>).fields, rows };
    }
  }
  return null;
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? '✓' : '✗';
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s.length > 42 ? s.slice(0, 39) + '…' : s;
  }
  return String(v);
}

function formShape(contract: Contract): { title: string; shape: Extract<Shape, { kind: 'object' }> } | null {
  const withBody = contract.endpoints.find((ep: Endpoint) => {
    if (!ep.requestBody) return false;
    return splitNullable(ep.requestBody).inner.kind === 'object';
  });
  if (withBody) {
    return {
      title: `${withBody.method.toUpperCase()} ${withBody.path} — request body`,
      shape: splitNullable(withBody.requestBody!).inner as Extract<Shape, { kind: 'object' }>,
    };
  }
  for (const ep of contract.endpoints) {
    if (!ep.response) continue;
    const rows = unwrapRows(ep.response);
    if (rows) {
      return {
        title: `Row editor — item shape of ${ep.method.toUpperCase()} ${ep.path}`,
        shape: { kind: 'object', fields: rows.fields },
      };
    }
  }
  return null;
}

export default function PreviewPane({ contract }: { contract: Contract }) {
  const table = useMemo(() => {
    for (const ep of contract.endpoints) {
      if (!ep.response) continue;
      const t = unwrapRows(ep.response);
      if (t) return { ...t, ep };
    }
    return null;
  }, [contract]);

  const form = useMemo(() => formShape(contract), [contract]);

  return (
    <div className="preview">
      {table ? (
        <section className="preview-section">
          <h3 className="preview-title">
            Rendered data table <span className="preview-sub">mock rows generated from the inferred shape</span>
          </h3>
          <div className="table-scroll">
            <table className="preview-table">
              <thead>
                <tr>
                  {table.fields.map((f) => (
                    <th key={f.name}>
                      {f.name}
                      {f.optional ? <span className="opt">?</span> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={i}>
                    {table.fields.map((f) => (
                      <td key={f.name} className={typeof row[f.name] === 'number' ? 'num' : ''}>
                        {cell(row[f.name])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className="preview-empty">No array-of-objects shape found to render as a table.</p>
      )}
      {form ? <LiveForm title={form.title} shape={form.shape} /> : null}
    </div>
  );
}

function LiveForm({ title, shape }: { title: string; shape: Extract<Shape, { kind: 'object' }> }) {
  const editable = shape.fields.filter((f) => {
    const s = splitNullable(f.shape).inner;
    return s.kind === 'primitive' || (s.kind === 'union' && s.variants.every((v) => v.kind === 'literal'));
  });
  const skipped = shape.fields.length - editable.length;

  const schema = useMemo(() => buildZod({ kind: 'object', fields: editable }), [shape]);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const coerced = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const f of editable) {
      const inner = splitNullable(f.shape).inner;
      const raw = values[f.name];
      if (inner.kind === 'primitive' && inner.type === 'boolean') {
        out[f.name] = !!raw;
        continue;
      }
      if (raw === undefined || raw === '') {
        if (!f.optional) out[f.name] = splitNullable(f.shape).nullable ? null : '';
        continue;
      }
      if (inner.kind === 'primitive' && inner.type === 'number') {
        const n = Number(raw);
        out[f.name] = Number.isNaN(n) ? raw : n;
      } else {
        out[f.name] = raw;
      }
    }
    return out;
  }, [values, shape]);

  const parsed = schema.safeParse(coerced);
  const errorsFor = (name: string): string | undefined => {
    if (parsed.success) return undefined;
    const issue = parsed.error.issues.find((i) => i.path[0] === name);
    return issue?.message;
  };

  return (
    <section className="preview-section">
      <h3 className="preview-title">
        Live form <span className="preview-sub">{title} · validated with a runtime-built zod schema</span>
      </h3>
      <div className="form-grid">
        <div className="form-fields">
          {editable.map((f) => {
            const inner = splitNullable(f.shape).inner;
            const err = touched[f.name] ? errorsFor(f.name) : undefined;
            const label = (
              <label className="field-label" htmlFor={'fld-' + f.name}>
                {f.name}
                {f.optional ? <span className="opt">optional</span> : null}
              </label>
            );
            if (inner.kind === 'primitive' && inner.type === 'boolean') {
              return (
                <div className="field" key={f.name}>
                  {label}
                  <input
                    id={'fld-' + f.name}
                    type="checkbox"
                    checked={!!values[f.name]}
                    onChange={(e) => {
                      setValues((v) => ({ ...v, [f.name]: e.target.checked }));
                      setTouched((t) => ({ ...t, [f.name]: true }));
                    }}
                  />
                </div>
              );
            }
            if (inner.kind === 'union') {
              const opts = inner.variants.map((v) => (v.kind === 'literal' ? String(v.value) : ''));
              return (
                <div className="field" key={f.name}>
                  {label}
                  <select
                    id={'fld-' + f.name}
                    value={(values[f.name] as string) ?? ''}
                    onChange={(e) => {
                      setValues((v) => ({ ...v, [f.name]: e.target.value }));
                      setTouched((t) => ({ ...t, [f.name]: true }));
                    }}
                  >
                    <option value="">Select…</option>
                    {opts.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  {err ? <span className="field-err">{err}</span> : null}
                </div>
              );
            }
            const fmt = inner.kind === 'primitive' ? inner.format : undefined;
            return (
              <div className="field" key={f.name}>
                {label}
                <input
                  id={'fld-' + f.name}
                  type="text"
                  placeholder={fmt ?? (inner.kind === 'primitive' ? inner.type : 'value')}
                  value={(values[f.name] as string) ?? ''}
                  onChange={(e) => {
                    setValues((v) => ({ ...v, [f.name]: e.target.value }));
                    setTouched((t) => ({ ...t, [f.name]: true }));
                  }}
                />
                {err ? <span className="field-err">{err}</span> : null}
              </div>
            );
          })}
          {skipped > 0 ? <p className="form-note">{skipped} nested field(s) omitted from the form.</p> : null}
        </div>
        <div className="form-output">
          <div className={'validity ' + (parsed.success ? 'ok' : 'bad')}>
            {parsed.success ? '✓ payload valid' : `✗ ${parsed.success ? 0 : parsed.error.issues.length} validation issue(s)`}
          </div>
          <pre className="form-json">{JSON.stringify(coerced, null, 2)}</pre>
        </div>
      </div>
    </section>
  );
}
