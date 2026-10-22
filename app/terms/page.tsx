import type { Metadata } from "next";
import { ContactLine } from "../../components/Contact";
import { LEGAL_UPDATED, OPERATOR, REPO_URL } from "../../components/site";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "BankJar is an information tool, not financial advice. Terms for the website, the API and the MCP server, with the data and code licences.",
  alternates: { canonical: "/terms" },
  openGraph: { title: "BankJar terms of use", url: "/terms" },
};

const link = "underline underline-offset-4";

export default function TermsPage() {
  return (
    <div className="wrap pt-6 sm:pt-10">
      <h1 className="t-title">Terms of use</h1>
      <p className="t-caption muted mt-2">Last updated {LEGAL_UPDATED}.</p>

      <div className="prose mt-4">
        <p>
          These terms cover the BankJar website, its JSON API and its MCP server (together, &ldquo;BankJar&rdquo;). BankJar is run by{" "}
          {OPERATOR}. By using it you accept these terms. If you do not, please do not use it.
        </p>

        <h2>1. BankJar is information, not advice</h2>
        <ul>
          <li>
            BankJar compares public bank offers and ranks them by an estimated net value in euros. It is <strong>not financial advice</strong>, not a
            recommendation to sign, and not a personal recommendation for your situation.
          </li>
          <li>BankJar is not a bank, broker or intermediary. It does not open accounts, take deposits, move money or act on your behalf, and its tools cannot do so.</li>
          <li>Banks change their terms without notice. Before you sign anything, read the bank&rsquo;s own conditions at the offer&rsquo;s source link.</li>
          <li>For advice on your own finances, speak to a licensed adviser.</li>
        </ul>

        <h2>2. How the numbers are made</h2>
        <p>
          Each offer is one dated data file with a source link and a <code className="inline">verified_on</code> date. The net value is an estimate for the profile you
          give (income, balance, commitment, residency, how you value gifts), after a 19% withholding tax and the fees the data records. The rules are in the{" "}
          <a className={link} href="/methodology">
            methodology
          </a>{" "}
          and in the open code. An offer not re-checked for 30 days is marked stale; after 60 days it leaves the rankings. Data can still be wrong or out of
          date, and a bank may refuse you an offer for reasons BankJar cannot see.
        </p>
        <p>
          BankJar does not take payment from banks to rank or show an offer, and no paid placement changes the order. If that ever changes, the page that
          shows it will say so and the rule will be in the code.
        </p>

        <h2>3. AI</h2>
        <p>
          An AI model may read your question and turn it into search filters. It never writes the numbers: every euro figure comes from the data files. If you
          use BankJar through an AI assistant, the assistant writes its own answer from BankJar&rsquo;s results. That answer is the assistant&rsquo;s, can
          contain mistakes, and is not checked by BankJar. See the{" "}
          <a className={link} href="/privacy">
            privacy policy
          </a>{" "}
          for what is sent where.
        </p>

        <h2>4. Fair use</h2>
        <ul>
          <li>The site, API and MCP server are free to use and need no key. Do not overload them, probe them for weaknesses or work around their rate limits.</li>
          <li>Automated use is welcome through the API, the MCP server and the open dataset. If you need the whole dataset, download <code className="inline">/data/offers.json</code> once instead of crawling.</li>
          <li>Do not use BankJar to mislead people, for example by presenting an old or edited table as a current one.</li>
          <li>We may rate-limit or block traffic that harms the service for others.</li>
        </ul>

        <h2>5. Licences</h2>
        <ul>
          <li>
            <strong>Data</strong> (the offers and bank-app files in <code className="inline">data/</code>, and <code className="inline">/data/offers.json</code>): Creative Commons
            Attribution 4.0 (CC BY 4.0). Credit &ldquo;BankJar (github.com/zaitsew/bankjar)&rdquo; and, when you show an offer, its source link and verification date.
          </li>
          <li>
            <strong>Code</strong>: Apache License 2.0, in the{" "}
            <a className={link} href={REPO_URL} rel="noopener">
              repository
            </a>
            .
          </li>
          <li>Bank names and brands belong to their owners. BankJar is not affiliated with, sponsored by or endorsed by any bank, Anthropic, OpenAI or any AI assistant it works with.</li>
        </ul>

        <h2>6. No warranty, limited liability</h2>
        <p>
          BankJar is provided &ldquo;as is&rdquo;, free of charge and without any warranty that it is accurate, complete, current or always available. To the
          extent the law allows, the operator is not liable for losses that come from relying on BankJar, including a missed or changed offer. Nothing here limits
          liability that cannot be limited by law, and nothing removes the rights a consumer has under mandatory law in their country.
        </p>

        <h2>7. Links to other sites</h2>
        <p>
          Each offer links to the page its terms were read from. That is usually the bank&rsquo;s own page. A few offers cite a third-party page, such as a deposit
          marketplace or a news article; the address of the link shows which. BankJar does not control those sites or their content. BankJar adds no affiliate or
          tracking code to these links.
        </p>

        <h2>8. Changes and availability</h2>
        <p>
          BankJar may change, pause or stop at any time. These terms are{" "}
          <a className={link} href={`${REPO_URL}/blob/main/app/terms/page.tsx`} rel="noopener">
            a file in the repository
          </a>
          : changes are public and dated, and the date above changes with them. Using BankJar after a change means you accept it.
        </p>

        <h2>9. Contact</h2>
        <ContactLine />
        <p>
          See{" "}
          <a className={link} href="/support">
            support
          </a>{" "}
          to report a wrong offer.
        </p>
      </div>
    </div>
  );
}
