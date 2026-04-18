#!/usr/bin/env bash
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$PLUGIN_ROOT/tests/assert.sh"

export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"
TTY_FILE="$(mktemp)"
export CLAUDE_SAY_TTY="$TTY_FILE"
export CLAUDE_PROJECT_DIR="$(mktemp -d)"
mkdir -p "${CLAUDE_PROJECT_DIR}/.claude"
FLAG="${CLAUDE_PROJECT_DIR}/.claude/.claude-say-active"
trap 'rm -f "$TTY_FILE"; rm -rf "$CLAUDE_PROJECT_DIR"' EXIT

# Helper: write a minimal transcript JSONL and return its path
make_transcript() {
  local text="$1"
  local tmp; tmp=$(mktemp)
  printf '{"role":"user","content":"hello"}\n' >> "$tmp"
  jq -n --arg t "$text" '{"role":"assistant","content":[{"type":"text","text":$t}]}' >> "$tmp"
  echo "$tmp"
}

run_stop() {
  local transcript="$1"
  printf '{"transcript_path":"%s"}\n' "$transcript" \
    | bash "$PLUGIN_ROOT/hooks/scripts/stop.sh"
}

echo "=== stop.sh: flag absent → silent approve ==="
rm -f "$FLAG"
out=$(run_stop /dev/null)
assert_eq "returns approve when flag absent" "$out" '{"decision":"approve"}'
assert_eq "no tty output when flag absent" "$(cat "$TTY_FILE")" ""

echo ""
echo "=== stop.sh: flag present, tag found → renders + approves ==="
mkdir -p "$(dirname "$FLAG")"; touch "$FLAG"
TRANSCRIPT=$(make_transcript 'Great job! <claude-say mood="excited">All 3 tests pass!</claude-say>')
out=$(run_stop "$TRANSCRIPT")
assert_eq "returns approve" "$out" '{"decision":"approve"}'
assert_contains "renders bubble to tty" "$(cat "$TTY_FILE")" "All 3 tests pass!"
> "$TTY_FILE"
rm -f "$TRANSCRIPT"

echo ""
echo "=== stop.sh: flag present, no tag → silent approve ==="
TRANSCRIPT=$(make_transcript 'Here is some code without a tag')
out=$(run_stop "$TRANSCRIPT")
assert_eq "returns approve when no tag" "$out" '{"decision":"approve"}'
assert_eq "no tty output when no tag" "$(cat "$TTY_FILE")" ""
rm -f "$TRANSCRIPT"

echo ""
echo "=== stop.sh: multiple tags → uses last one ==="
TRANSCRIPT=$(make_transcript 'First <claude-say mood="happy">first msg</claude-say> then <claude-say mood="excited">second msg</claude-say>')
run_stop "$TRANSCRIPT" > /dev/null
assert_contains "last tag wins" "$(cat "$TTY_FILE")" "second msg"
> "$TTY_FILE"
rm -f "$TRANSCRIPT"

echo ""
echo "=== pre-tool-use.sh: flag absent → silent allow ==="
rm -f "$FLAG"
out=$(printf '{"tool_name":"Edit","tool_input":{"file_path":"foo.py"}}' \
  | bash "$PLUGIN_ROOT/hooks/scripts/pre-tool-use.sh")
assert_contains "returns allow decision" "$out" '"permissionDecision":"allow"'
assert_eq "no tty output when flag absent" "$(cat "$TTY_FILE")" ""

echo ""
echo "=== pre-tool-use.sh: known tool renders figure ==="
mkdir -p "$(dirname "$FLAG")"; touch "$FLAG"
out=$(printf '{"tool_name":"Read","tool_input":{"file_path":"src/main.py"}}' \
  | bash "$PLUGIN_ROOT/hooks/scripts/pre-tool-use.sh")
assert_contains "returns allow" "$out" '"permissionDecision":"allow"'
assert_contains "renders figure to tty" "$(cat "$TTY_FILE")" "( ._.  )"
assert_contains "shows prop on left" "$(cat "$TTY_FILE")" "📖="
> "$TTY_FILE"

echo ""
echo "=== pre-tool-use.sh: path > 50 chars truncated ==="
LONG="src/very/deep/path/to/some/really/quite/long/file.py"
printf '{"tool_name":"Edit","tool_input":{"file_path":"%s"}}' "$LONG" \
  | bash "$PLUGIN_ROOT/hooks/scripts/pre-tool-use.sh" > /dev/null
assert_contains "truncates long path" "$(cat "$TTY_FILE")" "…"
> "$TTY_FILE"

echo ""
echo "=== pre-tool-use.sh: unknown tool uses default ==="
out=$(printf '{"tool_name":"SomeUnknownTool","tool_input":{}}' \
  | bash "$PLUGIN_ROOT/hooks/scripts/pre-tool-use.sh")
assert_contains "returns allow for unknown" "$out" '"permissionDecision":"allow"'
assert_contains "renders figure" "$(cat "$TTY_FILE")" "( -.-  )"
> "$TTY_FILE"

