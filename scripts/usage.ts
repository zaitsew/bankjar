import { loadApps } from "../src/server/apps";
import { loadOffers } from "../src/server/data";

// Counters for `./check.sh usage` and `teyla products`.
const offers = loadOffers();
console.log(`offers=${offers.length}`);
console.log(`goals=${new Set(offers.map((o) => o.goal)).size}`);
console.log(`apps=${loadApps().length}`);
