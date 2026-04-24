# Character Customization

Create `~/.claude/claudesay/character.sh` and override any subset of variables — missing vars fall back to the defaults.

## Grid layout

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

## Dimension variables

```bash
CHAR_SIDE_WIDTH=5      # cols for TL/TR/L/R/BL/BR
CHAR_CENTER_WIDTH=8    # cols for TOP/FACE/BODY/BOT
CHAR_CELL_HEIGHT=3     # rows for all cells except TOP
CHAR_TOP_HEIGHT=2      # rows for TOP (FACE always occupies row 2)
```

## Face expressions

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

## Grid cells

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

## Prop cell templates

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

## Tool display config

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
| `TOOL_INFO_SEARCH` | `🔍 focused left` | 🔍 magnifying glass | `Grep`, `Glob`, `ToolSearch`, `LSP` |
| `TOOL_INFO_MONITOR` | `🔭 thinking left` | 🔭 telescope | `Monitor` |
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

## Preview script

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
