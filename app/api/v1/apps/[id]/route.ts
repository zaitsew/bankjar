import { parseQuery } from "../../../../../src/server/api";
import { appBody } from "../../../../../src/server/apps-api";
import { badRequest, errorResponse, jsonResponse, optionsResponse } from "../../../../../src/server/http";
import { z } from "zod";

/** GET /api/v1/apps/{id}: one app row plus the full data file. A hidden app is returned with hidden: true. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const parsed = parseQuery(new URL(request.url), z.object({}));
  if (!parsed.ok) return badRequest(parsed.issues);
  const body = appBody(id);
  if (!body) {
    return errorResponse(404, `No bank app with id "${id}"`, { hint: "List ids with GET /api/v1/apps" });
  }
  return jsonResponse(body);
}

export const OPTIONS = optionsResponse;
