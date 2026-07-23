import { describe, expect, it } from 'vitest';
import { parseInput } from '../contract';
import { EXAMPLES } from '../../examples';

const todosSpec = EXAMPLES.find((e) => e.id === 'todos')!.text;

describe('openapi parser', () => {
  const result = parseInput(todosSpec);
  if (!result.ok) throw new Error('todos spec failed to parse: ' + result.error);
  const contract = result.contract;

  it('parses all four operations', () => {
    expect(contract.source).toBe('openapi');
    expect(contract.endpoints).toHaveLength(4);
    expect(contract.endpoints.map((e) => e.name)).toEqual(['listTodos', 'createTodo', 'getTodo', 'deleteTodo']);
  });

  it('captures path params with formats', () => {
    const get = contract.endpoints.find((e) => e.name === 'getTodo')!;
    expect(get.pathParams).toEqual(['todoId']);
  });

  it('captures query params with required flags', () => {
    const list = contract.endpoints.find((e) => e.name === 'listTodos')!;
    expect(list.queryParams.map((q) => q.name)).toEqual(['status', 'limit']);
    expect(list.queryParams.every((q) => !q.required)).toBe(true);
  });

  it('resolves $refs into named shapes', () => {
    const names = contract.namedShapes.map((n) => n.name);
    expect(names).toContain('Todo');
    expect(names).toContain('User');
  });

  it('converts enums to literal unions', () => {
    const todo = contract.namedShapes.find((n) => n.name === 'Todo')!;
    if (todo.shape.kind !== 'object') throw new Error('Todo should be object');
    const status = todo.shape.fields.find((f) => f.name === 'status')!;
    expect(status.shape.kind).toBe('union');
    if (status.shape.kind !== 'union') return;
    expect(status.shape.variants.map((v) => (v.kind === 'literal' ? v.value : null))).toEqual([
      'open',
      'in_progress',
      'done',
    ]);
  });

  it('204 delete has no response shape', () => {
    const del = contract.endpoints.find((e) => e.name === 'deleteTodo')!;
    expect(del.response).toBeUndefined();
  });
});

describe('json mode', () => {
  const usersJson = EXAMPLES.find((e) => e.id === 'users')!.text;
  const result = parseInput(usersJson);
  if (!result.ok) throw new Error('users json failed');
  const contract = result.contract;

  it('synthesizes a GET endpoint from a payload', () => {
    expect(contract.source).toBe('json');
    expect(contract.endpoints).toHaveLength(1);
    expect(contract.endpoints[0].method).toBe('get');
    expect(contract.endpoints[0].path).toBe('/api/users');
  });

  it('rejects garbage input', () => {
    const bad = parseInput('{{{not valid');
    expect(bad.ok).toBe(false);
  });

  it('rejects bare scalars', () => {
    const bad = parseInput('42');
    expect(bad.ok).toBe(false);
  });
});
