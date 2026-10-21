import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "../../components/EmptyState";
import { OfferTable } from "../../components/OfferTable";
import { GOAL_META, today } from "../../components/format";
import { GOALS } from "../../src/core/schema";
import { search } from "../../src/server/search";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Leaderboards",
  description: "Spanish bank offers ranked by first-year net value, one board per goal.",
  alternates: { canonical: "/leaderboard" },
  openGraph: { title: "Bank offer leaderboards", url: "/leaderboard" },
};

export default function LeaderboardIndex() {
  const now = today();
  return (
    <div className="wrap pt-6 sm:pt-10">
      <h1 className="t-title">Leaderboards</h1>
      <p className="muted mt-2 max-w-2xl">
        One board per goal, ranked by what you keep in the first year after tax and fees.{" "}
        <Link href="/methodology" className="underline underline-offset-4">
          How the ranking works
        </Link>
        .
      </p>
      <div className="mt-8 grid gap-10">
        {GOALS.map((g) => {
          const top = search({ overrides: { goal: g }, today: now }).result.ranked.slice(0, 3);
          return (
            <section key={g} aria-labelledby={`h-${g}`}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 id={`h-${g}`} className="font-semibold">
                    {GOAL_META[g].name}
                  </h2>
                  <p className="t-caption muted">{GOAL_META[g].blurb}</p>
                </div>
                <Link href={`/leaderboard/${g}`} className="t-caption underline underline-offset-4">
                  Full board
                </Link>
              </div>
              {top.length === 0 ? (
                <EmptyState title="No offers for this goal yet." />
              ) : (
                <OfferTable rows={top} mode="mini" today={now} caption={`Top ${top.length} for ${GOAL_META[g].name}`} />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
