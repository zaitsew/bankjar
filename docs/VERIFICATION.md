# Verification — night sprint 2026-10-21/22

Live: **https://bankjar.fabriquefutur.com** (shared droplet `fabrique-apps-1`, main at `3537786`). Checked 2026-10-22 08:25 Europe/Madrid.

## What was checked, and how

| Check | Result |
|---|---|
| `./check.sh` | 260 tests pass; `validate-data` offers=69 goals=5 |
| Routes `/`, `/search`, `/leaderboard/salary`, `/compare`, `/llms.txt`, `/openapi.json`, `/data/offers.json`, `/api/v1/*` | 200 on the live host |
| Owner's prompt "Find me the best bank offer for transferring my salary" (`/api/v1/search` and `/search`) | goal salary, parser `rules`; 14 offers ranked; BBVA first (€615.60 net, year one), Bankinter second (€486) |
| MCP `npm run mcp:smoke -- https://bankjar.fabriquefutur.com/mcp` | 9 checks pass with the official MCP client: initialize, tools/list, all four tools, cited sources, unknown id is an error |
| `/data/offers.json` | 69 offers, CC BY 4.0 |
| Screens in a browser | home, search, leaderboard, side by side: `docs/screenshots/` |
| Cross-provider review | Codex GPT-6.1 Sol on every code PR (#2, #4–#7, #9): P1=0; every P2 fixed before merge |

## The dataset

69 offers from 26 issuers (22 Spanish banks, four Raisin partner banks): salary 14, savings 20, account 17, deposit 15, welcome 3.
Every file has `source_url` and `verified_on: 2026-10-22`. 5 files say `confirmed_by: aggregator`: BBVA and Bankinter blocked every fetch.

The kickoff's examples against the live pages: BBVA pays up to €760 gross in year one with no lock-in, not €800 for a 1-year commitment.
No bank page offers Santander's iPhone today; its live offer is up to €840 over 24 months, which BankJar now counts as €420 gross in year one (#9).

## Not done or not verified

- **AI search is off.** The code and the hub product are in place; the hub secret is not set, so the rule parser answers every question. Turning it on is a spend decision for the owner.
- **Hosting is the droplet, not Vercel.** The Vercel connector returned 403 and the CLI was not logged in.
- **Blind pick** is labelled "Coming soon" (Sprint 3).
- **Freshness** is manual until the Sprint 2 verifier: offers go stale after 30 days and hide after 60.
- Not tested on a phone; the layout was built for 375 px and checked only at the browser pane's width.
