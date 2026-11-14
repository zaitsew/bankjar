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
- `benchmark-refresh`: every day 08:00, `scripts/refresh-benchmarks.sh`. Fetches BdE, ECB, Letra and CPI numbers into `data/benchmarks/`, merges a data-only PR, deploys. It self-merges only when the diff touches `data/benchmarks/` and nothing else, and only for a new value or period, or once a week to move `fetched_on` so the stale flag stays honest. A series whose fetch failed or fell outside its sanity range keeps its old file and is listed in the PR body. `--dry` prints the diff only. Install with `scripts/install-launchd.sh benchmark-refresh`; log `~/Library/Logs/bankjar-benchmark-refresh.log`.
