# claude-say Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the claude-say Claude Code plugin that renders ASCII figure speech bubbles and tool-state figures in the terminal during sessions.

**Architecture:** A data layer (character defaults, mood map, tools map) feeds a core renderer (`render.sh`) that writes exclusively to `/dev/tty`. Four hook scripts drive the lifecycle: `session-start.sh` injects the `<claude-say>` protocol; `prompt-submit.sh` reinforces it per turn; `pre-tool-use.sh` renders a tool-state figure before each tool; `stop.sh` parses the transcript for the tag and renders the chat bubble. All hooks exit line 2 if the flag file `~/.claude/.claude-say-active` is absent. A toggle skill handles on/off/status with intent detection.

**Tech Stack:** bash 3.2+, `jq` (required — hooks check for it), Unicode box-drawing characters, ANSI escape codes. No other dependencies.

---

## File Map

| File | Purpose |
|---|---|
| `.claude-plugin/plugin.json` | Plugin manifest |
| `hooks/hooks.json` | Hook event registration |
| `hooks/scripts/session-start.sh` | Inject `<claude-say>` protocol via systemMessage |
| `hooks/scripts/prompt-submit.sh` | Per-turn compact reminder via systemMessage |
| `hooks/scripts/pre-tool-use.sh` | Render tool-state figure on PreToolUse |
| `hooks/scripts/stop.sh` | Parse transcript, render chat bubble on Stop |
| `lib/moods.sh` | `get_face mood` → face string (with variant rotation) |
| `lib/tools.sh` | `get_tool_info tool_name` → `"prop mood side"` |
| `lib/render.sh` | Build bubble + figure, write to `/dev/tty` |
| `characters/default.sh` | Default `CHAR_*` variables |
| `skills/claude-say/SKILL.md` | Intent-aware on/off/status toggle skill |
| `tests/assert.sh` | Minimal bash assertion library |
| `tests/test-data-layer.sh` | Tests for moods.sh, tools.sh, default.sh |
| `tests/test-render.sh` | Tests for render.sh (via `CLAUDE_SAY_TTY`) |
| `tests/test-hooks.sh` | Tests for stop.sh and pre-tool-use.sh |
| `README.md` | Install and usage documentation |

---

### Task 1: Plugin scaffolding

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `hooks/hooks.json`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p .claude-plugin hooks/scripts lib characters skills/claude-say tests
```

- [ ] **Step 2: Write `.claude-plugin/plugin.json`**

```json
{
  "name": "claude-say",
  "version": "1.0.0",
  "description": "Renders Claude replies as ASCII figure speech bubbles",
  "author": { "name": "jjting" },
  "license": "MIT"
}
```

- [ ] **Step 3: Write `hooks/hooks.json`**

```json
{
  "SessionStart":     [{ "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/session-start.sh" }] }],
  "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/prompt-submit.sh" }] }],
  "PreToolUse":       [{ "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-tool-use.sh" }] }],
  "Stop":             [{ "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/stop.sh" }] }]
}
```

- [ ] **Step 4: Validate both JSON files are well-formed**

```bash
jq . .claude-plugin/plugin.json && echo "plugin.json OK"
jq . hooks/hooks.json && echo "hooks.json OK"
```

Expected: both print the pretty-printed JSON followed by `OK`.

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin/plugin.json hooks/hooks.json
git commit -m "feat: plugin manifest and hook registration"
```

---

### Task 2: Data layer — character defaults, mood map, tools map

**Files:**
- Create: `characters/default.sh`
- Create: `lib/moods.sh`
- Create: `lib/tools.sh`
- Create: `tests/assert.sh`
- Create: `tests/test-data-layer.sh`

- [ ] **Step 1: Write `characters/default.sh`**

