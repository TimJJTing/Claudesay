# claudesay

claudesay is a Claude Code mod. It shows an ASCII character in the band above the prompt. After a conversational reply, the character says the main point of the reply in a speech bubble. Claude writes this line itself. While Claude uses a tool, the character holds a prop for that tool. The idea comes from cowsay. claudesay is for fun.

After a reply, the band shows this:

```
 ╭─────────────────────────────────────────────╮
 │ I updated the README and all tests pass. Do │
 │ you want a commit?                          │
 ╰───────┬─────────────────────────────────────╯
         │

      /\__/\
     ( ᵕ‿ᵕ  )
   ╭╭: ,,,, :╮╮
   ○ (      ) ○
     (╭....╮)
    (_)    (_)╰~~>
```

While a tool runs, the band shows the tool and a prop:

```
 ╭────────────────────────╮
 │ Edit → /repo/README.md │
 ╰───────┬────────────────╯
         │

      /\__/\
     ( -.-  )
 🔧○═: ,,,, :╮╮
     (      ) ○
     (╭....╮)
    (_)    (_)╰~~>
```

When Claude starts subagents, each subagent gets a character too. It walks into the band from the left and stands to the right of the main character. Its label is the task of the subagent. When the subagent finishes, it walks off to the right:

```
      /\__/\              /\__/\              /\__/\
     ( ._.  )            ( -.-  )            ( ^▽^  )
   ╭╭: ,,,, :╮╮      🔍○═: ,,,, :╮╮        ╭╭: ,,,, :═○🪄
   ○ (      ) ○          (      ) ○        ○ (      )
     (╭....╮)            (╭....╮)            (╭....╮)
    (_)    (_)╰~~>      (_)    (_)╰~~>      (_)    (_)╰~~>
                       Explore repo        Run the tests
```

