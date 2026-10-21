import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DataError, datasetVersion, loadOffers } from "../src/server/data";
import { FIXTURES_DIR } from "./helpers/offers";

const tmp: string[] = [];
function tmpData(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bankjar-"));
  tmp.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  return dir;
}
afterEach(() => {
  for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const good = fs.readFileSync(path.join(FIXTURES_DIR, "es", "testbank-saver.yaml"), "utf8");

describe("loadOffers", () => {
  it("loads and sorts the fixtures", () => {
    const offers = loadOffers(FIXTURES_DIR);
    expect(offers.map((o) => o.id)).toEqual([
      "testbank-free-account",
      "testbank-payroll-cash",
      "testbank-phone-gift",
      "testbank-saver",
    ]);
  });

  it("tolerates an empty folder and a missing folder", () => {
    expect(loadOffers(tmpData({ "es/.gitkeep": "" }))).toEqual([]);
    expect(loadOffers(path.join(os.tmpdir(), "bankjar-does-not-exist"))).toEqual([]);
  });

  it("loads the real data folder without errors", () => {
    expect(() => loadOffers(path.join(__dirname, "..", "data", "offers"))).not.toThrow();
  });

  it("names the file and the field when validation fails", () => {
    const bad = good.replace("rate_tae: 3", "rate_tae: -3");
    const dir = tmpData({ "es/testbank-saver.yaml": bad });
    try {
      loadOffers(dir);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DataError);
      expect((e as Error).message).toContain(path.join("es", "testbank-saver.yaml"));
      expect((e as Error).message).toContain("rate_tae");
    }
  });

  it("rejects an id that differs from the file name", () => {
    const dir = tmpData({ "es/other-name.yaml": good });
    expect(() => loadOffers(dir)).toThrow(/must equal the file name "other-name"/);
  });

  it("rejects a country that differs from the folder", () => {
    const dir = tmpData({ "pt/testbank-saver.yaml": good });
    expect(() => loadOffers(dir)).toThrow(/does not match the folder "pt"/);
  });

  it("rejects duplicate ids", () => {
    const dir = tmpData({ "es/testbank-saver.yaml": good, "es/testbank-saver.yml": good });
    expect(() => loadOffers(dir)).toThrow(/duplicate/);
  });

  it("reports YAML syntax errors with the file name", () => {
    const dir = tmpData({ "es/broken.yaml": "id: [unclosed" });
    expect(() => loadOffers(dir)).toThrow(/broken\.yaml[\s\S]*YAML syntax error/);
  });
});

describe("datasetVersion", () => {
  it("is the newest verified_on plus the count", () => {
    const v = datasetVersion(loadOffers(FIXTURES_DIR));
    expect(v).toEqual({ latest_verified_on: "2026-10-20", count: 4, version: "2026-10-20+4" });
  });

  it("handles an empty dataset", () => {
    expect(datasetVersion([])).toEqual({ latest_verified_on: null, count: 0, version: "empty+0" });
  });
});
