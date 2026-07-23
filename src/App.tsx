import { useMemo, useState } from 'react';
import { parseInput } from './lib/contract';
import { emitTypescript } from './lib/emit/typescript';
import { emitZod } from './lib/emit/zod';
import { emitHooks } from './lib/emit/hooks';
import { emitMocks } from './lib/emit/mocks';
import { EXAMPLES } from './examples';
import CodeBlock from './components/CodeBlock';
import PreviewPane from './components/PreviewPane';

const TABS = ['Types', 'Zod', 'Hooks', 'Mocks + MSW', 'Preview'] as const;
type Tab = (typeof TABS)[number];

const FILENAMES: Record<Exclude<Tab, 'Preview'>, string> = {
  Types: 'types.ts',
  Zod: 'schemas.ts',
  Hooks: 'hooks.ts',
  'Mocks + MSW': 'mocks.ts',
};

export default function App() {
  const [text, setText] = useState(EXAMPLES[0].text);
  const [activeExample, setActiveExample] = useState<string | null>(EXAMPLES[0].id);
  const [tab, setTab] = useState<Tab>('Types');

  const result = useMemo(() => parseInput(text), [text]);

  const outputs = useMemo(() => {
    if (!result.ok) return null;
    try {
      return {
        Types: emitTypescript(result.contract),
        Zod: emitZod(result.contract),
        Hooks: emitHooks(result.contract),
        'Mocks + MSW': emitMocks(result.contract),
      } as Record<Exclude<Tab, 'Preview'>, string>;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [result]);

  const loadExample = (id: string) => {
    const ex = EXAMPLES.find((x) => x.id === id)!;
    setText(ex.text);
    setActiveExample(id);
  };

  return (
    <div className="shell">
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark">T</span>
          <div>
            <h1 className="wordmark">Typesmith</h1>
            <p className="tagline">Paste an API contract. Forge React-ready code.</p>
          </div>
        </div>
        <nav className="mast-links">
          <a href="https://github.com/elizabethpammi/typesmith" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      <div className="chips" role="tablist" aria-label="Examples">
        <span className="chips-label">Examples</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.id}
            className={'chip' + (activeExample === ex.id ? ' active' : '')}
            onClick={() => loadExample(ex.id)}
          >
            {ex.label} <span className="chip-kind">{ex.kind}</span>
          </button>
        ))}
      </div>

      <main className="workbench">
        <section className="pane pane-input">
          <div className="pane-bar">
            <span className="pane-title">Contract</span>
            <span className={'source-badge' + (result.ok ? '' : ' err')}>
              {result.ok
                ? result.contract.source === 'openapi'
                  ? `OpenAPI 3 · ${result.contract.endpoints.length} operation${result.contract.endpoints.length === 1 ? '' : 's'}`
                  : 'JSON example · shape inferred'
                : 'parse error'}
            </span>
          </div>
          <textarea
            className="editor"
            spellCheck={false}
            value={text}
            aria-label="API contract input"
            onChange={(e) => {
              setText(e.target.value);
              setActiveExample(null);
            }}
          />
          {result.ok && result.contract.notes.length ? (
            <div className="notes">
              {result.contract.notes.map((n) => (
                <p key={n}>⚠ {n}</p>
              ))}
            </div>
          ) : null}
        </section>

        <section className="pane pane-output">
          <div className="tabs" role="tablist" aria-label="Generated output">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={'tab' + (tab === t ? ' active' : '')}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="tab-body">
            {!result.ok ? (
              <div className="error-panel">
                <h3>Nothing to forge yet</h3>
                <p>{result.error}</p>
              </div>
            ) : tab === 'Preview' ? (
              <PreviewPane contract={result.contract} />
            ) : outputs ? (
              <CodeBlock code={outputs[tab]} filename={FILENAMES[tab]} />
            ) : (
              <div className="error-panel">
                <h3>Emit failed</h3>
                <p>This contract hit an unsupported corner. Check the console for details.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="colophon">
        <p>
          Everything runs in your browser — nothing is uploaded. Built by{' '}
          <a href="https://github.com/elizabethpammi" target="_blank" rel="noreferrer">
            Elizabeth Pammi
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