Refer to [Subagents](#subagents).

There is one main character. Each new turn replaces its line. claudesay does not add rows to the transcript. When you scroll back, each reply has all of its information. Refer to [The history stays complete](#the-history-stays-complete).

## Requirements

- Claude Code 2.1.287 or later. Mods do not work in earlier versions.
- An interactive session in the terminal or in the desktop app.

claudesay does not need Bash or `jq`.

## Install

1. In a Claude Code session, type this command:

   ```
   /plugin install claudesay --marketplace TimJJTing/claudesay
   ```

2. When Claude Code asks `Add marketplace?`, type `y`.
3. Select a scope. The user scope is the default.

The mod starts immediately. You do not have to restart the session.

To install from a shell, use this command:

```bash
claude plugin install claudesay --marketplace TimJJTing/claudesay
```

In the desktop app, `/plugin` is not available. Do these steps:

1. Click **+** adjacent to the prompt box.
2. Click **Plugins**.
3. Click **Add marketplace** and type `TimJJTing/claudesay`.
4. Click **Add plugin**.

### Upgrade from version 2

Version 3 is a mod. It replaces the Bash hooks of version 2. Do these steps after the upgrade:

1. Remove the old flag files. Version 3 does not use them:

   ```bash
   rm -f .claude/.claudesay-active
   ```

2. If you have `~/.claude/claudesay/character.sh`, write the same values in `~/.claude/claudesay/character.json`. Refer to [CHARACTER_CUSTOMIZATION.md](CHARACTER_CUSTOMIZATION.md).
3. To turn the character off, set the mode to `off`. Refer to [Use](#use). Version 3 does not have the old phrases ("turn on claudesay") or a `/claudesay` command.
4. Version 2 drew a bubble under each reply. Version 3 shows one character above the prompt. Refer to [Known limitations](#known-limitations).

## Use

claudesay is on after the installation. To change the mode, do these steps:

1. Type `/config`.
2. Find the **claudesay** row **Mode**.
3. Select a mode:

| Mode | Result |
| --- | --- |
| `on` | The default. The character holds a prop while a tool runs. After a conversational reply, it says the main point of the reply. |
| `tools` | The character holds a prop while a tool runs. Subagents show. The mod does not add the protocol to the system prompt, so Claude writes no tags. |
| `off` | No character. The mod adds no hooks. Tags in older replies show as Claude wrote them. |

The mod loads again immediately with the new mode. You do not have to restart the session.

## How it works

claudesay is one TypeScript module, `hooks/claudesay.tsx`. Claude Code loads it as a mod. The module adds hooks to these events:

| Event | What the hook does |
| --- | --- |
| `session.start` | Reads `character.json`. |
| `prompt.compose` | Adds the `<claudesay-protocol>` section to the system prompt, in the `on` mode and only in a session on the terminal or the desktop app. |
| `turn.start` | Clears the last line. Lets the band get shorter again. Reads `character.json` again, so that a change shows on the next turn. Removes subagents that the engine no longer runs. |
| `agent.spawn` | Adds a character for each subagent that the main loop starts. The hook does not change or block a spawn. |
| `tool.call` | Records the tools that run now, for the main loop and for each subagent. Removes each tool when it stops. The hook does not change, block or approve a tool call. |
| `turn.complete` | Reads the tag at the end of the final answer. The tag becomes the line in the band. The mod remembers a key for the tag in its store. If an interrupt or an error cut the reply inside its tag, the mod remembers a key for that part too. At the end of a subagent's run, its character leaves. |
| `ui.render` `AssistantMessage` | Removes the tag of a final answer from the reply on the screen. While a turn runs, it also hides a tag that is not complete yet. After an interrupt or an error, it hides the part of the tag that was cut off. |
| `ui.render` `AbovePrompt` | Draws the character and the subagents in the band above the prompt. |

The main character shows one of these, in this order:

1. The newest tool that runs now, with its prop.
2. A thinking face, while Claude works and no tool runs.
3. The line about the last reply.
4. A happy face, while subagents still run.
5. Nothing.

The band always has one blank row on top. This row keeps the band apart from the transcript. During a turn, the band does not get shorter. When a bubble goes away between tool calls, blank rows keep the height of the band, so the prompt does not move. The next turn lets the band get shorter again.

### Subagents

Each subagent that the main loop starts gets a character. The characters move on a timer. The timer runs only while a character moves.

- **Start.** The character walks in from behind the main character to the next free slot. The oldest subagent stands nearest to the main character.
- **Work.** The character holds the prop of the tool that its subagent runs now, with the same props as the main character. Between tools, it shows a thinking face. Its label is the `description` of the Agent call.
- **Finish.** The character shows a happy face and walks off to the right. It walks in front of the other characters. Then the characters to its right move left into the free slot.
- **Failure.** When the run of a subagent is stopped, is refused or ends with an error, its character shows the error face for approximately one second. The main character looks upset, unless it holds a prop or says a line. Then the character walks off.
- **Too many.** When there is no slot for a character, the last slot shows `+3 more`. When a slot is free, the next character walks in. On a band narrower than approximately 38 columns, there is no slot, and the band shows `🤖×3` beside the main character.

Only the main character has a speech bubble. Nested subagents, workflow agents and teammates do not show. Refer to [Known limitations](#known-limitations).

If the mod does not get the end of a subagent's run, the next turn of the main loop asks the engine which agents run. A character whose agent stopped then walks off. It shows the error face only if the engine says that the agent failed or was killed.

If the engine stops the timer of the characters, the next draw of the band starts it again.

### The tag

The protocol tells Claude to write a tag at the end of a conversational reply:

```
<claudesay mood="happy">I fixed the test. Do you want a commit?</claudesay>
```

The available moods are `happy`, `excited`, `thinking`, `focused`, `upset` and `error`. The protocol tells Claude not to write the tag for code blocks, diffs, long technical output, replies with tools only and subagent reports.

The mod uses only a tag at the very end of a reply. A tag in other positions, for example an example tag in a code block or the word `<claudesay` in a sentence, stays visible as Claude wrote it.

The tag restates the final text block of the reply, the text immediately before the tag. If the turn did several things, the protocol tells Claude to say them in the final text block first.

### The history stays complete

The tag repeats the reply. The bubble shows only the newest line, so the reply must hold all of the information. Five rules make sure of this:

1. The protocol tells Claude to put every fact, warning and question in the reply text, and never in the tag only.
2. The mod examines the tag before it removes it. If the tag has a link, a domain name, a number, a path, a code span or a command word (for example `curl` or `sudo`) that the final text block does not have as a whole word, the mod does not remove the tag. The tag stays visible in the reply, and the band does not show it. The mod also keeps a tag that asks for consent, for example `[y/N]` or "type y", if the reply does not ask for it.
3. If the reply has no text other than the tag, the mod does not remove the tag.
4. If the tag has more than 300 characters, the mod does not remove the tag.
5. After a turn, the mod removes only the tag of the final answer. A tag in a text block before a tool call stays visible, because the band never shows it.

The check of rule 2 compares all scripts and forms of text. Before the comparison, the mod changes fullwidth letters and digits to plain letters and digits, changes ideographic dots to `.`, and removes invisible characters. It compares whole tokens, so `rm` does not match "format", and `5` does not match "15".

The bubble never asks for permission. Claude Code shows all permission prompts itself.

Before the mod draws text, it removes control characters and format characters, for example terminal escape sequences and bidirectional overrides. The mod cuts a line after 300 characters.

## Character customization

Refer to [CHARACTER_CUSTOMIZATION.md](CHARACTER_CUSTOMIZATION.md). It gives the grid layout, the faces, the cells, the prop templates and the tool props.

## FAQ

### Does claudesay use tokens?

In the `on` mode, yes, but not many. The protocol section is approximately 350 tokens. It is in the system prompt of each request. The protocol is after the cache boundary of the prompt, so the prompt cache usually holds it. Each tag that Claude writes is also a few output tokens.

The hooks do not call the API. In the `tools` mode and in the `off` mode, claudesay uses no tokens.

### Does claudesay send data on the network?

No. All drawing occurs in the mod.

### Does the transcript change?

The stored messages do not change. The mod changes only what the screen shows:

- The tag at the end of a reply does not show. The reply text shows completely.
- The band shows only the newest line. To read an earlier reply, scroll back to the reply.

### Does the ASCII art go into the context?

No. Claude does not see the art. Only the protocol section and the tags that Claude writes go into the context.

### Why is there no bubble after a reply?

Possible causes:

- **The reply is not conversational.** The protocol tells Claude not to write a tag for code, diffs and long technical output.
- **Claude did not write the tag.** The model does not always obey the protocol. This is a limitation of all prompt-based solutions.
- **The tag said more than the final text block.** Then the tag stays in the reply, and the band does not show it. Refer to [The history stays complete](#the-history-stays-complete).
- **The reply was only the tag.** Then the tag stays in the reply, and the band does not show it.
- **You interrupted the reply, or it ended with an error.** Such a reply gives no line. If it ended inside its tag, the screen hides that part of the tag.
- **The mode is `tools` or `off`.** Type `/config` and examine the claudesay mode.
- **A new turn started.** A new turn clears the line.
- **No band.** In `--print` mode, in an SDK host, in VS Code and on mobile, the band does not draw. The mod does not add the protocol there.

### How is claudesay different from Buddy?

Buddy was a virtual pet in earlier versions of Claude Code. You hatched it and you cared for it. claudesay is different:

- **Automatic.** The character shows when Claude works. You do not call it.
- **No state.** There is no creature that grows. Each line is about one reply. Then the next turn replaces it.
- **A mod.** It is a mod that anyone can install. It does not need a built-in Claude Code feature.
- **About the work.** The character shows what Claude does now.

## Known limitations

- **The band shows only the newest line.** There is no history of bubbles.

  **Why we stop here:** A bubble under each reply makes the transcript longer, and the replies already hold all the information. One character keeps the screen clean.

  **If you want a bubble under each reply**, draw it in the `ui.render` hook on `AssistantMessage`. That hook already parses the tag of each reply. Version 2 did this. Not shipped. Contributions are welcome.

- **The full transcript can show the raw tag.** The mod changes the display only. The stored message keeps the tag. Exported transcripts show the stored text. Tags from before the installation, or from a session with the `off` mode, also show, because the mod did not record them as final answers.

  **Why we stop here:** If the mod removes the tag from the stored message, Claude cannot see its earlier tags. Then Claude follows the protocol less well.

  **If you want to remove the tag from the stored message**, add a `session.append` hook. It can change the text blocks of each assistant row. Not shipped. Contributions are welcome.

- **The tag check does not examine the meaning.** The check stops links, numbers, paths, commands and consent prompts that only the tag has. It does not stop a tag that says "All tests pass" when the reply says that the tests are not done. A reply can quote a web page with instructions, and Claude can obey them in the tag. The check also reads the reply as Markdown source: a link target that the screen does not show, for example in `[docs](https://example.com)`, counts as part of the reply.

  **Why we stop here:** A check of the meaning of a sentence needs a second model, and that model can also be wrong.

  **What to do:** Do not act on the bubble alone. Read the reply.

  **If you want a stronger check**, extend `isGrounded` in `hooks/art.ts`. Contributions are welcome.

- **The band uses vertical space.** With the default character, the band is approximately 13 rows high when it shows a bubble. Subagents add one row for their labels. During a turn, the band keeps its tallest height, also when the bubble goes away.

  **Why we stop here:** A band that gets shorter and taller between tool calls moves the prompt up and down. A stable prompt is easier to read and to type in.

  **If you want a smaller band**, give a smaller character in `character.json`. Refer to [CHARACTER_CUSTOMIZATION.md](CHARACTER_CUSTOMIZATION.md). To let the band get shorter during a turn, change how the `AbovePrompt` hook in `hooks/claudesay.tsx` uses `tallest`. A compact mode with the face only is not shipped. Contributions are welcome.

- **The band shows one tool.** When Claude runs tools in parallel, the band shows the newest tool that still runs. This applies to each subagent character too.

  **Why we stop here:** A character has two hands and one bubble. More tools do not fit.

  **If you want to show more tools**, the `running` list in `hooks/claudesay.tsx` already holds all the tools that run now. Draw a count of the others in the bubble, for example `Edit → /repo/README.md (+2)`. A crewmate keeps only its newest tool in `look` and `toolId`. Not shipped. Contributions are welcome.

- **Subagent characters have no bubble.** A subagent character has a label, its task. It does not have a line about its work.

  **Why we stop here:** Bubbles side by side are too narrow to read. A subagent's report goes to Claude, not to you, so the protocol tells subagents not to write a tag.

  **If you want a bubble for subagents**, show the tool label of the subagent above its slot. `drawCrew` in `hooks/crew.ts` draws the crew, and each `Crewmate` keeps its current tool in `look`. Keep the label in the slot width, or one long label covers the next slot. Not shipped. Contributions are welcome.

- **Nested subagents, workflow agents and teammates do not show.** The band shows only the subagents that the main loop starts.

  **Why we stop here:** A workflow can start many agents, and nested agents are details of the work of one subagent. One character for each subagent of the main loop keeps the band readable. A teammate stops between its turns, and a teammate in its own pane runs no loop in this session, so the mod does not know when it ends.

  **If you want to show them**, change the filter in the `agent.spawn` hook in `hooks/claudesay.tsx`: it skips a spawn with `parentAgentId`, `workflow` or `isTeammate`. A nested character could stand behind its parent. A workflow agent's `turn.complete` can come from a remote agent with no local loop, so its character may not leave. Use the sweep in `sweepCrew` for those. For a teammate, keep the character in the `turn.complete` hook while `$.agent.list()` says `idle`. The engine can keep a pane teammate at `running` or `idle` after its pane closes, so the sweep needs another sign that it ended. Not shipped. Contributions are welcome.

- **Characters overlap when one walks past another.** A character that leaves walks in front of the characters to its right. For approximately one second, the art of the two characters overlaps.

  **Why we stop here:** The walk is short, and a path around the other characters needs more rows.

  **If you want a path around them**, change `targetOf` and `stepCrew` in `hooks/crew.ts`. `drawCrew` draws a character that leaves in front of the others. Not shipped. Contributions are welcome.

- **The band is not available on all surfaces.** Claude Code draws `AbovePrompt` on the terminal and on the desktop app only. A session on VS Code or mobile does not get the protocol and does not show the character.

- **Emoji width changes with the font.** The mod counts each emoji as two columns. This includes emoji sequences, for example flags, skin tones and joined emoji. Some terminal fonts draw an emoji in one column. Then the right side of a prop row moves by one column. To prevent this, use single-width symbols as props. Refer to [CHARACTER_CUSTOMIZATION.md](CHARACTER_CUSTOMIZATION.md).

- **Terse plugins can remove pronouns.** The `full` and `ultra` modes of [Caveman](https://github.com/JuliusBrussee/caveman) let Claude write fragments. Then Claude can drop pronouns from the tag. Use `/caveman lite` if you use Caveman with claudesay.

- **Subagents can see the protocol.** The protocol tells Claude not to write the tag in subagent reports. If a subagent writes a tag, the band does not show it.

## Development

### Project structure

```
claudesay/
├── .claude-plugin/
│   ├── plugin.json           # Plugin manifest. Names the state contract and the mode option.
│   ├── marketplace.json      # Makes this repository a marketplace.
│   ├── icon.png              # Plugin icon: the default character, 1024 × 1024.
│   └── types/                # Claude Code writes this folder. Git ignores it.
├── hooks/
│   ├── hooks.json            # Names the hooks module.
│   ├── claudesay.tsx         # The hooks module: events, state, tag removal and the band.
│   ├── art.ts                # Pure functions: character, bubble, tag parse, tag check, tool props.
│   └── crew.ts               # Pure functions: subagent slots, the steps of the walk, the crew drawing.
├── types/
│   └── index.d.ts            # State contract and shared types.
├── tests/
│   ├── art.test.ts           # Unit tests for art.ts.
│   ├── crew.test.ts          # Unit tests for crew.ts.
│   └── claudesay.test.tsx    # Tests for the hooks against the Claude Code engine.
├── tsconfig.json             # Type-check configuration.
├── README.md
└── CHARACTER_CUSTOMIZATION.md
```

### Load the mod from your checkout

1. Uninstall the marketplace version, if you installed it:

   ```bash
   claude plugin uninstall claudesay
   ```

2. Start a session that loads the mod from the folder:

   ```bash
   claude --plugin-dir .
   ```

Claude Code watches the folder. When you save a file, the mod loads again. You do not have to restart the session. To see hook errors, add `--debug`.

### Check the mod

Do these checks before you push a change:

```bash
claude plugin validate .
claude plugin test .
npx -p typescript@5.6.3 tsc -p .
```

- `claude plugin validate` reads the manifest and the module. It shows the hooks, the calls and the state keys.
- `claude plugin test` runs the `*.test.ts` and `*.test.tsx` files against the Claude Code engine.
- `tsc` checks the types. Load the mod one time before you run it, because `tsc` needs the types that Claude Code writes to `.claude-plugin/types/`.

## License

MIT
