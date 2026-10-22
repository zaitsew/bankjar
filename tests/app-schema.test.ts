import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppSchema } from "../src/core/app-schema";
import { DataError } from "../src/server/data";
import { loadApps } from "../src/server/apps";
import { APP_FIXTURES_DIR, fixtureApps } from "./helpers/apps";

function raw(): Record<string, any> {
  return structuredClone(fixtureApps().find((a) => a.id === "testbank-app")) as Record<string, any>;
}

describe("AppSchema", () => {
  it("accepts every fixture", () => {
    for (const f of fixtureApps()) expect(AppSchema.safeParse(f).success).toBe(true);
  });

  it("rejects an app with neither store", () => {
    const r = raw();
    r.ios = null;
    r.android = null;
    const res = AppSchema.safeParse(r);
    expect(res.success).toBe(false);
    expect(res.error!.issues.map((i) => i.message).join()).toContain("at least one store");
  });

  it("rejects a known feature value without a source_url, and accepts an unknown one without", () => {
    const r = raw();
    r.features.bizum = { value: true, source_url: null };
    const res = AppSchema.safeParse(r);
    expect(res.success).toBe(false);
    expect(res.error!.issues.map((i) => i.message).join()).toContain("needs a source_url");
    r.features.bizum = { value: null, source_url: null };
    expect(AppSchema.safeParse(r).success).toBe(true);
    r.features.bizum = { value: false, source_url: "https://example.com/bizum" };
    expect(AppSchema.safeParse(r).success).toBe(true);
  });

  it.each([
    ["package without a dot", { package: "testbank" }],
    ["package with a space", { package: "com.example test" }],
    ["package starting with a digit", { package: "1com.example.app" }],
    ["empty package", { package: "" }],
  ])("rejects a bad Android package: %s", (_name, patch) => {
    const r = raw();
    Object.assign(r.android, patch);
    const res = AppSchema.safeParse(r);
    expect(res.success).toBe(false);
    expect(res.error!.issues.some((i) => i.path.join(".") === "android.package")).toBe(true);
  });

  it.each([
    ["id not kebab", (r: any) => (r.id = "Bad_Id")],
    ["country lower case", (r: any) => (r.country = "es")],
    ["rating above 5", (r: any) => (r.ios.rating = 5.1)],
    ["negative rating count", (r: any) => (r.ios.ratings_count = -1)],
    ["fractional rating count", (r: any) => (r.android.ratings_count = 1.5)],
    ["lower-case language", (r: any) => (r.ios.languages = ["en"])],
    ["store url not a url", (r: any) => (r.ios.url = "apps.apple.com")],
    ["release date not ISO", (r: any) => (r.ios.updated_on = "21/10/2026")],
    ["verified_on not a real date", (r: any) => (r.verified_on = "2026-02-31")],
    ["missing features", (r: any) => delete r.features.google_pay],
  ])("rejects: %s", (_name, mutate) => {
    const r = raw();
    mutate(r);
    expect(AppSchema.safeParse(r).success).toBe(false);
  });
});

const tmp: string[] = [];
afterEach(() => {
  for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function tmpDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bankjar-apps-"));
  tmp.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  return dir;
}
const good = fs.readFileSync(path.join(APP_FIXTURES_DIR, "es", "testbank-app.yaml"), "utf8");

describe("loadApps", () => {
  it("loads and sorts the fixtures", () => {
    expect(fixtureApps().map((a) => a.id)).toEqual(["ghostbank-app", "oldbank-app", "smallbank-app", "testbank-app"]);
  });

  it("tolerates an empty and a missing folder", () => {
    expect(loadApps(tmpDir({ "es/.gitkeep": "" }))).toEqual([]);
    expect(loadApps(path.join(os.tmpdir(), "bankjar-apps-missing"))).toEqual([]);
  });

  it("names the file and the field of a bad app", () => {
    const dir = tmpDir({ "es/testbank-app.yaml": good.replace("android:\n  package: com.example.testbank", "android:\n  package: nodots") });
    try {
      loadApps(dir);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DataError);
      expect((e as DataError).message).toContain("testbank-app.yaml");
      expect((e as DataError).message).toContain("android.package");
    }
  });

  it("requires the id to match the file name and the country to match the folder", () => {
    expect(() => loadApps(tmpDir({ "es/other.yaml": good }))).toThrow(/must equal the file name/);
    expect(() => loadApps(tmpDir({ "fr/testbank-app.yaml": good }))).toThrow(/does not match the folder/);
  });

  it("reports a YAML syntax error", () => {
    expect(() => loadApps(tmpDir({ "es/x.yaml": "id: [unclosed" }))).toThrow(/YAML syntax error/);
  });
});
