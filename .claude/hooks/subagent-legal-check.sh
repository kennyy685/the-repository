#!/bin/bash
# SubagentStop gate for builder/designer/engine-mechanic (their frontmatter `Stop` hook): a helper can't report
# "done" with a legal failure. Blocks ONCE: if the helper already got this message (stop_hook_active) it may stop,
# so a failure in someone else's file can't trap it in a loop - it must name the failure in its report instead.
cd "$CLAUDE_PROJECT_DIR" || exit 0
input=$(cat)
out=$(python3 tests/legal_check.py 2>&1) && exit 0
if echo "$input" | grep -q '"stop_hook_active": *true'; then exit 0; fi
echo "Legal check failed. Fix it if it's in your files; if not, name it in your report (python3 tests/legal_check.py):" >&2
echo "$out" | tail -n 15 >&2
exit 2
