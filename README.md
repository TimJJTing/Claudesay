# claude-say

A Claude Code plugin that renders conversational replies as ASCII figure speech
bubbles in the terminal. Tool-use events show the figure holding a relevant
prop with a context-appropriate face expression.

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
CHAR_BOTTOM="    ||   ||
   (_)  (_)"
```

## Architecture

All behavior is in hooks (declared inline in `.claude-plugin/plugin.json`):

| Hook | Script | Responsibility |
| --- | --- | --- |
| `SessionStart` | `hooks/scripts/session-start.sh` | Injects the `<claude-say-protocol>` system message when the flag is on. |
| `UserPromptSubmit` | `hooks/scripts/prompt-submit.sh` | Handles toggle/status intents in-hook; emits the per-turn reminder on other prompts. |
| `PreToolUse` | `hooks/scripts/pre-tool-use.sh` | Renders the tool-holding figure before each tool call. |
| `Stop` | `hooks/scripts/stop.sh` | Parses the `<claude-say>` tag from the final assistant message and renders the speech bubble. |

The skill at `skills/claude-say/SKILL.md` is documentation/fallback only —
it does not run Bash.

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
