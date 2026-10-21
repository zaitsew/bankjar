import { z } from "zod";
import type { Profile, ProfileInput } from "../core/profile";
import { makeProfile } from "../core/profile";
import { compareOffers, rankOffers, type ExcludedOffer, type RankedOffer } from "../core/rank";
import { GOALS, GoalSchema, type Goal, type Offer } from "../core/schema";
import { scoreOffer, type Score } from "../core/score";
import { allOffers, datasetVersion, type DatasetVersion } from "./data";
import { search } from "./search";

/**
 * The agent surface: one stable JSON shape for an offer row, the response
 * envelope, query-parameter validation and the service functions that the REST
 * routes and the MCP tools both call. Nothing here writes a number: every figure
 * comes from the engine in src/core.
 */

export const DISCLAIMER = "Not financial advice. Terms change; check source_url before signing.";
export const LICENSE = "Data CC BY 4.0, attribution: BankJar (github.com/zaitsew/bankjar)";
export const REPO_URL = "https://github.com/zaitsew/bankjar";
export const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";
export const DEFAULT_COUNTRY = "ES";

// --- Site URL and clock ---------------------------------------------------------

/** Absolute origin of this deployment, without a trailing slash. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

/** Today as YYYY-MM-DD. `BANKJAR_TODAY` pins it for tests and reproducible smoke runs. */
export function todayIso(): string {
  const pinned = process.env.BANKJAR_TODAY?.trim();
  if (pinned && /^\d{4}-\d{2}-\d{2}$/.test(pinned)) return pinned;
  return new Date().toISOString().slice(0, 10);
}

export function offerUrl(id: string): string {
  return `${siteUrl()}/offer/${id}`;
}

// --- Row shape -------------------------------------------------------------------

export interface OfferRow {
  id: string;
  bank: string;
  bank_slug: string;
  country: string;
  goal: Goal;
  product_name: string;
  headline: string;
  reward: Offer["reward"];
  rate_tae: number | null;
  commitment_months: number | null;
  requirements: Offer["requirements"];
  fees: Offer["fees"];
  penalty: string | null;
  eligibility: Offer["eligibility"];
  valid_until: string | null;
  source_url: string;
  verified_on: string;
  stale: boolean;
  score: {
    net_value_eur: number;
    value_per_month_eur: number | null;
    breakdown: Score["breakdown"];
    flags: string[];
  };
  url: string;
}

export function offerRow(offer: Offer, score: Score): OfferRow {
  return {
    id: offer.id,
    bank: offer.bank,
    bank_slug: offer.bank_slug,
    country: offer.country,
    goal: offer.goal,
    product_name: offer.product_name,
    headline: offer.headline,
    reward: offer.reward,
    rate_tae: offer.rate_tae,
    commitment_months: offer.commitment_months,
    requirements: offer.requirements,
    fees: offer.fees,
    penalty: offer.penalty,
    eligibility: offer.eligibility,
    valid_until: offer.valid_until,
    source_url: offer.source_url,
    verified_on: offer.verified_on,
    stale: score.stale,
    score: {
      net_value_eur: score.net_value_eur,
      value_per_month_eur: score.value_per_month_eur,
      breakdown: score.breakdown,
      flags: score.flags,
    },
    url: offerUrl(offer.id),
  };
}

export interface Envelope {
  dataset: DatasetVersion;
  disclaimer: string;
  license: string;
}

export function envelope(): Envelope {
  return { dataset: datasetVersion(allOffers()), disclaimer: DISCLAIMER, license: LICENSE };
}

export interface ExcludedRow {
  id: string;
  bank: string;
  reasons: string[];
}

function excludedRows(excluded: readonly ExcludedOffer[]): ExcludedRow[] {
  return excluded.map((e) => ({ id: e.offer.id, bank: e.offer.bank, reasons: e.reasons }));
}

function rankedRows(ranked: readonly RankedOffer[]): OfferRow[] {
  return ranked.map((r) => offerRow(r.offer, r.score));
}

// --- Goals -----------------------------------------------------------------------

export interface GoalInfo {
  id: Goal;
  label: string;
  description: string;
  example_prompt: string;
}

