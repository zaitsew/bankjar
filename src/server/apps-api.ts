import { z } from "zod";
import type { BankApp } from "../core/app-schema";
import { SCORED_FEATURES, rankApps, scoreApp, type AppScore, type RankedApp, type ScoredFeature } from "../core/app-score";
import { DISCLAIMER, LICENSE, todayIso } from "./api";
import { allApps } from "./apps";

/**
 * The bank-app part of the agent surface: one stable JSON row per app, the
 * response envelope and the service functions that the REST routes and the MCP
 * tool both call. Every number comes from src/core/app-score.ts and the data files.
 */

export interface AppStoreRow {
  rating: number | null;
  ratings_count: number;
  updated_on: string | null;
  url: string;
}

export interface AppRow {
  /** Place in the ranking; null for a hidden app (verified 60+ days ago), which is in no ranking. */
  rank: number | null;
  id: string;
  bank: string;
  bank_slug: string;
  app_name: string;
  /** 0 to 100. */
  score: number;
  adjusted_rating: number;
  pooled_rating: number | null;
  total_ratings: number;
  ios: AppStoreRow | null;
  android: AppStoreRow | null;
  /** true, false or null (unknown). */
  features: Record<ScoredFeature, boolean | null>;
  /** The page that shows each hand-filled feature; null while the feature is unknown. */
  feature_sources: { bizum: string | null; apple_pay: string | null; google_pay: string | null };
  breakdown: AppScore["breakdown"];
  flags: string[];
  stale: boolean;
  verified_on: string;
  source_urls: string[];
}

export interface AppsDataset {
  latest_verified_on: string | null;
  count: number;
  version: string;
}

export interface AppsEnvelope {
  dataset: AppsDataset;
  disclaimer: string;
  license: string;
}

export function appsDatasetVersion(apps: readonly BankApp[] = allApps()): AppsDataset {
  const latest = apps.reduce<string | null>((m, a) => (m === null || a.verified_on > m ? a.verified_on : m), null);
  return { latest_verified_on: latest, count: apps.length, version: `${latest ?? "empty"}+${apps.length}` };
}

export function appsEnvelope(): AppsEnvelope {
  return { dataset: appsDatasetVersion(), disclaimer: DISCLAIMER, license: LICENSE };
}

function storeRow(s: NonNullable<BankApp["ios"]> | NonNullable<BankApp["android"]> | null): AppStoreRow | null {
  return s === null ? null : { rating: s.rating, ratings_count: s.ratings_count, updated_on: s.updated_on, url: s.url };
}

export function appRow(app: BankApp, score: AppScore, rank: number | null): AppRow {
  return {
    rank,
    id: app.id,
    bank: app.bank,
    bank_slug: app.bank_slug,
    app_name: app.app_name,
    score: score.score,
    adjusted_rating: score.adjusted_rating,
    pooled_rating: score.pooled_rating,
    total_ratings: score.total_ratings,
    ios: storeRow(app.ios),
    android: storeRow(app.android),
    features: score.features,
    feature_sources: {
      bizum: app.features.bizum.source_url,
      apple_pay: app.features.apple_pay.source_url,
      google_pay: app.features.google_pay.source_url,
    },
    breakdown: score.breakdown,
    flags: score.flags,
    stale: score.stale,
    verified_on: app.verified_on,
    source_urls: [app.ios?.url, app.android?.url].filter((u): u is string => typeof u === "string"),
  };
}

function rankedAppRows(ranked: readonly RankedApp[]): AppRow[] {
  return ranked.map((r) => appRow(r.app, r.score, r.rank));
}

// --- Query parameters ------------------------------------------------------------

export const AppsQuerySchema = z.object({
  limit: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z
      .string()
      .regex(/^\d+$/, "limit must be a whole number from 1 to 50")
      .transform(Number)
      .pipe(z.number().int().min(1, "limit must be at least 1").max(50, "limit must be at most 50"))
      .optional(),
  ),
});

// --- Services (shared by REST and MCP) ----------------------------------------------

export interface AppsBody extends AppsEnvelope {
  /** Rows returned. */
  count: number;
  /** Ranked apps before `limit` was applied. */
  total_apps: number;
  apps: AppRow[];
}

/** The ranking, best first. Hidden apps are left out. */
export function appsBody(opts: { limit?: number | undefined } = {}): AppsBody {
  const ranked = rankApps(allApps(), todayIso());
  const rows = rankedAppRows(opts.limit === undefined ? ranked : ranked.slice(0, opts.limit));
  return { count: rows.length, total_apps: ranked.length, apps: rows, ...appsEnvelope() };
}

export interface AppBody extends AppsEnvelope {
  app: AppRow;
  /** Every field of the data file, including notes. */
  full_app: BankApp;
  /** True when the store numbers are 60+ days old: the app is in no ranking and has no rank. */
  hidden: boolean;
}

export function appBody(id: string): AppBody | null {
  const apps = allApps();
  const app = apps.find((a) => a.id === id);
  if (!app) return null;
  const today = todayIso();
  const score = scoreApp(app, today);
  const rank = rankApps(apps, today).find((r) => r.app.id === id)?.rank ?? null;
  return { app: appRow(app, score, rank), full_app: app, hidden: score.hidden, ...appsEnvelope() };
}

// --- Plain text (llms-full.txt and MCP summaries) -------------------------------------

const FEATURE_NAMES: Record<ScoredFeature, string> = { bizum: "Bizum", apple_pay: "Apple Pay", google_pay: "Google Pay", english: "English" };

function mark(v: boolean | null): string {
  return v === null ? "?" : v ? "yes" : "no";
}

function storeText(label: string, s: AppStoreRow | null): string {
  if (!s) return `${label} none`;
  return `${label} ${s.rating === null ? "no rating" : s.rating.toFixed(2)} (${s.ratings_count.toLocaleString("en")} ratings, release ${s.updated_on ?? "unknown"})`;
}

/** One line per app: "1. BBVA - BBVA España | score 87.3/100 | App Store 4.76 (...) | Google Play ... | Bizum ?, ... | verified 2026-10-22 | https://..." */
export function appLine(row: AppRow, rank?: number | null): string {
  const n = rank === undefined ? row.rank : rank;
  const prefix = n === null || n === undefined ? "-" : `${n}.`;
  const features = SCORED_FEATURES.map((f) => `${FEATURE_NAMES[f]} ${mark(row.features[f])}`).join(", ");
  const stale = row.stale ? " (STALE: re-check)" : "";
  return `${prefix} ${row.bank} - ${row.app_name} | score ${row.score}/100 | ${storeText("App Store", row.ios)} | ${storeText("Google Play", row.android)} | ${features} | verified ${row.verified_on}${stale} | ${row.source_urls.join(" ")}`;
}
