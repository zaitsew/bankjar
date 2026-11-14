import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { BenchmarkSchema, isBenchmarkStale, type Benchmark } from "../core/benchmark-schema";
import type { DateInput } from "../core/score";
import { DataError, listYaml } from "./data";

/**
 * Loads every data/benchmarks/<country>/<id>.yaml, validates it and caches the
 * result, the same way apps.ts loads bank apps.
 */

export function defaultBenchmarksDir(): string {
  return process.env.BANKJAR_BENCHMARKS_DIR ?? path.join(process.cwd(), "data", "benchmarks");
}

function loadFile(file: string, root: string): Benchmark {
  const rel = path.relative(root, file);
  let raw: unknown;
  try {
    raw = parseYaml(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new DataError(rel, [`YAML syntax error: ${(e as Error).message}`]);
  }
  const parsed = BenchmarkSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DataError(
      rel,
      parsed.error.issues.map((i) => `${i.path.length ? i.path.join(".") : "(file)"}: ${i.message}`),
    );
  }
  const b = parsed.data;
  const problems: string[] = [];
  const base = path.basename(file).replace(/\.ya?ml$/i, "");
  if (b.id !== base) problems.push(`id: "${b.id}" must equal the file name "${base}"`);
  const dirName = path.basename(path.dirname(file));
  if (dirName !== b.country.toLowerCase()) problems.push(`country: "${b.country}" does not match the folder "${dirName}"`);
  if (problems.length > 0) throw new DataError(rel, problems);
  return b;
}

/** Load and validate all benchmarks under `dir`. No cache. A missing folder gives []. */
export function loadBenchmarks(dir: string = defaultBenchmarksDir()): Benchmark[] {
  const all = listYaml(dir).map((f) => loadFile(f, dir));
  const seen = new Set<string>();
  for (const b of all) {
    if (seen.has(b.id)) throw new DataError(b.id, ["id: duplicate"]);
    seen.add(b.id);
  }
  return all.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

let cache: { dir: string; items: Benchmark[] } | null = null;

/** Every benchmark in the default data folder, loaded once per process. */
export function allBenchmarks(): Benchmark[] {
  const dir = defaultBenchmarksDir();
  if (!cache || cache.dir !== dir) cache = { dir, items: loadBenchmarks(dir) };
  return cache.items;
}

export function clearBenchmarkCache(): void {
  cache = null;
}

/** A benchmark with its stale flag, computed against `today`. */
export function withStaleFlag(b: Benchmark, today: DateInput): Benchmark & { stale: boolean } {
  return { ...b, stale: isBenchmarkStale(b, today) };
}
