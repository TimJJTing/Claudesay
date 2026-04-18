---
name: claude-say-toggle
version: 2.0.0
description: >
  Triggers when the user asks to "turn on claude-say", "turn off claude-say",
  "enable/disable the figure", "toggle claude-say", "claude-say status",
  "show/hide the figure", "enable ascii companion". Do not trigger for
  unrelated uses of "figure" (e.g. matplotlib charts) or generic "turn off"
  requests that do not mention claude-say.
---

# claude-say Toggle

The claude-say plugin renders conversational replies as ASCII figure speech
bubbles. **Toggle state is handled entirely by the `UserPromptSubmit` hook** —
no Bash tool calls from you, no permission prompts for the user.

## What you should do

When the user's prompt is a toggle/status request like those above, the hook
will have already:

1. Read the current state from `${CLAUDE_PROJECT_DIR}/.claude/.claude-say-active`.
2. Created or removed the flag file.
3. Rendered a confirmation bubble directly to the user's terminal.
4. Returned `{"decision":"block", "reason":"…"}`, which **suppresses your
   turn entirely for pure toggle prompts** — meaning if the hook matched, you
   will not be asked to respond at all.

So in practice: if you see the plain user request reach you anyway (e.g. it
was phrased loosely enough that the hook's regex didn't match), just
acknowledge in one line and do nothing. Do **not** run `touch`, `rm`, `[[ -f
… ]]`, or `bash render.sh` yourself.

## When the hook regex misses

The hook accepts exact phrasings such as:

- `turn on claude-say`, `enable claude-say`, `activate claude-say`
- `turn off claude-say`, `disable claude-say`, `hide claude-say`
- `toggle claude-say`
- `claude-say status`, `is claude-say on?`

If the user phrased it differently (e.g. "hey can you flip claude-say on for
me please"), the hook will fall through. In that case:

1. Reply in one short sentence explaining that the exact phrases above are
   what the hook recognizes.
2. Do **not** try to toggle via Bash — direct the user to the recognized
   phrase instead. This preserves the no-permission-prompt property.

## Confirmation Reply Style

When you do need to reply, one short sentence is enough. The rendered figure
(from the hook) is the primary confirmation.

- Good: "claude-say is on."
- Bad: "I have successfully enabled the claude-say plugin by creating the flag file..."
