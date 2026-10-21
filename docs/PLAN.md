# Plan

BankJar answers one question: **which bank offer pays me most for what I want to do?**
It starts with Spain, because the owner lives there and Spanish banks compete hard with payroll bonuses.

> "compares bank products by different goals- in the main screen AI search with the examples of prompts - like "Find me the best bank offer for transferring my salary". And comparison table as a result"

## What exists today (survey 2026-10-21)

| Site | What it does well | What it lacks |
|---|---|---|
| Banco de España comparators | Official fees and rates for accounts, deposits, mortgages | No bonuses or gifts; no update date |
| HelpMyCash (has "KiBi" AI) | Monthly rankings, broad coverage | Sponsorship "may affect the order"; no API |
| Rankia, Kelisto, Roams | Payroll-bonus articles, mortgages | Headline amounts only; sources disagree (BBVA €1,200 vs €1,060) |
| Check24 (DE), MoneySavingExpert (UK) | Per-row condition dates, switch-bonus tables | Not in Spain; commission-driven |
| Doctor of Credit (US) | Dated bonus posts with exact terms | US only, blog format |

No Spanish comparator found publishes an API, an MCP server, a working `llms.txt` or open data.
None found puts a €800 cash bonus over 12 months and a €1,500 phone over 36 months on one scale.

## What BankJar does differently

1. **One scale for every reward.** First-year net value in EUR, and value per month of commitment.
   Cash is counted after 19% withholding. Gifts count at 80% of retail by default; the person can change that.
2. **Terms, not headlines.** Each row shows commitment, minimum income, penalties and who is eligible (resident, NIE/TIE, non-resident).
3. **Dated rows.** Each offer has `verified_on` and a source URL. Rows older than 30 days are marked stale.
4. **Open ranking.** The scoring code and the data are public. No paid placement. The ranking rule is one page.
5. **Built for agents from day one.** JSON API, OpenAPI, MCP server, `llms.txt`, a CC BY dataset and JSON-LD on every offer page.

## The screens (after arena.ai)

> "It should be similar to https://arena.ai/"

arena.ai's home: near-black page, a serif headline with one highlighted word, a centred prompt box,
a mode switch (Battle · Side by Side · Direct) and a grid of example cards with an icon, title and subtitle.
Its leaderboard ranks models by anonymous pairwise votes.

BankJar copies that structure:

- **Home.** Headline "Find the bank offer that pays you *most*". Prompt box. Mode switch: **Search · Side by side · Blind pick**.
  Six example cards: Move my salary · Park my savings · Free everyday account · Account as a non-resident · Best 12-month deposit · Bonus without payroll.
- **Results.** The parsed intent as editable chips (goal, income, max commitment, residency, gift factor), a two-sentence AI summary, then the comparison table:
  bank, offer, reward, commitment, net value, value per month, requirements, catches, verified date, source.
- **Leaderboards.** One table per goal, like arena's leaderboard, sorted by net value for a default profile.
- **Side by side.** Two or three offers, every field in one grid.
- **Blind pick (Sprint 3).** Two offers without bank names; the person picks one, then sees the banks.
  Blind picks build a "people's choice" ranking beside the money ranking. This tests whether brand drives choice.
- **Offer page.** All terms, the score breakdown, the change history and the source link.

## Useful for people

- Answers in the person's words, in English, Spanish or Russian.
- Personal filters: income, new customer or not, residency, longest commitment accepted.
- Catches up front: clawback, mandatory insurance, card-spend requirements.
- Not financial advice. Each page says so and links to the source.

## Useful for agents

> "make a plan on how to make it useful both for people and AI agents"

- `GET /api/v1/search?q=` returns the same answer as the search box, with `verified_on` and `source_url` on every row.
- `GET /api/v1/offers?goal=salary&income=2500&max_commitment=12` for agents that already know the filters.
- `POST /mcp`: a remote MCP server (`search_offers`, `get_offer`, `compare_offers`, `list_goals`). Later an `npx bankjar-mcp` stdio package.
- `/llms.txt` and `/llms-full.txt`: what BankJar is and how to query it.
- `/data/offers.json`: the full dataset, CC BY 4.0. The same files are in the repo.
- JSON-LD on offer pages, so search engines and answer engines read the terms.

## Open source

> "let's make this tool partly or fully open-source"

Fully open: code under Apache-2.0, data under CC BY 4.0.
Trust is the product: a person or an agent can read how the ranking works and check every number.
The hosted site keeps two things a fork does not get for free: daily verification and the AI search key.

## Money (later, owner's decision)

Affiliate links only if they never change the order, with a visible label and the rule in code.
The default is no affiliate links until the owner decides.

## Risks

- **Stale data is the main risk.** Offers change monthly. Sprint 2 adds a verifier that re-reads every source page and opens a pull request when terms change.
- **Wrong numbers.** The AI never writes a number; the table comes from the data. Every number links to its source.
- **AI cost.** The hub caps the product at 25 EUR per month and each visitor at 1 EUR. The rule parser works without AI.
