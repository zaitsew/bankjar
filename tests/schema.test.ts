import { describe, expect, it } from "vitest";
import { OfferSchema } from "../src/core/schema";
import { fixtures } from "./helpers/offers";

function raw(): Record<string, any> {
  return structuredClone(fixtures()[0]) as Record<string, any>;
}

describe("OfferSchema", () => {
  it("accepts every fixture", () => {
    for (const f of fixtures()) expect(OfferSchema.safeParse(f).success).toBe(true);
  });

  it("defaults paid_placement to false", () => {
    const r = raw();
    delete r.paid_placement;
    const parsed = OfferSchema.parse(r);
    expect(parsed.paid_placement).toBe(false);
  });

  it.each([
    ["id not kebab", { id: "Bad_Id" }],
    ["bank_slug with space", { bank_slug: "my bank" }],
    ["country lower case", { country: "es" }],
    ["country too long", { country: "ESP" }],
    ["unknown goal", { goal: "mortgage" }],
    ["date not ISO", { verified_on: "21/10/2026" }],
    ["date not real", { verified_on: "2026-02-31" }],
    ["source_url not a url", { source_url: "not a url" }],
    ["negative rate", { rate_tae: -1 }],
    ["fractional commitment", { commitment_months: 1.5 }],
    ["unknown confirmed_by", { confirmed_by: "blog" }],
    ["unknown reward type", { reward: { type: "voucher", value_eur: 1, description: "x", paid_when: null } }],
  ])("rejects %s", (_name, patch) => {
    expect(OfferSchema.safeParse({ ...raw(), ...patch }).success).toBe(false);
  });

  it("rejects a missing required field and names it", () => {
    const r = raw();
    delete r.source_url;
    const res = OfferSchema.safeParse(r);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0]?.path).toEqual(["source_url"]);
  });

  it("accepts null for every nullable field", () => {
    const r = {
      ...raw(),
      rate_tae: null,
      promo_months: null,
      balance_cap_eur: null,
      commitment_months: null,
      penalty: null,
      valid_until: null,
      notes: null,
    };
    expect(OfferSchema.safeParse(r).success).toBe(true);
  });
});
