import { beforeAll, describe, expect, it } from "vitest";
import { GET as fullGET } from "../app/llms-full.txt/route";
import { GET as llmsGET } from "../app/llms.txt/route";
import { buildOpenApi } from "../src/server/openapi";
import { fixtureApps } from "./helpers/apps";
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

  it("names the bank-app endpoints, the page and the MCP tool", async () => {
    const text = await llmsGET().text();
    expect(text).toContain(`](${SITE}/api/v1/apps)`);
    expect(text).toContain("GET /api/v1/apps/{id}");
    expect(text).toContain(`](${SITE}/apps)`);
    expect(text).toContain("rank_bank_apps");
    expect(text).toContain("Not a ranking of offers");
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

  it("adds a line for every ranked bank app, and none for a hidden one", async () => {
    const text = await fullGET().text();
    expect(text).toContain("## Bank apps");
    expect(text).toMatch(/\n1\. Testbank - Testbank Mobile \| score [\d.]+\/100 \|/);
    const apps = fixtureApps();
    for (const id of ["testbank-app", "oldbank-app", "smallbank-app"]) {
      const a = apps.find((x) => x.id === id)!;
      expect(text, id).toContain(`${a.bank} - ${a.app_name} | score`);
      expect(text).toContain(`verified ${a.verified_on}`);
    }
    expect(text).not.toContain("Ghostbank");
    expect(text).toContain("## Bank apps\n");
    // The methodology has a "Bank apps" section too; the table comes last.
    expect(text.lastIndexOf("## Bank apps")).toBeGreaterThan(text.indexOf("## Current offers"));
    expect(text).toContain("The score is about the app, not about the bank's offers.");
  });
});
