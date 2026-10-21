import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as searchGET } from "../app/api/v1/search/route";
import { POST as mcpPOST } from "../app/mcp/route";
import { parseIntent, type Intent } from "../src/core/intent";
import { AI_TOOL, aiEnabled, intentFromArguments, mergeIntents, parseIntentWithAI } from "../src/server/ai";
import { createLruCache, normalizeQuery } from "../src/server/cache";
import { aiLimiter, clientIp, createLimiter, visitorId } from "../src/server/ratelimit";
import { intentCache, searchAsync } from "../src/server/search";
import { SITE, get, json, useFixtureEnv } from "./helpers/api";

beforeAll(useFixtureEnv);

const KEY = "test-service-token";

function completion(args: unknown, name = AI_TOOL): Response {
  const argumentsText = typeof args === "string" ? args : JSON.stringify(args);
  return new Response(
    JSON.stringify({ choices: [{ message: { tool_calls: [{ id: "c1", type: "function", function: { name, arguments: argumentsText } }] } }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function errorBody(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json" } });
}

let fetchMock: ReturnType<typeof vi.fn>;
const savedEnv = { ...process.env };

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  process.env.ACCOUNTS_SERVICE_BANKJAR = KEY;
  delete process.env.BANKJAR_AI;
  delete process.env.ACCOUNTS_URL;
  intentCache.clear();
  aiLimiter.reset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...savedEnv };
});

// A question the rule parser cannot place: no goal word at all.
const VAGUE = "quiero sacar partido a mi dinero";
const IP = "203.0.113.7";
/** A distinct question per index that adds no digit for the rules to read. */
const variant = (i: number) => `${VAGUE} ${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`;

describe("aiEnabled", () => {
  it("needs the service token and BANKJAR_AI not off", () => {
    expect(aiEnabled({ ACCOUNTS_SERVICE_BANKJAR: "x" })).toBe(true);
    expect(aiEnabled({})).toBe(false);
    expect(aiEnabled({ ACCOUNTS_SERVICE_BANKJAR: "  " })).toBe(false);
    expect(aiEnabled({ ACCOUNTS_SERVICE_BANKJAR: "x", BANKJAR_AI: "off" })).toBe(false);
    expect(aiEnabled({ ACCOUNTS_SERVICE_BANKJAR: "x", BANKJAR_AI: "OFF" })).toBe(false);
  });
});

describe("parseIntentWithAI", () => {
  it("sends the hub request and turns the tool call into an Intent", async () => {
    fetchMock.mockResolvedValue(
      completion({ goal: "savings", balance_eur: 15000, max_commitment_months: 0, residency: "non_resident", confidence: 0.9 }),
    );
    const intent = await parseIntentWithAI("best savings for 15k, no lock-in, I am a non-resident", { visitorId: "abc123" });
    expect(intent).toMatchObject({
      goal: "savings",
      confidence: 0.9,
      profile: { goal: "savings", balance_eur: 15000, max_commitment_months: 0, residency: "non_resident" },
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://swgxlydagofazjtlqeiu.supabase.co/functions/v1/ai");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "x-accounts-service": KEY,
      "x-accounts-product": "bankjar",
      "x-accounts-external-user": "abc123",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      product: "bankjar",
      model: "claude-haiku-5-5",
      fallback: [],
      max_tokens: 400,
      tool_choice: { type: "function", function: { name: "set_search_filters" } },
    });
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user"]);
    expect(body.messages[1].content).toContain("non-resident");
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].function.name).toBe("set_search_filters");
    expect(Object.keys(body.tools[0].function.parameters.properties)).toEqual(
      expect.arrayContaining(["goal", "monthly_income_eur", "balance_eur", "max_commitment_months", "residency", "existing_customer_of", "gift_factor", "prefer", "confidence"]),
    );
  });

  it("uses ACCOUNTS_URL when set", async () => {
    process.env.ACCOUNTS_URL = "https://hub.test/";
    fetchMock.mockImplementation(async () => completion({ goal: "account" }));
    await parseIntentWithAI("x", { visitorId: "v" });
    expect(fetchMock.mock.calls[0]![0]).toBe("https://hub.test/functions/v1/ai");
  });

  it("returns null without calling the hub when there is no key", async () => {
    delete process.env.ACCOUNTS_SERVICE_BANKJAR;
    expect(await parseIntentWithAI("anything", { visitorId: "v" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [402, "budget_exhausted"],
    [429, "rate_limited"],
    [500, "internal"],
  ])("returns null on a %s", async (status, error) => {
    fetchMock.mockImplementation(async () => errorBody(status, error));
    expect(await parseIntentWithAI("anything", { visitorId: "v" })).toBeNull();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(console.warn).mock.calls[0]![0])).toContain(String(status));
  });

  it("returns null when the call exceeds the timeout", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener("abort", () => reject(init.signal!.reason));
        }),
    );
    const started = Date.now();
    expect(await parseIntentWithAI("anything", { visitorId: "v", timeoutMs: 30 })).toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
    expect(String(vi.mocked(console.warn).mock.calls[0]![0])).toContain("timeout");
  });

  it("returns null on a network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await parseIntentWithAI("anything", { visitorId: "v" })).toBeNull();
  });

  it.each([
    ["arguments that are not JSON", "{not json"],
    ["a goal outside the enum", JSON.stringify({ goal: "mortgage" })],
    ["a negative balance", JSON.stringify({ balance_eur: -5 })],
    ["arguments that are not an object", JSON.stringify([1, 2])],
  ])("returns null for %s", async (_label, args) => {
    fetchMock.mockImplementation(async () => completion(args));
    expect(await parseIntentWithAI("anything", { visitorId: "v" })).toBeNull();
  });

  it("returns null when the answer has no tool call or the wrong tool", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "hello" } }] })));
    expect(await parseIntentWithAI("anything", { visitorId: "v" })).toBeNull();
    fetchMock.mockResolvedValueOnce(completion({ goal: "salary" }, "other_tool"));
    expect(await parseIntentWithAI("anything", { visitorId: "v" })).toBeNull();
  });
});

