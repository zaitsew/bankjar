import Link from "next/link";

/** Search · Side by side · Blind pick. Blind pick ships in Sprint 3. */
export function ModeSwitch({ current = "search" }: { current?: "search" | "compare" }) {
  return (
    <div role="group" aria-label="Mode" className="modes">
      <Link href="/" className="mode" aria-current={current === "search" ? "page" : undefined}>
        Search
      </Link>
      <Link href="/compare" className="mode" aria-current={current === "compare" ? "page" : undefined}>
        Side by side
      </Link>
      <span className="mode" aria-disabled="true" title="Coming soon">
        Blind pick
        <span className="tag">
          <span className="sm:hidden">Soon</span>
          <span className="hidden sm:inline">Coming soon</span>
        </span>
      </span>
    </div>
  );
}
