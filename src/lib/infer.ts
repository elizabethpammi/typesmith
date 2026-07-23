// Shape inference: turn example JSON values into a small intermediate
// representation (IR) that every emitter consumes.

export type Primitive = 'string' | 'number' | 'boolean';
export type Format = 'date-time' | 'date' | 'email' | 'uuid' | 'url';

export type Shape =
  | { kind: 'object'; fields: Field[] }
  | { kind: 'array'; items: Shape }
  | { kind: 'primitive'; type: Primitive; format?: Format }
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'null' }
  | { kind: 'union'; variants: Shape[] }
  | { kind: 'unknown' };

export interface Field {
  name: string;
  shape: Shape;
  optional: boolean;
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_URL = /^https?:\/\/\S+$/;

export function detectFormat(s: string): Format | undefined {
  if (RE_UUID.test(s)) return 'uuid';
  if (RE_DATETIME.test(s)) return 'date-time';
  if (RE_DATE.test(s)) return 'date';
  if (RE_EMAIL.test(s)) return 'email';
  if (RE_URL.test(s)) return 'url';
  return undefined;
}

export function infer(v: unknown): Shape {
  if (v === null || v === undefined) return { kind: 'null' };
  if (typeof v === 'string') {
    const format = detectFormat(v);
    return format ? { kind: 'primitive', type: 'string', format } : { kind: 'primitive', type: 'string' };
  }
  if (typeof v === 'number') return { kind: 'primitive', type: 'number' };
  if (typeof v === 'boolean') return { kind: 'primitive', type: 'boolean' };
  if (Array.isArray(v)) {
    if (v.length === 0) return { kind: 'array', items: { kind: 'unknown' } };
    return { kind: 'array', items: v.map(infer).reduce(merge) };
  }
  if (typeof v === 'object') {
    return {
      kind: 'object',
      fields: Object.entries(v as Record<string, unknown>).map(([name, val]) => ({
        name,
        shape: infer(val),
        optional: false,
      })),
    };
  }
  return { kind: 'unknown' };
}

// Stable structural key — used for dedup in unions and for naming registries.
export function shapeKey(s: Shape): string {
  switch (s.kind) {
    case 'object':
      return '{' + s.fields.map((f) => f.name + (f.optional ? '?' : '') + ':' + shapeKey(f.shape)).join(',') + '}';
    case 'array':
      return '[' + shapeKey(s.items) + ']';
    case 'primitive':
      return s.type + (s.format ? '<' + s.format + '>' : '');
    case 'literal':
      return 'lit:' + JSON.stringify(s.value);
    case 'null':
      return 'null';
    case 'unknown':
      return 'unknown';
    case 'union':
      return '(' + s.variants.map(shapeKey).sort().join('|') + ')';
  }
}

export function merge(a: Shape, b: Shape): Shape {
  if (shapeKey(a) === shapeKey(b)) return a;
  if (a.kind === 'unknown') return b;
  if (b.kind === 'unknown') return a;
  if (a.kind === 'object' && b.kind === 'object') {
    const names: string[] = [];
    for (const f of [...a.fields, ...b.fields]) if (!names.includes(f.name)) names.push(f.name);
    return {
      kind: 'object',
      fields: names.map((n) => {
        const fa = a.fields.find((f) => f.name === n);
        const fb = b.fields.find((f) => f.name === n);
        if (fa && fb) return { name: n, shape: merge(fa.shape, fb.shape), optional: fa.optional || fb.optional };
        const f = (fa ?? fb)!;
        return { ...f, optional: true };
      }),
    };
  }
  if (a.kind === 'array' && b.kind === 'array') return { kind: 'array', items: merge(a.items, b.items) };
  if (a.kind === 'primitive' && b.kind === 'primitive' && a.type === b.type) {
    return a.format && a.format === b.format
      ? { kind: 'primitive', type: a.type, format: a.format }
      : { kind: 'primitive', type: a.type };
  }
  return union([a, b]);
}

function mergeable(a: Shape, b: Shape): boolean {
  if (shapeKey(a) === shapeKey(b)) return true;
  if (a.kind === 'object' && b.kind === 'object') return true;
  if (a.kind === 'array' && b.kind === 'array') return true;
  if (a.kind === 'primitive' && b.kind === 'primitive' && a.type === b.type) return true;
  return false;
}

export function union(shapes: Shape[]): Shape {
  const flat: Shape[] = [];
  for (const s of shapes) {
    if (s.kind === 'union') flat.push(...s.variants);
    else flat.push(s);
  }
  const out: Shape[] = [];
  for (const s of flat) {
    const i = out.findIndex((o) => mergeable(o, s));
    if (i === -1) out.push(s);
    else out[i] = merge(out[i], s);
  }
  if (out.length === 0) return { kind: 'unknown' };
  return out.length === 1 ? out[0] : { kind: 'union', variants: out };
}

// A union containing null is "nullable X" — emitters special-case this.
export function splitNullable(s: Shape): { inner: Shape; nullable: boolean } {
  if (s.kind === 'null') return { inner: { kind: 'unknown' }, nullable: true };
  if (s.kind === 'union') {
    const rest = s.variants.filter((v) => v.kind !== 'null');
    if (rest.length < s.variants.length) {
      return { inner: rest.length === 1 ? rest[0] : { kind: 'union', variants: rest }, nullable: true };
    }
  }
  return { inner: s, nullable: false };
}