```bash
#!/usr/bin/env bash
# Default ASCII figure body parts. Override any variable in
# ~/.claude/claude-say/character.sh — missing vars fall back here.

CHAR_FACE_HAPPY_A="( ^ᵕ^  )"
CHAR_FACE_HAPPY_B="( ᵕ‿ᵕ  )"
CHAR_FACE_EXCITED_A="( ^▽^  )"
CHAR_FACE_EXCITED_B="( ≧▽≦  )"
CHAR_FACE_THINKING="( ._.  )"
CHAR_FACE_FOCUSED="( -.-  )"
CHAR_FACE_UPSET="( >_<  )"
CHAR_FACE_ERROR="( x_x  )"

CHAR_TOP="    /\\__/\\"      # head row (4 spaces + head)
CHAR_BODY="( ,,,, )"         # torso (no leading spaces — render.sh adds 2)
CHAR_HAND_LEFT="m"           # 1-cell left hand
CHAR_HAND_RIGHT="m"          # 1-cell right hand
CHAR_BOTTOM="    ||   ||\`~~>
   (_)  (_)"                 # legs + feet (literal newline, pre-indented)
```

- [ ] **Step 2: Write `lib/moods.sh`**

```bash
#!/usr/bin/env bash
# get_face <mood> → prints the face string for that mood.
# Positive moods rotate between two variants using seconds-mod-2.

get_face() {
  local mood="$1"
  local variant=$(( $(date +%s) % 2 ))

  case "$mood" in
    happy)
      [[ $variant -eq 0 ]] \
        && echo "${CHAR_FACE_HAPPY_A:-( ^ᵕ^  )}" \
        || echo "${CHAR_FACE_HAPPY_B:-( ᵕ‿ᵕ  )}"
      ;;
    excited)
      [[ $variant -eq 0 ]] \
        && echo "${CHAR_FACE_EXCITED_A:-( ^▽^  )}" \
        || echo "${CHAR_FACE_EXCITED_B:-( ≧▽≦  )}"
      ;;
    thinking) echo "${CHAR_FACE_THINKING:-( ._.  )}" ;;
    focused)  echo "${CHAR_FACE_FOCUSED:-( -.-  )}"  ;;
    upset)    echo "${CHAR_FACE_UPSET:-( >_<  )}"    ;;
    error)    echo "${CHAR_FACE_ERROR:-( x_x  )}"    ;;
    *)        echo "${CHAR_FACE_THINKING:-( ._.  )}" ;;
  esac
}
```

- [ ] **Step 3: Write `lib/tools.sh`**

```bash
#!/usr/bin/env bash
# get_tool_info <tool_name> → prints "prop mood side" (space-separated).
# prop is empty string for the default case.

get_tool_info() {
  local tool="$1"
  case "$tool" in
    Edit|Write)             echo "🔧 focused left"   ;;
    Bash)                   echo "🪄 focused right"  ;;
    Grep|Glob)              echo "🔍 thinking left"  ;;
    Read)                   echo "📖 thinking left"  ;;
    WebFetch|WebSearch)     echo "📡 thinking right" ;;
    Agent)                  echo "🤖 excited right"  ;;
    TodoWrite)              echo "📋 focused left"   ;;
    *)                      echo " focused "         ;;
  esac
}
```

- [ ] **Step 4: Write `tests/assert.sh`**

```bash
#!/usr/bin/env bash
# Minimal assertion library. Source this file; call print_summary at end.

PASS=0
FAIL=0

assert_eq() {
  local desc="$1" actual="$2" expected="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "  ✓ $desc"
    ((PASS++)) || true
  else
    echo "  ✗ $desc"
    echo "    expected: $(printf '%q' "$expected")"
    echo "    got:      $(printf '%q' "$actual")"
    ((FAIL++)) || true
  fi
}

assert_contains() {
  local desc="$1" actual="$2" substr="$3"
  if [[ "$actual" == *"$substr"* ]]; then
    echo "  ✓ $desc"
    ((PASS++)) || true
  else
    echo "  ✗ $desc"
    echo "    expected to contain: $(printf '%q' "$substr")"
    echo "    got: $(printf '%q' "$actual")"
    ((FAIL++)) || true
  fi
}

print_summary() {
  echo ""
  echo "Results: $PASS passed, $FAIL failed"
  [[ $FAIL -eq 0 ]]
}
```

- [ ] **Step 5: Write `tests/test-data-layer.sh`**

