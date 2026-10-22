import { beforeAll, describe, expect, it } from "vitest";
import { GET as appGET } from "../app/api/v1/apps/[id]/route";
import { GET as appsGET, OPTIONS as appsOPTIONS } from "../app/api/v1/apps/route";
import { GET as notFoundGET } from "../app/api/v1/[[...path]]/route";
import { DISCLAIMER, LICENSE } from "../src/server/api";
import { appLine, appsBody, appsDatasetVersion } from "../src/server/apps-api";
import { buildOpenApi } from "../src/server/openapi";
import { fixtureApps } from "./helpers/apps";
import { get, json, useFixtureEnv } from "./helpers/api";

beforeAll(useFixtureEnv);

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const ROW_KEYS = [
  "rank", "id", "bank", "bank_slug", "app_name", "score", "adjusted_rating", "pooled_rating", "total_ratings",
  "ios", "android", "features", "feature_sources", "breakdown", "flags", "stale", "verified_on", "source_urls",
];

describe("GET /api/v1/apps", () => {
  it("returns the ranking with the stable row shape and the envelope", async () => {
    const res = await appsGET(get("/api/v1/apps"));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
    const body = await json(res);
    expect(body.apps.map((a: { id: string }) => a.id)).toEqual(["testbank-app", "oldbank-app", "smallbank-app"]);
    expect(body.apps.map((a: { rank: number }) => a.rank)).toEqual([1, 2, 3]);
    for (const row of body.apps) {
      expect(Object.keys(row).sort()).toEqual([...ROW_KEYS].sort());
      expect(row.verified_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(row.source_urls.length).toBeGreaterThan(0);
      for (const u of row.source_urls) expect(u).toMatch(/^https:\/\//);
      expect(row.breakdown).toHaveLength(4);
    }
    expect(body.dataset).toEqual({ latest_verified_on: "2026-10-21", count: 4, version: "2026-10-21+4" });
    expect(body.count).toBe(3);
    expect(body.total_apps).toBe(3);
    expect(body.disclaimer).toBe(DISCLAIMER);
    expect(body.license).toBe(LICENSE);
  });

  it("leaves the hidden app out and sorts by score", async () => {
    const body = await json(await appsGET(get("/api/v1/apps")));
    expect(body.apps.some((a: { id: string }) => a.id === "ghostbank-app")).toBe(false);
    const scores = body.apps.map((a: { score: number }) => a.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("reports store numbers, features and their sources", async () => {
    const body = await json(await appsGET(get("/api/v1/apps")));
    const t = body.apps[0];
    expect(t.ios).toEqual({ rating: 4.7, ratings_count: 100000, updated_on: "2026-10-15", url: "https://apps.apple.com/es/app/id100000001" });
    expect(t.android.ratings_count).toBe(120000);
    expect(t.features).toEqual({ bizum: true, apple_pay: true, google_pay: false, english: true });
    expect(t.feature_sources.bizum).toBe("https://example.com/testbank/bizum");
    const small = body.apps.find((a: { id: string }) => a.id === "smallbank-app");
    expect(small.android).toBeNull();
    expect(small.features.bizum).toBeNull();
    expect(small.feature_sources.bizum).toBeNull();
    expect(small.flags).toContain("not on Google Play");
    const old = body.apps.find((a: { id: string }) => a.id === "oldbank-app");
    expect(old.stale).toBe(true);
    expect(t.stale).toBe(false);
  });

  it("applies limit, and rejects a bad one or an unknown parameter", async () => {
    const body = await json(await appsGET(get("/api/v1/apps?limit=2")));
    expect(body.apps).toHaveLength(2);
    expect(body.count).toBe(2);
    expect(body.total_apps).toBe(3);
    for (const qs of ["limit=0", "limit=51", "limit=abc", "limit=1.5", "limit=-1", "top=3"]) {
      const res = await appsGET(get(`/api/v1/apps?${qs}`));
      expect(res.status, qs).toBe(400);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect((await json(res)).issues.length).toBeGreaterThan(0);
    }
    expect((await appsGET(get("/api/v1/apps?limit="))).status).toBe(200);
  });

  it("answers the CORS preflight", () => {
    const res = appsOPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("matches the OpenAPI AppRow schema", async () => {
    const spec = buildOpenApi() as any;
    const row = spec.components.schemas.AppRow;
    expect(Object.keys(row.properties).sort()).toEqual([...ROW_KEYS].sort());
    expect([...row.required].sort()).toEqual([...ROW_KEYS].sort());
    const body = await json(await appsGET(get("/api/v1/apps")));
    expect(Object.keys(body).sort()).toEqual([...spec.components.schemas.AppsResponse.required].sort());
  });
});

describe("GET /api/v1/apps/{id}", () => {
  it("returns the row with its rank and the full data file", async () => {
    const body = await json(await appGET(get("/api/v1/apps/testbank-app"), ctx("testbank-app")));
    expect(body.app.id).toBe("testbank-app");
    expect(body.app.rank).toBe(1);
    expect(body.hidden).toBe(false);
    expect(body.full_app.ios.app_id).toBe(100000001);
    expect(body.full_app.features.bizum.source_url).toBe("https://example.com/testbank/bizum");
    expect(Object.keys(body.app).sort()).toEqual([...ROW_KEYS].sort());
    expect(body.dataset.count).toBe(4);
    expect(body.disclaimer).toBe(DISCLAIMER);
  });

  it("returns a hidden app with hidden: true and no rank, like a hidden offer", async () => {
    const res = await appGET(get("/api/v1/apps/ghostbank-app"), ctx("ghostbank-app"));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.hidden).toBe(true);
    expect(body.app.rank).toBeNull();
    expect(body.app.stale).toBe(true);
  });

  it("is a JSON 404 for an unknown id", async () => {
    const res = await appGET(get("/api/v1/apps/nope"), ctx("nope"));
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await json(res)).error).toContain("nope");
  });

  it("rejects query parameters", async () => {
    expect((await appGET(get("/api/v1/apps/testbank-app?x=1"), ctx("testbank-app"))).status).toBe(400);
  });
});

describe("services", () => {
  it("builds the dataset version from the app files", () => {
    expect(appsDatasetVersion(fixtureApps())).toEqual({ latest_verified_on: "2026-10-21", count: 4, version: "2026-10-21+4" });
    expect(appsDatasetVersion([])).toEqual({ latest_verified_on: null, count: 0, version: "empty+0" });
  });

  it("writes one text line per app with the score, both stores, features and sources", () => {
    const [first] = appsBody().apps;
    const text = appLine(first!);
    expect(text).toContain("1. Testbank - Testbank Mobile");
    expect(text).toContain("score ");
    expect(text).toContain("App Store 4.70 (100,000 ratings, release 2026-10-15)");
    expect(text).toContain("Bizum yes, Apple Pay yes, Google Pay no, English yes");
    expect(text).toContain("verified 2026-10-21");
    expect(text).toContain("https://apps.apple.com/es/app/id100000001 https://play.google.com/");
    const small = appsBody().apps.find((a) => a.id === "smallbank-app")!;
    expect(appLine(small)).toContain("Google Play none");
    expect(appLine(small)).toContain("Bizum ?");
  });
});

describe("unknown routes under /api/v1", () => {
  it("list the apps endpoints in the JSON 404", async () => {
    const body = await json(await notFoundGET(get("/api/v1/apps/x/y")));
    expect(body.endpoints).toContain("/api/v1/apps");
    expect(body.endpoints).toContain("/api/v1/apps/{id}");
  });
});
