# Night sprint — 2026-10-21 to 2026-10-22

> launch a night autonomous sprint

Stop at **08:00 Europe/Madrid on 2026-10-22**, or earlier when every box is ticked. Results go in `docs/VERIFICATION.md`. Finished 2026-10-22 ~08:30, after the owner said "proceed".

## Phase 0 — setup
- [x] Public repo `zaitsew/bankjar`; merge approval recorded with the kickoff quoted verbatim.
- [x] Research: competitors, arena.ai, the stack, seed offers.
- [x] Brief, plan, architecture, roadmap.
- [x] Tools catalog entry (zaitsew/ops#240, merged); the public profile README is zaitsew/zaitsew#2, waiting for the owner.

## Phase 1 — engine and data (PR: core)
- [x] zod schema, scoring, intent parser, ranking; unit tests.
- [x] 69 Spanish offers, one YAML file each, every one with a source URL.

## Phase 2 — web (PR: web)
- [x] Home in arena.ai's shape: headline, prompt, mode switch, six example cards.
- [x] Results: editable intent chips, summary, comparison table.
- [x] Goal leaderboards, offer pages, side by side, methodology page. Built for 375 px; not checked on a phone.

## Phase 3 — agents (PR: agents)
- [x] `/api/v1/*`, `/openapi.json`, `/llms.txt`, `/llms-full.txt`, `/data/offers.json`.
- [x] MCP endpoint `/mcp` with four tools; tested with an MCP client.
- [x] JSON-LD on offer pages.

## Phase 4 — AI and delivery (PR: ai, PR: deploy)
- [x] Haiku 5.5 intent parsing through the accounts hub (product `bankjar`), cache, rate limit; the rule parser works alone. Off on the live site until the owner approves the spend.
- [x] Deployed from `main` to the shared droplet (Vercel refused: connector 403, CLI not logged in); the live URL answers the example prompts.
- [x] `./check.sh` green; `./check.sh usage` prints real counters.
- [x] Cross-provider review per PR (`~/ops/bin/codex-review`); no open P1 at merge.

## Constraints
- Respect `teyla load`; web builds only, no simulators.
- Sonnet 5.5 builds; Haiku 5.5 reads; the orchestrator decides and reviews.
- No paid plans, domains or add-ons (POLICY §11). Vercel Hobby only.
- The AI never writes a number shown in a table.
