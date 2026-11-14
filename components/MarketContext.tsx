import type { BenchmarkRow } from "../src/server/benchmarks-api";
import { StaleBadge } from "./Badges";
import { dateLabel, periodLabel } from "./format";

/**
 * "Market context": official reference numbers above the savings and deposit boards.
 * Context only. The strip reads no offer and no score, and nothing in the ranking reads the strip.
 * Server-rendered; every value links to its publisher.
 */

const SHORT: Record<string, { label: string; publisher: string }> = {
  "bde-new-deposits-households-up-to-1y": { label: "BdE average, new household deposits up to 1 year", publisher: "Banco de España" },
  "ecb-deposit-facility-rate": { label: "ECB deposit facility rate", publisher: "ECB" },
  "es-letra-12m-average-yield": { label: "12-month Letra, average yield, gross", publisher: "Tesoro Público" },
  "ine-cpi-yoy": { label: "CPI, year on year", publisher: "INE" },
};

function whenLabel(b: BenchmarkRow): string {
  const p = periodLabel(b.period);
  if (b.kind === "treasury_yield") return `auction ${p}`;
  if (b.kind === "policy_rate" || b.kind === "overnight_rate") return `as of ${p}`;
  return p;
}

export function MarketContext({ items }: { items: readonly BenchmarkRow[] }) {
  if (items.length === 0) return null;
  const hasCpi = items.some((b) => b.kind === "cpi_yoy");
  return (
    <section aria-labelledby="mkt-h" className="mkt panel mt-6" data-testid="market-context">
      <h2 id="mkt-h" className="font-semibold">
        Market context
      </h2>
      <dl className="mkt-grid mt-2">
        {items.map((b) => {
          const s = SHORT[b.id] ?? { label: b.label, publisher: b.source_name };
          return (
            <div key={b.id} className="mkt-item" data-benchmark={b.id}>
              <dt className="t-caption muted">{s.label}</dt>
              <dd>
                <a href={b.source_url} target="_blank" rel="nofollow noopener" className="num font-semibold underline underline-offset-4">
                  {Number(b.value.toFixed(3))} %<span className="sr-only"> (opens {s.publisher} in a new tab)</span>
                </a>{" "}
                {b.stale && <StaleBadge title={`Not re-fetched for more than ${b.stale_after_days} days`} />}
                <span className="t-caption muted block">
                  {whenLabel(b)}. {s.publisher}, fetched <time dateTime={b.fetched_on}>{dateLabel(b.fetched_on)}</time>
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="t-caption muted mt-3">
        {hasCpi ? "Real return ≈ nominal − CPI, approximate. " : ""}Reference numbers from official publishers. They do not change the ranking below.
      </p>
    </section>
  );
}
