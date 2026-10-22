import type { Metadata } from "next";
import { ContactLine } from "../../components/Contact";
import { dateLabel } from "../../components/format";
import { ISSUES_URL, REPO_URL, SECURITY_URL } from "../../components/site";
import { HIDDEN_AFTER_DAYS, STALE_AFTER_DAYS, daysBetween, isHidden, isStale } from "../../src/core/score";
import { todayIso } from "../../src/server/api";
import { allOffers, datasetVersion } from "../../src/server/data";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Support",
  description: "How to reach BankJar, report a wrong offer, and see how fresh the data is today.",
  alternates: { canonical: "/support" },
  openGraph: { title: "BankJar support", url: "/support" },
};

const link = "underline underline-offset-4";

export default function SupportPage() {
  const today = todayIso();
  const offers = allOffers();
  const ds = datasetVersion(offers);
  const hidden = offers.filter((o) => isHidden(o, today)).length;
  const stale = offers.filter((o) => !isHidden(o, today) && isStale(o, today)).length;
  const fresh = offers.length - hidden - stale;
  const age = ds.latest_verified_on ? daysBetween(ds.latest_verified_on, today) : null;

  return (
    <div className="wrap pt-6 sm:pt-10">
      <h1 className="t-title">Support</h1>
      <p className="muted mt-2 max-w-2xl">Something wrong, missing or not working? Here is where to say so, and how fresh the data is right now.</p>

      <div className="prose mt-4">
        <h2>Contact</h2>
        <ContactLine />
        <p>
          Reports are read on a best-effort basis; there is no service-level promise. BankJar is run by one person. A report with an offer id and a source link gets
          fixed fastest.
        </p>

        <h2>Report a wrong or missing offer</h2>
        <ol>
          <li>
            Open{" "}
            <a className={link} href={`${ISSUES_URL}/new`} rel="noopener">
              a GitHub issue
            </a>
            .
          </li>
          <li>Give the offer id (the last part of its page address, for example <code className="inline">/offer/bbva-salary-cuenta-online</code>) or the bank and product.</li>
          <li>Say what is wrong and link the bank&rsquo;s page that shows the correct terms.</li>
        </ol>
        <p>
          Offers are plain files, so you can also fix one yourself: see &ldquo;Contributing an offer&rdquo; in the{" "}
          <a className={link} href={`${REPO_URL}#contributing-an-offer`} rel="noopener">
            README
          </a>
          .
        </p>

        <h2>Report a bug in the site, API or MCP server</h2>
        <p>
          Use the same issue tracker. Include the address or tool call, what you expected and what you got. Do not include personal data.
        </p>

        <h2>Report a security problem</h2>
        <p>
          Use{" "}
          <a className={link} href={SECURITY_URL} rel="noopener">
            GitHub&rsquo;s private advisory form
          </a>{" "}
          so it is not public until it is fixed.
        </p>

        <h2>Data freshness today</h2>
        <table>
          <caption className="sr-only">Offer freshness on {today}</caption>
          <tbody>
            <tr>
              <th scope="row">Offers in the dataset</th>
              <td className="num">{offers.length}</td>
            </tr>
            <tr>
              <th scope="row">Latest check</th>
              <td className="num">
                {ds.latest_verified_on ? `${dateLabel(ds.latest_verified_on)}${age !== null ? ` (${age === 0 ? "today" : `${age} day${age === 1 ? "" : "s"} ago`})` : ""}` : "none yet"}
              </td>
            </tr>
            <tr>
              <th scope="row">Fresh (checked in the last {STALE_AFTER_DAYS} days)</th>
              <td className="num">{fresh}</td>
            </tr>
            <tr>
              <th scope="row">Stale (flagged, terms may have changed)</th>
              <td className="num">{stale}</td>
            </tr>
            <tr>
              <th scope="row">Hidden (older than {HIDDEN_AFTER_DAYS} days or expired; in no ranking)</th>
              <td className="num">{hidden}</td>
            </tr>
          </tbody>
        </table>
        <p>
          Dataset version <span className="num">{ds.version}</span>. The same figures as JSON: <a className={link} href="/api/v1/goals">/api/v1/goals</a> carries the version, every ranking carries{" "}
          <code className="inline">dataset.latest_verified_on</code>.
        </p>

        <h2>Quick checks</h2>
        <ul>
          <li>
            <a className={link} href="/api/v1/goals">
              /api/v1/goals
            </a>{" "}
            answers with the goals when the service is up.
          </li>
          <li>
            Opening <code className="inline">/mcp</code> in a browser answers with a short description of the MCP server. MCP clients use POST.
          </li>
          <li>
            Setup steps for Claude, ChatGPT and Codex are on{" "}
            <a className={link} href="/connect">
              /connect
            </a>
            ; the rules for the numbers are on{" "}
            <a className={link} href="/methodology">
              /methodology
            </a>
            .
          </li>
        </ul>
      </div>
    </div>
  );
}
