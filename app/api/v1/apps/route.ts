import { parseQuery } from "../../../../src/server/api";
import { AppsQuerySchema, appsBody } from "../../../../src/server/apps-api";
import { badRequest, jsonResponse, optionsResponse } from "../../../../src/server/http";

/** GET /api/v1/apps?limit=: Spanish bank apps ranked by store ratings, freshness, reach and features. */
export function GET(request: Request): Response {
  const parsed = parseQuery(new URL(request.url), AppsQuerySchema);
  if (!parsed.ok) return badRequest(parsed.issues);
  return jsonResponse(appsBody({ limit: parsed.data.limit }));
}

export const OPTIONS = optionsResponse;
