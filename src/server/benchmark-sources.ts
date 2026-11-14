/**
 * Sources for scripts/fetch-benchmarks.ts. Each source has a pure parser (tested
 * against saved responses, no network) and a template that creates the YAML file
 * the first time. Once a file exists the script only rewrites value, period,
 * published_on and fetched_on; everything else is edited by hand.
 * Nothing in the site calls these at request time.
 */

import type { Benchmark } from "../core/benchmark-schema";

const UA = "Mozilla/5.0 (compatible; BankJar data refresh)";

export interface Observation {
  value: number;
  /** YYYY-MM or YYYY-MM-DD: what the number describes. */
  period: string;
  /** Day the publisher released it, when the response says so. */
  published_on: string | null;
}

export class SourceError extends Error {}

/** Throws when the value is outside the range a human set for this series. */
export function checkSanity(value: number, sanity: { min: number; max: number }): void {
  if (!Number.isFinite(value) || value < sanity.min || value > sanity.max) {
    throw new SourceError(`value ${value} is outside the sanity range ${sanity.min}..${sanity.max}`);
  }
}

// --- parsers ---------------------------------------------------------------

/** Splits one CSV line; handles double-quoted fields with commas. */
function csvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** ECB Data Portal, format=csvdata: the row with the latest TIME_PERIOD. */
export function parseEcbCsv(csv: string): Observation {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) throw new SourceError("ECB response has no data rows");
  const head = csvLine(lines[0] ?? "");
  const t = head.indexOf("TIME_PERIOD");
  const v = head.indexOf("OBS_VALUE");
  if (t < 0 || v < 0) throw new SourceError("ECB response has no TIME_PERIOD / OBS_VALUE columns");
  let best: { period: string; value: number } | null = null;
  for (const line of lines.slice(1)) {
    const cols = csvLine(line);
    const value = Number(cols[v]);
    const when = cols[t] ?? "";
    if (cols[v] === "" || !Number.isFinite(value) || when === "") continue;
    if (!best || when > best.period) best = { period: when, value };
  }
  if (!best) throw new SourceError("ECB response has no numeric observation");
  return { ...best, published_on: null };
}

/** Banco de España listaSeries JSON: the newest dated, non-null value. */
export function parseBdeJson(body: unknown): Observation {
  const s = Array.isArray(body) ? (body[0] as Record<string, unknown> | undefined) : undefined;
  const fechas = s?.fechas;
  const valores = s?.valores;
  if (!Array.isArray(fechas) || !Array.isArray(valores) || fechas.length !== valores.length || fechas.length === 0) {
    throw new SourceError("BdE response has no fechas/valores");
  }
  let best: { date: string; value: number } | null = null;
  fechas.forEach((d, i) => {
    const value = valores[i];
    if (typeof d !== "string" || typeof value !== "number" || !Number.isFinite(value)) return;
    if (!best || d > best.date) best = { date: d, value };
  });
  if (!best) throw new SourceError("BdE response has no numeric observation");
  const { date, value } = best as { date: string; value: number };
  if (!/^\d{4}-\d{2}-\d{2}T/.test(date)) throw new SourceError(`BdE date "${date}" is not ISO`);
  // Monthly series: the date is the first of the month.
  return { value, period: date.slice(0, 7), published_on: null };
}

/** INE wstempus DATOS_SERIE JSON for a monthly series: the newest point. */
export function parseIneJson(body: unknown): Observation {
  const data = (body as { Data?: unknown })?.Data;
  if (!Array.isArray(data) || data.length === 0) throw new SourceError("INE response has no Data");
  let best: { fecha: number; anyo: number; periodo: number; value: number } | null = null;
  for (const p of data as Record<string, unknown>[]) {
    const value = p.Valor;
    if (typeof value !== "number" || !Number.isFinite(value) || p.Secreto === true) continue;
    const fecha = Number(p.Fecha);
    if (!best || fecha > best.fecha) best = { fecha, anyo: Number(p.Anyo), periodo: Number(p.FK_Periodo), value };
  }
  if (!best) throw new SourceError("INE response has no numeric observation");
  // FK_Periodo 1..12 is the month for a monthly series (INE period ids 1-12 = M01-M12).
  if (!Number.isInteger(best.periodo) || best.periodo < 1 || best.periodo > 12 || !Number.isInteger(best.anyo)) {
    throw new SourceError(`INE period ${best.anyo}/${best.periodo} is not a month`);
  }
  return { value: best.value, period: `${best.anyo}-${String(best.periodo).padStart(2, "0")}`, published_on: null };
}

