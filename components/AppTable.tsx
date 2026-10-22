import Link from "next/link";
import { SCORED_FEATURES, FEATURE_LABELS, type RankedApp, type ScoredFeature } from "../src/core/app-score";
import type { BankApp } from "../src/core/app-schema";
import { BankAvatar, StaleBadge } from "./Badges";
import { ageLabel, dateLabel } from "./format";

interface Props {
  rows: RankedApp[];
  today: string;
  /** Best offer per bank slug, for the "Top offer" link. Leave a bank out to show no link. */
  topOffers: Record<string, { id: string; headline: string }>;
  /** Visible to screen readers only. */
  caption: string;
}

const FEATURE_SHORT: Record<ScoredFeature, string> = { bizum: "Bizum", apple_pay: "Apple Pay", google_pay: "Google Pay", english: "EN" };

/** Newest release date of the two stores, or null. */
export function latestRelease(app: BankApp): string | null {
  const dates = [app.ios?.updated_on, app.android?.updated_on].filter((d): d is string => typeof d === "string");
  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
}

const STATE = {
  yes: { mark: "✓", word: "yes", cls: "badge-cash" },
  no: { mark: "✕", word: "no", cls: "badge-none" },
  unknown: { mark: "?", word: "unknown", cls: "badge-unknown" },
} as const;

export function FeatureBadge({ feature, value }: { feature: ScoredFeature; value: boolean | null }) {
  const s = value === null ? STATE.unknown : value ? STATE.yes : STATE.no;
  const label = `${FEATURE_LABELS[feature]}: ${s.word}`;
  return (
    <li className={`badge ${s.cls}`} title={label}>
      <span aria-hidden="true">
        {s.mark} {FEATURE_SHORT[feature]}
      </span>
      <span className="sr-only">{label}</span>
    </li>
  );
}

function StoreCell({ label, store, bank }: { label: string; store: BankApp["ios"] | BankApp["android"]; bank: string }) {
  if (!store) {
    return (
      <td data-label={label}>
        <span className="muted">Not on {label}</span>
      </td>
    );
  }
  return (
    <td data-label={label}>
      <a className="src inline-flex flex-col underline underline-offset-4" href={store.url} target="_blank" rel="nofollow noopener">
        <span className="num">
          {store.rating === null ? (
            "No rating yet"
          ) : (
            <>
              <span aria-hidden="true">★ </span>
              {store.rating.toFixed(2)}
              <span className="sr-only"> out of 5 stars</span>
            </>
          )}
        </span>
        <span className="t-caption muted num">{store.ratings_count.toLocaleString("en")} ratings</span>
        <span className="sr-only">
          on {label} for {bank} (opens in a new tab)
        </span>
      </a>
    </td>
  );
}

export function AppTable({ rows, today, topOffers, caption }: Props) {
  return (
    <div className="tbl-shell">
      <div className="tbl-wrap">
        <table className="rt rt-full rt-apps">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="rank">
                <span className="sr-only">Rank</span>
                <span aria-hidden="true">#</span>
              </th>
              <th scope="col" className="offer-cell">
                App
              </th>
              <th scope="col">Score</th>
              <th scope="col">App Store</th>
              <th scope="col">Google Play</th>
              <th scope="col">Last release</th>
              <th scope="col">Features</th>
              <th scope="col">Checked</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ rank, app, score }) => {
              const release = latestRelease(app);
              const top = topOffers[app.bank_slug];
              return (
                <tr key={app.id}>
                  <td className="rank">{rank}</td>
                  <th scope="row" className="offer-cell">
                    <span className="flex items-start gap-3">
                      <BankAvatar slug={app.bank_slug} name={app.bank} />
                      <span className="cell-stack">
                        <span className="offer-bank">{app.bank}</span>
                        <span className="offer-headline">{app.app_name}</span>
                        {top && (
                          <Link href={`/offer/${top.id}`} className="t-caption underline underline-offset-4">
                            Top offer
                            <span className="sr-only">
                              {" "}
                              from {app.bank}: {top.headline}
                            </span>
                          </Link>
                        )}
                      </span>
                    </span>
                  </th>
                  <td data-label="Score">
                    <span className="cell-stack">
                      <span>
                        <span className="net">{score.score.toFixed(1)}</span>
                        <span className="muted"> / 100</span>
                      </span>
                      <details className="disc app-breakdown">
                        <summary className="t-caption">Breakdown</summary>
                        <ul className="flag-list wide">
                          {score.breakdown.map((line) => (
                            <li key={line.label}>
                              <span className="num">
                                {line.points.toFixed(1)} / {line.max}
                              </span>{" "}
                              {line.label}
                            </li>
                          ))}
                        </ul>
                        {score.flags.length > 0 && (
                          <ul className="flag-list wide app-flags">
                            {score.flags.map((f) => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                        )}
                      </details>
                    </span>
                  </td>
                  <StoreCell label="App Store" store={app.ios} bank={app.bank} />
                  <StoreCell label="Google Play" store={app.android} bank={app.bank} />
                  <td data-label="Last release">
                    {release ? (
                      <span className="cell-stack">
                        <time dateTime={release} className="num">
                          {dateLabel(release)}
                        </time>
                        <span className="t-caption muted">{ageLabel(release, today)}</span>
                      </span>
                    ) : (
                      <span className="muted">Unknown</span>
                    )}
                  </td>
                  <td data-label="Features">
                    <ul className="chips" aria-label={`Features of the ${app.bank} app`}>
                      {SCORED_FEATURES.map((f) => (
                        <FeatureBadge key={f} feature={f} value={score.features[f]} />
                      ))}
                    </ul>
                  </td>
                  <td data-label="Checked">
                    <span className="cell-stack">
                      <time dateTime={app.verified_on} className="num">
                        {dateLabel(app.verified_on)}
                      </time>
                      <span className="flex flex-wrap items-center gap-2 t-caption muted">
                        {ageLabel(app.verified_on, today)}
                        {score.stale && <StaleBadge />}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
