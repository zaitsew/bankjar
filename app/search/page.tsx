import type { Metadata } from "next";
import Link from "next/link";
import { CompareForm } from "../../components/CompareForm";
import { EmptyState } from "../../components/EmptyState";
import { ExampleCards } from "../../components/ExampleCards";
import { FilterForm } from "../../components/FilterForm";
import { IntentChips, chipsFor } from "../../components/IntentChips";
import { OfferTable } from "../../components/OfferTable";
import { PromptBox } from "../../components/PromptBox";
import { dateLabel, today } from "../../components/format";
import { first, overridesFrom, type SearchParams } from "../../components/params";
import { getVariant } from "../../components/variant";
import { search } from "../../src/server/search";

type Props = { searchParams: Promise<SearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = (first((await searchParams).q) ?? "").trim();
  return {
    title: q ? `Offers for: ${q}` : "Search bank offers",
    description: "Bank offers ranked by what you keep after tax and fees, with every catch and source shown.",
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const variant = await getVariant(sp);
  const q = (first(sp.q) ?? "").trim();
  const overrides = overridesFrom(sp);
  const asked = q !== "" || Object.keys(overrides).length > 0;
  const now = today();
  const res = search({ q, overrides, today: now });
  const { ranked, excluded } = res.result;
  const explicit = { ...res.intent.profile, ...overrides };

  return (
    <div className={variant === "b" ? "v-b" : "v-a"}>
      <div className="wrap pt-6 sm:pt-10">
        <h1 className="t-title mb-4">{q ? "Offers for your question" : "Search bank offers"}</h1>
        <div className="max-w-3xl">
          <PromptBox defaultValue={q} />
        </div>

        {!asked ? (
          <div className="mt-10">
            <p className="muted mb-4">Ask in your own words, in English, Spanish or Russian. Or start from an example.</p>
            <ExampleCards />
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-col gap-3">
              <IntentChips chips={chipsFor(res, overrides)} />
              <FilterForm res={res} explicit={explicit} />
              {res.intent.goal === null && overrides.goal === undefined && (
                <p className="t-caption muted" role="status">
                  We could not tell the goal from your question, so we show salary offers. Pick another goal in the filters.
                </p>
              )}
            </div>

            {ranked.length > 0 && (
              <p className="mt-6 max-w-3xl" aria-live="polite">
                {res.summary}
              </p>
            )}
            <p className="t-caption muted mt-1 num">
              {ranked.length} {ranked.length === 1 ? "offer" : "offers"} ranked
              {res.dataset.latest_verified_on ? `, data checked up to ${dateLabel(res.dataset.latest_verified_on)}` : ""}.{" "}
              <Link href="/methodology" className="underline underline-offset-4">
                How we rank
              </Link>
            </p>

            <section aria-labelledby="results-h" className="mt-4">
              <h2 id="results-h" className="sr-only">
                Results
              </h2>
              {ranked.length === 0 ? (
                <EmptyState title="No offer matches these filters.">
                  {excluded.length > 0
                    ? "Loosen a filter, or read why each offer was left out below."
                    : "The dataset has no offers for this goal yet."}
                </EmptyState>
              ) : (
                <CompareForm>
                  <OfferTable
                    rows={ranked}
                    mode="full"
                    selectable
                    today={now}
                    caption={`Offers ranked by first-year net value for ${res.goal}`}
                  />
                </CompareForm>
              )}
            </section>

            {excluded.length > 0 && (
              <details className="disc mt-8" open={ranked.length === 0}>
                <summary>
                  Left out ({excluded.length})
                </summary>
                <ul className="mt-2 grid list-none gap-2 p-0">
                  {excluded.map(({ offer, reasons }) => (
                    <li key={offer.id} className="panel">
                      <Link href={`/offer/${offer.id}`} className="font-semibold underline-offset-4 hover:underline">
                        {offer.bank}: {offer.headline}
                      </Link>
                      <ul className="t-caption muted mt-1 list-disc pl-5">
                        {reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {ranked.length === 0 && (
              <div className="mt-10">
                <p className="muted mb-3">Try one of these instead.</p>
                <ExampleCards />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
