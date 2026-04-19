#!/usr/bin/env bash
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$PLUGIN_ROOT/tests/assert.sh"
source "$PLUGIN_ROOT/characters/default.sh"
source "$PLUGIN_ROOT/lib/moods.sh"
source "$PLUGIN_ROOT/lib/character.sh"

# ── _pad_cell ────────────────────────────────────────────────────────────────
echo "=== _pad_cell ==="

out=$(_pad_cell "abc" 5 3)
line_count=$(printf '%s\n' "$out" | wc -l | tr -d ' ')
assert_eq "pads short content to 3 lines" "$line_count" "3"

first_line=$(printf '%s\n' "$out" | sed -n '1p')
assert_eq "right-pads short line to 5 chars" "${#first_line}" "5"

empty_line=$(printf '%s\n' "$out" | sed -n '3p')
assert_eq "blank padding line is 5 spaces" "$empty_line" "     "

# ── assemble_character: dimensions ───────────────────────────────────────────
echo ""
echo "=== assemble_character: dimensions ==="

out=$(assemble_character "happy")
total_lines=$(printf '%s\n' "$out" | wc -l | tr -d ' ')
expected_lines=$(( CHAR_CELL_HEIGHT * 3 ))
assert_eq "produces correct line count" "$total_lines" "$expected_lines"

expected_width=$(( CHAR_SIDE_WIDTH * 2 + CHAR_CENTER_WIDTH ))
short_lines=0
while IFS= read -r line; do
  clen=$(printf '%s' "$line" | wc -m | tr -d ' ')
  if [[ "$clen" -lt "$expected_width" ]]; then
    short_lines=$((short_lines + 1))
  fi
done <<< "$out"
assert_eq "no lines shorter than expected width" "$short_lines" "0"

# ── assemble_character: mood routing ─────────────────────────────────────────
echo ""
echo "=== assemble_character: mood routing ==="

out=$(assemble_character "thinking")
assert_contains "thinking face appears" "$out" "._."

out=$(assemble_character "focused")
assert_contains "focused face appears" "$out" "-.-"

out=$(assemble_character "error")
assert_contains "error face appears" "$out" "x_x"

# ── assemble_character: prop replacement ─────────────────────────────────────
echo ""
echo "=== assemble_character: prop replacement ==="

body_start=$(( CHAR_CELL_HEIGHT * 1 + 1 ))
body_end=$(( CHAR_CELL_HEIGHT * 2 ))

out=$(assemble_character "happy" "🔧" "left")
assert_contains "prop appears in left position" "$out" "🔧"
right_m=$(printf '%s\n' "$out" | sed -n "${body_start},${body_end}p")
assert_contains "right-hand m intact when prop on left" "$right_m" "m"

out=$(assemble_character "happy" "🪄" "right")
assert_contains "prop appears in right position" "$out" "🪄"
left_m=$(printf '%s\n' "$out" | sed -n "${body_start},${body_end}p")
assert_contains "left-hand m intact when prop on right" "$left_m" "m"

out=$(assemble_character "happy")
left_count=$(printf '%s' "$out" | grep -o m | wc -l | tr -d ' ')
assert_eq "no prop → both hands present" "$left_count" "2"

print_summary
