"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";

const MAX = 3;

/**
 * Wraps a table with checkboxes named "ids". Without JavaScript the form still works
 * (GET /compare?ids=a&ids=b). With it, the URL is /compare?ids=a,b and the fourth
 * checkbox is disabled.
 */
export function CompareForm({ children }: { children: ReactNode }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [picked, setPicked] = useState<string[]>([]);

  function sync() {
    const f = form.current;
    if (!f) return;
    const boxes = [...f.querySelectorAll<HTMLInputElement>('input[name="ids"]')];
    const on = boxes.filter((b) => b.checked);
    setPicked(on.map((b) => b.value));
    for (const b of boxes) b.disabled = !b.checked && on.length >= MAX;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (picked.length < 2) return;
    router.push(`/compare?ids=${picked.map(encodeURIComponent).join(",")}`);
  }

  const ready = picked.length >= 2;
  return (
    <form ref={form} action="/compare" method="get" onChange={sync} onSubmit={submit}>
      {children}
      <div className="cmp-bar">
        <p className="t-caption muted" aria-live="polite">
          {picked.length === 0
            ? "Tick 2 or 3 offers to compare."
            : `${picked.length} selected${ready ? "" : ", pick one more"}.`}
        </p>
        <button type="submit" className="btn btn-primary" aria-disabled={!ready} disabled={picked.length > 0 && !ready}>
          Compare selected
        </button>
      </div>
    </form>
  );
}
