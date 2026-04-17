#!/usr/bin/env bash
set -euo pipefail

FLAG="${CLAUDE_PROJECT_DIR}/.claude/.claude-say-active"
[[ -f "$FLAG" ]] || exit 0

HINT='[claude-say: end chatty reply with <claude-say mood="X">summary</claude-say>]'
printf '{"systemMessage":%s}\n' "$(printf '%s' "$HINT" | jq -Rs .)"