```bash
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
# happy and excited rotate — just check they return non-empty
assert_contains "happy returns face"   "$(get_face happy)"   "("
assert_contains "excited returns face" "$(get_face excited)" "("
assert_eq "unknown mood → thinking"   "$(get_face blorp)"   "( ._.  )"

echo ""
echo "=== lib/tools.sh ==="
assert_eq "Edit info"    "$(get_tool_info Edit)"       "🔧 focused left"
assert_eq "Bash info"    "$(get_tool_info Bash)"       "🪄 focused right"
assert_eq "Read info"    "$(get_tool_info Read)"       "📖 thinking left"
assert_eq "Grep info"    "$(get_tool_info Grep)"       "🔍 thinking left"
assert_eq "Agent info"   "$(get_tool_info Agent)"      "🤖 excited right"
assert_eq "TodoWrite"    "$(get_tool_info TodoWrite)"  "📋 focused left"
assert_eq "default info" "$(get_tool_info UnknownTool)" " focused "

print_summary
```

- [ ] **Step 6: Run tests**

```bash
bash tests/test-data-layer.sh
```

Expected output: all lines show `✓`, `Results: N passed, 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add characters/default.sh lib/moods.sh lib/tools.sh tests/assert.sh tests/test-data-layer.sh
git commit -m "feat: data layer — character defaults, mood map, tools map"
```

---

### Task 3: Core renderer (`lib/render.sh`)

**Files:**
- Create: `lib/render.sh`
- Create: `tests/test-render.sh`

- [ ] **Step 1: Write the failing test**

```bash
# tests/test-render.sh
#!/usr/bin/env bash
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$PLUGIN_ROOT/tests/assert.sh"

export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"
TTY_FILE="$(mktemp)"
export CLAUDE_SAY_TTY="$TTY_FILE"
trap 'rm -f "$TTY_FILE"' EXIT

render() { bash "$PLUGIN_ROOT/lib/render.sh" "$@"; }

echo "=== render.sh: basic bubble ==="
render "Tests pass!" "happy"
output=$(cat "$TTY_FILE"); > "$TTY_FILE"
assert_contains "bubble top border"    "$output" "╭"
assert_contains "bubble content"       "$output" "Tests pass!"
assert_contains "bubble bottom border" "$output" "╰"
assert_contains "connector tail"       "$output" "│"
assert_contains "char top"             "$output" "/\__/\\"
assert_contains "body (no prop)"       "$output" "m( ,,,, )m"

echo ""
echo "=== render.sh: prop on left ==="
render "Reading file" "thinking" "📖" "left"
output=$(cat "$TTY_FILE"); > "$TTY_FILE"
assert_contains "prop on left" "$output" "📖=( ,,,, )m"

echo ""
echo "=== render.sh: prop on right ==="
render "Editing file" "focused" "🔧" "right"
output=$(cat "$TTY_FILE"); > "$TTY_FILE"
assert_contains "prop on right" "$output" "m( ,,,, )=🔧"

echo ""
echo "=== render.sh: long message wraps ==="
render "This is a very long message that should definitely wrap at 45 characters wide" "happy"
output=$(cat "$TTY_FILE"); > "$TTY_FILE"
assert_contains "wraps into bubble" "$output" "╭"
line_count=$(echo "$output" | grep -c "│" || true)
assert_contains "multiple content lines" "$line_count" "2"

echo ""
echo "=== render.sh: no-tty guard ==="
unset CLAUDE_SAY_TTY
# Point to a non-writable path so render exits silently
CLAUDE_SAY_TTY="/dev/null/nonexistent" bash "$PLUGIN_ROOT/lib/render.sh" "hello" "happy" 2>/dev/null
assert_eq "exits 0 when no tty" "$?" "0"

print_summary
```

- [ ] **Step 2: Run the failing test**

```bash
bash tests/test-render.sh 2>&1 | head -5
```

Expected: `bash: .../lib/render.sh: No such file or directory` or similar failure.

- [ ] **Step 3: Write `lib/render.sh`**

