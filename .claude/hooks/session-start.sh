#!/bin/bash
# SessionStart (cloud sessions only):
# 1. Install the engine's Python libraries so `python3 hh.py selftest` and tests/release_checks.sh work on a fresh
#    container. Node checks find Playwright via NODE_PATH (.claude/settings.json).
# 2. Print a crew status the session reads first: which branch it's on vs. the work branch, and any claude/* branch
#    holding commits the work branch doesn't have (several sessions push their own branches; unmerged work gets lost).
set -uo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi
cd "$CLAUDE_PROJECT_DIR" || exit 0

if ! python3 -c "import numpy, pandas, requests, PIL, matplotlib, openpyxl, flask" 2>/dev/null; then
  # Debian ships blinker without a RECORD file, so pip can't upgrade it in place (flask needs a newer one).
  pip install -q --root-user-action=ignore --ignore-installed blinker -r requirements.txt >&2 || echo "WARN: pip install failed" >&2
fi

here=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
# Read the shared work branch from CLAUDE.md's "Work branch:" line (the name inside backticks) so this never drifts
# out of step with CLAUDE.md again; fall back to the current branch if the line is missing or unparsable.
WORK=$(grep -m1 '^- \*\*Work branch:\*\*\|^- Work branch:' CLAUDE.md 2>/dev/null | grep -oE '`[^`]+`' | head -1 | tr -d '`')
[ -n "$WORK" ] || WORK="$here"
timeout 30 git fetch -q origin "+refs/heads/claude/*:refs/remotes/origin/claude/*" 2>/dev/null
echo "Crew status (session start):"
if [ "$here" != "$WORK" ]; then
  echo "- You are on '$here'; the shared work branch is '$WORK'. Base your work on it (git fetch origin $WORK) and"
  echo "  push there only if the user says so; otherwise say which branch your work is on."
fi
unmerged=""
for b in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin/claude/); do
  [ "$b" = "origin/$WORK" ] && continue
  n=$(git rev-list --count --no-merges "origin/$WORK..$b" -- . ':!docs/memory' 2>/dev/null || echo 0)
  [ "${n:-0}" -gt 0 ] && unmerged="$unmerged ${b#origin/}($n)"
done
if [ -n "$unmerged" ]; then
  echo "- Branches with commits not in $WORK:$unmerged. Check them (git log origin/$WORK..origin/<branch>) and merge"
  echo "  real work in before building on top; tell the user if one looks abandoned."
else
  echo "- No other claude/* branch holds unmerged work."
fi
exit 0
