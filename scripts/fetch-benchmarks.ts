/**
 * Refreshes data/benchmarks/es/*.yaml from the publishers' own APIs:
 *
 *   ECB Data Portal    deposit facility rate, €STR (csvdata, no key)
 *   Banco de España    average rate on new household deposits (bierest JSON)
 *   INE                CPI annual change (wstempus JSON)
 *   Tesoro Público     12-month Letra auction yields (tesoro.es results page, HTML table)
 *
 *   npm run fetch-benchmarks             fetch and rewrite every file
 *   npm run fetch-benchmarks -- estr     only the ids that contain "estr"
 *   npm run fetch-benchmarks -- --dry    fetch and print, write nothing
 *
 * A failed fetch, an unparseable response or a value outside the series'
 * sanity range keeps the old file untouched and prints why. Like fetch-apps, the
 * script exits 0 for those; it exits 1 only when it crashes. A file that does
 * not exist yet is created from the template in src/server/benchmark-sources.ts.
 * Existing files get only value, period, published_on and fetched_on rewritten.
 */

import fs from "node:fs";
import path from "node:path";
import { parseDocument, stringify } from "yaml";
import { BenchmarkSchema } from "../src/core/benchmark-schema";
import { checkSanity, SOURCES, type Observation } from "../src/server/benchmark-sources";
import { defaultBenchmarksDir } from "../src/server/benchmarks";

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const filter = args.find((a) => !a.startsWith("--"));
  const today = new Date().toISOString().slice(0, 10);
  const dir = path.join(defaultBenchmarksDir(), "es");
  const ids = Object.keys(SOURCES).filter((id) => !filter || id.includes(filter));
  let kept = 0;

  for (const id of ids) {
    const src = SOURCES[id]!;
    const file = path.join(dir, `${id}.yaml`);
    const exists = fs.existsSync(file);
    const doc = exists ? parseDocument(fs.readFileSync(file, "utf8")) : null;
    const sanity = doc ? (doc.get("sanity") as { toJSON(): { min: number; max: number } }).toJSON() : src.template.sanity;
    try {
      const obs: Observation = await src.fetch();
      checkSanity(obs.value, sanity);
      const record = { ...src.template, ...obs, fetched_on: today };
      const next = doc ?? parseDocument(stringify(record, { lineWidth: 0 }));
      if (doc) {
        doc.set("value", obs.value);
        doc.set("period", obs.period);
        doc.set("published_on", obs.published_on);
        doc.set("fetched_on", today);
      }
      const check = BenchmarkSchema.safeParse(next.toJS());
      if (!check.success) {
        throw new Error(`result is invalid: ${check.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      }
      if (!dry) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, next.toString({ lineWidth: 0 }));
      }
      console.log(`${id.padEnd(40)} ${obs.value}%  period ${obs.period}`);
    } catch (e) {
      kept++;
      console.log(`${id.padEnd(40)} KEPT OLD FILE (${(e as Error).message})`);
    }
  }
  console.log(`${ids.length} benchmark(s), ${kept} kept unchanged${dry ? ", dry run: nothing written" : ""}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
