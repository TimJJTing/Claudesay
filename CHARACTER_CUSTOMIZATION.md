# Character customization

You can change the character with a JSON file. Put the file at this path:

```
~/.claude/claudesay/character.json
```

The file is optional. If there is no file, the mod uses the default character and shows no message.

Write only the fields that you want to change. The mod uses the default value for each field that is not in the file.

The mod reads the file when a session starts and when each turn starts. Thus a change shows on the next turn. You do not have to restart the session.

The mod checks the file:

- If the file is not valid JSON, is larger than 64 KB, or is not a regular file, the mod shows a message and uses the default character. The mod does not read a file that is larger than 64 KB.
- If a field has an incorrect value, the mod ignores that field and shows a message with its name. The mod uses the other fields.
- The mod shows a message one time for each change to the file, not on each turn.

These are the limits:

| Item | Limit |
| --- | --- |
| `sideWidth`, `centerWidth`, `cellHeight` | An integer from 1 to 40. |
| `topHeight` | An integer from 0 to 40. |
| A cell or a prop template | A list of 20 strings or less. |
| One line, one face or one prop | 200 characters or less. |
| `tools` | 500 tools or less. The mod ignores the tools after the first 500, and shows no message. |

The mod removes control characters from all lines before it draws them.

Subagents use the same character. Each subagent takes a slot of `2 × sideWidth + centerWidth + 2` columns. With the default character, a slot is 20 columns. A row of the pane holds as many slots as its width allows, so a pane narrower than 38 columns puts each subagent in a row of its own below the main character. A wider or taller character gives fewer slots. When the pane has no room for a second slot, it shows only a count of the subagents. The parachute follows `centerWidth`. The plane has a fixed width. Refer to [Subagents](README.md#subagents).

The first line of the default `top` cell is empty. This empty row keeps a row of subagents apart from the labels of the row above. If your `top` cell has no empty first line, add one to keep this space.

## Example

This file changes the focused face, gives the character a hat in one more top row and changes the prop for Bash:

```json
{
  "faces": {
    "focused": "( •_•  )"
  },
  "topHeight": 3,
  "cells": {
    "top": ["", "  ___  ", " /\\__/\\ "]
  },
  "tools": {
    "Bash": { "prop": "⚡", "side": "left" }
  }
}
```

In JSON, write each backslash as `\\`.

## Grid layout

The character is a grid of 3 × 3 cells. With the default dimensions, it is 18 columns wide and 9 rows high.

```
  ┌─────┬────────┬─────┐
  │ TL  │  TOP   │ TR  │  topHeight rows (default 2)
  │     │  FACE  │     │  1 row
  ├─────┼────────┼─────┤
  │  L  │  BODY  │  R  │  cellHeight rows (default 3)
  ├─────┼────────┼─────┤
  │ BL  │  BOT   │ BR  │  cellHeight rows (default 3)
  └─────┴────────┴─────┘
```

The TL and TR cells are `topHeight + 1` rows high, because they include the face row.

The mod adds spaces to the right of each line until the line fills the cell width. It also adds empty lines at the bottom until the cell is full. Thus you can write only the lines that have content. You must write empty lines at the top of a cell.

The mod removes empty rows at the bottom of the character.

## Dimensions

| Field | Default | Function |
| --- | --- | --- |
| `sideWidth` | `5` | Width of the TL, TR, L, R, BL and BR cells, in columns. |
| `centerWidth` | `8` | Width of the TOP, FACE, BODY and BOT cells, in columns. |
| `cellHeight` | `3` | Height of the L, BODY, R, BL, BOT and BR cells, in rows. |
| `topHeight` | `2` | Height of the TOP cell, in rows. |

The tail of the bubble points to column `sideWidth + centerWidth / 2`.

## Faces

A face is one line. Make it `centerWidth` columns wide. The parentheses are part of the face.

Give one face as a string. Give two or more faces as a list. When a mood has a list, the mod selects one face for each line. The same line always gets the same face.

| Mood | Default | Use |
| --- | --- | --- |
| `happy` | `["( ^ᵕ^  )", "( ᵕ‿ᵕ  )"]` | Success. |
| `excited` | `["( ^▽^  )", "( ≧▽≦  )"]` | Success. |
| `thinking` | `"( ._.  )"` | Work in progress, or not sure. The pane also shows it while Claude works and no tool runs. |
| `focused` | `"( -.-  )"` | Work, or a command that runs. |
| `upset` | `"( >_<  )"` | A warning, or a partial failure. The main character also shows it while a subagent shows the error face. |
| `error` | `"( x_x  )"` | A failure. A subagent shows it when its run fails. |

```json
{
  "faces": {
    "happy": ["( ^ᵕ^  )", "( ᵕ‿ᵕ  )"],
    "error": "( x_x  )"
  }
}
```

## Cells

Each cell is a list of lines. These are the defaults:

```json
{
  "cells": {
    "topLeft": [],
    "top": ["", " /\\__/\\ "],
    "topRight": [],
    "left": ["   ╭╭", "   ○ "],
    "body": [": ,,,, :", "(      )", "(╭....╮)"],
    "right": ["╮╮", " ○"],
    "bottomLeft": ["    ("],
    "bottom": ["_)    (_"],
    "bottomRight": [")╰~~>"]
  }
}
```

## Prop templates

When the character holds a prop, a prop template replaces the L cell or the R cell. In the template, `{prop}` changes to the prop of the tool.

```json
{
  "propLeft": [" {prop}○═"],
  "propRight": ["═○{prop}"]
}
```

## Tool props

Each tool has a look with three fields:

| Field | Values | Function |
| --- | --- | --- |
| `prop` | A symbol, or `null` | The item in the hand of the character. `null` means no item. |
| `mood` | `happy`, `excited`, `thinking`, `focused`, `upset`, `error` | The face of the character. |
| `side` | `left`, `right`, or `null` | The hand that holds the prop. |

Use the tool name as the key. You can give a part of a look. The mod keeps the default value of each field that you do not give.

```json
{
  "tools": {
    "Bash": { "prop": "⚡", "mood": "happy", "side": "left" },
    "Grep": { "mood": "thinking" },
    "mcp__github__create_issue": { "prop": "🐙", "mood": "excited", "side": "right" }
  }
}
```

A tool that is not in the list has no prop and the `happy` mood. An MCP tool (name starts with `mcp__`) that is not in the list uses the look of `ReadMcpResourceTool`.

### Default tool props

| Tools | Prop | Mood | Side |
| --- | --- | --- | --- |
| `Edit`, `Write`, `MultiEdit` | 🔧 wrench | `focused` | `left` |
| `Bash` | 🪄 wand | `excited` | `right` |
| `Grep`, `Glob`, `ToolSearch`, `LSP` | 🔍 magnifying glass | `focused` | `left` |
| `Read` | 📖 book | `focused` | `left` |
| `WebFetch`, `WebSearch` | 📡 satellite dish | `thinking` | `right` |
| `Agent` | 🤖 robot | `excited` | `right` |
| `TodoWrite` | 📋 clipboard | `focused` | `left` |
| `AskUserQuestion` | 🎤 microphone | `excited` | `right` |
| `CronCreate` | ⏰ alarm clock | `focused` | `right` |
| `CronDelete` | 🔫 pistol | `focused` | `left` |
| `CronList` | 📅 calendar | `thinking` | `left` |
| `EnterPlanMode` | 🗺️ map | `thinking` | `left` |
| `ExitPlanMode` | no prop | `excited` | `right` |
| `EnterWorktree`, `ExitWorktree` | 🌿 branch | `focused` | `right` |
| `Monitor` | 🔭 telescope | `thinking` | `left` |
| `NotebookEdit` | 📓 notebook | `focused` | `right` |
| `PowerShell` | 💠 blue diamond | `focused` | `right` |
| `SendMessage` | 📨 envelope | `excited` | `right` |
| `Skill` | 🍳 frying pan | `excited` | `left` |
| `TaskCreate` | 📝 memo | `focused` | `left` |
| `TaskGet`, `TaskList`, `TaskUpdate` | 📝 memo | `thinking` | `left` |
| `TaskOutput`, `TaskStop` | no prop | `focused` | `right` |
| `TeamCreate`, `TeamDelete` | 💰 money bag | `excited` | `right` |
| `ListMcpResourcesTool`, `ReadMcpResourceTool` | 🔌 plug | `thinking` | `left` |

## Single-width props

The mod counts each emoji as two columns. Some terminal fonts draw an emoji in one column. If the prop rows move by one column in your terminal, use single-width symbols as props. These symbols have the same width in all terminal fonts:

```json
{
  "tools": {
    "Edit": { "prop": "✎ " },
    "Bash": { "prop": "↯ " },
    "Read": { "prop": "▤ " }
  }
}
```

Add a space after a single-width symbol. The space keeps the prop two columns wide, the same as the default emoji.

## Migrate from character.sh

Version 2 used `~/.claude/claudesay/character.sh`. Version 3 does not read this file. Use this table to move your values to `character.json`:

| character.sh | character.json |
| --- | --- |
| `CHAR_SIDE_WIDTH`, `CHAR_CENTER_WIDTH` | `sideWidth`, `centerWidth` |
| `CHAR_CELL_HEIGHT`, `CHAR_TOP_HEIGHT` | `cellHeight`, `topHeight` |
| `CHAR_FACE_HAPPY_A`, `CHAR_FACE_HAPPY_B` | `faces.happy` (a list) |
| `CHAR_FACE_EXCITED_A`, `CHAR_FACE_EXCITED_B` | `faces.excited` (a list) |
| `CHAR_FACE_THINKING` and the other faces | `faces.thinking` and the other moods |
| `CHAR_TOP_LEFT`, `CHAR_TOP`, `CHAR_TOP_RIGHT` | `cells.topLeft`, `cells.top`, `cells.topRight` |
| `CHAR_LEFT`, `CHAR_BODY`, `CHAR_RIGHT` | `cells.left`, `cells.body`, `cells.right` |
| `CHAR_BOTTOM_LEFT`, `CHAR_BOTTOM`, `CHAR_BOTTOM_RIGHT` | `cells.bottomLeft`, `cells.bottom`, `cells.bottomRight` |
| `CHAR_PROP_LEFT`, `CHAR_PROP_RIGHT` (with `${prop}`) | `propLeft`, `propRight` (with `{prop}`) |
| `TOOL_INFO_BASH="⚡ happy left"` | `"tools": { "Bash": { "prop": "⚡", "mood": "happy", "side": "left" } }` |
| `none` as a prop or a side | `null` |

A `TOOL_INFO_*` variable can apply to more than one tool. In `character.json`, give a look for each tool name.