```bash
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
if [[ "$TTY" == "/dev/tty" ]] && ! [[ -w /dev/tty ]]; then
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

# Wrap message at 45 chars
mapfile -t LINES < <(printf '%s' "$MESSAGE" | fold -sw 45)

# Find the longest display line (byte length — acceptable for ASCII-BMP messages)
MAX=0
for l in "${LINES[@]}"; do
  (( ${#l} > MAX )) && MAX=${#l}
done

# Build bubble border strings
INNER=$(( MAX + 2 ))  # 1-space pad each side
TOP_BORDER=$(printf '─%.0s' $(seq 1 $((INNER + 2))))
LEFT4=$(printf '─%.0s' $(seq 1 4))
RIGHT_REST=$(printf '─%.0s' $(seq 1 $((INNER - 2))))

CYAN=$'\033[0;36m'
RESET=$'\033[0m'

{
  printf '\n%s' "$CYAN"
  printf ' ╭%s╮\n' "$TOP_BORDER"
  for l in "${LINES[@]}"; do
    printf ' │ %-*s │\n' "$MAX" "$l"
  done
  printf ' ╰%s╮%s╯\n' "$LEFT4" "$RIGHT_REST"
  printf '      │\n'
  printf '%s\n'   "${CHAR_TOP}"
  printf '   %s\n' "$FACE"
  printf '  %s\n'  "$BODY_LINE"
  printf '%s\n'   "${CHAR_BOTTOM}"
  printf '%s\n' "$RESET"
} > "$TTY"
```

- [ ] **Step 4: Run the tests**

```bash
bash tests/test-render.sh
```

Expected: all `✓`, `Results: N passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add lib/render.sh tests/test-render.sh
git commit -m "feat: core renderer writes bubble + figure to /dev/tty"
```

---

### Task 4: Stop hook (`hooks/scripts/stop.sh`)

**Files:**
- Create: `hooks/scripts/stop.sh`
- Create: `tests/test-hooks.sh`

- [ ] **Step 1: Write the failing test (stop hook portion)**

```bash
# tests/test-hooks.sh
#!/usr/bin/env bash
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$PLUGIN_ROOT/tests/assert.sh"

export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"
TTY_FILE="$(mktemp)"
export CLAUDE_SAY_TTY="$TTY_FILE"
FLAG="$HOME/.claude/.claude-say-active"
trap 'rm -f "$TTY_FILE"; rm -f "$FLAG"' EXIT

# Helper: write a minimal transcript JSONL and return its path
make_transcript() {
  local text="$1"
  local tmp; tmp=$(mktemp)
  printf '{"role":"user","content":"hello"}\n' >> "$tmp"
  printf '{"role":"assistant","content":[{"type":"text","text":"%s"}]}\n' "$text" >> "$tmp"
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
TRANSCRIPT=$(make_transcript 'Here is some code: \`\`\`python\nprint("hello")\n\`\`\`')
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

print_summary
```

- [ ] **Step 2: Run the failing test**

```bash
bash tests/test-hooks.sh 2>&1 | head -5
```

Expected: failure because `stop.sh` doesn't exist yet.

- [ ] **Step 3: Write `hooks/scripts/stop.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

FLAG="$HOME/.claude/.claude-say-active"
[[ -f "$FLAG" ]] || { printf '{"decision":"approve"}\n'; exit 0; }

if ! command -v jq &>/dev/null; then
  printf '{"decision":"approve"}\n'
  exit 0
fi

INPUT=$(cat)
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null || true)

if [[ -z "$TRANSCRIPT" || ! -f "$TRANSCRIPT" ]]; then
  printf '{"decision":"approve"}\n'
  exit 0
fi

# Extract the last assistant text block from the JSONL transcript.
LAST_MSG=$(jq -rs '
  map(select(.role == "assistant"))
  | if length == 0 then ""
    else last
      | .content
      | if type == "array" then
          map(select(.type == "text") | .text) | join("")
        elif type == "string" then .
        else ""
        end
    end
' "$TRANSCRIPT" 2>/dev/null || true)

if [[ -z "$LAST_MSG" ]]; then
  printf '{"decision":"approve"}\n'
  exit 0
fi

# Extract the last <claude-say> tag (POSIX grep -o to avoid -P dependency).
TAG=$(printf '%s' "$LAST_MSG" \
  | grep -o '<claude-say mood="[^"]*">[^<]*</claude-say>' \
  | tail -1 || true)

if [[ -n "$TAG" ]]; then
  MOOD=$(printf '%s' "$TAG" | sed 's/.*mood="\([^"]*\)".*/\1/')
  MSG=$(printf '%s' "$TAG"  | sed 's/.*>\(.*\)<\/claude-say>/\1/')

  RENDER="${CLAUDE_PLUGIN_ROOT}/lib/render.sh"
  if [[ -x "$RENDER" ]]; then
    bash "$RENDER" "$MSG" "$MOOD" 2>/dev/null || true
  fi
fi

printf '{"decision":"approve"}\n'
```

