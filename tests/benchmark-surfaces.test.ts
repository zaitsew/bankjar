import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as benchmarkGET } from "../app/api/v1/benchmarks/[id]/route";
import { GET as benchmarksGET, OPTIONS as benchmarksOPTIONS } from "../app/api/v1/benchmarks/route";
import { GET as datasetGET } from "../app/data/offers.json/route";
import { GET as fullGET } from "../app/llms-full.txt/route";
import { GET as llmsGET } from "../app/llms.txt/route";
import GoalBoard from "../app/leaderboard/[goal]/page";
import { GET as mcpGET, POST as mcpPOST, DELETE as mcpDELETE } from "../app/mcp/route";
import OfferPage from "../app/offer/[id]/page";
import { GOALS } from "../src/core/schema";
import { LICENSE } from "../src/server/api";
import { BENCHMARKS_DISCLAIMER, benchmarkLine, benchmarkRows, marketStrip, vsBdeAverage } from "../src/server/benchmarks-api";
import { clearBenchmarkCache, loadBenchmarks } from "../src/server/benchmarks";
import { search } from "../src/server/search";
import { buildOpenApi } from "../src/server/openapi";
import { get, json, useFixtureEnv } from "./helpers/api";
import { BENCHMARK_FIXTURES_DIR } from "./helpers/api";
import { SITE } from "./helpers/api";

// CompareForm is a client island that needs the app router; the strip does not depend on it.
vi.mock("../components/CompareForm", () => ({ CompareForm: ({ children }: { children: unknown }) => children }));

