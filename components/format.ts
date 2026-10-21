import type { Goal, Offer } from "../src/core/schema";
import { daysBetween } from "../src/core/score";

const f0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const f2 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

/** €1,200 for whole numbers, €54.17 otherwise. */
export function eur(n: number): string {
  return Number.isInteger(n) ? f0.format(n) : f2.format(n);
}

/** Always two decimals: €54.00. */
export function eur2(n: number): string {
  return f2.format(n);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 2026-10-20 -> "20 Oct 2026". */
export function dateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1] ?? ""} ${y}`;
}

export function ageLabel(verifiedOn: string, now: string): string {
  const days = daysBetween(verifiedOn, now);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export interface GoalMeta {
  /** Plural noun for lists: "Salary bonuses". */
  name: string;
  /** One word for chips and labels. */
  short: string;
  blurb: string;
}

export const GOAL_META: Record<Goal, GoalMeta> = {
  salary: { name: "Salary bonuses", short: "Salary", blurb: "Banks that pay you to move your payroll." },
  savings: { name: "Savings accounts", short: "Savings", blurb: "Interest on money you park, no lock-in." },
  account: { name: "Free accounts", short: "Free account", blurb: "Everyday accounts with no fees and no conditions." },
  deposit: { name: "Term deposits", short: "Deposit", blurb: "Fixed-term deposit rates." },
  welcome: { name: "Welcome bonuses", short: "Welcome bonus", blurb: "Bonuses that do not need your payroll." },
};

export function commitmentLabel(months: number | null): string {
  if (months === null) return "Unknown";
  if (months === 0) return "None";
  return months === 1 ? "1 month" : `${months} months`;
}

export interface RewardView {
  badge: string;
  /** CSS suffix for the badge colour. */
  kind: Offer["reward"]["type"];
  value: string;
  detail: string | null;
}

export function rewardView(o: Offer): RewardView {
  const r = o.reward;
  const v = r.value_eur;
  switch (r.type) {
    case "cash":
      return { badge: "Cash", kind: "cash", value: v === null ? "Unknown" : eur(v), detail: null };
    case "gift":
      return { badge: "Gift", kind: "gift", value: v === null ? "Unknown" : `${eur(v)} retail`, detail: null };
    case "fee_waiver":
      return { badge: "Fees", kind: "fee_waiver", value: v === null ? "Waived" : `${eur(v)} waived`, detail: null };
    case "rate": {
      const rate = o.rate_tae === null ? "Rate unknown" : `${o.rate_tae}% TAE`;
      const bits: string[] = [];
      if (o.promo_months) bits.push(`${o.promo_months} mo`);
      if (o.balance_cap_eur) bits.push(`first ${eur(o.balance_cap_eur)}`);
      return { badge: "Rate", kind: "rate", value: rate, detail: bits.length ? bits.join(" · ") : null };
    }
    case "none":
      return { badge: "No reward", kind: "none", value: o.rate_tae !== null ? `${o.rate_tae}% TAE` : "None", detail: null };
  }
}

export function requirementLines(o: Offer): string[] {
  const out: string[] = [];
  const min = o.requirements.min_monthly_income_eur;
  if (min !== null && min > 0) out.push(`Income of ${eur(min)}/month or more`);
  if (o.requirements.new_customer_only) out.push("New customers only");
  out.push(...o.requirements.other);
  return out;
}

/** Stable small number for a bank's avatar colour. */
export function avatarIndex(slug: string): number {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 8;
}

export function yesNo(v: boolean | null): string {
  return v === null ? "Unknown" : v ? "Yes" : "No";
}