export const GOAL_INFO: readonly GoalInfo[] = [
  {
    id: "salary",
    label: "Move my salary",
    description: "Bonuses and gifts paid for moving your payroll to a bank, usually with a minimum monthly income.",
    example_prompt: "I earn 2,500 a month, which bank pays the most for my salary?",
  },
  {
    id: "savings",
    label: "Park my savings",
    description: "Savings accounts with a promotional rate, no fixed term. Interest counts on the balance you give.",
    example_prompt: "Best savings account for 15,000 euros with no commitment",
  },
  {
    id: "account",
    label: "Free everyday account",
    description: "Current accounts with no fees or with fees waived, for people and for non-residents.",
    example_prompt: "Free bank account for a non-resident",
  },
  {
    id: "deposit",
    label: "Term deposit",
    description: "Fixed-term deposits: your money stays put for the term and earns the quoted rate.",
    example_prompt: "Best 12-month deposit for 20,000 euros",
  },
  {
    id: "welcome",
    label: "Welcome bonus",
    description: "Sign-up bonuses for new customers that do not depend on moving a payroll.",
    example_prompt: "Welcome bonus without payroll",
  },
];

export function goalsBody(): Envelope & { goals: readonly GoalInfo[] } {
  return { goals: GOAL_INFO, ...envelope() };
}

// --- Query parameters ------------------------------------------------------------

export interface ParamDoc {
  name: string;
  description: string;
  example: string;
}

/** Documented names (the OpenAPI spec reads this list) and the aliases they accept. */
export const PROFILE_PARAMS: readonly ParamDoc[] = [
  { name: "goal", description: `One of ${GOALS.join(", ")}. Wins over the goal read from q.`, example: "salary" },
  { name: "income", description: "Net monthly income in EUR. Offers with a higher minimum income are excluded.", example: "2500" },
  { name: "balance", description: "Money you would move or park, in EUR. Drives interest on rate offers. Default 10000.", example: "15000" },
  { name: "max_commitment", description: "Longest commitment you accept, in months. 0 means none.", example: "12" },
  { name: "residency", description: "resident, nie_tie, non_resident or unknown (default).", example: "non_resident" },
  { name: "gift_factor", description: "Share of retail value a gift is worth to you, 0 to 1. Default 0.8.", example: "0.6" },
  { name: "prefer", description: "cash leaves out gift rewards. any (default) keeps them.", example: "cash" },
  { name: "customer_of", description: "Comma-separated bank slugs where you already bank; new-customer-only offers from them are excluded.", example: "bbva,ing" },
];

const ALIASES: Record<string, string> = {
  monthly_income_eur: "income",
  balance_eur: "balance",
  max_commitment_months: "max_commitment",
  existing_customer_of: "customer_of",
};

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

function num(what: string, schema: z.ZodNumber) {
  return z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d+(\.\d+)?$/, `${what} must be a plain non-negative number such as 2500 or 0.8`)
      .transform(Number)
      .pipe(schema)
      .optional(),
  );
}

const enumParam = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(emptyToUndefined, z.enum(values).optional());

const slugList = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .transform((s) => s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean))
    .pipe(z.array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be kebab-case bank slugs")).max(20))
    .optional(),
);

const profileQueryShape = {
  goal: enumParam(GOALS),
  income: num("income", z.number().max(10_000_000)),
  balance: num("balance", z.number().max(1_000_000_000)),
  max_commitment: num("max_commitment", z.number().int("must be a whole number of months").max(600)),
  residency: enumParam(["resident", "nie_tie", "non_resident", "unknown"]),
  gift_factor: num("gift_factor", z.number().min(0).max(1)),
  prefer: enumParam(["cash", "any"]),
  customer_of: slugList,
};

export const SearchQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().max(500, "must be at most 500 characters").optional()),
  ...profileQueryShape,
});

export const OffersQuerySchema = z.object({
  country: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^[A-Za-z]{2}$/, "must be a two-letter ISO country code such as ES")
      .transform((s) => s.toUpperCase())
      .optional(),
  ),
  ...profileQueryShape,
});

export const OfferQuerySchema = z.object({ ...profileQueryShape });

export const CompareQuerySchema = z.object({
  ids: z
    .string({ error: "ids is required: comma-separated offer ids" })
    .transform((s) => Array.from(new Set(s.split(",").map((x) => x.trim()).filter(Boolean))))
    .pipe(
      z
        .array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be kebab-case offer ids"))
        .min(1, "give at least one id")
        .max(10, "compare at most 10 offers"),
    ),
  ...profileQueryShape,
});

