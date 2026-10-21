import { OffersQuerySchema, offersBody, overridesFromQuery, parseQuery } from "../../../../src/server/api";
import { badRequest, jsonResponse, optionsResponse } from "../../../../src/server/http";

/** GET /api/v1/offers?goal=&country=ES&income=...: ranked rows for one goal, or one table per goal. */
export function GET(request: Request): Response {
  const parsed = parseQuery(new URL(request.url), OffersQuerySchema);
  if (!parsed.ok) return badRequest(parsed.issues);
  const { country, ...rest } = parsed.data;
  const overrides = overridesFromQuery(rest);
  return jsonResponse(offersBody({ goal: rest.goal, country, overrides }));
}

export const OPTIONS = optionsResponse;
