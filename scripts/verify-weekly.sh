#!/usr/bin/env bash
# Weekly offer verifier run that opens a pull request for a person to review.
#
#   scripts/verify-weekly.sh          the full run (what launchd starts every Sunday)
#   scripts/verify-weekly.sh --dry    run the verifier, print the summary; no commit, push or PR
#
# It works in its own worktree (~/.worktrees/bankjar/verify-weekly) cut from
# origin/main, so it never touches the checkout you work in. Steps:
#   1. `npm run verify-offers` (network only; it never edits data/ or verified_on).
#   2. scripts/verify-summary.ts writes docs/verification/offers-latest.md: a
#      summary (counts per status, stale offers, expiring offers) plus the report.
#   3. Nothing changed versus the committed report (ignoring the run date and
#      the timestamp) → stop, no PR.
#   4. Commit to verify-weekly-<date>, push, open a PR. THIS SCRIPT NEVER MERGES:
#      a person reads the report, and a changed number is reviewed by hand.
# Only docs/verification/ is ever added to the commit. One run at a time (a
# lock). The worktree is removed at the end unless it holds a commit no remote
# has. If last week's verifier PR is still open, the run stops: nobody has
# reviewed it yet.
set -euo pipefail

DRY=0
[ "${1:-}" = "--dry" ] && DRY=1

REPO="$(cd "$(dirname "$0")/.." && pwd)"
WT="$HOME/.worktrees/bankjar/verify-weekly"
LOCK="$HOME/.worktrees/bankjar/verify-weekly.lock"
# A test hook: cut the worktree from another ref (default origin/main).
BASE_REF="${VERIFY_WEEKLY_BASE:-origin/main}"
TODAY="$(date -u +%Y-%m-%d)"
BRANCH="verify-weekly-${TODAY}"
REPORT_MD="docs/verification/offers-latest.md"

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
    rm -f "$WT/node_modules" 2>/dev/null || true # a symlink to the main checkout's modules
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

# A worktree here outlived its run (a crash, or a commit kept above). Never
# delete it blind: stop and let a person look.
if [ -d "$WT" ]; then
  log "STOP: ${WT} is left from an earlier run; inspect it, then: git -C ${REPO} worktree remove ${WT}"
  rm -rf "$LOCK"
  exit 1
fi

git -C "$REPO" fetch -q origin main

if [ "$DRY" = 0 ]; then
  # Fail closed: a GitHub API error must not read as "no open PR".
  if ! open_prs="$(gh pr list --repo zaitsew/bankjar --state open --search 'head:verify-weekly-' --json number,headRefName --jq '[.[] | select(.headRefName | startswith("verify-weekly-"))] | map("#\(.number) \(.headRefName)") | join(", ")')"; then
    log "STOP: could not list open verifier PRs (GitHub API error); nothing done"
    rm -rf "$LOCK"
    exit 1
  fi
  if [ -n "$open_prs" ]; then
    log "an earlier verifier PR is still open (${open_prs}); review or close it first. Stopping."
    rm -rf "$LOCK"
    exit 0
  fi
  if git -C "$REPO" ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
    # Today's branch exists. If an earlier run pushed it but failed to open the PR, open it now.
    if ! pr_count="$(gh pr list --repo zaitsew/bankjar --state all --head "$BRANCH" --json number --jq 'length')"; then
      log "STOP: branch ${BRANCH} exists and the PR lookup failed (GitHub API error)"
      rm -rf "$LOCK"
      exit 1
    fi
    if [ "$pr_count" = "0" ]; then
      if gh pr create --repo zaitsew/bankjar --head "$BRANCH" --base main --title "Verifier: weekly report ${TODAY}" --body "Opened by a retry: an earlier run pushed ${BRANCH} but could not open its PR. The report is docs/verification/offers-latest.md on the branch. Review before merging; never merged automatically."; then
        log "opened the missing PR for ${BRANCH}"
        rm -rf "$LOCK"
        exit 0
      fi
      log "STOP: branch ${BRANCH} exists with no PR, and opening one failed; open it by hand"
      rm -rf "$LOCK"
      exit 1
    fi
    log "branch ${BRANCH} already exists on origin with a PR; today's run was done. Stopping."
    rm -rf "$LOCK"
    exit 0
  fi
fi

mkdir -p "$(dirname "$WT")"
git -C "$REPO" worktree add -q -b "$BRANCH" "$WT" "$BASE_REF"
trap cleanup EXIT
cd "$WT"

# The verifier is network-bound, not a build: no build slot is awaited here. Disk is
# tight, so reuse the main checkout's modules when it has them.
if [ -d "$REPO/node_modules" ]; then
  ln -s "$REPO/node_modules" node_modules
else
  teyla load --wait --kind build >/dev/null 2>&1 || true
  npm ci --silent --no-audit --no-fund
fi

npm run -s verify-offers > verify.log 2>&1 || { cat verify.log; log "verify-offers crashed; nothing to report"; exit 1; }
grep -E '^(ok|mismatch|unverifiable|blocked)=' verify.log || true
report_md="$(sed -n 's/^report=//p' verify.log | tail -n 1)"
if [ -z "$report_md" ]; then
  cat verify.log
  log "verify-offers printed no report path; stopping"
  exit 1
fi
report_json="${report_md%.md}.json"

mkdir -p docs/verification
summary="$(npx tsx scripts/verify-summary.ts "$report_json" --out "$REPORT_MD" --body pr-summary.md)"
echo "$summary"
changed="$(echo "$summary" | sed -n 's/^changed=//p')"
mismatch="$(echo "$summary" | sed -n 's/^mismatch=//p')"
stale_soon="$(echo "$summary" | sed -n 's/^stale_soon=//p')"
run_date="$(echo "$summary" | sed -n 's/^date=//p')"

if [ "$DRY" = 1 ]; then
  echo
  cat pr-summary.md
  log "dry run: changed=${changed}; nothing committed, pushed or opened"
  exit 0
fi

if [ "$changed" != "1" ]; then
  log "report unchanged versus ${REPORT_MD} on main; no PR"
  exit 0
fi

git add "$REPORT_MD"
git commit -q -m "Verifier: weekly report ${run_date} (${mismatch} mismatch, ${stale_soon} stale soon)

npm run verify-offers, written to ${REPORT_MD}. No file under data/ is touched and
no verified_on is renewed: a person reads the mismatches.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"

{
  cat pr-summary.md
  cat <<'EOF'

Weekly report by `scripts/verify-weekly.sh` (launchd `com.zaitsew.bankjar.verify-weekly`).

- Only `docs/verification/offers-latest.md` changes. No file under `data/` and no `verified_on` is touched.
- A "mismatch" means a number from the YAML was not found on the source page. A person reads the page; the number may be derived.
- This pull request is never merged automatically. Merge it, or close it, after reading.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
} > pr-body.md

git push -q -u origin "$BRANCH"
url="$(gh pr create --base main --head "$BRANCH" --title "Verifier: weekly report ${run_date} (${mismatch} mismatch, ${stale_soon} stale soon)" --body-file pr-body.md)"
log "opened ${url}; left for a person to review"
