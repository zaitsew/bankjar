import { CACHE_CONTROL, type ApiIssue } from "./api";

/** Response helpers shared by every route in the agent surface. */

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

export function jsonResponse(body: unknown, init: { status?: number; cache?: string } = {}): Response {
  return new Response(JSON.stringify(body, null, 2) + "\n", {
    status: init.status ?? 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": init.cache ?? CACHE_CONTROL,
    },
  });
}

export function textResponse(text: string): Response {
  return new Response(text, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}

/** Errors are never cached: a fixed typo must not keep failing at the edge. */
export function errorResponse(status: number, error: string, extra: Record<string, unknown> = {}): Response {
  return jsonResponse({ error, ...extra }, { status, cache: "no-store" });
}

export function badRequest(issues: ApiIssue[]): Response {
  return errorResponse(400, "Invalid query parameters", { issues });
}

export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
