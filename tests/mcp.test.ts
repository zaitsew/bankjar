import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Script } from "node:vm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DELETE, GET, OPTIONS, POST } from "../app/mcp/route";
import { DISCLAIMER } from "../src/server/api";
import { MCP_INSTRUCTIONS } from "../src/server/mcp";
import { MCP_APP_MIME_TYPE, MCP_APPS_PROTOCOL_VERSION, OFFER_WIDGET_URI } from "../src/server/mcp-widget";
import pkg from "../package.json";
import { SITE, useFixtureEnv } from "./helpers/api";

beforeAll(useFixtureEnv);

// The MCP client talks to the route handler directly: no server, same bytes.
const routeFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const req = new Request(input, init);
  if (req.method === "POST") return POST(req);
  return req.method === "GET" ? GET() : DELETE();
};

let client: Client;
beforeAll(async () => {
  client = new Client({ name: "test", version: "0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${SITE}/mcp`), { fetch: routeFetch as typeof fetch }));
});
afterAll(async () => {
  await client.close();
});

function structured(res: unknown): any {
  return (res as { structuredContent: unknown }).structuredContent;
}
function texts(res: unknown): string[] {
  return (res as { content: Array<{ type: string; text: string }> }).content.map((c) => c.text);
}

describe("MCP server", () => {
  it("identifies itself with the package version and instructions", () => {
    expect(client.getServerVersion()).toMatchObject({ name: "bankjar", version: pkg.version });
    expect(client.getInstructions()).toBe(MCP_INSTRUCTIONS);
    expect(MCP_INSTRUCTIONS).toContain("source_url");
    expect(MCP_INSTRUCTIONS).toContain("verified_on");
  });

  it("lists five read-only tools with schemas", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["compare_offers", "get_offer", "list_goals", "rank_bank_apps", "search_offers"]);
    for (const t of tools) {
      expect(t.description!.length).toBeGreaterThan(60);
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(t.inputSchema.type).toBe("object");
    }
    const search = tools.find((t) => t.name === "search_offers")!;
    expect(Object.keys(search.inputSchema.properties!)).toEqual(
      expect.arrayContaining(["query", "goal", "monthly_income_eur", "balance_eur", "max_commitment_months", "residency", "gift_factor", "prefer"]),
    );
  });

  it("search_offers returns text, JSON and at most 10 rows with sources", async () => {
    const res = await client.callTool({ name: "search_offers", arguments: { query: "best salary bonus", monthly_income_eur: 2500 } });
    expect(res.isError).toBeFalsy();
    const s = structured(res);
    expect(s.goal).toBe("salary");
    expect(s.offers.length).toBeGreaterThan(0);
    expect(s.offers.length).toBeLessThanOrEqual(10);
    for (const r of s.offers) {
      expect(r.source_url).toMatch(/^https:/);
      expect(r.verified_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const [summary, raw] = texts(res);
    expect(summary).toContain(DISCLAIMER);
    expect(summary).toContain(s.offers[0].source_url);
    expect(JSON.parse(raw!).goal).toBe("salary");
  });

  it("get_offer returns the full offer, and an error result for an unknown id", async () => {
    const ok = await client.callTool({ name: "get_offer", arguments: { id: "testbank-saver", balance_eur: 20000 } });
    expect(structured(ok).full_offer.id).toBe("testbank-saver");
    expect(structured(ok).offer.score.breakdown.length).toBeGreaterThan(0);
    const bad = await client.callTool({ name: "get_offer", arguments: { id: "ghost" } });
    expect(bad.isError).toBe(true);
    expect(texts(bad)[0]).toContain("ghost");
  });

  it("compare_offers keeps order and reports missing ids", async () => {
    const res = await client.callTool({
      name: "compare_offers",
      arguments: { ids: ["testbank-saver", "testbank-payroll-cash", "ghost"], monthly_income_eur: 100 },
    });
    const s = structured(res);
    expect(s.offers.map((o: { id: string }) => o.id)).toEqual(["testbank-saver", "testbank-payroll-cash"]);
    expect(s.missing).toEqual(["ghost"]);
    expect(s.offers[1].not_eligible_reasons.length).toBeGreaterThan(0);
  });

  it("compare_offers rejects fewer than two ids", async () => {
    const res = await client.callTool({ name: "compare_offers", arguments: { ids: ["testbank-saver"] } });
    expect(res.isError).toBe(true);
  });

  it("rank_bank_apps ranks the apps with text lines, JSON and store sources", async () => {
    const res = await client.callTool({ name: "rank_bank_apps", arguments: {} });
    expect(res.isError).toBeFalsy();
    const s = structured(res);
    expect(s.apps.map((a: { id: string }) => a.id)).toEqual(["testbank-app", "oldbank-app", "smallbank-app"]);
    expect(s.total_apps).toBe(3);
    expect(s.dataset.latest_verified_on).toBe("2026-10-21");
    for (const a of s.apps) {
      expect(a.source_urls.length).toBeGreaterThan(0);
      expect(a.breakdown).toHaveLength(4);
    }
    const [summary, raw] = texts(res);
    expect(summary).toContain("Top 3 of 3 bank apps:");
    expect(summary).toContain("1. Testbank - Testbank Mobile | score ");
    expect(summary).toContain(s.apps[0].source_urls[0]);
    expect(summary).toContain("? means unknown and scores 0.");
    expect(summary).toContain(DISCLAIMER);
    expect(JSON.parse(raw!).apps).toHaveLength(3);
  });

  it("rank_bank_apps takes a limit from 1 to 50", async () => {
    const one = await client.callTool({ name: "rank_bank_apps", arguments: { limit: 1 } });
    expect(structured(one).apps).toHaveLength(1);
    expect(structured(one).total_apps).toBe(3);
    for (const limit of [0, 51, 1.5]) {
      const bad = await client.callTool({ name: "rank_bank_apps", arguments: { limit } });
      expect(bad.isError, String(limit)).toBe(true);
    }
    const { tools } = await client.listTools();
    const t = tools.find((x) => x.name === "rank_bank_apps")!;
    expect(Object.keys(t.inputSchema.properties!)).toEqual(["limit"]);
    expect(t.description).toContain("Bizum, Apple Pay, Google Pay, English UI");
  });

  it("tells the model that an app score says nothing about offers", () => {
    expect(MCP_INSTRUCTIONS).toContain("rank_bank_apps");
    expect(MCP_INSTRUCTIONS).toContain("says nothing about how good a bank's offers are");
  });

  it("list_goals lists five goals", async () => {
    const res = await client.callTool({ name: "list_goals", arguments: {} });
    expect(structured(res).goals).toHaveLength(5);
  });
});

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

describe("MCP App: offer cards", () => {
  it("annotations are unchanged: title plus the four hints on every tool", async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(5);
    for (const t of tools) expect(t.annotations, t.name).toEqual({ title: t.title, ...READ_ONLY });
    expect(Object.fromEntries(tools.map((t) => [t.name, t.annotations!.title]))).toEqual({
      search_offers: "Search Spanish bank offers",
      get_offer: "Get one bank offer",
      compare_offers: "Compare bank offers",
      list_goals: "List offer goals",
      rank_bank_apps: "Rank Spanish bank apps",
    });
  });

  it("lists one ui:// resource with the MCP App mime type", async () => {
    const { resources } = await client.listResources();
    expect(resources).toHaveLength(1);
    expect(resources[0]).toMatchObject({ uri: OFFER_WIDGET_URI, mimeType: "text/html;profile=mcp-app" });
    expect(MCP_APP_MIME_TYPE).toBe("text/html;profile=mcp-app");
    expect(OFFER_WIDGET_URI).toMatch(/^ui:\/\//);
  });

  it("search_offers and compare_offers point at the resource, the other tools do not", async () => {
    const { tools } = await client.listTools();
    for (const t of tools) {
      const meta = (t._meta ?? {}) as Record<string, any>;
      if (t.name === "search_offers" || t.name === "compare_offers") {
        expect(meta.ui.resourceUri, t.name).toBe(OFFER_WIDGET_URI);
        expect(meta["ui/resourceUri"], t.name).toBe(OFFER_WIDGET_URI);
        expect(meta["openai/outputTemplate"], t.name).toBe(OFFER_WIDGET_URI);
        for (const k of ["openai/toolInvocation/invoking", "openai/toolInvocation/invoked"]) {
          expect(meta[k].length, `${t.name} ${k}`).toBeLessThanOrEqual(64);
        }
      } else {
        expect(JSON.stringify(meta), t.name).not.toContain("ui://");
      }
    }
  });

  it("reads the HTML: no network, no third-party frames, disclaimer and bank link present", async () => {
    const read = await client.readResource({ uri: OFFER_WIDGET_URI });
    expect(read.contents).toHaveLength(1);
    const c = read.contents[0] as { uri: string; mimeType: string; text: string; _meta: Record<string, any> };
    expect(c).toMatchObject({ uri: OFFER_WIDGET_URI, mimeType: "text/html;profile=mcp-app" });
    expect(c.text.startsWith("<!doctype html>")).toBe(true);
    expect(c.text).toContain('name="color-scheme"');
    expect(c.text).toContain("Not financial advice");
    expect(c.text).toContain("Check terms at the bank");
    // The only host calls: the MCP Apps bridge and ChatGPT's openExternal.
    expect(c.text).toContain("ui/open-link");
    expect(c.text).toContain("openExternal");
    expect(c.text).toContain(MCP_APPS_PROTOCOL_VERSION);
    expect(c.text).not.toMatch(/<iframe|<link |<script[^>]*\bsrc=|https?:\/\/|fetch\(|XMLHttpRequest|innerHTML/);
    // CSP asks for nothing; the sandbox origin goes in ChatGPT's alias, not in ui.domain (Claude hashes it).
    expect(c._meta.ui.csp).toEqual({ connectDomains: [], resourceDomains: [], frameDomains: [], baseUriDomains: [] });
    expect(c._meta.ui.prefersBorder).toBe(false);
    expect(c._meta.ui.domain).toBeUndefined();
    expect(c._meta["openai/widgetDomain"]).toBe(SITE);
  });

  it("the widget script parses", async () => {
    const read = await client.readResource({ uri: OFFER_WIDGET_URI });
    const html = (read.contents[0] as { text: string }).text;
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
    expect(scripts).toHaveLength(1);
    expect(() => new Script(scripts[0]!)).not.toThrow();
  });

  it("search_offers keeps its two text blocks and adds structuredContent the widget draws", async () => {
    const res = await client.callTool({ name: "search_offers", arguments: { query: "best salary bonus", monthly_income_eur: 2500 } });
    const content = (res as { content: Array<{ type: string; text: string }> }).content;
    expect(content).toHaveLength(2);
    expect(content.every((c) => c.type === "text")).toBe(true);
    expect(content[0]!.text).toContain(DISCLAIMER);
    expect(JSON.parse(content[1]!.text)).toEqual(structured(res));
    const s = structured(res);
    expect(s).toMatchObject({ goal: "salary", disclaimer: DISCLAIMER });
    expect(typeof s.summary).toBe("string");
    expect(typeof s.total_offers).toBe("number");
    expect(s.total_offers).toBeGreaterThanOrEqual(s.offers.length);
    expect(Array.isArray(s.excluded)).toBe(true);
    expect(s.dataset.latest_verified_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Search rows have no `missing` array: that is how the widget tells a comparison from a search.
    expect(s.missing).toBeUndefined();
    for (const o of s.offers) {
      expect(typeof o.bank).toBe("string");
      expect(typeof o.product_name).toBe("string");
      expect(typeof o.headline).toBe("string");
      expect(typeof o.score.net_value_eur).toBe("number");
      expect(Array.isArray(o.score.flags)).toBe(true);
      expect(typeof o.stale).toBe("boolean");
      expect(o.requirements).toEqual(expect.objectContaining({ other: expect.any(Array) }));
      expect(o.commitment_months === null || typeof o.commitment_months === "number").toBe(true);
      expect(o.source_url).toMatch(/^https:/);
      expect(o.verified_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("compare_offers keeps its text and carries missing and not_eligible_reasons for the widget", async () => {
    const res = await client.callTool({ name: "compare_offers", arguments: { ids: ["testbank-saver", "testbank-payroll-cash", "ghost"], monthly_income_eur: 100 } });
    const content = (res as { content: Array<{ type: string; text: string }> }).content;
    expect(content).toHaveLength(2);
    expect(content[0]!.text).toContain(DISCLAIMER);
    expect(JSON.parse(content[1]!.text)).toEqual(structured(res));
    const s = structured(res);
    expect(Array.isArray(s.missing)).toBe(true);
    expect(s.disclaimer).toBe(DISCLAIMER);
    for (const o of s.offers) {
      expect(Array.isArray(o.not_eligible_reasons)).toBe(true);
      expect(typeof o.score.net_value_eur).toBe("number");
      expect(o.source_url).toMatch(/^https:/);
    }
  });
});

describe("/mcp other methods", () => {
  it("GET is a 405 that describes the server", async () => {
    const res = GET();
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toContain("POST");
    expect((await res.json()).tools).toHaveLength(5);
  });
  it("DELETE is a 405, OPTIONS a CORS preflight", () => {
    expect(DELETE().status).toBe(405);
    const pre = OPTIONS();
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-headers")).toContain("Mcp-Session-Id");
  });
  it("a POST carries CORS headers and sets no session id", async () => {
    const res = await POST(
      new Request(`${SITE}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("mcp-session-id")).toBeNull();
  });
});
