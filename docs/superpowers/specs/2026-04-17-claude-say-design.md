# claude-say Design Spec
_2026-04-17_

## Overview

`claude-say` is a Claude Code plugin that renders Claude's conversational replies as ASCII figure speech bubbles in the terminal. Tool-use events show the figure holding a relevant prop (wrench, magnifier, etc.) with a context-appropriate face expression. The figure is expressive, dynamic, and customizable.

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
│       ├── pre-tool-use.sh      # Render tool-state figure
│       └── stop.sh              # Parse <claude-say> → render bubble
├── lib/
│   ├── render.sh                # Bubble + figure renderer (core)
│   ├── moods.sh                 # Mood → face expression map
│   └── tools.sh                 # Tool name → prop + mood map
├── characters/
│   └── default.sh               # Default ASCII figure body parts
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
  "description": "Renders Claude replies as ASCII figure speech bubbles",
  "license": "MIT",
  "keywords": ["ascii", "companion", "tui", "fun"]
}
```

### hooks/hooks.json

Plugin hooks.json requires a `{"hooks": {...}}` outer wrapper and a `"matcher"` field on each entry:

```json
{
  "hooks": {
    "SessionStart":     [{ "matcher": "*", "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/session-start.sh" }] }],
    "UserPromptSubmit": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/prompt-submit.sh" }] }],
    "PreToolUse":       [{ "matcher": "*", "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-tool-use.sh" }] }],
    "Stop":             [{ "matcher": "*", "hooks": [{ "type": "command", "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/stop.sh" }] }]
  }
}
```

---

## On/Off Switch

State is held in a flag file: `~/.claude/.claude-say-active`.

- **Exists** → figure mode on
- **Absent** → figure mode off, all hooks exit immediately (zero overhead)

The `/claude-say` skill toggles the flag and confirms with a brief figure preview.

---

## Data Flow

```
Session opens
  └─▶ session-start.sh   flag? → print <claude-say-protocol> block into context

User sends message
  └─▶ prompt-submit.sh   flag? → echo one-line reminder to stdout (injected as context)

Claude calls a tool
  └─▶ pre-tool-use.sh    parse stdin JSON → get tool_name
                          map to (prop, mood, side) → render.sh writes figure to /dev/tty
                          echo '{"hookSpecificOutput":{"permissionDecision":"allow"}}' to stdout

Claude finishes turn
  └─▶ stop.sh            parse stdin JSON → get transcript_path
                          jq-extract last assistant message from transcript
                          grep <claude-say mood="X">...</claude-say> within that string
                          found?  → render.sh writes bubble to /dev/tty
                                    echo '{"decision":"approve"}' to stdout
                          absent? → echo '{"decision":"approve"}' to stdout (silent)
```

---

## The `<claude-say>` Protocol

`session-start.sh` injects the protocol via a `systemMessage` in its JSON output (the hook API for injecting context into Claude's session):

```bash
# session-start.sh output to stdout:
echo '{"systemMessage": "<claude-say-protocol>\nWhen giving a conversational reply, append this tag at the very end:\n<claude-say mood=\"MOOD\">Brief 1-line summary of what you did or said</claude-say>\n\nAvailable moods: happy, excited, thinking, focused, upset, error\n- happy / excited \u2192 success outcomes (rotate between them for variety)\n- thinking        \u2192 in-progress or uncertain\n- focused         \u2192 working, running something\n- upset           \u2192 warning or partial failure\n- error           \u2192 actual failure\n\nRules:\n- Keep message under 60 chars\n- Do NOT add the tag to: pure code blocks, diffs, long technical output, tool-only responses\n- Only chatty, conversational replies get a bubble\n</claude-say-protocol>"}'
```

`prompt-submit.sh` outputs a `systemMessage` reminder with every user turn so Claude never drifts:
```bash
echo '{"systemMessage": "[claude-say: end chatty reply with <claude-say mood=\"X\">summary</claude-say>]"}'
```

---

## Rendering

### render.sh Interface

```bash
render.sh "<message>" "<mood>" ["<prop>" "<side>"]
```

`prop` and `side` are optional — omit both for chat-reply bubbles (Stop hook). `pre-tool-use.sh` passes all four.

1. Sources `moods.sh` → resolves face string for mood
2. Sources `tools.sh` → resolves prop string and side
3. Sources user character override (`~/.claude/claude-say/character.sh`) or `characters/default.sh`
4. Wraps message text at 45 chars
5. Assembles body line: `{left_or_prop}( body ){right_or_prop}` based on side
6. Writes Unicode bubble + figure body to `/dev/tty` with ANSI colors

**Critical**: render.sh writes to `/dev/tty`, not stdout. Hook scripts own stdout — it must carry only the JSON hook response, never visual output. Mixing ASCII art into stdout corrupts the hook protocol.

**Body line assembly:**

```bash
if [[ -n "$prop" && "$side" == "left" ]]; then
  body_line="${prop}=( body )${CHAR_HAND_RIGHT}"   # e.g. 📖=( ,,,, )m
