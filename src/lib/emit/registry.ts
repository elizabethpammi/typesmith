// Assigns stable, de-duplicated names to shapes. Structurally identical
// shapes share one name, so `User` referenced from three endpoints emits once.

import { Shape, shapeKey } from '../infer';
import { pascalCase } from '../naming';

export class NameRegistry {
  private byKey = new Map<string, string>();
  private used = new Set<string>();

  claim(shape: Shape, hint: string): { name: string; isNew: boolean } {
    const key = shapeKey(shape);
    const existing = this.byKey.get(key);
    if (existing) return { name: existing, isNew: false };
    const base = pascalCase(hint) || 'Model';
    let name = base;
    let i = 2;
    while (this.used.has(name)) name = base + i++;
    this.used.add(name);
    this.byKey.set(key, name);
    return { name, isNew: true };
  }
}
