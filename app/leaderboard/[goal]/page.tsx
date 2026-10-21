import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompareForm } from "../../../components/CompareForm";
import { EmptyState } from "../../../components/EmptyState";
import { OfferTable } from "../../../components/OfferTable";
import { GOAL_META, dateLabel, today } from "../../../components/format";
import { GOALS, GoalSchema } from "../../../src/core/schema";
import { search } from "../../../src/server/search";

export const revalidate = 3600;
export const dynamicParams = false;

type Props = { params: Promise<{ goal: string }> };

export function generateStaticParams() {
  return GOALS.map((goal) => ({ goal }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const parsed = GoalSchema.safeParse((await params).goal);
  if (!parsed.success) return {};
  const meta = GOAL_META[parsed.data];
  return {
    title: `${meta.name} leaderboard`,
    description: `${meta.blurb} Spanish bank offers ranked by first-year net value.`,
    alternates: { canonical: `/leaderboard/${parsed.data}` },
    openGraph: { title: `${meta.name} leaderboard`, url: `/leaderboard/${parsed.data}` },
  };
}

export default async function GoalBoard({ params }: Props) {
  const parsed = GoalSchema.safeParse((await params).goal);
  if (!parsed.success) notFound();
  const goal = parsed.data;
  const meta = GOAL_META[goal];
  const now = today();
  const res = search({ overrides: { goal }, today: now });
  const rows = res.result.ranked;

  return (
    <div className="wrap pt-6 sm:pt-10">
      <p className="t-caption muted">
        <Link href="/leaderboard" className="underline underline-offset-4">
          Leaderboards
        </Link>
      </p>
      <h1 className="t-title mt-1">{meta.name}</h1>
      <p className="muted mt-2 max-w-2xl">{meta.blurb}</p>

      <section aria-labelledby="board-h" className="mt-6">
        <h2 id="board-h" className="sr-only">
          Ranking
        </h2>
        {rows.length === 0 ? (
          <EmptyState title="No offers for this goal yet.">
            Offers are added as YAML files in the repository. Check back after the next data update.
          </EmptyState>
        ) : (
          <CompareForm>
            <OfferTable rows={rows} mode="board" selectable today={now} caption={`${meta.name} ranked by first-year net value`} />
          </CompareForm>
        )}
      </section>

      <p className="t-caption muted mt-4 max-w-3xl">
        Ranked by first-year net value for a default profile: no income filter, gifts at 80% of retail, 19% withholding on
        cash and interest.
        {res.dataset.latest_verified_on ? ` Data checked up to ${dateLabel(res.dataset.latest_verified_on)}.` : ""}{" "}
        <Link href="/methodology" className="underline underline-offset-4">
          Read the methodology
        </Link>
        , or{" "}
        <Link href="/" className="underline underline-offset-4">
          ask with your own numbers
        </Link>
        .
      </p>
    </div>
  );
}
