# claude-say

A Claude Code plugin that renders conversational replies as ASCII figure speech
bubbles in the terminal. Tool-use events show the figure holding a relevant
prop with a context-appropriate face expression.

## How It Works

claude-say is built entirely on [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) — small shell scripts
that run at specific points in Claude's lifecycle. No external server, no
background process, just four Bash scripts that react to events:

1. **Session starts →** A short instruction is injected into the conversation
   telling Claude to end chatty replies with a `<claude-say>` tag containing a
   mood and a one-line summary.

2. **You send a prompt →** The hook checks whether you typed a toggle command
   (like `turn on claude-say`). If so, it flips the flag file and blocks
   Claude's turn entirely — Claude never sees the message. For anything else,
   it appends a short reminder so Claude remembers to include the tag.

3. **Claude calls a tool →** Before each tool call, the hook looks up the tool
   name, picks an emoji prop and a mood, and renders the figure holding that
   prop (e.g. 🔧 for edits, 🔍 for search).

4. **Claude finishes its reply →** The hook reads the conversation transcript,
   extracts the `<claude-say>` tag from the last assistant message, and renders
   the speech bubble with the appropriate face.

All rendering is pure Bash — the script draws a Unicode box around the message
text and prints the ASCII figure underneath. Nothing is sent over the network;
everything happens locally in your terminal.

## Requirements

- macOS or Linux (interactive terminal required — no CI/Docker support)
- `jq` installed (`brew install jq` / `apt install jq`)

## Install

Claude Code plugins load through the marketplace system — dropping the
folder into your project is not enough. Register this repo as a local
marketplace, then install the plugin.

```bash
# From inside the repo checkout:
claude plugin marketplace add "$(pwd)"
claude plugin install claude-say@claude-say
```

Restart your Claude Code session for the hooks to take effect.

Verify it loaded:

```bash
grep claude-say ~/.claude/settings.json                    # enabledPlugins entry
grep claude-say ~/.claude/plugins/installed_plugins.json   # install record
```

## Usage

Toggle on or off with one of the recognized phrases:

- `turn on claude-say` / `enable claude-say` / `activate claude-say`
- `turn off claude-say` / `disable claude-say` / `hide claude-say`
- `toggle claude-say`
- `claude-say status` / `is claude-say on?`

**Toggling never asks for Bash permission.** The `UserPromptSubmit` hook
detects these phrases, flips the flag file itself, renders the
confirmation bubble directly to the terminal, and suppresses Claude's turn
with a `{"decision":"block"}` response. Claude isn't in the loop.

Loose phrasing ("flip claude-say on, would ya?") will fall through to
Claude. In that case the skill tells Claude to point you at the recognized
phrase — it will not attempt to toggle via a Bash call.

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
CHAR_BOTTOM="    ||   ||\`~~>
   (_)  (_)"
