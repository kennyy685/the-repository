#!/bin/bash
# Stop hook (T21): don't end a King turn with helper check-ins still unposted to the AI hub. Blocks once per stop
# (stop_hook_active guards the loop); `python3 .claude/hooks/hub_flush.py --discard` drops them in a session without
# the hub.
cd "$CLAUDE_PROJECT_DIR" || exit 0
grep -q '"stop_hook_active": *true' <<<"$(cat)" && exit 0
q=.claude/state/hub-queue.jsonl
[ -s "$q" ] || exit 0
n=$(grep '"event": "\(start\|stop\)"' "$q" | grep -vc '"agent_type": "\(improvement-scout\|statusline-setup\)"')
[ "$n" -gt 0 ] || exit 0
echo "$n helper check-in(s) not on the AI hub yet: run python3 .claude/hooks/hub_flush.py, post its writes with ArtifactData batch, then hub_flush.py --done." >&2
exit 2
