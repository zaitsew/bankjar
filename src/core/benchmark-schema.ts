import { z } from "zod";
import { daysBetween, type DateInput } from "./score";
import { isoDate, kebab } from "./schema";

/**
 * The shape of one benchmark file: data/benchmarks/<country>/<id>.yaml.
 *
 * A benchmark is an official reference number (a central-bank rate, inflation,
 * a Treasury yield) shown next to the offers as context. It never enters the
 * euro ranking or any score. Values are written by scripts/fetch-benchmarks.ts
 * from the publisher's own API; no language model writes a number here.
 */

export const BENCHMARK_KINDS = ["policy_rate", "overnight_rate", "avg_deposit_rate", "cpi_yoy", "treasury_yield"] as const;
export type BenchmarkKind = (typeof BENCHMARK_KINDS)[number];

/** What the number describes: a month (YYYY-MM) or a day (YYYY-MM-DD). */
export const period = z.string().refine((s) => {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return true;
  return isoDate.safeParse(s).success;
}, "must be YYYY-MM or a real YYYY-MM-DD date");

const number = z.number().finite();

export const SanitySchema = z
  .object({ min: number, max: number })
  .refine((s) => s.min < s.max, "sanity.min must be below sanity.max");

export const BenchmarkSchema = z
  .object({
    id: kebab,
    country: z.string().regex(/^[A-Z]{2}$/, "must be an ISO 3166-1 alpha-2 code, upper case"),
    label: z.string().min(1),
    kind: z.enum(BENCHMARK_KINDS),
    value: number,
    unit: z.literal("percent"),
    /** What the value describes. */
    period,
    /** Day the publisher released the number, when the API says so. */
    published_on: isoDate.nullable(),
    /** Day our script read it. */
    fetched_on: isoDate,
    source_name: z.string().min(1),
    /** The human page for this series. */
    source_url: z.url(),
    /** The exact URL the script fetched. */
    api_url: z.url(),
    /** The publisher's series code. Frozen: changing it is a new benchmark. */
    series_code: z.string().min(1),
    /** One sentence: what exactly the number is. */
    method: z.string().min(1),
    /** A fetched value outside this range is refused and the old file stays. */
    sanity: SanitySchema,
    stale_after_days: z.number().int().positive(),
  })
  .refine((b) => b.value >= b.sanity.min && b.value <= b.sanity.max, {
    message: "value is outside the sanity range",
    path: ["value"],
  });

export type Benchmark = z.infer<typeof BenchmarkSchema>;

/** Stale when it was fetched more than stale_after_days before `today`. */
export function isBenchmarkStale(b: Pick<Benchmark, "fetched_on" | "stale_after_days">, today: DateInput): boolean {
  return daysBetween(b.fetched_on, today) > b.stale_after_days;
}