```

### Props

During tool calls the figure holds a context-specific emoji prop. The prop
replaces the hand on the active side, producing one of two layouts:

```
# prop on the left hand             # prop on the right hand
🔧=( ,,,, )m                          m( ,,,, )=🪄
```

The prop is determined by the tool name; tools with no suitable hand-holdable
prop render with both hands as normal. The current assignments are:

| Tool(s)                                       | Prop                           |
| --------------------------------------------- | ------------------------------ |
| `Edit`, `Write`                               | 🔧 wrench                      |
| `Bash`                                        | 🪄 wand                        |
| `Grep`, `Glob`, `ToolSearch`                  | 🔍 magnifying glass            |
| `Read`                                        | 📖 book                        |
| `WebFetch`, `WebSearch`                       | 📡 satellite dish              |
| `Agent`                                       | 🤖 robot                       |
| `TodoWrite`                                   | 📋 clipboard                   |
| `AskUserQuestion`                             | 🎤 microphone                  |
| `CronCreate`                                  | ⏰ alarm clock                 |
| `CronList`                                    | 📅 calendar                    |
| `EnterPlanMode`                               | 🗺️ map                         |
| `EnterWorktree`, `ExitWorktree`               | 🌿 branch                      |
| `Monitor`                                     | 🔭 telescope                   |
| `NotebookEdit`                                | 📓 notebook                    |
| `SendMessage`                                 | 📨 envelope                    |
| `TaskCreate`                                  | 📝 memo                        |
| `ListMcpResourcesTool`, `ReadMcpResourceTool` | 🔌 plug                        |
| All others                                    | _(no prop — both hands shown)_ |

## Architecture

All behavior is in hooks (declared inline in `.claude-plugin/plugin.json`):

| Hook               | Script                           | Responsibility                                                                             |
| ------------------ | -------------------------------- | ------------------------------------------------------------------------------------------ |
| `SessionStart`     | `hooks/scripts/session-start.sh` | Injects the `<claude-say-protocol>` instruction as additional context when the flag is on. |
| `UserPromptSubmit` | `hooks/scripts/prompt-submit.sh` | Handles toggle/status intents in-hook; emits the per-turn reminder on other prompts.       |
| `PreToolUse`       | `hooks/scripts/pre-tool-use.sh`  | Renders the tool-holding figure before each tool call.                                     |
| `Stop`             | `hooks/scripts/stop.sh`          | Parses the `<claude-say>` tag from the JSONL transcript and renders the speech bubble.     |

The skill at `skills/claude-say/SKILL.md` is documentation/fallback only —
it does not run Bash.

## FAQ

### Does it consume my tokens?

Yes, but not much. The plugin adds a small instruction to the conversation at
session start (~120 tokens) plus a short per-turn reminder (~20 tokens). The
`<claude-say>` tag Claude writes in its reply also costs a few output tokens
per turn. In practice the overhead is negligible — well under 1 % of a typical
conversation's total token usage.

The hooks themselves (rendering, toggling, reading the transcript) are pure
Bash and do not make any API calls, so they cost zero tokens.

### Why does the bubble not always appear?

The bubble only renders when Claude includes a `<claude-say>` tag in its
reply. The session-start instruction tells Claude to add the tag only on
"chatty, conversational" replies and to skip it for pure code blocks, diffs,
long technical output, or tool-only responses. So if you ask Claude to write a
file or run a command and it responds with nothing but code, you won't see a
bubble — that's intentional.

Other reasons a bubble may not appear:

- **claude-say is off.** Check with `claude-say status`.
- **Claude forgot.** The model doesn't always follow the instruction perfectly.
  This is a known limitation of prompt-based approaches.
- **Non-interactive terminal.** The figure requires a writable `/dev/tty`. CI,
  Docker, `--print` mode, and non-interactive SSH sessions will silently skip
  rendering.

### How is this different from Claude Code's once built-in Buddy?

Buddy was a Tamagotchi-style virtual pet — a companion you hatch and tend to. claude-say is
something different: it's a **reaction layer on top of Claude's actual work**, not a pet.

- **Automatic, not manual.** claude-say fires on its own — every tool call renders a figure
  holding a context prop, every chatty reply gets a speech bubble. You don't invoke it; it
  shows up because Claude is working.
- **Stateless by design.** There's no persistent creature to feed or evolve. The mood shown
  in each bubble comes directly from that reply's `<claude-say>` tag — it reflects what
  Claude just did, then it's gone.
- **Hook-driven, not a slash-command.** Everything runs through Claude Code hooks
  (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `Stop`). No Pro subscription required,
  no built-in Claude Code feature needed — just Bash scripts reacting to lifecycle events.
- **About the work, not the relationship.** Buddy gave you something to care for. claude-say
  gives Claude a face while it codes.

## Known Limitations

- The raw `<claude-say>` tag appears in the terminal scrollback before the
  bubble renders (Claude streams it before the Stop hook fires). Accepted for v1.
- Figures do not render in CI, `--print` mode, or non-interactive SSH sessions.
- Per-turn reminder adds ~20 tokens per turn; conditional injection is a v2 goal.

## Compatibility

Stacks naturally with the caveman plugin. Caveman compresses the main response;
claude-say bubbles the separately-written tag. No conflict. `caveman-lite`
recommended as a complementary install.

## Development

Run the test suite locally:

```bash
bash tests/test-data-layer.sh
bash tests/test-render.sh
bash tests/test-hooks.sh
```
