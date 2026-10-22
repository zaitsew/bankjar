import { siteUrl as apiSiteUrl } from "../src/server/api";

export const SITE_NAME = "BankJar";
export const REPO_URL = "https://github.com/zaitsew/bankjar";
export const ISSUES_URL = `${REPO_URL}/issues`;
export const SECURITY_URL = `${REPO_URL}/security/advisories/new`;
/** Who runs the site. The LICENSE names the copyright holder; the domain is Fabrique Futur's. */
export const OPERATOR = "Ivan Zaitsev (Fabrique Futur)";
/** The day the privacy policy and the terms were last edited. */
export const LEGAL_UPDATED = "23 October 2026";
export const TAGLINE = "Find the bank offer that pays you most";
export const DESCRIPTION =
  "Compare Spanish bank offers by goal: salary bonus, savings, free accounts and deposits. Open data, open ranking, dated sources.";

/** Public origin for metadata, the sitemap and the examples on /agents. */
export function siteUrl(): URL {
  // One origin for the pages and the API: the same helper /api/v1 uses.
  try {
    return new URL(apiSiteUrl());
  } catch {
    return new URL("http://localhost:3000");
  }
}

export function absolute(path: string): string {
  return new URL(path, siteUrl()).toString();
}

/**
 * A public contact address, set at build time (NEXT_PUBLIC_*, like NEXT_PUBLIC_SITE_URL):
 * `NEXT_PUBLIC_CONTACT_EMAIL=name@example.com ./scripts/deploy.sh`. Null until the owner sets
 * it; the legal pages then name the GitHub issue tracker as the only channel and say so.
 */
export function contactEmail(): string | null {
  const v = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

export function mcpUrl(): string {
  return absolute("/mcp");
}