export interface ApiIssue {
  param: string;
  message: string;
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; issues: ApiIssue[] };

/**
 * Validate the query string. Unknown parameters are an error, not ignored: an agent that
 * mistypes `max_commitmnt` must hear about it rather than get an unfiltered table.
 */
export function parseQuery<S extends z.ZodObject>(url: URL, schema: S): ParseResult<z.output<S>> {
  const known = new Set(Object.keys(schema.shape));
  const raw: Record<string, string> = {};
  const issues: ApiIssue[] = [];
  for (const [key, value] of url.searchParams) {
    const name = ALIASES[key] && known.has(ALIASES[key]) ? ALIASES[key] : key;
    if (!known.has(name)) {
      issues.push({ param: key, message: `unknown parameter; accepted: ${[...known].join(", ")}` });
      continue;
    }
    if (name in raw && raw[name] !== value && key !== name) {
      issues.push({ param: key, message: `${name} was given twice with different values` });
      continue;
    }
    raw[name] = value;
  }
  if (issues.length > 0) return { ok: false, issues };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({ param: String(i.path[0] ?? "(query)"), message: i.message })),
    };
  }
  return { ok: true, data: parsed.data };
}

/** The profile fields of a parsed query, under the engine's names. */
export function overridesFromQuery(q: {
  goal?: Goal | undefined;
  income?: number | undefined;
  balance?: number | undefined;
  max_commitment?: number | undefined;
  residency?: ProfileInput["residency"];
  gift_factor?: number | undefined;
  prefer?: "cash" | "any" | undefined;
  customer_of?: string[] | undefined;
}): Partial<ProfileInput> {
  const o: Partial<ProfileInput> = {};
  if (q.goal !== undefined) o.goal = q.goal;
  if (q.income !== undefined) o.monthly_income_eur = q.income;
  if (q.balance !== undefined) o.balance_eur = q.balance;
  if (q.max_commitment !== undefined) o.max_commitment_months = q.max_commitment;
  if (q.residency !== undefined) o.residency = q.residency;
  if (q.gift_factor !== undefined) o.gift_factor = q.gift_factor;
  if (q.prefer !== undefined) o.prefer = q.prefer;
  if (q.customer_of !== undefined) o.existing_customer_of = q.customer_of;
  return o;
}

/** The same fields as the engine's names; the MCP tools take these as JSON. */
export const ProfileToolShape = {
  goal: GoalSchema.optional().describe(`Which kind of offer: ${GOALS.join(", ")}. Leave out to let the query decide.`),
  monthly_income_eur: z.number().nonnegative().max(10_000_000).optional().describe("The person's net monthly income in EUR. Offers needing more are excluded."),
  balance_eur: z.number().nonnegative().max(1_000_000_000).optional().describe("Money to move or park, in EUR. Default 10000. Drives interest on savings and deposits."),
  max_commitment_months: z.number().int().nonnegative().max(600).optional().describe("Longest commitment accepted, in months. 0 means none."),
  residency: z.enum(["resident", "nie_tie", "non_resident", "unknown"]).optional().describe("Residency in Spain. Leave out when unknown; unknown facts are flagged, not excluded."),
  gift_factor: z.number().min(0).max(1).optional().describe("Share of retail value a gift is worth to the person, 0 to 1. Default 0.8."),
  prefer: z.enum(["cash", "any"]).optional().describe("cash leaves out gift rewards. Default any."),
  existing_customer_of: z.array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)).max(20).optional().describe("Bank slugs where the person already banks, e.g. [\"bbva\"]."),
};

// --- Services (shared by REST and MCP) ---------------------------------------------

export interface SearchBody extends Envelope {
  query: string;
  goal: Goal;
  profile: Profile;
  summary: string;
  parser: "rules" | "ai";
  intent: { goal: Goal | null; confidence: number; matched: string[] };
  count: number;
  offers: OfferRow[];
  excluded: ExcludedRow[];
}

export function searchBody(q: string | undefined, overrides: Partial<ProfileInput> = {}): SearchBody {
  const r = search({ q: q ?? "", overrides, today: todayIso() });
  return {
    query: r.query,
    goal: r.goal,
    profile: r.profile,
    summary: r.summary,
    parser: r.parser,
    intent: { goal: r.intent.goal, confidence: r.intent.confidence, matched: r.intent.matched },
    count: r.result.ranked.length,
    offers: rankedRows(r.result.ranked),
    excluded: excludedRows(r.result.excluded),
    ...envelope(),
  };
}

