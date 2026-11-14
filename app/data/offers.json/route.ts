import { allOffers, datasetVersion } from "../../../src/server/data";
import { LICENSE } from "../../../src/server/api";
import { jsonResponse } from "../../../src/server/http";
import { allIssuers } from "../../../src/server/issuers";
import { benchmarkRows, benchmarksDataset } from "../../../src/server/benchmarks-api";

export const revalidate = 3600;

/** The whole dataset as one validated JSON file. CC BY 4.0. */
export function GET(): Response {
  const offers = allOffers();
  return jsonResponse({ dataset: datasetVersion(offers), license: LICENSE, offers, issuers: allIssuers(), benchmarks: benchmarkRows(), benchmarks_dataset: benchmarksDataset() });
}

