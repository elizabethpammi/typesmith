import { describe, expect, it } from 'vitest';
import { infer, merge, shapeKey, splitNullable, union } from '../infer';

describe('infer', () => {
  it('detects primitive formats', () => {
    expect(infer('2026-05-01T10:00:00Z')).toEqual({ kind: 'primitive', type: 'string', format: 'date-time' });
    expect(infer('2026-05-01')).toEqual({ kind: 'primitive', type: 'string', format: 'date' });
    expect(infer('a@b.io')).toEqual({ kind: 'primitive', type: 'string', format: 'email' });
    expect(infer('https://x.dev/p')).toEqual({ kind: 'primitive', type: 'string', format: 'url' });
    expect(infer('4b4bd0c5-8ea7-4b2e-9d2f-1a2b3c4d5e6f')).toEqual({
      kind: 'primitive',
      type: 'string',
      format: 'uuid',
    });
    expect(infer('plain text')).toEqual({ kind: 'primitive', type: 'string' });
  });

  it('marks fields optional when missing in some array items', () => {
    const shape = infer([
      { id: 1, nick: 'a' },
      { id: 2 },
    ]);
    expect(shape.kind).toBe('array');
    if (shape.kind !== 'array' || shape.items.kind !== 'object') throw new Error('bad shape');
    const byName = Object.fromEntries(shape.items.fields.map((f) => [f.name, f]));
    expect(byName.id.optional).toBe(false);
    expect(byName.nick.optional).toBe(true);
  });

  it('merges null into a nullable union', () => {
    const shape = infer([{ v: 'x' }, { v: null }]);
    if (shape.kind !== 'array' || shape.items.kind !== 'object') throw new Error('bad shape');
    const v = shape.items.fields[0].shape;
    const { inner, nullable } = splitNullable(v);
    expect(nullable).toBe(true);
    expect(inner).toEqual({ kind: 'primitive', type: 'string' });
  });

  it('drops format when merged strings disagree', () => {
    const merged = merge(infer('a@b.io'), infer('hello'));
    expect(merged).toEqual({ kind: 'primitive', type: 'string' });
  });

  it('keeps format when merged strings agree', () => {
    const merged = merge(infer('a@b.io'), infer('c@d.io'));
    expect(merged).toEqual({ kind: 'primitive', type: 'string', format: 'email' });
  });

  it('unions incompatible types', () => {
    const merged = merge(infer('x'), infer(1));
    expect(merged.kind).toBe('union');
  });

  it('empty array infers unknown items', () => {
    expect(infer([])).toEqual({ kind: 'array', items: { kind: 'unknown' } });
  });

  it('shapeKey is stable and structural', () => {
    const a = infer({ id: 1, name: 'x' });
    const b = infer({ id: 9, name: 'y' });
    expect(shapeKey(a)).toBe(shapeKey(b));
  });

  it('union() flattens and dedupes', () => {
    const u = union([infer('a'), infer('b'), infer(null)]);
    const { inner, nullable } = splitNullable(u);
    expect(nullable).toBe(true);
    expect(inner).toEqual({ kind: 'primitive', type: 'string' });
  });
});
