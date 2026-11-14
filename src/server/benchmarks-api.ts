import { z } from "zod";
import { BENCHMARK_KINDS, type Benchmark, type BenchmarkKind } from "../core/benchmark-schema";
import { LICENSE, todayIso } from "./api";
import { allBenchmarks, withStaleFlag } from "./benchmarks";

/**
 * The benchmark part of the agent surface and the website: one JSON row per
 * benchmark, the response envelope, the plain-text lines for MCP and llms.txt,
 * and the two derived facts the pages show (the market strip and "vs BdE").
 *
 * Benchmarks are context only. Nothing here is read by src/core/score.ts or
 * src/core/rank.ts, and tests/benchmark-surfaces.test.ts proves the order does not move.
 */

export const BENCHMARKS_DISCLAIMER =
  "Reference numbers from official publishers, shown as context only: no score or order depends on them. Not financial advice.";

export type BenchmarkRow = Benchmark & { stale: boolean };

export interface BenchmarksDataset {
  latest_fetched_on: string | null;
  count: number;
  version: string;
}

export interface BenchmarksEnvelope {
  dataset: BenchmarksDataset;
  disclaimer: string;
  license: string;
}

export function benchmarksDataset(items: readonly Benchmark[] = allBenchmarks()): BenchmarksDataset {
  const latest = items.reduce<string | null>((m, b) => (m === null || b.fetched_on > m ? b.fetched_on : m), null);
  return { latest_fetched_on: latest, count: items.length, version: `${latest ?? "empty"}+${items.length}` };
}

export function benchmarksEnvelope(): BenchmarksEnvelope {
  return { dataset: benchmarksDataset(), disclaimer: BENCHMARKS_DISCLAIMER, license: LICENSE };
}

export const BenchmarksQuerySchema = z.object({
  kind: z.preprocess((v) => (v === "" ? undefined : v), z.enum(BENCHMARK_KINDS).optional()),
});

// --- Services (shared by REST, MCP and the pages) -----------------------------------

export interface BenchmarksBody extends BenchmarksEnvelope {
  count: number;
  benchmarks: BenchmarkRow[];
}

export function benchmarkRows(opts: { kind?: BenchmarkKind | undefined; today?: string } = {}): BenchmarkRow[] {
  const today = opts.today ?? todayIso();
  return allBenchmarks()
    .filter((b) => opts.kind === undefined || b.kind === opts.kind)
    .map((b) => withStaleFlag(b, today));
}

export function benchmarksBody(opts: { kind?: BenchmarkKind | undefined } = {}): BenchmarksBody {
  const rows = benchmarkRows(opts);
  return { count: rows.length, benchmarks: rows, ...benchmarksEnvelope() };
}

export interface BenchmarkBody extends BenchmarksEnvelope {
  benchmark: BenchmarkRow;
}

export function benchmarkBody(id: string): BenchmarkBody | null {
  const b = allBenchmarks().find((x) => x.id === id);
  return b ? { benchmark: withStaleFlag(b, todayIso()), ...benchmarksEnvelope() } : null;
}

// --- Derived facts for the pages -------------------------------------------------------

/** The four numbers on the savings and deposit leaderboards, in this order. */
export const MARKET_STRIP_IDS = [
  "bde-new-deposits-households-up-to-1y",
  "ecb-deposit-facility-rate",
  "es-letra-12m-average-yield",
  "ine-cpi-yoy",
] as const;

/** The strip's rows that exist in the data, in strip order. Missing ones are left out, never invented. */
export function marketStrip(today: string = todayIso()): BenchmarkRow[] {
  const all = allBenchmarks();
  return MARKET_STRIP_IDS.flatMap((id) => {
    const b = all.find((x) => x.id === id);
    return b ? [withStaleFlag(b, today)] : [];
  });
}

/** The goals that show market context. */
export function showsMarketContext(goal: string): boolean {
  return goal === "savings" || goal === "deposit";
}

export const BDE_AVERAGE_ID = "bde-new-deposits-households-up-to-1y";

export interface VsBde {
  bde: BenchmarkRow;
  /** Offer rate minus BdE average, in percentage points, two decimals. */
  difference_points: number;
}

/** The offer's advertised TAE minus the BdE average for deposits up to 1 year; null without either number. */
export function vsBdeAverage(rateTae: number | null, today: string = todayIso()): VsBde | null {
  if (rateTae === null) return null;
  const b = allBenchmarks().find((x) => x.id === BDE_AVERAGE_ID);
  if (!b) return null;
  return { bde: withStaleFlag(b, today), difference_points: Math.round((rateTae - b.value) * 100) / 100 };
}

// --- Plain text (MCP summaries and llms-full.txt) ------------------------------------------

function pct(n: number): string {
  return `${Number(n.toFixed(3))} %`;
}

/** "BdE ...: 2.29 % (period 2026-09). Source: Banco de España ..., https://... Fetched 2026-11-14." Facts only. */
export function benchmarkLine(b: BenchmarkRow): string {
  const stale = b.stale ? ` (stale: fetched more than ${b.stale_after_days} days ago, the number may have changed)` : "";
  return `${b.label}: ${pct(b.value)} (period ${b.period}). Source: ${b.source_name}, ${b.source_url}. Fetched ${b.fetched_on}${stale}.`;
}

export function benchmarksTable(): string {
  return benchmarkRows().map((b) => `- ${benchmarkLine(b)}`).join("\n");
}
