# claudesay

A Claude Code plugin that renders conversational replies as ASCII character speech bubbles in the terminal. Tool-use events show the character holding a relevant prop with a context-appropriate face expression. Inspired by cowsay. Just for fun.

```
⏺ Skill(claudesay:claudesay)
  ⎿ PreToolUse:Skill says:

 ╭──────────╮
 │ Skill    │
 ╰────────┬─╯
         │
                  
      /\__/\      
     ( ≧▽≦  )     
   ╭╭: ,,,, :╮╮   
   ○ (      ) ○   
     (╭....╮)     
    (_)    (_)╰~~>

⏺ Update(README.md)
  ⎿ PreToolUse:Edit says:

 ╭─────────────────────────────╮
 │ Edit →                      │
 │ /path/to/codebase/README.md │
 ╰────────┬────────────────────╯
         │
                  
      /\__/\      
     ( -.-  )     
 🔧○═: ,,,, :╮╮   
     (      ) ○   
     (╭....╮)     
    (_)    (_)╰~~>

```

## How It Works

claudesay is built entirely on [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) — small shell scripts that run at specific points in Claude's lifecycle. No external server, no background process, just four Bash scripts that react to events:

1. **Session starts →** A short instruction is injected into the conversation telling Claude to end chatty replies with a `<claudesay>` tag containing a mood and a one-line summary.

2. **You send a prompt →** The hook checks whether you typed a toggle command (like `turn on claudesay`). If so, it flips the flag file and blocks Claude's turn entirely — Claude never sees the message. For anything else, it appends a short reminder so Claude remembers to include the tag.

3. **Claude calls a tool →** Before each tool call, the hook looks up the tool name, picks an emoji prop and a mood, and renders the character holding that prop (e.g. 🔧 for edits, 🔍 for search).

4. **Claude finishes its reply →** The hook reads the conversation transcript, extracts the `<claudesay>` tag from the last assistant message, and renders the speech bubble with the appropriate face.

All rendering is pure Bash — the script draws a Unicode box around the message text and prints the ASCII character underneath. Nothing is sent over the network; everything happens locally in your terminal.

## Requirements

- macOS or Linux (interactive terminal required — no CI/Docker support)
- `jq` installed (`brew install jq` / `apt install jq`)

## Install

Register this repo as a marketplace, then install the plugin.

```bash
# From inside the repo checkout:
claude plugin marketplace add TimJJTing/claudesay
claude plugin install claudesay@claudesay
```

Verify it loaded (optional):

```bash
grep claudesay ~/.claude/settings.json                    # enabledPlugins entry
grep claudesay ~/.claude/plugins/installed_plugins.json   # install record
```

Restart your Claude Code session for the hooks to take effect.

If you commit your project's `.claude/` directory, you should probably ignore the flag file so it doesn't get checked in:

```bash
# .gitignore
.claude/.claudesay-active
```

## Usage

Toggle on or off with one of the recognized phrases:

- `turn on claudesay` / `enable claudesay` / `activate claudesay`
- `turn off claudesay` / `disable claudesay` / `hide claudesay`
- `toggle claudesay`
- `claudesay status` / `is claudesay on?`

**Toggling never asks for Bash permission.** The `UserPromptSubmit` hook detects these phrases, flips the flag file itself, renders the confirmation bubble directly to the terminal, and suppresses Claude's turn with a `{"decision":"block"}` response. Claude isn't in the loop.

Loose phrasing ("flip claudesay on, would ya?") will fall through to Claude. In that case the skill tells Claude to point you at the recognized phrase — it will not attempt to toggle via a Bash call.

## Character Customization

The character is a **3×3 grid of cells** (18 cols × 9 rows). Center column is 8 chars wide; side columns are 5 chars wide.

```
  ┌─────┬────────┬─────┐
  │ TL  │  TOP   │ TR  │  rows 0-1   ← TOP is 8×2
  │     │  FACE  │     │  row  2     ← FACE is 8×1 (mood-specific)
  ├─────┼────────┼─────┤
  │  L  │  BODY  │  R  │  rows 3-5
  ├─────┼────────┼─────┤
  │ BL  │  BOT   │ BR  │  rows 6-8
  └─────┴────────┴─────┘
```

Create `~/.claude/claudesay/character.sh` and override any subset — missing vars fall back to the defaults below.

### Dimension variables

```bash
CHAR_SIDE_WIDTH=5      # cols for TL/TR/L/R/BL/BR
CHAR_CENTER_WIDTH=8    # cols for TOP/FACE/BODY/BOT
CHAR_CELL_HEIGHT=3     # rows for all cells except TOP
CHAR_TOP_HEIGHT=2      # rows for TOP (FACE always occupies row 2)
```

### Face expressions

