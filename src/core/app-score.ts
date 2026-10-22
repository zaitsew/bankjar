/**
 * App scoring rules. Pure functions, no I/O. The same rules are written in plain
 * English in docs/METHODOLOGY.md ("Bank apps"); change both together.
 *
 * Every app gets a score from 0 to 100, the sum of four parts:
 *
 *  1. Rating, 60 points. Both stores' ratings are pooled, weighted by their
 *     rating counts, then shrunk towards 3.0 stars as if the app had 200 more
 *     ratings of 3.0 (a Bayesian average: a 5.0 from 40 people is not proof).
 *     3.0 stars or less scores 0, 5.0 scores 60, linear between.
 *  2. Freshness, 15 points. Per store: a release in the last 30 days scores
 *     full, 180 days or more scores 0, linear between. The stores are averaged;
 *     a store with no release date scores 0.
 *  3. Reach, 10 points. 5 for being on both the App Store and Google Play;
 *     up to 5 for the total rating count on a log scale (100 ratings 0,
 *     100,000 or more 5).
 *  4. Features, 15 points. 3.75 each for Bizum, Apple Pay, Google Pay and an
 *     English interface (from the App Store's language list). An unknown
 *     feature scores 0 and shows as a flag.
 *
 *  stale  = verified_on is more than 30 days before today.
 *  hidden = verified_on is more than 60 days before today. Hidden apps never
 *           reach the ranking.
 *
 * Order: score, then total ratings, then bank name. Nothing else; no paid
 * placement exists for apps.
 */

import type { AppFeature, BankApp } from "./app-schema";
import { daysBetween, HIDDEN_AFTER_DAYS, STALE_AFTER_DAYS, type DateInput } from "./score";

export const RATING_POINTS = 60;
export const FRESHNESS_POINTS = 15;
export const REACH_POINTS = 10;
export const FEATURE_POINTS = 15;

export const PRIOR_STARS = 3.0;
export const PRIOR_RATINGS = 200;
export const FRESH_DAYS = 30;
export const OLD_DAYS = 180;

export const SCORED_FEATURES = ["bizum", "apple_pay", "google_pay", "english"] as const;
export type ScoredFeature = (typeof SCORED_FEATURES)[number];

export const FEATURE_LABELS: Record<ScoredFeature, string> = {
  bizum: "Bizum",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  english: "English interface",
};

export interface AppScoreLine {
  label: string;
  points: number;
  max: number;
}

export interface AppScore {
  score: number;
  /** Pooled store rating before the Bayesian shrink; null when no store has one. */
  pooled_rating: number | null;
  /** The rating the score uses, after the shrink. */
  adjusted_rating: number;
  total_ratings: number;
  features: Record<ScoredFeature, boolean | null>;
  breakdown: AppScoreLine[];
  flags: string[];
  stale: boolean;
  hidden: boolean;
}

const tenth = (n: number): number => {
  const r = Math.round((n + Number.EPSILON) * 10) / 10;
  return r === 0 ? 0 : r;
};
const hundredth = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

function stores(app: BankApp) {
  return [app.ios, app.android].filter((s) => s !== null);
}

export function appFeatures(app: BankApp): Record<ScoredFeature, boolean | null> {
  const fromFile = (f: AppFeature) => app.features[f].value;
  return {
    bizum: fromFile("bizum"),
    apple_pay: fromFile("apple_pay"),
    google_pay: fromFile("google_pay"),
    english: app.ios ? app.ios.languages.includes("EN") : null,
  };
}

/** Days from `updated_on` to today mapped to 0..1: 30 days or less is 1, 180 or more is 0. */
export function freshness(updatedOn: string | null, today: DateInput): number {
  if (updatedOn === null) return 0;
  const days = daysBetween(updatedOn, today);
  if (days <= FRESH_DAYS) return 1;
  return clamp01((OLD_DAYS - days) / (OLD_DAYS - FRESH_DAYS));
}

export function isAppStale(app: BankApp, today: DateInput): boolean {
  return daysBetween(app.verified_on, today) > STALE_AFTER_DAYS;
}

