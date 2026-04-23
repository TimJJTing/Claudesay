#!/usr/bin/env bash
set -euo pipefail

FLAG="${CLAUDE_PROJECT_DIR}/.claude/.claudesay-active"
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
# Claude Code transcripts wrap each turn under a "message" key:
#   {"message": {"role": "assistant", "content": [...]}}
LAST_MSG=$(jq -rs '
  map(select(.message.role == "assistant"))
  | if length == 0 then ""
    else last
      | .message.content
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

# Extract the last <claudesay> tag (POSIX grep -o, no -P needed).
TAG=$(printf '%s' "$LAST_MSG" \
  | grep -o '<claudesay mood="[^"]*">[^<]*</claudesay>' \
  | tail -1 || true)

if [[ -n "$TAG" ]]; then
  MOOD=$(printf '%s' "$TAG" | sed 's/.*mood="\([^"]*\)".*/\1/')
  MSG=$(printf '%s' "$TAG"  | sed 's/.*>\(.*\)<\/claudesay>/\1/')

  RENDER="${CLAUDE_PLUGIN_ROOT}/lib/render.sh"
  if [[ -f "$RENDER" ]]; then
    # Capture render into temp file so we can emit as systemMessage.
    # Writing to /dev/tty gets clobbered when Claude Code's TUI redraws its
    # dynamic region; systemMessage lands in permanent scrollback instead.
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
