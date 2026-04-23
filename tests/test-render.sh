#!/usr/bin/env bash
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$PLUGIN_ROOT/tests/assert.sh"

export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"
TTY_FILE="$(mktemp)"
export CLAUDE_SAY_TTY="$TTY_FILE"
trap 'rm -f "$TTY_FILE"' EXIT

source "$PLUGIN_ROOT/characters/default.sh"

render() { bash "$PLUGIN_ROOT/lib/render.sh" "$@"; }

# Compute expected bubble tail strings from dimension vars.
_tail_col=$(( ${CHAR_SIDE_WIDTH:-5} + (${CHAR_CENTER_WIDTH:-8} / 2) ))
_left_dashes=$(( _tail_col - 2 ))
_left_str=$(printf '─%.0s' $(seq 1 $_left_dashes))
_expected_tail="╰${_left_str}┬"
_expected_short_bottom="╰${_left_str}┬─╯"

echo "=== render.sh: basic bubble ==="
render "Tests pass!" "happy"
output=$(cat "$TTY_FILE"); > "$TTY_FILE"
assert_contains "bubble top border"    "$output" "╭"
assert_contains "bubble content"       "$output" "Tests pass!"
assert_contains "bubble bottom border" "$output" "╰"
assert_contains "junction character"   "$output" "┬"
assert_contains "bottom-left has $_left_dashes dashes before junction" "$output" "$_expected_tail"
assert_contains "connector tail"       "$output" "│"
assert_contains "char top outline"     "$output" "/\\"
assert_contains "body (no prop)"       "$output" ","

echo ""
echo "=== render.sh: prop on left ==="
render "Reading file" "thinking" "📖" "left"
output=$(cat "$TTY_FILE"); > "$TTY_FILE"
assert_contains "prop appears"          "$output" "📖"
assert_contains "body intact with prop" "$output" ","

echo ""
echo "=== render.sh: prop on right ==="
render "Editing file" "focused" "🔧" "right"
output=$(cat "$TTY_FILE"); > "$TTY_FILE"
assert_contains "prop appears"          "$output" "🔧"
assert_contains "body intact with prop" "$output" ","

echo ""
echo "=== render.sh: long message wraps ==="
render "This is a very long message that should definitely wrap at 45 characters wide" "happy"
output=$(cat "$TTY_FILE"); > "$TTY_FILE"
assert_contains "wraps into bubble" "$output" "╭"
content_lines=$(echo "$output" | grep -c '^ │ ' || true)
assert_contains "multiple content lines" "$content_lines" "2"

echo ""
echo "=== render.sh: short message min-width ==="
export CLAUDE_SAY_TTY="$TTY_FILE"
render "Hi" "happy"
output=$(cat "$TTY_FILE"); > "$TTY_FILE"
assert_contains "short msg junction" "$output" "┬"
assert_contains "short msg bottom"   "$output" "$_expected_short_bottom"

echo ""
echo "=== render.sh: no-tty guard ==="
unset CLAUDE_SAY_TTY
CLAUDE_SAY_TTY="/dev/null/nonexistent" bash "$PLUGIN_ROOT/lib/render.sh" "hello" "happy" 2>/dev/null
assert_eq "exits 0 when no tty" "$?" "0"

print_summary
