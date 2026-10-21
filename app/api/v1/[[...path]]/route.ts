import { siteUrl } from "../../../../src/server/api";
import { errorResponse, optionsResponse } from "../../../../src/server/http";

/** Anything under /api/v1 that no route file claims: a JSON 404, never an HTML page. */
function notFound(request: Request): Response {
  const { pathname } = new URL(request.url);
  return errorResponse(404, `No such endpoint: ${pathname}`, {
    endpoints: ["/api/v1/search", "/api/v1/offers", "/api/v1/offers/{id}", "/api/v1/compare", "/api/v1/goals"],
    openapi: `${siteUrl()}/openapi.json`,
  });
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const OPTIONS = optionsResponse;
