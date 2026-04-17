#!/usr/bin/env bash
set -euo pipefail

ALLOW='{"hookSpecificOutput":{"permissionDecision":"allow"}}'
FLAG="$HOME/.claude/.claude-say-active"
[[ -f "$FLAG" ]] || { printf '%s\n' "$ALLOW"; exit 0; }

if ! command -v jq &>/dev/null; then
  printf '%s\n' "$ALLOW"
  exit 0
fi

INPUT=$(cat)
TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || true)
FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)

[[ -n "$TOOL_NAME" ]] || { printf '%s\n' "$ALLOW"; exit 0; }

source "${CLAUDE_PLUGIN_ROOT}/lib/tools.sh"
read -r PROP MOOD SIDE <<< "$(get_tool_info "$TOOL_NAME")"
# If MOOD is empty, get_tool_info returned a single-token default (e.g. " focused ")
# and read placed it in PROP.  Shift it into the correct variable.
if [[ -z "$MOOD" ]]; then
  MOOD="$PROP"; PROP=""
fi

# Truncate file path label if > 50 chars
if [[ -n "$FILE_PATH" ]]; then
  if (( ${#FILE_PATH} > 50 )); then
    LABEL="${TOOL_NAME} → ${FILE_PATH:0:47}…"
  else
    LABEL="${TOOL_NAME} → ${FILE_PATH}"
  fi
else
  LABEL="$TOOL_NAME"
fi

RENDER="${CLAUDE_PLUGIN_ROOT}/lib/render.sh"
if [[ -f "$RENDER" ]]; then
  bash "$RENDER" "$LABEL" "$MOOD" "$PROP" "$SIDE" 2>/dev/null || true
fi

printf '%s\n' "$ALLOW"
