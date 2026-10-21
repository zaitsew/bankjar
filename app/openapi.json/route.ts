import { buildOpenApi } from "../../src/server/openapi";
import { jsonResponse } from "../../src/server/http";

export const revalidate = 3600;

export function GET(): Response {
  return jsonResponse(buildOpenApi());
}

