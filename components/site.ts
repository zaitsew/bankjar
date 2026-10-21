import { siteUrl as apiSiteUrl } from "../src/server/api";

export const SITE_NAME = "BankJar";
export const REPO_URL = "https://github.com/zaitsew/bankjar";
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
