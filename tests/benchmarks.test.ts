import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BenchmarkSchema, isBenchmarkStale } from "../src/core/benchmark-schema";
import { checkSanity, parseBdeJson, parseEcbCsv, parseIneJson, parseTesoroLetras12m, SOURCES, SourceError } from "../src/server/benchmark-sources";
import { loadBenchmarks, withStaleFlag } from "../src/server/benchmarks";
import { DataError } from "../src/server/data";

const FX = path.join(__dirname, "fixtures", "benchmarks");
const text = (f: string) => fs.readFileSync(path.join(FX, f), "utf8");
const json = (f: string) => JSON.parse(text(f));

describe("parsers, on responses saved from the real APIs", () => {
  it("ECB deposit facility rate: the latest day", () => {
    expect(parseEcbCsv(text("ecb-dfr.csv"))).toEqual({ value: 2.5, period: "2026-11-14", published_on: null });
  });

  it("€STR: the latest business day, even when rows come in any order", () => {
    const csv = text("ecb-estr.csv");
    expect(parseEcbCsv(csv)).toEqual({ value: 2.443, period: "2026-11-12", published_on: null });
    const [head, ...rows] = csv.trim().split("\n");
    expect(parseEcbCsv([head, ...rows.reverse()].join("\n")).period).toBe("2026-11-12");
  });

  it("ECB: refuses an empty body, missing columns and a row without a value", () => {
    expect(() => parseEcbCsv("")).toThrow(SourceError);
    expect(() => parseEcbCsv("A,B\n1,2")).toThrow(/TIME_PERIOD/);
    expect(() => parseEcbCsv("TIME_PERIOD,OBS_VALUE\n2026-01-01,")).toThrow(/no numeric/);
  });

  it("BdE: the newest month, although the API lists newest first", () => {
    expect(parseBdeJson(json("bde-deposits-up-to-1y.json"))).toEqual({ value: 2.29, period: "2026-09", published_on: null });
  });

  it("BdE: skips null values and refuses a response without series data", () => {
    const body = [{ fechas: ["2026-09-01T08:15:00Z", "2026-08-01T08:15:00Z"], valores: [null, 2.01] }];
    expect(parseBdeJson(body)).toMatchObject({ value: 2.01, period: "2026-08" });
    expect(() => parseBdeJson([])).toThrow(SourceError);
    expect(() => parseBdeJson({ errNum: 412 })).toThrow(SourceError);
    expect(() => parseBdeJson([{ fechas: ["x"], valores: [1, 2] }])).toThrow(SourceError);
  });

  it("INE CPI: the newest month, as YYYY-MM", () => {
    expect(parseIneJson(json("ine-cpi-yoy.json"))).toEqual({ value: 4.9, period: "2026-10", published_on: null });
  });

  it("INE: refuses a yearly or empty response", () => {
    expect(() => parseIneJson({ Data: [] })).toThrow(SourceError);
    expect(() => parseIneJson({ Data: [{ Fecha: 1, Anyo: 2025, FK_Periodo: 28, Valor: 118.4, Secreto: false }] })).toThrow(/not a month/);
  });
});

describe("Letra del Tesoro, 12 months (tesoro.es auction table)", () => {
  const html = text("tesoro-letras.html");
  it("reads the average yield and the auction date of the 12-month column", () => {
    expect(parseTesoroLetras12m(html, "Tipo de interés medio")).toEqual({ value: 3.045, period: "2026-11-03", published_on: null });
  });
  it("reads the marginal yield", () => {
    expect(parseTesoroLetras12m(html, "Tipo de interés marginal")).toMatchObject({ value: 3.068, period: "2026-11-03" });
  });
  it("does not take the 3-month column, which has another auction date", () => {
    expect(parseTesoroLetras12m(html, "Tipo de interés medio").value).not.toBe(2.652);
  });
  it("refuses an empty or non-numeric 12-month yield cell instead of reading it as 0", () => {
    for (const cell of ["", "&nbsp;", " - "]) {
      const blank = html.replace(/(Tipo de inter[eé]s medio[\s\S]*?)(3,045)/, `$1${cell}`);
      expect(blank).not.toBe(html);
      expect(() => parseTesoroLetras12m(blank, "Tipo de interés medio")).toThrow(SourceError);
    }
  });
  it("refuses a page without the table, without a 12 MESES column, or without the row", () => {
    expect(() => parseTesoroLetras12m("<html></html>", "Tipo de interés medio")).toThrow(SourceError);
    expect(() => parseTesoroLetras12m(html.replace("12 MESES", "18 MESES"), "Tipo de interés medio")).toThrow(/12 MESES/);
    expect(() => parseTesoroLetras12m(html.replace("Tipo de interés medio", "Otro"), "Tipo de interés medio")).toThrow(/no number/);
    expect(() => parseTesoroLetras12m(html.replace("Fecha subasta", "Otra fecha"), "Tipo de interés medio")).toThrow(/auction date/);
  });
  it("refuses a value that is not a number", () => {
    expect(() => parseTesoroLetras12m(html.replace("3,045", "n/d"), "Tipo de interés medio")).toThrow(/no number/);
  });
});

