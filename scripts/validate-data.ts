import { loadApps } from "../src/server/apps";
import { datasetVersion, DataError, loadOffers } from "../src/server/data";
import { loadIssuers, missingIssuers } from "../src/server/issuers";

try {
  const offers = loadOffers();
  const goals = new Set(offers.map((o) => o.goal));
  const apps = loadApps();
  const issuers = loadIssuers();
  const missing = missingIssuers(offers, issuers);
  if (missing.length > 0) {
    throw new DataError("data/issuers", [`no issuer file for bank_slug: ${missing.join(", ")} (add data/issuers/es/<bank_slug>.yaml)`]);
  }
  console.log(`validated offers=${offers.length} goals=${goals.size} version=${datasetVersion(offers).version} apps=${apps.length} issuers=${issuers.length}`);
} catch (e) {
  console.error(e instanceof DataError ? e.message : e);
  process.exit(1);
}
