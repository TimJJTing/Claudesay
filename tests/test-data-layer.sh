#!/usr/bin/env bash
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$PLUGIN_ROOT/tests/assert.sh"
source "$PLUGIN_ROOT/characters/default.sh"
source "$PLUGIN_ROOT/lib/moods.sh"
source "$PLUGIN_ROOT/lib/tools.sh"

echo "=== characters/default.sh ==="
assert_eq "CHAR_BODY set"       "$CHAR_BODY"        "( ,,,, )"
assert_eq "CHAR_HAND_LEFT set"  "$CHAR_HAND_LEFT"   "m"
assert_eq "CHAR_HAND_RIGHT set" "$CHAR_HAND_RIGHT"  "m"

echo ""
echo "=== lib/moods.sh ==="
assert_eq "thinking face"  "$(get_face thinking)"  "( ._.  )"
assert_eq "focused face"   "$(get_face focused)"   "( -.-  )"
assert_eq "upset face"     "$(get_face upset)"     "( >_<  )"
assert_eq "error face"     "$(get_face error)"     "( x_x  )"
assert_contains "happy returns face"   "$(get_face happy)"   "("
assert_contains "excited returns face" "$(get_face excited)" "("
assert_eq "unknown mood → thinking"   "$(get_face blorp)"   "( ._.  )"

echo ""
echo "=== lib/tools.sh ==="
assert_eq "Edit info"    "$(get_tool_info Edit)"       "🔧 focused left"
assert_eq "Bash info"    "$(get_tool_info Bash)"       "🪄 excited right"
assert_eq "Read info"    "$(get_tool_info Read)"       "📖 focused left"
assert_eq "Grep info"    "$(get_tool_info Grep)"       "🔍 focused left"
assert_eq "Agent info"   "$(get_tool_info Agent)"      "🤖 excited right"
assert_eq "TodoWrite"    "$(get_tool_info TodoWrite)"  "📋 focused left"
assert_eq "default info" "$(get_tool_info UnknownTool)" "none happy none"

print_summary