echo ""
echo "=== session-start.sh: flag absent → empty output ==="
rm -f "$FLAG"
out=$(printf '{}' | bash "$PLUGIN_ROOT/hooks/scripts/session-start.sh")
assert_eq "empty when flag absent" "$out" ""

echo ""
echo "=== session-start.sh: flag present → systemMessage JSON ==="
mkdir -p "$(dirname "$FLAG")"; touch "$FLAG"
out=$(printf '{}' | bash "$PLUGIN_ROOT/hooks/scripts/session-start.sh")
assert_contains "outputs systemMessage key"     "$out" '"systemMessage"'
assert_contains "contains protocol open tag"    "$out" 'claude-say-protocol'
assert_contains "contains mood instructions"    "$out" 'happy'
parsed=$(printf '%s' "$out" | jq -r '.systemMessage' 2>/dev/null || true)
assert_contains "valid JSON with systemMessage" "$parsed" "claude-say-protocol"

echo ""
echo "=== prompt-submit.sh: flag absent, non-toggle prompt → empty ==="
rm -f "$FLAG"
out=$(printf '{"prompt":"hello"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_eq "empty when flag absent and no intent" "$out" ""

echo ""
echo "=== prompt-submit.sh: flag present, non-toggle prompt → compact reminder JSON ==="
mkdir -p "$(dirname "$FLAG")"; touch "$FLAG"
out=$(printf '{"prompt":"how are you"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "outputs systemMessage key" "$out" '"systemMessage"'
assert_contains "contains tag hint"         "$out" 'claude-say'
parsed=$(printf '%s' "$out" | jq -r '.systemMessage' 2>/dev/null || true)
assert_contains "valid JSON" "$parsed" "claude-say"

echo ""
echo "=== prompt-submit.sh: 'turn on claude-say' → creates flag + block ==="
rm -f "$FLAG"; > "$TTY_FILE"
out=$(printf '{"prompt":"turn on claude-say"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "returns block decision" "$out" '"decision": "block"'
assert_contains "reason mentions turned on" "$out" "turned on"
[[ -f "$FLAG" ]] && flag_exists="yes" || flag_exists="no"
assert_eq "flag file created" "$flag_exists" "yes"
assert_contains "renders confirmation bubble" "$(cat "$TTY_FILE")" "now on"

echo ""
echo "=== prompt-submit.sh: 'turn on claude-say' when already on → already-on block, no bubble ==="
> "$TTY_FILE"
out=$(printf '{"prompt":"turn on claude-say"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "returns block" "$out" '"decision": "block"'
assert_contains "reason mentions already on" "$out" "already on"
assert_eq "no bubble re-rendered" "$(cat "$TTY_FILE")" ""

echo ""
echo "=== prompt-submit.sh: 'disable claude-say' → removes flag + block ==="
> "$TTY_FILE"
out=$(printf '{"prompt":"disable claude-say"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "returns block" "$out" '"decision": "block"'
assert_contains "reason mentions turned off" "$out" "turned off"
[[ -f "$FLAG" ]] && flag_exists="yes" || flag_exists="no"
assert_eq "flag file removed" "$flag_exists" "no"

echo ""
echo "=== prompt-submit.sh: 'toggle claude-say' flips from off to on ==="
rm -f "$FLAG"; > "$TTY_FILE"
out=$(printf '{"prompt":"toggle claude-say"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "returns block" "$out" '"decision": "block"'
assert_contains "reason mentions toggled on" "$out" "toggled on"
[[ -f "$FLAG" ]] && flag_exists="yes" || flag_exists="no"
assert_eq "flag file exists after toggle" "$flag_exists" "yes"

echo ""
echo "=== prompt-submit.sh: 'claude-say status' reports on ==="
> "$TTY_FILE"
out=$(printf '{"prompt":"claude-say status"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "returns block" "$out" '"decision": "block"'
assert_contains "reason reports on" "$out" "is on"

echo ""
echo "=== prompt-submit.sh: 'is claude-say on?' reports on ==="
out=$(printf '{"prompt":"is claude-say on?"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "status query returns block" "$out" '"decision": "block"'
assert_contains "reports on" "$out" "is on"

echo ""
echo "=== prompt-submit.sh: trailing punctuation tolerated ==="
out=$(printf '{"prompt":"turn off claude-say."}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "trailing period accepted" "$out" "turned off"
[[ -f "$FLAG" ]] && flag_exists="yes" || flag_exists="no"
assert_eq "flag removed" "$flag_exists" "no"

echo ""
echo "=== prompt-submit.sh: loose phrasing falls through to reminder, does not toggle ==="
touch "$FLAG"  # flag on so the reminder branch emits something
out=$(printf '{"prompt":"hey can you flip claude-say on for me"}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "falls through to reminder" "$out" '"systemMessage"'
# Flag state must be unchanged by a fall-through.
[[ -f "$FLAG" ]] && flag_exists="yes" || flag_exists="no"
assert_eq "flag state unchanged" "$flag_exists" "yes"

print_summary
