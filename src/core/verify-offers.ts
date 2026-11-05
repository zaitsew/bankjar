import type { Offer } from "./schema";

/**
 * Pure logic of the offer verifier (scripts/verify-offers.ts): no network, no
 * files. It compares the checkable numbers of an offer with the text of its
 * source page. It answers "was this number found on the page", nothing more.
 * A number that is not found means a person must read the page: value_eur may
 * be a derived figure (net, first-year) that the page never prints.
 */

export type Status = "ok" | "mismatch" | "unverifiable" | "blocked";

export const CHECK_FIELDS = [
  "reward.value_eur",
  "rate_tae",
  "commitment_months",
  "requirements.min_monthly_income_eur",
  "fees.monthly_eur",
] as const;
export type CheckField = (typeof CHECK_FIELDS)[number];

export interface FieldResult {
  field: CheckField;
  expected: number;
  found: boolean;
}

export interface Verdict {
  status: Status;
  /** Why the page counts as blocked; null otherwise. */
  reason: string | null;
  checked: FieldResult[];
  missing: CheckField[];
}

/** A page with less visible text than this is a shell or a wall, not an offer page. */
export const MIN_TEXT_CHARS = 400;
/** These phrases mark a page as blocked at any length. A false `blocked` only sends the page to a person. */
const WALL_PHRASES = [
  "access denied",
  "acceso denegado",
  "just a moment",
  "verify you are human",
  "verifying you are human",
  "are you a robot",
  "request blocked",
  "attention required",
];
/** These also appear on real offer pages (a form's captcha), so they count only on a short page or at the top of one. */
const WEAK_WALL_MAX_CHARS = 2500;
const WEAK_WALL_TOP_CHARS = 600;
const WEAK_WALL_PHRASES = [
  "enable javascript",
  "javascript is disabled",
  "please enable cookies",
  "captcha",
  "activa javascript",
  "habilita javascript",
];

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  euro: "€",
  ntilde: "ñ",
  oacute: "ó",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  uacute: "ú",
  Ntilde: "Ñ",
};

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

function isHiddenByAttributes(attrs: string): boolean {
  const withoutValues = attrs.replace(/=\s*("[^"]*"|'[^']*'|[^\s>]+)/g, "=");
  if (/\shidden\b/i.test(withoutValues)) return true;
  if (/\saria-hidden\s*=\s*["']?true/i.test(attrs)) return true;
  // Any attribute that says so, quoted or not: hiding too much only sends the page to a person.
  return /(display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attrs);
}

/** One tag. Attribute values may hold `>` inside quotes. */
const TAG = String.raw`<(\/?)([a-z][a-z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>`;

/**
 * Removes elements hidden by an attribute, with their nested content. A reader cannot see their
 * numbers, so they must not count as found. Hiding through a CSS class cannot be seen from the HTML.
 */
function stripHiddenElements(html: string): string {
  const tag = new RegExp(TAG, "gi");
  let out = "";
  let copiedTo = 0;
  let skipName: string | null = null;
  let depth = 0;
  for (const m of html.matchAll(tag)) {
    const closing = m[1] === "/";
    const name = (m[2] ?? "").toLowerCase();
    const attrs = m[3] ?? "";
    // Browsers ignore a trailing slash on a non-void element: `<div hidden/>` still opens a hidden div.
    const selfClosed = VOID_TAGS.has(name);
    if (skipName !== null) {
      if (name !== skipName || selfClosed) continue;
      depth += closing ? -1 : 1;
      if (depth === 0) {
        copiedTo = m.index + m[0].length;
        skipName = null;
      }
      continue;
    }
    if (closing || selfClosed || !isHiddenByAttributes(attrs)) continue;
    out += html.slice(copiedTo, m.index) + " ";
    skipName = name;
    depth = 1;
  }
  // An element that never closes hides the rest of the page.
  return skipName !== null ? out : out + html.slice(copiedTo);
}

/** Reduces an HTML page to the text a reader sees. */
export function htmlToText(html: string): string {
  const withoutBlocks = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1\s*>/gi, " ");
  return stripHiddenElements(withoutBlocks)
    .replace(new RegExp(TAG, "gi"), " ")
    .replace(/<\/?[a-z!][^>]*>/gi, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n] ?? m)
    .replace(/[\s  ]+/g, " ")
    .trim();
}

function safeChar(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return " ";
  }
}