- [ ] **Step 4: Make executable and run tests**

```bash
chmod +x hooks/scripts/stop.sh
bash tests/test-hooks.sh
```

Expected: all `✓`, `Results: N passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add hooks/scripts/stop.sh tests/test-hooks.sh
git commit -m "feat: stop hook parses transcript and renders chat bubble"
```

---

### Task 5: PreToolUse hook (`hooks/scripts/pre-tool-use.sh`)

**Files:**
- Modify: `tests/test-hooks.sh` (add pre-tool-use tests)
- Create: `hooks/scripts/pre-tool-use.sh`

- [ ] **Step 1: Add failing tests to `tests/test-hooks.sh`**

Append to the end of `tests/test-hooks.sh` (before `print_summary`):

```bash
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
out=$(printf '{"tool_name":"Edit","tool_input":{"file_path":"%s"}}' "$LONG" \
  | bash "$PLUGIN_ROOT/hooks/scripts/pre-tool-use.sh")
assert_contains "truncates long path" "$(cat "$TTY_FILE")" "…"
> "$TTY_FILE"

echo ""
echo "=== pre-tool-use.sh: unknown tool uses default ==="
out=$(printf '{"tool_name":"SomeUnknownTool","tool_input":{}}' \
  | bash "$PLUGIN_ROOT/hooks/scripts/pre-tool-use.sh")
assert_contains "returns allow for unknown" "$out" '"permissionDecision":"allow"'
# default has no prop, so figure renders without prop
assert_contains "renders figure" "$(cat "$TTY_FILE")" "( -.-  )"
> "$TTY_FILE"
```

- [ ] **Step 2: Run to confirm the new tests fail**

```bash
bash tests/test-hooks.sh 2>&1 | grep "✗\|No such"
```

Expected: failures on the `pre-tool-use.sh` sections.

- [ ] **Step 3: Write `hooks/scripts/pre-tool-use.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

ALLOW='{"hookSpecificOutput":{"permissionDecision":"allow"}}'
FLAG="$HOME/.claude/.claude-say-active"
[[ -f "$FLAG" ]] || { printf '%s\n' "$ALLOW"; exit 0; }

if ! command -v jq &>/dev/null; then
  printf '%s\n' "$ALLOW"
  exit 0
fi

INPUT=$(cat)
TOOL_NAME=$(printf '%s' "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || true)
FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)

[[ -n "$TOOL_NAME" ]] || { printf '%s\n' "$ALLOW"; exit 0; }

source "${CLAUDE_PLUGIN_ROOT}/lib/tools.sh"
read -r PROP MOOD SIDE <<< "$(get_tool_info "$TOOL_NAME")"

# Truncate file path label if > 50 chars
if [[ -n "$FILE_PATH" ]]; then
  if (( ${#FILE_PATH} > 50 )); then
    LABEL="${TOOL_NAME} → ${FILE_PATH:0:47}…"
  else
    LABEL="${TOOL_NAME} → ${FILE_PATH}"
  fi
else
  LABEL="$TOOL_NAME"
fi

RENDER="${CLAUDE_PLUGIN_ROOT}/lib/render.sh"
if [[ -x "$RENDER" ]]; then
  bash "$RENDER" "$LABEL" "$MOOD" "$PROP" "$SIDE" 2>/dev/null || true
fi

printf '%s\n' "$ALLOW"
```

- [ ] **Step 4: Make executable and run all hook tests**

```bash
chmod +x hooks/scripts/pre-tool-use.sh
bash tests/test-hooks.sh
```

Expected: all `✓`, `Results: N passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add hooks/scripts/pre-tool-use.sh tests/test-hooks.sh
git commit -m "feat: pre-tool-use hook renders tool-state figure"
```

---

### Task 6: Injection hooks (`session-start.sh` and `prompt-submit.sh`)

