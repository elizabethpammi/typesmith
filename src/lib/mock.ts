// Deterministic, field-name-aware mock data. Seeded PRNG so the same
// contract always forges the same sample data (and tests stay stable).

import { Shape, splitNullable } from './infer';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Ava', 'Noah', 'Maya', 'Leo', 'Iris', 'Owen', 'Zara', 'Eli'];
const LAST = ['Chen', 'Patel', 'Kim', 'Nguyen', 'Garcia', 'Okafor', 'Silva', 'Novak'];
const CITIES = ['San Jose', 'Sunnyvale', 'Palo Alto', 'Santa Clara', 'Mountain View', 'Cupertino'];
const WORDS = ['amber', 'copper', 'forge', 'anvil', 'ember', 'ingot', 'quench', 'temper'];
const TIMESTAMPS = [
  '2026-01-15T09:30:00Z',
  '2026-02-03T14:05:00Z',
  '2026-03-21T18:45:00Z',
  '2026-04-09T07:12:00Z',
  '2026-05-27T11:58:00Z',
  '2026-06-14T16:20:00Z',
];

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function hex(rng: () => number, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(rng() * 16).toString(16);
  return s;
}

function mockString(name: string, format: string | undefined, rng: () => number, index: number): string {
  const n = name.toLowerCase();
  if (format === 'uuid') return `${hex(rng, 8)}-${hex(rng, 4)}-4${hex(rng, 3)}-a${hex(rng, 3)}-${hex(rng, 12)}`;
  if (format === 'email' || /email/.test(n)) {
    return `${pick(rng, FIRST).toLowerCase()}.${pick(rng, LAST).toLowerCase()}@example.com`;
  }
  if (format === 'date-time' || /(createdat|updatedat|timestamp|_at$)/.test(n.replace(/[^a-z]/g, ''))) {
    return TIMESTAMPS[index % TIMESTAMPS.length];
  }
  if (format === 'date') return TIMESTAMPS[index % TIMESTAMPS.length].slice(0, 10);
  if (format === 'url' || /(url|link|avatar|image|photo)/.test(n)) {
    return `https://example.com/${pick(rng, WORDS)}/${index + 1}`;
  }
  if (/(^|_)id$|id$/.test(n)) return `${pick(rng, WORDS)}_${hex(rng, 8)}`;
  if (/firstname/.test(n.replace(/[^a-z]/g, ''))) return pick(rng, FIRST);
  if (/lastname|surname/.test(n.replace(/[^a-z]/g, ''))) return pick(rng, LAST);
  if (/name|title|label/.test(n)) return `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
  if (/city/.test(n)) return pick(rng, CITIES);
  if (/zip|postal/.test(n)) return String(94000 + Math.floor(rng() * 999));
  if (/phone/.test(n)) return `+1-408-555-0${100 + Math.floor(rng() * 99)}`;
  if (/currency/.test(n)) return 'usd';
  if (/desc|summary|note|message|bio/.test(n)) return `A ${pick(rng, WORDS)} of ${pick(rng, WORDS)} and ${pick(rng, WORDS)}.`;
  return `${pick(rng, WORDS)}-${index + 1}`;
}

function mockNumber(name: string, rng: () => number, index: number): number {
  const n = name.toLowerCase();
  if (/(^|_)id$|id$/.test(n)) return index + 1;
  if (/amount|price|total|cents/.test(n)) return (Math.floor(rng() * 900) + 100) * 25;
  if (/count|qty|quantity|stock/.test(n)) return Math.floor(rng() * 40) + 1;
  if (/age/.test(n)) return Math.floor(rng() * 40) + 21;
  if (/rating|score/.test(n)) return Math.round(rng() * 40 + 10) / 10;
  if (/year/.test(n)) return 2015 + Math.floor(rng() * 11);
  return Math.floor(rng() * 100);
}

export function mockValue(shape: Shape, rng: () => number, name = '', index = 0): unknown {
  const { inner, nullable } = splitNullable(shape);
  if (nullable && rng() < 0.25) return null;
  switch (inner.kind) {
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const f of inner.fields) {
        if (f.optional && rng() < 0.3) continue;
        out[f.name] = mockValue(f.shape, rng, f.name, index);
      }
      return out;
    }
    case 'array': {
      const len = 2 + Math.floor(rng() * 2);
      return Array.from({ length: len }, (_, i) => mockValue(inner.items, rng, name, i));
    }
    case 'primitive':
      if (inner.type === 'string') return mockString(name, inner.format, rng, index);
      if (inner.type === 'number') return mockNumber(name, rng, index);
      return rng() < 0.7;
    case 'literal':
      return inner.value;
    case 'union': {
      const nonNull = inner.variants.filter((v) => v.kind !== 'null');
      const variant = nonNull.length ? nonNull[Math.floor(rng() * nonNull.length)] : inner.variants[0];
      return mockValue(variant, rng, name, index);
    }
    case 'null':
      return null;
    case 'unknown':
      return null;
  }
}

/** Top-level convenience: list responses get `count` rows, seeded per name. */
export function mockResponse(shape: Shape, seedText: string, count = 3): unknown {
  let seed = 0;
  for (let i = 0; i < seedText.length; i++) seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
  const rng = mulberry32(seed || 1);
  const { inner } = splitNullable(shape);
  if (inner.kind === 'array') {
    return Array.from({ length: count }, (_, i) => mockValue(inner.items, rng, seedText, i));
  }
  if (inner.kind === 'object') {
    const out: Record<string, unknown> = {};
    for (const f of inner.fields) {
      if (f.shape.kind === 'array') {
        const items = f.shape.items;
        out[f.name] = Array.from({ length: count }, (_, i) => mockValue(items, rng, f.name, i));
      } else {
        out[f.name] = mockValue(f.shape, rng, f.name, 0);
      }
    }
    return out;
  }
  return mockValue(shape, rng, seedText, 0);
}
