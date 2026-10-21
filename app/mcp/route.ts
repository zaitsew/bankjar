import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import pkg from "../../package.json";
import { siteUrl } from "../../src/server/api";
import { createMcpServer } from "../../src/server/mcp";
import { clientIp } from "../../src/server/ratelimit";

/**
 * POST /mcp: a stateless Streamable HTTP MCP server. Each request builds its own server and
 * transport (no session id, JSON replies instead of SSE), so it runs on any serverless host.
 */

export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function POST(request: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createMcpServer({ ip: clientIp(request.headers) });
  await server.connect(transport);
  try {
    return withCors(await transport.handleRequest(request));
  } finally {
    // JSON mode has answered by now; release the per-request server.
    void server.close().catch(() => undefined);
  }
}

/** This server keeps no session, so there is no stream to open: say what it is instead. */
export function GET(): Response {
  return new Response(
    JSON.stringify(
      {
        name: "bankjar",
        version: pkg.version,
        transport: "Streamable HTTP, stateless: POST JSON-RPC to this URL with Accept: application/json, text/event-stream",
        tools: ["search_offers", "get_offer", "compare_offers", "list_goals"],
        docs: `${siteUrl()}/llms.txt`,
        claude_code: `claude mcp add --transport http bankjar ${siteUrl()}/mcp`,
      },
      null,
      2,
    ),
    { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS", "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

export function DELETE(): Response {
  return new Response(null, { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}