export function isAppHidden(app: BankApp, today: DateInput): boolean {
  return daysBetween(app.verified_on, today) > HIDDEN_AFTER_DAYS;
}

export function scoreApp(app: BankApp, today: DateInput): AppScore {
  const flags: string[] = [];
  const rated = stores(app).filter((s) => s.rating !== null && s.ratings_count > 0);
  const total = stores(app).reduce((n, s) => n + s.ratings_count, 0);
  const ratedCount = rated.reduce((n, s) => n + s.ratings_count, 0);
  const starSum = rated.reduce((n, s) => n + (s.rating as number) * s.ratings_count, 0);
  const pooled = ratedCount > 0 ? starSum / ratedCount : null;
  const adjusted = (starSum + PRIOR_STARS * PRIOR_RATINGS) / (ratedCount + PRIOR_RATINGS);
  const ratingPts = RATING_POINTS * clamp01((adjusted - PRIOR_STARS) / (5 - PRIOR_STARS));
  if (ratedCount < 1000) flags.push(`few ratings (${ratedCount}): rating pulled towards 3.0`);

  const present = stores(app);
  const fresh = present.reduce((n, s) => n + freshness(s.updated_on, today), 0) / present.length;
  const freshPts = FRESHNESS_POINTS * fresh;
  for (const [name, s] of [["App Store", app.ios], ["Google Play", app.android]] as const) {
    if (s && s.updated_on && daysBetween(s.updated_on, today) > OLD_DAYS) flags.push(`no ${name} release in ${OLD_DAYS}+ days`);
  }

  const both = app.ios !== null && app.android !== null;
  if (!both) flags.push(app.ios ? "not on Google Play" : "not on the App Store");
  const volume = total > 0 ? clamp01((Math.log10(total) - 2) / 3) : 0;
  const reachPts = (both ? REACH_POINTS / 2 : 0) + (REACH_POINTS / 2) * volume;

  const features = appFeatures(app);
  const per = FEATURE_POINTS / SCORED_FEATURES.length;
  const featurePts = SCORED_FEATURES.reduce((n, f) => n + (features[f] === true ? per : 0), 0);
  const unknown = SCORED_FEATURES.filter((f) => features[f] === null).map((f) => FEATURE_LABELS[f]);
  if (unknown.length) flags.push(`unknown: ${unknown.join(", ")}`);

  const breakdown: AppScoreLine[] = [
    { label: `Rating ${hundredth(adjusted)} stars after adjustment`, points: tenth(ratingPts), max: RATING_POINTS },
    { label: "Freshness of the latest release", points: tenth(freshPts), max: FRESHNESS_POINTS },
    { label: `${both ? "Both stores" : "One store"}, ${total.toLocaleString("en")} ratings`, points: tenth(reachPts), max: REACH_POINTS },
    {
      label: `Features: ${SCORED_FEATURES.filter((f) => features[f] === true).map((f) => FEATURE_LABELS[f]).join(", ") || "none confirmed"}`,
      points: tenth(featurePts),
      max: FEATURE_POINTS,
    },
  ];

  const stale = isAppStale(app, today);
  if (stale) flags.push("store numbers older than 30 days");

  return {
    score: tenth(ratingPts + freshPts + reachPts + featurePts),
    pooled_rating: pooled === null ? null : hundredth(pooled),
    adjusted_rating: hundredth(adjusted),
    total_ratings: total,
    features,
    breakdown,
    flags,
    stale,
    hidden: isAppHidden(app, today),
  };
}

export interface RankedApp {
  rank: number;
  app: BankApp;
  score: AppScore;
}

/** Score every app, drop hidden ones, order by score, then total ratings, then bank name. */
export function rankApps(apps: readonly BankApp[], today: DateInput): RankedApp[] {
  return apps
    .map((app) => ({ app, score: scoreApp(app, today) }))
    .filter((r) => !r.score.hidden)
    .sort(
      (a, b) =>
        b.score.score - a.score.score ||
        b.score.total_ratings - a.score.total_ratings ||
        a.app.bank.localeCompare(b.app.bank, "en"),
    )
    .map((r, i) => ({ rank: i + 1, ...r }));
}
