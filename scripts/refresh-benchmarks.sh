#!/usr/bin/env bash
# Daily refresh of the market benchmarks: fetch, gate, PR, merge, deploy.
#
#   scripts/refresh-benchmarks.sh          the full run (what launchd starts every day at 08:00)
#   scripts/refresh-benchmarks.sh --dry    fetch and print the diff; no commit, push or deploy
#
# It works in its own worktree (~/.worktrees/bankjar/benchmark-refresh) cut from
# origin/main, so it never touches the checkout you work in. Steps:
#   1. npm ci, then `npm run fetch-benchmarks`. A series whose fetch failed, did not
#      parse or fell outside its sanity range keeps its old file; the run goes on.
#   2. Nothing material changed → stop. Material means a new value or period. A run
#      that only moves fetched_on ships at most once a week (a heartbeat), so the
#      stale flag stays honest without a PR a day.
#   3. The diff may touch data/benchmarks/ and nothing else. Offers, apps, code: refused.
#   4. ./check.sh must pass, or the run stops with nothing pushed.
#   5. Commit to benchmark-refresh-<date>, push, open a PR, `gh pr merge --merge`.
#      Self-merge is allowed for this routine only: official API values behind
#      sanity ranges, parsers tested on saved responses, and step 3.
#   6. scripts/deploy.sh, so the live pages and /api/v1/benchmarks show the new numbers.
# One run at a time (a lock). The worktree is removed at the end unless it holds a
# commit no remote has. A run with nothing new still deploys main when an earlier
# merge never reached the site (the pending marker), so a failed deploy heals.
#
# BANKJAR_NODE_MODULES=<dir>  link that node_modules instead of running npm ci
#                             (a dry run on a laptop with little disk).
set -euo pipefail

DRY=0
[ "${1:-}" = "--dry" ] && DRY=1

REPO="$(cd "$(dirname "$0")/.." && pwd)"
WT="$HOME/.worktrees/bankjar/benchmark-refresh"
LOCK="$HOME/.worktrees/bankjar/benchmark-refresh.lock"
PENDING="$HOME/.worktrees/bankjar/benchmark-refresh.deploy-pending"
TODAY="$(date -u +%Y-%m-%d)"
BRANCH="benchmark-refresh-$(date -u +%Y%m%d-%H%M%S)"
HEARTBEAT_DAYS=7