/**
 * Parses one number token in Spanish or English format:
 * 1.200, 1,200, 1 200 and 1200 are 1200; 2,5 and 2.5 are 2.5; 1.200,50 and 1,200.50 are 1200.5.
 * A single separator followed by exactly three digits is a thousands separator.
 */
export function parseNumberToken(token: string): number | null {
  const t = token.trim().replace(/[\s  ]/g, "");
  if (!/^\d[\d.,]*$/.test(t) || /[.,]$/.test(t)) return null;
  const lastDot = t.lastIndexOf(".");
  const lastComma = t.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandsSep = decimalSep === "." ? "," : ".";
    normalized = t.split(thousandsSep).join("").replace(decimalSep, ".");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const parts = t.split(sep);
    const last = parts[parts.length - 1] ?? "";
    if (parts.length > 2) {
      // 1.200.000: only thousands separators
      if (!parts.slice(1).every((p) => p.length === 3)) return null;
      normalized = parts.join("");
    } else if (last.length === 3 && (parts[0] ?? "").length >= 1 && (parts[0] ?? "").length <= 3 && parts[0] !== "0") {
      normalized = parts.join("");
    } else {
      normalized = parts.join(".");
    }
  } else {
    normalized = t;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

// A number token: digits with optional thousands groups (dot, comma, space) and an optional decimal part.
const NUM = String.raw`\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?`;

function numbersMatching(text: string, re: RegExp, group: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(re)) {
    const raw = m.groups?.[group];
    if (raw === undefined) continue;
    const n = parseNumberToken(raw);
    if (n !== null) out.push(n);
  }
  return out;
}

/** Amounts in euros: a number next to €, EUR or "euros", before or after. */
export function findEuroAmounts(text: string): number[] {
  const after = new RegExp(String.raw`(?<![\d.,])(?<![\-−]\s*)(?<n>${NUM})\s?(?:€|eur\b|euros?\b)`, "gi");
  const before = new RegExp(String.raw`(?:€|\beur\b)\s?(?<n>${NUM})(?![\d])`, "gi");
  return [...numbersMatching(text, after, "n"), ...numbersMatching(text, before, "n")];
}

/** Percentages: a number followed by %. A negative rate does not confirm a positive one. */
export function findPercentages(text: string): number[] {
  const re = new RegExp(String.raw`(?<![\d.,])(?<![\-−]\s*)(?<n>${NUM})\s?%`, "g");
  return numbersMatching(text, re, "n");
}

/** Durations in months: "24 meses", "24 months", and "2 años" / "2 years" as 24. */
export function findMonths(text: string): number[] {
  const months = new RegExp(String.raw`(?<![\d.,])(?<n>\d{1,3})(?:\s?-\s?|\s)?(?:meses|mes|months?)\b`, "gi");
  const years = new RegExp(String.raw`(?<![\d.,])(?<n>\d{1,2})(?:\s?-\s?|\s)?(?:años|año|anos|years?)\b`, "gi");
  return [...numbersMatching(text, months, "n"), ...numbersMatching(text, years, "n").map((y) => y * 12)];
}

function has(list: number[], expected: number, tolerance: number): boolean {
  return list.some((n) => Math.abs(n - expected) <= tolerance);
}

/** The numbers worth checking: null and 0 prove nothing and are skipped. */
export function checkableNumbers(offer: Offer): { field: CheckField; expected: number }[] {
  const candidates: [CheckField, number | null][] = [
    ["reward.value_eur", offer.reward.value_eur],
    ["rate_tae", offer.rate_tae],
    ["commitment_months", offer.commitment_months],
    ["requirements.min_monthly_income_eur", offer.requirements.min_monthly_income_eur],
    ["fees.monthly_eur", offer.fees.monthly_eur],
  ];
  return candidates.flatMap(([field, v]) => (v === null || v === 0 ? [] : [{ field, expected: v }]));
}

