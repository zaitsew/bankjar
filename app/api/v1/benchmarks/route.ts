import { parseQuery } from "../../../../src/server/api";
import { BenchmarksQuerySchema, benchmarksBody } from "../../../../src/server/benchmarks-api";
import { badRequest, jsonResponse, optionsResponse } from "../../../../src/server/http";

/** GET /api/v1/benchmarks?kind=: official reference numbers (context only), each with period, source and a stale flag. */
export function GET(request: Request): Response {
  const parsed = parseQuery(new URL(request.url), BenchmarksQuerySchema);
  if (!parsed.ok) return badRequest(parsed.issues);
  return jsonResponse(benchmarksBody({ kind: parsed.data.kind }));
}

export const OPTIONS = optionsResponse;
