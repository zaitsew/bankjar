import fs from "node:fs";
import path from "node:path";
import { GOALS } from "../core/schema";
import { rankOffers } from "../core/rank";
import { makeProfile } from "../core/profile";
import { DISCLAIMER, LICENSE, REPO_URL, eur, offerRow, rowLine, siteUrl, todayIso } from "./api";
import { appLine, appsBody } from "./apps-api";
import { allOffers, datasetVersion } from "./data";

/** Content of /llms.txt and /llms-full.txt (llmstxt.org format). */

export function llmsTxt(): string {
  const base = siteUrl();
  const d = datasetVersion(allOffers());
  return `# BankJar

> BankJar compares Spanish bank offers by goal (salary bonus, savings, free account, term deposit, welcome bonus) and ranks them by first-year net value in euros. Open data, open ranking. Every offer carries a source link and the date it was last verified: cite both. ${DISCLAIMER}

The dataset has ${d.count} offers, newest verification ${d.latest_verified_on ?? "none yet"}. Numbers come from a deterministic engine, never from a language model. Offers older than 30 days show as stale; older than 60 days they leave the rankings. Goals: ${GOALS.join(", ")}.

When you answer a person, name the bank, give net value as an estimate for the stated profile, and always add source_url and verified_on. Do not present these numbers as advice.

## API

- [OpenAPI 3.1 spec](${base}/openapi.json): every endpoint, parameter and response schema.
- [Search](${base}/api/v1/search?q=best+salary+bonus+for+2500+a+month): GET /api/v1/search?q=...: the same pipeline as the website search box. Optional goal, income, balance, max_commitment, residency, gift_factor, prefer, customer_of.
- [Ranked offers](${base}/api/v1/offers?goal=salary&income=2500): GET /api/v1/offers?goal=&country=ES&...: ranked rows for one goal, or one table per goal when goal is left out.
- [One offer](${base}/api/v1/offers/{id}): GET /api/v1/offers/{id}: the row, its score breakdown and the full data file.
- [Compare](${base}/api/v1/compare?ids=a,b): GET /api/v1/compare?ids=a,b,c: side by side, with the reasons a profile cannot take an offer.
- [Goals](${base}/api/v1/goals): GET /api/v1/goals: the goals and an example question for each.
- [Bank apps](${base}/api/v1/apps): GET /api/v1/apps?limit=: Spanish bank mobile apps ranked 0 to 100 by store ratings, release freshness, reach and payment features. Not a ranking of offers.
- [One bank app](${base}/api/v1/apps/{id}): GET /api/v1/apps/{id}: the row, its score breakdown and the full data file.

## MCP

- [MCP server](${base}/mcp): stateless Streamable HTTP MCP endpoint, POST. Tools: search_offers, get_offer, compare_offers, list_goals, rank_bank_apps. In Claude Code: claude mcp add --transport http bankjar ${base}/mcp

## Data

- [Whole dataset (JSON)](${base}/data/offers.json): every validated offer, licence CC BY 4.0, attribution: BankJar (github.com/zaitsew/bankjar).
- [Full text for LLMs](${base}/llms-full.txt): this file plus the methodology and a table of every current offer.

## Docs

- [Methodology](${base}/methodology): how net value is computed (tax, gifts, fees, interest), who sees which offer, how freshness works, how bank apps are scored.
- [Bank apps](${base}/apps): the ranking of Spanish bank apps as a page.
- [Source code and data files](${REPO_URL}): Apache-2.0 code, one YAML file per offer.

## Optional

- [Agent guide](${REPO_URL}/blob/main/docs/AGENTS-API.md): curl examples, MCP client configuration, caching.
`;
}

function readMethodology(): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), "docs", "METHODOLOGY.md"), "utf8").trim();
  } catch {
    return `Methodology: ${siteUrl()}/methodology`;
  }
}

/** A compact plain-text table of every current offer, grouped by goal, ranked for a default profile. */
export function offersTable(): string {
  const today = todayIso();
  const offers = allOffers();
  const out: string[] = [];
  for (const goal of GOALS) {
    const { ranked } = rankOffers(offers, makeProfile({ goal }), today);
    if (ranked.length === 0) continue;
    out.push(`### ${goal}`);
    ranked.forEach((r, i) => out.push(rowLine(offerRow(r.offer, r.score), i + 1)));
    out.push("");
  }
  return out.join("\n").trimEnd();
}

/** One line per ranked bank app, best first. */
export function appsTable(): string {
  return appsBody().apps.map((a) => appLine(a)).join("\n");
}

export function llmsFullTxt(): string {
  const base = siteUrl();
  return `${llmsTxt().trimEnd()}

---

## Methodology

${readMethodology()}

---

## Current offers

Ranked by first-year net value for a default profile: resident status unknown, balance ${eur(10000)}, gift factor 0.8, no income or commitment filter. Your profile changes the order and the numbers: use ${base}/api/v1/search or the MCP tools for a person's own figures. Commitment "none" means the bank asks for no minimum stay.

${offersTable() || "No current offers."}

---

## Bank apps

Spanish bank mobile apps, ranked 0 to 100 by store ratings, release freshness, reach and payment features (see the methodology). "?" means a feature is unknown; it scores 0. The score is about the app, not about the bank's offers.

${appsTable() || "No bank apps in the data."}

${DISCLAIMER}
${LICENSE}
`;
}

