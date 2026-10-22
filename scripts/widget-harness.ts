/**
 * Dev-only harness for the MCP App offer cards: builds one static HTML page that plays the host.
 *
 *   npx tsx scripts/widget-harness.ts [out-dir]        # default: runs/widget-harness
 *   open runs/widget-harness/index.html?s=salary&theme=dark&w=390
 *
 * The scenarios are real tool calls: each one calls the MCP server in process (InMemoryTransport),
 * so structuredContent is exactly what a host receives. The widget HTML comes from resources/read.
 * The page loads the widget in a sandboxed iframe and speaks the MCP Apps bridge as a host would:
 * it answers ui/initialize with theme and Claude-style CSS variables, pushes ui/notifications/tool-result,
 * follows size-changed and logs ui/open-link. Query: s = scenario id, theme = light | dark, w = column
 * width in px, mutate=stale marks the first row stale and the last row negative (visual check only).
 *
 * Screenshots for the directory listing are taken from this page; see docs/directory/prompts.md.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/server/mcp";

interface Scenario {
  id: string;
  prompt: string;
  tool: "search_offers" | "compare_offers";
  args: Record<string, unknown>;
}

/** Scenario ids and prompts are mirrored in docs/directory/prompts.md. */
const SCENARIOS: Scenario[] = [
  {
    id: "salary",
    prompt: "What is the best salary-account bonus in Spain if I earn 2,500 euros a month?",
    tool: "search_offers",
    args: { query: "best salary account bonus", monthly_income_eur: 2500 },
  },
  {
    id: "savings",
    prompt: "Where can I park 15,000 euros for a year with no lock-in and earn the most?",
    tool: "search_offers",
    args: { query: "where to park my savings", balance_eur: 15000, max_commitment_months: 0 },
  },
  {
    id: "account",
    prompt: "I just moved to Spain on a NIE and have no payslip yet. Which free account can I open?",
    tool: "search_offers",
    args: { query: "free account", goal: "account", residency: "nie_tie" },
  },
  {
    id: "welcome",
    prompt: "Which bank gives the best welcome bonus for new customers?",
    tool: "search_offers",
    args: { query: "best welcome bonus for new customers", goal: "welcome" },
  },
];

const VARS: Record<"light" | "dark", Record<string, string>> = {
  light: {
    "--color-background-primary": "#FFFFFF", "--color-background-secondary": "#F5F4ED", "--color-background-inverse": "#141413",
    "--color-background-success": "#E9F1DC", "--color-background-warning": "#F6EEDF", "--color-background-danger": "#F7ECEC",
    "--color-text-primary": "#141413", "--color-text-secondary": "#3D3D3A", "--color-text-tertiary": "#73726C", "--color-text-inverse": "#FFFFFF",
    "--color-text-success": "#265B19", "--color-text-warning": "#5A4815", "--color-text-danger": "#7F2C28",
    "--color-border-secondary": "rgba(31, 30, 29, 0.3)", "--color-border-tertiary": "rgba(31, 30, 29, 0.15)",
    "--color-ring-info": "rgba(50, 102, 173, 0.5)",
    "--border-radius-md": "8px", "--border-radius-lg": "10px", "--border-width-regular": "0.5px",
    "--font-sans": "system-ui, sans-serif",
  },
  dark: {
    "--color-background-primary": "#30302E", "--color-background-secondary": "#262624", "--color-background-inverse": "#FAF9F5",
    "--color-background-success": "#1B4614", "--color-background-warning": "#483A0F", "--color-background-danger": "#602A28",
    "--color-text-primary": "#FAF9F5", "--color-text-secondary": "#C2C0B6", "--color-text-tertiary": "#9C9A92", "--color-text-inverse": "#141413",
    "--color-text-success": "#7AB948", "--color-text-warning": "#D1A041", "--color-text-danger": "#EE8884",
    "--color-border-secondary": "rgba(222, 220, 209, 0.3)", "--color-border-tertiary": "rgba(222, 220, 209, 0.15)",
    "--color-ring-info": "rgba(128, 170, 221, 0.5)",
    "--border-radius-md": "8px", "--border-radius-lg": "10px", "--border-width-regular": "0.5px",
    "--font-sans": "system-ui, sans-serif",
  },
};

/** JSON that is safe inside an inline <script>. */
const js = (v: unknown): string => JSON.stringify(v).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, " ");