**Files:**
- Create: `hooks/scripts/session-start.sh`
- Create: `hooks/scripts/prompt-submit.sh`
- Modify: `tests/test-hooks.sh` (add injection tests)

- [ ] **Step 1: Add failing tests to `tests/test-hooks.sh`**

Append before `print_summary`:

```bash
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
# must be valid JSON
parsed=$(printf '%s' "$out" | jq -r '.systemMessage' 2>/dev/null || true)
assert_contains "valid JSON with systemMessage" "$parsed" "claude-say-protocol"

echo ""
echo "=== prompt-submit.sh: flag absent → empty output ==="
rm -f "$FLAG"
out=$(printf '{}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_eq "empty when flag absent" "$out" ""

echo ""
echo "=== prompt-submit.sh: flag present → compact reminder JSON ==="
mkdir -p "$(dirname "$FLAG")"; touch "$FLAG"
out=$(printf '{}' | bash "$PLUGIN_ROOT/hooks/scripts/prompt-submit.sh")
assert_contains "outputs systemMessage key" "$out" '"systemMessage"'
assert_contains "contains tag hint"         "$out" 'claude-say'
parsed=$(printf '%s' "$out" | jq -r '.systemMessage' 2>/dev/null || true)
assert_contains "valid JSON" "$parsed" "claude-say"
```

- [ ] **Step 2: Run to confirm new tests fail**

```bash
bash tests/test-hooks.sh 2>&1 | grep "✗\|No such"
```

- [ ] **Step 3: Write `hooks/scripts/session-start.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

FLAG="$HOME/.claude/.claude-say-active"
[[ -f "$FLAG" ]] || exit 0

# Emit the <claude-say> protocol as a systemMessage so Claude understands
# what to append to conversational replies.
PROTOCOL='<claude-say-protocol>
When giving a conversational reply, append this tag at the very end:
<claude-say mood="MOOD">Brief 1-line summary of what you did or said</claude-say>

Available moods: happy, excited, thinking, focused, upset, error
- happy / excited → success outcomes (rotate between them for variety)
- thinking        → in-progress or uncertain
- focused         → working, running something
- upset           → warning or partial failure
- error           → actual failure

Rules:
- Keep message under 60 chars
- Do NOT add the tag to: pure code blocks, diffs, long technical output, tool-only responses
- Only chatty, conversational replies get a bubble
</claude-say-protocol>'

printf '{"systemMessage":%s}\n' "$(printf '%s' "$PROTOCOL" | jq -Rs .)"
```

- [ ] **Step 4: Write `hooks/scripts/prompt-submit.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

FLAG="$HOME/.claude/.claude-say-active"
[[ -f "$FLAG" ]] || exit 0

HINT='[claude-say: end chatty reply with <claude-say mood="X">summary</claude-say>]'
printf '{"systemMessage":%s}\n' "$(printf '%s' "$HINT" | jq -Rs .)"
```

- [ ] **Step 5: Make executable and run all tests**

```bash
chmod +x hooks/scripts/session-start.sh hooks/scripts/prompt-submit.sh
bash tests/test-hooks.sh
bash tests/test-data-layer.sh
bash tests/test-render.sh
```

Expected: all test files show `Results: N passed, 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add hooks/scripts/session-start.sh hooks/scripts/prompt-submit.sh tests/test-hooks.sh
git commit -m "feat: injection hooks emit protocol and per-turn reminder as systemMessage"
```

---

### Task 7: Toggle skill (`skills/claude-say/SKILL.md`)

**Files:**
- Create: `skills/claude-say/SKILL.md`

- [ ] **Step 1: Write `skills/claude-say/SKILL.md`**

