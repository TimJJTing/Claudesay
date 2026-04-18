#!/usr/bin/env bash
# render.sh — write speech bubble + ASCII figure to /dev/tty (or CLAUDE_SAY_TTY).
# Usage: render.sh "<message>" "<mood>" ["<prop>" "<side>"]
set -euo pipefail

MESSAGE="${1:-}"
MOOD="${2:-happy}"
PROP="${3:-}"
SIDE="${4:-}"

[[ -n "$MESSAGE" ]] || exit 0

TTY="${CLAUDE_SAY_TTY:-/dev/tty}"
# Guard: if writing to /dev/tty (non-interactive), skip silently.
# For any TTY path, also skip if it is not writable (covers CI and bad paths).
if [[ "$TTY" == "/dev/tty" ]] && ! [[ -w /dev/tty ]]; then
  exit 0
fi
if [[ "$TTY" != "/dev/tty" ]] && ! { >> "$TTY"; } 2>/dev/null; then
  exit 0
fi

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# Load defaults, then user override (missing vars in override fall back silently)
source "${PLUGIN_ROOT}/characters/default.sh"
USER_CHAR="${HOME}/.claude/claude-say/character.sh"
[[ -f "$USER_CHAR" ]] && source "$USER_CHAR"

source "${PLUGIN_ROOT}/lib/moods.sh"
FACE=$(get_face "$MOOD")

# Body line: prop replaces hand on the active side; idle hand stays as-is.
if [[ -n "$PROP" && "$SIDE" == "left" ]]; then
  BODY_LINE="${PROP}=${CHAR_BODY}${CHAR_HAND_RIGHT}"
elif [[ -n "$PROP" && "$SIDE" == "right" ]]; then
  BODY_LINE="${CHAR_HAND_LEFT}${CHAR_BODY}=${PROP}"
else
  BODY_LINE="${CHAR_HAND_LEFT}${CHAR_BODY}${CHAR_HAND_RIGHT}"
fi

# Wrap message at 45 chars (bash 3.2-compatible: no mapfile, use herestring)
LINES=()
while IFS= read -r l; do
  LINES+=("$l")
done <<< "$(printf '%s' "$MESSAGE" | fold -sw 45)"

# Find the longest display line (byte length — acceptable for ASCII-BMP messages)
MAX=0
for l in "${LINES[@]+"${LINES[@]}"}"; do
  [[ ${#l} -gt $MAX ]] && MAX=${#l} || true
done

# Build bubble border strings
INNER=$(( MAX + 2 < 8 ? 8 : MAX + 2 ))  # 1-space pad each side; min 8 so RIGHT_REST >= 3
TOP_BORDER=$(printf '─%.0s' $(seq 1 $INNER))
LEFT4=$(printf '─%.0s' $(seq 1 4))
RIGHT_REST=$(printf '─%.0s' $(seq 1 $((INNER - 5))))

{
  printf '\n'
  printf ' ╭%s╮\n' "$TOP_BORDER"
  for l in "${LINES[@]+"${LINES[@]}"}"; do
    printf ' │ %-*s │\n' "$((INNER - 2))" "$l"
  done
  printf ' ╰%s┬%s╯\n' "$LEFT4" "$RIGHT_REST"
  printf '      │\n'
  printf '%s\n'   "${CHAR_TOP}"
  printf '   %s\n' "$FACE"
  printf '  %s\n'  "$BODY_LINE"
  printf '%s\n'   "${CHAR_BOTTOM}"
} > "$TTY"