8 chars wide, parens included. Positive moods rotate between two variants.

```bash
CHAR_FACE_HAPPY_A="( ^ᵕ^  )"
CHAR_FACE_HAPPY_B="( ᵕ‿ᵕ  )"
CHAR_FACE_EXCITED_A="( ^▽^  )"
CHAR_FACE_EXCITED_B="( ≧▽≦  )"
CHAR_FACE_THINKING="( ._.  )"
CHAR_FACE_FOCUSED="( -.-  )"
CHAR_FACE_UPSET="( >_<  )"
CHAR_FACE_ERROR="( x_x  )"
```

### Grid cells

Cells are right-padded to their column width and bottom-padded to their row count automatically — write only the lines that matter; trailing blank lines can be omitted.

```bash
# Top section (TL/TR: 5×3; TOP: 8×CHAR_TOP_HEIGHT)
CHAR_TOP_LEFT="\
     
     
     "

CHAR_TOP="\
        
 /\__/\\ "

CHAR_TOP_RIGHT="\
     
     
     "

# Body section (L/R: 5×3; BODY: 8×3)
CHAR_LEFT="\
   ╭╭
   ○ 
     "

CHAR_BODY="\
: ,,,, :
(      )
(╭....╮)"

CHAR_RIGHT="\
╮╮   
 ○   
     "

# Bottom section (BL/BR: 5×3; BOT: 8×3)
CHAR_BOTTOM_LEFT="\
    (
     
     "

CHAR_BOTTOM="\
_)    (_
        
        "

CHAR_BOTTOM_RIGHT="\
)╰~~>
     
     "
```

### Prop cell templates

When the character holds a tool prop, the left or right cell is replaced by an expanded template. `$prop` expands to the tool's emoji at render time.

**Use single quotes** so `$prop` is not expanded when the file is sourced:

```bash
CHAR_PROP_LEFT='\
 ${prop}○═
     
     '

CHAR_PROP_RIGHT='\
═○${prop}  
     
     '
```

### Tool display config

Each tool maps to a `"prop mood side"` triple that controls the emoji in the character's hand, the face expression, and which arm holds the prop. Override any entry in `~/.claude/claudesay/character.sh`:

```bash
# Make Bash feel more electric; hold it on the left
TOOL_INFO_BASH="⚡ happy left"

# Make all searches look pensive
TOOL_INFO_SEARCH="🔭 thinking left"
```

Available variables and their defaults:

| Variable | Default | Prop | Tools |
|---|---|---|---|
| `TOOL_INFO_EDIT` | `🔧 focused left` | 🔧 wrench | `Edit`, `Write` |
| `TOOL_INFO_BASH` | `🪄 excited right` | 🪄 wand | `Bash` |
| `TOOL_INFO_SEARCH` | `🔍 focused left` | 🔍 magnifying glass | `Grep`, `Glob`, `ToolSearch`, `LSP`, `Monitor` |
| `TOOL_INFO_READ` | `📖 focused left` | 📖 book | `Read` |
| `TOOL_INFO_WEB` | `📡 thinking right` | 📡 satellite dish | `WebFetch`, `WebSearch` |
| `TOOL_INFO_AGENT` | `🤖 excited right` | 🤖 robot | `Agent` |
| `TOOL_INFO_TODO` | `📋 focused left` | 📋 clipboard | `TodoWrite` |
| `TOOL_INFO_ASK` | `🎤 excited right` | 🎤 microphone | `AskUserQuestion` |
| `TOOL_INFO_CRON_CREATE` | `⏰ focused right` | ⏰ alarm clock | `CronCreate` |
| `TOOL_INFO_CRON_DELETE` | `🔫 focused left` | 🔫 pistol | `CronDelete` |
| `TOOL_INFO_CRON_LIST` | `📅 thinking left` | 📅 calendar | `CronList` |
| `TOOL_INFO_PLAN_ENTER` | `🗺️ thinking left` | 🗺️ map | `EnterPlanMode` |
| `TOOL_INFO_PLAN_EXIT` | `none excited right` | _(no prop)_ | `ExitPlanMode` |
| `TOOL_INFO_WORKTREE` | `🌿 focused right` | 🌿 branch | `EnterWorktree`, `ExitWorktree` |
| `TOOL_INFO_NOTEBOOK` | `📓 focused right` | 📓 notebook | `NotebookEdit` |
| `TOOL_INFO_POWERSHELL` | `💠 focused right` | 💠 blue diamond | `PowerShell` |
| `TOOL_INFO_MESSAGE` | `📨 excited right` | 📨 envelope | `SendMessage` |
| `TOOL_INFO_SKILL` | `🍳 excited left` | 🍳 frying pan | `Skill` |
| `TOOL_INFO_TASK_WRITE` | `📝 focused left` | 📝 memo | `TaskCreate` |
| `TOOL_INFO_TASK_READ` | `📝 thinking left` | 📝 memo | `TaskGet`, `TaskList`, `TaskUpdate` |
| `TOOL_INFO_TASK_STOP` | `none focused right` | _(no prop)_ | `TaskOutput`, `TaskStop` |
| `TOOL_INFO_TEAM` | `💰 excited right` | 💰 money bag | `TeamCreate`, `TeamDelete` |
| `TOOL_INFO_MCP` | `🔌 thinking left` | 🔌 plug | `ListMcpResourcesTool`, `ReadMcpResourceTool` |
| `TOOL_INFO_DEFAULT` | `none happy none` | _(no prop)_ | all other tools |

