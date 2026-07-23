import { useState } from 'react';
import { highlight } from '../lib/highlight';

export default function CodeBlock({ code, filename }: { code: string; filename: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

  const download = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="codeblock">
      <div className="codeblock-bar">
        <span className="codeblock-name">{filename}</span>
        <div className="codeblock-actions">
          <button className="mini-btn" onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
          <button className="mini-btn" onClick={download}>
            Download
          </button>
        </div>
      </div>
      <pre className="codeblock-pre">
        {/* safe: highlight() HTML-escapes all input; only its own span tags remain */}
        <code dangerouslySetInnerHTML={{ __html: highlight(code) }} />
      </pre>
    </div>
  );
}
