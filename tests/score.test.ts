import { describe, expect, it } from "vitest";
import { makeProfile } from "../src/core/profile";
import { daysBetween, scoreOffer } from "../src/core/score";
import { fixture, makeOffer, TODAY } from "./helpers/offers";

const profile = makeProfile();

describe("scoreOffer: cash", () => {
  it("takes 19% withholding off a cash reward", () => {
    const s = scoreOffer(fixture("testbank-payroll-cash"), profile, TODAY);
    expect(s.net_value_eur).toBe(648);
    expect(s.breakdown).toEqual([
      { label: "Cash reward EUR 800", eur: 800 },
      { label: "Withholding 19%", eur: -152 },
    ]);
  });

  it("divides by commitment months for value per month", () => {
    const s = scoreOffer(fixture("testbank-payroll-cash"), profile, TODAY);
    expect(s.value_per_month_eur).toBe(54);
  });

  it("flags the penalty without changing the number", () => {
    const withPenalty = scoreOffer(fixture("testbank-payroll-cash"), profile, TODAY);
    const without = scoreOffer(makeOffer({ penalty: null }), profile, TODAY);
    expect(withPenalty.flags).toContain("penalty: Bonus is clawed back if the payroll stops within 12 months");
    expect(without.flags.some((f) => f.startsWith("penalty"))).toBe(false);
    expect(withPenalty.net_value_eur).toBe(without.net_value_eur);
  });

  it("flags an unknown reward value and counts it as zero", () => {
    const s = scoreOffer(makeOffer({ reward: { value_eur: null } }), profile, TODAY);
    expect(s.flags).toContain("reward value unknown");
    expect(s.net_value_eur).toBe(0);
  });
});

describe("scoreOffer: gift", () => {
  const phone = fixture("testbank-phone-gift");

  it("counts a gift at gift_factor and charges 19% of retail as tax", () => {
    const s = scoreOffer(phone, profile, TODAY);
    // 1500 x 0.8 = 1200, minus 285 tax = 915, minus 12 x 5 fees = 60.
    expect(s.net_value_eur).toBe(855);
    expect(s.flags).toContain("tax on gift: check terms");
  });

  it("follows the person's gift factor", () => {
    expect(scoreOffer(phone, makeProfile({ gift_factor: 0.5 }), TODAY).net_value_eur).toBe(405);
    expect(scoreOffer(phone, makeProfile({ gift_factor: 0 }), TODAY).net_value_eur).toBe(-345);
  });

  it("uses fees over the full commitment for value per month", () => {
    // (915 - 5 x 36) / 36 = 20.4166...
    expect(scoreOffer(phone, profile, TODAY).value_per_month_eur).toBe(20.42);
  });

  it("puts fees in the breakdown", () => {
    const labels = scoreOffer(phone, profile, TODAY).breakdown.map((b) => b.label);
    expect(labels).toContain("Fees, first 12 months");
  });
});

describe("scoreOffer: rate", () => {
  const saver = fixture("testbank-saver");

  it("caps the balance, limits the months and takes 19% off interest", () => {
    // min(10000, 5000) x 3% x 6/12 = 75, minus 14.25 = 60.75
    const s = scoreOffer(saver, profile, TODAY);
    expect(s.net_value_eur).toBe(60.75);
  });

  it("uses the person's balance when it is below the cap", () => {
    // 2000 x 3% x 6/12 = 30, minus 5.70 = 24.30
    expect(scoreOffer(saver, makeProfile({ balance_eur: 2000 }), TODAY).net_value_eur).toBe(24.3);
  });

  it("counts at most 12 months of promo", () => {
    const longPromo = makeOffer({ goal: "deposit", reward: { type: "rate" }, rate_tae: 4, promo_months: 24, balance_cap_eur: null, commitment_months: 12, fees: { monthly_eur: 0 } });
    // 10000 x 4% = 400, minus 76 = 324
    expect(scoreOffer(longPromo, profile, TODAY).net_value_eur).toBe(324);
  });

  it("assumes 12 months when promo_months is null", () => {
    const o = makeOffer({ goal: "savings", reward: { type: "rate" }, rate_tae: 2, promo_months: null, balance_cap_eur: null, commitment_months: 0 });
    expect(scoreOffer(o, profile, TODAY).net_value_eur).toBe(162);
  });

  it("gives no value per month when there is no commitment", () => {
    expect(scoreOffer(saver, profile, TODAY).value_per_month_eur).toBeNull();
  });

  it("adds interest to a cash bonus on a savings account", () => {
    const o = makeOffer({ goal: "savings", reward: { type: "cash", value_eur: 100 }, rate_tae: 2, promo_months: 12, balance_cap_eur: null });
    expect(scoreOffer(o, profile, TODAY).net_value_eur).toBe(81 + 162);
  });
});