/** Spanish number text ("3,045", "1.946,17") to a number; NaN when the cell holds no number (an empty cell is not 0). */
function esNumber(text: string): number {
  const t = text.trim();
  if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(t)) return Number.NaN;
  return Number(t.replace(/\./g, "").replace(",", "."));
}

const strip = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

/**
 * tesoro.es "Resultado últimas subastas / Letras del Tesoro": a table with one
 * column per term (3, 6, 9, 12 MESES) and one row per figure. Returns the
 * auction date and the yield in the row labelled `rowLabel` for the 12-month
 * column. The 3/6/9-month columns can carry other auction dates.
 */
export function parseTesoroLetras12m(html: string, rowLabel: "Tipo de interés medio" | "Tipo de interés marginal"): Observation {
  const head = /<thead>([\s\S]*?)<\/thead>/i.exec(html)?.[1];
  const body = /<tbody>([\s\S]*?)<\/tbody>/i.exec(html)?.[1];
  if (!head || !body) throw new SourceError("tesoro.es page has no auction table");
  const terms = [...head.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => strip(m[1] ?? ""));
  const col = terms.indexOf("12 MESES") - 1; // the first header cell is the row-label column
  if (col < 0) throw new SourceError("tesoro.es table has no 12 MESES column");
  const rows = new Map<string, string[]>();
  for (const tr of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...(tr[1] ?? "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => strip(m[1] ?? ""));
    if (cells.length > 1) rows.set(cells[0] ?? "", cells.slice(1));
  }
  const date = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(rows.get("Fecha subasta")?.[col] ?? "");
  if (!date) throw new SourceError("tesoro.es table has no auction date for 12 MESES");
  const raw = rows.get(rowLabel)?.[col];
  const value = raw === undefined ? Number.NaN : esNumber(raw);
  if (!Number.isFinite(value)) throw new SourceError(`tesoro.es table has no number for "${rowLabel}" at 12 MESES`);
  return { value, period: `${date[3]}-${date[2]}-${date[1]}`, published_on: null };
}

// --- registry --------------------------------------------------------------

export type BenchmarkTemplate = Omit<Benchmark, "value" | "period" | "published_on" | "fetched_on">;

export interface BenchmarkSource {
  template: BenchmarkTemplate;
  /** Reads the latest observation. Throws on a network or parse problem. */
  fetch(): Promise<Observation>;
}

async function getText(url: string, accept: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new SourceError(`HTTP ${res.status} from ${url}`);
  return res.text();
}

async function getJson(url: string): Promise<unknown> {
  const text = await getText(url, "application/json");
  try {
    return JSON.parse(text);
  } catch {
    throw new SourceError(`${url} did not return JSON`);
  }
}

const ECB_DFR_API =
  "https://data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.4F.KR.DFR.LEV?lastNObservations=5&format=csvdata";
const ECB_ESTR_API = "https://data-api.ecb.europa.eu/service/data/EST/B.EU000A2X2A25.WT?lastNObservations=5&format=csvdata";
const BDE_API = "https://app.bde.es/bierest/resources/srdatosapp/listaSeries?idioma=en&series=DN_1TI2T0025&rango=60M";
const TESORO_LETRAS =
  "https://www.tesoro.es/deuda-publica/subastas/resultado-ultimas-subastas/letras-del-tesoro";
const INE_API = "https://servicios.ine.es/wstempus/js/EN/DATOS_SERIE/IPC290750?nult=3";

export const SOURCES: Record<string, BenchmarkSource> = {
  "ecb-deposit-facility-rate": {
    template: {
      id: "ecb-deposit-facility-rate",
      country: "ES",
      label: "ECB deposit facility rate",
      kind: "policy_rate",
      unit: "percent",
      source_name: "European Central Bank, Data Portal",
      source_url: "https://data.ecb.europa.eu/data/datasets/FM/FM.D.U2.EUR.4F.KR.DFR.LEV",
      api_url: ECB_DFR_API,
      series_code: "FM.D.U2.EUR.4F.KR.DFR.LEV",
      method:
        "The ECB deposit facility rate in force for the euro area on the latest day of the daily series (the rate banks earn on overnight deposits at the ECB).",
      sanity: { min: -1, max: 10 },
      stale_after_days: 14,
    },
    fetch: async () => parseEcbCsv(await getText(ECB_DFR_API, "text/csv")),
  },
  estr: {
    template: {
      id: "estr",
      country: "ES",
      label: "Euro short-term rate (€STR)",
      kind: "overnight_rate",
      unit: "percent",
      source_name: "European Central Bank, Data Portal",
      source_url: "https://data.ecb.europa.eu/data/datasets/EST/EST.B.EU000A2X2A25.WT",
      api_url: ECB_ESTR_API,
      series_code: "EST.B.EU000A2X2A25.WT",
      method:
        "The volume-weighted trimmed mean unsecured overnight euro borrowing rate of euro area banks, published by the ECB each business day for the previous day.",
      sanity: { min: -1, max: 10 },
      stale_after_days: 7,
    },
    fetch: async () => parseEcbCsv(await getText(ECB_ESTR_API, "text/csv")),
  },
  "bde-new-deposits-households-up-to-1y": {
    template: {
      id: "bde-new-deposits-households-up-to-1y",
      country: "ES",
      label: "Average rate on new household term deposits, up to 1 year",
      kind: "avg_deposit_rate",
      unit: "percent",
      source_name: "Banco de España, statistical bulletin chapter 19, table 19.7 (new business, credit institutions)",
      source_url: "https://www.bde.es/webbe/en/estadisticas/compartido/datos/pdf/a1907e.pdf",
      api_url: BDE_API,
      series_code: "DN_1TI2T0025",
      method:
        "Narrowly defined effective rate (NEDR) on new deposits with agreed maturity up to 1 year from Spanish households and non-profit institutions serving households, a monthly average across all banks (alias BE_19_7.3).",
      sanity: { min: 0, max: 10 },
      stale_after_days: 75,
    },
    fetch: async () => parseBdeJson(await getJson(BDE_API)),
  },
  "ine-cpi-yoy": {
    template: {
      id: "ine-cpi-yoy",
      country: "ES",
      label: "Spain consumer price inflation, year on year",
      kind: "cpi_yoy",
      unit: "percent",
      source_name: "Instituto Nacional de Estadística (INE), CPI table 76134",
      source_url: "https://www.ine.es/jaxiT3/Tabla.htm?t=76134",
      api_url: INE_API,
      series_code: "IPC290750",
      method: "Annual change of the national overall consumer price index (CPI), for the latest published month.",
      sanity: { min: -3, max: 20 },
      stale_after_days: 45,
    },
    fetch: async () => parseIneJson(await getJson(INE_API)),
  },

  "es-letra-12m-average-yield": {
    template: {
      id: "es-letra-12m-average-yield",
      country: "ES",
      label: "12-month Letra del Tesoro, average yield at the latest auction",
      kind: "treasury_yield",
      unit: "percent",
      source_name: "Tesoro Público, auction results (Letras del Tesoro)",
      source_url: TESORO_LETRAS,
      api_url: TESORO_LETRAS,
      series_code: "tesoro.es:letras:12-meses:tipo-de-interes-medio",
      method:
        "The average (weighted) gross yield of the latest 12-month Letra del Tesoro auction, before the 19% withholding tax; an auction result on the auction date, not a live quote.",
      sanity: { min: -1, max: 10 },
      stale_after_days: 45,
    },
    fetch: async () => parseTesoroLetras12m(await getText(TESORO_LETRAS, "text/html"), "Tipo de interés medio"),
  },
  "es-letra-12m-marginal-yield": {
    template: {
      id: "es-letra-12m-marginal-yield",
      country: "ES",
      label: "12-month Letra del Tesoro, marginal yield at the latest auction",
      kind: "treasury_yield",
      unit: "percent",
      source_name: "Tesoro Público, auction results (Letras del Tesoro)",
      source_url: TESORO_LETRAS,
      api_url: TESORO_LETRAS,
      series_code: "tesoro.es:letras:12-meses:tipo-de-interes-marginal",
      method:
        "The marginal (highest accepted) gross yield of the latest 12-month Letra del Tesoro auction, before the 19% withholding tax; an auction result on the auction date, not a live quote.",
      sanity: { min: -1, max: 10 },
      stale_after_days: 45,
    },
    fetch: async () => parseTesoroLetras12m(await getText(TESORO_LETRAS, "text/html"), "Tipo de interés marginal"),
  },
};
