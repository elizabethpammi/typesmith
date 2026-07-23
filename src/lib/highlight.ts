// Tiny dependency-free TypeScript highlighter: escape, then tokenize with a
// single alternation so classes never nest.

const KEYWORDS =
  'export|import|from|interface|type|const|let|function|return|async|await|new|extends|typeof|keyof|null|undefined|true|false|string|number|boolean|unknown|void|as';

const TOKEN = new RegExp(
  [
    '(\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*)', // 1 comment
    "('(?:[^'\\\\]|\\\\.)*'|\"(?:[^\"\\\\]|\\\\.)*\"|`(?:[^`\\\\]|\\\\.)*`)", // 2 string
    '(\\b\\d+(?:\\.\\d+)?\\b)', // 3 number
    `(\\b(?:${KEYWORDS})\\b)`, // 4 keyword
  ].join('|'),
  'g'
);

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Non-token text: still colorize PascalCase identifiers as types.
function plain(s: string): string {
  return esc(s).replace(/\b([A-Z][A-Za-z0-9]*)\b/g, '<span class="tk-t">$1</span>');
}

export function highlight(code: string): string {
  let out = '';
  let last = 0;
  for (const m of code.matchAll(TOKEN)) {
    out += plain(code.slice(last, m.index));
    if (m[1]) out += `<span class="tk-c">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="tk-s">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="tk-n">${esc(m[3])}</span>`;
    else if (m[4]) out += `<span class="tk-k">${esc(m[4])}</span>`;
    last = (m.index ?? 0) + m[0].length;
  }
  out += plain(code.slice(last));
  return out;
}
