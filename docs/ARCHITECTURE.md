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

1. Rule-based parser first (`src/core/intent.ts`): goal keywords in English, Spanish and Russian, euro amounts, months and years.
2. If `ACCOUNTS_SERVICE_BANKJAR` is set: Haiku 5.5 through the accounts hub (`/functions/v1/ai`, service path, product `bankjar`) fills the same `Intent` type with tool use.
   Anthropic is the primary track (POLICY §1). The hub enforces the per-visitor and product-wide monthly EUR ceilings.
3. Without a key the site still works: the rule parser covers the example prompts.
4. Identical questions are cached for 24 h. Per-IP rate limit: 20 AI searches per hour.

## For agents

- `GET /api/v1/offers?goal=salary&country=ES&income=2500` — ranked offers as JSON.
- `GET /api/v1/search?q=...` — the same pipeline as the search box, returning `{intent, offers, summary}`.
- `GET /api/v1/offers/{id}` and `GET /api/v1/compare?ids=a,b`.
- `GET /openapi.json`, `/llms.txt`, `/llms-full.txt`, `/data/offers.json` (the whole dataset, CC BY 4.0).
- `POST /mcp` — a stateless Streamable-HTTP MCP server with tools `search_offers`, `get_offer`, `compare_offers`, `list_goals`.
- Offer pages carry schema.org JSON-LD (`FinancialProduct` + `Offer`) with `validThrough` and the source URL.
- Every response carries `verified_on` and `source_url`, so an agent can cite and date its answer.

## Licences

Code: Apache-2.0. Data in `data/`: CC BY 4.0. The hosted AI search runs on the owner's key with a cost ceiling.
