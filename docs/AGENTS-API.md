# Agent API

BankJar answers the same question for people and for AI agents, from the same engine.
Everything below is read-only, needs no key, and returns `source_url` and `verified_on` on every offer row. Cite both.

> Not financial advice. Terms change; check `source_url` before signing.

Replace `https://bankjar.example` with the host you use (`http://localhost:3000` in development).

## Entry points

| URL | What |
|---|---|
| `/llms.txt` | What BankJar is and how to query it (llmstxt.org). |
| `/llms-full.txt` | `llms.txt` plus the methodology and a plain-text table of every current offer. |
| `/openapi.json` | OpenAPI 3.1 for the REST API. |
| `/api/v1/*` | The REST API. |
| `/mcp` | MCP server, Streamable HTTP, stateless. |
| `/data/offers.json` | The whole dataset as validated JSON. |

## REST

All endpoints are `GET`, return JSON, and send `Access-Control-Allow-Origin: *` and
`Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.

| Endpoint | Returns |
|---|---|
| `/api/v1/search?q=` | The search-box pipeline: `{query, goal, profile, summary, parser, intent, count, offers[], excluded[]}`. `parser` is `rules`, `ai` or `rules+ai`. |
| `/api/v1/offers?goal=&country=ES` | Ranked rows for one goal; with no `goal`, one ranked table per goal under `goals`. |
| `/api/v1/offers/{id}` | `{offer, full_offer, hidden, not_eligible_reasons}`. 404 JSON for an unknown id. |
| `/api/v1/compare?ids=a,b,c` | `{offers[], missing[]}` in the order asked; offers the profile cannot take stay in, with `not_eligible_reasons`. |
| `/api/v1/goals` | `[{id, label, description, example_prompt}]`. |

Profile parameters, accepted by `search`, `offers`, `offers/{id}` and `compare`:

| Parameter | Meaning |
|---|---|
| `goal` | `salary`, `savings`, `account`, `deposit` or `welcome`. Wins over the goal read from `q`. |
| `income` | Net monthly income in EUR. Offers with a higher minimum are excluded. |
| `balance` | EUR to move or park. Default 10000. Drives interest. |
| `max_commitment` | Longest commitment in months. `0` means none. |
| `residency` | `resident`, `nie_tie`, `non_resident` or `unknown` (default). |
| `gift_factor` | 0 to 1, what a gift is worth to you. Default 0.8. |
| `prefer` | `cash` drops gift rewards. `any` is the default. |
| `customer_of` | Comma-separated bank slugs where you already bank. |

The long names `monthly_income_eur`, `balance_eur`, `max_commitment_months` and `existing_customer_of` also work.
Unknown parameters are a `400`, so a typo cannot silently return an unfiltered table.
Errors have the shape `{"error": "...", "issues": [{"param": "income", "message": "..."}]}`; unknown routes under `/api/v1` return a JSON `404`.

Every response carries:

```json
{
  "dataset": { "latest_verified_on": "2026-10-20", "count": 24, "version": "2026-10-20+24" },
  "disclaimer": "Not financial advice. Terms change; check source_url before signing.",
  "license": "Data CC BY 4.0, attribution: BankJar (github.com/zaitsew/bankjar)"
}
```

An offer row:

```json
{
  "id": "…", "bank": "…", "bank_slug": "…", "country": "ES", "goal": "salary",
  "product_name": "…", "headline": "…",
  "reward": { "type": "cash", "value_eur": 800, "description": "…", "paid_when": "…" },
  "rate_tae": null, "commitment_months": 12,
  "requirements": { "min_monthly_income_eur": 1000, "new_customer_only": true, "other": [] },
  "fees": { "monthly_eur": 0, "notes": null }, "penalty": null,
  "eligibility": { "residents_only": null, "nie_tie_ok": null, "non_residents": null, "notes": null },
  "valid_until": null, "source_url": "https://…", "verified_on": "2026-10-18", "stale": false,
  "score": { "net_value_eur": 648, "value_per_month_eur": 54, "breakdown": [], "flags": [] },
  "url": "https://bankjar.example/offer/…"
}
```

`stale` is true when `verified_on` is more than 30 days old. Offers older than 60 days, or past `valid_until`, are in no ranking (`/api/v1/offers/{id}` still returns them with `hidden: true`).
How `net_value_eur` is computed: [METHODOLOGY.md](./METHODOLOGY.md).

### Examples

```sh
curl -s 'https://bankjar.example/api/v1/search?q=best+salary+bonus+for+2500+a+month'
curl -s 'https://bankjar.example/api/v1/offers?goal=savings&balance=15000&max_commitment=0'
curl -s 'https://bankjar.example/api/v1/offers?goal=account&residency=non_resident'
curl -s 'https://bankjar.example/api/v1/offers/<id>?income=2500'
curl -s 'https://bankjar.example/api/v1/compare?ids=<id1>,<id2>&prefer=cash'
curl -s 'https://bankjar.example/api/v1/goals'
curl -s 'https://bankjar.example/data/offers.json' | jq '.offers | length'
```

## MCP

`POST /mcp` is a stateless Streamable HTTP server (no session id, JSON replies). `GET /mcp` answers `405` with a short JSON description.
Server name `bankjar`, version from `package.json`. Its `instructions` tell the model to cite `source_url` and `verified_on` and never to present numbers as advice.

| Tool | Input | Returns |
|---|---|---|
| `search_offers` | `query?`, `goal?`, `monthly_income_eur?`, `balance_eur?`, `max_commitment_months?`, `residency?`, `gift_factor?`, `prefer?`, `existing_customer_of?` | A text summary plus JSON: the top 10 rows, the excluded offers and why, the disclaimer. |
| `get_offer` | `id`, plus the profile fields | The full offer, its score breakdown, flags, `not_eligible_reasons`. |
| `compare_offers` | `ids` (2 to 5), plus the profile fields | Rows in the order asked, `missing`, `not_eligible_reasons`. |
| `list_goals` | none | The goals with an example question each. |

Each result has a human-readable text block, the same data as JSON text, and `structuredContent`.

### Client setup

Claude Code:

```sh
claude mcp add --transport http bankjar https://bankjar.example/mcp
```

Claude Desktop (`claude_desktop_config.json`; the `mcp-remote` bridge runs a remote server over stdio):

```json
{
  "mcpServers": {
    "bankjar": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://bankjar.example/mcp"]
    }
  }
}
```

Recent Claude Desktop versions can also add it under Settings, Connectors, with the URL `https://bankjar.example/mcp`.

