import type { Profile } from "./profile";
import type { Offer } from "./schema";
import { isoDay, scoreOffer, type DateInput, type Score } from "./score";

export interface RankedOffer {
  offer: Offer;
  score: Score;
}

export interface ExcludedOffer {
  offer: Offer;
  reasons: string[];
}

export interface RankResult {
  ranked: RankedOffer[];
  excluded: ExcludedOffer[];
}

/**
 * Reasons this person cannot or should not take this offer. An empty list
 * means the offer is open to them. Hidden (expired or too old) offers are
 * reported here too, so no ranking ever shows them.
 */
export function exclusionReasons(offer: Offer, profile: Profile, today: DateInput): string[] {
  const reasons: string[] = [];
  const score = scoreOffer(offer, profile, today);

  if (score.hidden) {
    reasons.push(
      offer.valid_until !== null && offer.valid_until < isoDay(today)
        ? `expired on ${offer.valid_until}`
        : `not verified since ${offer.verified_on}`,
    );
  }

  const minIncome = offer.requirements.min_monthly_income_eur;
  if (minIncome !== null && profile.monthly_income_eur !== undefined && profile.monthly_income_eur < minIncome) {
    reasons.push(`needs income of at least EUR ${minIncome} a month`);
  }

  if (offer.requirements.new_customer_only && profile.existing_customer_of.includes(offer.bank_slug)) {
    reasons.push(`new customers only, and you already bank with ${offer.bank}`);
  }

  const e = offer.eligibility;
  if (profile.residency === "non_resident" && (e.residents_only === true || e.non_residents === false)) {
    reasons.push("not open to non-residents");
  }
  if (profile.residency === "nie_tie" && e.nie_tie_ok === false) {
    reasons.push("not open with a NIE or TIE");
  }

  const commitment = offer.commitment_months;
  if (
    profile.max_commitment_months !== undefined &&
    commitment !== null &&
    commitment > profile.max_commitment_months
  ) {
    reasons.push(`commitment of ${commitment} months is longer than your ${profile.max_commitment_months}`);
  }

  if (profile.prefer === "cash" && offer.reward.type === "gift") {
    reasons.push("gift reward, and you asked for cash only");
  }

  return reasons;
}

/** Order: net value (high first), value per month (high first, none last), newer verification, id. */
function compare(a: RankedOffer, b: RankedOffer): number {
  if (b.score.net_value_eur !== a.score.net_value_eur) return b.score.net_value_eur - a.score.net_value_eur;
  const pa = a.score.value_per_month_eur;
  const pb = b.score.value_per_month_eur;
  if (pa !== pb) {
    if (pa === null) return 1;
    if (pb === null) return -1;
    return pb - pa;
  }
  if (a.offer.verified_on !== b.offer.verified_on) return a.offer.verified_on < b.offer.verified_on ? 1 : -1;
  return a.offer.id < b.offer.id ? -1 : a.offer.id > b.offer.id ? 1 : 0;
}

/**
 * Filter offers to the person's goal and eligibility, score them, and sort.
 * Offers for another goal are left out silently. Offers for the goal that the
 * person cannot take come back in `excluded` with reasons. Paid placement never
 * changes the order.
 */
export function rankOffers(offers: readonly Offer[], profile: Profile, today: DateInput): RankResult {
  const ranked: RankedOffer[] = [];
  const excluded: ExcludedOffer[] = [];

  for (const offer of offers) {
    if (profile.goal !== undefined && offer.goal !== profile.goal) continue;
    const reasons = exclusionReasons(offer, profile, today);
    if (reasons.length > 0) {
      excluded.push({ offer, reasons });
    } else {
      ranked.push({ offer, score: scoreOffer(offer, profile, today) });
    }
  }

  ranked.sort(compare);
  excluded.sort((a, b) => (a.offer.id < b.offer.id ? -1 : 1));
  return { ranked, excluded };
}

export interface CompareItem {
  offer: Offer;
  score: Score;
  /** Empty when the person can take this offer. */
  reasons: string[];
}

export interface CompareResult {
  /** In the order of the requested ids. */
  items: CompareItem[];
  /** Requested ids that match no offer. */
  missing: string[];
}

/**
 * Side-by-side view. Unlike rankOffers it keeps offers the person cannot take
 * and says why, because the person chose these offers on purpose.
 */
export function compareOffers(
  offers: readonly Offer[],
  ids: readonly string[],
  profile: Profile,
  today: DateInput,
): CompareResult {
  const byId = new Map(offers.map((o) => [o.id, o]));
  const items: CompareItem[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const offer = byId.get(id);
    if (!offer) {
      missing.push(id);
      continue;
    }
    items.push({ offer, score: scoreOffer(offer, profile, today), reasons: exclusionReasons(offer, profile, today) });
  }
  return { items, missing };
}
