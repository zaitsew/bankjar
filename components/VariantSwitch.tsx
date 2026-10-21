"use client";

import { useEffect, useState } from "react";

type V = "a" | "b";

function choose(v: V) {
  try {
    document.cookie = `bj_v=${v}; path=/; max-age=31536000; samesite=lax`;
    const url = new URL(window.location.href);
    url.searchParams.delete("v");
    window.location.assign(url.toString());
  } catch {
    window.location.reload();
  }
}

/** Two layouts for the owner to compare (docs/DESIGN.md). The choice lives in a cookie. */
export function VariantSwitch() {
  const [current, setCurrent] = useState<V>("a");
  useEffect(() => {
    setCurrent(document.documentElement.dataset.variant === "b" ? "b" : "a");
  }, []);
  return (
    <div role="group" aria-label="Page layout" className="inline-flex items-center gap-2">
      <span>Layout</span>
      {(["a", "b"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => choose(v)}
          aria-pressed={current === v}
          className="min-h-8 rounded-sm border border-line-strong px-2 aria-pressed:bg-surface-2 aria-pressed:text-fg"
        >
          {v === "a" ? "Arena" : "Ledger"}
        </button>
      ))}
    </div>
  );
}
