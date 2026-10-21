import type { Metadata } from "next";
import { CopyBlock } from "../../components/CopyBlock";
import { REPO_URL, absolute } from "../../components/site";

export const metadata: Metadata = {
  title: "For AI agents",
  description: "JSON API, OpenAPI, MCP server, llms.txt and an open dataset: how an AI agent queries BankJar and cites it.",
  alternates: { canonical: "/agents" },
  openGraph: { title: "BankJar for AI agents", url: "/agents" },
};

const ENDPOINTS: Array<{ method: string; path: string; what: string }> = [
  { method: "GET", path: "/api/v1/search?q=", what: "The search box as JSON: parsed intent, ranked offers, a summary. Same pipeline as the site." },
  { method: "GET", path: "/api/v1/offers", what: "Ranked offers for filters you already know: goal, income, max_commitment, residency, gift_factor." },
  { method: "GET", path: "/api/v1/offers/{id}", what: "One offer with every term, its score breakdown, verified_on and source_url." },
  { method: "GET", path: "/api/v1/compare?ids=a,b", what: "Two or three offers side by side." },
  { method: "GET", path: "/openapi.json", what: "OpenAPI 3 description of the endpoints above." },
  { method: "GET", path: "/llms.txt", what: "What BankJar is and how to query it, in plain text for language models." },
  { method: "GET", path: "/data/offers.json", what: "The whole dataset, CC BY 4.0. The same files are in the repository." },
  { method: "POST", path: "/mcp", what: "A remote MCP server over Streamable HTTP, no session needed." },
];

const TOOLS: Array<{ name: string; what: string }> = [
  { name: "search_offers", what: "Ask in words or pass filters. Returns ranked offers with sources." },
  { name: "get_offer", what: "One offer by id." },
  { name: "compare_offers", what: "Two or three offers in one grid." },
  { name: "list_goals", what: "The goals BankJar ranks: salary, savings, account, deposit, welcome." },
];

export default function AgentsPage() {
  const base = absolute("/").replace(/\/$/, "");
  const curlSearch = `curl -s "${base}/api/v1/search?q=best%20bank%20offer%20for%20transferring%20my%20salary"`;
  const curlOffers = `curl -s "${base}/api/v1/offers?goal=salary&income=2500&max_commitment=12"`;
  const curlMcp = `curl -s -X POST "${base}/mcp" \\
  -H "content-type: application/json" \\
  -H "accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
  const mcpConfig = JSON.stringify({ mcpServers: { bankjar: { type: "http", url: `${base}/mcp` } } }, null, 2);

  return (
    <div className="wrap pt-6 sm:pt-10">
      <h1 className="t-title">For AI agents</h1>
      <p className="muted mt-2 max-w-2xl">
        Every number on this site comes from a dated, sourced data file. An agent gets the same table as a person, with{" "}
        <code className="inline">verified_on</code> and <code className="inline">source_url</code> on every row. Cite both.
        BankJar is not financial advice.
      </p>

      <section aria-labelledby="ep-h" className="mt-8">
        <h2 id="ep-h" className="font-semibold">
          Endpoints
        </h2>
        <div className="tbl-shell mt-2">
          <div className="tbl-wrap">
            <table className="rt">
              <caption className="sr-only">BankJar endpoints for agents</caption>
              <thead>
                <tr>
                  <th scope="col">Method</th>
                  <th scope="col">Path</th>
                  <th scope="col">What it returns</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((e) => (
                  <tr key={e.path}>
                    <td>
                      <span className="badge badge-none">{e.method}</span>
                    </td>
                    <th scope="row" className="font-normal">
                      <code className="inline break-all">{e.path}</code>
                    </th>
                    <td>{e.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="ex-h" className="mt-10 grid max-w-3xl gap-4">
        <h2 id="ex-h" className="font-semibold">
          Examples
        </h2>
        <CopyBlock label="curl search example" code={curlSearch} />
        <CopyBlock label="curl offers example" code={curlOffers} />
      </section>

      <section aria-labelledby="mcp-h" className="mt-10 grid max-w-3xl gap-4">
        <h2 id="mcp-h" className="font-semibold">
          MCP server
        </h2>
        <p className="muted">
          Add this to an MCP client that supports remote servers. Tools:
        </p>
        <ul className="grid list-none gap-2 p-0">
          {TOOLS.map((t) => (
            <li key={t.name} className="panel">
              <code className="inline">{t.name}</code> <span className="muted">{t.what}</span>
            </li>
          ))}
        </ul>
        <CopyBlock label="MCP client config" code={mcpConfig} />
        <CopyBlock label="curl MCP tools list" code={curlMcp} />
      </section>

      <section aria-labelledby="rules-h" className="mt-10 max-w-3xl">
        <h2 id="rules-h" className="font-semibold">
          Rules for citing
        </h2>
        <ul className="mt-2 list-disc pl-5">
          <li>Quote the net value together with its commitment and the gift factor used.</li>
          <li>
            Say when an offer was checked (<code className="inline">verified_on</code>) and link <code className="inline">source_url</code>.
          </li>
          <li>Offers marked stale were not re-checked for 30 days. Say so.</li>
          <li>
            Data is CC BY 4.0: credit BankJar. Code is Apache-2.0 on{" "}
            <a className="underline underline-offset-4" href={REPO_URL} rel="noopener">
              GitHub
            </a>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}
