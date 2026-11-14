import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { GET as offerGET } from "../app/api/v1/offers/[id]/route";
import { GET as datasetGET } from "../app/data/offers.json/route";
import { IssuerSchema, type Issuer } from "../src/core/issuer-schema";
import { loadOffers, loadOffers as loadAllOffers } from "../src/server/data";
import { clearIssuerCache, guaranteeLine, issuerGuarantee, loadIssuers, missingIssuers } from "../src/server/issuers";
import { compareBody, offersBody, searchBody } from "../src/server/api";
import { buildOpenApi } from "../src/server/openapi";
import { llmsTxt } from "../src/server/llms";
import { createMcpServer } from "../src/server/mcp";
import { ISSUER_FIXTURES_DIR } from "./helpers/offers";
import { get, json, useFixtureEnv } from "./helpers/api";

const REAL_OFFERS = path.join(process.cwd(), "data", "offers");
const REAL_ISSUERS = path.join(process.cwd(), "data", "issuers");

const tmp: string[] = [];
afterEach(() => {
  useFixtureEnv();
  for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
beforeAll(useFixtureEnv);

function tmpDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bankjar-issuers-"));
  tmp.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  return dir;
}

const valid: Issuer = {
  bank_slug: "alpha",
  legal_entity: "Alpha Bank, S.A.",
  country_of_licence: "ES",
  scheme_name: "Fondo de Garantía de Depósitos de Entidades de Crédito (FGD)",
  scheme_country: "ES",
  cover_eur: 100000,
  cover_basis: "per depositor per credit institution",
  brand_aliases: [],
  source_url: "https://example.test/alpha",
  verified_on: "2026-11-14",
  notes: null,
};

describe("IssuerSchema", () => {
  it("accepts a complete record", () => {
    expect(IssuerSchema.safeParse(valid).success).toBe(true);
  });
  it("accepts a null scheme when the source does not name one", () => {
    expect(IssuerSchema.safeParse({ ...valid, scheme_name: null, scheme_country: null }).success).toBe(true);
  });
  it("rejects a bad country, a zero cover, a bad date and a missing source", () => {
    expect(IssuerSchema.safeParse({ ...valid, country_of_licence: "es" }).success).toBe(false);
    expect(IssuerSchema.safeParse({ ...valid, cover_eur: 0 }).success).toBe(false);
    expect(IssuerSchema.safeParse({ ...valid, verified_on: "2026-13-40" }).success).toBe(false);
    expect(IssuerSchema.safeParse({ ...valid, source_url: "not a url" }).success).toBe(false);
    const { source_url: _omit, ...rest } = valid;
    expect(IssuerSchema.safeParse(rest).success).toBe(false);
  });
});

describe("loadIssuers", () => {
  it("rejects a file whose bank_slug differs from its name", () => {
    const dir = tmpDir({ "es/beta.yaml": fs.readFileSync(path.join(ISSUER_FIXTURES_DIR, "es", "testbank.yaml"), "utf8") });
    expect(() => loadIssuers(dir)).toThrow(/must equal the file name "beta"/);
  });
  it("gives [] for a missing folder", () => {
    expect(loadIssuers(path.join(os.tmpdir(), "bankjar-no-such-dir"))).toEqual([]);
  });
});

describe("the real dataset", () => {
  it("has an issuer file for every bank_slug in data/offers", () => {
    const offers = loadOffers(REAL_OFFERS);
    const issuers = loadIssuers(REAL_ISSUERS);
    expect(missingIssuers(offers, issuers)).toEqual([]);
  });
  it("has no issuer file that no offer uses", () => {
    const slugs = new Set(loadAllOffers(REAL_OFFERS).map((o) => o.bank_slug));
    expect(loadIssuers(REAL_ISSUERS).filter((i) => !slugs.has(i.bank_slug)).map((i) => i.bank_slug)).toEqual([]);
  });
  it("gives every issuer a source, a date and either a named scheme or a note saying why not", () => {
    for (const i of loadIssuers(REAL_ISSUERS)) {
      expect(i.source_url).toMatch(/^https:/);
      expect(i.verified_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (i.scheme_name === null) expect(i.notes, i.bank_slug).toBeTruthy();
    }
  });
  it("detects a missing issuer", () => {
    const offers = loadOffers(REAL_OFFERS);
    const issuers = loadIssuers(REAL_ISSUERS).filter((i) => i.bank_slug !== "bbva");
    expect(missingIssuers(offers, issuers)).toEqual(["bbva"]);
  });
  it("marks ABANCA and B100 as one cap and Openbank as separate from Santander", () => {
    const offers = loadOffers(REAL_OFFERS);
    const issuers = loadIssuers(REAL_ISSUERS);
    const abanca = issuerGuarantee("abanca", issuers, offers);
    expect(abanca?.shared_cap_with.map((s) => s.bank_slug)).toEqual(["b100"]);
    expect(issuerGuarantee("b100", issuers, offers)?.shared_cap_with.map((s) => s.bank_slug)).toEqual(["abanca"]);
    expect(issuerGuarantee("openbank", issuers, offers)?.shared_cap_with).toEqual([]);
    expect(issuerGuarantee("santander", issuers, offers)?.shared_cap_with).toEqual([]);
  });
});

describe("issuerGuarantee", () => {
  it("returns null for a bank with no issuer file", () => {
    expect(issuerGuarantee("nobody", [], [])).toBeNull();
  });
  it("states the facts in one sentence, with the shared cap", () => {
    const g = issuerGuarantee("testbank");
    expect(g).not.toBeNull();
    expect(guaranteeLine(g!)).toBe(
      "Deposit guarantee: Fondo de Garantía de Depósitos de Entidades de Crédito (FGD) (ES), EUR 100,000 per depositor per credit institution, deposits held at Testbank, S.A..",
    );
    expect(guaranteeLine({ ...g!, scheme_name: null, scheme_country: null, shared_cap_with: [{ bank_slug: "x", bank: "X" }] })).toContain("scheme not confirmed");
  });
});

describe("API field shape", () => {
  const KEYS = ["brand_aliases", "cover_basis", "cover_eur", "country_of_licence", "legal_entity", "notes", "scheme_country", "scheme_name", "shared_cap_with", "source_url", "verified_on"].sort();

  it("puts issuer_guarantee on /api/v1/offers/{id}", async () => {
    const body = await json(await offerGET(get("/api/v1/offers/testbank-payroll-cash"), { params: Promise.resolve({ id: "testbank-payroll-cash" }) }));
    expect(Object.keys(body.offer.issuer_guarantee).sort()).toEqual(KEYS);
    expect(body.offer.issuer_guarantee.cover_eur).toBe(100000);
    expect(body.offer.issuer_guarantee.shared_cap_with).toEqual([]);
  });
  it("puts it on ranked rows and compare rows", () => {
    const ranked = offersBody({ goal: "salary" }).offers ?? [];
    expect(ranked.length).toBeGreaterThan(0);
    for (const r of ranked) expect(Object.keys(r.issuer_guarantee ?? {}).sort()).toEqual(KEYS);
    for (const r of compareBody(["testbank-payroll-cash", "testbank-saver"]).offers) expect(r.issuer_guarantee?.legal_entity).toBe("Testbank, S.A.");
  });
  it("is null when no issuer file exists", () => {
    process.env.BANKJAR_ISSUERS_DIR = tmpDir({});
    clearIssuerCache();
    for (const r of offersBody({ goal: "salary" }).offers ?? []) expect(r.issuer_guarantee).toBeNull();
  });
  it("is in /data/offers.json as issuers", async () => {
    const body = await json(datasetGET());
    expect(body.issuers.map((i: { bank_slug: string }) => i.bank_slug)).toEqual(["testbank"]);
  });
  it("is described in OpenAPI and llms.txt", () => {
    const doc = buildOpenApi() as any;
    expect(doc.components.schemas.OfferRow.required).toContain("issuer_guarantee");
    expect(doc.components.schemas.IssuerGuarantee.required.sort()).toEqual(KEYS);
    expect(llmsTxt()).toContain("issuer_guarantee");
  });
});

describe("MCP", () => {
  it("states the guarantee as a fact in get_offer text and carries the object as data", async () => {
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const [a, b] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer();
    await server.connect(b);
    const client = new Client({ name: "t", version: "1" });
    await client.connect(a);
    const res: any = await client.callTool({ name: "get_offer", arguments: { id: "testbank-payroll-cash" } });
    expect(res.content[0].text).toContain("Deposit guarantee:");
    expect(res.structuredContent.offer.issuer_guarantee.legal_entity).toBe("Testbank, S.A.");
    const cmp: any = await client.callTool({ name: "compare_offers", arguments: { ids: ["testbank-payroll-cash", "testbank-saver"] } });
    expect(cmp.content[0].text).toContain("Deposit guarantee:");
    expect(cmp.structuredContent.offers[0].issuer_guarantee.cover_eur).toBe(100000);
    await client.close();
  });
});

describe("rankings do not depend on issuer data", () => {
  const strip = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (k, x) => (k === "issuer_guarantee" ? undefined : x)));

  it("gives identical order and scores with and without issuer files, on the real dataset", () => {
    process.env.BANKJAR_OFFERS_DIR = REAL_OFFERS;
    process.env.BANKJAR_ISSUERS_DIR = REAL_ISSUERS;
    process.env.BANKJAR_TODAY = "2026-11-14";
    clearIssuerCache();
    const withIssuers = { all: offersBody({}), search: searchBody("best salary bonus for 2500 a month") };
    expect(withIssuers.all.goals?.salary?.offers?.[0]?.issuer_guarantee).not.toBeNull();

    process.env.BANKJAR_ISSUERS_DIR = tmpDir({});
    clearIssuerCache();
    const without = { all: offersBody({}), search: searchBody("best salary bonus for 2500 a month") };
    expect(without.all.goals?.salary?.offers?.[0]?.issuer_guarantee).toBeNull();

    expect(strip(without.all)).toEqual(strip(withIssuers.all));
    expect(strip(without.search)).toEqual(strip(withIssuers.search));
    const ids = (b: typeof withIssuers) => Object.values(b.all.goals ?? {}).map((g) => g.offers.map((o) => `${o.id}:${o.score.net_value_eur}`));
    expect(ids(without)).toEqual(ids(withIssuers));
  });
});
