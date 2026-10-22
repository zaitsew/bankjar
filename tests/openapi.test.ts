import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { GET } from "../app/openapi.json/route";
import { PROFILE_PARAMS } from "../src/server/api";
import { buildOpenApi } from "../src/server/openapi";
import { json, useFixtureEnv } from "./helpers/api";

beforeAll(useFixtureEnv);

const ROOT = path.join(__dirname, "..");

/** "/api/v1/offers/{id}" -> app/api/v1/offers/[id]/route.ts */
function routeFileFor(apiPath: string): string {
  const segs = apiPath.split("/").filter(Boolean).map((s) => s.replace(/^\{(.+)\}$/, "[$1]"));
  return path.join(ROOT, "app", ...segs, "route.ts");
}

function routeFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...routeFilesUnder(full));
    else if (e.name === "route.ts") out.push(full);
  }
  return out;
}

describe("openapi.json", () => {
  const spec = buildOpenApi() as any;

  it("is OpenAPI 3.1 and served as JSON", async () => {
    const res = GET();
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await json(res);
    expect(body.openapi).toBe("3.1.0");
    expect(body.info.title).toBe("BankJar API");
    expect(body.servers[0].url).toBe("https://bankjar.test");
  });

  it("has a route file for every path", () => {
    for (const p of Object.keys(spec.paths)) {
      expect(fs.existsSync(routeFileFor(p)), `${p} -> ${routeFileFor(p)}`).toBe(true);
    }
  });

  it("documents every concrete route file under app/api/v1", () => {
    const documented = new Set(Object.keys(spec.paths).map(routeFileFor));
    const v1 = routeFilesUnder(path.join(ROOT, "app", "api", "v1")).filter((f) => !f.includes("[[..."));
    for (const f of v1) expect(documented.has(f), `${f} is not in the spec`).toBe(true);
  });

  it("documents each HTTP method that its route exports", () => {
    for (const [p, ops] of Object.entries<any>(spec.paths)) {
      const src = fs.readFileSync(routeFileFor(p), "utf8");
      for (const method of Object.keys(ops)) {
        expect(src, `${method.toUpperCase()} ${p}`).toMatch(new RegExp(`export (async )?function ${method.toUpperCase()}\\b`));
      }
    }
  });

  it("resolves every $ref", () => {
    const text = JSON.stringify(spec);
    const refs = [...text.matchAll(/"\$ref":"#\/components\/schemas\/([A-Za-z]+)"/g)].map((m) => m[1]!);
    expect(refs.length).toBeGreaterThan(10);
    for (const r of refs) expect(spec.components.schemas[r], r).toBeDefined();
  });

  it("lists the profile parameters on every ranking endpoint", () => {
    const names = PROFILE_PARAMS.map((p) => p.name);
    for (const p of ["/api/v1/search", "/api/v1/offers", "/api/v1/offers/{id}", "/api/v1/compare"]) {
      const params = spec.paths[p].get.parameters.map((x: { name: string }) => x.name);
      for (const n of names) expect(params, `${p} ${n}`).toContain(n);
    }
  });

  it("documents the bank-app endpoints and derives the BankApp schema from the zod schema", () => {
    expect(spec.paths["/api/v1/apps"].get.operationId).toBe("listBankApps");
    expect(spec.paths["/api/v1/apps"].get.parameters.map((x: { name: string }) => x.name)).toEqual(["limit"]);
    expect(spec.paths["/api/v1/apps/{id}"].get.responses["404"]).toBeDefined();
    expect(spec.components.schemas.BankApp.required).toContain("features");
    expect(spec.components.schemas.BankApp.properties.android.anyOf ?? spec.components.schemas.BankApp.properties.android.oneOf).toBeDefined();
    expect(spec.paths["/mcp"].post.description).toContain("rank_bank_apps");
    expect(spec.tags.map((t: { name: string }) => t.name)).toContain("apps");
  });

  it("derives the Offer schema from the zod schema", () => {
    expect(spec.components.schemas.Offer.required).toContain("source_url");
    expect(spec.components.schemas.Offer.properties.goal.enum).toContain("salary");
  });

  it("is the version in package.json", () => {
    expect(spec.info.version).toBe(JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version);
  });
});
