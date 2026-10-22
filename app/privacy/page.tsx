import type { Metadata } from "next";
import { ContactLine } from "../../components/Contact";
import { LEGAL_UPDATED, OPERATOR, REPO_URL, SECURITY_URL, absolute } from "../../components/site";
import { AI_TIMEOUT_MS } from "../../src/server/ai";
import { CACHE_MAX_ENTRIES, CACHE_TTL_MS } from "../../src/server/cache";
import { AI_PER_IP_PER_HOUR } from "../../src/server/ratelimit";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What BankJar handles when you search, which providers receive it, how long it is kept and what you can control. No accounts, no analytics, no ads.",
  alternates: { canonical: "/privacy" },
  openGraph: { title: "BankJar privacy policy", url: "/privacy" },
};

const link = "underline underline-offset-4";

/** Figures that come from the code, so the page cannot drift from it (tests/directory.test.ts checks the rest). */
const CACHE_HOURS = CACHE_TTL_MS / 3_600_000;
const AI_TIMEOUT_S = AI_TIMEOUT_MS / 1000;

export default function PrivacyPage() {
  const mcp = absolute("/mcp");
  return (
    <div className="wrap pt-6 sm:pt-10">
      <h1 className="t-title">Privacy policy</h1>
      <p className="t-caption muted mt-2">Last updated {LEGAL_UPDATED}. This policy matches the code in the repository; every statement below can be checked there.</p>

      <div className="prose mt-4">
        <p>
          BankJar compares Spanish bank offers. It has no accounts, no sign-in and no database of its users. This page says what the
          site, the JSON API and the MCP server at <code className="inline">{mcp}</code> handle when you use them, who receives it,
          how long it stays and what you can control. The operator is {OPERATOR}.
        </p>

        <h2>Data we handle, and why</h2>
        <div className="table-scroll" role="region" aria-label="What BankJar handles, why, where it goes and how long" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Why</th>
              <th scope="col">Where it goes</th>
              <th scope="col">How long</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Your question, and the filters you or your AI assistant send: monthly income, balance, residency, longest commitment, banks where you already are a customer, gift preference</th>
              <td>To rank the offers you asked about.</td>
              <td>The server reads them from the request (the URL on the website and the REST API, the request body on MCP) and answers. They are not written to a database or a log file.</td>
              <td>Not kept. They live in server memory while the answer is built.</td>
            </tr>
            <tr>
              <th scope="row">The text of a question, only when the rule parser cannot place it</th>
              <td>To read the filters out of your sentence with AI (see below).</td>
              <td>The accounts hub, then Anthropic. Only the question text, cut to 500 characters. Filters sent as separate fields are not sent.</td>
              <td>See &ldquo;Providers that receive data&rdquo;.</td>
            </tr>
            <tr>
              <th scope="row">Your IP address, on a search that reaches the AI step</th>
              <td>To limit AI calls to {AI_PER_IP_PER_HOUR} per address per hour, and to give the hub a daily pseudonym for its budget.</td>
              <td>Held in server memory for the limiter. The hub gets a pseudonym, never the address: the first 16 characters of a SHA-256 hash of address, a secret salt and the UTC date.</td>
              <td>The counter lasts one hour and is lost on a restart. The pseudonym changes every day, so it cannot follow you from one day to the next.</td>
            </tr>
            <tr>
              <th scope="row">AI filters, cached</th>
              <td>To avoid asking the AI the same question twice.</td>
              <td>Server memory only, filed under the lower-cased question. At most {CACHE_MAX_ENTRIES} entries.</td>
              <td>{CACHE_HOURS} hours, or until a restart.</td>
            </tr>
            <tr>
              <th scope="row">One cookie, <code className="inline">bj_v</code></th>
              <td>To remember which of two page layouts you picked.</td>
              <td>Your browser. It holds the letter a or b and is sent back to BankJar with each request.</td>
              <td>One year, or until you clear it. It is set only when you use the Layout switch in the footer or open a link with <code className="inline">?v=</code>.</td>
            </tr>
            <tr>
              <th scope="row">Connection data (IP address, time, requested URL) held by the host</th>
              <td>The server and the network it sits on need it to deliver pages.</td>
              <td>The hosting provider, DigitalOcean. BankJar&rsquo;s own web server writes no access log and the shared proxy in front of it has none configured.</td>
              <td>As the provider keeps it; BankJar does not read or export it.</td>
            </tr>
            <tr>
              <th scope="row">Error lines</th>
              <td>To see when the AI step falls back to rules.</td>
              <td>The container&rsquo;s standard output: one line such as <code className="inline">fallback to rules: timeout</code>. It never contains your question or filters.</td>
              <td>Three rotating files of 10 MB, then overwritten.</td>
            </tr>
          </tbody>
        </table>
        </div>
        <p>
          BankJar never asks for your name, e-mail address, bank account or card number, passport or tax number, or a password, and you
          should not type them into a question. It does not collect health data or any other special category of data. Residency
          status (resident, NIE/TIE holder, non-resident) is used only as a filter, because some offers are closed to some groups.
        </p>

        <h2>What we do not do</h2>
        <ul>
          <li>No analytics, advertising, tracking pixels, fingerprinting or session replay, on the site or in the API.</li>
          <li>No third-party scripts, and no request to another site when a page loads. The fonts are served by BankJar itself.</li>
          <li>No accounts and no profile of you. Two searches from the same person are not linked.</li>
          <li>No sale or rental of data, and no data broker. No bank pays to be ranked higher, and no bank receives your search.</li>
          <li>No tracking parameter is added to a link to a bank&rsquo;s page. If you follow it, the bank sees that the visit came from this site (the browser sends the site&rsquo;s address, not your search), as with any link.</li>
        </ul>

        <h2>Providers that receive data</h2>
        <div className="table-scroll" role="region" aria-label="Providers that receive data" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Recipient</th>
              <th scope="col">What it receives</th>
              <th scope="col">Role</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Anthropic PBC (Claude Haiku)</th>
              <td>The question text (up to 500 characters) and the daily pseudonym, only on an AI-assisted search.</td>
              <td>
                AI processor. It turns the sentence into search filters and returns them. It handles the text under Anthropic&rsquo;s
                commercial terms and may keep inputs and outputs for a limited time under them; see{" "}
                <a className={link} href="https://www.anthropic.com/legal/privacy" rel="noopener">
                  Anthropic&rsquo;s privacy policy
                </a>
                .
              </td>
            </tr>
            <tr>
              <th scope="row">Fabrique accounts hub (run by the operator, hosted on Supabase in the EU)</th>
              <td>The same question text and pseudonym, and a usage record per call: product name, model, token counts, cost, time.</td>
              <td>
                Passes the call to Anthropic and keeps the monthly spend within a budget. The usage record does not contain the
                question text. It is kept as a billing record and is not linked to a named person.
              </td>
            </tr>
            <tr>
              <th scope="row">DigitalOcean, LLC</th>
              <td>All traffic to the server, as any host sees it.</td>
              <td>Hosting provider.</td>
            </tr>
            <tr>
              <th scope="row">Your AI assistant (for example Claude, ChatGPT or Codex)</th>
              <td>It sends BankJar the arguments of a tool call. BankJar sees nothing else of your conversation or account.</td>
              <td>
                Your own choice of service. What it does with your conversation is covered by its provider&rsquo;s privacy policy,
                not this one.
              </td>
            </tr>
            <tr>
              <th scope="row">GitHub, Inc.</th>
              <td>Only what you post if you open an issue (public), and the source code that lives there.</td>
              <td>Code host and issue tracker.</td>
            </tr>
          </tbody>
        </table>
        </div>
        <p>
          The AI step is a fallback: the rule parser runs first on the server, and the AI is asked only when the rules cannot place the goal. If the AI is unavailable, over its limit or slow ({AI_TIMEOUT_S} seconds), the rule parser
          answers and nothing leaves the server. The AI never writes a number you see; every euro figure comes from the dated data
          files in the repository.
        </p>

        <h2>Why we may use this data</h2>
        <p>
          For people in the EU or UK, the basis is our legitimate interest (GDPR Art. 6(1)(f)) in answering your request, keeping the
          free service within its budget and protecting it from abuse. We keep only what these purposes need.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>
            <strong>Skip the AI.</strong> Send filters instead of a sentence: on the REST API use the parameters{" "}
            <code className="inline">goal</code>, <code className="inline">income</code>, <code className="inline">balance</code> and the
            others listed in{" "}
            <a className={link} href="/openapi.json">
              /openapi.json
            </a>
            ; in an MCP tool call leave <code className="inline">query</code> empty. Nothing then goes to the hub or to Anthropic.
          </li>
          <li>Leave personal details out of a question. BankJar does not need them.</li>
          <li>Delete the <code className="inline">bj_v</code> cookie in your browser settings at any time.</li>
          <li>
            Because there is no account and no stored profile, there is usually nothing of yours to look up or delete. You still have the
            rights the GDPR gives you (access, correction, deletion, objection, restriction, portability) and the right to complain to
            your data protection authority. Write to the contact below and we answer within one month.
          </li>
        </ul>

        <h2>Security</h2>
        <p>
          The site is served over HTTPS with HSTS. The salt that hashes your address is a secret kept on the server. The AI service
          token is kept on the server and never reaches a browser. To report a vulnerability, use{" "}
          <a className={link} href={SECURITY_URL} rel="noopener">
            GitHub&rsquo;s private advisory form
          </a>
          .
        </p>

        <h2>Children</h2>
        <p>BankJar is for adults who compare bank products. It is not directed at children, and it collects nothing that identifies anyone.</p>

        <h2>Changes</h2>
        <p>
          This page is{" "}
          <a className={link} href={`${REPO_URL}/blob/main/app/privacy/page.tsx`} rel="noopener">
            a file in the repository
          </a>
          , so every change is public and dated in its history. If a change widens what is collected, the date above changes and the
          change is described in the commit.
        </p>

        <h2>Contact</h2>
        <p>
          {OPERATOR} is the operator and the data controller for the data described here.
        </p>
        <ContactLine />
      </div>
    </div>
  );
}