elif [[ -n "$prop" && "$side" == "right" ]]; then
  body_line="${CHAR_HAND_LEFT}( body )=${prop}"    # e.g. m( ,,,, )=🪄
else
  body_line="${CHAR_HAND_LEFT}( body )${CHAR_HAND_RIGHT}"  # e.g. m( ,,,, )m
fi
```

### Mood Expressions

| Mood      | Face       | When used                        |
|-----------|------------|----------------------------------|
| happy-a   | `( ^ᵕ^  )` | Normal success (variant A)       |
| happy-b   | `( ᵕ‿ᵕ  )` | Normal success (variant B)       |
| excited   | `( ^▽^  )` | Big win                          |
| excited-b | `( ≧▽≦  )` | Very excited                     |
| thinking  | `( ._.  )` | In progress / uncertain          |
| focused   | `( -.-  )` | Running a tool                   |
| upset     | `( >_<  )` | Warning or partial failure       |
| error     | `( x_x  )` | Actual error                     |

Positive moods rotate between variants on each render to avoid repetition.

### Tool Props (PreToolUse)

Each tool entry has a `side` field (`left`/`right`) controlling which hand holds the prop. "Reaching out" tools (searching, reading, fetching) use the left hand; "doing" tools (editing, running, spawning) use the right.

| Tool(s)              | Prop          | Mood     | Side  |
|----------------------|---------------|----------|-------|
| Edit, Write          | 🔧 wrench     | focused  | left  |
| Bash                 | 🪄 magic wand | focused  | right |
| Grep, Glob           | 🔍 magnifier  | thinking | left  |
| Read                 | 📖 book       | thinking | left  |
| WebFetch, WebSearch  | 📡 antenna    | thinking | right |
| Agent (spawn)        | 🤖 buddy      | excited  | right |
| TodoWrite            | 📋 clipboard  | focused  | left  |
| default              | (none)        | focused  | —     |

### Rendered Output Examples

**Chat reply (Stop hook):**
```
...Claude's full response above...
<claude-say mood="excited">All 3 tests pass now!</claude-say>

 ╭────────────────────────────────╮
 │   All 3 tests pass now!        │
 ╰────╮───────────────────────────╯
      │                 
    /\__/\
   ( ≧▽≦  )
  m( ,,,, )m
    ||   ||`~~>
   (_)  (_)
```

**Tool state (PreToolUse), prop on right (Edit):**
```
 ╭─────────────────────────────────╮
 │   Edit → src/utils.py           │
 ╰────╮────────────────────────────╯
      │
    /\__/\
   ( -.-  )
🔧=( ,,,, )m
    ||   ||`~~>
   (_)  (_)
```

**Tool state (PreToolUse), prop on left (Read):**
```
 ╭─────────────────────────────────╮
 │   Read → src/utils.py           │
 ╰────╮────────────────────────────╯
      │
    /\__/\
   ( ._.  )
📖=( ,,,, )m
    ||   ||`~~>
   (_)  (_)
```

---

## Character Customization

Users create `~/.claude/claude-say/character.sh` exporting these variables:

```bash
CHAR_FACE_HAPPY="( ^ᵕ^  )"
CHAR_FACE_EXCITED="( ^▽^  )"
CHAR_FACE_THINKING="( ._.  )"
CHAR_FACE_FOCUSED="( -.-  )"
CHAR_FACE_UPSET="( >_<  )"
CHAR_FACE_ERROR="( x_x  )"
CHAR_TOP="    /\__/\\" # the top of the character, above face
CHAR_BODY="( ,,,, )" # the body of the character, below face
CHAR_HAND_LEFT="m"           # left-side hand
CHAR_HAND_RIGHT="m"          # right-side hand
CHAR_BOTTOM="    ||   ||\`~~>\n   (_)  (_)" # the rest of the character, can have multiple lines
```

`render.sh` sources the user file first; any missing variable falls back to `characters/default.sh`.

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Claude omits `<claude-say>` tag | stop.sh exits silently — no duplicate output |
| Multiple tags in one response | Take the last one |
| Tool input path > 50 chars | Truncate with `…` |
| Message > 45 chars wide | Wrap to multiple bubble lines |
| Custom character missing a mood | Fall back to default figure expression |
| Custom character missing `CHAR_HAND_LEFT` or `CHAR_HAND_RIGHT` | Fall back to `m` for each |
| Tool entry has no `side` or side is `—` | No prop shown, both hands rendered normally |
| `jq` not installed | stop.sh and pre-tool-use.sh exit 0 silently — no crash, no bubble |
| Flag absent | All hooks exit at line 2 — zero overhead |

---

## Caveman Compatibility

`claude-say` stacks naturally with the caveman plugin. Caveman compresses the main response body; `claude-say` bubbles the separately-written summary tag. No conflict. README recommends `caveman-lite` as a complementary install.
