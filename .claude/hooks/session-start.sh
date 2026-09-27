#!/bin/bash
# SessionStart (cloud sessions only): install the engine's Python libraries so `python3 hh.py selftest` and
# tests/release_checks.sh work on a fresh container. Node checks find Playwright via NODE_PATH (.claude/settings.json).
set -euo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi
cd "$CLAUDE_PROJECT_DIR"
if python3 -c "import numpy, pandas, requests, PIL, matplotlib, openpyxl, flask" 2>/dev/null; then
  exit 0   # already installed (cached container)
fi
# Debian ships blinker without a RECORD file, so pip can't upgrade it in place (flask needs a newer one).
pip install -q --root-user-action=ignore --ignore-installed blinker -r requirements.txt
