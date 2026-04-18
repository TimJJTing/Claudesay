#!/usr/bin/env bash
# UserPromptSubmit hook:
#   - Detects toggle/status intent in the user's prompt ("turn on claude-say",
#     etc.) and handles it in-hook — no Bash tool call from Claude, so no
#     permission prompts.
#   - For all other prompts when the flag is on, emits the per-turn reminder.
set -euo pipefail

FLAG="${CLAUDE_PROJECT_DIR}/.claude/.claude-say-active"
HINT='[claude-say: end chatty reply with <claude-say mood="X">summary</claude-say>]'

INPUT=$(cat)

# Require jq for intent parsing. Fall back to the flag-on hint only.
if ! command -v jq &>/dev/null; then
  [[ -f "$FLAG" ]] || exit 0
  printf '{"systemMessage":%s}\n' "$(printf '%s' "$HINT" | jq -Rs .)"
  exit 0
fi

PROMPT=$(printf '%s' "$INPUT" | jq -r '.prompt // empty' 2>/dev/null || true)

# Normalize: lowercase, strip leading/trailing whitespace, strip trailing punctuation.
NORM=$(printf '%s' "$PROMPT" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/^[[:space:]]+|[[:space:]]+$//g; s/[.!]+$//')

INTENT=""
# Order matters: check status/toggle before on/off so "is claude-say on?" isn't
# swallowed by the "on" branch.
if [[ "$NORM" =~ ^(is[[:space:]]+)?claude[-[:space:]]?say[[:space:]]+(status|active|on)[[:space:]]*\??$ ]]; then
  INTENT="status"
elif [[ "$NORM" =~ ^claude[-[:space:]]?say[[:space:]]+status[[:space:]]*\??$ ]]; then
  INTENT="status"
elif [[ "$NORM" =~ ^toggle[[:space:]]+claude[-[:space:]]?say[[:space:]]*\??$ ]]; then
  INTENT="toggle"
elif [[ "$NORM" =~ ^(turn[[:space:]]+on|enable|activate|start)[[:space:]]+(the[[:space:]]+)?claude[-[:space:]]?say[[:space:]]*\??$ ]]; then
  INTENT="on"
elif [[ "$NORM" =~ ^(turn[[:space:]]+off|disable|deactivate|stop|hide)[[:space:]]+(the[[:space:]]+)?claude[-[:space:]]?say[[:space:]]*\??$ ]]; then
  INTENT="off"
fi

# Non-toggle prompt: keep existing behaviour.
if [[ -z "$INTENT" ]]; then
  [[ -f "$FLAG" ]] || exit 0
  printf '{"systemMessage":%s}\n' "$(printf '%s' "$HINT" | jq -Rs .)"
  exit 0
fi

[[ -f "$FLAG" ]] && CURRENT="on" || CURRENT="off"
RENDER="${CLAUDE_PLUGIN_ROOT}/lib/render.sh"

render_bubble() {
  local msg="$1" mood="$2"
  [[ -f "$RENDER" ]] && bash "$RENDER" "$msg" "$mood" 2>/dev/null || true
}

emit_block() {
  # Suppresses Claude's turn entirely; the rendered bubble is the confirmation.
  jq -n --arg r "$1" '{decision:"block", reason:$r}'
}

case "$INTENT" in
  status)
    if [[ "$CURRENT" == "on" ]]; then
      render_bubble "claude-say is on" "happy"
    fi
    emit_block "claude-say is ${CURRENT}."
    ;;
  on)
    if [[ "$CURRENT" == "on" ]]; then
      emit_block "claude-say is already on."
    else
      mkdir -p "$(dirname "$FLAG")"
      touch "$FLAG"
      render_bubble "claude-say is now on!" "excited"
      emit_block "claude-say turned on."
    fi
    ;;
  off)
    if [[ "$CURRENT" == "off" ]]; then
      emit_block "claude-say is already off."
    else
      rm -f "$FLAG"
      emit_block "claude-say turned off."
    fi
    ;;
  toggle)
    if [[ "$CURRENT" == "on" ]]; then
      rm -f "$FLAG"
      emit_block "claude-say toggled off."
    else
      mkdir -p "$(dirname "$FLAG")"
      touch "$FLAG"
      render_bubble "claude-say toggled on!" "excited"
      emit_block "claude-say toggled on."
    fi
    ;;
esac
