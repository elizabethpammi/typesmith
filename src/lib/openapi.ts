// OpenAPI 3 subset parser: paths, methods, parameters, JSON request/response
// schemas, local $refs, enums, nullable, oneOf/anyOf/allOf. Anything outside
// the subset degrades to `unknown` with a note instead of failing.

import { Field, Shape, union } from './infer';
import { camelCase } from './naming';
import type { Contract, Endpoint, Method, QueryParam } from './contract';

type Obj = Record<string, any>;

const METHODS: Method[] = ['get', 'post', 'put', 'patch', 'delete'];

export function isOpenApi(doc: unknown): boolean {
  const d = doc as Obj;
  return !!d && typeof d === 'object' && !!(d.openapi || d.swagger) && !!d.paths;
}

export function parseOpenApi(doc: Obj): Contract {
  const notes: string[] = [];
  const note = (msg: string) => {
    if (!notes.includes(msg)) notes.push(msg);
  };
  if (doc.swagger) note('Swagger 2.0 detected — parsed with the OpenAPI 3 rules; some keywords may be missed.');

  const componentSchemas: Obj = doc.components?.schemas ?? doc.definitions ?? {};

  const toShape = (schema: Obj | undefined, refStack: string[]): Shape => {
    if (!schema || typeof schema !== 'object') return { kind: 'unknown' };
    if (schema.$ref) {
      const m = /^#\/(?:components\/schemas|definitions)\/(.+)$/.exec(schema.$ref);
      if (!m) {
        note(`External or unsupported $ref "${schema.$ref}" treated as unknown.`);
        return { kind: 'unknown' };
      }
      const name = m[1];
      if (refStack.includes(name)) {
        note(`Circular $ref "${name}" treated as unknown.`);
        return { kind: 'unknown' };
      }
      const target = componentSchemas[name];
      if (!target) {
        note(`Unresolved $ref "${name}" treated as unknown.`);
        return { kind: 'unknown' };
      }
      return toShape(target, [...refStack, name]);
    }
    if (Array.isArray(schema.enum) && schema.enum.length) {
      const lits: Shape[] = schema.enum
        .filter((v: unknown) => ['string', 'number', 'boolean'].includes(typeof v))
        .map((v: string | number | boolean) => ({ kind: 'literal', value: v }) as Shape);
      const u: Shape = lits.length ? { kind: 'union', variants: lits } : { kind: 'unknown' };
      return schema.nullable ? union([u, { kind: 'null' }]) : u;
    }
    if (schema.oneOf || schema.anyOf) {
      const parts: Obj[] = schema.oneOf ?? schema.anyOf;
      return union(parts.map((p) => toShape(p, refStack)));
    }
    if (schema.allOf) {
      const parts: Obj[] = schema.allOf;
      const shapes = parts.map((p) => toShape(p, refStack));
      const fields: Field[] = [];
      for (const s of shapes) {
        if (s.kind === 'object') {
          for (const f of s.fields) if (!fields.some((x) => x.name === f.name)) fields.push(f);
        } else {
          note('allOf with non-object members is only partially supported.');
        }
      }
      return { kind: 'object', fields };
    }

    let base: Shape;
    const type = Array.isArray(schema.type) ? schema.type.find((t: string) => t !== 'null') : schema.type;
    const nullFromTypeArray = Array.isArray(schema.type) && schema.type.includes('null');
    switch (type) {
      case 'object':
      case undefined: {
        if (!schema.properties && type === undefined) {
          base = { kind: 'unknown' };
          break;
        }
        const required: string[] = Array.isArray(schema.required) ? schema.required : [];
        const props: Obj = schema.properties ?? {};
        base = {
          kind: 'object',
          fields: Object.entries(props).map(([name, prop]) => ({
            name,
            shape: toShape(prop as Obj, refStack),
            optional: !required.includes(name),
          })),
        };
        break;
      }
      case 'array':
        base = { kind: 'array', items: toShape(schema.items, refStack) };
        break;
      case 'string': {
        const fmt = schema.format;
        const format = ['date-time', 'date', 'email', 'uuid', 'url'].includes(fmt)
          ? fmt
          : fmt === 'uri'
            ? 'url'
            : undefined;
        base = format ? { kind: 'primitive', type: 'string', format } : { kind: 'primitive', type: 'string' };
        break;
      }
      case 'integer':
      case 'number':
        base = { kind: 'primitive', type: 'number' };
        break;
      case 'boolean':
        base = { kind: 'primitive', type: 'boolean' };
        break;
      default:
        note(`Schema type "${type}" is not supported yet — treated as unknown.`);
        base = { kind: 'unknown' };
    }
    return schema.nullable || nullFromTypeArray ? union([base, { kind: 'null' }]) : base;
  };

  // Pre-convert all named component schemas so emitters can reuse their names.
  const namedShapes = Object.entries(componentSchemas)
    .map(([name, schema]) => ({ name, shape: toShape(schema as Obj, [name]) }))
    .filter((n) => n.shape.kind === 'object' || n.shape.kind === 'union');

  const endpoints: Endpoint[] = [];
  for (const [path, rawItem] of Object.entries(doc.paths as Obj)) {
    const item = rawItem as Obj;
    if (!item || typeof item !== 'object') continue;
    for (const method of METHODS) {
      const op = item[method] as Obj | undefined;
      if (!op) continue;
      const params: Obj[] = [...(item.parameters ?? []), ...(op.parameters ?? [])];
      const pathParams = params.filter((p) => p.in === 'path').map((p) => p.name as string);
      // Path templates can declare params that aren't listed in `parameters`.
      for (const m of path.matchAll(/\{(\w+)\}/g)) {
        if (!pathParams.includes(m[1])) pathParams.push(m[1]);
      }
      const queryParams: QueryParam[] = params
        .filter((p) => p.in === 'query')
        .map((p) => ({ name: p.name, required: !!p.required, shape: toShape(p.schema, []) }));

      const bodySchema = op.requestBody?.content?.['application/json']?.schema;
      const requestBody = bodySchema ? toShape(bodySchema, []) : undefined;

      let response: Shape | undefined;
      const responses: Obj = op.responses ?? {};
      const okCode = Object.keys(responses).find((c) => /^2\d\d$/.test(c)) ?? ('default' in responses ? 'default' : undefined);
      if (okCode) {
        const respSchema = responses[okCode]?.content?.['application/json']?.schema;
        if (respSchema) response = toShape(respSchema, []);
      }

      const name = op.operationId
        ? camelCase(op.operationId)
        : camelCase(
            method +
              ' ' +
              path
                .split('/')
                .filter(Boolean)
                .map((seg) => (seg.startsWith('{') ? 'by ' + seg.slice(1, -1) : seg))
                .join(' ')
          );

      endpoints.push({
        method,
        path,
        name,
        summary: op.summary,
        pathParams,
        queryParams,
        requestBody,
        response,
      });
    }
  }

  if (!endpoints.length) note('No operations found under `paths`.');

  return {
    source: 'openapi',
    title: doc.info?.title ?? 'OpenAPI contract',
    namedShapes,
    endpoints,
    notes,
  };
}
