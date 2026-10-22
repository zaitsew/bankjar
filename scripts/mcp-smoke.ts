/**
 * End-to-end check of a running BankJar MCP endpoint with the official client.
 *
 *   npm run mcp:smoke -- http://localhost:3000/mcp
 *
 * Lists the tools, calls each one, and exits non-zero on the first wrong answer.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.argv[2];
if (!url) {
  console.error("usage: npm run mcp:smoke -- <url>   e.g. http://localhost:3000/mcp");
  process.exit(2);
}

let passed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) {
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
    process.exit(1);
  }
  passed += 1;
  console.log(`ok   ${name}${detail ? ` (${detail})` : ""}`);
}

type Row = { id: string; source_url: string; verified_on: string };
const structured = (r: unknown): Record<string, any> => (r as { structuredContent: Record<string, any> }).structuredContent;

async function main(): Promise<void> {
  const client = new Client({ name: "bankjar-mcp-smoke", version: "0.1.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(url!)));

  const info = client.getServerVersion();
  check("initialize", info?.name === "bankjar", `${info?.name} ${info?.version}`);
  check("instructions", (client.getInstructions() ?? "").includes("source_url"));

  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  check("tools/list", names.join(",") === "compare_offers,get_offer,list_goals,rank_bank_apps,search_offers", names.join(","));

  // MCP App: the offer-cards widget is listed, readable, and referenced by the two offer tools.
  const uiTools = tools.filter((t) => (t._meta as { ui?: { resourceUri?: string } } | undefined)?.ui?.resourceUri);
  check("ui tools", uiTools.map((t) => t.name).sort().join(",") === "compare_offers,search_offers", uiTools.map((t) => t.name).join(","));
  const widgetUri = (uiTools[0]!._meta as { ui: { resourceUri: string } }).ui.resourceUri;
  check("ui resourceUri is ui://", widgetUri.startsWith("ui://") && uiTools.every((t) => (t._meta as any).ui.resourceUri === widgetUri), widgetUri);
  const { resources } = await client.listResources();
  const widget = resources.find((r) => r.uri === widgetUri);
  check("resources/list has the widget", widget?.mimeType === "text/html;profile=mcp-app", widget?.mimeType);
  const html = await client.readResource({ uri: widgetUri });
  const page = html.contents[0] as { mimeType?: string; text?: string; _meta?: { ui?: { csp?: Record<string, string[]> } } };
  check("resources/read returns the HTML", page.mimeType === "text/html;profile=mcp-app" && (page.text ?? "").includes("Not financial advice"), `${(page.text ?? "").length} bytes`);
  const csp = page._meta?.ui?.csp ?? {};
  check("widget CSP asks for no origins", Object.values(csp).every((v) => v.length === 0));
  for (const t of tools) {
    const a = t.annotations;
    check(`annotations ${t.name}`, !!a?.title && a.readOnlyHint === true && a.destructiveHint === false && a.idempotentHint === true && a.openWorldHint === false);
  }

  const goals = await client.callTool({ name: "list_goals", arguments: {} });
  check("list_goals", structured(goals).goals?.length === 5, `${structured(goals).goals?.length} goals`);

  const search = await client.callTool({
    name: "search_offers",
    arguments: { query: "best salary bonus", monthly_income_eur: 2500 },
  });
  const rows: Row[] = structured(search).offers ?? [];
  check("search_offers", !search.isError && rows.length > 0 && rows.length <= 10, `${rows.length} rows, goal ${structured(search).goal}`);
  check("search_offers keeps text and structuredContent", ((search as { content: unknown[] }).content ?? []).length === 2 && typeof structured(search).summary === "string" && typeof structured(search).total_offers === "number");
  check("search_offers cites sources", rows.every((r) => /^https?:\/\//.test(r.source_url) && /^\d{4}-\d{2}-\d{2}$/.test(r.verified_on)));

  const first = rows[0];
  if (!first) throw new Error("no rows to continue with");
  const one = await client.callTool({ name: "get_offer", arguments: { id: first.id } });
  check("get_offer", !one.isError && structured(one).full_offer?.id === first.id, first.id);

  const missing = await client.callTool({ name: "get_offer", arguments: { id: "no-such-offer" } });
  check("get_offer unknown id is an error result", missing.isError === true);

  const ids = rows.slice(0, 2).map((r) => r.id);
  if (ids.length === 2) {
    const cmp = await client.callTool({ name: "compare_offers", arguments: { ids } });
    check("compare_offers", !cmp.isError && structured(cmp).offers?.length === 2, ids.join(" vs "));
    check("compare_offers has missing[] for the widget", Array.isArray(structured(cmp).missing));
  } else {
    console.log("skip compare_offers (fewer than 2 rows)");
  }

  const apps = await client.callTool({ name: "rank_bank_apps", arguments: { limit: 3 } });
  const appRows: Array<{ score: number; source_urls: string[]; verified_on: string }> = structured(apps).apps ?? [];
  check("rank_bank_apps", !apps.isError && appRows.length <= 3, `${appRows.length} apps`);
  check("rank_bank_apps cites sources", appRows.every((a) => a.source_urls.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(a.verified_on)));

  await client.close();
  console.log(`mcp:smoke passed ${passed} checks against ${url}`);
}

main().catch((e) => {
  console.error("mcp:smoke error:", e);
  process.exit(1);
});
