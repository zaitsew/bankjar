import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BankAvatar, RewardBadge, StaleBadge } from "../../../components/Badges";
import {
  GOAL_META,
  ageLabel,
  commitmentLabel,
  dateLabel,
  eur,
  eur2,
  requirementLines,
  rewardView,
  today,
  yesNo,
} from "../../../components/format";
import { ExternalIcon } from "../../../components/icons";
import { makeProfile } from "../../../src/core/profile";
import { scoreOffer } from "../../../src/core/score";
import { allOffers } from "../../../src/server/data";
import { JsonLd, offerJsonLd } from "../../../src/server/jsonld";
import { search } from "../../../src/server/search";

export const revalidate = 3600;

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return allOffers().map((o) => ({ id: o.id }));
}

function findOffer(id: string) {
  return allOffers().find((o) => o.id === id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const offer = findOffer((await params).id);
  if (!offer) return { title: "Offer not found", robots: { index: false } };
  const title = `${offer.bank}: ${offer.headline}`;
  const description = `${offer.product_name} (${GOAL_META[offer.goal].short.toLowerCase()}), checked ${dateLabel(offer.verified_on)}. Terms, catches and first-year net value.`;
  return {
    title,
    description,
    alternates: { canonical: `/offer/${offer.id}` },
    openGraph: { type: "article", title, description, url: `/offer/${offer.id}` },
  };
}

export default async function OfferPage({ params }: Props) {
  const offer = findOffer((await params).id);
  if (!offer) notFound();

  const now = today();
  const score = scoreOffer(offer, makeProfile({ goal: offer.goal }), now);
  const reward = rewardView(offer);
  const reqs = requirementLines(offer);
  const e = offer.eligibility;

  const board = search({ overrides: { goal: offer.goal }, today: now }).result.ranked;
  const rank = board.findIndex((r) => r.offer.id === offer.id);
  const similar = board
    .filter((r) => r.offer.id !== offer.id)
    .sort((a, b) => Math.abs(a.score.net_value_eur - score.net_value_eur) - Math.abs(b.score.net_value_eur - score.net_value_eur))
    .slice(0, 3);

  return (
    <div className="wrap pt-6 sm:pt-10">
      <JsonLd data={offerJsonLd(offer, score)} />
      <p className="t-caption muted">
        <Link href={`/leaderboard/${offer.goal}`} className="underline underline-offset-4">
          {GOAL_META[offer.goal].name}
        </Link>
      </p>
      <div className="mt-2 flex items-start gap-3">
        <BankAvatar slug={offer.bank_slug} name={offer.bank} />
        <div>
          <h1 className="t-title">
            {offer.bank}: {offer.headline}
          </h1>
          <p className="muted mt-1">{offer.product_name}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="panel">
          <p className="t-caption muted">Net value, first year</p>
          <p className="t-title num">{eur(score.net_value_eur)}</p>
          {rank >= 0 && <p className="t-caption muted">#{rank + 1} of {board.length} in this goal</p>}
        </div>
        <div className="panel">
          <p className="t-caption muted">Value per month of commitment</p>
          <p className="t-title num">{score.value_per_month_eur === null ? "n/a" : eur2(score.value_per_month_eur)}</p>
          <p className="t-caption muted">Commitment: {commitmentLabel(offer.commitment_months)}</p>
        </div>
        <div className="panel">
          <p className="t-caption muted">Reward</p>
          <p className="flex flex-wrap items-center gap-2">
            <RewardBadge offer={offer} />
            <span className="num font-semibold">{reward.value}</span>
          </p>
          {reward.detail && <p className="t-caption muted">{reward.detail}</p>}
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="terms-h">
          <h2 id="terms-h" className="font-semibold">
            Terms
          </h2>
          <dl className="terms mt-2">
            <div>
              <dt>Reward</dt>
              <dd>
                {offer.reward.description}
                {offer.reward.paid_when && <span className="muted"> Paid: {offer.reward.paid_when}.</span>}
              </dd>
            </div>
            {offer.rate_tae !== null && (
              <div>
                <dt>Rate</dt>
                <dd className="num">
                  {offer.rate_tae}% TAE
                  {offer.promo_months ? ` for ${offer.promo_months} months` : ""}
                  {offer.balance_cap_eur ? `, on the first ${eur(offer.balance_cap_eur)}` : ""}
                </dd>
              </div>
            )}
            <div>
              <dt>Requirements</dt>
              <dd>
                {reqs.length === 0 ? (
                  "None"
                ) : (
                  <ul className="list-disc pl-5">
                    {reqs.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
            <div>
              <dt>Fees</dt>
              <dd>
                {offer.fees.monthly_eur === null ? "Unknown" : `${eur(offer.fees.monthly_eur)}/month`}
                {offer.fees.notes && <span className="muted">. {offer.fees.notes}</span>}
              </dd>
            </div>
            <div>
              <dt>Penalty</dt>
              <dd>{offer.penalty ?? "None stated"}</dd>
            </div>
            <div>
              <dt>Eligibility</dt>
              <dd>
                <ul className="list-disc pl-5">
                  <li>Residents only: {yesNo(e.residents_only)}</li>
                  <li>NIE or TIE accepted: {yesNo(e.nie_tie_ok)}</li>
                  <li>Open to non-residents: {yesNo(e.non_residents)}</li>
                  {e.notes && <li>{e.notes}</li>}
                </ul>
              </dd>
            </div>
            <div>
              <dt>Valid until</dt>
              <dd>{offer.valid_until ? dateLabel(offer.valid_until) : "No end date stated"}</dd>
            </div>
            <div>
              <dt>Checked</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <time dateTime={offer.verified_on} className="num">
                  {dateLabel(offer.verified_on)}
                </time>
                <span className="muted">({ageLabel(offer.verified_on, now)}, confirmed by {offer.confirmed_by === "bank" ? "the bank" : "an aggregator"})</span>
                {score.stale && <StaleBadge />}
              </dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                <a
                  href={offer.source_url}
                  target="_blank"
                  rel="nofollow noopener"
                  className="inline-flex items-center gap-1 break-all underline underline-offset-4"
                >
                  {offer.source_url}
                  <ExternalIcon />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </dd>
            </div>
            {offer.notes && (
              <div>
                <dt>Notes</dt>
                <dd>{offer.notes}</dd>
              </div>
            )}
          </dl>
        </section>

        <div className="grid content-start gap-8">
          <section aria-labelledby="score-h">
            <h2 id="score-h" className="font-semibold">
              How the value is built
            </h2>
            <div className="tbl-shell mt-2">
              <div className="tbl-wrap">
                <table className="rt">
                  <caption className="sr-only">Score breakdown for the default profile</caption>
                  <thead>
                    <tr>
                      <th scope="col">Line</th>
                      <th scope="col" className="r">
                        EUR
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {score.breakdown.map((line) => (
                      <tr key={line.label}>
                        <th scope="row" className="font-normal">
                          {line.label}
                        </th>
                        <td className="r num">{eur2(line.eur)}</td>
                      </tr>
                    ))}
                    <tr>
                      <th scope="row">Net value, first year</th>
                      <td className="r net">{eur2(score.net_value_eur)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <p className="t-caption muted mt-2">
              Default profile: gifts at 80% of retail, a balance of €10,000. Change them in the{" "}
              <Link href={`/search?goal=${offer.goal}`} className="underline underline-offset-4">
                search filters
              </Link>
              . <Link href="/methodology" className="underline underline-offset-4">Methodology</Link>
            </p>
          </section>

          {score.flags.length > 0 && (
            <section aria-labelledby="flags-h">
              <h2 id="flags-h" className="font-semibold">
                Catches
              </h2>
              <ul className="flag-list wide mt-2">
                {score.flags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <section aria-labelledby="cmp-h" className="mt-10">
        <h2 id="cmp-h" className="font-semibold">
          Compare with
        </h2>
        {similar.length === 0 ? (
          <p className="muted mt-2">No other offer for this goal yet.</p>
        ) : (
          <ul className="mt-2 grid list-none gap-3 p-0 sm:grid-cols-3">
            {similar.map(({ offer: o, score: s }) => (
              <li key={o.id} className="contents">
                <Link href={`/compare?ids=${offer.id},${o.id}`} className="card">
                  <span className="font-semibold">{o.bank}</span>
                  <span className="t-caption muted">{o.headline}</span>
                  <span className="t-caption num">{eur(s.net_value_eur)} net in the first year</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="t-caption muted mt-8">Not financial advice. Terms change: read the bank&apos;s page before you sign.</p>
    </div>
  );
}
