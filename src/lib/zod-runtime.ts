// Build a REAL zod schema from a Shape at runtime — this is what powers the
// live form validation in the preview pane (not string-eval of emitted code).

import { z, ZodTypeAny } from 'zod';
import { Shape, splitNullable } from './infer';

export function buildZod(shape: Shape): ZodTypeAny {
  const { inner, nullable } = splitNullable(shape);
  const base = buildInner(inner);
  return nullable ? base.nullable() : base;
}

function buildInner(shape: Shape): ZodTypeAny {
  switch (shape.kind) {
    case 'object': {
      const props: Record<string, ZodTypeAny> = {};
      for (const f of shape.fields) {
        const s = buildZod(f.shape);
        props[f.name] = f.optional ? s.optional() : s;
      }
      return z.object(props);
    }
    case 'array':
      return z.array(buildZod(shape.items));
    case 'primitive':
      if (shape.type === 'string') {
        switch (shape.format) {
          case 'uuid': return z.string().uuid();
          case 'email': return z.string().email();
          case 'url': return z.string().url();
          case 'date-time': return z.string().datetime();
          case 'date': return z.string().date();
          default: return z.string();
        }
      }
      return shape.type === 'number' ? z.number() : z.boolean();
    case 'literal':
      return z.literal(shape.value);
    case 'null':
      return z.null();
    case 'unknown':
      return z.unknown();
    case 'union': {
      const variants = shape.variants.map(buildInner);
      if (variants.length === 1) return variants[0];
      return z.union(variants as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]);
    }
  }
}