describe("intentFromArguments", () => {
  it("clamps gift_factor, rounds months and drops nulls, unknowns and defaults", () => {
    const intent = intentFromArguments({
      goal: "deposit",
      gift_factor: 7,
      max_commitment_months: 11.6,
      residency: "unknown",
      prefer: "any",
      monthly_income_eur: null,
      existing_customer_of: ["BBVA", "not a slug!", "bbva", "ing"],
      confidence: 3,
    })!;
    expect(intent.profile).toEqual({
      goal: "deposit",
      gift_factor: 1,
      max_commitment_months: 12,
      existing_customer_of: ["bbva", "ing"],
    });
    expect(intent.confidence).toBe(1);
    expect(intentFromArguments({ gift_factor: -2 })!.profile.gift_factor).toBe(0);
  });

  it("leaves unknown fields out and gives an empty answer zero confidence", () => {
    expect(intentFromArguments({})).toEqual({ goal: null, profile: {}, confidence: 0, matched: [] });
  });
});

describe("mergeIntents", () => {
  const ai = (goal: Intent["goal"], profile: Intent["profile"], confidence = 0.9): Intent => ({
    goal,
    profile: { ...(goal ? { goal } : {}), ...profile },
    confidence,
    matched: [],
  });

  it("lets the AI fill gaps and keeps the rule value when the rules are confident", () => {
    const rules = parseIntent("salary bonus, I earn 2500 a month, no commitment");
    expect(rules.confidence).toBeGreaterThanOrEqual(0.6);
    const { intent, parser } = mergeIntents(rules, ai("savings", { monthly_income_eur: 9999, residency: "resident" }));
    expect(parser).toBe("rules+ai");
    expect(intent.goal).toBe("salary");
    expect(intent.profile.monthly_income_eur).toBe(2500);
    expect(intent.profile.residency).toBe("resident");
    expect(intent.matched).toContain("ai:residency:resident");
  });

  it("lets the AI win when the rule confidence is below 0.6", () => {
    const rules = parseIntent("account for 3000 euros");
    expect(rules.confidence).toBeLessThan(0.6);
    expect(rules.goal).toBe("account");
    const { intent, parser } = mergeIntents(rules, ai("savings", { balance_eur: 8000 }));
    expect(parser).toBe("rules+ai");
    expect(intent.goal).toBe("savings");
    expect(intent.profile.goal).toBe("savings");
    expect(intent.profile.balance_eur).toBe(8000);
  });

  it('names the parser "ai" when the rules found nothing', () => {
    const rules = parseIntent(VAGUE);
    expect(rules).toMatchObject({ goal: null, confidence: 0, profile: {} });
    const { intent, parser } = mergeIntents(rules, ai("deposit", { balance_eur: 5000 }));
    expect(parser).toBe("ai");
    expect(intent.goal).toBe("deposit");
  });

  it('stays "rules" when the AI adds nothing new', () => {
    const rules = parseIntent("best salary bonus for 2500 a month");
    const { intent, parser } = mergeIntents(rules, ai("salary", { monthly_income_eur: 2500 }));
    expect(parser).toBe("rules");
    expect(intent).toBe(rules);
  });
});

