#!/usr/bin/env bash
# Build the ZIP for the OpenAI plugin directory (platform.openai.com/plugins > Upload new or
# existing plugin). The package is directory/openai-plugin/: a Codex-format manifest, the MCP
# server entry and the icons. Output: dist/bankjar-openai-plugin.zip. Never put credentials in it.
#
#   ./scripts/build-plugin-zip.sh
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="directory/openai-plugin"
OUT="dist/bankjar-openai-plugin.zip"

command -v zip >/dev/null 2>&1 || { echo "MISSING: zip (brew install zip)" >&2; exit 1; }
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); JSON.parse(require("fs").readFileSync(process.argv[2],"utf8"))' \
  "$SRC/.codex-plugin/plugin.json" "$SRC/.mcp.json" || { echo "invalid JSON in $SRC" >&2; exit 1; }

mkdir -p dist
rm -f "$OUT"
# The manifest and the MCP file sit at fixed paths; -X drops file metadata so the ZIP is reproducible.
(cd "$SRC" && zip -qrXD "../../$OUT" .codex-plugin .mcp.json assets)
unzip -l "$OUT"
echo "built $OUT"