export interface GoalTable {
  count: number;
  offers: OfferRow[];
  excluded: ExcludedRow[];
}

export interface OffersBody extends Envelope {
  country: string;
  goal: Goal | null;
  profile: Profile;
  /** Present when `goal` is set. */
  count?: number;
  offers?: OfferRow[];
  excluded?: ExcludedRow[];
  /** Present when no goal is set: one ranked table per goal. */
  goals?: Record<string, GoalTable>;
}

export function offersBody(opts: { goal?: Goal | undefined; country?: string | undefined; overrides?: Partial<ProfileInput> }): OffersBody {
  const country = opts.country ?? DEFAULT_COUNTRY;
  const today = todayIso();
  const pool = allOffers().filter((o) => o.country === country);
  const base = makeProfile({ ...opts.overrides, goal: undefined });
  if (opts.goal !== undefined) {
    const profile = { ...base, goal: opts.goal };
    const r = rankOffers(pool, profile, today);
    return { country, goal: opts.goal, profile, count: r.ranked.length, offers: rankedRows(r.ranked), excluded: excludedRows(r.excluded), ...envelope() };
  }
  const goals: Record<string, GoalTable> = {};
  for (const goal of GOALS) {
    const r = rankOffers(pool, { ...base, goal }, today);
    goals[goal] = { count: r.ranked.length, offers: rankedRows(r.ranked), excluded: excludedRows(r.excluded) };
  }
  return { country, goal: null, profile: base, goals, ...envelope() };
}

export interface OfferBody extends Envelope {
  offer: OfferRow;
  /** Every field of the data file, including notes and confirmed_by. */
  full_offer: Offer;
  /** True when the offer is expired or unverified for 60+ days: it is in no ranking. */
  hidden: boolean;
  /** Why the given profile cannot take it. Empty when it can, or when no profile was given. */
  not_eligible_reasons: string[];
}

export function offerBody(id: string, overrides: Partial<ProfileInput> = {}): OfferBody | null {
  const offer = allOffers().find((o) => o.id === id);
  if (!offer) return null;
  const today = todayIso();
  const profile = makeProfile({ ...overrides, goal: overrides.goal ?? offer.goal });
  const score = scoreOffer(offer, profile, today);
  const { items } = compareOffers([offer], [id], profile, today);
  return {
    offer: offerRow(offer, score),
    full_offer: offer,
    hidden: score.hidden,
    not_eligible_reasons: items[0]?.reasons ?? [],
    ...envelope(),
  };
}

export interface CompareRow extends OfferRow {
  /** Why the given profile cannot take this offer. Empty when it can. */
  not_eligible_reasons: string[];
}

export interface CompareBody extends Envelope {
  profile: Profile;
  offers: CompareRow[];
  missing: string[];
}

export function compareBody(ids: readonly string[], overrides: Partial<ProfileInput> = {}): CompareBody {
  const profile = makeProfile(overrides);
  const r = compareOffers(allOffers(), ids, profile, todayIso());
  return {
    profile,
    offers: r.items.map((i) => ({ ...offerRow(i.offer, i.score), not_eligible_reasons: i.reasons })),
    missing: r.missing,
    ...envelope(),
  };
}

// --- Plain-text table (llms-full.txt and MCP summaries) -------------------------------

export function eur(n: number | null): string {
  return n === null ? "n/a" : `EUR ${Math.round(n).toLocaleString("en-GB")}`;
}

export function commitmentText(months: number | null): string {
  if (months === null) return "unknown";
  return months === 0 ? "none" : `${months} months`;
}

/** One line per row: "1. Bank - headline | net EUR 648 | commitment 12 months | verified 2026-10-18 | source https://..." */
export function rowLine(row: OfferRow, rank?: number): string {
  const prefix = rank === undefined ? "-" : `${rank}.`;
  const stale = row.stale ? " (STALE: re-check)" : "";
  return `${prefix} ${row.bank} - ${row.headline} | net value ${eur(row.score.net_value_eur)} | commitment ${commitmentText(row.commitment_months)} | verified ${row.verified_on}${stale} | source ${row.source_url}`;
}
