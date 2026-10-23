import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import pkg from "../../package.json";
import {
  DISCLAIMER,
  GOAL_INFO,
  ProfileToolShape,
  compareBody,
  goalsBody,
  offerBody,
  rowLine,
  searchBodyAsync,
  siteUrl,
  type OfferRow,
} from "./api";
import { appLine, appsBody } from "./apps-api";
import { MCP_APP_MIME_TYPE, OFFER_WIDGET_HTML, OFFER_WIDGET_URI, offerWidgetResourceMeta, offerWidgetToolMeta } from "./mcp-widget";

/**
 * The MCP server: five read-only tools over the same service functions as the REST
 * API, so an agent sees the table a person sees. A new server per request (stateless).
 *
 * search_offers and compare_offers also render offer cards in hosts that support MCP Apps
 * (Claude, ChatGPT): the tools point at one `ui://` resource through `_meta`, and every result keeps its
 * text blocks for models and text-only clients next to the structuredContent the widget draws.
 */

export const MCP_INSTRUCTIONS = [
  "BankJar ranks Spanish bank offers (salary bonuses, savings, free accounts, term deposits, welcome bonuses) by first-year net value in euros.",
  "Always cite source_url and verified_on for every offer you mention, and say the figures are estimates for the profile given.",
  "Never present the numbers as financial advice or a recommendation to sign; terms change, so tell the person to check source_url before signing.",
  "Ask for monthly income, balance, residency and the longest commitment the person accepts when they matter and are unknown; do not guess them.",
  "If an offer has stale=true, say its terms may have changed. Numbers come from the engine; never compute or invent your own.",
  "rank_bank_apps ranks bank mobile apps by store ratings, release freshness, reach and payment features; an app score says nothing about how good a bank's offers are, so never use it to rank offers.",
].join(" ");

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

function textBlock(text: string) {
  return { type: "text" as const, text };
}

function summaryLines(rows: readonly OfferRow[]): string {
  return rows.map((r, i) => rowLine(r, i + 1)).join("\n");
}

