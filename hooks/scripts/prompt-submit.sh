#!/usr/bin/env bash
# UserPromptSubmit hook:
#   - Detects toggle/status intent in the user's prompt ("turn on claudesay",
#     etc.) and handles it in-hook — no Bash tool call from Claude, so no
#     permission prompts.
#   - For all other prompts when the flag is on, emits the per-turn reminder.
set -euo pipefail

FLAG="${CLAUDE_PROJECT_DIR}/.claude/.claudesay-active"
HINT='[claudesay: end chatty reply with <claudesay mood="X">summary</claudesay>]'

INPUT=$(cat)

# Require jq for intent parsing. Fall back to the flag-on hint only.
if ! command -v jq &>/dev/null; then
  [[ -f "$FLAG" ]] || exit 0
  printf '%s\n' "$HINT"
  exit 0
fi

PROMPT=$(printf '%s' "$INPUT" | jq -r '.prompt // empty' 2>/dev/null || true)

# Normalize: lowercase, strip leading/trailing whitespace, strip trailing punctuation.
NORM=$(printf '%s' "$PROMPT" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/^[[:space:]]+|[[:space:]]+$//g; s/[.!]+$//')

INTENT=""
# Order matters: check status/toggle before on/off so "is claudesay on?" isn't
# swallowed by the "on" branch.
if [[ "$NORM" =~ ^(is[[:space:]]+)?claudesay[[:space:]]+(status|active|on)[[:space:]]*\??$ ]]; then
  INTENT="status"
elif [[ "$NORM" =~ ^claudesay[[:space:]]+status[[:space:]]*\??$ ]]; then
  INTENT="status"
elif [[ "$NORM" =~ ^toggle[[:space:]]+claudesay[[:space:]]*\??$ ]]; then
  INTENT="toggle"
elif [[ "$NORM" =~ ^(turn[[:space:]]+on|enable|activate|start)[[:space:]]+(the[[:space:]]+)?claudesay[[:space:]]*\??$ ]]; then
  INTENT="on"
elif [[ "$NORM" =~ ^(turn[[:space:]]+off|disable|deactivate|stop|hide)[[:space:]]+(the[[:space:]]+)?claudesay[[:space:]]*\??$ ]]; then
  INTENT="off"
fi

# Non-toggle prompt: keep existing behaviour.
if [[ -z "$INTENT" ]]; then
  [[ -f "$FLAG" ]] || exit 0
  printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":%s}}\n' \
    "$(printf '%s' "$HINT" | jq -Rs .)"
  exit 0
fi

[[ -f "$FLAG" ]] && CURRENT="on" || CURRENT="off"
RENDER="${CLAUDE_PLUGIN_ROOT}/lib/render.sh"

# Capture the rendered bubble into a string. Writing to /dev/tty gets clobbered
# when Claude Code's TUI redraws its dynamic region; systemMessage lands in
# permanent scrollback instead.
capture_bubble() {
  local msg="$1" mood="$2" tmp bubble
  [[ -f "$RENDER" ]] || { printf ''; return; }
  tmp=$(mktemp)
  CLAUDE_SAY_TTY="$tmp" bash "$RENDER" "$msg" "$mood" 2>/dev/null || true
  bubble=$(cat "$tmp" 2>/dev/null || true)
  rm -f "$tmp"
  printf '%s' "$bubble"
}

# $1 = reason (blocks Claude's turn), $2 = optional systemMessage (bubble)
emit_block() {
  local reason="$1" sysmsg="${2:-}"
  if [[ -n "$sysmsg" ]]; then
    jq -n --arg r "$reason" --arg m "$sysmsg" \
      '{decision:"block", reason:$r, systemMessage:$m}'
  else
    jq -n --arg r "$reason" '{decision:"block", reason:$r}'
  fi
}

case "$INTENT" in
  status)
    if [[ "$CURRENT" == "on" ]]; then
      BUBBLE=$(capture_bubble "claudesay is on" "happy")
      emit_block "claudesay is on." "$BUBBLE"
    else
      emit_block "claudesay is off."
    fi
    ;;
  on)
    if [[ "$CURRENT" == "on" ]]; then
      emit_block "claudesay is already on."
    else
      mkdir -p "$(dirname "$FLAG")"
      touch "$FLAG"
      BUBBLE=$(capture_bubble "claudesay is now on!" "excited")
      emit_block "claudesay turned on." "$BUBBLE"
    fi
    ;;
  off)
    if [[ "$CURRENT" == "off" ]]; then
      emit_block "claudesay is already off."
    else
      rm -f "$FLAG"
      emit_block "claudesay turned off."
    fi
    ;;
  toggle)
    if [[ "$CURRENT" == "on" ]]; then
      rm -f "$FLAG"
      emit_block "claudesay toggled off."
    else
      mkdir -p "$(dirname "$FLAG")"
      touch "$FLAG"
      BUBBLE=$(capture_bubble "claudesay toggled on!" "excited")
      emit_block "claudesay toggled on." "$BUBBLE"
    fi
    ;;
esac
