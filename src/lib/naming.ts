// Identifier forging: JSON keys and URL paths in, valid TS names out.

export function words(s: string): string[] {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

export function pascalCase(s: string): string {
  const p = words(s)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  return /^[0-9]/.test(p) ? '_' + p : p;
}

export function camelCase(s: string): string {
  const p = pascalCase(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

export function kebabCase(s: string): string {
  return words(s).map((w) => w.toLowerCase()).join('-');
}

export function singular(w: string): string {
  if (w.length <= 2) return w;
  if (/(ss|us|is)$/i.test(w)) return w;
  if (/ies$/i.test(w) && w.length > 3) return w.slice(0, -3) + 'y';
  if (/(ches|shes|xes|ses|zes)$/i.test(w)) return w.slice(0, -2);
  if (/data$/i.test(w)) return w;
  if (/s$/i.test(w)) return w.slice(0, -1);
  return w;
}

// "line_items" -> "LineItem", "users" -> "User", "address" -> "Address"
export function typeNameFrom(field: string): string {
  const ws = words(field);
  if (ws.length === 0) return 'Model';
  ws[ws.length - 1] = singular(ws[ws.length - 1]);
  return pascalCase(ws.join(' '));
}

export function isSafeProp(name: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

export function propKey(name: string): string {
  return isSafeProp(name) ? name : JSON.stringify(name);
}
