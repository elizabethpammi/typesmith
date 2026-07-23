import { describe, expect, it } from 'vitest';
import { parseInput } from '../contract';
import { emitTypescript } from '../emit/typescript';
import { emitZod } from '../emit/zod';
import { emitHooks } from '../emit/hooks';
import { emitMocks } from '../emit/mocks';
import { EXAMPLES } from '../../examples';

function contractFor(id: string) {
  const result = parseInput(EXAMPLES.find((e) => e.id === id)!.text);
  if (!result.ok) throw new Error(`example ${id} failed to parse`);
  return result.contract;
}

describe('typescript emitter', () => {
  it('emits interfaces with optional markers for users json', () => {
    const out = emitTypescript(contractFor('users'));
    expect(out).toContain('export interface User');
    expect(out).toContain('referredBy?: number;');
    expect(out).toContain('lastLogin: string | null;');
  });

  it('reuses named component types from openapi', () => {
    const out = emitTypescript(contractFor('todos'));
    expect(out).toContain('export interface Todo');
    expect(out).toContain('export interface User');
    expect(out).toContain('"open" | "in_progress" | "done"');
    // Todo interface declared exactly once despite 3 endpoints referencing it
    expect(out.match(/export interface Todo \{/g)).toHaveLength(1);
  });
});

describe('zod emitter', () => {
  it('emits schemas with enum + nullable + formats', () => {
    const out = emitZod(contractFor('todos'));
    expect(out).toContain('export const TodoSchema = z.object({');
    expect(out).toContain('z.enum(["open", "in_progress", "done"])');
    expect(out).toContain('.nullable()');
    expect(out).toContain('.uuid()');
    expect(out).toContain('z.infer<typeof TodoSchema>');
  });

  it('marks optional fields', () => {
    const out = emitZod(contractFor('users'));
    expect(out).toContain('.optional()');
  });
});

describe('hooks emitter', () => {
  it('emits queries and mutations for openapi', () => {
    const out = emitHooks(contractFor('todos'));
    expect(out).toContain('useQuery');
    expect(out).toContain('useMutation');
    expect(out).toContain('export function useTodosQuery');
    expect(out).toContain('export function useCreateTodoMutation');
    expect(out).toContain('URLSearchParams');
  });

  it('json mode query key skips api segment', () => {
    const out = emitHooks(contractFor('users'));
    expect(out).toContain("queryKey: ['users'");
  });
});

describe('mocks emitter', () => {
  it('emits typed fixtures and msw handlers', () => {
    const out = emitMocks(contractFor('todos'));
    expect(out).toContain('import { http, HttpResponse }');
    expect(out).toContain("http.get('/todos'");
    expect(out).toContain("http.get('/todos/:todoId'");
    expect(out).toContain('status: 201');
    expect(out).toContain('status: 204');
  });

  it('is deterministic', () => {
    const a = emitMocks(contractFor('payments'));
    const b = emitMocks(contractFor('payments'));
    expect(a).toBe(b);
  });
});
