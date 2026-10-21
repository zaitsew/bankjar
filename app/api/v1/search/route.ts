import { SearchQuerySchema, overridesFromQuery, parseQuery, searchBody } from "../../../../src/server/api";
import { badRequest, jsonResponse, optionsResponse } from "../../../../src/server/http";

/** GET /api/v1/search?q=...: the same pipeline as the search box. Cached by the CDN via Cache-Control. */
export function GET(request: Request): Response {
  const parsed = parseQuery(new URL(request.url), SearchQuerySchema);
  if (!parsed.ok) return badRequest(parsed.issues);
  const { q, ...rest } = parsed.data;
  return jsonResponse(searchBody(q, overridesFromQuery(rest)));
}

export const OPTIONS = optionsResponse;
