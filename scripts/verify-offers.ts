/**
 * Read-only offer verifier. For every offer in data/offers, fetch source_url,
 * reduce the page to text and look for the numbers the YAML states.
 *
 *   npm run verify-offers               all offers
 *   npm run verify-offers -- bbva       only offers whose id contains "bbva"
 *
 * Writes runs/verify-offers/<timestamp>.json and .md and prints one count per
 * status. It never edits a file in data/ and never changes verified_on: a
 * found number is evidence for a person, not a renewal. The exit code is 0
 * unless the script itself crashes.
 */

import fs from "node:fs";
import path from "node:path";
import { allOffers } from "../src/server/data";
import {
  blockedVerdict,
  buildReport,
  checkText,
  htmlToText,
  renderMarkdown,
  type OfferReport,
} from "../src/core/verify-offers";

const TIMEOUT_MS = 20_000;
const CONCURRENCY = 3;
const MAX_BYTES = 5_000_000;
// A generic client name with the project link; no personal contact.
const USER_AGENT = "BankJarOfferVerifier/1.0 (+https://github.com/zaitsew/bankjar)";

interface Page {
  status: number | null;
  text: string;
  error: string | null;
}

async function fetchPage(url: string): Promise<Page> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "accept-language": "es-ES,es;q=0.9,en;q=0.8",
      },
    });
    if (!res.ok) return { status: res.status, text: "", error: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer()).subarray(0, MAX_BYTES);
    return { status: res.status, text: htmlToText(buf.toString("utf8")), error: null };
  } catch (e) {
    const err = e as Error;
    const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
    return { status: null, text: "", error: timedOut ? `timeout after ${TIMEOUT_MS / 1000} s` : `fetch failed: ${err.message}` };
  }
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++] as T;
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
}

async function main() {
  const filter = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const offers = allOffers().filter((o) => !filter || o.id.includes(filter));
  const pages = new Map<string, Promise<Page>>();
  const getPage = (url: string) => {
    let p = pages.get(url);
    if (!p) pages.set(url, (p = fetchPage(url)));
    return p;
  };

  const results = new Map<string, OfferReport>();
  await pool(offers, CONCURRENCY, async (offer) => {
    const page = await getPage(offer.source_url);
    const verdict = page.error ? blockedVerdict(page.error) : checkText(offer, page.text);
    results.set(offer.id, {
      id: offer.id,
      bank: offer.bank,
      source_url: offer.source_url,
      verified_on: offer.verified_on,
      http_status: page.status,
      text_chars: page.text.length,
      status: verdict.status,
      reason: verdict.reason,
      checked: verdict.checked,
      missing: verdict.missing,
    });
    process.stderr.write(`${verdict.status.padEnd(12)} ${offer.id}\n`);
  });

  const now = new Date();
  const report = buildReport(
    offers.map((o) => results.get(o.id) as OfferReport),
    now,
  );
  const dir = path.join(process.cwd(), "runs", "verify-offers");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const base = path.join(dir, stamp);
  fs.writeFileSync(`${base}.json`, JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(`${base}.md`, renderMarkdown(report));

  for (const [status, n] of Object.entries(report.counts)) console.log(`${status}=${n}`);
  console.log(`report=${path.relative(process.cwd(), base)}.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
