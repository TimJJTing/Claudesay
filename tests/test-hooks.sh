#!/usr/bin/env bash
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$PLUGIN_ROOT/tests/assert.sh"

export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"
TTY_FILE="$(mktemp)"
export CLAUDE_SAY_TTY="$TTY_FILE"
export CLAUDE_PROJECT_DIR="$(mktemp -d)"
mkdir -p "${CLAUDE_PROJECT_DIR}/.claude"
FLAG="${CLAUDE_PROJECT_DIR}/.claude/.claudesay-active"
trap 'rm -f "$TTY_FILE"; rm -rf "$CLAUDE_PROJECT_DIR"' EXIT

# run_stop passes a response_preview string directly, matching the real Stop
# hook input. Using response_preview avoids the one-turn delay caused by the
# transcript being written AFTER the hook returns.
run_stop() {
  local preview="$1"
  jq -n --arg p "$preview" '{"response_preview":$p}' \
    | bash "$PLUGIN_ROOT/hooks/scripts/stop.sh"
}

echo "=== stop.sh: flag absent → silent approve ==="
rm -f "$FLAG"
out=$(run_stop "hello <claudesay mood=\"happy\">hi</claudesay>")
assert_eq "returns approve when flag absent" "$out" '{"decision":"approve"}'
assert_eq "no tty output when flag absent" "$(cat "$TTY_FILE")" ""

echo ""
echo "=== stop.sh: flag present, tag found → emits systemMessage bubble ==="
mkdir -p "$(dirname "$FLAG")"; touch "$FLAG"
out=$(run_stop 'Great job! <claudesay mood="excited">All 3 tests pass!</claudesay>')
assert_contains "returns approve decision" "$out" '"decision": "approve"'
assert_contains "emits systemMessage key" "$out" '"systemMessage"'
parsed=$(printf '%s' "$out" | jq -r '.systemMessage' 2>/dev/null || true)
assert_contains "bubble content in systemMessage" "$parsed" "All 3 tests pass!"
assert_eq "no direct tty write" "$(cat "$TTY_FILE")" ""
> "$TTY_FILE"

echo ""
echo "=== stop.sh: flag present, no tag → silent approve ==="
out=$(run_stop 'Here is some code without a tag')
assert_eq "returns approve when no tag" "$out" '{"decision":"approve"}'
assert_eq "no tty output when no tag" "$(cat "$TTY_FILE")" ""

echo ""
echo "=== stop.sh: multiple tags → uses last one ==="
out=$(run_stop 'First <claudesay mood="happy">first msg</claudesay> then <claudesay mood="excited">second msg</claudesay>')
parsed=$(printf '%s' "$out" | jq -r '.systemMessage' 2>/dev/null || true)
assert_contains "last tag wins" "$parsed" "second msg"
> "$TTY_FILE"

echo ""
echo "=== stop.sh: empty response_preview → silent approve ==="
out=$(run_stop '')
assert_eq "returns approve on empty preview" "$out" '{"decision":"approve"}'

echo ""
echo "=== pre-tool-use.sh: flag absent → silent allow ==="
rm -f "$FLAG"
out=$(printf '{"tool_name":"Edit","tool_input":{"file_path":"foo.py"}}' \
  | bash "$PLUGIN_ROOT/hooks/scripts/pre-tool-use.sh")
assert_contains "returns allow decision" "$out" '"permissionDecision":"allow"'
assert_eq "no tty output when flag absent" "$(cat "$TTY_FILE")" ""

echo ""
echo "=== pre-tool-use.sh: known tool renders character ==="
mkdir -p "$(dirname "$FLAG")"; touch "$FLAG"
out=$(printf '{"tool_name":"Read","tool_input":{"file_path":"src/main.py"}}' \
  | bash "$PLUGIN_ROOT/hooks/scripts/pre-tool-use.sh")
assert_contains "returns allow" "$out" '"permissionDecision":"allow"'
parsed=$(printf '%s' "$out" | jq -r '.systemMessage // ""' 2>/dev/null || true)
assert_contains "renders character in systemMessage" "$parsed" "-.-"
assert_contains "shows prop on left" "$parsed" "📖"
assert_eq "no direct tty write" "$(cat "$TTY_FILE")" ""

echo ""
echo "=== pre-tool-use.sh: path > 50 chars truncated ==="
LONG="src/very/deep/path/to/some/really/quite/long/file.py"
out=$(printf '{"tool_name":"Edit","tool_input":{"file_path":"%s"}}' "$LONG" \
  | bash "$PLUGIN_ROOT/hooks/scripts/pre-tool-use.sh")
parsed=$(printf '%s' "$out" | jq -r '.systemMessage // ""' 2>/dev/null || true)
assert_contains "truncates long path" "$parsed" "…"

echo ""
echo "=== pre-tool-use.sh: unknown tool uses default ==="
out=$(printf '{"tool_name":"SomeUnknownTool","tool_input":{}}' \
  | bash "$PLUGIN_ROOT/hooks/scripts/pre-tool-use.sh")
assert_contains "returns allow for unknown" "$out" '"permissionDecision":"allow"'
parsed=$(printf '%s' "$out" | jq -r '.systemMessage // ""' 2>/dev/null || true)
assert_contains "renders character" "$parsed" "("

echo ""
echo "=== session-start.sh: flag absent → empty output ==="
rm -f "$FLAG"
out=$(printf '{}' | bash "$PLUGIN_ROOT/hooks/scripts/session-start.sh")
assert_eq "empty when flag absent" "$out" ""

