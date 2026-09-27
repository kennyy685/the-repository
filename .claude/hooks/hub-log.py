#!/usr/bin/env python3
"""Hook (T21): log every helper launch/start/finish so the AI hub shows it without the King remembering.

Wired in .claude/settings.json on PostToolUse (matcher Agent), SubagentStart and SubagentStop. Hooks can't call the
hub's database tool, so this only appends one JSON line to .claude/state/hub-queue.jsonl; the King posts the queue
with `python3 .claude/hooks/hub_flush.py` (one ArtifactData batch). Never blocks, never fails the tool call.
"""
import json
import os
import sys
from datetime import datetime, timezone


def main():
    try:
        ev = json.load(sys.stdin)
    except Exception:
        return
    name = ev.get('hook_event_name', '')
    row = {'at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
    if name == 'PostToolUse':
        inp = ev.get('tool_input') or {}
        res = ev.get('tool_response') or {}
        if not isinstance(res, dict):
            res = {}
        row.update(event='launch', agent_type=inp.get('subagent_type') or 'general-purpose',
                   description=(inp.get('description') or res.get('description') or '').strip(),
                   agent_id=res.get('agentId') or '',
                   background=res.get('status') == 'async_launched')
    elif name == 'SubagentStart':
        row.update(event='start', agent_type=ev.get('agent_type', ''), agent_id=ev.get('agent_id', ''))
    elif name == 'SubagentStop':
        row.update(event='stop', agent_type=ev.get('agent_type', ''), agent_id=ev.get('agent_id', ''))
    else:
        return
    root = os.environ.get('CLAUDE_PROJECT_DIR') or ev.get('cwd') or '.'
    state = os.path.join(root, '.claude', 'state')
    os.makedirs(state, exist_ok=True)
    with open(os.path.join(state, 'hub-queue.jsonl'), 'a') as f:
        f.write(json.dumps(row) + '\n')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
