# Roadmap

Primary platform: web. Country: Spain first.

## Sprint 1 — night of 2026-10-21 (MVP)

> "launch a night autonomous sprint"

- [ ] Repo, licences, docs (brief, plan, architecture, roadmap).
- [ ] Offer schema, scoring engine, intent parser, ranking, with tests.
- [ ] Seed data: 20+ Spanish offers, each with a source URL and `verified_on`.
- [ ] Web: home with prompt and example cards, results table, goal leaderboards, offer pages, side by side, methodology.
- [ ] Agent surface: JSON API, OpenAPI, `llms.txt`, `offers.json`, MCP endpoint, JSON-LD.
- [ ] AI search: Haiku 5.5 through the accounts hub, rule parser fallback, cache and rate limit.
- [ ] Deployed on Vercel; README quick start; `./check.sh usage` counters.

## Sprint 2 — freshness

- Daily verifier: re-read each source page, flag changed terms, open a pull request with the diff.
- Stale badges; offer change history ("BBVA: €800 → €600 on 2026-11-03").
- "Report a wrong offer" issue form; contribution guide for one-file pull requests.

## Sprint 3 — Blind pick and profiles

- Blind pick: two offers without bank names, then the reveal; a people's-choice ranking.
- Saved profile in the browser (income, residency, commitment) and shareable result links.
- Spanish and Russian interface.

## Sprint 4 — agents everywhere

- `npx bankjar-mcp` stdio package; listing in MCP registries.
- Claude connector and ChatGPT app listings; an embeddable results widget.

## Sprint 5 — more countries and products

- Portugal, Germany, Italy, France. Mortgages and credit cards with their own scoring.

## Later — the owner decides

- Alerts when a better offer appears (needs accounts).
- Affiliate links that never change the order.
- A custom domain (paid; ask first).
