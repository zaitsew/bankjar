/**
 * Store fetchers for scripts/fetch-apps.ts. Network I/O only; nothing in the
 * site calls these at request time.
 */

const UA = "Mozilla/5.0 (compatible; BankJar data refresh; +https://github.com/zaitsew/bankjar)";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface StoreNumbers {
  url: string;
  rating: number | null;
  ratings_count: number;
  updated_on: string | null;
  languages?: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function get(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res;
}

export async function fetchIos(appId: number, country: string): Promise<StoreNumbers> {
  const res = await get(`https://itunes.apple.com/lookup?id=${appId}&country=${country.toLowerCase()}`);
  const body = (await res.json()) as { resultCount: number; results: Record<string, unknown>[] };
  const r = body.results[0];
  if (!r) throw new Error(`App Store lookup found no app ${appId} in ${country}`);
  const count = Number(r.userRatingCount ?? 0);
  const released = typeof r.currentVersionReleaseDate === "string" ? r.currentVersionReleaseDate.slice(0, 10) : null;
  return {
    url: `https://apps.apple.com/${country.toLowerCase()}/app/id${appId}`,
    rating: count > 0 && typeof r.averageUserRating === "number" ? round2(r.averageUserRating) : null,
    ratings_count: count,
    updated_on: released,
    languages: Array.isArray(r.languageCodesISO2A) ? (r.languageCodesISO2A as string[]).map((l) => l.toUpperCase()).sort() : [],
  };
}

/** "Oct 21, 2026" → "2026-10-21". */
export function parsePlayDate(s: string): string | null {
  const m = /^([A-Z][a-z]{2})\w* (\d{1,2}), (\d{4})$/.exec(s.trim());
  if (!m) return null;
  const [, mon = "", day = "", year = ""] = m;
  const month = MONTHS.indexOf(mon);
  if (month < 0) return null;
  return `${year}-${String(month + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** Rating, count and release date from a Google Play details page. */
export function parsePlayPage(html: string): Omit<StoreNumbers, "url"> {
  let rating: number | null = null;
  let count = 0;
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)) {
    try {
      const ld = JSON.parse(m[1] ?? "") as { "@type"?: string; aggregateRating?: { ratingValue?: string; ratingCount?: string } };
      if (ld["@type"] !== "SoftwareApplication") continue;
      if (ld.aggregateRating) {
        count = Number(ld.aggregateRating.ratingCount ?? 0);
        rating = count > 0 ? round2(Number(ld.aggregateRating.ratingValue)) : null;
      }
    } catch {
      // not the block we want
    }
  }
  const updated = /Updated on<\/div><div[^>]*>([^<]+)</.exec(html);
  return { rating, ratings_count: count, updated_on: updated ? parsePlayDate(updated[1] ?? "") : null };
}

export async function fetchAndroid(pkg: string, country: string): Promise<StoreNumbers> {
  const url = `https://play.google.com/store/apps/details?id=${pkg}&hl=en&gl=${country.toUpperCase()}`;
  const html = await (await get(url)).text();
  const parsed = parsePlayPage(html);
  if (parsed.updated_on === null && parsed.rating === null) throw new Error(`Google Play page for ${pkg} had no rating and no date`);
  return { url: `https://play.google.com/store/apps/details?id=${pkg}&gl=${country.toUpperCase()}`, ...parsed };
}
