#!/usr/bin/env bash
# Install a BankJar job into the current user's launchd. Safe to run again.
#
#   scripts/install-launchd.sh                         app-refresh (the default, as before)
#   scripts/install-launchd.sh verify-weekly           the weekly verifier PR job
#   scripts/install-launchd.sh benchmark-refresh       the daily market-benchmark refresh
#   scripts/install-launchd.sh all                     all three
#   scripts/install-launchd.sh [job] --remove          unload and delete
set -euo pipefail

JOB="app-refresh"
REMOVE=0
for a in "$@"; do
  case "$a" in
    --remove) REMOVE=1 ;;
    app-refresh | verify-weekly | benchmark-refresh | all) JOB="$a" ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="gui/$(id -u)"

install_one() {
  local name="$1" when="$2" logname="$3"
  local label="com.zaitsew.bankjar.${name}"
  local src="${ROOT}/deploy/launchd/${label}.plist"
  local dest="$HOME/Library/LaunchAgents/${label}.plist"

  if launchctl print "${DOMAIN}/${label}" >/dev/null 2>&1; then
    launchctl bootout "${DOMAIN}/${label}" || true
  fi
  if [ "$REMOVE" = 1 ]; then
    rm -f "$dest"
    echo "removed ${label}"
    return
  fi
  mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
  sed "s|__HOME__|${HOME}|g" "$src" > "$dest"
  plutil -lint "$dest" >/dev/null
  launchctl bootstrap "$DOMAIN" "$dest"
  echo "installed ${label}: runs ${when}, log at ~/Library/Logs/${logname}"
  echo "run it now with: launchctl kickstart ${DOMAIN}/${label}"
}

case "$JOB" in
  app-refresh) install_one app-refresh "Mondays at 07:30" bankjar-app-refresh.log ;;
  verify-weekly) install_one verify-weekly "Sundays at 07:00" bankjar-verify-weekly.log ;;
  benchmark-refresh) install_one benchmark-refresh "every day at 08:00" bankjar-benchmark-refresh.log ;;
  all)
    install_one app-refresh "Mondays at 07:30" bankjar-app-refresh.log
    install_one verify-weekly "Sundays at 07:00" bankjar-verify-weekly.log
    install_one benchmark-refresh "every day at 08:00" bankjar-benchmark-refresh.log
    ;;
esac