### Preview script

Iterate on your character without going through Claude:

```bash
# All moods × {no prop, prop-left, prop-right}
bash bin/preview.sh

# Single mood
bash bin/preview.sh focused

# Mood holding a prop
bash bin/preview.sh excited 🪄 right

# Debug: color each cell to check alignment
bash bin/preview.sh thinking 🔧 left --debug
```

## Architecture

All behavior is in hooks (declared inline in `.claude-plugin/plugin.json`):

| Hook               | Script                           | Responsibility                                                                            |
| ------------------ | -------------------------------- | ----------------------------------------------------------------------------------------- |
| `SessionStart`     | `hooks/scripts/session-start.sh` | Injects the `<claudesay-protocol>` instruction as additional context when the flag is on. |
| `UserPromptSubmit` | `hooks/scripts/prompt-submit.sh` | Handles toggle/status intents in-hook; emits the per-turn reminder on other prompts.      |
| `PreToolUse`       | `hooks/scripts/pre-tool-use.sh`  | Renders the tool-holding character before each tool call.                                 |
| `Stop`             | `hooks/scripts/stop.sh`          | Parses the `<claudesay>` tag from the JSONL transcript and renders the speech bubble.     |

The skill at `skills/claudesay/SKILL.md` is documentation/fallback only — it does not run Bash.

## FAQ

### Does it consume my tokens?

Yes, but not much. The plugin adds a small instruction to the conversation at session start (~120 tokens) plus a short per-turn reminder (~20 tokens). The `<claudesay>` tag Claude writes in its reply also costs a few output tokens per turn. In practice the overhead is negligible — well under 1 % of a typical conversation's total token usage.

The hooks themselves (rendering, toggling, reading the transcript) are pure Bash and do not make any API calls, so they cost zero tokens.

### Why does the bubble not always appear?

The bubble only renders when Claude includes a `<claudesay>` tag in its reply. The session-start instruction tells Claude to add the tag only on "chatty, conversational" replies and to skip it for pure code blocks, diffs, long technical output, or tool-only responses. So if you ask Claude to write a file or run a command and it responds with nothing but code, you won't see a bubble — that's intentional.

Other reasons a bubble may not appear:

- **claudesay is off.** Check with `claudesay status`.
- **Claude forgot.** The model doesn't always follow the instruction perfectly.
  This is a known limitation of prompt-based approaches.
- **Non-interactive terminal.** The character requires a writable `/dev/tty`. CI,
  Docker, `--print` mode, and non-interactive SSH sessions will silently skip
  rendering.

### How is this different from Claude Code's once built-in Buddy?

Buddy was a Tamagotchi-style virtual pet — a companion you hatch and tend to. claudesay is something different: it's a **reaction layer on top of Claude's actual work**, not a pet.

- **Automatic, not manual.** claudesay fires on its own — every tool call renders a character holding a context prop, every chatty reply gets a speech bubble. You don't invoke it; it shows up because Claude is working.
- **Stateless by design.** There's no persistent creature to feed or evolve. The mood shown in each bubble comes directly from that reply's `<claudesay>` tag — it reflects what Claude just did, then it's gone.
- **Hook-driven, not a slash-command.** Everything runs through Claude Code hooks (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `Stop`). No Pro subscription required, no built-in Claude Code feature needed — just Bash scripts reacting to lifecycle events.
- **About the work, not the relationship.** Buddy gave you something to care for. claudesay gives Claude a face while it codes.

## Known Limitations

- The raw `<claudesay>` tag appears in the terminal scrollback before the bubble renders (Claude streams it before the Stop hook fires).
- Figures do not render in CI, `--print` mode, or non-interactive SSH sessions.
- Per-turn reminder adds ~20 tokens per turn.

## Compatibility

Stacks naturally with the [caveman plugin](https://github.com/JuliusBrussee/caveman). Caveman compresses the main response; claudesay bubbles the separately-written tag. No conflict. `caveman-lite` recommended as a complementary install.

## Development

Run the test suite locally:

```bash
bash tests/run-all.sh
```
