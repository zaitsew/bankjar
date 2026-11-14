import { describe, expect, it } from "vitest";
import { buildReport, type OfferReport } from "../src/core/verify-offers";
import { normalizeForCompare, renderCommitted, renderSummary, sameReport, summarize } from "../src/core/verify-summary";

const NOW = new Date("2026-11-15T07:00:00Z");

const row = (id: string, status: OfferReport["status"]): OfferReport => ({
  id,
  bank: "Testbank",
  source_url: "https://example.com/" + id,
  verified_on: "2026-10-22",
  http_status: 200,
  text_chars: 1000,
  status,
  reason: null,
  checked: [],
  missing: [],
});

describe("summarize", () => {
  const report = buildReport([row("a", "ok"), row("b", "mismatch"), row("c", "mismatch")], NOW);

  it("counts offers older than 21 days as stale, and 21 days exactly as fresh", () => {
    const s = summarize(
      report,
      [
        { id: "old", verified_on: "2026-10-24", valid_until: null }, // 22 days
        { id: "edge", verified_on: "2026-10-25", valid_until: null }, // 21 days
        { id: "new", verified_on: "2026-11-10", valid_until: null },
      ],
      NOW,
    );
    expect(s.stale.map((o) => o.id)).toEqual(["old"]);
    expect(s.staleSoon).toBe(1);
  });

  it("flags valid_until within 7 days, today and past; not 8 days out", () => {
    const s = summarize(
      report,
      [
        { id: "past", verified_on: "2026-11-10", valid_until: "2026-11-01" },
        { id: "today", verified_on: "2026-11-10", valid_until: "2026-11-15" },
        { id: "seven", verified_on: "2026-11-10", valid_until: "2026-11-22" },
        { id: "eight", verified_on: "2026-11-10", valid_until: "2026-11-23" },
      ],
      NOW,
    );
    expect(s.expiring.map((o) => [o.id, o.past])).toEqual([
      ["past", true],
      ["seven", false],
      ["today", false],
    ]);
  });

  it("counts an offer that is both stale and expiring once", () => {
    const s = summarize(report, [{ id: "x", verified_on: "2026-09-01", valid_until: "2026-11-16" }], NOW);
    expect(s.stale).toHaveLength(1);
    expect(s.expiring).toHaveLength(1);
    expect(s.staleSoon).toBe(1);
  });

  it("carries the status counts and the run date", () => {
    const s = summarize(report, [], NOW);
    expect(s.date).toBe("2026-11-15");
    expect(s.counts).toEqual({ ok: 1, mismatch: 2, unverifiable: 0, blocked: 0 });
  });
});

describe("change detection", () => {
  const offers = [{ id: "x", verified_on: "2026-09-01", valid_until: null }];
  const make = (when: string, statuses: OfferReport["status"][]) => {
    const now = new Date(when);
    const report = buildReport(
      statuses.map((s, i) => row(`o${i}`, s)),
      now,
    );
    return renderCommitted(report, summarize(report, offers, now));
  };

  it("ignores the run date and the timestamp", () => {
    const a = make("2026-11-08T07:00:01Z", ["ok", "mismatch"]);
    const b = make("2026-11-15T07:03:44Z", ["ok", "mismatch"]);
    expect(a).not.toBe(b);
    expect(sameReport(a, b)).toBe(true);
  });

  it("sees a changed status", () => {
    const a = make("2026-11-08T07:00:00Z", ["ok", "mismatch"]);
    const b = make("2026-11-15T07:00:00Z", ["ok", "ok"]);
    expect(sameReport(a, b)).toBe(false);
  });

  it("keeps real content when normalizing", () => {
    const md = make("2026-11-15T07:00:00Z", ["mismatch"]);
    expect(normalizeForCompare(md)).toContain("`o0`");
    expect(normalizeForCompare(md)).not.toContain("Generated");
  });

  it("renders the summary table", () => {
    const now = new Date("2026-11-15T07:00:00Z");
    const report = buildReport([row("o0", "blocked")], now);
    expect(renderSummary(summarize(report, offers, now))).toContain("| 0 | 0 | 0 | 1 | 1 | 0 |");
  });
});
