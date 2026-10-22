import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { OfferSchema, type Offer } from "../core/schema";

/**
 * Loads every data/offers/<country>/<id>.yaml, validates it with the schema and
 * caches the result. A bad file throws a DataError that names the file and the
 * field, so a broken contribution fails the build with a readable message.
 */

export class DataError extends Error {
  constructor(
    public readonly file: string,
    public readonly problems: string[],
  ) {
    super(`Invalid offer file ${file}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "DataError";
  }
}

export function defaultOffersDir(): string {
  return process.env.BANKJAR_OFFERS_DIR ?? path.join(process.cwd(), "data", "offers");
}

export function listYaml(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listYaml(full));
    else if (/\.ya?ml$/i.test(entry.name)) out.push(full);
  }
  return out.sort();
}

function loadFile(file: string, root: string): Offer {
  const rel = path.relative(root, file);
  let raw: unknown;
  try {
    raw = parseYaml(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new DataError(rel, [`YAML syntax error: ${(e as Error).message}`]);
  }
  const parsed = OfferSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DataError(
      rel,
      parsed.error.issues.map((i) => `${i.path.length ? i.path.join(".") : "(file)"}: ${i.message}`),
    );
  }
  const offer = parsed.data;
  const problems: string[] = [];
  const base = path.basename(file).replace(/\.ya?ml$/i, "");
  if (offer.id !== base) problems.push(`id: "${offer.id}" must equal the file name "${base}"`);
  const dirName = path.basename(path.dirname(file));
  if (dirName !== offer.country.toLowerCase()) {
    problems.push(`country: "${offer.country}" does not match the folder "${dirName}"`);
  }
  if (problems.length > 0) throw new DataError(rel, problems);
  return offer;
}

/** Load and validate all offers under `dir`. No cache. An empty or missing folder gives []. */
export function loadOffers(dir: string = defaultOffersDir()): Offer[] {
  const offers = listYaml(dir).map((f) => loadFile(f, dir));
  const seen = new Map<string, string>();
  for (const o of offers) {
    if (seen.has(o.id)) throw new DataError(o.id, [`id: duplicate of ${seen.get(o.id)}`]);
    seen.set(o.id, o.id);
  }
  return offers.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

let cache: { dir: string; offers: Offer[] } | null = null;

/** Every offer in the default data folder, loaded once per process. */
export function allOffers(): Offer[] {
  const dir = defaultOffersDir();
  if (!cache || cache.dir !== dir) cache = { dir, offers: loadOffers(dir) };
  return cache.offers;
}

export function clearOfferCache(): void {
  cache = null;
}

export interface DatasetVersion {
  /** Newest verified_on in the data, or null when empty. */
  latest_verified_on: string | null;
  count: number;
  /** "2026-10-21+12": changes whenever an offer is added or re-verified. */
  version: string;
}

export function datasetVersion(offers: readonly Offer[] = allOffers()): DatasetVersion {
  const latest = offers.reduce<string | null>((m, o) => (m === null || o.verified_on > m ? o.verified_on : m), null);
  return { latest_verified_on: latest, count: offers.length, version: `${latest ?? "empty"}+${offers.length}` };
}
