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
- [x] `scripts/verify-offers.ts` (#33): fetch each `source_url`, compare the numbers in the YAML with the page text, report ok, mismatch, unverifiable or blocked. First run, 2026-11-05: 39 ok, 13 mismatch, 12 unverifiable, 5 blocked.
- [x] Re-verify all 69 offers (done 2026-11-14 in #42, #47, #48; see Sprint 2b). A person or an agent reads every mismatch. BBVA and Bankinter (5 offers) block fetches and need another route. A failed fetch never renews `verified_on`.
- [x] Weekly verifier run that opens a pull request (#49, #50; launchd not installed yet). A changed number is reviewed and never merged automatically.
  Built as `scripts/verify-weekly.sh` (Sundays 07:00, launchd `com.zaitsew.bankjar.verify-weekly`, install with `scripts/install-launchd.sh verify-weekly`): writes `docs/verification/offers-latest.md`, opens a PR only when it changed, never merges.
- [x] "Report a wrong offer" issue form, linked from each offer page (#32).

## Sprint 2b — market context, night of 2026-11-14

> "Think how to expand it with the banking, finance and investment data" (the owner, 2026-11-14)

Official numbers beside the offers, so a person and an agent can tell whether an offer beats the market. Every benchmark comes from an official API or page, carries its period, source and fetch date, and never changes the euro ranking. Grok and Codex both proposed these five sets and this order; the reasons are in `docs/DECISIONS.md`.

- [x] Re-verify all 69 offers (2026-11-14 run: 35 ok, 17 mismatch, 12 unverifiable, 5 blocked): #42 savings, #47 salary and welcome, #48 deposit and account. 66 offers remain; 3 ended and were removed. Not renewed (go stale 2026-11-21 unless confirmed): Kutxabank salary, Revolut Standard, ING NoCuenta, ING Cuenta Nómina.
- [x] Benchmark record (#43): `data/benchmarks/es/*.yaml` with value, unit, period, `source_url`, `fetched_on`, method, a sanity range. A failed fetch or an out-of-range value keeps the old file.
- [x] Fetchers on official APIs with saved fixtures (#43): ECB deposit facility rate, €STR, Banco de España average rate on new household deposits up to one year, INE CPI year on year.
- [x] 12-month Letra del Tesoro (#44): the latest auction's average and marginal yield, gross, parsed from tesoro.es with a fixture.
- [x] Deposit guarantee per issuer (#45): scheme (FGD or the home country's), cover per depositor, legal entity, shared caps. Offer pages, the API and MCP; the score does not change.
- [x] Surfaces: a market strip on the savings and deposit leaderboards (BdE average, ECB rate, 12-month Letra, CPI), a "vs BdE average" line on their offer pages, `/api/v1/benchmarks`, MCP `get_benchmarks`, `llms-full.txt`, `/data/offers.json`, OpenAPI, README.
- [ ] Unattended benchmark refresh: `scripts/refresh-benchmarks.sh`, daily 08:00 (launchd, not installed yet).
- [ ] Deploy everything above. All of it is merged on main; the live site still serves the 2026-11-09 build (the load guard refused the 2026-11-15 build).
- [x] Weekly verifier run that opens a pull request (the Sprint 2 item; #49, #50; launchd not installed yet), so the new rows do not grow faster than the checks.

## Later — investment data, each behind its own gate

- **CNMV money-market and index funds**, a factual catalogue (ISIN, official TER, past return with its warning), Spanish-domiciled only. Gate: Sprint 2b's fetchers run unattended for four weeks, and a reading of the CNMV rules on recommendations. No "best fund" ranking.
- **Pension-plan category averages** (INVERCO or DGSFP, quarterly): categories only, no plan ranks. Same gate.
- **Euribor**: EMMI licenses its use; BankJar's open dataset may not be allowed to copy it. €STR and the Letra cover the need until the licence is read.
- **Mortgages, credit cards, broker and robo-advisor fees**: wait for the fee-comparison opinion (`docs/LEGAL-FEE-COMPARISON.md`). One BdE average mortgage rate may sit in the benchmark set before that.
- **Never**: a recommendation to buy a product, or a question about someone's own situation answered with a fund or a Letra.

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
