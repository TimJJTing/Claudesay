# claude-say Design Spec
_2026-04-17_

## Overview

`claude-say` is a Claude Code plugin that renders Claude's conversational replies as ASCII cat speech bubbles in the terminal. Tool-use events show the cat holding a relevant prop (wrench, magnifier, etc.) with a context-appropriate face expression. The cat is expressive, dynamic, and customizable.

## Goals

- Make Claude Code interactions feel more alive and playful without interfering with technical output
- Show tool-state context visually while tools are running
- Keep the plugin zero-dependency (bash only) and toggleable per-session
- Support user-defined characters via a simple override file

## Out of Scope (v1)

- Agent teams multi-figure mode (nice-to-have, future)
- Windows support

---

## Architecture

### Plugin Structure

```
claude-say/
├── .claude-plugin/
│   └── plugin.json              # Required manifest
├── hooks/
│   ├── hooks.json               # Hook event registration
│   └── scripts/
│       ├── session-start.sh     # Inject protocol at session open
│       ├── prompt-submit.sh     # Reinforce tag format per turn
│       ├── pre-tool-use.sh      # Render tool-state cat
│       └── stop.sh              # Parse <cat-say> → render bubble
├── lib/
│   ├── render.sh                # Bubble + cat renderer (core)
│   ├── moods.sh                 # Mood → face expression map
│   └── tools.sh                 # Tool name → prop + mood map
├── characters/
│   └── default.sh               # Default ASCII cat body parts
├── skills/
│   └── claude-say/
│       └── SKILL.md             # /claude-say on/off toggle skill
└── README.md
```

All intra-plugin paths use `${CLAUDE_PLUGIN_ROOT}` for portability.

### plugin.json

```json
{
  "name": "claude-say",
  "version": "1.0.0",
  "description": "Renders Claude replies as ASCII cat speech bubbles",
  "license": "MIT",
  "keywords": ["ascii", "cat", "tui", "fun"]
}
```

### hooks/hooks.json

```json
{
  "SessionStart":      [{ "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/session-start.sh" }] }],
  "UserPromptSubmit":  [{ "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/prompt-submit.sh" }] }],
  "PreToolUse":        [{ "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-tool-use.sh" }] }],
  "Stop":              [{ "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/stop.sh" }] }]
}
```

---

## On/Off Switch

State is held in a flag file: `~/.claude/.claude-say-active`.

- **Exists** → cat mode on
- **Absent** → cat mode off, all hooks exit immediately (zero overhead)

The `/claude-say` skill toggles the flag and confirms with a brief cat preview.

---

## Data Flow

```
Session opens
  └─▶ session-start.sh   flag? → print <claude-say-protocol> block into context

User sends message
  └─▶ prompt-submit.sh   flag? → echo one-line reminder to stdout (injected as context)

Claude calls a tool
  └─▶ pre-tool-use.sh    read tool_name → map to (prop, mood) → render cat to terminal

Claude finishes turn
  └─▶ stop.sh            read transcript → extract last assistant message
                          grep <cat-say mood="X">...</cat-say>
                          found?  → render bubble + cat
                          absent? → silent exit (no duplicate output)
```

---

## The `<cat-say>` Protocol

`session-start.sh` injects this instruction block when the flag exists:

```
<claude-say-protocol>
When giving a conversational reply, append this tag at the very end:
<cat-say mood="MOOD">Brief 1-line summary of what you did or said</cat-say>

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
</claude-say-protocol>
```

`prompt-submit.sh` echoes a one-liner reminder with every user turn so Claude never drifts:
```
[claude-say: end chatty reply with <cat-say mood="X">summary</cat-say>]
```

---

## Rendering

### render.sh Interface

```bash
render.sh "<message>" "<mood>" "<prop>"
```

1. Sources `moods.sh` → resolves face string for mood
2. Sources `tools.sh` → resolves prop string
3. Sources user character override (`~/.claude/claude-say/character.sh`) or `characters/default.sh`
4. Wraps message text at 45 chars
5. Renders Unicode bubble + cat body to stdout with ANSI colors

### Mood Expressions

| Mood      | Face       | When used                        |
|-----------|------------|----------------------------------|
| happy-a   | `( ^ᵕ^ )` | Normal success (variant A)       |
| happy-b   | `( ᵕ‿ᵕ)` | Normal success (variant B)       |
| excited   | `( ^▽^ )` | Big win                          |
| excited-b | `( ≧▽≦)` | Very excited                     |
| thinking  | `( ._. )` | In progress / uncertain          |
| focused   | `( -.- )` | Running a tool                   |
| upset     | `( >_< )` | Warning or partial failure       |
| error     | `( x_x )` | Actual error                     |

Positive moods rotate between variants on each render to avoid repetition.

### Tool Props (PreToolUse)

| Tool(s)              | Prop          | Mood     |
|----------------------|---------------|----------|
| Edit, Write          | 🔧 wrench arm | focused  |
| Bash                 | `>_` terminal | focused  |
| Grep, Glob           | 🔍 magnifier  | thinking |
| Read                 | 📖 book       | thinking |
| WebFetch, WebSearch  | `~~` antenna  | thinking |
| Agent (spawn)        | 👾 buddy      | excited  |
| TodoWrite            | 📋 clipboard  | focused  |
| default              | neutral pose  | focused  |

### Rendered Output Examples

**Chat reply (Stop hook):**
```
...Claude's full response above...
<cat-say mood="excited">All 3 tests pass now!</cat-say>

 ╭────────────────────────────────╮
 │   All 3 tests pass now!        │
 ╰──────────────────╮─────────────╯
                    │
   /\_____/\
  ( ≧▽≦  )
   (  =  )
    )─────(
   (_)   (_)
```

**Tool state (PreToolUse):**
```
 ╭─────────────────────────────────╮
 │   Edit → src/utils.py           │
 ╰─────────────────╮───────────────╯
                   │
   /\_____/\
  ( -.-   )
  (🔧=    )
    )─────(
   (_)   (_)
```

---

## Character Customization

Users create `~/.claude/claude-say/character.sh` exporting these variables:

```bash
CHAR_HEAD_HAPPY="( ^ᵕ^ )"
CHAR_HEAD_EXCITED="( ^▽^ )"
CHAR_HEAD_THINKING="( ._. )"
CHAR_HEAD_FOCUSED="( -.- )"
CHAR_HEAD_UPSET="( >_< )"
CHAR_HEAD_ERROR="( x_x )"
CHAR_BODY_TOP="   /\_____/\\"
CHAR_BODY_MID="   (  =  )"
CHAR_BODY_BOT="    )─────("
CHAR_FEET="   (_)   (_)"
```

`render.sh` sources the user file first; any missing variable falls back to `characters/default.sh`.

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Claude omits `<cat-say>` tag | stop.sh exits silently — no duplicate output |
| Multiple tags in one response | Take the last one |
| Tool input path > 50 chars | Truncate with `…` |
| Message > 45 chars wide | Wrap to multiple bubble lines |
| Custom character missing a mood | Fall back to default cat expression |
| Flag absent | All hooks exit at line 2 — zero overhead |

---

## Caveman Compatibility

`claude-say` stacks naturally with the caveman plugin. Caveman compresses the main response body; `claude-say` bubbles the separately-written summary tag. No conflict. README recommends `caveman-lite` as a complementary install.
