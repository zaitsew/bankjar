import { z } from "zod";
import { AppSchema } from "../core/app-schema";
import { GOALS, OfferSchema } from "../core/schema";
import pkg from "../../package.json";
import { DISCLAIMER, LICENSE, PROFILE_PARAMS, REPO_URL, siteUrl } from "./api";

/**
 * The OpenAPI 3.1 document served at /openapi.json. Written by hand over the same
 * constants the routes use (parameters, disclaimer, licence); the data-file schemas
 * come from the zod schema, so they cannot drift. tests/openapi.test.ts checks that
 * every path here has a route file and every route file has a path here.
 */

type Json = Record<string, unknown>;

function jsonSchemaOf(schema: z.ZodType): Json {
  const out = z.toJSONSchema(schema, { io: "output", target: "draft-2020-12" }) as Json;
  delete out.$schema;
  return out;
}

const ref = (name: string): Json => ({ $ref: `#/components/schemas/${name}` });

function profileParameters(): Json[] {
  const schemas: Record<string, Json> = {
    goal: { type: "string", enum: [...GOALS] },
    income: { type: "number", minimum: 0 },
    balance: { type: "number", minimum: 0 },
    max_commitment: { type: "integer", minimum: 0, maximum: 600 },
    residency: { type: "string", enum: ["resident", "nie_tie", "non_resident", "unknown"] },
    gift_factor: { type: "number", minimum: 0, maximum: 1 },
    prefer: { type: "string", enum: ["cash", "any"] },
    customer_of: { type: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*(,[a-z0-9]+(-[a-z0-9]+)*)*$" },
  };
  return PROFILE_PARAMS.map((p) => ({
    name: p.name,
    in: "query",
    required: false,
    description: p.description,
    example: p.example,
    schema: schemas[p.name] ?? { type: "string" },
  }));
}

const errorResponses = {
  "400": { description: "Invalid query parameters.", content: { "application/json": { schema: ref("Error") } } },
};

const cacheHeaders = {
  "Cache-Control": { description: "public, s-maxage=3600, stale-while-revalidate=86400", schema: { type: "string" } },
  "Access-Control-Allow-Origin": { description: "Always *.", schema: { type: "string" } },
};

function ok(description: string, schema: Json): Json {
  return { description, headers: cacheHeaders, content: { "application/json": { schema } } };
}

export function buildOpenApi(): Json {
  const offer = jsonSchemaOf(OfferSchema) as { properties: Record<string, Json> } & Json;
  const bankApp = jsonSchemaOf(AppSchema) as { properties: Record<string, Json> } & Json;
  const ap = bankApp.properties;
  const p = offer.properties;
  const base = siteUrl();
  const profileRef = ref("Profile");

  const envelope = {
    dataset: ref("Dataset"),
    disclaimer: { type: "string", const: DISCLAIMER },
    license: { type: "string", const: LICENSE },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "BankJar API",
      version: pkg.version,
      summary: "Spanish bank offers ranked by goal, with sources.",
      description:
        "Read-only JSON API over the BankJar dataset. Every row carries source_url and verified_on: cite both. " +
        "Numbers come from a deterministic engine (see /methodology); nothing here is financial advice. " +
        "Responses are cached for an hour at the CDN. Data licence: CC BY 4.0, attribution: BankJar.",
      license: { name: "Apache-2.0 (code), CC BY 4.0 (data)", url: "https://www.apache.org/licenses/LICENSE-2.0.html" },
      contact: { name: "BankJar on GitHub", url: REPO_URL },
    },
    servers: [{ url: base }],
    externalDocs: { description: "Agent guide: REST, MCP, llms.txt", url: `${REPO_URL}/blob/main/docs/AGENTS-API.md` },
    tags: [
      { name: "offers", description: "Ranked offers and one offer." },
      { name: "apps", description: "Spanish bank mobile apps ranked by store numbers." },
      { name: "agents", description: "Machine-readable entry points." },
    ],
    paths: {
      "/api/v1/search": {
        get: {
          tags: ["offers"],
          operationId: "searchOffers",
          summary: "Search with a free-text question",
          description:
            "The same pipeline as the search box: the rule parser reads goal, income, balance, commitment and residency out of q, and on the hosted site an AI step fills what the rules miss (see `parser` in the response); explicit parameters win over what q says. The AI never writes a number in a table.",
          parameters: [
            { name: "q", in: "query", required: false, description: "A question in English, Spanish or Russian, up to 500 characters.", example: "I earn 2500 a month, best salary bonus without commitment", schema: { type: "string", maxLength: 500 } },
            ...profileParameters(),
          ],
          responses: { "200": ok("Ranked offers for the parsed goal.", ref("SearchResponse")), ...errorResponses },
        },
      },
      "/api/v1/offers": {
        get: {
          tags: ["offers"],
          operationId: "listOffers",
          summary: "Ranked offers for a goal, or one table per goal",
          description: "With goal: one ranked table. Without goal: an object keyed by goal, each with its own ranked table.",
          parameters: [
            { name: "country", in: "query", required: false, description: "ISO 3166-1 alpha-2 country code. Default ES.", example: "ES", schema: { type: "string", pattern: "^[A-Za-z]{2}$", default: "ES" } },
            ...profileParameters(),
          ],
          responses: { "200": ok("Ranked offers.", ref("OffersResponse")), ...errorResponses },
        },
      },
      "/api/v1/offers/{id}": {
        get: {
          tags: ["offers"],
          operationId: "getOffer",
          summary: "One offer with its score and the full data file",
          parameters: [
            { name: "id", in: "path", required: true, description: "Offer id, kebab-case.", example: "testbank-payroll-cash", schema: { type: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$" } },
            ...profileParameters(),
          ],
          responses: {
            "200": ok("The offer.", ref("OfferResponse")),
            "404": { description: "No offer with this id.", content: { "application/json": { schema: ref("Error") } } },
            ...errorResponses,
          },
        },
      },
      "/api/v1/compare": {
        get: {
          tags: ["offers"],
          operationId: "compareOffers",
          summary: "Compare offers side by side",
          description: "Rows come back in the order asked. Offers the profile cannot take are kept, with not_eligible_reasons. Ids that match nothing are listed in missing.",
          parameters: [
            { name: "ids", in: "query", required: true, description: "Comma-separated offer ids, 1 to 10.", example: "testbank-payroll-cash,testbank-phone-gift", schema: { type: "string" } },
            ...profileParameters(),
          ],
          responses: { "200": ok("The compared offers.", ref("CompareResponse")), ...errorResponses },
        },
      },
      "/api/v1/goals": {
        get: {
          tags: ["offers"],
          operationId: "listGoals",
          summary: "The goals an offer can be ranked for",
          responses: { "200": ok("The goals.", ref("GoalsResponse")) },
        },
      },
      "/api/v1/apps": {
        get: {
          tags: ["apps"],
          operationId: "listBankApps",
          summary: "Spanish bank apps ranked by score",
          description:
            "Bank mobile apps scored 0 to 100: store rating 60, release freshness 15, reach 10, features 15 (Bizum, Apple Pay, Google Pay, English). " +
            "Ratings come from the App Store and Google Play and are pulled towards 3.0 stars when an app has few of them. " +
            "A feature that is null is unknown and scores 0. Apps not re-checked for 60+ days are left out. The score is about the app, not about the bank's offers.",
          parameters: [
            { name: "limit", in: "query", required: false, description: "How many apps to return, best first, 1 to 50. Default all.", example: "10", schema: { type: "integer", minimum: 1, maximum: 50 } },
          ],
          responses: { "200": ok("Ranked bank apps.", ref("AppsResponse")), ...errorResponses },
        },
      },
      "/api/v1/apps/{id}": {
        get: {
          tags: ["apps"],
          operationId: "getBankApp",
          summary: "One bank app with its score and the full data file",
          parameters: [
            { name: "id", in: "path", required: true, description: "App id, kebab-case; the same as the bank slug, e.g. bbva.", example: "bbva", schema: { type: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$" } },
          ],
          responses: {
            "200": ok("The app.", ref("AppResponse")),
            "404": { description: "No bank app with this id.", content: { "application/json": { schema: ref("Error") } } },
            ...errorResponses,
          },
        },
      },
      "/data/offers.json": {
        get: {
          tags: ["agents"],
          operationId: "downloadDataset",
          summary: "The whole dataset",
          description: "Every validated offer, including expired and stale ones (check verified_on and valid_until). CC BY 4.0.",
          responses: { "200": ok("The dataset.", ref("DatasetResponse")) },
        },
      },
      "/mcp": {
        post: {
          tags: ["agents"],
          operationId: "mcp",
          summary: "Model Context Protocol endpoint (Streamable HTTP, stateless)",
          description:
            "JSON-RPC 2.0 over POST. Tools: search_offers, get_offer, compare_offers, list_goals, rank_bank_apps. Send Accept: application/json, text/event-stream. " +
            "Use an MCP client rather than calling this by hand; see /llms.txt for client setup.",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", description: "A JSON-RPC 2.0 request or notification." } } } },
          responses: { "200": { description: "A JSON-RPC 2.0 response.", content: { "application/json": { schema: { type: "object" } } } }, "202": { description: "Notification accepted." } },
        },
      },
      "/llms.txt": {
        get: {
          tags: ["agents"],
          operationId: "llmsTxt",
          summary: "llms.txt: what BankJar is and how to query it",
          responses: { "200": { description: "Plain text.", content: { "text/plain": { schema: { type: "string" } } } } },
        },
      },
      "/llms-full.txt": {
        get: {
          tags: ["agents"],
          operationId: "llmsFullTxt",
          summary: "llms.txt plus the methodology and a table of every current offer",
          responses: { "200": { description: "Plain text.", content: { "text/plain": { schema: { type: "string" } } } } },
        },
      },
    },
    components: {
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: { type: "string" },
            issues: { type: "array", items: { type: "object", required: ["param", "message"], properties: { param: { type: "string" }, message: { type: "string" } } } },
          },
        },
        Dataset: {
          type: "object",
          required: ["latest_verified_on", "count", "version"],
          properties: {
            latest_verified_on: { type: ["string", "null"], format: "date", description: "Newest verified_on in the data." },
            count: { type: "integer" },
            version: { type: "string", description: "Changes whenever an offer is added or re-verified." },
          },
        },
        Goal: { type: "string", enum: [...GOALS] },
        Profile: {
          type: "object",
          description: "The person the ranking was computed for, after defaults.",
          properties: {
            goal: { $ref: "#/components/schemas/Goal" },
            monthly_income_eur: { type: "number" },
            balance_eur: { type: "number" },
            max_commitment_months: { type: "integer" },
            residency: { type: "string", enum: ["resident", "nie_tie", "non_resident", "unknown"] },
            existing_customer_of: { type: "array", items: { type: "string" } },
            gift_factor: { type: "number" },
            prefer: { type: "string", enum: ["cash", "any"] },
          },
        },
        Reward: p.reward,
        Requirements: p.requirements,
        Fees: p.fees,
        Eligibility: p.eligibility,
        Score: {
          type: "object",
          required: ["net_value_eur", "value_per_month_eur", "breakdown", "flags"],
          properties: {
            net_value_eur: { type: "number", description: "First-year net value in EUR after tax and fees." },
            value_per_month_eur: { type: ["number", "null"], description: "Net value per commitment month; null with no commitment." },
            breakdown: { type: "array", items: { type: "object", required: ["label", "eur"], properties: { label: { type: "string" }, eur: { type: "number" } } } },
            flags: { type: "array", items: { type: "string" }, description: "Catches that do not change the number: penalties, unknown facts." },
          },
        },
        OfferRow: {
          type: "object",
          required: ["id", "bank", "bank_slug", "country", "goal", "product_name", "headline", "reward", "rate_tae", "commitment_months", "requirements", "fees", "penalty", "eligibility", "valid_until", "source_url", "verified_on", "stale", "score", "url"],
          properties: {
            id: p.id,
            bank: p.bank,
            bank_slug: p.bank_slug,
            country: p.country,
            goal: { $ref: "#/components/schemas/Goal" },
            product_name: p.product_name,
            headline: p.headline,
            reward: ref("Reward"),
            rate_tae: p.rate_tae,
            commitment_months: p.commitment_months,
            requirements: ref("Requirements"),
            fees: ref("Fees"),
            penalty: p.penalty,
            eligibility: ref("Eligibility"),
            valid_until: p.valid_until,
            source_url: { ...p.source_url, description: "The bank's page for this offer. Cite it." },
            verified_on: { ...p.verified_on, description: "Date a person or the daily check last confirmed the terms. Cite it." },
            stale: { type: "boolean", description: "verified_on is more than 30 days ago." },
            score: ref("Score"),
            url: { type: "string", format: "uri", description: "The offer page on this site." },
          },
        },
        ExcludedRow: {
          type: "object",
          required: ["id", "bank", "reasons"],
          properties: { id: { type: "string" }, bank: { type: "string" }, reasons: { type: "array", items: { type: "string" } } },
        },
        Offer: { ...offer, description: "One data file, exactly as stored." },
        SearchResponse: {
          type: "object",
          required: ["query", "goal", "profile", "summary", "parser", "intent", "count", "offers", "excluded", "dataset", "disclaimer", "license"],
          properties: {
            query: { type: "string" },
            goal: ref("Goal"),
            profile: profileRef,
            summary: { type: "string", description: "A template over the ranked rows. Never adds a number." },
            parser: { type: "string", enum: ["rules", "ai", "rules+ai"], description: "Which parser read q: the rule parser, the AI alone, or both." },
            intent: { type: "object", properties: { goal: { oneOf: [ref("Goal"), { type: "null" }] }, confidence: { type: "number" }, matched: { type: "array", items: { type: "string" } } } },
            count: { type: "integer" },
            offers: { type: "array", items: ref("OfferRow") },
            excluded: { type: "array", items: ref("ExcludedRow") },
            ...envelope,
          },
        },
        GoalTable: {
          type: "object",
          required: ["count", "offers", "excluded"],
          properties: { count: { type: "integer" }, offers: { type: "array", items: ref("OfferRow") }, excluded: { type: "array", items: ref("ExcludedRow") } },
        },
        OffersResponse: {
          type: "object",
          required: ["country", "goal", "profile", "dataset", "disclaimer", "license"],
          properties: {
            country: { type: "string" },
            goal: { oneOf: [ref("Goal"), { type: "null" }] },
            profile: profileRef,
            count: { type: "integer", description: "Present when goal is set." },
            offers: { type: "array", items: ref("OfferRow"), description: "Present when goal is set." },
            excluded: { type: "array", items: ref("ExcludedRow"), description: "Present when goal is set." },
            goals: { type: "object", additionalProperties: ref("GoalTable"), description: "Present when goal is not set: one table per goal." },
            ...envelope,
          },
        },
        OfferResponse: {
          type: "object",
          required: ["offer", "full_offer", "hidden", "not_eligible_reasons", "dataset", "disclaimer", "license"],
          properties: {
            offer: ref("OfferRow"),
            full_offer: ref("Offer"),
            hidden: { type: "boolean", description: "Expired, or unverified for 60+ days: in no ranking." },
            not_eligible_reasons: { type: "array", items: { type: "string" } },
            ...envelope,
          },
        },
        CompareResponse: {
          type: "object",
          required: ["profile", "offers", "missing", "dataset", "disclaimer", "license"],
          properties: {
            profile: profileRef,
            offers: { type: "array", items: { allOf: [ref("OfferRow"), { type: "object", required: ["not_eligible_reasons"], properties: { not_eligible_reasons: { type: "array", items: { type: "string" } } } }] } },
            missing: { type: "array", items: { type: "string" } },
            ...envelope,
          },
        },
        GoalsResponse: {
          type: "object",
          required: ["goals", "dataset", "disclaimer", "license"],
          properties: {
            goals: { type: "array", items: { type: "object", required: ["id", "label", "description", "example_prompt"], properties: { id: ref("Goal"), label: { type: "string" }, description: { type: "string" }, example_prompt: { type: "string" } } } },
            ...envelope,
          },
        },
        AppsDataset: {
          type: "object",
          required: ["latest_verified_on", "count", "version"],
          properties: {
            latest_verified_on: { type: ["string", "null"], format: "date", description: "Newest verified_on among the app files." },
            count: { type: "integer", description: "App files in the data, hidden ones included." },
            version: { type: "string" },
          },
        },
        AppStore: {
          type: "object",
          required: ["rating", "ratings_count", "updated_on", "url"],
          properties: {
            rating: { type: ["number", "null"], minimum: 0, maximum: 5, description: "Average stars as the store shows them. Google Play's average is the one shown in Spain; its count is worldwide." },
            ratings_count: { type: "integer" },
            updated_on: { type: ["string", "null"], format: "date", description: "Date of the latest release in this store." },
            url: { type: "string", format: "uri", description: "The store listing. Cite it." },
          },
        },
        AppScoreLine: {
          type: "object",
          required: ["label", "points", "max"],
          properties: { label: { type: "string" }, points: { type: "number" }, max: { type: "number" } },
        },
        AppRow: {
          type: "object",
          required: ["rank", "id", "bank", "bank_slug", "app_name", "score", "adjusted_rating", "pooled_rating", "total_ratings", "ios", "android", "features", "feature_sources", "breakdown", "flags", "stale", "verified_on", "source_urls"],
          properties: {
            rank: { type: ["integer", "null"], description: "Place in the ranking; null for a hidden app." },
            id: ap.id,
            bank: ap.bank,
            bank_slug: { ...ap.bank_slug, description: "Same slug as the bank's offers." },
            app_name: ap.app_name,
            score: { type: "number", minimum: 0, maximum: 100 },
            adjusted_rating: { type: "number", description: "Stars after the pull towards 3.0. The score uses this one." },
            pooled_rating: { type: ["number", "null"], description: "Both stores' ratings pooled by count, before the pull." },
            total_ratings: { type: "integer" },
            ios: { oneOf: [ref("AppStore"), { type: "null" }] },
            android: { oneOf: [ref("AppStore"), { type: "null" }] },
            features: {
              type: "object",
              required: ["bizum", "apple_pay", "google_pay", "english"],
              description: "true, false or null (unknown). english comes from the App Store language list and is null without an App Store listing.",
              properties: {
                bizum: { type: ["boolean", "null"] },
                apple_pay: { type: ["boolean", "null"] },
                google_pay: { type: ["boolean", "null"] },
                english: { type: ["boolean", "null"] },
              },
            },
            feature_sources: {
              type: "object",
              required: ["bizum", "apple_pay", "google_pay"],
              description: "The page that shows each feature; null while the feature is unknown.",
              properties: {
                bizum: { type: ["string", "null"], format: "uri" },
                apple_pay: { type: ["string", "null"], format: "uri" },
                google_pay: { type: ["string", "null"], format: "uri" },
              },
            },
            breakdown: { type: "array", items: ref("AppScoreLine") },
            flags: { type: "array", items: { type: "string" }, description: "Catches that do not change the number: few ratings, one store, unknown features." },
            stale: { type: "boolean", description: "verified_on is more than 30 days ago." },
            verified_on: { ...ap.verified_on, description: "Day the store numbers were fetched. Cite it." },
            source_urls: { type: "array", items: { type: "string", format: "uri" }, description: "The store listings the numbers come from." },
          },
        },
        BankApp: { ...bankApp, description: "One app data file, exactly as stored." },
        AppsResponse: {
          type: "object",
          required: ["count", "total_apps", "apps", "dataset", "disclaimer", "license"],
          properties: {
            count: { type: "integer", description: "Rows returned." },
            total_apps: { type: "integer", description: "Ranked apps before limit was applied." },
            apps: { type: "array", items: ref("AppRow") },
            dataset: ref("AppsDataset"),
            disclaimer: { type: "string", const: DISCLAIMER },
            license: { type: "string", const: LICENSE },
          },
        },
        AppResponse: {
          type: "object",
          required: ["app", "full_app", "hidden", "dataset", "disclaimer", "license"],
          properties: {
            app: ref("AppRow"),
            full_app: ref("BankApp"),
            hidden: { type: "boolean", description: "Store numbers are 60+ days old: in no ranking." },
            dataset: ref("AppsDataset"),
            disclaimer: { type: "string", const: DISCLAIMER },
            license: { type: "string", const: LICENSE },
          },
        },
        DatasetResponse: {
          type: "object",
          required: ["dataset", "license", "offers"],
          properties: { dataset: ref("Dataset"), license: { type: "string", const: LICENSE }, offers: { type: "array", items: ref("Offer") } },
        },
      },
    },
  };
}
