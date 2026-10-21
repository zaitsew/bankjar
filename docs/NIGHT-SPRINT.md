# Night sprint — 2026-10-21 to 2026-10-22

> launch a night autonomous sprint

Stop at **08:00 Europe/Madrid on 2026-10-22**, or earlier when every box is ticked. Results go in `docs/VERIFICATION.md`.

## Phase 0 — setup
- [x] Public repo `zaitsew/bankjar`; merge approval recorded with the kickoff quoted verbatim.
- [x] Research: competitors, arena.ai, the stack, seed offers.
- [x] Brief, plan, architecture, roadmap.
- [ ] Tools catalog entry (ops PR) and the public profile README.

## Phase 1 — engine and data (PR: core)
- [ ] zod schema, scoring, intent parser, ranking; unit tests.
- [ ] 20+ Spanish offers, one YAML file each, every one with a source URL.

## Phase 2 — web (PR: web)
- [ ] Home in arena.ai's shape: headline, prompt, mode switch, six example cards.
- [ ] Results: editable intent chips, AI summary, comparison table.
- [ ] Goal leaderboards, offer pages, side by side, methodology page. Works at 375 px wide.

## Phase 3 — agents (PR: agents)
- [ ] `/api/v1/*`, `/openapi.json`, `/llms.txt`, `/llms-full.txt`, `/data/offers.json`.
- [ ] MCP endpoint `/mcp` with four tools; tested with an MCP client.
- [ ] JSON-LD on offer pages.

## Phase 4 — AI and delivery (PR: ai, PR: deploy)
- [ ] Haiku 5.5 intent parsing through the accounts hub (product `bankjar`), cache, rate limit; the rule parser works alone.
- [ ] Vercel deployment from `main`; the live URL answers the example prompts.
- [ ] `./check.sh` green; `./check.sh usage` prints real counters.
- [ ] Cross-provider review per PR (`~/ops/bin/codex-review`); no open P1 at merge.

## Constraints
- Respect `teyla load`; web builds only, no simulators.
- Sonnet 5.5 builds; Haiku 5.5 reads; the orchestrator decides and reviews.
- No paid plans, domains or add-ons (POLICY §11). Vercel Hobby only.
- The AI never writes a number shown in a table.
