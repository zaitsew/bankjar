# Contributing

- Run `./check.sh` before you open a PR — it's the same check CI runs.
- One PR per logical unit. If it's two unrelated fixes, it's two PRs.
- Write commit messages that explain *why*, not just *what* — `wip` tells
  nobody anything in six months.
- Merges go through review; see `AGENTS.md` for who can merge without asking.

## Correcting one offer

A wrong number on an offer page is a one-file pull request.

1. Open the offer's file in `data/offers/es/` (the file name is the offer id).
2. Change the wrong term to what the bank's page says.
3. Set `source_url` to the page that shows it, and `verified_on` to the day you read that page.
4. Run `./check.sh`, then open the pull request. Say in the description what changed and quote the line from the bank's page.

You do not need to fix it yourself: the "Report a wrong offer" link on each offer page opens an issue form. Never put personal data in a public issue.
