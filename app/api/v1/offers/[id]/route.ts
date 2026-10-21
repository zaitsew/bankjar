import { OfferQuerySchema, offerBody, overridesFromQuery, parseQuery } from "../../../../../src/server/api";
import { badRequest, errorResponse, jsonResponse, optionsResponse } from "../../../../../src/server/http";

/** GET /api/v1/offers/{id}: one row plus the full data file. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const parsed = parseQuery(new URL(request.url), OfferQuerySchema);
  if (!parsed.ok) return badRequest(parsed.issues);
  const body = offerBody(id, overridesFromQuery(parsed.data));
  if (!body) {
    return errorResponse(404, `No offer with id "${id}"`, { hint: "List ids with GET /api/v1/offers" });
  }
  return jsonResponse(body);
}

export const OPTIONS = optionsResponse;