describe("LRU cache", () => {
  it("evicts the least recently used entry past the maximum", () => {
    const c = createLruCache<number>(2, 1000);
    c.set("a", 1);
    c.set("b", 2);
    c.get("a");
    c.set("c", 3);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe(1);
    expect(c.get("c")).toBe(3);
    expect(c.size).toBe(2);
  });

  it("expires entries after the TTL", () => {
    let t = 0;
    const c = createLruCache<number>(5, 100, () => t);
    c.set("a", 1);
    t = 99;
    expect(c.get("a")).toBe(1);
    t = 100;
    expect(c.get("a")).toBeUndefined();
  });

  it("normalises case and spacing in the key", () => {
    expect(normalizeQuery("  Best   SAVINGS\taccount ")).toBe("best savings account");
  });
});

describe("rate limit and visitor id", () => {
  it("allows 20 per key per window, then refuses until the window rolls", () => {
    let t = 0;
    const l = createLimiter({ perKey: 20, global: 600, windowMs: 3_600_000, now: () => t });
    for (let i = 0; i < 20; i++) expect(l.take("ip-a")).toBe(true);
    expect(l.take("ip-a")).toBe(false);
    expect(l.take("ip-b")).toBe(true);
    t = 3_600_000;
    expect(l.take("ip-a")).toBe(true);
  });

  it("caps the global total and does not count refused calls", () => {
    const l = createLimiter({ perKey: 10, global: 3, windowMs: 1000, now: () => 0 });
    expect(l.take("a")).toBe(true);
    expect(l.take("b")).toBe(true);
    expect(l.take("c")).toBe(true);
    expect(l.take("d")).toBe(false);
  });

  it("takes the first hop of x-forwarded-for, then x-real-ip", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": " 1.2.3.4 , 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });

  it("hashes the address into 16 hex characters that change by day and salt", () => {
    const day1 = visitorId("203.0.113.7", new Date("2026-10-21T10:00:00Z"));
    expect(day1).toMatch(/^[0-9a-f]{16}$/);
    expect(day1).not.toContain("203");
    expect(day1).toBe(visitorId("203.0.113.7", new Date("2026-10-21T23:00:00Z")));
    expect(day1).not.toBe(visitorId("203.0.113.7", new Date("2026-10-22T10:00:00Z")));
    expect(day1).not.toBe(visitorId("203.0.113.8", new Date("2026-10-21T10:00:00Z")));
    process.env.BANKJAR_VISITOR_SALT = "pepper";
    expect(day1).not.toBe(visitorId("203.0.113.7", new Date("2026-10-21T10:00:00Z")));
  });
});

