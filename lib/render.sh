#!/usr/bin/env bash
# render.sh — write speech bubble + ASCII character to /dev/tty (or CLAUDE_SAY_TTY).
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
USER_CHAR="${HOME}/.claude/claudesay/character.sh"
[[ -f "$USER_CHAR" ]] && source "$USER_CHAR"

source "${PLUGIN_ROOT}/lib/moods.sh"
source "${PLUGIN_ROOT}/lib/character.sh"

# Wrap message at 45 chars (bash 3.2-compatible: no mapfile, use herestring)
LINES=()
while IFS= read -r l; do
  LINES+=("$l")
done <<< "$(printf '%s' "$MESSAGE" | fold -sw 45)"

# Find the longest display line (byte length — acceptable for ASCII-BMP messages)
MAX=0
for l in "${LINES[@]+"${LINES[@]}"}"; do
  clen=$(printf '%s' "$l" | wc -m | tr -d ' ')
  [[ $clen -gt $MAX ]] && MAX=$clen || true
done

# Bubble tail ┬ lands at the center of the center column (0-indexed TAIL_COL).
# Formula: CHAR_SIDE_WIDTH + CHAR_CENTER_WIDTH/2. Default 5+4=9 → LEFT_DASHES=7.
# Bubble lines have a leading space before ╰, so LEFT_DASHES = TAIL_COL - 2.
_TAIL_COL=$(( ${CHAR_SIDE_WIDTH:-5} + (${CHAR_CENTER_WIDTH:-8} / 2) ))
_LEFT_DASHES=$(( _TAIL_COL - 2 ))
_MIN_INNER=$(( _LEFT_DASHES + 2 ))  # guarantees at least 1 dash right of junction
INNER=$(( MAX + 2 < _MIN_INNER ? _MIN_INNER : MAX + 2 ))
TOP_BORDER=$(printf '─%.0s' $(seq 1 $INNER))
LEFT_TAIL=$(printf '─%.0s' $(seq 1 $_LEFT_DASHES))
RIGHT_REST=$(printf '─%.0s' $(seq 1 $((INNER - _LEFT_DASHES - 1))))

CHAR_OUTPUT=$(assemble_character "$MOOD" "$PROP" "$SIDE")

{
  printf '\n'
  printf ' ╭%s╮\n' "$TOP_BORDER"
  for l in "${LINES[@]+"${LINES[@]}"}"; do
    blen=$(printf '%s' "$l" | wc -c | tr -d ' ')
    clen=$(printf '%s' "$l" | wc -m | tr -d ' ')
    printf ' │ %-*s │\n' "$(( INNER - 2 + blen - clen ))" "$l"
  done
  printf ' ╰%s┬%s╯\n' "$LEFT_TAIL" "$RIGHT_REST"
  printf '%*s│\n' "$_TAIL_COL" ""
  printf '%s\n' "$CHAR_OUTPUT"
} > "$TTY"