/** Why a page cannot count as an offer page; null when it can. */
export function blockedReason(text: string): string | null {
  if (text.length < MIN_TEXT_CHARS) return `page text too short (${text.length} characters)`;
  const lower = text.toLowerCase();
  const scope = lower.length < WEAK_WALL_MAX_CHARS ? lower : lower.slice(0, WEAK_WALL_TOP_CHARS);
  const hit = WALL_PHRASES.find((p) => lower.includes(p)) ?? WEAK_WALL_PHRASES.find((p) => scope.includes(p));
  return hit ? `looks like a bot wall or script shell ("${hit}")` : null;
}

/** Compares the offer's numbers with the page text. */
export function checkText(offer: Offer, text: string): Verdict {
  const wall = blockedReason(text);
  if (wall) return { status: "blocked", reason: wall, checked: [], missing: [] };

  const euros = findEuroAmounts(text);
  const percents = findPercentages(text);
  const months = findMonths(text);

  const checked: FieldResult[] = checkableNumbers(offer).map(({ field, expected }) => {
    let found: boolean;
    if (field === "rate_tae") found = has(percents, expected, 0.005);
    else if (field === "commitment_months") found = has(months, expected, 0);
    else found = has(euros, expected, 0.005);
    return { field, expected, found };
  });

  const missing = checked.filter((c) => !c.found).map((c) => c.field);
  const status: Status = checked.length === 0 ? "unverifiable" : missing.length === 0 ? "ok" : "mismatch";
  return { status, reason: null, checked, missing };
}

/** A failed fetch is never a verification. */
export function blockedVerdict(reason: string): Verdict {
  return { status: "blocked", reason, checked: [], missing: [] };
}

export interface OfferReport {
  id: string;
  bank: string;
  source_url: string;
  verified_on: string;
  http_status: number | null;
  text_chars: number;
  status: Status;
  reason: string | null;
  checked: FieldResult[];
  missing: CheckField[];
}

export interface Report {
  generated_at: string;
  total: number;
  counts: Record<Status, number>;
  note: string;
  offers: OfferReport[];
}

export const REPORT_NOTE =
  "This check proves only that a number from the YAML appears on the source page. A missing number means a person must read the page: value_eur can be a derived figure (net, first-year) the page never prints. It never edits data/ and never renews verified_on.";

export function buildReport(offers: OfferReport[], now: Date): Report {
  const counts: Record<Status, number> = { ok: 0, mismatch: 0, unverifiable: 0, blocked: 0 };
  for (const o of offers) counts[o.status]++;
  return { generated_at: now.toISOString(), total: offers.length, counts, note: REPORT_NOTE, offers };
}

export function renderMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# Offer verifier report`, "");
  lines.push(`Generated ${report.generated_at}. ${report.total} offers.`, "");
  lines.push(`> ${report.note}`, "");
  lines.push(
    `| ok | mismatch | unverifiable | blocked |`,
    `|---|---|---|---|`,
    `| ${report.counts.ok} | ${report.counts.mismatch} | ${report.counts.unverifiable} | ${report.counts.blocked} |`,
    "",
  );
  const sections: [Status, string][] = [
    ["mismatch", "Mismatch: a person reads these pages"],
    ["blocked", "Blocked: no verification happened"],
    ["unverifiable", "Unverifiable: the page loaded, nothing was checkable"],
    ["ok", "Ok: every checkable number was found"],
  ];
  for (const [status, title] of sections) {
    const rows = report.offers.filter((o) => o.status === status);
    lines.push(`## ${title} (${rows.length})`, "");
    if (rows.length === 0) {
      lines.push("None.", "");
      continue;
    }
    for (const o of rows) {
      const detail =
        status === "mismatch"
          ? `not found on the page: ${o.missing.map((f) => `${f}=${o.checked.find((c) => c.field === f)?.expected}`).join(", ")}`
          : status === "blocked"
            ? (o.reason ?? "blocked")
            : status === "ok"
              ? `found: ${o.checked.map((c) => c.field).join(", ")}`
              : "no non-zero number to check";
      lines.push(`- \`${o.id}\` (${o.bank}) ${o.source_url} — ${detail}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
