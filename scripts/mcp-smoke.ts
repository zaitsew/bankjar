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
  check("tools/list", names.join(",") === "compare_offers,get_offer,list_goals,search_offers", names.join(","));

  const goals = await client.callTool({ name: "list_goals", arguments: {} });
  check("list_goals", structured(goals).goals?.length === 5, `${structured(goals).goals?.length} goals`);

  const search = await client.callTool({
    name: "search_offers",
    arguments: { query: "best salary bonus", monthly_income_eur: 2500 },
  });
  const rows: Row[] = structured(search).offers ?? [];
  check("search_offers", !search.isError && rows.length > 0 && rows.length <= 10, `${rows.length} rows, goal ${structured(search).goal}`);
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
  } else {
    console.log("skip compare_offers (fewer than 2 rows)");
  }

  await client.close();
  console.log(`mcp:smoke passed ${passed} checks against ${url}`);
}

main().catch((e) => {
  console.error("mcp:smoke error:", e);
  process.exit(1);
});
