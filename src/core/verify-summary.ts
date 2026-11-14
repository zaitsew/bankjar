import { renderMarkdown, type Report } from "./verify-offers";

/**
 * Pure logic of the weekly verifier run (scripts/verify-weekly.sh): the summary
 * header on top of the verifier report, and the "did anything change" test.
 * No network, no files. It never touches an offer: the report is evidence for
 * a person who reviews the pull request.
 */

export const STALE_AFTER_DAYS = 21;
export const EXPIRY_WINDOW_DAYS = 7;

export interface DatedOffer {
  id: string;
  verified_on: string;
  valid_until: string | null;
}

export interface WeeklySummary {
  /** UTC date of the run, YYYY-MM-DD. */
  date: string;
  counts: Report["counts"];
  total: number;
  /** verified_on is more than STALE_AFTER_DAYS days before the run date. */
  stale: { id: string; verified_on: string }[];
  /** valid_until is within EXPIRY_WINDOW_DAYS days of the run date, or already past. */
  expiring: { id: string; valid_until: string; past: boolean }[];
  /** Offers that are stale or expiring, each counted once. */
  staleSoon: number;
}

const DAY_MS = 86_400_000;

function dayNumber(iso: string): number {
  return Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);
}

export function summarize(report: Report, offers: DatedOffer[], now: Date): WeeklySummary {
  const date = now.toISOString().slice(0, 10);
  const today = dayNumber(date);
  const stale: WeeklySummary["stale"] = [];
  const expiring: WeeklySummary["expiring"] = [];
  const soon = new Set<string>();
  const sorted = [...offers].sort((a, b) => a.id.localeCompare(b.id));
  for (const o of sorted) {
    if (today - dayNumber(o.verified_on) > STALE_AFTER_DAYS) {
      stale.push({ id: o.id, verified_on: o.verified_on });
      soon.add(o.id);
    }
    if (o.valid_until !== null) {
      const left = dayNumber(o.valid_until) - today;
      if (left <= EXPIRY_WINDOW_DAYS) {
        expiring.push({ id: o.id, valid_until: o.valid_until, past: left < 0 });
        soon.add(o.id);
      }
    }
  }
  return { date, counts: report.counts, total: report.total, stale, expiring, staleSoon: soon.size };
}

/** The Markdown block shown in the PR body and at the top of the committed report. */
export function renderSummary(s: WeeklySummary): string {
  const lines: string[] = [];
  lines.push(`**Run ${s.date}.** ${s.total} offers.`, "");
  lines.push(
    `| ok | mismatch | unverifiable | blocked | stale (>${STALE_AFTER_DAYS} d) | expiring (<=${EXPIRY_WINDOW_DAYS} d or past) |`,
    `|---|---|---|---|---|---|`,
    `| ${s.counts.ok} | ${s.counts.mismatch} | ${s.counts.unverifiable} | ${s.counts.blocked} | ${s.stale.length} | ${s.expiring.length} |`,
    "",
  );
  if (s.stale.length > 0) {
    lines.push(`Stale, verified_on older than ${STALE_AFTER_DAYS} days:`, "");
    for (const o of s.stale) lines.push(`- \`${o.id}\` verified_on ${o.verified_on}`);
    lines.push("");
  }
  if (s.expiring.length > 0) {
    lines.push(`valid_until within ${EXPIRY_WINDOW_DAYS} days or past:`, "");
    for (const o of s.expiring) lines.push(`- \`${o.id}\` valid_until ${o.valid_until}${o.past ? " (past)" : ""}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** The committed file: a short header, the summary, then the full verifier report. */
export function renderCommitted(report: Report, s: WeeklySummary): string {
  return [
    "# Offer verification, latest weekly run",
    "",
    "Written by `scripts/verify-weekly.sh`. History is the git log of this file. A found number is evidence for a person; this file never renews `verified_on`.",
    "",
    renderSummary(s),
    renderMarkdown(report),
  ].join("\n");
}

/** Lines that change on every run without meaning anything: the run date and the timestamp. */
const VOLATILE = [/^\*\*Run \d{4}-\d{2}-\d{2}\.\*\*/, /^Generated \d{4}-\d{2}-\d{2}T[^ ]+ \d+ offers\.$/];

export function normalizeForCompare(md: string): string {
  return md
    .split("\n")
    .filter((line) => !VOLATILE.some((re) => re.test(line)))
    .join("\n")
    .trim();
}

export function sameReport(a: string, b: string): boolean {
  return normalizeForCompare(a) === normalizeForCompare(b);
}
