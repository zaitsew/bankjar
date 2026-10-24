#!/usr/bin/env bash
# Weekly refresh of the bank-app store numbers: fetch, gate, PR, merge, deploy.
#
#   scripts/refresh-apps.sh          the full run (what launchd starts every Monday)
#   scripts/refresh-apps.sh --dry    fetch and print the diff; no commit, push or deploy
#
# It works in its own worktree (~/.worktrees/bankjar/app-refresh) cut from
# origin/main, so it never touches the checkout you work in. Steps:
#   1. npm ci, then `npm run fetch-apps`. An app whose store failed keeps its old
#      numbers and its old verified_on; the run goes on with the others.
#   2. No change under data/apps → stop.
#   3. ./check.sh must pass, or the run stops with nothing pushed.
#   4. Commit to app-refresh-<date>, push, open a PR, `gh pr merge --merge`.
#   5. scripts/deploy.sh, so the live /apps page shows the new numbers.
# One run at a time (a lock). The worktree is removed at the end unless it holds
# a commit no remote has. A run with nothing new still deploys main when the live
# site is behind it, so a failed deploy heals on the next run.
set -euo pipefail

DRY=0
[ "${1:-}" = "--dry" ] && DRY=1

REPO="$(cd "$(dirname "$0")/.." && pwd)"
WT="$HOME/.worktrees/bankjar/app-refresh"
LOCK="$HOME/.worktrees/bankjar/app-refresh.lock"
PENDING="$HOME/.worktrees/bankjar/app-refresh.deploy-pending"
SITE="https://bankjar.fabriquefutur.com"
TODAY="$(date -u +%Y-%m-%d)"
BRANCH="app-refresh-$(date -u +%Y%m%d-%H%M%S)"

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

npm ci --silent --no-audit --no-fund
fetch_status=0
npm run -s fetch-apps > fetch.log 2>&1 || fetch_status=$?
cat fetch.log
problems="$(grep -E 'FAILED|INVALID' fetch.log || true)"

if git diff --quiet -- data/apps; then
  # Nothing new to merge. If an earlier merge never reached the site (a failed
  # deploy), the live dataset version is behind main: deploy main now.
  repo_version="$(npx tsx scripts/apps-version.ts)"
  live_version="$(npx tsx scripts/apps-version.ts --live "$SITE" || echo unknown)"
  if [ "$DRY" = 0 ] && { [ -f "$PENDING" ] || [ "$repo_version" != "$live_version" ]; }; then
    log "no change, but the site serves ${live_version} and main has ${repo_version}: deploying main"
    ./scripts/deploy.sh
    rm -f "$PENDING"
    log "deployed; done"
  else
    log "no change under data/apps; nothing to ship (site ${live_version})"
  fi
  exit "$fetch_status"
fi
changed="$(git diff --name-only -- data/apps | wc -l | tr -d ' ')"
log "${changed} app file(s) changed"

if [ "$DRY" = 1 ]; then
  git diff --stat -- data/apps
  log "dry run: nothing committed, pushed or deployed"
  exit 0
fi

if ! ./check.sh; then
  log "check.sh FAILED; nothing pushed"
  exit 1
fi

git add data/apps
commit_extra=""
if [ -n "$problems" ]; then commit_extra=" Store problems (numbers kept from the last run):"$'\n'"${problems}"; fi
git commit -q -m "Data: weekly app-store refresh ${TODAY}

npm run fetch-apps, ${changed} file(s) changed.${commit_extra}"

# Built outside the heredoc: macOS /bin/bash 3.2 cannot parse a multi-line
# ${var:+...} inside one.
problems_md=""
if [ -n "$problems" ]; then
  FENCE='```'
  NL=$'\n'
  problems_md="${NL}**Store problems.** These apps keep the previous numbers and their old verified_on:${NL}${NL}${FENCE}${NL}${problems}${NL}${FENCE}"
fi
cat > pr-body.md <<EOF
Weekly refresh of the bank-app store numbers by \`scripts/refresh-apps.sh\` (launchd \`com.zaitsew.bankjar.app-refresh\`).

- \`npm run fetch-apps\`: ${changed} file(s) changed under \`data/apps/es/\`.
- \`./check.sh\`: OK.
- Data-only PR: features and notes are never touched by the fetcher.

<details><summary>fetch-apps output</summary>

\`\`\`
$(cat fetch.log)
\`\`\`
</details>
${problems_md}
EOF

git push -q -u origin "$BRANCH"
url="$(gh pr create --base main --head "$BRANCH" --title "Data: weekly app-store refresh ${TODAY}" --body-file pr-body.md)"
log "opened ${url}"
gh pr merge "$url" --merge
log "merged ${url}"
git push -q origin --delete "$BRANCH" || true

# The merge commit is on origin/main; deploy exactly that.
git fetch -q origin main
git checkout -q --detach origin/main
echo "$url" > "$PENDING"
./scripts/deploy.sh
rm -f "$PENDING"
log "deployed; done"