```markdown
---
name: claude-say-toggle
version: 1.0.0
description: >
  Use this skill when the user wants to enable, disable, check, or toggle the
  claude-say ASCII figure feature. Trigger phrases include: "turn on claude-say",
  "turn off claude-say", "enable the figure", "disable the figure", "toggle
  claude-say", "is claude-say active?", "claude-say status", "show the figure",
  "hide the figure", "stop showing the ascii character", "enable ascii companion".
  Do not trigger for unrelated uses of "figure" (e.g. matplotlib charts) or
  generic "turn off" requests that do not mention claude-say or the figure.
---

# claude-say Toggle

The claude-say plugin renders conversational replies as ASCII figure speech
bubbles. This skill manages the on/off state by controlling the flag file
`~/.claude/.claude-say-active`.

**State model:**
- Flag file **exists** → on (hooks render bubbles and tool figures)
- Flag file **absent** → off (all hooks exit at line 2, zero overhead)

## Prerequisites Check

Before acting, verify `jq` is installed:

```bash
command -v jq &>/dev/null || {
  echo "claude-say requires jq. Install it first:"
  echo "  macOS:  brew install jq"
  echo "  Linux:  sudo apt install jq   # or dnf / apk"
  exit 1
}
```

If `CLAUDE_PLUGIN_ROOT` is unset, report it clearly:

```bash
[[ -n "${CLAUDE_PLUGIN_ROOT:-}" ]] || {
  echo "CLAUDE_PLUGIN_ROOT is not set. Is the claude-say plugin installed correctly?"
  exit 1
}
```

## Intent Detection

Identify which intent the user expressed before acting:

- **on** — "turn on", "enable", "start", "show the figure", "activate"
- **off** — "turn off", "disable", "stop showing", "hide the figure", "deactivate"
- **status** — "is it on?", "is claude-say active?", "status", "check"
- **toggle** — "toggle", bare invocation with no qualifier

## Step-by-Step Procedure

### Step 1 — Read current state

```bash
FLAG="$HOME/.claude/.claude-say-active"
[[ -f "$FLAG" ]] && CURRENT="on" || CURRENT="off"
```

### Step 2 — Act on intent

**Intent: status**

```bash
echo "claude-say is currently **$CURRENT**."
if [[ "$CURRENT" == "on" ]]; then
  bash "${CLAUDE_PLUGIN_ROOT}/lib/render.sh" "claude-say is active" "happy" 2>/dev/null || true
fi
```

---

**Intent: on**

```bash
if [[ "$CURRENT" == "on" ]]; then
  echo "claude-say is already on."
else
  mkdir -p "$HOME/.claude"
  touch "$FLAG"
  RENDER="${CLAUDE_PLUGIN_ROOT}/lib/render.sh"
  [[ -x "$RENDER" ]] && bash "$RENDER" "claude-say is now on!" "excited" 2>/dev/null || true
  echo "claude-say is now **on**. The ASCII figure will appear with each reply."
fi
```

---

**Intent: off**

```bash
if [[ "$CURRENT" == "off" ]]; then
  echo "claude-say is already off."
else
  rm -f "$FLAG"
  echo "claude-say is now **off**. No more figures until you turn it back on."
fi
```

---

**Intent: toggle**

```bash
if [[ "$CURRENT" == "on" ]]; then
  rm -f "$FLAG"
  echo "claude-say toggled **off**."
else
  mkdir -p "$HOME/.claude"
  touch "$FLAG"
  RENDER="${CLAUDE_PLUGIN_ROOT}/lib/render.sh"
  [[ -x "$RENDER" ]] && bash "$RENDER" "claude-say toggled on!" "excited" 2>/dev/null || true
  echo "claude-say toggled **on**."
fi
```

## Error Cases

| Condition | Behaviour |
|---|---|
| `jq` not installed | Print install instructions and stop |
| `CLAUDE_PLUGIN_ROOT` unset | Print clear error and stop |
| `~/.claude/` does not exist | `mkdir -p` before touching flag — never fail on this |
| `render.sh` not found or exits non-zero | Skip preview silently; state change still succeeds |
| Flag file is a directory | Report anomaly, ask user to remove it manually |

## Confirmation Reply Style

Keep replies short and conversational — one or two sentences. The rendered figure
is the primary confirmation; the text is supplementary.

✓ Good: "claude-say is now **on**. The figure will appear with each reply."  
✗ Bad: "I have successfully enabled the claude-say plugin by creating the flag file..."
```

- [ ] **Step 2: Verify the file is valid markdown with correct frontmatter**

```bash
head -10 skills/claude-say/SKILL.md
```

Expected: shows `---`, `name:`, `description:` fields.

- [ ] **Step 3: Commit**

```bash
git add skills/claude-say/SKILL.md
git commit -m "feat: intent-aware toggle skill with on/off/status/toggle paths"
```

