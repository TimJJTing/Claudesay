#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)

FLAG="${CLAUDE_PROJECT_DIR}/.claude/.claudesay-active"
[[ -f "$FLAG" ]] || { printf '{"decision":"approve"}\n'; exit 0; }

if ! command -v jq &>/dev/null; then
  printf '{"decision":"approve"}\n'
  exit 0
fi

# Use last_assistant_message (the full text of the current turn's response)
RESPONSE=$(printf '%s' "$INPUT" | jq -r '.last_assistant_message // empty' 2>/dev/null || true)

if [[ -z "$RESPONSE" ]]; then
  printf '{"decision":"approve"}\n'
  exit 0
fi

# Extract the last <claudesay> tag (POSIX grep -o, no -P needed).
TAG=$(printf '%s' "$RESPONSE" \
  | grep -o '<claudesay mood="[^"]*">[^<]*</claudesay>' \
  | tail -1 || true)

if [[ -n "$TAG" ]]; then
  MOOD=$(printf '%s' "$TAG" | sed 's/.*mood="\([^"]*\)".*/\1/')
  MSG=$(printf '%s' "$TAG"  | sed 's/.*>\(.*\)<\/claudesay>/\1/')

  RENDER="${CLAUDE_PLUGIN_ROOT}/lib/render.sh"
  if [[ -f "$RENDER" ]]; then
    TMP=$(mktemp)
    CLAUDE_SAY_TTY="$TMP" bash "$RENDER" "$MSG" "$MOOD" 2>/dev/null || true
    BUBBLE=$(cat "$TMP" 2>/dev/null || true)
    rm -f "$TMP"
    if [[ -n "$BUBBLE" ]]; then
      jq -n --arg m "$BUBBLE" '{decision:"approve", systemMessage:$m}'
      exit 0
    fi
  fi
fi

printf '{"decision":"approve"}\n'
