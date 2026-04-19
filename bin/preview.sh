#!/usr/bin/env bash
# preview.sh — render the customized character to stdout for design iteration.
#
# Usage:
#   preview.sh                       all moods × {no prop, prop-left, prop-right}
#   preview.sh --all                 same as above
#   preview.sh <mood>                single mood, no prop
#   preview.sh <mood> <prop>         single mood holding prop on right
#   preview.sh <mood> <prop> <side>  single mood with prop on left|right
#
# Add --debug (anywhere) to color each grid cell's background, useful for
# spotting padding bugs and cell boundaries while editing character.sh.
#
# Sources defaults from the plugin, then user override at
# ~/.claude/claudesay/character.sh, so it reflects exactly what hooks render.

set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

source "${PLUGIN_ROOT}/characters/default.sh"
USER_CHAR="${HOME}/.claude/claudesay/character.sh"
[[ -f "$USER_CHAR" ]] && source "$USER_CHAR"
source "${PLUGIN_ROOT}/lib/moods.sh"
source "${PLUGIN_ROOT}/lib/character.sh"

ALL_MOODS=(happy excited thinking focused upset error)

# Strip --debug from positional args; export the env var character.sh checks.
ARGS=()
for a in "$@"; do
  if [[ "$a" == "--debug" ]]; then
    export CLAUDESAY_DEBUG_COLORS=1
  else
    ARGS+=("$a")
  fi
done
set -- "${ARGS[@]+"${ARGS[@]}"}"

show() {
  local label="$1" mood="$2" prop="${3:-}" side="${4:-}"
  printf '── %s ──\n' "$label"
  assemble_character "$mood" "$prop" "$side"
  printf '\n'
}

print_legend() {
  [[ -n "${CLAUDESAY_DEBUG_COLORS:-}" ]] || return 0
  printf 'Cell legend: '
  printf '\e[41m TL \e[0m \e[42m TOP \e[0m \e[43m TR \e[0m \e[45m FACE \e[0m '
  printf '\e[44m L \e[0m \e[46m BODY \e[0m \e[101m R \e[0m '
  printf '\e[102m BL \e[0m \e[103m BOT \e[0m \e[105m BR \e[0m\n\n'
}

print_legend

case "${1:-}" in
  ""|--all)
    for m in "${ALL_MOODS[@]}"; do
      show "$m"               "$m"
      show "$m + 🔧 (left)"   "$m" "🔧" "left"
      show "$m + 🪄 (right)"  "$m" "🪄" "right"
    done
    ;;
  -h|--help)
    sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    mood="$1"
    prop="${2:-}"
    side="${3:-right}"
    if [[ -n "$prop" ]]; then
      show "$mood + $prop ($side)" "$mood" "$prop" "$side"
    else
      show "$mood" "$mood"
    fi
    ;;
esac
