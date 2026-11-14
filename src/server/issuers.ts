import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { IssuerSchema, type Issuer, type IssuerGuarantee } from "../core/issuer-schema";
import type { Offer } from "../core/schema";
import { DataError, allOffers, listYaml } from "./data";

/**
 * Loads data/issuers/<country>/<bank_slug>.yaml. Issuer facts are context only:
 * nothing in src/core reads them, so they cannot change a score or an order.
 */

export function defaultIssuersDir(): string {
  return process.env.BANKJAR_ISSUERS_DIR ?? path.join(process.cwd(), "data", "issuers");
}

function loadFile(file: string, root: string): Issuer {
  const rel = path.relative(root, file);
  let raw: unknown;
  try {
    raw = parseYaml(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new DataError(rel, [`YAML syntax error: ${(e as Error).message}`]);
  }
  const parsed = IssuerSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DataError(
      rel,
      parsed.error.issues.map((i) => `${i.path.length ? i.path.join(".") : "(file)"}: ${i.message}`),
    );
  }
  const base = path.basename(file).replace(/\.ya?ml$/i, "");
  if (parsed.data.bank_slug !== base) {
    throw new DataError(rel, [`bank_slug: "${parsed.data.bank_slug}" must equal the file name "${base}"`]);
  }
  return parsed.data;
}

/** Load and validate all issuers under `dir`. A missing folder gives []. */
export function loadIssuers(dir: string = defaultIssuersDir()): Issuer[] {
  const issuers = listYaml(dir).map((f) => loadFile(f, dir));
  const seen = new Set<string>();
  for (const i of issuers) {
    if (seen.has(i.bank_slug)) throw new DataError(i.bank_slug, ["bank_slug: duplicate issuer file"]);
    seen.add(i.bank_slug);
  }
  return issuers.sort((a, b) => (a.bank_slug < b.bank_slug ? -1 : 1));
}

/** Offers whose bank_slug has no issuer file, as sorted unique slugs. */
export function missingIssuers(offers: readonly Offer[], issuers: readonly Issuer[]): string[] {
  const have = new Set(issuers.map((i) => i.bank_slug));
  return [...new Set(offers.map((o) => o.bank_slug).filter((s) => !have.has(s)))].sort();
}

let cache: { dir: string; issuers: Issuer[] } | null = null;

export function allIssuers(): Issuer[] {
  const dir = defaultIssuersDir();
  if (!cache || cache.dir !== dir) cache = { dir, issuers: loadIssuers(dir) };
  return cache.issuers;
}

export function clearIssuerCache(): void {
  cache = null;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * The guarantee facts for a bank slug, or null when no issuer file exists.
 * `shared_cap_with` lists the other banks in the offer dataset whose issuer file names
 * the same legal entity: deposits at both count toward one cap.
 */
export function issuerGuarantee(
  bankSlug: string,
  issuers: readonly Issuer[] = allIssuers(),
  offers: readonly Offer[] = allOffers(),
): IssuerGuarantee | null {
  const issuer = issuers.find((i) => i.bank_slug === bankSlug);
  if (!issuer) return null;
  const bankNames = new Map<string, string>();
  for (const o of offers) if (!bankNames.has(o.bank_slug)) bankNames.set(o.bank_slug, o.bank);
  const shared = issuers
    .filter((i) => i.bank_slug !== bankSlug && norm(i.legal_entity) === norm(issuer.legal_entity) && bankNames.has(i.bank_slug))
    .map((i) => ({ bank_slug: i.bank_slug, bank: bankNames.get(i.bank_slug) as string }));
  return {
    legal_entity: issuer.legal_entity,
    country_of_licence: issuer.country_of_licence,
    scheme_name: issuer.scheme_name,
    scheme_country: issuer.scheme_country,
    cover_eur: issuer.cover_eur,
    cover_basis: issuer.cover_basis,
    brand_aliases: issuer.brand_aliases,
    shared_cap_with: shared,
    source_url: issuer.source_url,
    verified_on: issuer.verified_on,
    notes: issuer.notes,
  };
}

/** One factual sentence for plain-text surfaces (MCP text, llms-full). */
export function guaranteeLine(g: IssuerGuarantee): string {
  const scheme = g.scheme_name ? `${g.scheme_name}${g.scheme_country ? ` (${g.scheme_country})` : ""}` : "scheme not confirmed";
  const cover = `EUR ${Math.round(g.cover_eur).toLocaleString("en-GB")} ${g.cover_basis}`;
  const shared = g.shared_cap_with.length ? `; one cap shared with ${g.shared_cap_with.map((s) => s.bank).join(", ")}` : "";
  return `Deposit guarantee: ${scheme}, ${cover}, deposits held at ${g.legal_entity}${shared}.`;
}
