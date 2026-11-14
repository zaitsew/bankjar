# Routines

A routine is one repeatable unit of work with one artifact. If it produces two
different deliverables, it is two routines — a routine with two outputs can
never be scheduled or evaluated cleanly, because "did it work" has two
different answers.

Copy `example.yml`, don't edit it — it's the reference schema, and other
routines will diff against it.

Every routine writes into `runs/<date>/` — gitignored, regenerable. What a
routine must not throw away goes into a committed doc instead (`NOTES.md`,
`docs/DECISIONS.md`), not into `runs/`.

## Scheduled jobs (launchd)

- `app-refresh`: Mondays 07:30, `scripts/refresh-apps.sh`. Fetches app-store numbers, merges a data-only PR, deploys.
- `verify-weekly`: Sundays 07:00, `scripts/verify-weekly.sh`. Runs the offer verifier and opens a PR with `docs/verification/offers-latest.md`; no PR when nothing changed. It never merges and never changes `verified_on` or `data/offers`. `--dry` prints the summary only. Install with `scripts/install-launchd.sh verify-weekly`; log `~/Library/Logs/bankjar-verify-weekly.log`.
