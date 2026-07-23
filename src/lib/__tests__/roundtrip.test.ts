// The strongest guarantee in the app: mock data generated from a shape must
// validate against the zod schema built from the same shape.

import { describe, expect, it } from 'vitest';
import { parseInput } from '../contract';
import { buildZod } from '../zod-runtime';
import { mockResponse } from '../mock';
import { EXAMPLES } from '../../examples';

describe('mock ↔ zod round trip', () => {
  for (const ex of EXAMPLES) {
    it(`${ex.id}: every endpoint's mock response passes its own schema`, () => {
      const result = parseInput(ex.text);
      if (!result.ok) throw new Error(`${ex.id} failed to parse`);
      for (const ep of result.contract.endpoints) {
        if (!ep.response) continue;
        const schema = buildZod(ep.response);
        const mock = mockResponse(ep.response, ep.name);
        const parsed = schema.safeParse(mock);
        if (!parsed.success) {
          throw new Error(`${ep.name}: ${JSON.stringify(parsed.error.issues, null, 2)}`);
        }
        expect(parsed.success).toBe(true);
      }
    });
  }
});
