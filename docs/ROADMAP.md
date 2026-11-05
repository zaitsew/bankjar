# Roadmap

Primary platform: web. Country: Spain first. Rewritten 2026-11-05; the reasons are in `docs/DECISIONS.md`.

## Sprint 1 — night of 2026-10-21 (MVP)

> "launch a night autonomous sprint"

- [x] Repo, licences, docs (brief, plan, architecture, roadmap).
- [x] Offer schema, scoring engine, intent parser, ranking, with tests.
- [x] Seed data: 69 Spanish offers, each with a source URL and `verified_on`.
- [x] Web: home with prompt and example cards, results table, goal leaderboards, offer pages, side by side, methodology.
- [x] Agent surface: JSON API, OpenAPI, `llms.txt`, `offers.json`, MCP endpoint, JSON-LD.
- [x] AI search: Haiku 5.5 through the accounts hub, rule parser fallback, cache and rate limit (on since 2026-10-22, 15 EUR a month ceiling).
- [x] Bank app ranking (2026-10-22): `/apps`, `/api/v1/apps`, MCP `rank_bank_apps`; 24 Spanish bank apps scored from App Store and Google Play numbers.
- [x] Deployed on the shared droplet (Vercel refused); README quick start; `./check.sh usage` counters.
- [x] Stale badges and the MCP offer-cards widget.
- [x] Claude connector approved (2026-11-04). Directory feedback answered in #30: MCP text states facts, caveats travel as data.

## Sprint 2 — fresh data, deadline 2026-11-21

> "make it useful both for people and AI agents"

All 69 offers carry `verified_on: 2026-10-22`. They all go stale on 2026-11-21 and leave the rankings on 2026-12-21.

- [ ] Deploy #30, and confirm the new instructions on the live `/mcp`.
- [ ] `scripts/verify-offers.ts`: fetch each `source_url`, compare the numbers in the YAML with the page text, report ok, mismatch or blocked.
- [ ] Re-verify all 69 offers. A person or an agent reads every mismatch. BBVA and Bankinter (5 offers) block fetches and need another route. A failed fetch never renews `verified_on`.
- [ ] Weekly verifier run that opens a pull request. A changed number is reviewed and never merged automatically.
- [ ] "Report a wrong offer" issue form, linked from each offer page.

## Owner's step, this week — the legal question

`docs/LEGAL-FEE-COMPARISON.md` holds the open question and the text to send a lawyer. It runs beside Sprint 2. Until it is answered, no new feature adds fee comparison. Nothing is removed on a guess either.

## Sprint 3 — first attempts to sell

> "useful both for people and AI agents"

`teyla growth sale-attempts` says "not tried yet". Agents draft; the owner approves everything that is published.

- [ ] Publish the Claude listing (the owner's click, after #30 is live).
- [ ] ChatGPT: rescan, demo video, submit. Claude plugin bundle. Gemini after Loco's application.
- [ ] Real usage counters. `./check.sh usage` counts the dataset, so today nobody can tell whether anyone uses BankJar. The privacy page changes in the same PR.
- [ ] Post drafts fed by real events: an offer change, a new top offer, a stale bonus that disappeared.

## Sprint 4 — Spanish, then Blind pick

> "It should be similar to https://arena.ai/"

- [ ] Spanish interface. Watch five target users run a comparison and count how many finish.
- [ ] Blind pick: two offers without bank names, then the reveal; a people's-choice ranking. The home page says "Coming soon" today.
- [ ] Saved profile in the browser and shareable result links.
- [ ] Change history on the offer page and in the API ("BBVA: €800 → €600 on 2026-11-03"). The data's git log already holds it.
- [ ] Russian interface.

## Later — only when the verifier keeps Spain fresh unattended

More rows mean more rows that expire.

- Portugal, Germany, Italy, France. Mortgages and credit cards with their own scoring.
- `npx bankjar-mcp` stdio package and an embeddable widget. The directories take the remote server that already exists.

## Later — the owner decides

- Alerts when a better offer appears (needs accounts).
- Affiliate links that never change the order. The legal note says what these would need first.
- A custom domain (paid; ask first).
