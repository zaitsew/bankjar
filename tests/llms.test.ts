import { beforeAll, describe, expect, it } from "vitest";
import { GET as fullGET } from "../app/llms-full.txt/route";
import { GET as llmsGET } from "../app/llms.txt/route";
import { buildOpenApi } from "../src/server/openapi";
import { fixtures } from "./helpers/offers";
import { SITE, useFixtureEnv } from "./helpers/api";

beforeAll(useFixtureEnv);

describe("llms.txt", () => {
  it("is plain text in llmstxt.org shape", async () => {
    const res = llmsGET();
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const text = await res.text();
    expect(text.startsWith("# BankJar\n\n> ")).toBe(true);
    expect(text).toMatch(/\n## API\n/);
    expect(text).toMatch(/\n## Data\n/);
    expect(text).toContain("](https://bankjar.test/openapi.json)");
    expect(text).toContain("source_url");
    expect(text).toContain("Not financial advice");
  });

  it("mentions every endpoint, the MCP server, the dataset and the methodology", async () => {
    const text = await llmsGET().text();
    const spec = buildOpenApi() as { paths: Record<string, unknown> };
    for (const p of Object.keys(spec.paths)) {
      if (p === "/llms.txt") continue;
      expect(text, p).toContain(p.replace("{id}", "{id}"));
    }
    expect(text).toContain(`${SITE}/mcp`);
    expect(text).toContain(`${SITE}/data/offers.json`);
    expect(text).toContain(`${SITE}/methodology`);
    expect(text).toContain("github.com/zaitsew/bankjar");
    expect(text).toContain("claude mcp add --transport http bankjar");
  });
});

describe("llms-full.txt", () => {
  it("adds the methodology and a line for every current offer", async () => {
    const res = fullGET();
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const text = await res.text();
    expect(text).toContain("# BankJar");
    expect(text).toContain("## Methodology");
    expect(text).toContain("Two numbers per offer");
    expect(text).toContain("## Current offers");
    for (const o of fixtures()) {
      expect(text, o.id).toContain(`${o.bank} - ${o.headline}`);
      expect(text).toContain(o.source_url);
      expect(text).toContain(`verified ${o.verified_on}`);
    }
    expect(text).toMatch(/net value EUR \d/);
  });
});
