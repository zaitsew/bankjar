import { loadApps } from "../src/server/apps";
import { datasetVersion, DataError, loadOffers } from "../src/server/data";

try {
  const offers = loadOffers();
  const goals = new Set(offers.map((o) => o.goal));
  const apps = loadApps();
  console.log(`validated offers=${offers.length} goals=${goals.size} version=${datasetVersion(offers).version} apps=${apps.length}`);
} catch (e) {
  console.error(e instanceof DataError ? e.message : e);
  process.exit(1);
}
