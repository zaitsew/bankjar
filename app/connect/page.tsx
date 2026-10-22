import type { Metadata } from "next";
import { CopyBlock } from "../../components/CopyBlock";
import { mcpUrl } from "../../components/site";

export const metadata: Metadata = {
  title: "Add BankJar to Claude, ChatGPT or Codex",
  description: "Step-by-step setup of the BankJar connector in Claude, ChatGPT, Codex and Claude Code. Read-only, no sign-in.",
  alternates: { canonical: "/connect" },
  openGraph: { title: "Add BankJar to Claude, ChatGPT or Codex", url: "/connect" },
};

const link = "underline underline-offset-4";

const TOOLS: Array<{ name: string; what: string }> = [
  { name: "search_offers", what: "Ask in words or pass filters; get ranked Spanish bank offers with sources." },
  { name: "get_offer", what: "Every term of one offer, its score breakdown and whether you can take it." },
  { name: "compare_offers", what: "Two to five offers side by side for your profile." },
  { name: "list_goals", what: "The goals BankJar ranks: salary, savings, account, deposit, welcome." },
  { name: "rank_bank_apps", what: "Spanish bank mobile apps ranked by store ratings, freshness and payment features." },
];

const PROMPTS = [
  "Which Spanish bank pays the most for moving a 2,500 euro monthly salary? I can stay 12 months.",
  "I am a non-resident. Which everyday bank account without fees can I open in Spain?",
  "Where can I park 15,000 euros in Spain for a year at the best rate?",
];

