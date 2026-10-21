import { beforeAll, describe, expect, it } from "vitest";
import { GET as compareGET } from "../app/api/v1/compare/route";
import { GET as goalsGET } from "../app/api/v1/goals/route";
import { GET as offerGET } from "../app/api/v1/offers/[id]/route";
import { GET as offersGET, OPTIONS as offersOPTIONS } from "../app/api/v1/offers/route";
import { GET as notFoundGET } from "../app/api/v1/[[...path]]/route";
import { GET as searchGET } from "../app/api/v1/search/route";
import { GET as datasetGET } from "../app/data/offers.json/route";
import { DISCLAIMER, LICENSE, offerRow, siteUrl, todayIso } from "../src/server/api";
import { scoreOffer } from "../src/core/score";
import { makeProfile } from "../src/core/profile";
import { datasetVersion } from "../src/server/data";
import { fixture, fixtures, TODAY } from "./helpers/offers";
import { SITE, get, json, useFixtureEnv } from "./helpers/api";

beforeAll(useFixtureEnv);

const ROW_KEYS = [
  "id", "bank", "bank_slug", "country", "goal", "product_name", "headline", "reward", "rate_tae",
  "commitment_months", "requirements", "fees", "penalty", "eligibility", "valid_until", "source_url",
  "verified_on", "stale", "score", "url",
];

describe("siteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL, then the Vercel production host, then localhost", () => {
    const saved = { ...process.env };
    process.env.NEXT_PUBLIC_SITE_URL = "https://a.example/";
    expect(siteUrl()).toBe("https://a.example");
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "bankjar.vercel.app";
    expect(siteUrl()).toBe("https://bankjar.vercel.app");
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(siteUrl()).toBe("http://localhost:3000");
    process.env.NEXT_PUBLIC_SITE_URL = saved.NEXT_PUBLIC_SITE_URL;
  });
  it("pins today through BANKJAR_TODAY", () => {
    expect(todayIso()).toBe(TODAY);
  });
});

describe("offer row", () => {
  it("has the stable shape and an absolute offer url", () => {
    const o = fixture("testbank-payroll-cash");
    const row = offerRow(o, scoreOffer(o, makeProfile({ goal: "salary" }), TODAY));
    expect(Object.keys(row).sort()).toEqual([...ROW_KEYS].sort());
    expect(Object.keys(row.score).sort()).toEqual(["breakdown", "flags", "net_value_eur", "value_per_month_eur"]);
    expect(row.url).toBe(`${SITE}/offer/testbank-payroll-cash`);
    expect(row.stale).toBe(false);
  });
});

