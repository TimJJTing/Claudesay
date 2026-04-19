---
name: claudesay
version: 1.0.0
description: >
  Triggers when the user asks to "turn on claudesay", "turn off claudesay", "enable/disable the character", "toggle claudesay", "claudesay status", "show/hide the character", "enable ascii companion". Do not trigger for unrelated uses of "character" (e.g. unrelated variable names) or generic "turn off" requests that do not mention claudesay.
---

# claudesay Toggle

The claudesay plugin renders conversational replies as ASCII character speech bubbles. **Toggle state is handled entirely by the `UserPromptSubmit` hook** — no Bash tool calls from you, no permission prompts for the user.

## What you should do

When the user's prompt is a toggle/status request like those above, the hook will have already:

1. Read the current state from `${CLAUDE_PROJECT_DIR}/.claude/.claudesay-active`.
2. Created or removed the flag file.
3. Rendered a confirmation bubble directly to the user's terminal.
4. Returned `{"decision":"block", "reason":"…"}`, which **suppresses your turn entirely for pure toggle prompts** — meaning if the hook matched, you will not be asked to respond at all.

So in practice: if you see the plain user request reach you anyway (e.g. it was phrased loosely enough that the hook's regex didn't match), just acknowledge in one line and do nothing. Do **not** run `touch`, `rm`, `[[ -f … ]]`, or `bash render.sh` yourself.

## When the hook regex misses

The hook accepts exact phrasings such as:

- `turn on claudesay`, `enable claudesay`, `activate claudesay`
- `turn off claudesay`, `disable claudesay`, `hide claudesay`
- `toggle claudesay`
- `claudesay status`, `is claudesay on?`

If the user phrased it differently (e.g. "hey can you flip claudesay on for me please"), the hook will fall through. In that case:

1. Reply in one short sentence explaining that the exact phrases above are what the hook recognizes.
2. Do **not** try to toggle via Bash — direct the user to the recognized phrase instead. This preserves the no-permission-prompt property.

## Confirmation Reply Style

When you do need to reply, one short sentence is enough. The rendered character (from the hook) is the primary confirmation.

- Good: "claudesay is on."
- Bad: "I have successfully enabled the claudesay plugin by creating the flag file..."
