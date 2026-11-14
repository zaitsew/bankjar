/**
 * Turns a verifier run into the committed weekly report. Used by
 * scripts/verify-weekly.sh; read-only for data/.
 *
 *   tsx scripts/verify-summary.ts <runs/verify-offers/...json> --out docs/verification/offers-latest.md --body pr-body.md
 *
 * Writes --out only when the report changed (ignoring the run date and the
 * timestamp), writes the summary to --body, and prints key=value lines:
 * changed, date, mismatch, stale_soon, ok, unverifiable, blocked.
 */
import fs from "node:fs";
import { allOffers } from "../src/server/data";
import type { Report } from "../src/core/verify-offers";
import { renderCommitted, renderSummary, sameReport, summarize } from "../src/core/verify-summary";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const input = process.argv[2];
const out = arg("--out");
const body = arg("--body");
if (!input || input.startsWith("--") || !out) {
  console.error("usage: verify-summary.ts <report.json> --out <file.md> [--body <file.md>]");
  process.exit(2);
}

const report = JSON.parse(fs.readFileSync(input, "utf8")) as Report;
const summary = summarize(report, allOffers(), new Date(report.generated_at));
const next = renderCommitted(report, summary);
const before = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : null;
const changed = before === null || !sameReport(before, next);
if (changed) fs.writeFileSync(out, next.endsWith("\n") ? next : `${next}\n`);
if (body) fs.writeFileSync(body, renderSummary(summary));

console.log(`changed=${changed ? 1 : 0}`);
console.log(`date=${summary.date}`);
console.log(`mismatch=${summary.counts.mismatch}`);
console.log(`stale_soon=${summary.staleSoon}`);
for (const k of ["ok", "unverifiable", "blocked"] as const) console.log(`${k}=${summary.counts[k]}`);
