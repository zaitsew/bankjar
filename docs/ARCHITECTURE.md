# Architecture

BankJar has one job: answer "which bank offer fits my goal?" with a table a person can trust and an agent can cite.
The data and the ranking are open. The hosted site adds AI search and a daily freshness check.

## Shape

```
data/offers/<country>/<offer-id>.yaml    one file per offer; contributors add or fix one file
src/core/                                 pure TypeScript, no I/O: schema, scoring, intent parser, ranking
src/server/                               I/O: load data, call the AI, rate limit
app/                                      Next.js App Router: pages, API routes, MCP endpoint
public/                                   llms.txt, icons
tests/                                    node:test / vitest over src/core and the API
```

- **Next.js (App Router), standalone build, on the shared droplet `fabrique-apps-1`** (`https://bankjar.fabriquefutur.com`, behind the shared Caddy). The droplet has 1 GB of RAM, so `scripts/deploy.sh` builds on the laptop and ships the plain-JS standalone output; the image is built on the box. Offer pages, goal leaderboards and the methodology page are static at build time.
  Search pages render on the server. Agents and crawlers get full HTML, not a client-only shell.
- **Data is the source of truth.** YAML files are validated by a zod schema in `src/core/schema.ts` at build and in `./check.sh`.
  An invalid file fails the build. `verified_on` older than 30 days shows a "stale" badge; older than 60 days hides the offer from rankings.
- **Ranking is deterministic.** The AI never invents a number. It turns a question into filters and writes a two-sentence summary of rows the engine already ranked.

## Scoring (src/core/score.ts)

Every offer gets a **first-year net value in EUR** and a **value per commitment month**:

- Cash reward: the gross value minus 19% withholding (Spain treats bank bonuses as capital income).
- Gift reward (a phone, a TV): its retail value times a *gift factor*, default 0.8. The person can change it.
- Minus fees over the commitment period, minus known mandatory costs.
- Rates: balance × (TAE − 0) × min(promo months, 12) / 12, for the person's stated balance (default €10,000).
- Penalty and clawback rules show as flags. A flag never changes the number silently.

The person's profile filters offers: monthly income, new or existing customer, residency (resident, NIE/TIE, non-resident), and the longest commitment they accept.

## AI search (src/server/ai.ts)

The AI turns a question into the same `Intent` the rule parser returns. It never writes a number a table shows: every euro comes from `data/offers`.

```
q ──► rule parser ──► confident? (goal found, confidence ≥ 0.8) ──yes──► search()          parser "rules"
                          │ no
                          ▼
                 AI enabled? (ACCOUNTS_SERVICE_BANKJAR set, BANKJAR_AI ≠ off)  ──no──►    parser "rules"
                          │ yes
                          ▼
              cache hit? ──yes──┐        rate limit ok? ──no──► search()                  parser "rules"
                          │ no  │                 │ yes
                          └─────┼─► Haiku 5.5 via the hub (4 s timeout) ──fail──►         parser "rules"
                                ▼
                  merge(rules, ai) ──► search(); explicit parameters still win           parser "ai" | "rules+ai"
```

- **Code.** `src/server/ai.ts` (hub call, validation, merge), `cache.ts` (LRU), `ratelimit.ts` (limiter, client address, visitor id), `search.ts` (`searchAsync`, the sync `search` is unchanged). `/api/v1/search` and the MCP `search_offers` tool call `searchAsync`; the search page should too.
- **Hub call.** `POST ${ACCOUNTS_URL}/functions/v1/ai` on the service path: headers `x-accounts-service` (`ACCOUNTS_SERVICE_BANKJAR`), `x-accounts-product: bankjar`, `x-accounts-external-user: <visitor id>`. Model `claude-haiku-5-5`, one function tool `set_search_filters` forced with `tool_choice`, `fallback: []`, `max_tokens: 400`. Anthropic is the primary track (POLICY §1).
- **Validation.** The tool arguments pass through zod: `gift_factor` clamped to 0..1, month counts rounded to integers, `goal` and `residency` from fixed enums, bank slugs kebab-case. Arguments that do not parse return null. `unknown` residency and `prefer: any` are dropped, so they never overwrite a rule-parser value.
- **Merge.** The rule result comes first and the AI fills gaps. Where both found a field, the AI wins only when the rule confidence is below 0.6. The response's `parser` is `rules` (the AI added nothing or was skipped), `ai` (the rules found nothing) or `rules+ai`. `intent.matched` lists the AI fields as `ai:<field>:<value>`.
- **Never an error to the person.** No key, a network error, a 4 s timeout, a non-200 (402 `budget_exhausted`, 429), an answer with no tool call or invalid arguments: the call returns null, logs one line (`[bankjar-ai] fallback to rules: …`, never the question) and the rule parser answers.
- **Cache.** In-memory LRU, 500 entries, 24 h, keyed by the lower-cased, whitespace-collapsed question; it stores the AI's intent. A hit costs nothing and uses no rate-limit slot. Failures are not cached. The state is per server instance (best effort on serverless); `/api/v1/search` responses are also cached by the CDN for an hour.
- **Rate limit.** Fixed one-hour window, AI calls only: 20 per IP, 600 per instance. Over the limit the rule parser answers with no error. The IP is the first hop of `x-forwarded-for`, else `x-real-ip`.
- **Privacy.** The hub sees `sha256(ip | BANKJAR_VISITOR_SALT | UTC day)` cut to 16 hex characters. The raw IP is neither stored nor sent, and the id changes every day. The question text goes to the hub and Anthropic; the privacy page must say so.
- **Switches.** `ACCOUNTS_SERVICE_BANKJAR` unset: AI off, nothing else changes. `BANKJAR_AI=off`: AI off with the key present.

