#!/usr/bin/env bash
set -euo pipefail

FLAG="${CLAUDE_PROJECT_DIR}/.claude/.claude-say-active"
[[ -f "$FLAG" ]] || exit 0

PROTOCOL='<claude-say-protocol>
When giving a conversational reply, append this tag at the very end:
<claude-say mood="MOOD">Brief 1-line summary of what you did or said</claude-say>

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
</claude-say-protocol>'

printf '{"systemMessage":%s}\n' "$(printf '%s' "$PROTOCOL" | jq -Rs .)"
