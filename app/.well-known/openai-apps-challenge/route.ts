/**
 * GET /.well-known/openai-apps-challenge: OpenAI's domain check for the plugin directory.
 * The portal shows a token after the MCP server is connected; this route returns exactly that
 * token as plain text (no JSON, no trailing newline), read from OPENAI_APPS_CHALLENGE at run
 * time. 404 while the variable is unset, so the route says nothing about a site that has not
 * asked for the check. The token is a public challenge, not a secret.
 */

export const dynamic = "force-dynamic";

export function GET(): Response {
  const token = process.env.OPENAI_APPS_CHALLENGE?.trim();
  if (!token) return new Response("Not found\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  return new Response(token, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
