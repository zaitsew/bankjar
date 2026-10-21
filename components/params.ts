import type { ProfileInput } from "../src/core/profile";
import { GoalSchema } from "../src/core/schema";

export type SearchParams = Record<string, string | string[] | undefined>;

export function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined ? undefined : s;
}

function num(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === "") return undefined;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

const RESIDENCY = ["resident", "nie_tie", "non_resident"] as const;

/**
 * Filters from the URL. They win over what the rule parser reads from `q`.
 * Blank or invalid values are ignored, so a half-filled form never breaks the page.
 */
export function overridesFrom(sp: SearchParams): Partial<ProfileInput> {
  const out: Partial<ProfileInput> = {};
  const goal = GoalSchema.safeParse(first(sp.goal));
  if (goal.success) out.goal = goal.data;

  const income = num(first(sp.income));
  if (income !== undefined) out.monthly_income_eur = income;

  const commit = num(first(sp.max_commitment));
  if (commit !== undefined) out.max_commitment_months = Math.round(commit);

  const res = first(sp.residency);
  if (res && (RESIDENCY as readonly string[]).includes(res)) out.residency = res as (typeof RESIDENCY)[number];

  let gift = num(first(sp.gift_factor));
  if (gift !== undefined) {
    if (gift > 1 && gift <= 100) gift /= 100; // "80" means 80%
    if (gift <= 1) out.gift_factor = gift;
  }

  const balance = num(first(sp.balance));
  if (balance !== undefined) out.balance_eur = balance;

  if (first(sp.prefer) === "cash") out.prefer = "cash";
  return out;
}

/** `ids=a,b` and `ids=a&ids=b` both work. At most 3, deduplicated. */
export function idsFrom(v: string | string[] | undefined): string[] {
  const raw = Array.isArray(v) ? v : v === undefined ? [] : [v];
  const ids = raw.flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean);
  return [...new Set(ids)].slice(0, 3);
}