beforeAll(() => {
  useFixtureEnv();
  // The pages read the clock through components/format; pin it to the fixtures' day.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
});
afterAll(() => {
  vi.useRealTimers();
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const ROW_KEYS = [
  "id", "country", "label", "kind", "value", "unit", "period", "published_on", "fetched_on", "source_name", "source_url",
  "api_url", "series_code", "method", "sanity", "stale_after_days", "stale",
];

describe("GET /api/v1/benchmarks", () => {
  it("returns every benchmark with the stable row shape, a stale flag and the envelope", async () => {
    const res = await benchmarksGET(get("/api/v1/benchmarks"));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
    const body = await json(res);
    expect(body.count).toBe(4);
    expect(body.benchmarks.map((b: { id: string }) => b.id)).toEqual([
      "bde-new-deposits-households-up-to-1y",
      "ecb-deposit-facility-rate",
      "es-letra-12m-average-yield",
      "ine-cpi-yoy",
    ]);
    for (const row of body.benchmarks) {
      expect(Object.keys(row).sort()).toEqual([...ROW_KEYS].sort());
      expect(row.source_url).toMatch(/^https:\/\//);
      expect(row.fetched_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof row.stale).toBe("boolean");
    }
    expect(body.dataset).toEqual({ latest_fetched_on: "2026-10-20", count: 4, version: "2026-10-20+4" });
    expect(body.disclaimer).toBe(BENCHMARKS_DISCLAIMER);
    expect(body.license).toBe(LICENSE);
  });

  it("flags only the benchmark fetched more than stale_after_days ago", async () => {
    const body = await json(await benchmarksGET(get("/api/v1/benchmarks")));
    const stale = Object.fromEntries(body.benchmarks.map((b: { id: string; stale: boolean }) => [b.id, b.stale]));
    expect(stale).toEqual({
      "bde-new-deposits-households-up-to-1y": false,
      "ecb-deposit-facility-rate": false,
      "es-letra-12m-average-yield": true,
      "ine-cpi-yoy": false,
    });
  });

  it("filters by kind and rejects a bad kind or an unknown parameter", async () => {
    const one = await json(await benchmarksGET(get("/api/v1/benchmarks?kind=cpi_yoy")));
    expect(one.benchmarks.map((b: { id: string }) => b.id)).toEqual(["ine-cpi-yoy"]);
    expect(one.count).toBe(1);
    const none = await json(await benchmarksGET(get("/api/v1/benchmarks?kind=estr")));
    expect(none.error).toBeDefined();
    expect((await benchmarksGET(get("/api/v1/benchmarks?kind=estr"))).status).toBe(400);
    expect((await benchmarksGET(get("/api/v1/benchmarks?nope=1"))).status).toBe(400);
    const empty = await json(await benchmarksGET(get("/api/v1/benchmarks?kind=overnight_rate")));
    expect(empty).toMatchObject({ count: 0, benchmarks: [] });
  });

  it("answers OPTIONS with CORS", () => {
    expect(benchmarksOPTIONS().status).toBe(204);
  });
});

describe("GET /api/v1/benchmarks/{id}", () => {
  it("returns one benchmark with the envelope", async () => {
    const res = await benchmarkGET(get("/api/v1/benchmarks/ine-cpi-yoy"), ctx("ine-cpi-yoy"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
    const body = await json(res);
    expect(body.benchmark).toMatchObject({ id: "ine-cpi-yoy", kind: "cpi_yoy", period: "2026-09", stale: false });
    expect(body.disclaimer).toBe(BENCHMARKS_DISCLAIMER);
    expect(body.dataset.count).toBe(4);
  });

  it("is a 404 that is never cached for an unknown id", async () => {
    const res = await benchmarkGET(get("/api/v1/benchmarks/ghost"), ctx("ghost"));
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("is in OpenAPI with both paths and the stale field", () => {
    const spec = buildOpenApi() as any;
    expect(spec.paths["/api/v1/benchmarks"].get.operationId).toBe("listBenchmarks");
    expect(spec.paths["/api/v1/benchmarks"].get.parameters.map((x: { name: string }) => x.name)).toEqual(["kind"]);
    expect(spec.paths["/api/v1/benchmarks/{id}"].get.responses["404"]).toBeDefined();
    expect(spec.components.schemas.Benchmark.properties.stale.type).toBe("boolean");
    expect(spec.components.schemas.Benchmark.required).toContain("stale");
    expect(spec.paths["/mcp"].post.description).toContain("get_benchmarks");
  });
});

describe("MCP get_benchmarks", () => {
  const routeFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const req = new Request(input, init);
    if (req.method === "POST") return mcpPOST(req);
    return req.method === "GET" ? mcpGET() : mcpDELETE();
  };
  let client: Client;
  beforeAll(async () => {
    client = new Client({ name: "test", version: "0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${SITE}/mcp`), { fetch: routeFetch as typeof fetch }));
  });
  afterAll(async () => {
    await client.close();
  });

  const COMMANDS = /\b(always|never|must|should|cite|tell|ask|say|do not|don't|make sure|remember|check|use|pass|give|leave|recommend|buy)\b/i;

  it("states facts with period, source and fetched date; the records are in structuredContent", async () => {
    const res = (await client.callTool({ name: "get_benchmarks", arguments: {} })) as any;
    const text: string = res.content[0].text;
    expect(text).toContain("2.29 % (period 2026-09). Source: Banco de España");
    expect(text).toContain("https://www.bde.es/");
    expect(text).toContain("Fetched 2026-10-20.");
    expect(text).toContain("(stale: fetched more than 45 days ago, the number may have changed)");
    expect(text).toContain(BENCHMARKS_DISCLAIMER);
    expect(text).not.toMatch(COMMANDS);
    expect(res.structuredContent.benchmarks).toHaveLength(4);
    expect(res.structuredContent.benchmarks.find((b: { id: string }) => b.id === "es-letra-12m-average-yield").stale).toBe(true);
    expect(JSON.parse(res.content[1].text)).toEqual(res.structuredContent);
  });

  it("takes an optional kind and rejects an unknown one", async () => {
    const one = (await client.callTool({ name: "get_benchmarks", arguments: { kind: "avg_deposit_rate" } })) as any;
    expect(one.structuredContent.benchmarks.map((b: { id: string }) => b.id)).toEqual(["bde-new-deposits-households-up-to-1y"]);
    const none = (await client.callTool({ name: "get_benchmarks", arguments: { kind: "overnight_rate" } })) as any;
    expect(none.content[0].text).toContain("No benchmarks match.");
    const bad = (await client.callTool({ name: "get_benchmarks", arguments: { kind: "mortgage" } })) as any;
    expect(bad.isError).toBe(true);
  });

  it("the instructions mention it in one sentence", () => {
    const sentences = (client.getInstructions() ?? "").split(/(?<=\.) /).filter((s) => s.includes("get_benchmarks"));
    expect(sentences).toHaveLength(1);
  });

  it("the real data files produce lines with no commands either", () => {
    const real = loadBenchmarks(path.join(__dirname, "..", "data", "benchmarks"));
    expect(real.length).toBeGreaterThan(0);
    for (const b of real) {
      const line = benchmarkLine({ ...b, stale: true });
      expect(line, b.id).not.toMatch(COMMANDS);
      expect(line).toContain(b.source_url);
      expect(line).toContain(b.fetched_on);
    }
  });
});

describe("llms.txt, llms-full.txt and /data/offers.json", () => {
  it("llms.txt lists both endpoints and the tool", async () => {
    const text = await llmsGET().text();
    expect(text).toContain(`](${SITE}/api/v1/benchmarks)`);
    expect(text).toContain("GET /api/v1/benchmarks/{id}");
    expect(text).toContain("get_benchmarks");
  });

  it("llms-full.txt has a benchmarks table with period, source and fetched date", async () => {
    const text = await fullGET().text();
    expect(text).toContain("## Market benchmarks");
    expect(text).toContain("- Average rate on new household term deposits, up to 1 year: 2.29 % (period 2026-09). Source:");
    expect(text).toContain("Fetched 2026-10-20");
    expect(text).toContain("(stale: fetched more than 45 days ago");
  });

  it("the dataset export carries the benchmarks with their stale flag", async () => {
    const body = await json(datasetGET());
    expect(body.benchmarks).toHaveLength(4);
    expect(body.benchmarks_dataset.count).toBe(4);
    expect(body.benchmarks.every((b: { stale: unknown }) => typeof b.stale === "boolean")).toBe(true);
  });
});

describe("leaderboard market strip", () => {
  const board = async (goal: string) => renderToStaticMarkup(await GoalBoard({ params: Promise.resolve({ goal }) }));

  it("savings: four values, each linked to its source, with period, fetched date and the CPI note", async () => {
    const h = await board("savings");
    expect(h).toContain('data-testid="market-context"');
    expect(h).toContain(">Market context</h2>");
    for (const b of benchmarkRows()) expect(h, b.id).toContain(`href="${b.source_url}"`);
    expect(h).toContain("BdE average, new household deposits up to 1 year");
    expect(h).toContain("Sep 2026. Banco de España, fetched <time");
    expect(h).toContain("2.29 %");
    expect(h).toContain("2.5 %");
    expect(h).toContain("auction 29 Jul 2026");
    expect(h).toContain("12-month Letra, average yield, gross");
    expect(h).toContain("3.045 %");
    expect(h).toContain("4.9 %");
    expect(h).toContain("Real return ≈ nominal − CPI, approximate.");
    expect(h).toContain("They do not change the ranking below.");
    expect(h).toContain('dateTime="2026-10-20"');
  });

  it("shows the Stale badge on the stale benchmark only", async () => {
    const h = await board("savings");
    const strip = h.match(/<section[^>]*market-context[\s\S]*?<\/section>/)![0];
    expect(strip.match(/badge badge-stale/g)).toHaveLength(1);
    const letra = h.slice(h.indexOf('data-benchmark="es-letra-12m-average-yield"'), h.indexOf('data-benchmark="ine-cpi-yoy"'));
    expect(letra).toContain("badge-stale");
    const bde = h.slice(h.indexOf('data-benchmark="bde-new'), h.indexOf('data-benchmark="ecb'));
    expect(bde).not.toContain("badge-stale");
  });

  it("deposit shows the strip too; salary, account and welcome do not", async () => {
    expect(await board("deposit")).toContain('data-testid="market-context"');
    for (const g of ["salary", "account", "welcome"]) expect(await board(g), g).not.toContain("market-context");
  });

  it("recommends nothing and compares no fees", async () => {
    const strip = (await board("savings")).match(/<section[^>]*market-context[\s\S]*?<\/section>/)![0];
    expect(strip).not.toMatch(/\b(buy|purchase|recommend|best|should|fee|fees|commission)\b/i);
  });

  it("leaves the strip out, without an error, when the data folder has no benchmarks", async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "bj-bench-"));
    process.env.BANKJAR_BENCHMARKS_DIR = empty;
    clearBenchmarkCache();
    try {
      expect(await board("savings")).not.toContain("market-context");
    } finally {
      process.env.BANKJAR_BENCHMARKS_DIR = BENCHMARK_FIXTURES_DIR;
      clearBenchmarkCache();
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("offer page: vs BdE average", () => {
  const page = async (id: string) => renderToStaticMarkup(await OfferPage({ params: Promise.resolve({ id }) }));

  it("shows the difference in percentage points as a fact, with the BdE period, date and source", async () => {
    const h = await page("testbank-saver");
    expect(h).toContain('data-testid="vs-bde"');
    expect(h).toContain("vs BdE average up to 1 year: +0.71 percentage points");
    expect(h).toContain("This offer 3% TAE; BdE average 2.29% for Sep 2026, fetched 20 Oct 2026");
    expect(h).toContain("This does not change the score or the order.");
  });

  it("is computed, not written: rate minus BdE value, two decimals, signed", () => {
    expect(vsBdeAverage(3, "2026-10-21")?.difference_points).toBe(0.71);
    expect(vsBdeAverage(2.29, "2026-10-21")?.difference_points).toBe(0);
    expect(vsBdeAverage(1.1, "2026-10-21")?.difference_points).toBe(-1.19);
    expect(vsBdeAverage(null)).toBeNull();
  });

  it("is absent for an offer without a rate", async () => {
    expect(await page("testbank-free-account")).not.toContain("vs-bde");
  });

  it("carries the Stale badge when the BdE number is stale", () => {
    const v = vsBdeAverage(3, "2027-02-01");
    expect(v?.bde.stale).toBe(true);
    expect(vsBdeAverage(3, "2026-10-21")?.bde.stale).toBe(false);
  });
});

describe("benchmarks never change a ranking", () => {
  afterEach(() => {
    process.env.BANKJAR_BENCHMARKS_DIR = BENCHMARK_FIXTURES_DIR;
    clearBenchmarkCache();
  });

  it("every goal ranks identically with the benchmarks, with none, and with extreme values", () => {
    const run = () => Object.fromEntries(GOALS.map((g) => [g, JSON.stringify(search({ overrides: { goal: g }, today: "2026-10-21" }).result)]));

    const withBenchmarks = run();

    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "bj-bench-"));
    process.env.BANKJAR_BENCHMARKS_DIR = empty;
    clearBenchmarkCache();
    const without = run();

    // A copy of the fixtures with every value pushed to the edge of its sanity range.
    const extreme = fs.mkdtempSync(path.join(os.tmpdir(), "bj-bench-"));
    fs.mkdirSync(path.join(extreme, "es"));
    for (const f of fs.readdirSync(path.join(BENCHMARK_FIXTURES_DIR, "es"))) {
      const text = fs.readFileSync(path.join(BENCHMARK_FIXTURES_DIR, "es", f), "utf8");
      const max = Number(/^  max: (.+)$/m.exec(text)![1]);
      fs.writeFileSync(path.join(extreme, "es", f), text.replace(/^value: .+$/m, `value: ${max}`));
    }
    process.env.BANKJAR_BENCHMARKS_DIR = extreme;
    clearBenchmarkCache();
    expect(benchmarkRows().every((b) => b.value === b.sanity.max)).toBe(true);
    const extremes = run();

    fs.rmSync(empty, { recursive: true, force: true });
    fs.rmSync(extreme, { recursive: true, force: true });

    expect(without).toEqual(withBenchmarks);
    expect(extremes).toEqual(withBenchmarks);
    expect(Object.keys(withBenchmarks)).toHaveLength(GOALS.length);
  });

  it("no ranking or scoring module imports a benchmark", () => {
    for (const f of ["rank.ts", "score.ts", "profile.ts", "intent.ts", "app-score.ts"]) {
      const src = fs.readFileSync(path.join(__dirname, "..", "src", "core", f), "utf8");
      expect(src, f).not.toMatch(/benchmark/i);
    }
    const search = fs.readFileSync(path.join(__dirname, "..", "src", "server", "search.ts"), "utf8");
    expect(search).not.toMatch(/benchmark/i);
  });

  it("the strip is built from benchmarks alone", () => {
    expect(marketStrip("2026-10-21").map((b) => b.id)).toHaveLength(4);
  });
});