### Hub setup (one-time, on the accounts side; done 2026-10-22)

1. Add the product's service token as the hub secret `ACCOUNTS_SERVICE_BANKJAR` and the same value to the BankJar deployment. Set `ACCOUNTS_URL` (the hub's base URL) in the same deployment env: it has no default, and without it the rule parser answers alone.
2. Set `ACCOUNTS_EXTERNAL_BUDGET_EUR` above 0. External callers resolve on the free plan, whose seeded budget is 0, so without it every call is a 402 and BankJar silently stays on the rule parser.
3. BankJar's ceiling for all its visitors together is **15 EUR a month** (`ACCOUNTS_EXTERNAL_PRODUCT_BUDGET_EUR_BANKJAR=15`, approved by the owner on 2026-10-22). It overrides the hub's shared default of 25 EUR for BankJar only. The visitor id changes daily, so the per-person budget (1 EUR) rarely binds; the 15 EUR ceiling is the hard stop. Past it the hub answers 402 and the rule parser answers alone.

### Cost

Prices from the hub's `_shared/cost.ts` (EUR per million tokens): Haiku 5.5 input 0.092, output 0.46.

| Call | Tokens | EUR |
|---|---|---|
| Input (system prompt, tool schema, question) | about 600 | 0.0000552 |
| Output (one tool call) | about 120 | 0.0000552 |
| **One AI search** | | **about 0.00011** |

At the 15 EUR ceiling that is about **136,000 AI searches a month**. If Haiku adds hidden thinking tokens and the output is five times larger (600 tokens), a search costs about 0.00033 EUR and the ceiling fits about 45,000. The first live call (2026-10-22) cost 0.000153 EUR. The hub reserves the estimate for the raised output ceiling before the call and settles to the real tokens afterwards, so the monthly sum follows real usage. Only questions the rules cannot place, and that miss the cache, reach the hub, so real traffic costs less than this. These are estimates from price tables, not an invoice; check `accounts.usage` after the first week.

## For agents

- `GET /api/v1/offers?goal=salary&country=ES&income=2500` — ranked offers as JSON.
- `GET /api/v1/search?q=...` — the same pipeline as the search box (rule parser, plus the AI step when the host enables it), returning `{parser, intent, offers, summary}`.
- `GET /api/v1/offers/{id}` and `GET /api/v1/compare?ids=a,b`.
- `GET /openapi.json`, `/llms.txt`, `/llms-full.txt`, `/data/offers.json` (the whole dataset, CC BY 4.0).
- `POST /mcp` — a stateless Streamable-HTTP MCP server with tools `search_offers`, `get_offer`, `compare_offers`, `list_goals`, `rank_bank_apps`.
- `GET /api/v1/apps` and `GET /api/v1/apps/{id}` — Spanish bank mobile apps ranked 0 to 100 (rules in `src/core/app-score.ts`, data in `data/apps/`); the MCP tool `rank_bank_apps` serves the same ranking. The page is `/apps`.
- Offer pages carry schema.org JSON-LD (`FinancialProduct` + `Offer`) with `validThrough` and the source URL.
- Every response carries `verified_on` and `source_url`, so an agent can cite and date its answer.

## Licences

Code: Apache-2.0. Data in `data/`: CC BY 4.0. The hosted AI search runs on the owner's key with a cost ceiling.
