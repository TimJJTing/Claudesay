# claudesay

A Claude Code plugin that renders conversational replies as ASCII character speech bubbles in the terminal. Tool-use events show the character holding a relevant prop with a context-appropriate face expression. Inspired by cowsay. Just for fun.

```
⏺ Hey! claudesay is live and working.
  ⎿  Stop says:
      ╭──────────────────────────────────────╮
      │ Hey! claudesay is live and working.  │
      ╰───────┬──────────────────────────────╯
              │

           /\__/\
          ( ᵕ‿ᵕ  )
        ╭╭: ,,,, :╮╮
        ○ (      ) ○
          (╭....╮)
         (_)    (_)╰~~>

⏺ Skill(claudesay:claudesay)
  ⎿  PreToolUse:Skill says:
      ╭─────────╮
      │ Skill   │
      ╰───────┬─╯
              │

           /\__/\
          ( ≧▽≦  )
      🍳○═: ,,,, :╮╮
          (      ) ○
          (╭....╮)
         (_)    (_)╰~~>

⏺ Update(path/to/project/README.md)
  ⎿  PreToolUse:Edit says:
      ╭────────────────────────────╮
      │ Edit →                     │
      │ /path/to/project/README.md │
      ╰───────┬────────────────────╯
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

1. **Session starts →** A short instruction is injected into the conversation telling Claude to end chatty replies with a `<claudesay>` tag containing a mood and a brief summary of the turn.

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

- `turn on claudesay` / `enable claudesay` / `activate claudesay` / `start claudesay`
- `turn off claudesay` / `disable claudesay` / `hide claudesay` / `stop claudesay`
- `toggle claudesay`
- `claudesay status` / `is claudesay on?`

**Toggling never asks for Bash permission.** The `UserPromptSubmit` hook detects these phrases, flips the flag file itself, renders the confirmation bubble directly to the terminal, and suppresses Claude's turn with a `{"decision":"block"}` response. Claude isn't in the loop.

Loose phrasing ("flip claudesay on, would ya?") will fall through to Claude. In that case the skill tells Claude to point you at the recognized phrase — it will not attempt to toggle via a Bash call.

## Architecture

All behavior is in hooks (registered in `.claude-plugin/plugin.json`, implemented as external Bash scripts):

| Hook               | Script                           | Responsibility                                                                                          |
| ------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `SessionStart`     | `hooks/scripts/session-start.sh` | Injects the `<claudesay-protocol>` instruction as additional context when the flag is on.               |
| `UserPromptSubmit` | `hooks/scripts/prompt-submit.sh` | Handles toggle/status intents in-hook; emits the per-turn reminder on other prompts.                    |
| `PreToolUse`       | `hooks/scripts/pre-tool-use.sh`  | Renders the tool-holding character before each tool call.                                               |
| `Stop`             | `hooks/scripts/stop.sh`          | Extracts the `<claudesay>` tag from `last_assistant_message` and renders the speech bubble.             |

The skill at `skills/claudesay/SKILL.md` is documentation/fallback only — it does not run Bash.


## Character Customization

See [CHARACTER_CUSTOMIZATION.md](CHARACTER_CUSTOMIZATION.md) for detailed customization options including grid layout, dimension variables, face expressions, grid cells, prop templates, tool display config, and the preview script.

## FAQ

### Does it consume my tokens?

Yes, but not much. The plugin adds a small instruction to the conversation at session start (~120 tokens) plus a short per-turn reminder (~20 tokens). The `<claudesay>` tag Claude writes in its reply also costs a few output tokens per turn. In practice the overhead is negligible — well under 1 % of a typical conversation's total token usage.

The hooks themselves (rendering, toggling, reading the response) are pure Bash and do not make any API calls, so they cost zero tokens.

### Does the ASCII character art occupy context?

No. The rendered ASCII art (the speech bubble, the character figure, the grid) is produced entirely by the shell scripts and displayed to you via `systemMessage` — a transient notification that is **not** fed back into Claude's conversation context/history. Claude never sees the rendered output.

The only things that actually enter context are:

- The `<claudesay-protocol>` instruction injected at session start (~120 tokens).
- The short per-turn reminder hint (~20 tokens).
- The `<claudesay mood="…">…</claudesay>` tag that Claude writes in its own reply (a few output tokens).

The 87-line character definition, the grid rendering logic, and the final ASCII art all live purely in shell-land and cost zero context tokens.

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
- **Caveman mode (and similar terse plugins) drops pronouns.** [Caveman's](https://github.com/JuliusBrussee/caveman) `full`/`ultra` modes allow fragments, which causes pronouns to drop as emergent behavior. The claudesay protocol encourages active voice with natural pronoun use — caveman may counteract this. Use `/caveman lite` if you want caveman + claudesay together with more natural phrasing.
- **Stop-hook bubble is prefixed with "Stop says:" in the terminal scrollback.** Claude Code wraps any `systemMessage` returned by a Stop hook with this label — it is enforced by the runtime and cannot be suppressed via the hook response.

  **Why we stop here:** the natural alternative — writing the bubble directly to `/dev/tty` — was tried and abandoned. Claude Code's TUI redraws its dynamic region immediately after the Stop hook returns, clobbering anything written to `/dev/tty` (`hooks/scripts/stop.sh`, commit `313b617`). `systemMessage` lands in permanent scrollback instead and survives the redraw; the trade-off is the label.

  **If Claude Code ever exposes a hook output field that renders without a label** (or a `PostStop` moment after the TUI has settled), writing directly to `/dev/tty` would remove the label with no other changes needed — `lib/render.sh` already supports this path.

- **Stop-hook bubble reflects only the final assistant text block of a turn.** The Stop hook reads `.last_assistant_message` and grabs the last `<claudesay>` tag in it (`hooks/scripts/stop.sh`, `tail -1`). If Claude emits multiple conversational text messages in one turn (text → tool → text → tool → text), only the tag in the last block renders.

  **Why we stop here:** the injected protocol (`hooks/scripts/session-start.sh`) instructs Claude to emit a single tag *at the very end*, covering the whole turn in a few sentences. One well-written bubble usually describes the turn in full, making multi-bubble rendering redundant for the intended use case.

  **If you want to render a bubble per mid-turn text block**, parse `transcript_path` (available on Stop hook input JSON). The transcript is JSONL, one message per line. Assistant entries look like:

  ```json
  {"type":"assistant","message":{"role":"assistant","content":[
    {"type":"thinking", "...": "..."},
    {"type":"text","text":"<claudesay mood=\"...\">...</claudesay>"},
    {"type":"tool_use", "...": "..."}
  ]}}
  ```

  A turn spans **multiple** assistant entries (one per LLM call, split by tool boundaries). Each has its own `.message.content` array of blocks — `thinking`, `text`, `tool_use`. Steps:

  1. Walk JSONL backwards from EOF.
  2. Stop at the most recent `type:"user"` entry whose content is not a `tool_result` — that marks the start of the current turn.
  3. For each assistant entry after that boundary, extract `.message.content[] | select(.type=="text") | .text`.
  4. Run the existing `<claudesay>` regex over each block; render matches sequentially, or combine into one multi-line bubble.

  Sketch (`jq`):

  ```bash
  jq -r '
    select(.type=="assistant")
    | .message.content[]?
    | select(.type=="text")
    | .text
  ' "$TRANSCRIPT_PATH"
  ```

  Add guards for missing/malformed/large transcripts. The protocol would also need updating to permit (and describe) mid-turn tags. Not shipped — contributions welcome.

## Development

### Project Structure

```
claudesay/
├── .claude-plugin/                 # Plugin metadata and marketplace config
│   ├── plugin.json                 # Hook registrations, plugin manifest
│   └── marketplace.json            # Marketplace registration details
├── .claude/                        # Claude Code project settings
│   └── settings.local.json         # Local environment overrides
├── bin/                            # Utilities and preview tools
│   └── preview.sh                  # Character preview script for development
├── characters/                     # Character preset definitions
│   └── default.sh                  # Default character (cat) definition
├── hooks/                          # Lifecycle hook implementations
│   └── scripts/
│       ├── session-start.sh        # Injects protocol instruction when flag is on
│       ├── prompt-submit.sh        # Handles toggle intents; emits per-turn reminder
│       ├── pre-tool-use.sh         # Renders character with tool prop before each tool call
│       └── stop.sh                 # Extracts <claudesay> tag and renders speech bubble
├── lib/                            # Shared utility modules
│   ├── character.sh                # Character grid rendering logic
│   ├── moods.sh                    # Mood-to-expression mapping
│   ├── render.sh                   # Bubble and ASCII art rendering
│   └── tools.sh                    # Tool-to-emoji and mood mapping
├── skills/                         # Claude Code skill documentation
│   └── claudesay/
│       └── SKILL.md                # User-facing skill docs (fallback only)
├── tests/                          # Test suite
│   ├── run-all.sh                  # Test runner (runs all test-*.sh)
│   ├── assert.sh                   # Test assertion utilities
│   ├── test-character.sh           # Character grid tests
│   ├── test-data-layer.sh          # Tool/mood mapping tests
│   ├── test-hooks.sh               # Hook integration tests
│   └── test-render.sh              # Rendering logic tests
├── docs/                           # Design and specification docs
│   └── superpowers/specs/
│       └── 2026-04-17-claude-say-design.md  # Architecture and design spec
├── README.md                       # This file
└── CHARACTER_CUSTOMIZATION.md      # Character customization guide
```

### Key Files

**Plugin Configuration:**
- `plugin.json` — Registers the four hooks (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `Stop`) that drive all behavior.

**Hook Scripts:**
- `session-start.sh` — Injects the claudesay protocol instruction into the system prompt when the feature flag is active.
- `prompt-submit.sh` — Intercepts toggle commands (e.g., "turn on claudesay") before Claude sees them; blocks the prompt and flips the flag file directly. On other prompts, appends a reminder.
- `pre-tool-use.sh` — Looks up the tool name in `TOOL_INFO_*` variables and renders the character holding the corresponding emoji prop.
- `stop.sh` — Extracts the last `<claudesay mood="...">` tag from Claude's reply and renders the speech bubble with the appropriate face.

**Shared Modules (lib/):**
- `character.sh` — Grid layout engine; handles padding, cell positioning, and prop overlays.
- `moods.sh` — Maps mood names to face expressions; includes happy/excited alternation for visual variety.
- `render.sh` — Renders the speech bubble and combines it with the character figure.
- `tools.sh` — Maps Claude Code tools to emoji props, moods, and hand sides; sourced by hooks and preview.

**Testing:**
- `test-hooks.sh` — Integration tests for hook behavior (toggle detection, transcript parsing).
- `test-render.sh` — Unit tests for speech bubble and character rendering.
- `test-character.sh` — Grid cell alignment and padding tests.
- `test-data-layer.sh` — Tool/mood mapping validation.

### Running Tests

```bash
bash tests/run-all.sh
```

Run a single test file:

```bash
bash tests/test-render.sh
```
