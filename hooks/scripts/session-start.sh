#!/usr/bin/env bash
set -euo pipefail

FLAG="${CLAUDE_PROJECT_DIR}/.claude/.claudesay-active"
[[ -f "$FLAG" ]] || exit 0

PROTOCOL='<claudesay-protocol>
When giving a conversational reply, append this tag at the very end:
<claudesay mood="MOOD">Brief 1-line summary of what you did or said</claudesay>

Available moods: happy, excited, thinking, focused, upset, error
- happy / excited → success outcomes (rotate between them for variety)
- thinking        → in-progress or uncertain
- focused         → working, running something
- upset           → warning or partial failure
- error           → actual failure

Rules:
- Keep message under 60 chars
- Do NOT add the tag to: pure code blocks, diffs, long technical output, tool-only responses
- Only chatty, conversational replies get a bubble
</claudesay-protocol>'

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":%s}}\n' \
  "$(printf '%s' "$PROTOCOL" | jq -Rs .)"