echo ""
echo "=== session-start.sh: flag present → additionalContext JSON ==="
mkdir -p "$(dirname "$FLAG")"; touch "$FLAG"
out=$(printf '{}' | bash "$PLUGIN_ROOT/hooks/scripts/session-start.sh")
assert_contains "outputs additionalContext key" "$out" '"additionalContext"'
assert_contains "hook event is SessionStart"    "$out" '"SessionStart"'
assert_contains "contains protocol open tag"    "$out" 'claudesay-protocol'
assert_contains "contains mood instructions"    "$out" 'happy'
parsed=$(printf '%s' "$out" | jq -r '.hookSpecificOutput.additionalContext' 2>/dev/null || true)
assert_contains "valid JSON with additionalContext" "$parsed" "claudesay-protocol"

echo ""
echo "=== prompt-submit.sh: flag absent, non-toggle prompt → empty ==="
rm -f "$FLAG"
out=$(printf '{"prompt":"hello"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_eq "empty when flag absent and no intent" "$out" ""

echo ""
echo "=== prompt-submit.sh: flag present, non-toggle prompt → compact reminder JSON ==="
mkdir -p "$(dirname "$FLAG")"; touch "$FLAG"
out=$(printf '{"prompt":"how are you"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "outputs additionalContext key" "$out" '"additionalContext"'
assert_contains "hook event is UserPromptSubmit" "$out" '"UserPromptSubmit"'
assert_contains "contains tag hint"              "$out" 'claudesay'
parsed=$(printf '%s' "$out" | jq -r '.hookSpecificOutput.additionalContext' 2>/dev/null || true)
assert_contains "valid JSON" "$parsed" "claudesay"

echo ""
echo "=== prompt-submit.sh: 'turn on claudesay' → creates flag + block ==="
rm -f "$FLAG"; > "$TTY_FILE"
out=$(printf '{"prompt":"turn on claudesay"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "returns block decision" "$out" '"decision": "block"'
assert_contains "reason mentions turned on" "$out" "turned on"
[[ -f "$FLAG" ]] && flag_exists="yes" || flag_exists="no"
assert_eq "flag file created" "$flag_exists" "yes"
parsed=$(printf '%s' "$out" | jq -r '.reason // ""' 2>/dev/null || true)
assert_contains "renders confirmation bubble in reason" "$parsed" "now on"
assert_contains "bubble drawn in reason" "$parsed" "╭"
assert_eq "no direct tty write" "$(cat "$TTY_FILE")" ""

echo ""
echo "=== prompt-submit.sh: 'turn on claudesay' when already on → already-on block, no bubble ==="
> "$TTY_FILE"
out=$(printf '{"prompt":"turn on claudesay"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "returns block" "$out" '"decision": "block"'
assert_contains "reason mentions already on" "$out" "already on"
parsed=$(printf '%s' "$out" | jq -r '.reason // ""' 2>/dev/null || true)
assert_eq "no bubble re-rendered" "$(printf '%s' "$parsed" | grep -c '╭' | tr -d ' ')" "0"

echo ""
echo "=== prompt-submit.sh: 'disable claudesay' → removes flag + block ==="
> "$TTY_FILE"
out=$(printf '{"prompt":"disable claudesay"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "returns block" "$out" '"decision": "block"'
assert_contains "reason mentions turned off" "$out" "turned off"
parsed=$(printf '%s' "$out" | jq -r '.reason // ""' 2>/dev/null || true)
assert_contains "renders goodbye bubble in reason" "$parsed" "bye"
assert_contains "bubble drawn in reason" "$parsed" "╭"
[[ -f "$FLAG" ]] && flag_exists="yes" || flag_exists="no"
assert_eq "flag file removed" "$flag_exists" "no"

echo ""
echo "=== prompt-submit.sh: 'toggle claudesay' flips from off to on ==="
rm -f "$FLAG"; > "$TTY_FILE"
out=$(printf '{"prompt":"toggle claudesay"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "returns block" "$out" '"decision": "block"'
assert_contains "reason mentions toggled on" "$out" "toggled on"
[[ -f "$FLAG" ]] && flag_exists="yes" || flag_exists="no"
assert_eq "flag file exists after toggle" "$flag_exists" "yes"

echo ""
echo "=== prompt-submit.sh: 'claudesay status' reports on ==="
> "$TTY_FILE"
out=$(printf '{"prompt":"claudesay status"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "returns block" "$out" '"decision": "block"'
assert_contains "reason reports on" "$out" "is on"

echo ""
echo "=== prompt-submit.sh: 'is claudesay on?' reports on ==="
out=$(printf '{"prompt":"is claudesay on?"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "status query returns block" "$out" '"decision": "block"'
assert_contains "reports on" "$out" "is on"

echo ""
echo "=== prompt-submit.sh: trailing punctuation tolerated ==="
out=$(printf '{"prompt":"turn off claudesay."}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "trailing period accepted" "$out" "turned off"
[[ -f "$FLAG" ]] && flag_exists="yes" || flag_exists="no"
assert_eq "flag removed" "$flag_exists" "no"

echo ""
echo "=== prompt-submit.sh: loose phrasing falls through to reminder, does not toggle ==="
touch "$FLAG"  # flag on so the reminder branch emits something
out=$(printf '{"prompt":"hey can you flip claudesay on for me"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "falls through to reminder" "$out" '"additionalContext"'
# Flag state must be unchanged by a fall-through.
[[ -f "$FLAG" ]] && flag_exists="yes" || flag_exists="no"
assert_eq "flag state unchanged" "$flag_exists" "yes"

print_summary