async function main(): Promise<void> {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer();
  const client = new Client({ name: "widget-harness", version: "0" });
  await Promise.all([server.connect(a), client.connect(b)]);

  const { resources } = await client.listResources();
  const res = resources.find((r) => r.mimeType === "text/html;profile=mcp-app");
  if (!res) throw new Error("the server lists no MCP App resource");
  const read = await client.readResource({ uri: res.uri });
  const html = (read.contents[0] as { text: string }).text;

  const scenarios: Array<{ id: string; prompt: string; tool: string; result: unknown }> = [];
  for (const s of SCENARIOS) {
    const result = await client.callTool({ name: s.tool, arguments: s.args });
    if (result.isError) throw new Error(`${s.id}: ${JSON.stringify(result.content)}`);
    scenarios.push({ id: s.id, prompt: s.prompt, tool: s.tool, result });
  }
  // A comparison of the first three salary rows, then the same ids for a person who cannot take some.
  const salaryRows = (scenarios[0]!.result as { structuredContent: { offers: Array<{ id: string }> } }).structuredContent.offers;
  const ids = salaryRows.slice(0, 3).map((o) => o.id);
  const compare = await client.callTool({ name: "compare_offers", arguments: { ids, monthly_income_eur: 2500 } });
  scenarios.push({ id: "compare", prompt: "Compare the top three of those side by side for me.", tool: "compare_offers", result: compare });
  const strict = await client.callTool({ name: "compare_offers", arguments: { ids, monthly_income_eur: 300, residency: "non_resident" } });
  scenarios.push({ id: "compare-excluded", prompt: "Compare the same three if I earn 300 euros a month and live outside Spain.", tool: "compare_offers", result: strict });
  await client.close();

  const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>BankJar widget harness</title>
<style>
  html, body { margin: 0; }
  body { font: 14px system-ui, sans-serif; min-height: 100vh; }
  body[data-theme="light"] { background: #faf9f5; color: #141413; }
  body[data-theme="dark"] { background: #262624; color: #faf9f5; }
  #col { margin: 0 auto; padding: 16px 0; }
  #f { display: block; width: 100%; border: 0; background: transparent; height: 120px; }
  #log { font: 12px ui-monospace, monospace; opacity: .7; padding: 8px 16px; }
  .hide-chrome #log { display: none; }
</style></head>
<body>
<div id="col"><iframe id="f" sandbox="allow-scripts" title="BankJar offers"></iframe></div>
<pre id="log"></pre>
<script>
const WIDGET_HTML = ${js(html)};
const SCENARIOS = ${js(scenarios)};
const VARS = ${js(VARS)};
const q = new URLSearchParams(location.search);
const sc = SCENARIOS.find((s) => s.id === (q.get("s") || "salary")) || SCENARIOS[0];
const theme = q.get("theme") === "dark" ? "dark" : "light";
const width = Math.max(320, Number(q.get("w")) || 720);
document.body.dataset.theme = theme;
if (q.get("chrome") === "0") document.body.classList.add("hide-chrome");
document.getElementById("col").style.width = width + "px";
const frame = document.getElementById("f");
const log = document.getElementById("log");
window.__links = [];
window.__ready = false;
const result = JSON.parse(JSON.stringify(sc.result));
if (q.get("mutate") === "stale") {
  const rows = result.structuredContent.offers;
  if (rows[0]) rows[0].stale = true;
  if (rows.length > 1) rows[rows.length - 1].score.net_value_eur = -42;
}
const post = (m) => frame.contentWindow.postMessage(Object.assign({ jsonrpc: "2.0" }, m), "*");
window.addEventListener("message", (e) => {
  if (e.source !== frame.contentWindow) return;
  const m = e.data;
  if (!m || m.jsonrpc !== "2.0") return;
  if (m.method === "ui/initialize") {
    post({ id: m.id, result: { protocolVersion: m.params.protocolVersion, hostInfo: { name: "bankjar-harness", version: "0" }, hostCapabilities: { openLinks: {} },
      hostContext: { theme, locale: "en-GB", styles: { variables: VARS[theme] }, safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 } } } });
  } else if (m.method === "ui/notifications/initialized") {
    post({ method: "ui/notifications/tool-result", params: result });
  } else if (m.method === "ui/notifications/size-changed") {
    frame.style.height = m.params.height + "px";
    window.__ready = true;
  } else if (m.method === "ui/open-link") {
    window.__links.push(m.params.url);
    log.textContent += "ui/open-link " + m.params.url + "\\n";
    post({ id: m.id, result: {} });
  }
});
frame.srcdoc = WIDGET_HTML;
</script></body></html>
`;

  const out = resolve(process.argv[2] ?? join("runs", "widget-harness"));
  mkdirSync(out, { recursive: true });
  const file = join(out, "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, page);
  console.log(`wrote ${file} (${(page.length / 1024).toFixed(0)} KB, ${scenarios.length} scenarios: ${scenarios.map((s) => s.id).join(", ")})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
