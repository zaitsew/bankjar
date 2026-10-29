import type { Metadata } from "next";
import { ContactLine } from "../../components/Contact";
import { LEGAL_UPDATED } from "../../components/site";
import { CACHE_MAX_ENTRIES, CACHE_TTL_MS } from "../../src/server/cache";

export const metadata: Metadata = {
  title: "Delete your data",
  description: "BankJar has no accounts and stores no profile. What exists about a search, how long it lasts and how to ask for deletion.",
  alternates: { canonical: "/data-deletion" },
  openGraph: { title: "Delete your BankJar data", url: "/data-deletion" },
};

const link = "underline underline-offset-4";
const CACHE_HOURS = CACHE_TTL_MS / 3_600_000;

export default function DataDeletionPage() {
  return (
    <div className="wrap pt-6 sm:pt-10">
      <h1 className="t-title">Delete your data</h1>
      <p className="t-caption muted mt-2">Last updated {LEGAL_UPDATED}. The full policy is on the <a className={link} href="/privacy">privacy page</a>.</p>

      <div className="prose mt-4">
        <p>
          BankJar has no accounts, no sign-in and no database of its users, so there is no profile to delete. This page says what exists
          about a search, when it disappears and how to ask for more.
        </p>

        <h2>What exists, and when it goes</h2>
        <ul>
          <li>
            <strong>Your question and filters.</strong> Held in server memory while the answer is built. Not written to a database or a
            log. Gone when the answer is sent.
          </li>
          <li>
            <strong>AI filters, cached.</strong> When the rule parser cannot place a question, the filters read from it are cached in server
            memory under the lower-cased question, at most {CACHE_MAX_ENTRIES} entries, for {CACHE_HOURS} hours. A restart empties the cache.
          </li>
          <li>
            <strong>Rate-limit counter.</strong> Your IP address in server memory for one hour. A restart empties it.
          </li>
          <li>
            <strong>The cookie <code className="inline">bj_v</code>.</strong> Stored in your browser. Delete it in your browser settings.
          </li>
          <li>
            <strong>The accounts hub usage record.</strong> One record per AI call: product, model, token counts, cost, time. It holds no
            question text and is not linked to a named person.
          </li>
        </ul>

        <h2>Ask for deletion</h2>
        <p>
          If you think BankJar holds something about you, ask. Say what you sent and roughly when. Because nothing is stored against a
          name, we usually can only confirm that nothing is held. We answer within one month.
        </p>
        <ContactLine />

        <h2>Data held by other services</h2>
        <p>
          Your AI assistant keeps its own conversation history under its provider&rsquo;s policy. Delete it there. A GitHub issue you
          opened is public on GitHub; edit or delete it there.
        </p>
      </div>
    </div>
  );
}
