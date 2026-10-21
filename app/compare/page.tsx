import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BankAvatar, RewardBadge, StaleBadge } from "../../components/Badges";
import { EmptyState } from "../../components/EmptyState";
import { GOAL_META, commitmentLabel, dateLabel, eur, eur2, requirementLines, rewardView, today, yesNo } from "../../components/format";
import { ExternalIcon } from "../../components/icons";
import { idsFrom, type SearchParams } from "../../components/params";
import { makeProfile } from "../../src/core/profile";
import { compareOffers, type CompareItem } from "../../src/core/rank";
import { allOffers } from "../../src/server/data";

type Props = { searchParams: Promise<SearchParams> };

export const metadata: Metadata = {
  title: "Side by side",
  description: "Two or three bank offers in one grid: every term in a row, the best value highlighted.",
  robots: { index: false, follow: true },
};

interface Row {
  label: string;
  cell: (i: CompareItem) => ReactNode;
  /** Numeric value for highlighting, or null when the row is text. */
  num?: (i: CompareItem) => number | null;
  /** Which end of the numbers is best. */
  best?: "high" | "low";
}

const ROWS: Row[] = [
  { label: "Goal", cell: (i) => GOAL_META[i.offer.goal].short },
  { label: "Product", cell: (i) => i.offer.product_name },
  {
    label: "Reward",
    cell: (i) => {
      const r = rewardView(i.offer);
      return (
        <span className="flex flex-wrap items-center gap-2">
          <RewardBadge offer={i.offer} />
          <span className="num">{r.value}</span>
        </span>
      );
    },
  },
  {
    label: "Net value, first year",
    cell: (i) => eur2(i.score.net_value_eur),
    num: (i) => i.score.net_value_eur,
    best: "high",
  },
  {
    label: "Value per month",
    cell: (i) => (i.score.value_per_month_eur === null ? "n/a" : eur2(i.score.value_per_month_eur)),
    num: (i) => i.score.value_per_month_eur,
    best: "high",
  },
  {
    label: "Commitment",
    cell: (i) => commitmentLabel(i.offer.commitment_months),
    num: (i) => i.offer.commitment_months,
    best: "low",
  },
  {
    label: "Rate (TAE)",
    cell: (i) => (i.offer.rate_tae === null ? "n/a" : `${i.offer.rate_tae}%`),
    num: (i) => i.offer.rate_tae,
    best: "high",
  },
  {
    label: "Rate period",
    cell: (i) => (i.offer.promo_months ? `${i.offer.promo_months} months` : "n/a"),
  },
  {
    label: "Balance cap",
    cell: (i) => (i.offer.balance_cap_eur === null ? "n/a" : eur(i.offer.balance_cap_eur)),
    num: (i) => i.offer.balance_cap_eur,
    best: "high",
  },
  {
    label: "Monthly fee",
    cell: (i) => (i.offer.fees.monthly_eur === null ? "Unknown" : eur(i.offer.fees.monthly_eur)),
    num: (i) => i.offer.fees.monthly_eur,
    best: "low",
  },
  {
    label: "Minimum income",
    cell: (i) => {
      const m = i.offer.requirements.min_monthly_income_eur;
      return m === null || m === 0 ? "None" : `${eur(m)}/month`;
    },
    num: (i) => i.offer.requirements.min_monthly_income_eur ?? 0,
    best: "low",
  },
  { label: "New customers only", cell: (i) => yesNo(i.offer.requirements.new_customer_only) },
  {
    label: "Other requirements",
    cell: (i) => {
      const other = i.offer.requirements.other;
      return other.length === 0 ? "None" : (
        <ul className="list-disc pl-4">
          {other.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      );
    },
  },
  { label: "Penalty", cell: (i) => i.offer.penalty ?? "None stated" },
  { label: "Residents only", cell: (i) => yesNo(i.offer.eligibility.residents_only) },
  { label: "NIE or TIE accepted", cell: (i) => yesNo(i.offer.eligibility.nie_tie_ok) },
  { label: "Open to non-residents", cell: (i) => yesNo(i.offer.eligibility.non_residents) },
  {
    label: "Catches",
    cell: (i) =>
      i.score.flags.length === 0 ? (
        "None"
      ) : (
        <ul className="flag-list wide">
          {i.score.flags.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ),
  },
  {
    label: "Valid until",
    cell: (i) => (i.offer.valid_until ? dateLabel(i.offer.valid_until) : "No end date"),
  },
  {
    label: "Verified",
    cell: (i) => (
      <span className="flex flex-wrap items-center gap-2">
        <time dateTime={i.offer.verified_on}>{dateLabel(i.offer.verified_on)}</time>
        {i.score.stale && <StaleBadge />}
      </span>
    ),
  },
  {
    label: "Source",
    cell: (i) => (
      <a
        href={i.offer.source_url}
        target="_blank"
        rel="nofollow noopener"
        className="inline-flex items-center gap-1 underline underline-offset-4"
      >
        Source
        <ExternalIcon />
        <span className="sr-only">for {i.offer.bank} (opens in a new tab)</span>
      </a>
    ),
  },
];

function bestIndexes(items: CompareItem[], row: Row): Set<number> {
  const out = new Set<number>();
  if (!row.num || !row.best || items.length < 2) return out;
  const vals = items.map((i) => row.num!(i));
  const real = vals.filter((v): v is number => v !== null);
  if (real.length < 2 || new Set(real).size < 2) return out; // nothing to single out
  const target = row.best === "high" ? Math.max(...real) : Math.min(...real);
  vals.forEach((v, idx) => {
    if (v === target) out.add(idx);
  });
  return out;
}

export default async function ComparePage({ searchParams }: Props) {
  const sp = await searchParams;
  const ids = idsFrom(sp.ids);
  const all = allOffers();
  const now = today();

  if (ids.length === 0) {
    const pick = all.slice(0, 40);
    return (
      <div className="wrap pt-6 sm:pt-10">
        <h1 className="t-title">Side by side</h1>
        <p className="muted mt-2 max-w-2xl">Pick two or three offers. Every term goes in one grid and the best value in each row is marked.</p>
        {pick.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="No offers in the dataset yet." />
          </div>
        ) : (
          <form action="/compare" method="get" className="mt-6 max-w-3xl">
            <fieldset className="panel grid gap-1">
              <legend className="font-semibold px-1">Offers</legend>
              {pick.map((o) => (
                <label key={o.id} className="flex min-h-11 items-center gap-3 rounded-sm px-1 hover:bg-surface-2">
                  <input type="checkbox" name="ids" value={o.id} className="h-4 w-4 accent-accent" />
                  <span>
                    <span className="font-semibold">{o.bank}</span> <span className="muted">{o.headline}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <button type="submit" className="btn btn-primary mt-4">
              Compare selected
            </button>
          </form>
        )}
      </div>
    );
  }

  const { items, missing } = compareOffers(all, ids, makeProfile(), now);

  return (
    <div className="wrap pt-6 sm:pt-10">
      <h1 className="t-title">Side by side</h1>
      {missing.length > 0 && (
        <p className="mt-2 text-danger" role="alert">
          No offer with {missing.length === 1 ? "this id" : "these ids"}: {missing.join(", ")}.
        </p>
      )}
      {items.length < 2 ? (
        <div className="mt-6 grid gap-4">
          <EmptyState title="Pick at least two offers to compare.">
            {items.length === 1 ? `You picked ${items[0]!.offer.bank}: ${items[0]!.offer.headline}.` : "None of the ids matched."}
          </EmptyState>
          <div>
            <Link href="/compare" className="btn">
              Choose offers
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="muted mt-2">
            Default profile: gifts at 80% of retail. The best value in each numeric row has a green outline.{" "}
            <Link href="/methodology" className="underline underline-offset-4">
              How we rank
            </Link>
          </p>
          <div className="tbl-wrap mt-4">
            <table className="cmp-grid">
              <caption className="sr-only">Side-by-side comparison of {items.length} offers</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Field</span></th>
                  {items.map((i) => (
                    <th key={i.offer.id} scope="col">
                      <Link href={`/offer/${i.offer.id}`} className="flex items-start gap-3 no-underline hover:underline">
                        <BankAvatar slug={i.offer.bank_slug} name={i.offer.bank} />
                        <span>
                          <span className="block">{i.offer.bank}</span>
                          <span className="t-caption muted block font-normal">{i.offer.headline}</span>
                        </span>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const best = bestIndexes(items, row);
                  return (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      {items.map((i, idx) => (
                        <td key={i.offer.id} className={`num ${best.has(idx) ? "best" : ""}`}>
                          {row.cell(i)}
                          {best.has(idx) && <span className="best-mark block">Best</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr>
                  <th scope="row">Open to you?</th>
                  {items.map((i) => (
                    <td key={i.offer.id}>
                      {i.reasons.length === 0 ? (
                        "Yes, with the default profile"
                      ) : (
                        <ul className="flag-list wide">
                          {i.reasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
