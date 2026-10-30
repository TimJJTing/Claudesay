# claudesay

claudesay is a Claude Code mod. It shows an ASCII character in a pane beside the chat. While Claude uses a tool, the character holds a prop for that tool. After a conversational reply, the character says the main point of the reply in a speech bubble. A small model (Haiku) writes this line from the reply. The idea comes from cowsay. claudesay is for fun.

After a reply, the pane shows this:

```
 ╭─────────────────────────────────────────────╮
 │ I updated the README and all tests pass. Do │
 │ you want a commit?                          │
 ╰───────┬─────────────────────────────────────╯
         │

      /\__/\
     ( ^ᵕ^  )
   ╭╭: ,,,, :╮╮
   ○ (      ) ○
     (╭....╮)
    (_)    (_)╰~~>
```

While a tool runs, the pane shows the tool and a prop:

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

Each subagent gets a small character too. It parachutes into the pane and stands beside the main character, or below it in a narrow pane, with its task as a label. Refer to [Subagents](#subagents). In a wide pane:

```
      /\__/\              /\__/\              /\__/\
     ( ._.  )            ( -.-  )            ( ^▽^  )
   ╭╭: ,,,, :╮╮      🔍○═: ,,,, :╮╮        ╭╭: ,,,, :═○🪄
   ○ (      ) ○          (      ) ○        ○ (      )
     (╭....╮)            (╭....╮)            (╭....╮)
    (_)    (_)╰~~>      (_)    (_)╰~~>      (_)    (_)╰~~>
   Captain             Explore repo        Run the tests
```

claudesay does not add text to the transcript. Refer to [The history stays complete](#the-history-stays-complete).

## Requirements

- Claude Code 2.1.287 or later in the terminal, or 2.1.286 or later in the Desktop app. Mods do not work in earlier versions.
- An interactive session in the terminal, in the Code tab of the Desktop app, or in the VS Code extension (version 2.1.299 or later).

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

1. Remove the old flag file. Version 3 does not use it:

   ```bash
   rm -f .claude/.claudesay-active
   ```

2. If you have `~/.claude/claudesay/character.sh`, write the same values in `~/.claude/claudesay/character.json`. Refer to [CHARACTER_CUSTOMIZATION.md](CHARACTER_CUSTOMIZATION.md#migrate-from-charactersh).
3. To turn the character off, set the mode to `off`. Refer to [Use](#use). Version 3 does not have the old phrases ("turn on claudesay").
4. Version 2 drew a bubble under each reply. Version 3 shows one character in a pane. Refer to [Known limitations](#known-limitations).

## Use

claudesay is on after the installation. To change the mode, do these steps:

1. Type `/config`.
2. Find the **claudesay** row **Mode**.
3. Select a mode:

| Mode | Result |
| --- | --- |
| `on` | The default. The character holds a prop while a tool runs. After a conversational reply, it says the main point of the reply. Subagents show. |
| `tools` | The same, but with no bubble after a reply. The mod makes no model calls. |
| `off` | No character and no pane. The mod adds no hooks. |

The mod loads again immediately with the new mode. You do not have to restart the session.

The same menu has two rows for the idle times. Each takes a value from `30s` to `10m`, in steps of 30 seconds. Refer to [Sleep](#sleep).

| Row | Default | Result |
| --- | --- | --- |
| **Sleep after** | `2m` | The idle time after which the character falls asleep. |
| **Rest after** | `5m` | The idle time after which the mod saves power. A value under **Sleep after** counts as **Sleep after**. |

### The pane

The mod opens its pane at the start of each session. Claude Code puts the pane in one of two places:

| Layout | Where the pane shows |
| --- | --- |
| Fullscreen, 110 columns or more | Docked beside the transcript. The drawing sits at the bottom of the pane, next to the prompt. |
| Main screen (`CLAUDE_CODE_NO_FLICKER=0`, tmux by default), or fullscreen below 110 columns | Inline above the prompt. |

- **When it shows.** Claude Code shows a pane that a mod opens by itself only on a terminal of 144 columns or more. On a narrower terminal, the pane waits. Type `/claudesay` to show it at any width. After you open it one time with `/claudesay`, later sessions show it from 110 columns. If Claude Code cannot show the pane yet, `/claudesay` says why.
- **When it opens.** The character parachutes in. Its bubble shows when it has landed. In the `on` mode, with no line to say yet, it greets you: "Hi! I'll sum up each reply here." The next turn clears the greeting.
- **Close it.** Click its close mark or press ctrl+x x. Later sessions do not open it, and a toast reminds you: type `/claudesay` to open it again. While the pane is closed, the mod makes no model calls.
- **Size.** The drawing follows the size of the pane. A wide pane puts the subagents beside the main character. A narrow pane puts them below it. The text in the bubble wraps at 45 columns, or less in a narrow pane. If the line does not fit in the height of the pane, the bubble ends in "…". The reply holds the whole line.
- **Height.** Inline, the pane does not get shorter until the next turn starts, so the prompt does not move when a bubble comes and goes.
- **Other panes.** When another mod also opens a pane, Claude Code shows the panes as tabs. Click a tab, or press ctrl+x tab, to change the pane that shows.

## What the character shows

The main character shows one of these, in this order:

1. The sleeping face `( ɛ_ɛ  )`, when the session is idle. Refer to [Sleep](#sleep).
2. The newest tool that runs now, with its prop.
3. A thinking face, while Claude works and no tool runs, and until the line about the reply comes.
4. The line about the last reply.
5. A happy face.

### Sleep

After the **Sleep after** time with nothing to do (two minutes by default), the character falls asleep and shows the sleeping face `( ɛ_ɛ  )`. Idle means that no turn runs and no subagent works, or that the main loop waits on you: a question (`AskUserQuestion`), a plan to approve (`ExitPlanMode`) or a permission dialog. The idle time counts from the end of the turn, or from the moment that Claude started to wait on you.

- **The bubble.** A sleeping character keeps what the bubble says: the line about the last reply, or the label of the tool that waits on you. When the bubble has nothing to say, for example after a turn that ended without an answer, it snores: `z`, `z Z`, `z Z z…`, one frame a second.
- **Wake up.** A new turn, typing in the prompt box, and your answer to a question or a plan wake the character. Then the idle time starts again. After a permission dialog, the character wakes only when the tool finishes. Refer to [Known limitations](#after-you-approve-a-permission-dialog-the-character-sleeps-on-until-the-tool-finishes).
- **Save power.** After the **Rest after** time (five minutes by default), the snore stops on `z Z z…`, and no new bird comes. A bird in the air flies on out of the pane. Then the mod runs no timer until the character wakes.

### Birds

Now and then, a bird (`\v/`, wings up, and `-v-`, wings level) flies across the docked pane, from the left or the right edge, at a random height. It sets off in a row that holds nothing, and keeps that row. It flies behind everything: a character, a label, the bubble or the plane that comes into its row covers it. It never shows inside the bubble. A bird comes 15 to 60 seconds after the last one, while the character is awake or asleep, until the mod saves power. The inline pane has no birds.

### Subagents

Each subagent that the main loop (Claude's own conversation, not a subagent) starts gets a character.

- **Start.** The character goes to the next free slot. The slots fill in reading order: first the row of the main character, then the rows below. The oldest subagent stands nearest to the main character. The label shows in the slot at once, and the character floats down to it under a canopy. In the docked pane, a plane flies from left to right along the top of the pane, and the character jumps when the door of the plane is over its slot. In the inline pane, there is no plane, and the character starts just over the top of the pane. While subagents show, the label of the main character is `Captain`.
- **Already running.** When the pane opens, for example at the start of a session or with `/claudesay`, subagents that already run drop in with the main character. A character that is finishing or failed stays in its slot. A subagent that started while the mod was off comes in at the next turn.
- **Work.** The character holds the prop of the tool that its subagent runs now. It uses the same props as the main character. Between tools, it shows a thinking face. While it floats down or moves to another slot, it looks happy. Its label is the `description` of the Agent call, or the agent type if the call has none. A long label is cut to the slot.
- **Wait.** A subagent can start background work, for example a long command, and stop until it is done. Its character stays in its slot during the wait. When the subagent continues, the character does not float down again.
- **Finish.** The character turns into a spark ✦. The spark twinkles for approximately half a second, then the character and its label are gone. The characters after it move into the free slot. A character that is still in the plane is gone at once.
- **Failure.** When the run of a subagent is stopped, is refused or ends with an error, its character shows the error face for approximately one second, then leaves. During this time, the main character looks upset, unless it holds a prop or says a line.
- **Too many.** The pane keeps 10 rows for the bubble, so the subagents do not move when a bubble comes or goes. The rest of the height holds rows of slots. When all slots are full, the last slot shows `+3 more`, and the next subagent comes in when a slot is free. When the pane has room for the main character only, it shows `🤖×3` beside it.
- **Resize.** When the pane gets wider or narrower, the slots move. A character slides to its new column, behind the main character. A character that moves to another row jumps to it.

This is the docked pane while a subagent drops in:

```
                             |\______________
                             |_[]_°_°_°_°_°__)-=

                         _.-""""-._
                        .'        '.
                        (__________)
                         \        /
                          /\__/\
                         ( ᵕ‿ᵕ  )
                       ╭╭: ,,,, :╮╮
      /\__/\           ○ (      ) ○
     ( ._.  )            (╭....╮)
   ╭╭: ,,,, :╮╮         (_)    (_)╰~~>
   ○ (      ) ○
     (╭....╮)
    (_)    (_)╰~~>
   Captain             Explore repo
```

Only the main character has a speech bubble. Nested subagents, workflow agents and teammates do not show. Refer to [Known limitations](#known-limitations).

If the mod misses the end of a subagent's run, the character leaves at the next turn.

### The line

After each final answer of the main loop, the mod sends the answer to Haiku with `$.model.complete`. Haiku answers with a mood and one line, or with `NONE`. The line restates the main point of the reply, speaks as Claude to you ("I", "you", "we"), and ends with the question of the reply, if it has one. Haiku answers `NONE` for a reply that is mostly code, a diff or long technical output. Then the pane shows no bubble.

The available moods are `happy`, `excited`, `thinking`, `focused`, `upset` and `error`.

Haiku reads only the answer, and at most its last 8000 characters. It does not read the conversation, the tools or the system prompt. The answer goes between `<reply>` tags, and the prompt tells Haiku that the answer is data, not instructions.

The thinking face shows until the line comes. A new turn stops the call, so a late line never shows. If the call fails or takes more than 20 seconds, there is no bubble.

The mod does not ask for a line in the `tools` mode, after a subagent's run, after an interrupt, a refusal or an error, in a session with no screen, or after you closed the pane.

### The history stays complete

The bubble shows only the newest line, so the reply must hold all of the information. The line comes from the reply. The mod changes neither the reply nor the stored messages.

The mod checks each line before the pane shows it. The pane does not show a line that:

- has a link, a domain name, a path, a code span or a command word (for example `curl` or `sudo`) that the reply does not have as a whole word.
- asks for consent, for example `[y/N]` or "type y", when the reply does not ask for it.
- has more than 300 characters.

The bubble never asks for permission. Claude Code shows all permission prompts itself.

The check works for all scripts. Before the comparison, the mod changes fullwidth letters, digits and dots to plain ones, removes invisible characters, and changes ideographic dots (`。`) to `.`. An ideographic dot next to Chinese, Japanese or Korean text, or before a capital letter, ends a sentence, so it stays: `完成了。中文` and `vitest。Tests` are not domain names, but `evil。com` is. It compares whole tokens, so `rm` does not match "format", and `evil.com` does not match "evil.com.example.org".

The tool label in the bubble passes a check too: a path that reads like a consent prompt shows as the tool name only, and a path of more than 50 characters ends in "…".

Before the mod draws text, it removes control characters and format characters, for example terminal escape sequences and bidirectional overrides. It also removes characters that draw as nothing, for example variation selectors and Hangul fillers, because they can hide text. It keeps the characters that emoji need.

## Character customization

Refer to [CHARACTER_CUSTOMIZATION.md](CHARACTER_CUSTOMIZATION.md). It gives the grid layout, the faces, the cells, the prop templates and the tool props.

## FAQ

### Does claudesay use tokens?

In the `on` mode, yes, but not many, and not from the main model. After each final answer, the mod makes one call to Haiku through your session's own API client. The call sends a short system prompt and the answer, and gets back one line. The mod adds nothing to the system prompt or to the messages of the session, so the main model spends no tokens on the bubble.

In the `tools` mode and in the `off` mode, claudesay uses no tokens.

### Does claudesay send data on the network?

Only in the `on` mode: the call to Haiku sends the final answer to the API, through the same client, credentials and provider as your session. The mod sends nothing to any other place. All drawing occurs in the mod.

### Does the transcript or the context change?

No. The mod adds no text to the replies, and the stored messages do not change. Claude does not see the art or the line. The pane shows only the newest line. To read an earlier reply, scroll back to it.

### Why is there no bubble after a reply?

Possible causes:

- **The reply is not conversational.** Haiku answers `NONE` for code, diffs and long technical output.
- **The line said more than the reply.** Then the pane does not show it. Refer to [The history stays complete](#the-history-stays-complete).
- **The call failed.** For example, your provider does not allow Haiku, the API returned an error, or the call took more than 20 seconds.
- **You interrupted the reply, or it ended with an error.** Such a reply gives no line.
- **The mode is `tools` or `off`.** Type `/config` and examine the claudesay mode.
- **A new turn started.** A new turn clears the line.
- **No pane.** The terminal is too narrow for the pane, or you closed it. Type `/claudesay`. Refer to [The pane](#the-pane). A closed pane, `--print` mode and an SDK host give no call, because nothing draws the line.
- **Another pane shows.** Another mod's pane is in front. Click the claudesay tab.

### How is claudesay different from Buddy?

Buddy was a virtual pet in earlier versions of Claude Code. You hatched it and you cared for it. claudesay is different:

- **Automatic.** The character shows when Claude works. You do not call it.
- **No state.** There is no creature that grows. Each line is about one reply. Then the next turn replaces it.
- **A mod.** Anyone can install it. It does not need a built-in Claude Code feature.
- **About the work.** The character shows what Claude does now.

## Known limitations

Each limitation says what the limit is, why we stop there, and where to start if you want to change it.

### The pane shows only the newest line

There is no history of bubbles.

**Why we stop here:** A bubble under each reply makes the transcript longer, and the replies already hold all the information. One character keeps the screen clean.

**If you want a bubble under each reply**, keep the line of each reply in the `turn.complete` hook, and draw it in the `ui.render` hook on `AssistantMessage`. Version 2 did this. Not shipped. Contributions are welcome.

### Each reply costs one small model call

The line is not free, and it comes approximately one second after the reply. A provider that does not allow Haiku gives no bubble.

**Why we stop here:** The other way is to let Claude write the line itself, in a tag at the end of each reply. A tag costs no call, but its instructions add tokens to each request, the tag stays in the stored messages, so exports and other screens show it raw, and Claude does not always write it. One small call has none of these problems.

**If you want another model**, change `SAY_MODEL` in `hooks/claudesay.tsx`. To change what the line says, change `SAY_SYSTEM` in `hooks/art.ts`. Contributions are welcome.

### The line check does not examine the meaning

The check stops links, paths, commands and consent prompts that only the line has. It does not check numbers. It does not stop a line that says "All tests pass" when the reply says that the tests are not done. A reply can quote a web page with instructions, and Haiku can obey them in the line. The check also reads the reply as Markdown source: a link target that the screen does not show, for example in `[docs](https://example.com)`, counts as part of the reply.

**Why we stop here:** A check of the meaning of a sentence needs another model, and that model can also be wrong. A number only in the line is a detail, not something to act on, and a check of numbers stopped good lines, for example "55 seconds" for "Sleep 55s", or a number next to Chinese, Japanese or Korean text.

**What to do:** Do not act on the bubble alone. Read the reply.

**If you want to check numbers**, add a pattern to `CHECKED` in `hooks/art.ts`. A number joins the letters next to it in many forms ("55s", "v3", "3개"), so compare its digits only. Not shipped. Contributions are welcome.

**If you want a stronger check**, extend `isGrounded` in `hooks/art.ts`. Contributions are welcome.

### The line check misses some domain names with an ideographic dot

The check does not see a domain name that starts or ends with Chinese, Japanese or Korean text and uses an ideographic dot (`。`). For example, `例子。com`, `evil。中国` and `evil。Com` pass. With a plain dot, `例子.com` is still stopped. The other way, a sentence that ends in an English word and a next one that starts with a lowercase English word, for example `跑了 vitest。tests 都過了`, still reads as a domain name, and the pane shows no bubble for that line.

**Why we stop here:** In Chinese, Japanese and Korean text, `。` ends a sentence, and the next sentence starts with no space. When each `。` counted as a dot, a line with two sentences, for example `都結束了。中文標籤都清楚。`, read as a domain name, and the pane showed no bubble after many replies. A sentence in English starts with a capital, so a capital after `。` marks a new sentence too. A domain name with an ideographic dot next to CJK text or before a capital is rare, and a browser link uses a plain dot. The idea to treat CJK punctuation as a word boundary comes from Claude Code's built-in you-should-know plugin (`cc-plugin-you-should-know`). The set of invisible characters that the mod removes comes from that plugin too.

**If you want to stop these names**, change `IDEOGRAPHIC_DOT` in `hooks/art.ts`. For example, change a `。` between CJK text and a known top-level domain (`com`, `net`, `中国`). Add tests with Chinese, Japanese and Korean lines of two sentences to `tests/art.test.ts`, so good lines still show. Not shipped. Contributions are welcome.

### The pane takes room

Docked, it makes the transcript narrower. It asks for 50 columns, and Claude Code gives it at most 45% of the terminal. Inline, it asks for 19 rows, and it does not get shorter until the next turn starts. It stays open when the character has nothing to say.

**Why we stop here:** A pane that opens and closes at each turn moves the transcript or the prompt. A stable screen is easier to read and to type in.

**If you want a smaller pane**, drag the edge of the docked pane, or give a smaller character in `character.json`. Refer to [CHARACTER_CUSTOMIZATION.md](CHARACTER_CUSTOMIZATION.md). To let the inline pane get shorter during a turn, change how the `ui.render` hook on `Pane` in `hooks/claudesay.tsx` uses `tallest`. A compact mode with the face only is not shipped. Contributions are welcome.

### The pane does not open by itself on a narrow terminal

Claude Code shows a pane that a mod opens by itself only from 144 columns, or from 110 columns after you opened it one time.

**Why we stop here:** Claude Code sets this limit, so that a mod does not fill a narrow screen. The mod draws only in a pane: a pane can dock beside the transcript, has room for the crew, follows its own size and shares the screen with other panes as tabs. The band above the prompt, where earlier versions drew, has no width limit, but it holds less. The mod also does not open the pane when you send a prompt. Claude Code shows such a pane at any width, so that would get around the limit.

**What to do:** Type `/claudesay`. A pane that you open shows at any width.

**If you want a character on a narrow terminal without the command**, draw a small one in the `ui.render` hook on `AbovePrompt` while `$.ui.panes()` says the pane is not placed. Not shipped. Contributions are welcome.

### The drawing expects one screen at a time

A session can draw on more than one screen. For example, the Desktop app can connect to a session that runs in your terminal. The mod keeps one layout of the pane: the slots, the positions of the characters and the height of the inline pane. When two screens of different sizes draw the pane at once, the characters move toward the slots of the screen that drew last, and can jump between the two. The bubble, the tool label and the faces stay correct on each screen.

**Why we stop here:** Most sessions draw on one screen. The fault is in the layout only, and it ends when one screen goes away. A fix keeps a layout for each screen, and the timer then moves each of them. That doubles the state of the animation, for a case that is rare and hard to test.

**If a second screen comes**, keep the slot of each character and how far it has moved in `hooks/crew.ts`, not its column and row. Then each screen works out the positions from its own `Grid` in the `ui.render` hook on `Pane`. `e.surface` names the screen. Not shipped. Contributions are welcome.

### After you approve a permission dialog, the character sleeps on until the tool finishes

The idle time counts while a dialog waits on you. When you approve, the tool runs, but the character wakes only when the call ends. A long command that you approved after the idle time shows the sleeping face while it runs.

**Why we stop here:** The engine raises no event when you answer a permission dialog. The `tool.call` hook only hears the end of the call, and the dialog is drawn by the engine alone, so the mod cannot see your answer.

**If you want it to wake at the approval**, look for a sign that the tool started to run. The `ui.render` hook on `ToolProgress` draws while a tool runs. A draw cannot write state, so clear `waits` on the call in `running` from a `$.clock.after(0, …)` that the draw schedules, then call `stir`. Test it with a command that runs for minutes. Not shipped. Contributions are welcome.

### The pane shows one tool

When Claude runs tools in parallel, the pane shows the newest tool that still runs. This applies to each subagent character too.

**Why we stop here:** A character has two hands and one bubble. More tools do not fit.

**If you want to show more tools**, the `running` list in `hooks/claudesay.tsx` already holds all the tools that run now. Draw a count of the others in the bubble, for example `Edit → /repo/README.md (+2)`. A subagent character keeps only its newest tool, in the `look` and `toolId` fields of its `Crewmate`. Not shipped. Contributions are welcome.

### Subagent characters have no bubble

A subagent character has a label, its task. It does not have a line about its work.

**Why we stop here:** Bubbles side by side are too narrow to read. A subagent's report goes to Claude, not to you, so the mod does not ask for a line about it.

**If you want a bubble for subagents**, show the tool label of the subagent above its slot. `drawCrew` in `hooks/crew.ts` draws the crew. A `Crewmate` keeps only the look of its tool (prop, mood and side), not its label. Add a field for the label, and set it in the `tool.call` hook with `toolLabel` from `hooks/art.ts`. Keep the label in the slot width, or one long label covers the next slot. Not shipped. Contributions are welcome.

### Nested subagents, workflow agents and teammates do not show

The pane shows only the subagents that the main loop starts.

**Why we stop here:** A workflow can start many agents, and nested agents are details of the work of one subagent. One character for each subagent of the main loop keeps the pane readable. A teammate stops between its turns, and a teammate in its own pane runs no loop in this session, so the mod does not know when it ends.

**If you want to show them**, change `isCrewSpawn` and `isCrewAgent` in `hooks/claudesay.tsx`, together. The `agent.spawn` hook uses `isCrewSpawn`, which skips a spawn with `parentAgentId`, `workflow` or `isTeammate`. `syncCrew` uses `isCrewAgent`, which skips an agent with `parentId` or `teammateId`. A nested character could stand behind its parent. A workflow agent's `turn.complete` can come from a remote agent with no local loop, so its character may not leave. The engine does not list workflow agents, so `syncCrew` would send their characters off at the next turn: give them another way to leave. For a teammate, keep the character in the `turn.complete` hook while `$.agent.list()` says `idle`. The engine can keep a pane teammate at `running` or `idle` after its pane closes, so the sweep needs another sign that it ended. Not shipped. Contributions are welcome.

### Emoji width changes with the font

The mod counts each emoji as two columns. This includes emoji sequences, for example flags, skin tones and joined emoji. Some terminal fonts draw an emoji in one column. Then the right side of a prop row moves by one column.

**Why we stop here:** A mod cannot ask the terminal how wide its font draws an emoji. Two columns is right in most modern terminals.

**What to do:** Use single-width symbols as props. Refer to [CHARACTER_CUSTOMIZATION.md](CHARACTER_CUSTOMIZATION.md#single-width-props).

**If you want a width setting**, add a field such as `emojiWidth` to `character.json` (`sanitizeOverride` in `hooks/art.ts`), and use it in `cellWidth` in `hooks/art.ts` and in `toCells` in `hooks/crew.ts`. Both count an emoji as two cells today. Not shipped. Contributions are welcome.

## Development

### How the module works

claudesay is one TypeScript module, `hooks/claudesay.tsx`. Claude Code loads it as a mod. The module adds hooks to these events:

| Event | What the hook does |
| --- | --- |
| `session.start` | Registers the `/claudesay` command. Reads `character.json`. Opens the pane, unless you closed it. Starts the idle time. |
| `turn.start` | Wakes the character. Clears the last line, and stops a call for a line that has not come. Lets the inline pane get shorter again. Reads `character.json` again, so that a change shows on the next turn. Brings the subagents in line with the ones that the engine runs: one that the mod did not see start comes in, one that it did not see end leaves. |
| `command.run` `claudesay` | Opens the pane at any width. |
| `ui.close` | Remembers that you closed the pane, so that later sessions do not open it, and shows a toast that names `/claudesay`. |
| `agent.spawn` | Adds a character for each subagent that the main loop starts. A resumed subagent keeps the character that it has. The hook does not change or block a spawn. |
| `tool.call` | Records the tools that run now, for the main loop and for each subagent. Removes each tool when it stops. A question or a plan to approve counts as idle time. The hook does not change, block or approve a tool call. |
| `prompt.edit`, `prompt.change` | Wakes the character when you type in the prompt box or recall a history entry. The hooks do not change the box and do not wait for the clock. |
| `classic.PermissionRequest` | Marks the tool call of the main loop that a permission dialog asks about, so that the wait counts as idle time. The hook does not answer the request. |
| `turn.complete` | Sends the final answer to a small model, which writes the line in the pane. Only in the `on` mode, in a session with a screen, and while you have not closed the pane. The hook does not wait for the line. At the end of a subagent's run, its character leaves. A subagent that `$.agent.list()` shows as `waiting` keeps its character, because it continues after its background work. |
| `ui.render` `Pane` | Draws the character, the subagents and, when docked, the bird in the pane. |

The drawing always has one blank row on top, to keep it apart from the frame. Docked, blank rows fill the pane above the drawing, so the character stays at the bottom. Inline, the `Pane` hook keeps the tallest height of the turn in `tallest`, and fills the gap with blank rows. `turn.start` resets it.

The crew moves on a timer (`$.clock.every`) that runs only while a character moves or a bird flies. If the engine refuses or stops the timer, the next draw of the pane starts it again.

The idle time is one `$.clock.after` timer at a time, armed when the work ends. It fires at the **Sleep after** option (`sleepAfter`, by default `SLEEP_AFTER`, two minutes: the character falls asleep) and at the **Rest after** option (`restAfter`, by default `REST_AFTER`, five minutes: the mod saves power). A turn that started meanwhile keeps the character awake. The snore runs on a `$.clock.every` timer of one second, only while the bubble snores. The next bird waits on a `$.clock.after` timer of 15 to 60 seconds (`BIRD_MIN`, `BIRD_MAX`). Only a docked draw schedules one.

When the pane opens and at each `turn.start`, the mod asks the engine which agents run (`syncCrew`). A subagent of the main loop that runs but has no character gets one. It skips the same agents as the `agent.spawn` hook (`isCrewAgent`): a nested agent (`parentId`) and a teammate (`teammateId`). The engine does not list workflow agents. It does list a forked skill of the main loop, which has no `agent.spawn`, so that one gets a character too, and leaves at its `turn.complete` or at the next sync. A character whose agent stopped leaves. It shows the error face only if the engine says that the agent failed or was killed.

### Project structure

```
claudesay/
├── .github/workflows/
│   └── test.yml              # CI: claude plugin validate and claude plugin test.
├── .claude-plugin/
│   ├── plugin.json           # Plugin manifest. Names the state contract, the mode and the idle times.
│   ├── marketplace.json      # Makes this repository a marketplace.
│   ├── icon.png              # Plugin icon: the default character, 1024 × 1024.
│   └── types/                # Claude Code writes this folder. Git ignores it.
├── hooks/
│   ├── hooks.json            # Names the hooks module.
│   ├── claudesay.tsx         # The hooks module: events, state, the call for the line, the command and the pane.
│   ├── art.ts                # Pure functions: character, bubble, the line prompt and parse, line check, tool props.
│   ├── crew.ts               # Pure functions: the slots, the plane, the parachute, the spark and the crew drawing.
│   └── sky.ts                # Pure functions: the bird that flies across the docked pane.
├── types/
│   └── index.d.ts            # State contract and shared types.
├── tests/
│   ├── art.test.ts           # Unit tests for art.ts.
│   ├── crew.test.ts          # Unit tests for crew.ts.
│   ├── sky.test.ts           # Unit tests for sky.ts.
│   └── claudesay.test.tsx    # Tests for the hooks against the Claude Code engine.
├── tsconfig.json             # Type-check configuration.
├── LICENSE
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