describe("sanity refusal", () => {
  it("accepts a value inside the range, including the edges", () => {
    expect(() => checkSanity(2.5, { min: -1, max: 10 })).not.toThrow();
    expect(() => checkSanity(10, { min: -1, max: 10 })).not.toThrow();
  });
  it.each([10.01, -1.01, Number.NaN, Number.POSITIVE_INFINITY])("refuses %s", (v) => {
    expect(() => checkSanity(v, { min: -1, max: 10 })).toThrow(/sanity range/);
  });
});

function sample(over: Record<string, unknown> = {}) {
  return {
    ...SOURCES["estr"]!.template,
    value: 2.443,
    period: "2026-11-12",
    published_on: null,
    fetched_on: "2026-11-14",
    ...over,
  };
}

describe("BenchmarkSchema", () => {
  it("accepts every template filled with a value", () => {
    for (const s of Object.values(SOURCES)) {
      const v = (s.template.sanity.min + s.template.sanity.max) / 2;
      expect(BenchmarkSchema.safeParse({ ...s.template, value: v, period: "2026-10", published_on: null, fetched_on: "2026-11-14" }).success).toBe(true);
    }
  });
  it.each([
    ["value above sanity", { value: 11 }],
    ["bad period", { period: "2026-13" }],
    ["impossible date", { period: "2026-02-31" }],
    ["unit not percent", { unit: "bp" }],
    ["unknown kind", { kind: "mortgage_rate" }],
    ["sanity inverted", { sanity: { min: 5, max: 1 } }],
    ["stale_after_days 0", { stale_after_days: 0 }],
    ["api_url not a url", { api_url: "ecb" }],
  ])("rejects %s", (_n, patch) => {
    expect(BenchmarkSchema.safeParse(sample(patch)).success).toBe(false);
  });
  it("accepts a month and a day as period", () => {
    expect(BenchmarkSchema.safeParse(sample({ period: "2026-10" })).success).toBe(true);
    expect(BenchmarkSchema.safeParse(sample({ period: "2026-10-31" })).success).toBe(true);
  });
});

describe("stale flag", () => {
  const b = { fetched_on: "2026-11-01", stale_after_days: 14 };
  it("is false up to stale_after_days and true after", () => {
    expect(isBenchmarkStale(b, "2026-11-15")).toBe(false);
    expect(isBenchmarkStale(b, "2026-11-16")).toBe(true);
  });
  it("is attached by withStaleFlag", () => {
    expect(withStaleFlag(BenchmarkSchema.parse(sample({ fetched_on: "2026-10-01" })), "2026-11-14").stale).toBe(true);
    expect(withStaleFlag(BenchmarkSchema.parse(sample()), "2026-11-14").stale).toBe(false);
  });
});

describe("loadBenchmarks", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });
  function tmp(name: string, yamlBody: string, folder = "es") {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bj-bench-"));
    dirs.push(root);
    fs.mkdirSync(path.join(root, folder));
    fs.writeFileSync(path.join(root, folder, name), yamlBody);
    return root;
  }
  const body = (id: string) =>
    Object.entries(sample({ id }))
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join("\n");

  it("loads a valid file", () => {
    expect(loadBenchmarks(tmp("estr.yaml", body("estr"))).map((x) => x.id)).toEqual(["estr"]);
  });
  it("rejects an id that differs from the file name, and a wrong folder", () => {
    expect(() => loadBenchmarks(tmp("other.yaml", body("estr")))).toThrow(DataError);
    expect(() => loadBenchmarks(tmp("estr.yaml", body("estr"), "fr"))).toThrow(/folder/);
  });
  it("gives [] for a missing folder", () => {
    expect(loadBenchmarks(path.join(os.tmpdir(), "bj-no-such-dir"))).toEqual([]);
  });
  it("loads the committed data", () => {
    const all = loadBenchmarks();
    expect(all.length).toBeGreaterThanOrEqual(4);
    for (const b of all) expect(b.unit).toBe("percent");
  });
});
