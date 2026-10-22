import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { AppSchema, type BankApp } from "../core/app-schema";
import { DataError, listYaml } from "./data";

/**
 * Loads every data/apps/<country>/<bank_slug>.yaml, validates it and caches the
 * result, the same way data.ts loads offers.
 */

export function defaultAppsDir(): string {
  return process.env.BANKJAR_APPS_DIR ?? path.join(process.cwd(), "data", "apps");
}

function loadFile(file: string, root: string): BankApp {
  const rel = path.relative(root, file);
  let raw: unknown;
  try {
    raw = parseYaml(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new DataError(rel, [`YAML syntax error: ${(e as Error).message}`]);
  }
  const parsed = AppSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DataError(
      rel,
      parsed.error.issues.map((i) => `${i.path.length ? i.path.join(".") : "(file)"}: ${i.message}`),
    );
  }
  const app = parsed.data;
  const problems: string[] = [];
  const base = path.basename(file).replace(/\.ya?ml$/i, "");
  if (app.id !== base) problems.push(`id: "${app.id}" must equal the file name "${base}"`);
  const dirName = path.basename(path.dirname(file));
  if (dirName !== app.country.toLowerCase()) {
    problems.push(`country: "${app.country}" does not match the folder "${dirName}"`);
  }
  if (problems.length > 0) throw new DataError(rel, problems);
  return app;
}

/** Load and validate all bank apps under `dir`. No cache. An empty or missing folder gives []. */
export function loadApps(dir: string = defaultAppsDir()): BankApp[] {
  const apps = listYaml(dir).map((f) => loadFile(f, dir));
  const seen = new Set<string>();
  for (const a of apps) {
    if (seen.has(a.id)) throw new DataError(a.id, ["id: duplicate"]);
    seen.add(a.id);
  }
  return apps.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

let cache: { dir: string; apps: BankApp[] } | null = null;

/** Every bank app in the default data folder, loaded once per process. */
export function allApps(): BankApp[] {
  const dir = defaultAppsDir();
  if (!cache || cache.dir !== dir) cache = { dir, apps: loadApps(dir) };
  return cache.apps;
}

export function clearAppCache(): void {
  cache = null;
}
