import Link from "next/link";
import type { RankedOffer } from "../src/core/rank";
import { BankAvatar, RewardBadge, StaleBadge } from "./Badges";
import { ageLabel, commitmentLabel, dateLabel, eur, eur2, requirementLines, rewardView } from "./format";
import { ExternalIcon } from "./icons";

export type TableMode = "full" | "board" | "mini";

interface Props {
  rows: RankedOffer[];
  mode: TableMode;
  /** Visible to screen readers only. */
  caption: string;
  today: string;
  /** Adds a checkbox per row. The caller wraps the table in <CompareForm>. */
  selectable?: boolean;
}

function OfferCell({ row }: { row: RankedOffer }) {
  const { offer } = row;
  return (
    <th scope="row" className="offer-cell">
      <Link href={`/offer/${offer.id}`} className="offer-link flex items-start gap-3">
        <BankAvatar slug={offer.bank_slug} name={offer.bank} />
        <span className="cell-stack">
          <span className="offer-bank">{offer.bank}</span>
          <span className="offer-headline">{offer.headline}</span>
        </span>
      </Link>
    </th>
  );
}

function RewardCell({ row }: { row: RankedOffer }) {
  const r = rewardView(row.offer);
  return (
    <td data-label="Reward">
      <span className="cell-stack">
        <span className="flex flex-wrap items-center gap-2">
          <RewardBadge offer={row.offer} />
          <span className="num">{r.value}</span>
        </span>
        {r.detail && <span className="t-caption muted">{r.detail}</span>}
      </span>
    </td>
  );
}

function VerifiedCell({ row, today }: { row: RankedOffer; today: string }) {
  const v = row.offer.verified_on;
  return (
    <td data-label="Verified">
      <span className="cell-stack">
        <time dateTime={v} className="num">
          {dateLabel(v)}
        </time>
        <span className="flex flex-wrap items-center gap-2 t-caption muted">
          {ageLabel(v, today)}
          {row.score.stale && <StaleBadge />}
        </span>
      </span>
    </td>
  );
}

function SourceCell({ row }: { row: RankedOffer }) {
  return (
    <td data-label="Source">
      <a
        className="src inline-flex items-center gap-1 underline underline-offset-4"
        href={row.offer.source_url}
        target="_blank"
        rel="nofollow noopener"
      >
        Source
        <ExternalIcon />
        <span className="sr-only">
          for {row.offer.bank}: {row.offer.headline} (opens in a new tab)
        </span>
      </a>
    </td>
  );
}

export function OfferTable({ rows, mode, caption, today, selectable = false }: Props) {
  return (
    <div className="tbl-shell">
      <div className="tbl-wrap">
        <table className={`rt rt-${mode}`}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className="pick">
                  <span className="sr-only">Compare</span>
                </th>
              )}
              <th scope="col" className="rank">
                <span className="sr-only">Rank</span>
                <span aria-hidden="true">#</span>
              </th>
              <th scope="col" className="offer-cell">
                Offer
              </th>
              {mode === "full" && <th scope="col">Reward</th>}
              {mode === "board" && <th scope="col">Reward</th>}
              {mode !== "mini" && <th scope="col">Commitment</th>}
              <th scope="col" className="r">
                Net, 1st year
              </th>
              <th scope="col" className="r">
                Per month
              </th>
              {mode === "full" && <th scope="col">Requirements</th>}
              {mode === "full" && <th scope="col">Catches</th>}
              {mode !== "mini" && <th scope="col">Verified</th>}
              {mode !== "mini" && <th scope="col">Source</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const { offer, score } = row;
              const reqs = requirementLines(offer);
              return (
                <tr key={offer.id}>
                  {selectable && (
                    <td className="pick">
                      <label className="cb">
                        <input type="checkbox" name="ids" value={offer.id} />
                        <span className="sr-only">
                          Compare {offer.bank}: {offer.headline}
                        </span>
                      </label>
                    </td>
                  )}
                  <td className="rank">{i + 1}</td>
                  <OfferCell row={row} />
                  {mode !== "mini" && <RewardCell row={row} />}
                  {mode !== "mini" && (
                    <td data-label="Commitment" className="num">
                      {commitmentLabel(offer.commitment_months)}
                    </td>
                  )}
                  <td data-label="Net, 1st year" className="r net">
                    {eur(score.net_value_eur)}
                  </td>
                  <td data-label="Per month" className="r num">
                    {score.value_per_month_eur === null ? (
                      <span className="muted">n/a</span>
                    ) : (
                      eur2(score.value_per_month_eur)
                    )}
                  </td>
                  {mode === "full" && (
                    <td data-label="Requirements">
                      {reqs.length === 0 ? (
                        <span className="muted">None</span>
                      ) : (
                        <ul className="flag-list">
                          {reqs.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  )}
                  {mode === "full" && (
                    <td data-label="Catches">
                      {score.flags.length === 0 ? (
                        <span className="muted">None</span>
                      ) : (
                        <ul className="flag-list">
                          {score.flags.map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  )}
                  {mode !== "mini" && <VerifiedCell row={row} today={today} />}
                  {mode !== "mini" && <SourceCell row={row} />}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