describe("searchAsync", () => {
  it("answers with the rules and never calls the hub when there is no key", async () => {
    delete process.env.ACCOUNTS_SERVICE_BANKJAR;
    const r = await searchAsync({ q: VAGUE }, { ip: IP });
    expect(r.parser).toBe("rules");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never calls the hub when BANKJAR_AI is off", async () => {
    process.env.BANKJAR_AI = "off";
    expect((await searchAsync({ q: VAGUE }, { ip: IP })).parser).toBe("rules");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not ask the AI for an empty query or a confident rule result", async () => {
    await searchAsync({ q: "" }, { ip: IP });
    await searchAsync({ q: "salary bonus, I earn 2500 a month" }, { ip: IP });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the AI for a question the rules cannot place and reports parser "ai"', async () => {
    fetchMock.mockImplementation(async () => completion({ goal: "deposit", balance_eur: 20000, max_commitment_months: 12, confidence: 0.8 }));
    const r = await searchAsync({ q: VAGUE }, { ip: IP });
    expect(r.parser).toBe("ai");
    expect(r.goal).toBe("deposit");
    expect(r.profile.balance_eur).toBe(20000);
    expect(r.profile.max_commitment_months).toBe(12);
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(fetchMock.mock.calls[0]![1].headers["x-accounts-external-user"]).toBe(visitorId(IP));
    expect(JSON.stringify(fetchMock.mock.calls[0])).not.toContain(IP);
    expect(sent.messages[1].content).toBe(VAGUE);
  });

  it("lets explicit overrides win over both parsers", async () => {
    fetchMock.mockImplementation(async () => completion({ goal: "deposit", balance_eur: 20000 }));
    const r = await searchAsync({ q: VAGUE, overrides: { goal: "salary", balance_eur: 1234 } }, { ip: IP });
    expect(r.parser).toBe("ai");
    expect(r.goal).toBe("salary");
    expect(r.profile.balance_eur).toBe(1234);
  });

  it("serves a repeated question from the cache without calling the hub again", async () => {
    fetchMock.mockImplementation(async () => completion({ goal: "savings" }));
    const first = await searchAsync({ q: VAGUE }, { ip: IP });
    const second = await searchAsync({ q: `  ${VAGUE.toUpperCase()} ` }, { ip: "198.51.100.9" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.goal).toBe("savings");
    expect(second.goal).toBe("savings");
    expect(second.parser).toBe("ai");
  });

  it("does not cache a failed call", async () => {
    fetchMock.mockResolvedValueOnce(errorBody(402, "budget_exhausted")).mockResolvedValueOnce(completion({ goal: "savings" }));
    expect((await searchAsync({ q: VAGUE }, { ip: IP })).parser).toBe("rules");
    expect((await searchAsync({ q: VAGUE }, { ip: IP })).parser).toBe("ai");
  });

  it("falls back to the rules, without an error, once an IP passes 20 AI calls an hour", async () => {
    fetchMock.mockImplementation(async () => completion({ goal: "savings" }));
    for (let i = 0; i < 20; i++) {
      expect((await searchAsync({ q: variant(i) }, { ip: IP })).parser).toBe("ai");
    }
    expect(fetchMock).toHaveBeenCalledTimes(20);
    const over = await searchAsync({ q: variant(60) }, { ip: IP });
    expect(over.parser).toBe("rules");
    expect(over.result).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(20);
    // Another address is not affected, and a cache hit still works for the limited one.
    expect((await searchAsync({ q: variant(61) }, { ip: "198.51.100.1" })).parser).toBe("ai");
    expect((await searchAsync({ q: variant(3) }, { ip: IP })).parser).toBe("ai");
  });

  it("keeps the table numbers from the data, not from the AI", async () => {
    fetchMock.mockImplementation(async () => completion({ goal: "salary", monthly_income_eur: 3000, summary: "Bank X pays 9999 EUR" }));
    const r = await searchAsync({ q: VAGUE }, { ip: IP });
    expect(r.summary).not.toContain("9999");
    for (const row of r.result.ranked) expect(row.score.net_value_eur).toBeLessThan(5000);
  });
});

describe("GET /api/v1/search with the AI on", () => {
  it('reports parser "ai" and uses the forwarded address for the limiter', async () => {
    fetchMock.mockImplementation(async () => completion({ goal: "account", residency: "non_resident" }));
    const req = new Request(`https://bankjar.test/api/v1/search?q=${encodeURIComponent(VAGUE)}`, {
      headers: { "x-forwarded-for": "192.0.2.55, 10.0.0.1" },
    });
    const body = await json(await searchGET(req));
    expect(body.parser).toBe("ai");
    expect(body.goal).toBe("account");
    expect(body.profile.residency).toBe("non_resident");
    expect(fetchMock.mock.calls[0]![1].headers["x-accounts-external-user"]).toBe(visitorId("192.0.2.55"));
  });

  it("still answers with the rules when the hub is down", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const res = await searchGET(get(`/api/v1/search?q=${encodeURIComponent(VAGUE)}`));
    expect(res.status).toBe(200);
    expect((await json(res)).parser).toBe("rules");
  });
});

describe("MCP search_offers with the AI on", () => {
  it("uses the AI step and the caller's address", async () => {
    const realFetch = fetchMock;
    // The MCP client talks to the route handler directly; only the hub call goes to the mock.
    const routeFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> =>
      mcpPOST(new Request(input, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), "x-forwarded-for": "192.0.2.77" } }));
    realFetch.mockImplementation(async () => completion({ goal: "deposit", balance_eur: 20000 }));
    const client = new Client({ name: "test", version: "0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${SITE}/mcp`), { fetch: routeFetch as typeof fetch }));
    try {
      const res = await client.callTool({ name: "search_offers", arguments: { query: VAGUE } });
      const body = (res as { structuredContent: { parser: string; goal: string } }).structuredContent;
      expect(body).toMatchObject({ parser: "ai", goal: "deposit" });
      const hubCall = realFetch.mock.calls.find((c) => String(c[0]).endsWith("/functions/v1/ai"));
      expect(hubCall![1].headers["x-accounts-external-user"]).toBe(visitorId("192.0.2.77"));
    } finally {
      await client.close();
    }
  });
});
