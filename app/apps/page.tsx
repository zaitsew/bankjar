import type { Metadata } from "next";
import Link from "next/link";
import { AppTable } from "../../components/AppTable";
import { EmptyState } from "../../components/EmptyState";
import { dateLabel, today } from "../../components/format";
import { rankApps } from "../../src/core/app-score";
import { makeProfile } from "../../src/core/profile";
import { scoreOffer } from "../../src/core/score";
import { appsDatasetVersion } from "../../src/server/apps-api";
import { allApps } from "../../src/server/apps";
import { allOffers } from "../../src/server/data";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Bank apps",
  description: "Spanish bank apps ranked by store ratings, release freshness, reach and payment features.",
  alternates: { canonical: "/apps" },
  openGraph: { title: "Spanish bank apps, ranked", url: "/apps" },
};

/** The offer with the highest first-year net value for each bank, scored for the default profile of its own goal. */
function topOffers(now: string): Record<string, { id: string; headline: string }> {
  const best = new Map<string, { id: string; headline: string; net: number }>();
  for (const o of allOffers()) {
    const s = scoreOffer(o, makeProfile({ goal: o.goal }), now);
    if (s.hidden) continue;
    const cur = best.get(o.bank_slug);
    if (!cur || s.net_value_eur > cur.net || (s.net_value_eur === cur.net && o.id < cur.id)) {
      best.set(o.bank_slug, { id: o.id, headline: o.headline, net: s.net_value_eur });
    }
  }
  return Object.fromEntries([...best].map(([slug, { id, headline }]) => [slug, { id, headline }]));
}

export default function AppsPage() {
  const now = today();
  const apps = allApps();
  const ranked = rankApps(apps, now);
  const latest = appsDatasetVersion(apps).latest_verified_on;
  return (
    <div className="wrap pt-6 sm:pt-10">
      <h1 className="t-title">Bank apps</h1>
      <p className="muted mt-2 max-w-2xl">
        Spanish bank apps ranked by store ratings, release freshness, reach and payment features.{" "}
        <Link href="/methodology#bank-apps" className="underline underline-offset-4">
          How the app score works
        </Link>
        .
      </p>
      <div className="mt-8">
        {ranked.length === 0 ? (
          <EmptyState title="No bank apps to rank yet.">The app files in data/apps are empty or older than 60 days.</EmptyState>
        ) : (
          <>
            <AppTable rows={ranked} today={now} topOffers={topOffers(now)} caption="Spanish bank apps ranked by score out of 100" />
            <div className="t-caption muted mt-3 grid max-w-3xl gap-1">
              <p>
                Google Play&apos;s rating count is worldwide; its average is the one Play shows in Spain. Ratings are pulled towards 3.0 stars when an app has few of them.
              </p>
              <p>
                A feature marked <span className="num">?</span> is not checked yet and scores 0. The score is about the app, not about the bank&apos;s offers.
              </p>
              {latest && <p className="num">Data checked up to {dateLabel(latest)}.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
