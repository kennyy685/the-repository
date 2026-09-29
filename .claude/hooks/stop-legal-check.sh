#!/bin/bash
# Stop hook: nothing customer-facing ends a turn with a legal problem (round 55 idea 2). legal_check.py is fast
# (statute text, cancel-notice elements, banned phrases like "licensed" or covering a deductible).
cd "$CLAUDE_PROJECT_DIR" || exit 0
out=$(python3 tests/legal_check.py 2>&1) && exit 0
echo "Legal check failed. Fix it before stopping (python3 tests/legal_check.py):" >&2
echo "$out" | tail -n 15 >&2
exit 2
