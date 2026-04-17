---
name: claude-say-toggle
version: 1.0.0
description: >
  This skill should be used when the user asks to "turn on claude-say", "turn
  off claude-say", "enable the figure", "disable the figure", "toggle
  claude-say", "is claude-say active?", "claude-say status", "show the figure",
  "hide the figure", "stop showing the ascii character", "enable ascii
  companion". Do not trigger for unrelated uses of "figure" (e.g. matplotlib
  charts) or generic "turn off" requests that do not mention claude-say or the
  figure.
---

# claude-say Toggle

The claude-say plugin renders conversational replies as ASCII figure speech
bubbles. This skill manages the on/off state by controlling the flag file
`${CLAUDE_PROJECT_DIR}/.claude/.claude-say-active` — scoped to the current project.

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
FLAG="${CLAUDE_PROJECT_DIR}/.claude/.claude-say-active"
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
  touch "$FLAG"
  RENDER="${CLAUDE_PLUGIN_ROOT}/lib/render.sh"
  [[ -f "$RENDER" ]] && bash "$RENDER" "claude-say is now on!" "excited" 2>/dev/null || true
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
  touch "$FLAG"
  RENDER="${CLAUDE_PLUGIN_ROOT}/lib/render.sh"
  [[ -f "$RENDER" ]] && bash "$RENDER" "claude-say toggled on!" "excited" 2>/dev/null || true
  echo "claude-say toggled **on**."
fi
```

## Error Cases

| Condition | Behaviour |
|---|---|
| `jq` not installed | Print install instructions and stop |
| `CLAUDE_PLUGIN_ROOT` unset | Print clear error and stop |
| `.claude/` dir missing in project | Claude Code always creates it; this should not occur |
| `render.sh` not found or exits non-zero | Skip preview silently; state change still succeeds |
| Flag file is a directory | Report anomaly, ask user to remove it manually |

## Confirmation Reply Style

Keep replies short and conversational — one or two sentences. The rendered figure
is the primary confirmation; the text is supplementary.

✓ Good: "claude-say is now **on**. The figure will appear with each reply."
✗ Bad: "I have successfully enabled the claude-say plugin by creating the flag file..."
