import { z } from "zod";
import { parseQuery } from "../../../../../src/server/api";
import { benchmarkBody } from "../../../../../src/server/benchmarks-api";
import { badRequest, errorResponse, jsonResponse, optionsResponse } from "../../../../../src/server/http";

/** GET /api/v1/benchmarks/{id}: one benchmark with its method, series code and sanity range. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const parsed = parseQuery(new URL(request.url), z.object({}));
  if (!parsed.ok) return badRequest(parsed.issues);
  const body = benchmarkBody(id);
  if (!body) {
    return errorResponse(404, `No benchmark with id "${id}"`, { hint: "List ids with GET /api/v1/benchmarks" });
  }
  return jsonResponse(body);
}

export const OPTIONS = optionsResponse;
