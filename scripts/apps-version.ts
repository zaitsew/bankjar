/**
 * Prints the bank-app dataset version ("<latest verified_on>+<count>"), the same
 * string /api/v1/apps returns as dataset.version. scripts/refresh-apps.sh compares
 * the two to tell whether the live site is behind main.
 *
 *   npx tsx scripts/apps-version.ts                 from data/apps
 *   npx tsx scripts/apps-version.ts --live <site>   from <site>/api/v1/apps
 */

import { loadApps } from "../src/server/apps";

async function main() {
  const i = process.argv.indexOf("--live");
  if (i >= 0) {
    const site = process.argv[i + 1];
    if (!site) throw new Error("--live needs a site URL");
    const res = await fetch(`${site}/api/v1/apps?limit=1`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${site}`);
    const body = (await res.json()) as { dataset: { version: string } };
    console.log(body.dataset.version);
    return;
  }
  const apps = loadApps();
  const latest = apps.reduce<string | null>((m, a) => (m === null || a.verified_on > m ? a.verified_on : m), null);
  console.log(`${latest ?? "empty"}+${apps.length}`);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
