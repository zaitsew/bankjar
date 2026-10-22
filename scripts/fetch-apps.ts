/**
 * Refreshes the store numbers in data/apps/<country>/*.yaml:
 *
 *   App Store   https://itunes.apple.com/lookup?id=<app_id>&country=<cc>
 *               (Apple's public lookup API: rating, rating count, release date, languages)
 *   Google Play https://play.google.com/store/apps/details?id=<package>&gl=<CC>
 *               (the page's schema.org JSON-LD: rating and rating count; the
 *               "Updated on" line: release date)
 *
 *   npm run fetch-apps            fetch and rewrite every file
 *   npm run fetch-apps -- bbva    only the files whose id contains "bbva"
 *   npm run fetch-apps -- --dry   fetch and print, write nothing
 *
 * Features and notes are never touched. verified_on moves to today only when
 * every store of that app answered; a failed store keeps its old numbers.
 */

import fs from "node:fs";
import path from "node:path";
import { parseDocument } from "yaml";
import { AppSchema } from "../src/core/app-schema";
import { listYaml } from "../src/server/data";
import { defaultAppsDir } from "../src/server/apps";
import { fetchAndroid, fetchIos } from "../src/server/app-stores";

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const filter = args.find((a) => !a.startsWith("--"));
  const today = new Date().toISOString().slice(0, 10);
  const files = listYaml(defaultAppsDir()).filter((f) => !filter || path.basename(f).includes(filter));
  let failed = 0;

  for (const file of files) {
    const doc = parseDocument(fs.readFileSync(file, "utf8"));
    const country = String(doc.get("country"));
    const id = String(doc.get("id"));
    let ok = true;
    const line: string[] = [id.padEnd(16)];

    const appId = doc.getIn(["ios", "app_id"]);
    if (appId !== undefined && appId !== null) {
      try {
        const n = await fetchIos(Number(appId), country);
        for (const [k, v] of Object.entries(n)) doc.setIn(["ios", k], v);
        line.push(`ios ${n.rating ?? "-"}★ ${n.ratings_count} ${n.updated_on}`);
      } catch (e) {
        ok = false;
        line.push(`ios FAILED (${(e as Error).message})`);
      }
    }
    const pkg = doc.getIn(["android", "package"]);
    if (pkg !== undefined && pkg !== null) {
      try {
        const n = await fetchAndroid(String(pkg), country);
        for (const [k, v] of Object.entries(n)) doc.setIn(["android", k], v);
        line.push(`android ${n.rating ?? "-"}★ ${n.ratings_count} ${n.updated_on}`);
      } catch (e) {
        ok = false;
        line.push(`android FAILED (${(e as Error).message})`);
      }
    }
    if (ok) doc.set("verified_on", today);
    else failed++;

    const check = AppSchema.safeParse(doc.toJS());
    if (!check.success) {
      failed++;
      line.push(`INVALID: ${check.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    } else if (!dry) {
      fs.writeFileSync(file, doc.toString({ lineWidth: 0 }));
    }
    console.log(line.join("  "));
  }
  console.log(`${files.length} app(s), ${failed} problem(s)${dry ? ", dry run: nothing written" : ""}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