log() { printf '%s  %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# One run at a time: mkdir is atomic. A lock whose PID is gone is left by a crash.
mkdir -p "$(dirname "$LOCK")"
if ! mkdir "$LOCK" 2>/dev/null; then
  pid="$(cat "$LOCK/pid" 2>/dev/null || true)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    log "another run (pid ${pid}) is in progress; stopping"
    exit 0
  fi
  log "removing a stale lock (pid ${pid:-unknown} is gone)"
  rm -rf "$LOCK"
  mkdir "$LOCK"
fi
echo $$ > "$LOCK/pid"

# The worktree is this run's own. Remove it at the end, unless it holds a commit
# that reached no remote: then keep it and say so, so nothing is lost.
cleanup() {
  cd "$REPO"
  if [ -d "$WT" ]; then
    head="$(git -C "$WT" rev-parse HEAD 2>/dev/null || true)"
    if [ -n "$head" ] && [ -z "$(git -C "$REPO" branch -r --contains "$head" 2>/dev/null)" ]; then
      log "KEPT ${WT}: commit ${head} is on no remote; push or delete it by hand"
    else
      git worktree remove --force "$WT" >/dev/null 2>&1 || true
      git worktree prune
      git branch -D "$BRANCH" >/dev/null 2>&1 || true
    fi
  fi
  rm -rf "$LOCK"
}

log "start (dry=${DRY})"
if command -v teyla >/dev/null 2>&1; then teyla load --wait --kind build >/dev/null 2>&1 || true; fi

# A worktree here outlived its run (a crash, or a commit kept above). Never
# delete it blind: stop and let a person look.
if [ -d "$WT" ]; then
  log "STOP: ${WT} is left from an earlier run; inspect it, then: git -C ${REPO} worktree remove ${WT}"
  rm -rf "$LOCK"
  exit 1
fi

git -C "$REPO" fetch -q origin main
mkdir -p "$(dirname "$WT")"
git -C "$REPO" worktree add -q -b "$BRANCH" "$WT" origin/main
trap cleanup EXIT
cd "$WT"

if [ -n "${BANKJAR_NODE_MODULES:-}" ]; then
  ln -s "$BANKJAR_NODE_MODULES" node_modules
else
  npm ci --silent --no-audit --no-fund
fi
fetch_status=0
npm run -s fetch-benchmarks > fetch.log 2>&1 || fetch_status=$?
cat fetch.log
problems="$(grep -E 'KEPT OLD FILE|FAILED|INVALID' fetch.log || true)"

# Material = any changed line other than fetched_on.
material="$(git diff -U0 -- data/benchmarks | grep -E '^[+-][a-z_]+:' | grep -vE '^(\+\+\+|---)' | grep -vE '^[+-]fetched_on:' || true)"

# Heartbeat: the oldest fetched_on at origin/main, in days before today.
oldest="$(git grep -h '^fetched_on:' origin/main -- data/benchmarks | awk '{print $2}' | sort | head -1)"
age_days=0
if [ -n "$oldest" ]; then
  age_days="$(( ( $(date -u -j -f %Y-%m-%d "$TODAY" +%s 2>/dev/null || date -u -d "$TODAY" +%s) - $(date -u -j -f %Y-%m-%d "$oldest" +%s 2>/dev/null || date -u -d "$oldest" +%s) ) / 86400 ))"
fi

if git diff --quiet -- data/benchmarks; then
  have_change=0
elif [ -n "$material" ] || [ "$age_days" -ge "$HEARTBEAT_DAYS" ]; then
  have_change=1
else
  have_change=0
fi

if [ "$have_change" = 0 ]; then
  # Nothing to merge. If an earlier merge never reached the site (a failed
  # deploy), the pending marker is still there: deploy main now.
  if [ "$DRY" = 0 ] && [ -f "$PENDING" ]; then
    log "no change, but an earlier merge was not deployed: deploying main"
    git fetch -q origin main
    # Deploy exactly origin/main: drop this run's unreviewed fetch edits first.
    git checkout -q --force --detach origin/main
    git clean -fdq -- data/benchmarks
    ./scripts/deploy.sh
    rm -f "$PENDING"
    log "deployed; done"
  else
    log "no new value or period under data/benchmarks (oldest fetched_on ${oldest:-none}, ${age_days} day(s) old); nothing to ship"
  fi
  exit "$fetch_status"
fi

changed="$(git diff --name-only -- data/benchmarks | wc -l | tr -d ' ')"
if [ -n "$material" ]; then
  reason="new value or period"
else
  reason="heartbeat: only fetched_on moved, oldest is ${age_days} day(s) old"
fi
log "${changed} benchmark file(s) changed (${reason})"

# The gate that makes a self-merge acceptable: this run may touch benchmark data and nothing else.
outside="$(git status --porcelain | awk '{print $2}' | grep -vE '^(data/benchmarks/|fetch\.log$|pr-body\.md$|node_modules$)' || true)"
if [ -n "$outside" ]; then
  log "STOP: the run changed files outside data/benchmarks/; nothing committed:"
  echo "$outside"
  exit 1
fi

if [ "$DRY" = 1 ]; then
  git diff --stat -- data/benchmarks
  git diff -U0 -- data/benchmarks | grep -E '^[+-][a-z_]+:' | grep -vE '^(\+\+\+|---)' || true
  log "dry run: nothing committed, pushed or deployed"
  exit 0
fi

if ! ./check.sh; then
  log "check.sh FAILED; nothing pushed"
  exit 1
fi

git add data/benchmarks
staged_outside="$(git diff --cached --name-only | grep -v '^data/benchmarks/' || true)"
if [ -n "$staged_outside" ]; then
  log "STOP: staged files outside data/benchmarks/:"
  echo "$staged_outside"
  git reset -q
  exit 1
fi

commit_extra=""
if [ -n "$problems" ]; then commit_extra=" Series that kept their old file:"$'\n'"${problems}"; fi
git commit -q -m "Data: benchmark refresh ${TODAY}

npm run fetch-benchmarks, ${changed} file(s) changed (${reason}).${commit_extra}"

# Built outside the heredoc: macOS /bin/bash 3.2 cannot parse a multi-line
# ${var:+...} inside one.
problems_md=""
if [ -n "$problems" ]; then
  FENCE='```'
  NL=$'\n'
  problems_md="${NL}**Series that kept their old file.** Failed fetch, unparseable response or value outside the sanity range:${NL}${NL}${FENCE}${NL}${problems}${NL}${FENCE}"
fi
cat > pr-body.md <<EOF
Daily refresh of the market benchmarks by \`scripts/refresh-benchmarks.sh\` (launchd \`com.zaitsew.bankjar.benchmark-refresh\`).

- \`npm run fetch-benchmarks\`: ${changed} file(s) changed under \`data/benchmarks/es/\` (${reason}).
- The diff touches \`data/benchmarks/\` only; offers, apps and code are untouched.
- \`./check.sh\`: OK.

<details><summary>fetch-benchmarks output</summary>

\`\`\`
$(cat fetch.log)
\`\`\`
</details>
${problems_md}
EOF

git push -q -u origin "$BRANCH"
url="$(gh pr create --base main --head "$BRANCH" --title "Data: benchmark refresh ${TODAY}" --body-file pr-body.md)"
log "opened ${url}"
gh pr merge "$url" --merge
# Merged but not yet deployed: mark it before anything else can fail.
echo "$url" > "$PENDING"
log "merged ${url}"
git push -q origin --delete "$BRANCH" || true

# The merge commit is on origin/main; deploy exactly that.
git fetch -q origin main
git checkout -q --force --detach origin/main
./scripts/deploy.sh
rm -f "$PENDING"
log "deployed; done"
