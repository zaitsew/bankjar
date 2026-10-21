import { CompareQuerySchema, compareBody, overridesFromQuery, parseQuery } from "../../../../src/server/api";
import { badRequest, jsonResponse, optionsResponse } from "../../../../src/server/http";

/** GET /api/v1/compare?ids=a,b,c: side by side, in the order asked, with the ids that matched nothing. */
export function GET(request: Request): Response {
  const parsed = parseQuery(new URL(request.url), CompareQuerySchema);
  if (!parsed.ok) return badRequest(parsed.issues);
  const { ids, ...rest } = parsed.data;
  return jsonResponse(compareBody(ids, overridesFromQuery(rest)));
}

export const OPTIONS = optionsResponse;
