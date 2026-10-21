/**
 * Scoring rules. Pure functions, no I/O. The same rules are written in plain
 * English in docs/METHODOLOGY.md; change both together.
 *
 * Every offer gets two numbers:
 *
 *   net_value_eur        First-year net value in EUR.
 *   value_per_month_eur  Net value per month of commitment (null when there is
 *                        no commitment to divide by).
 *
 * Rules:
 *  1. Cash reward:  value x (1 - 0.19). Spanish bank bonuses are capital income
 *     and carry 19% withholding.
 *  2. Gift reward:  value x gift_factor (default 0.8), minus 19% of the gift's
 *     retail value as tax on payment in kind. The schema has no field saying
 *     the bank pays that tax, so we always charge it and flag
 *     "tax on gift: check terms".
 *  3. Fee waiver:   value counts as is. A saved fee is not income, so no tax.
 *  4. Interest:     min(balance, balance_cap) x TAE/100 x min(promo_months, 12)/12,
 *     then minus 19% withholding. Counted for reward.type "rate" and for any
 *     savings or deposit offer that has a rate_tae. The balance is the person's
 *     stated balance (default 10,000).
 *  5. Fees:         net_value subtracts 12 months of fees.monthly_eur.
 *     value_per_month subtracts monthly_eur x max(commitment_months, 12).
 *  6. value_per_month = (reward and interest after tax - fees over the commitment)
 *     / commitment_months, only when commitment_months > 0.
 *  7. Penalties, paid placement and unknown values show as flags. A flag never
 *     changes a number.
 *  8. stale  = verified_on is more than 30 days before today.
 *     hidden = verified_on is more than 60 days before today, or valid_until is
 *     before today. Hidden offers never reach a ranking.
 *
 * Amounts are rounded to cents at the end of each line, never earlier.
 */

import type { Profile } from "./profile";
import type { Offer } from "./schema";

export const WITHHOLDING_RATE = 0.19;
export const STALE_AFTER_DAYS = 30;
export const HIDDEN_AFTER_DAYS = 60;

export type DateInput = string | Date;

export interface BreakdownLine {
  label: string;
  eur: number;
}

export interface Score {
  net_value_eur: number;
  value_per_month_eur: number | null;
  breakdown: BreakdownLine[];
  flags: string[];
  stale: boolean;
  hidden: boolean;
}

const cents = (n: number): number => {
  const r = Math.round((n + Number.EPSILON) * 100) / 100;
  return r === 0 ? 0 : r; // no negative zero
};

/** Normalise a Date or an ISO string to YYYY-MM-DD. */
export function isoDay(d: DateInput): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`Expected YYYY-MM-DD, got "${d}"`);
  return d;
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: DateInput, to: DateInput): number {
  const a = Date.parse(`${isoDay(from)}T00:00:00Z`);
  const b = Date.parse(`${isoDay(to)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function isStale(offer: Offer, today: DateInput): boolean {
  return daysBetween(offer.verified_on, today) > STALE_AFTER_DAYS;
}

export function isHidden(offer: Offer, today: DateInput): boolean {
  if (daysBetween(offer.verified_on, today) > HIDDEN_AFTER_DAYS) return true;
  return offer.valid_until !== null && daysBetween(offer.valid_until, today) > 0;
}

const eur = (n: number) => `EUR ${Number.isInteger(n) ? n : n.toFixed(2)}`;

export function scoreOffer(offer: Offer, profile: Profile, today: DateInput): Score {
  const breakdown: BreakdownLine[] = [];
  const flags: string[] = [];
  let rewardNet = 0; // reward and interest after tax, before fees

  const add = (label: string, amount: number, toReward = true) => {
    const v = cents(amount);
    breakdown.push({ label, eur: v });
    if (toReward) rewardNet += v;
  };

  // 1-3. The reward itself.
  const value = offer.reward.value_eur;
  switch (offer.reward.type) {
    case "cash": {
      const v = value ?? 0;
      if (value === null) flags.push("reward value unknown");
      add(`Cash reward ${eur(v)}`, v);
      add("Withholding 19%", -v * WITHHOLDING_RATE);
      break;
    }
    case "gift": {
      const v = value ?? 0;
      if (value === null) flags.push("reward value unknown");
      add(`Gift at ${Math.round(profile.gift_factor * 100)}% of retail ${eur(v)}`, v * profile.gift_factor);
      add("Tax on gift, 19% of retail value", -v * WITHHOLDING_RATE);
      flags.push("tax on gift: check terms");
      break;
    }
    case "fee_waiver": {
      const v = value ?? 0;
      if (value === null) flags.push("reward value unknown");
      add(`Fee waiver ${eur(v)}`, v);
      break;
    }
    case "rate":
    case "none":
      break;
  }

  // 4. Interest.
  const earnsInterest =
    offer.rate_tae !== null &&
    (offer.reward.type === "rate" || offer.goal === "savings" || offer.goal === "deposit");
  if (earnsInterest && offer.rate_tae !== null) {
    const base = Math.min(profile.balance_eur, offer.balance_cap_eur ?? Number.POSITIVE_INFINITY);
    const months = Math.min(offer.promo_months ?? 12, 12);
    const gross = (base * offer.rate_tae) / 100 * (months / 12);
    add(`Interest ${offer.rate_tae}% TAE on ${eur(base)} for ${months} months`, gross);
    add("Withholding 19% on interest", -gross * WITHHOLDING_RATE);
  } else if (offer.reward.type === "rate") {
    flags.push("rate unknown");
  }

  // 5. Fees.
  const monthlyFee = offer.fees.monthly_eur ?? 0;
  const feesFirstYear = monthlyFee * 12;
  if (feesFirstYear > 0) add("Fees, first 12 months", -feesFirstYear, false);

  const net = cents(rewardNet - feesFirstYear);

  // 6. Value per month of commitment.
  const commitment = offer.commitment_months;
  let perMonth: number | null = null;
  if (commitment !== null && commitment > 0) {
    const feesOverCommitment = monthlyFee * Math.max(commitment, 12);
    perMonth = cents((rewardNet - feesOverCommitment) / commitment);
  }

  // 7. Flags.
  if (offer.penalty) flags.push(`penalty: ${offer.penalty}`);
  if (offer.paid_placement) flags.push("paid placement");
  if (
    profile.monthly_income_eur === undefined &&
    offer.requirements.min_monthly_income_eur !== null &&
    offer.requirements.min_monthly_income_eur > 0
  ) {
    flags.push(`needs income of at least ${eur(offer.requirements.min_monthly_income_eur)} a month`);
  }

  return {
    net_value_eur: net,
    value_per_month_eur: perMonth,
    breakdown,
    flags,
    stale: isStale(offer, today),
    hidden: isHidden(offer, today),
  };
}
