#!/usr/bin/env bash
# Install the weekly app-store refresh into the current user's launchd. Safe to run again.
#
#   scripts/install-launchd.sh            install or update
#   scripts/install-launchd.sh --remove   unload and delete
set -euo pipefail

LABEL="com.zaitsew.bankjar.app-refresh"
SRC="$(cd "$(dirname "$0")/.." && pwd)/deploy/launchd/${LABEL}.plist"
DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"
DOMAIN="gui/$(id -u)"

if launchctl print "${DOMAIN}/${LABEL}" >/dev/null 2>&1; then
  launchctl bootout "${DOMAIN}/${LABEL}" || true
fi

if [ "${1:-}" = "--remove" ]; then
  rm -f "$DEST"
  echo "removed ${LABEL}"
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
sed "s|__HOME__|${HOME}|g" "$SRC" > "$DEST"
plutil -lint "$DEST" >/dev/null
launchctl bootstrap "$DOMAIN" "$DEST"
echo "installed ${LABEL}: runs Mondays at 07:30, log at ~/Library/Logs/bankjar-app-refresh.log"
echo "run it now with: launchctl kickstart ${DOMAIN}/${LABEL}"
