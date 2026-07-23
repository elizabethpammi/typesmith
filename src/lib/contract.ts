// Contract model: the normalized picture of an API that all emitters read.
// Built either from a pasted JSON example or a parsed OpenAPI document.

import yaml from 'js-yaml';
import { infer, Shape } from './infer';
import { camelCase, kebabCase, pascalCase, typeNameFrom } from './naming';
import { isOpenApi, parseOpenApi } from './openapi';

export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface QueryParam {
  name: string;
  required: boolean;
  shape: Shape;
}

export interface Endpoint {
  method: Method;
  path: string;
  /** camelCase operation name, e.g. getUsers / createTodo */
  name: string;
  summary?: string;
  pathParams: string[];
  queryParams: QueryParam[];
  requestBody?: Shape;
  response?: Shape;
}

export interface Contract {
  source: 'json' | 'openapi';
  title: string;
  /** Schemas that arrived with names (OpenAPI components) — seeds the type registry. */
  namedShapes: { name: string; shape: Shape }[];
  endpoints: Endpoint[];
  notes: string[];
}

export type ParseResult = { ok: true; contract: Contract } | { ok: false; error: string };

export function parseInput(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'Paste a JSON payload or an OpenAPI spec to begin.' };
  let doc: unknown;
  try {
    doc = JSON.parse(trimmed);
  } catch {
    try {
      doc = yaml.load(trimmed, { schema: yaml.JSON_SCHEMA });
    } catch (e) {
      return { ok: false, error: 'Could not parse input as JSON or YAML: ' + (e as Error).message };
    }
  }
  if (doc === null || doc === undefined || typeof doc !== 'object') {
    return { ok: false, error: 'Input parsed to a bare value. Paste an object, an array, or an OpenAPI document.' };
  }
  try {
    if (isOpenApi(doc)) return { ok: true, contract: parseOpenApi(doc as Record<string, unknown>) };
    return { ok: true, contract: contractFromJson(doc) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// JSON mode: infer the shape and synthesize a single GET endpoint around it,
// so hooks, mocks, and MSW handlers have something real to bind to.
export function contractFromJson(value: unknown): Contract {
  const shape = infer(value);
  let resource = 'data';
  if (shape.kind === 'object') {
    const arrayFields = shape.fields.filter((f) => f.shape.kind === 'array');
    if (arrayFields.length === 1) resource = arrayFields[0].name;
  } else if (shape.kind === 'array') {
    resource = 'items';
  }
  return {
    source: 'json',
    title: pascalCase(typeNameFrom(resource)) + ' API (inferred from JSON example)',
    namedShapes: [],
    endpoints: [
      {
        method: 'get',
        path: '/api/' + kebabCase(resource),
        name: camelCase('get ' + resource),
        pathParams: [],
        queryParams: [],
        response: shape,
      },
    ],
    notes: [],
  };
}

// "GetUsers" from getUsers; response/request type names hang off this.
export function baseTypeName(ep: Endpoint): string {
  return pascalCase(ep.name).replace(/^(Get|Post|Put|Patch|Delete|List|Fetch)(?=[A-Z])/, '');
}

export function responseTypeName(ep: Endpoint): string {
  return (baseTypeName(ep) || 'Api') + 'Response';
}

export function requestTypeName(ep: Endpoint): string {
  return pascalCase(ep.name) + 'Request';
}
