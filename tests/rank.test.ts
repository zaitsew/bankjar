import { describe, expect, it } from "vitest";
import { makeProfile } from "../src/core/profile";
import { compareOffers, rankOffers } from "../src/core/rank";
import { fixtures, makeOffer, TODAY } from "./helpers/offers";

const ids = (r: { offer: { id: string } }[]) => r.map((x) => x.offer.id);

describe("rankOffers", () => {
  const offers = fixtures();

  it("returns only offers for the goal, best net value first", () => {
    const r = rankOffers(offers, makeProfile({ goal: "salary" }), TODAY);
    expect(ids(r.ranked)).toEqual(["testbank-phone-gift", "testbank-payroll-cash"]);
    expect(r.excluded).toEqual([]);
  });

  it("returns every goal when the profile has none", () => {
    const r = rankOffers(offers, makeProfile(), TODAY);
    expect(r.ranked).toHaveLength(4);
    expect(r.ranked[0]?.offer.id).toBe("testbank-phone-gift");
  });

  it("excludes offers above the person's income, with a reason", () => {
    const r = rankOffers(offers, makeProfile({ goal: "salary", monthly_income_eur: 2200 }), TODAY);
    expect(ids(r.ranked)).toEqual(["testbank-payroll-cash"]);
    expect(r.excluded[0]?.offer.id).toBe("testbank-phone-gift");
    expect(r.excluded[0]?.reasons[0]).toMatch(/income of at least EUR 2500/);
  });

  it("keeps offers with a minimum income when the income is unknown", () => {
    const r = rankOffers(offers, makeProfile({ goal: "salary" }), TODAY);
    expect(r.ranked).toHaveLength(2);
  });

  it("excludes new-customer offers for an existing customer", () => {
    const r = rankOffers(offers, makeProfile({ goal: "salary", existing_customer_of: ["testbank"] }), TODAY);
    expect(ids(r.ranked)).toEqual(["testbank-phone-gift"]);
    expect(r.excluded[0]?.reasons[0]).toMatch(/new customers only/);
  });

  it("excludes residents-only offers for a non-resident", () => {
    const r = rankOffers(offers, makeProfile({ goal: "salary", residency: "non_resident" }), TODAY);
    expect(r.ranked).toEqual([]);
    expect(r.excluded.map((e) => e.offer.id).sort()).toEqual(["testbank-payroll-cash", "testbank-phone-gift"]);
  });

  it("keeps offers open to non-residents", () => {
    const r = rankOffers(offers, makeProfile({ residency: "non_resident" }), TODAY);
    expect(ids(r.ranked).sort()).toEqual(["testbank-free-account", "testbank-saver"]);
  });

  it("excludes offers that refuse a NIE or TIE", () => {
    const o = makeOffer({ id: "no-nie", eligibility: { nie_tie_ok: false } });
    const r = rankOffers([o], makeProfile({ residency: "nie_tie" }), TODAY);
    expect(r.excluded[0]?.reasons).toContain("not open with a NIE or TIE");
  });

  it("does not exclude on unknown residency", () => {
    expect(rankOffers(offers, makeProfile({ goal: "salary", residency: "unknown" }), TODAY).ranked).toHaveLength(2);
  });

  it("excludes offers whose commitment is too long", () => {
    const r = rankOffers(offers, makeProfile({ goal: "salary", max_commitment_months: 12 }), TODAY);
    expect(ids(r.ranked)).toEqual(["testbank-payroll-cash"]);
    expect(r.excluded[0]?.reasons[0]).toMatch(/36 months is longer than your 12/);
  });

  it("treats a max commitment of 0 as no commitment at all", () => {
    const r = rankOffers(offers, makeProfile({ max_commitment_months: 0 }), TODAY);
    expect(ids(r.ranked).sort()).toEqual(["testbank-free-account", "testbank-saver"]);
  });

  it("drops gifts when the person wants cash", () => {
    const r = rankOffers(offers, makeProfile({ goal: "salary", prefer: "cash" }), TODAY);
    expect(ids(r.ranked)).toEqual(["testbank-payroll-cash"]);
  });

  it("moves hidden offers to excluded", () => {
    const r = rankOffers(offers, makeProfile({ goal: "salary" }), "2026-12-20");
    expect(r.ranked).toEqual([]);
    expect(r.excluded).toHaveLength(2);
    expect(r.excluded[0]?.reasons[0]).toMatch(/not verified since/);
  });

  it("gives a reason for an expired offer", () => {
    const o = makeOffer({ valid_until: "2026-10-20" });
    expect(rankOffers([o], makeProfile(), TODAY).excluded[0]?.reasons[0]).toBe("expired on 2026-10-20");
  });

  it("keeps stale offers in the ranking, marked stale", () => {
    const r = rankOffers(offers, makeProfile({ goal: "salary" }), "2026-11-20");
    expect(r.ranked.length).toBe(2);
    expect(r.ranked.every((x) => x.score.stale)).toBe(true);
  });

  it("breaks net-value ties by value per month, then by newer verification, then by id", () => {
    const a = makeOffer({ id: "a", commitment_months: 24 }); // 648 / 24 = 27
    const b = makeOffer({ id: "b", commitment_months: 12 }); // 54
    const c = makeOffer({ id: "c", commitment_months: 12, verified_on: "2026-10-19" }); // 54, newer
    const d = makeOffer({ id: "d", commitment_months: 12, verified_on: "2026-10-19" }); // same as c
    const n = makeOffer({ id: "n", commitment_months: 0 }); // no per-month value, last
    expect(ids(rankOffers([n, a, b, d, c], makeProfile(), TODAY).ranked)).toEqual(["c", "d", "b", "a", "n"]);
  });

  it("never lets paid placement change the order", () => {
    const paid = makeOffer({ id: "paid", paid_placement: true, reward: { value_eur: 100 } });
    const free = makeOffer({ id: "free", reward: { value_eur: 500 } });
    const r = rankOffers([paid, free], makeProfile(), TODAY);
    expect(ids(r.ranked)).toEqual(["free", "paid"]);
    expect(r.ranked[1]?.score.flags).toContain("paid placement");
  });

  it("handles an empty list", () => {
    expect(rankOffers([], makeProfile(), TODAY)).toEqual({ ranked: [], excluded: [] });
  });
});

describe("compareOffers", () => {
  const offers = fixtures();

  it("returns offers in the requested order", () => {
    const r = compareOffers(offers, ["testbank-saver", "testbank-payroll-cash"], makeProfile(), TODAY);
    expect(r.items.map((i) => i.offer.id)).toEqual(["testbank-saver", "testbank-payroll-cash"]);
    expect(r.missing).toEqual([]);
  });

  it("reports unknown ids and ignores duplicates", () => {
    const r = compareOffers(offers, ["testbank-saver", "nope", "testbank-saver"], makeProfile(), TODAY);
    expect(r.items).toHaveLength(1);
    expect(r.missing).toEqual(["nope"]);
  });

  it("keeps offers the person cannot take and explains why", () => {
    const r = compareOffers(offers, ["testbank-phone-gift"], makeProfile({ monthly_income_eur: 1000 }), TODAY);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]?.reasons.length).toBeGreaterThan(0);
    expect(r.items[0]?.score.net_value_eur).toBe(855);
  });
});