export default function ConnectPage() {
  const url = mcpUrl();
  const codexToml = `[mcp_servers.bankjar]\nurl = "${url}"`;
  const claudeCode = `claude mcp add --transport http bankjar ${url}`;
  const jsonConfig = JSON.stringify({ mcpServers: { bankjar: { type: "http", url } } }, null, 2);
  const check = `curl -s -X POST "${url}" \\
  -H "content-type: application/json" \\
  -H "accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

  return (
    <div className="wrap pt-6 sm:pt-10">
      <h1 className="t-title">Add BankJar to Claude, ChatGPT or Codex</h1>
      <p className="muted mt-2 max-w-2xl">
        BankJar is an MCP connector. It lets your AI assistant look up and compare Spanish bank offers from open, dated data. It is read-only, needs no account and no
        sign-in, and cannot open accounts or move money. Its answers are information, not financial advice.
      </p>

      <section aria-labelledby="url-h" className="mt-8 grid max-w-3xl gap-3">
        <h2 id="url-h" className="font-semibold">
          The server URL
        </h2>
        <CopyBlock label="BankJar MCP server URL" code={url} />
        <p className="muted">
          Authentication: none. Transport: Streamable HTTP. Menu names in the apps below change from time to time; look for &ldquo;connectors&rdquo; or &ldquo;MCP
          server&rdquo; if a label differs.
        </p>
      </section>

      <section aria-labelledby="claude-h" className="mt-10 max-w-3xl">
        <h2 id="claude-h" className="font-semibold">
          Claude (claude.ai and Claude Desktop)
        </h2>
        <ol className="mt-2 list-decimal pl-5">
          <li>
            Open{" "}
            <a className={link} href="https://claude.ai/customize/connectors" rel="noopener">
              Customize &gt; Connectors
            </a>
            .
          </li>
          <li>Click <strong>Add custom connector</strong>.</li>
          <li>
            Enter the name <code className="inline">BankJar</code> and the server URL above. If you are asked how to authenticate, choose <strong>No sign-in</strong> and leave the OAuth
            fields empty.
          </li>
          <li>Click <strong>Add</strong>. The connector shows as connected, and its five tools are listed under Tool permissions.</li>
          <li>In a conversation, open <strong>+ &gt; Connectors</strong>, turn BankJar on, and ask a question from the examples below. Approve the tool call when Claude asks.</li>
        </ol>
        <p className="muted mt-2">
          Team and Enterprise plans: an Owner adds the connector once under Organization settings &gt; Connectors (<strong>Add</strong>, then <strong>Custom</strong>), and
          members then find it under Customize &gt; Connectors. The Free plan allows one custom connector.
        </p>
      </section>

      <section aria-labelledby="chatgpt-h" className="mt-10 max-w-3xl">
        <h2 id="chatgpt-h" className="font-semibold">
          ChatGPT
        </h2>
        <ol className="mt-2 list-decimal pl-5">
          <li>
            Open{" "}
            <a className={link} href="https://chatgpt.com/plugins" rel="noopener">
              ChatGPT Plugins
            </a>
            , select the plus button, then <strong>Add custom MCP server</strong>.
          </li>
          <li>Enter the name <code className="inline">BankJar</code> and a short description, for example &ldquo;Compare Spanish bank offers&rdquo;.</li>
          <li>Under <strong>Connection</strong>, enter the server URL above, including the <code className="inline">/mcp</code> path. Set authentication to none.</li>
          <li>Read the risk notice, select <strong>I understand and want to continue</strong>, then <strong>Create as a plugin</strong>. Check that the five tools are listed.</li>
          <li>Start a new chat, type <code className="inline">@</code>, choose BankJar and ask your question.</li>
        </ol>
        <p className="muted mt-2">Whether you can add a custom server depends on your plan and, in a workspace, on your admin&rsquo;s settings.</p>
      </section>

      <section aria-labelledby="codex-h" className="mt-10 grid max-w-3xl gap-3">
        <h2 id="codex-h" className="font-semibold">
          Codex and Claude Code
        </h2>
        <p>
          <strong>Codex.</strong> Add this to <code className="inline">~/.codex/config.toml</code> and restart Codex:
        </p>
        <CopyBlock label="Codex config.toml entry" code={codexToml} />
        <p>
          <strong>Claude Code.</strong> Run once in a terminal:
        </p>
        <CopyBlock label="Claude Code command" code={claudeCode} />
        <p>
          <strong>Any other MCP client</strong> that supports remote servers:
        </p>
        <CopyBlock label="Generic MCP client config" code={jsonConfig} />
      </section>

      <section aria-labelledby="try-h" className="mt-10 max-w-3xl">
        <h2 id="try-h" className="font-semibold">
          Try it
        </h2>
        <ul className="mt-2 list-disc pl-5">
          {PROMPTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="muted mt-2">
          Every offer in an answer carries a source link and the date it was last checked. Open the source before you sign anything.
        </p>
      </section>

      <section aria-labelledby="tools-h" className="mt-10 max-w-3xl">
        <h2 id="tools-h" className="font-semibold">
          What the connector can do
        </h2>
        <ul className="mt-2 grid list-none gap-2 p-0">
          {TOOLS.map((t) => (
            <li key={t.name} className="panel">
              <code className="inline">{t.name}</code> <span className="muted">{t.what}</span>
            </li>
          ))}
        </ul>
        <p className="muted mt-2">All five tools only read public data. Nothing is written, sent to a bank or bought.</p>
      </section>

      <section aria-labelledby="help-h" className="mt-10 grid max-w-3xl gap-3">
        <h2 id="help-h" className="font-semibold">
          If it does not connect
        </h2>
        <p>Check that the server answers from your machine. It should return a JSON list of five tools:</p>
        <CopyBlock label="curl MCP tools list" code={check} />
        <p>
          Still stuck? See{" "}
          <a className={link} href="/support">
            support
          </a>
          . What is sent where is in the{" "}
          <a className={link} href="/privacy">
            privacy policy
          </a>
          , the rules of use in the{" "}
          <a className={link} href="/terms">
            terms
          </a>
          , and the API for developers on{" "}
          <a className={link} href="/agents">
            For agents
          </a>
          .
        </p>
      </section>
    </div>
  );
}
