"use client";

import { useState } from "react";

export function CopyBlock({ code, label }: { code: string; label: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      /* clipboard blocked: the text stays selectable */
    }
  }
  return (
    <div className="code">
      <pre tabIndex={0} aria-label={label}>
        <code>{code}</code>
      </pre>
      <button type="button" className="copy" onClick={copy} aria-live="polite">
        {done ? "Copied" : "Copy"}
        <span className="sr-only"> {label}</span>
      </button>
    </div>
  );
}
