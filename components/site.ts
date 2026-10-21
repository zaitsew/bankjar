export const SITE_NAME = "BankJar";
export const REPO_URL = "https://github.com/zaitsew/bankjar";
export const TAGLINE = "Find the bank offer that pays you most";
export const DESCRIPTION =
  "Compare Spanish bank offers by goal: salary bonus, savings, free accounts and deposits. Open data, open ranking, dated sources.";

/** Public origin for metadata, the sitemap and the examples on /agents. */
export function siteUrl(): URL {
  const explicit = process.env.SITE_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const raw = explicit ?? (vercel ? `https://${vercel}` : "http://localhost:3000");
  try {
    return new URL(raw);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export function absolute(path: string): string {
  return new URL(path, siteUrl()).toString();
}
