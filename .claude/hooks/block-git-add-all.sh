#!/usr/bin/env python3
# PreToolUse (Bash): several AIs share this working tree, so nobody stages the whole tree.
# Blocks `git add -A`, `git add --all`, `git add .` and `git commit -a/-am/--all`; `git add <paths>` is fine.
# Quoted text and heredoc bodies (commit messages) are ignored, so a message that mentions these flags passes.
import json, re, sys
cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "")
cmd = re.sub(r"<<-?\s*['\"]?(\w+)['\"]?.*?\n\1\s*$", " ", cmd, flags=re.S | re.M)  # heredoc bodies
cmd = re.sub(r"\"(?:\\.|[^\"\\])*\"|'[^']*'", " ", cmd)                                 # quoted strings
for part in re.split(r"&&|\|\||[;|\n]", cmd):
    w = part.split()
    if "git" not in w:
        continue
    rest = w[w.index("git") + 1:]
    if rest[:1] == ["add"] and any(a in ("-A", "--all", ".") for a in rest[1:]):
        break
    if rest[:1] == ["commit"] and any(a in ("-a", "-am", "-av", "-va", "--all") for a in rest[1:]):
        break
else:
    sys.exit(0)
print("Blocked: stage only your own files (git add <paths>). Other AIs share this working tree (CLAUDE.md rule).", file=sys.stderr)
sys.exit(2)
