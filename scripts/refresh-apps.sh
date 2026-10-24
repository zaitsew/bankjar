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
# The worktree and the local branch are removed at the end, pass or fail.
set -euo pipefail

DRY=0
[ "${1:-}" = "--dry" ] && DRY=1

REPO="$(cd "$(dirname "$0")/.." && pwd)"
WT="$HOME/.worktrees/bankjar/app-refresh"
TODAY="$(date -u +%Y-%m-%d)"
BRANCH="app-refresh-${TODAY}"

log() { printf '%s  %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

cleanup() {
  cd "$REPO"
  if [ -d "$WT" ]; then git worktree remove --force "$WT" >/dev/null 2>&1 || true; fi
  git worktree prune
  git branch -D "$BRANCH" >/dev/null 2>&1 || true
}

log "start (dry=${DRY})"
if command -v teyla >/dev/null 2>&1; then teyla load --wait --kind build >/dev/null 2>&1 || true; fi

git -C "$REPO" fetch -q origin main
# A worktree left by a crashed run holds only this script's own output.
cleanup
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
  log "no change under data/apps; nothing to ship"
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
git commit -q -m "Data: weekly app-store refresh ${TODAY}

npm run fetch-apps, ${changed} file(s) changed.${problems:+ Store problems (numbers kept from the last run):
${problems}}"

body="$(cat <<EOF
Weekly refresh of the bank-app store numbers by \`scripts/refresh-apps.sh\` (launchd \`com.zaitsew.bankjar.app-refresh\`).

- \`npm run fetch-apps\`: ${changed} file(s) changed under \`data/apps/es/\`.
- \`./check.sh\`: OK.
- Data-only PR: features and notes are never touched by the fetcher.

<details><summary>fetch-apps output</summary>

\`\`\`
$(cat fetch.log)
\`\`\`
</details>
${problems:+
**Store problems.** These apps keep last week's numbers and their old verified_on:

\`\`\`
${problems}
\`\`\`}
EOF
)"

git push -q -u origin "$BRANCH"
url="$(gh pr create --base main --head "$BRANCH" --title "Data: weekly app-store refresh ${TODAY}" --body "$body")"
log "opened ${url}"
gh pr merge "$url" --merge
log "merged ${url}"
git push -q origin --delete "$BRANCH" || true

# The merge commit is on origin/main; deploy exactly that.
git fetch -q origin main
git checkout -q --detach origin/main
./scripts/deploy.sh
log "deployed; done"