describe("scoreOffer: fees and other rewards", () => {
  it("subtracts 12 months of fees from the first-year value", () => {
    const o = makeOffer({ fees: { monthly_eur: 2 } });
    expect(scoreOffer(o, profile, TODAY).net_value_eur).toBe(648 - 24);
  });

  it("charges fees for at least 12 months when the commitment is shorter", () => {
    const o = makeOffer({ commitment_months: 6, fees: { monthly_eur: 2 } });
    // (648 - 2 x 12) / 6 = 104
    expect(scoreOffer(o, profile, TODAY).value_per_month_eur).toBe(104);
  });

  it("counts a fee waiver as untaxed value", () => {
    const o = makeOffer({ goal: "account", reward: { type: "fee_waiver", value_eur: 60 }, commitment_months: 0 });
    expect(scoreOffer(o, profile, TODAY).net_value_eur).toBe(60);
  });

  it("scores an offer with no reward at zero", () => {
    const s = scoreOffer(fixture("testbank-free-account"), profile, TODAY);
    expect(s.net_value_eur).toBe(0);
    expect(s.breakdown).toEqual([]);
  });

  it("flags paid placement", () => {
    expect(scoreOffer(makeOffer({ paid_placement: true }), profile, TODAY).flags).toContain("paid placement");
  });

  it("flags a minimum income only when the person's income is unknown", () => {
    const unknown = scoreOffer(fixture("testbank-payroll-cash"), profile, TODAY);
    const known = scoreOffer(fixture("testbank-payroll-cash"), makeProfile({ monthly_income_eur: 3000 }), TODAY);
    expect(unknown.flags.some((f) => f.startsWith("needs income"))).toBe(true);
    expect(known.flags.some((f) => f.startsWith("needs income"))).toBe(false);
  });
});

describe("stale and hidden", () => {
  const offer = makeOffer({ verified_on: "2026-10-15" });

  it("is fresh within 30 days", () => {
    const s = scoreOffer(offer, profile, "2026-11-14"); // 30 days
    expect(s.stale).toBe(false);
    expect(s.hidden).toBe(false);
  });

  it("is stale after 30 days but still shown", () => {
    const s = scoreOffer(offer, profile, "2026-11-15"); // 31 days
    expect(s.stale).toBe(true);
    expect(s.hidden).toBe(false);
  });

  it("is hidden after 60 days", () => {
    expect(scoreOffer(offer, profile, "2026-12-14").hidden).toBe(false); // 60 days
    expect(scoreOffer(offer, profile, "2026-12-15").hidden).toBe(true); // 61 days
  });

  it("is hidden once valid_until has passed", () => {
    const o = makeOffer({ verified_on: "2026-10-15", valid_until: "2026-10-31" });
    expect(scoreOffer(o, profile, "2026-10-31").hidden).toBe(false);
    expect(scoreOffer(o, profile, "2026-11-01").hidden).toBe(true);
  });

  it("accepts a Date for today", () => {
    expect(scoreOffer(offer, profile, new Date("2026-12-20T10:00:00Z")).hidden).toBe(true);
  });

  it("counts days across month and year ends", () => {
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-10-21", "2026-10-21")).toBe(0);
    expect(() => daysBetween("21/10/2026", "2026-10-21")).toThrow();
  });
});

describe("the worked example in docs/METHODOLOGY.md", () => {
  it("EUR 800 cash for 12 months beats a EUR 1,500 phone for 36 months per month", () => {
    const cash = makeOffer({ fees: { monthly_eur: 0 } });
    const phone = makeOffer({
      reward: { type: "gift", value_eur: 1500 },
      commitment_months: 36,
      fees: { monthly_eur: 0 },
    });
    const c = scoreOffer(cash, profile, TODAY);
    const p = scoreOffer(phone, profile, TODAY);
    expect(c.net_value_eur).toBe(648);
    expect(c.value_per_month_eur).toBe(54);
    expect(p.net_value_eur).toBe(915);
    expect(p.value_per_month_eur).toBe(25.42);
  });
});
