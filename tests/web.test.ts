import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { avatarIndex, dateLabel, eur, eur2, rewardView } from "../components/format";
import { parseBlocks } from "../components/markdown-parse";
import { idsFrom, overridesFrom } from "../components/params";
import { OfferSchema } from "../src/core/schema";
import { parse } from "yaml";

describe("overridesFrom", () => {
  it("reads valid filters and ignores blank or invalid ones", () => {
    expect(overridesFrom({ goal: "salary", income: "2500", max_commitment: "12", residency: "nie_tie", gift_factor: "0.5" })).toEqual({
      goal: "salary",
      monthly_income_eur: 2500,
      max_commitment_months: 12,
      residency: "nie_tie",
      gift_factor: 0.5,
    });
    expect(overridesFrom({ goal: "mortgage", income: "", max_commitment: "-3", residency: "martian", gift_factor: "abc" })).toEqual({});
  });
  it("accepts a gift factor given as a percent and keeps zero commitment", () => {
    expect(overridesFrom({ gift_factor: "80", max_commitment: "0" })).toEqual({ gift_factor: 0.8, max_commitment_months: 0 });
  });
});

describe("idsFrom", () => {
  it("takes comma lists and repeated params, deduplicates and caps at three", () => {
    expect(idsFrom("a,b")).toEqual(["a", "b"]);
    expect(idsFrom(["a", "b,c", "a", "d"])).toEqual(["a", "b", "c"]);
    expect(idsFrom(undefined)).toEqual([]);
  });
});

describe("format", () => {
  it("formats euros", () => {
    expect(eur(648)).toBe("€648");
    expect(eur(1200)).toBe("€1,200");
    expect(eur(54.17)).toBe("€54.17");
    expect(eur2(54)).toBe("€54.00");
  });
  it("formats dates", () => {
    expect(dateLabel("2026-10-20")).toBe("20 Oct 2026");
  });
  it("picks a stable avatar", () => {
    expect(avatarIndex("bbva")).toBe(avatarIndex("bbva"));
    expect(avatarIndex("bbva")).toBeLessThan(8);
  });
  it("describes a rate reward", () => {
    const offer = OfferSchema.parse(parse(fs.readFileSync("tests/fixtures/offers/es/testbank-saver.yaml", "utf8")));
    const r = rewardView(offer);
    expect(r.value).toBe("3% TAE");
    expect(r.detail).toBe("6 mo · first €5,000");
  });
});

describe("parseBlocks", () => {
  it("parses the methodology document", () => {
    const blocks = parseBlocks(fs.readFileSync("docs/METHODOLOGY.md", "utf8"));
    expect(blocks[0]).toEqual({ t: "h", level: 1, text: "Methodology" });
    expect(blocks.some((b) => b.t === "table")).toBe(true);
    const rules = blocks.find((b) => b.t === "list" && b.ordered);
    expect(rules && rules.t === "list" && rules.items.length).toBeGreaterThanOrEqual(7);
  });
  it("joins wrapped list lines", () => {
    const [list] = parseBlocks("1. one\n   still one\n2. two");
    expect(list).toEqual({ t: "list", ordered: true, items: ["one still one", "two"] });
  });
});