---

### Task 8: README and smoke test

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# claude-say

A Claude Code plugin that renders conversational replies as ASCII figure speech
bubbles in the terminal. Tool-use events show the figure holding a relevant
prop with a context-appropriate face expression.

## Requirements

- macOS or Linux (interactive terminal required — no CI/Docker support)
- `jq` installed (`brew install jq` / `apt install jq`)

## Install

```bash
# From the Claude Code plugin marketplace, or locally:
claude plugin install claude-say
```

## Usage

Toggle on or off naturally:

```
"turn on claude-say"
"disable the figure"
"is claude-say active?"
```

Or invoke the skill directly: `/claude-say`

## Character Customization

Create `~/.claude/claude-say/character.sh` and export any subset of these
variables — missing ones fall back to defaults:

```bash
CHAR_FACE_HAPPY_A="( ^ᵕ^  )"
CHAR_FACE_HAPPY_B="( ᵕ‿ᵕ  )"
CHAR_FACE_EXCITED_A="( ^▽^  )"
CHAR_FACE_EXCITED_B="( ≧▽≦  )"
CHAR_FACE_THINKING="( ._.  )"
CHAR_FACE_FOCUSED="( -.-  )"
CHAR_FACE_UPSET="( >_<  )"
CHAR_FACE_ERROR="( x_x  )"
CHAR_TOP="    /\\__/\\"
CHAR_BODY="( ,,,, )"
CHAR_HAND_LEFT="m"
CHAR_HAND_RIGHT="m"
CHAR_BOTTOM="    ||   ||
   (_)  (_)"
```

## Known Limitations

- The raw `<claude-say>` tag appears in the terminal scrollback before the
  bubble renders (Claude streams it before the Stop hook fires). This is
  accepted for v1.
- Figures do not render in CI, `--print` mode, or non-interactive SSH sessions.
- Per-turn reminder adds ~20 tokens per turn; conditional injection is a v2 goal.

## Compatibility

Stacks naturally with the caveman plugin. Caveman compresses the main response;
claude-say bubbles the separately-written tag. No conflict. `caveman-lite`
recommended as a complementary install.
```

- [ ] **Step 2: Run all tests one final time**

```bash
bash tests/test-data-layer.sh && \
bash tests/test-render.sh && \
bash tests/test-hooks.sh
```

Expected: all three test files report `Results: N passed, 0 failed`.

- [ ] **Step 3: Run a manual smoke test of render.sh**

```bash
export CLAUDE_PLUGIN_ROOT="$(pwd)"
bash lib/render.sh "Smoke test complete!" "excited"
bash lib/render.sh "Reading a file..." "thinking" "📖" "left"
bash lib/render.sh "Running bash..." "focused" "🪄" "right"
```

Expected: three figures print to the terminal with correct faces and props.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "feat: README with install, usage, customization, and known limitations"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| plugin.json in `.claude-plugin/` | Task 1 |
| hooks.json flat format with all 4 events | Task 1 |
| characters/default.sh with all CHAR_* vars | Task 2 |
| moods.sh with variant rotation | Task 2 |
| tools.sh with prop/mood/side per tool | Task 2 |
| render.sh writes to /dev/tty, /dev/tty guard | Task 3 |
| render.sh body line assembly (left/right/none) | Task 3 |
| render.sh wraps at 45 chars | Task 3 |
| stop.sh: flag check, jq parse, tag extraction, render | Task 4 |
| stop.sh: multiple tags → last wins | Task 4 (test) |
| pre-tool-use.sh: render figure, allow decision | Task 5 |
| pre-tool-use.sh: path > 50 chars truncated | Task 5 (test) |
| session-start.sh: systemMessage with full protocol | Task 6 |
| prompt-submit.sh: compact systemMessage reminder | Task 6 |
| SKILL.md: jq preflight, intent-aware on/off/status | Task 7 |
| SKILL.md: mkdir -p guard, CLAUDE_PLUGIN_ROOT guard | Task 7 |
| README with limitations and customization | Task 8 |
| User character override (sourced in render.sh) | Task 3 |
| Flag absent → all hooks exit line 2 | Tasks 4–6 |