describe("headers", () => {
  it("sends CORS and cache headers on GET", async () => {
    const res = await goalsGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
  });
  it("answers the CORS preflight", () => {
    const res = offersOPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("GET /api/v1/goals", () => {
  it("lists five goals with the envelope", async () => {
    const body = await json(await goalsGET());
    expect(body.goals.map((g: { id: string }) => g.id)).toEqual(["salary", "savings", "account", "deposit", "welcome"]);
    for (const g of body.goals) expect(Object.keys(g).sort()).toEqual(["description", "example_prompt", "id", "label"]);
    expect(body.disclaimer).toBe(DISCLAIMER);
    expect(body.license).toBe(LICENSE);
    expect(body.dataset.count).toBe(4);
  });
});

describe("GET /api/v1/search", () => {
  it("returns the same ranking as the engine, with sources", async () => {
    const body = await json(await searchGET(get("/api/v1/search?q=best+salary+bonus&income=2500")));
    expect(body.goal).toBe("salary");
    expect(body.parser).toBe("rules");
    expect(body.profile.monthly_income_eur).toBe(2500);
    expect(body.offers.length).toBeGreaterThan(0);
    for (const row of body.offers) {
      expect(Object.keys(row).sort()).toEqual([...ROW_KEYS].sort());
      expect(row.source_url).toMatch(/^https:\/\//);
      expect(row.verified_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const nets = body.offers.map((r: { score: { net_value_eur: number } }) => r.score.net_value_eur);
    expect([...nets].sort((a, b) => b - a)).toEqual(nets);
    expect(body.dataset).toEqual(datasetVersion(fixtures()));
    expect(body.dataset.count).toBe(4);
    expect(body.disclaimer).toBe(DISCLAIMER);
  });
  it("lets explicit parameters win over the query, and accepts long names", async () => {
    const body = await json(await searchGET(get("/api/v1/search?q=salary&goal=savings&balance_eur=20000")));
    expect(body.goal).toBe("savings");
    expect(body.profile.balance_eur).toBe(20000);
  });
  it("lists excluded offers with reasons", async () => {
    const body = await json(await searchGET(get("/api/v1/search?goal=salary&income=100")));
    expect(body.excluded.length + body.offers.length).toBeGreaterThan(0);
    for (const e of body.excluded) {
      expect(Object.keys(e).sort()).toEqual(["bank", "id", "reasons"]);
      expect(e.reasons.length).toBeGreaterThan(0);
    }
  });
  it("works with no parameters", async () => {
    const res = await searchGET(get("/api/v1/search"));
    expect(res.status).toBe(200);
  });
});

describe("validation", () => {
  const bad = [
    ["income=abc", "income"],
    ["income=-5", "income"],
    ["goal=mortgage", "goal"],
    ["max_commitment=1.5", "max_commitment"],
    ["gift_factor=2", "gift_factor"],
    ["residency=martian", "residency"],
    ["prefer=gold", "prefer"],
    ["customer_of=BBVA%20Bank", "customer_of"],
    ["max_commitmnt=12", "max_commitmnt"],
    ["income=1000&monthly_income_eur=2000", "monthly_income_eur"],
  ] as const;
  it.each(bad)("search?%s is a 400 naming %s", async (qs, param) => {
    const res = await searchGET(get(`/api/v1/search?${qs}`));
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await json(res);
    expect(body.error).toBeTypeOf("string");
    expect(body.issues.map((i: { param: string }) => i.param)).toContain(param);
  });
  it("rejects a too-long q", async () => {
    const res = await searchGET(get(`/api/v1/search?q=${"x".repeat(501)}`));
    expect(res.status).toBe(400);
  });
  it("rejects a bad country on offers", async () => {
    expect((await offersGET(get("/api/v1/offers?country=Spain"))).status).toBe(400);
  });
  it("requires ids on compare, and rejects bad ids", async () => {
    expect((await compareGET(get("/api/v1/compare"))).status).toBe(400);
    expect((await compareGET(get("/api/v1/compare?ids="))).status).toBe(400);
    expect((await compareGET(get("/api/v1/compare?ids=Bad_Id"))).status).toBe(400);
  });
});

describe("GET /api/v1/offers", () => {
  it("ranks one goal", async () => {
    const body = await json(await offersGET(get("/api/v1/offers?goal=salary&country=es")));
    expect(body.goal).toBe("salary");
    expect(body.country).toBe("ES");
    expect(body.offers.every((o: { goal: string }) => o.goal === "salary")).toBe(true);
    expect(body.count).toBe(body.offers.length);
  });
  it("groups by goal when none is given", async () => {
    const body = await json(await offersGET(get("/api/v1/offers")));
    expect(body.goal).toBeNull();
    expect(Object.keys(body.goals)).toEqual(["salary", "savings", "account", "deposit", "welcome"]);
    expect(body.goals.savings.offers[0].id).toBe("testbank-saver");
  });
  it("returns nothing for a country with no offers", async () => {
    const body = await json(await offersGET(get("/api/v1/offers?goal=salary&country=FR")));
    expect(body.offers).toEqual([]);
  });
});

describe("GET /api/v1/offers/{id}", () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
  it("returns the row and the full offer", async () => {
    const body = await json(await offerGET(get("/api/v1/offers/testbank-saver?balance=20000"), ctx("testbank-saver")));
    expect(body.offer.id).toBe("testbank-saver");
    expect(body.full_offer.confirmed_by).toBe("bank");
    expect(body.full_offer.paid_placement).toBe(false);
    expect(body.hidden).toBe(false);
    expect(body.not_eligible_reasons).toEqual([]);
    expect(body.offer.score.net_value_eur).toBeGreaterThan(0);
  });
  it("is a JSON 404 for an unknown id", async () => {
    const res = await offerGET(get("/api/v1/offers/nope"), ctx("nope"));
    expect(res.status).toBe(404);
    expect((await json(res)).error).toContain("nope");
  });
});

describe("GET /api/v1/compare", () => {
  it("keeps the order asked and reports missing ids", async () => {
    const body = await json(
      await compareGET(get("/api/v1/compare?ids=testbank-saver,testbank-payroll-cash,ghost,testbank-saver")),
    );
    expect(body.offers.map((o: { id: string }) => o.id)).toEqual(["testbank-saver", "testbank-payroll-cash"]);
    expect(body.missing).toEqual(["ghost"]);
    expect(body.offers[0].not_eligible_reasons).toEqual([]);
  });
  it("keeps an offer the profile cannot take, with the reason", async () => {
    const body = await json(await compareGET(get("/api/v1/compare?ids=testbank-payroll-cash&income=100")));
    expect(body.offers).toHaveLength(1);
    expect(body.offers[0].not_eligible_reasons.length).toBeGreaterThan(0);
  });
});

describe("unknown routes under /api/v1", () => {
  it("answer a JSON 404", async () => {
    const res = await notFoundGET(get("/api/v1/mortgages"));
    expect(res.status).toBe(404);
    const body = await json(res);
    expect(body.error).toContain("/api/v1/mortgages");
    expect(body.openapi).toBe(`${SITE}/openapi.json`);
  });
});

describe("GET /data/offers.json", () => {
  it("serves every offer, valid, with the licence", async () => {
    const body = await json(datasetGET());
    expect(body.offers).toHaveLength(4);
    expect(body.license).toBe(LICENSE);
    expect(body.dataset.count).toBe(4);
    expect(body.offers[0].source_url).toMatch(/^https:/);
  });
});
