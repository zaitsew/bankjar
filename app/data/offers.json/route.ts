import { allOffers, datasetVersion } from "../../../src/server/data";
import { LICENSE } from "../../../src/server/api";
import { jsonResponse } from "../../../src/server/http";

export const revalidate = 3600;

/** The whole dataset as one validated JSON file. CC BY 4.0. */
export function GET(): Response {
  const offers = allOffers();
  return jsonResponse({ dataset: datasetVersion(offers), license: LICENSE, offers });
}

