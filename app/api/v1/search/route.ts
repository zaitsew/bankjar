import { SearchQuerySchema, overridesFromQuery, parseQuery, searchBodyAsync } from "../../../../src/server/api";
import { badRequest, jsonResponse, optionsResponse } from "../../../../src/server/http";
import { clientIp } from "../../../../src/server/ratelimit";

/**
 * GET /api/v1/search?q=...: the same pipeline as the search box, with the optional AI step.
 * Cached by the CDN via Cache-Control, so a repeated URL costs no AI call.
 */
export async function GET(request: Request): Promise<Response> {
  const parsed = parseQuery(new URL(request.url), SearchQuerySchema);
  if (!parsed.ok) return badRequest(parsed.issues);
  const { q, ...rest } = parsed.data;
  return jsonResponse(await searchBodyAsync(q, overridesFromQuery(rest), { ip: clientIp(request.headers) }));
}

export const OPTIONS = optionsResponse;
