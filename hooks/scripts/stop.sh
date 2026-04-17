#!/usr/bin/env bash
set -euo pipefail

FLAG="${CLAUDE_PROJECT_DIR}/.claude/.claude-say-active"
[[ -f "$FLAG" ]] || { printf '{"decision":"approve"}\n'; exit 0; }

if ! command -v jq &>/dev/null; then
  printf '{"decision":"approve"}\n'
  exit 0
fi

INPUT=$(cat)
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null || true)

if [[ -z "$TRANSCRIPT" || ! -f "$TRANSCRIPT" ]]; then
  printf '{"decision":"approve"}\n'
  exit 0
fi

# Extract the last assistant text block from the JSONL transcript.
LAST_MSG=$(jq -rs '
  map(select(.role == "assistant"))
  | if length == 0 then ""
    else last
      | .content
      | if type == "array" then
          map(select(.type == "text") | .text) | join("")
        elif type == "string" then .
        else ""
        end
    end
' "$TRANSCRIPT" 2>/dev/null || true)

if [[ -z "$LAST_MSG" ]]; then
  printf '{"decision":"approve"}\n'
  exit 0
fi

# Extract the last <claude-say> tag (POSIX grep -o, no -P needed).
TAG=$(printf '%s' "$LAST_MSG" \
  | grep -o '<claude-say mood="[^"]*">[^<]*</claude-say>' \
  | tail -1 || true)

if [[ -n "$TAG" ]]; then
  MOOD=$(printf '%s' "$TAG" | sed 's/.*mood="\([^"]*\)".*/\1/')
  MSG=$(printf '%s' "$TAG"  | sed 's/.*>\(.*\)<\/claude-say>/\1/')

  RENDER="${CLAUDE_PLUGIN_ROOT}/lib/render.sh"
  if [[ -f "$RENDER" ]]; then
    bash "$RENDER" "$MSG" "$MOOD" 2>/dev/null || true
  fi
fi

printf '{"decision":"approve"}\n'
