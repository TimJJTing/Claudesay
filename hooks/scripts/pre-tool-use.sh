#!/usr/bin/env bash
set -euo pipefail

ALLOW='{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
FLAG="${CLAUDE_PROJECT_DIR}/.claude/.claudesay-active"
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
# tools.sh uses "none" as sentinel for empty prop/side on the default case.
[[ "$PROP" == "none" ]] && PROP=""
[[ "$SIDE" == "none" ]] && SIDE=""

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
  # Capture render into temp file so we can emit as systemMessage.
  # Writing to /dev/tty gets clobbered when Claude Code's TUI redraws its
  # dynamic region; systemMessage lands in permanent scrollback instead.
  TMP=$(mktemp)
  CLAUDE_SAY_TTY="$TMP" bash "$RENDER" "$LABEL" "$MOOD" "$PROP" "$SIDE" 2>/dev/null || true
  BUBBLE=$(cat "$TMP" 2>/dev/null || true)
  rm -f "$TMP"
  if [[ -n "$BUBBLE" ]]; then
    jq -cn --arg m "$BUBBLE" \
      '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"allow"}, systemMessage:$m}'
    exit 0
  fi
fi

printf '%s\n' "$ALLOW"