Any other client that speaks Streamable HTTP:

```json
{ "mcpServers": { "bankjar": { "type": "http", "url": "https://bankjar.example/mcp" } } }
```

Check a running server end to end with the official SDK client:

```sh
npm run mcp:smoke -- http://localhost:3000/mcp
```

## Caching and limits

- REST and the text files are cached at the CDN for an hour, then served stale for up to a day while they refresh. A corrected offer shows within about an hour.
- Errors are never cached.
- There is no rate limit and no key: the routes are read-only over a small dataset. Be polite; one request per question is enough. `/data/offers.json` is the right way to mirror everything.
- Local data: set `BANKJAR_OFFERS_DIR` to another folder of offer files (the tests use `tests/fixtures/offers`). `BANKJAR_TODAY=YYYY-MM-DD` pins the date used for stale and expiry checks.
- Absolute links in responses use `NEXT_PUBLIC_SITE_URL`, else `VERCEL_PROJECT_PRODUCTION_URL`, else `http://localhost:3000`.

## Licence and attribution

Data in `data/offers`: CC BY 4.0. Credit "BankJar (github.com/zaitsew/bankjar)" and link the offer's `source_url`.
Code: Apache-2.0.
The disclaimer is part of the data you receive; keep it when you show the numbers.

## Structured data on offer pages

Each offer page embeds schema.org JSON-LD (`BankAccount`, `DepositAccount` or `FinancialProduct`, with an `Offer` carrying `validThrough` and the bank's `url`, `annualPercentageRate` when there is a rate, and `dateModified` = `verified_on`).
The generator is `offerJsonLd` and the `<JsonLd>` component in `src/server/jsonld.tsx`.
