import { describe, expect, it } from 'vitest';
import { camelCase, kebabCase, pascalCase, propKey, singular, typeNameFrom } from '../naming';

describe('naming', () => {
  it('pascalCase handles snake and kebab', () => {
    expect(pascalCase('line_items')).toBe('LineItems');
    expect(pascalCase('payment-method')).toBe('PaymentMethod');
  });

  it('camelCase', () => {
    expect(camelCase('List Todos')).toBe('listTodos');
  });

  it('kebabCase', () => {
    expect(kebabCase('UserProfiles')).toBe('user-profiles');
  });

  it('singular avoids false plurals', () => {
    expect(singular('users')).toBe('user');
    expect(singular('companies')).toBe('company');
    expect(singular('addresses')).toBe('address');
    expect(singular('status')).toBe('status');
    expect(singular('data')).toBe('data');
  });

  it('typeNameFrom singularizes the last word', () => {
    expect(typeNameFrom('users')).toBe('User');
    expect(typeNameFrom('line_items')).toBe('LineItem');
  });

  it('propKey quotes unsafe identifiers', () => {
    expect(propKey('name')).toBe('name');
    expect(propKey('first-name')).toBe('"first-name"');
  });
});