export function createMcpServer(ctx: { ip?: string } = {}): McpServer {
  const server = new McpServer(
    { name: "bankjar", version: pkg.version },
    { instructions: MCP_INSTRUCTIONS },
  );

  server.registerResource(
    "offer_cards",
    OFFER_WIDGET_URI,
    {
      title: "BankJar offer cards",
      description: "Interactive ranked offer cards for search_offers and compare_offers, with a link to each bank's own terms.",
      mimeType: MCP_APP_MIME_TYPE,
      _meta: offerWidgetResourceMeta(siteUrl()),
    },
    () => ({
      contents: [
        { uri: OFFER_WIDGET_URI, mimeType: MCP_APP_MIME_TYPE, text: OFFER_WIDGET_HTML, _meta: offerWidgetResourceMeta(siteUrl()) },
      ],
    }),
  );

  server.registerTool(
    "search_offers",
    {
      title: "Search Spanish bank offers",
      description:
        "Find and rank Spanish bank offers for a person. Give a plain-language question in `query` (English, Spanish or Russian) and/or explicit fields; explicit fields win. " +
        "Returns the top 10 offers by first-year net value in EUR (after 19% withholding tax, gift value and fees), each with source_url, verified_on, requirements, penalties and flags, plus the offers excluded for this person and why. " +
        "Example questions: 'best salary bonus for 2,500 a month', 'where to park 15,000 euros', 'free account for a non-resident'.",
      inputSchema: { query: z.string().max(500).optional().describe("The person's question in their own words."), ...ProfileToolShape },
      annotations: { title: "Search Spanish bank offers", ...READ_ONLY },
      _meta: offerWidgetToolMeta("Searching bank offers", "Ranked offers ready"),
    },
    async ({ query, ...fields }) => {
      const body = await searchBodyAsync(query, fields, ctx);
      const top = body.offers.slice(0, 10);
      const structured = { ...body, offers: top, total_offers: body.offers.length };
      const text = [
        `Goal: ${body.goal}. ${body.summary}`,
        top.length ? `Top ${top.length} of ${body.offers.length}:\n${summaryLines(top)}` : "No offers match.",
        body.excluded.length ? `${body.excluded.length} offer(s) excluded for this profile; reasons are in the JSON.` : "",
        `Cite source_url and verified_on. ${DISCLAIMER}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      return { content: [textBlock(text), textBlock(JSON.stringify(structured))], structuredContent: structured };
    },
  );

  server.registerTool(
    "get_offer",
    {
      title: "Get one bank offer",
      description:
        "Fetch one offer by id: the full terms, the net-value score with its line-by-line breakdown, flags (penalties, unknown facts), source_url and verified_on. " +
        "Pass the profile fields to learn whether this person can take it (not_eligible_reasons).",
      inputSchema: { id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).describe("Offer id, e.g. bbva-salary-cuenta-online."), ...ProfileToolShape },
      annotations: { title: "Get one bank offer", ...READ_ONLY },
    },
    ({ id, ...fields }) => {
      const body = offerBody(id, fields);
      if (!body) {
        return { isError: true, content: [textBlock(`No offer with id "${id}". Use search_offers to find ids.`)] };
      }
      const text = [
        rowLine(body.offer),
        body.hidden ? "This offer is expired or unverified for 60+ days and is in no ranking." : "",
        body.not_eligible_reasons.length ? `Not available to this profile: ${body.not_eligible_reasons.join("; ")}.` : "",
        body.offer.score.flags.length ? `Flags: ${body.offer.score.flags.join("; ")}.` : "",
        `Cite source_url and verified_on. ${DISCLAIMER}`,
      ]
        .filter(Boolean)
        .join("\n");
      return { content: [textBlock(text), textBlock(JSON.stringify(body))], structuredContent: { ...body } };
    },
  );

  server.registerTool(
    "compare_offers",
    {
      title: "Compare bank offers",
      description:
        "Compare 2 to 5 offers side by side for one person. Rows keep the order of `ids`. An offer the person cannot take stays in the table with not_eligible_reasons instead of being dropped. " +
        "Ids that match nothing come back in `missing`.",
      inputSchema: {
        ids: z.array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)).min(2).max(5).describe("Offer ids to compare, 2 to 5."),
        ...ProfileToolShape,
      },
      annotations: { title: "Compare bank offers", ...READ_ONLY },
      _meta: offerWidgetToolMeta("Comparing bank offers", "Comparison ready"),
    },
    ({ ids, ...fields }) => {
      const body = compareBody(ids, fields);
      const text = [
        body.offers.length ? summaryLines(body.offers) : "None of these ids matched an offer.",
        ...body.offers.filter((o) => o.not_eligible_reasons.length).map((o) => `${o.bank} (${o.id}) not available: ${o.not_eligible_reasons.join("; ")}.`),
        body.missing.length ? `Unknown ids: ${body.missing.join(", ")}.` : "",
        `Cite source_url and verified_on. ${DISCLAIMER}`,
      ]
        .filter(Boolean)
        .join("\n");
      return { content: [textBlock(text), textBlock(JSON.stringify(body))], structuredContent: { ...body } };
    },
  );

  server.registerTool(
    "list_goals",
    {
      title: "List offer goals",
      description:
        "List the goals offers are ranked for (salary, savings, account, deposit, welcome) with a description and an example question each.",
      inputSchema: {},
      annotations: { title: "List offer goals", ...READ_ONLY },
    },
    () => {
      const body = goalsBody();
      const text = GOAL_INFO.map((g) => `${g.id}: ${g.label}. ${g.description} Example: "${g.example_prompt}"`).join("\n");
      return { content: [textBlock(text), textBlock(JSON.stringify(body))], structuredContent: { ...body } };
    },
  );

  server.registerTool(
    "rank_bank_apps",
    {
      title: "Rank Spanish bank apps",
      description:
        "Rank Spanish bank mobile apps by store ratings, freshness, reach and payment features (Bizum, Apple Pay, Google Pay, English UI). " +
        "Returns score 0-100 with breakdown, per-store rating and count, and store URLs. Ratings are pulled towards 3.0 stars when an app has few of them. " +
        "A feature shown as null is unknown, not absent. The score is about the app, not about the bank's offers.",
      inputSchema: { limit: z.number().int().min(1).max(50).optional().describe("How many apps to return, best first. Default 24.") },
      annotations: { title: "Rank Spanish bank apps", ...READ_ONLY },
    },
    ({ limit }) => {
      const body = appsBody({ limit: limit ?? 24 });
      const text = [
        body.apps.length ? `Top ${body.apps.length} of ${body.total_apps} bank apps:\n${body.apps.map((a) => appLine(a)).join("\n")}` : "No bank apps in the data.",
        "Score = rating 60 + freshness 15 + reach 10 + features 15 points. ? means unknown and scores 0.",
        `Store numbers checked up to ${body.dataset.latest_verified_on ?? "never"}. Cite the store URLs and verified_on. ${DISCLAIMER}`,
      ].join("\n\n");
      return { content: [textBlock(text), textBlock(JSON.stringify(body))], structuredContent: { ...body } };
    },
  );

  return server;
}
