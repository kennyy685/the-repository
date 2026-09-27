# How the crew's own setup works (and how to make it better)

FilthE, 2026-09-27: "A big foundation is the most important part, so why not start with you." The AI crew is part of
the foundation. Improve it the same way we improve the app: find what slows us down, fix it once, write it here.

## What's in place
- **Settings** (`.claude/settings.json`): `NODE_PATH` so node tests find Playwright; a SessionStart hook
  (`.claude/hooks/session-start.sh`) installs `requirements.txt` in fresh cloud containers; a PreToolUse guard
  (`.claude/hooks/block-git-add-all.sh`) stops anyone staging the whole shared tree.
- **One command for release checklist step 2:** `tests/release_checks.sh` (`--quick` while building, `--fast` = no browser).
- **How we decide:** `docs/orders/decision-method.md`. **Research first, don't ask FilthE:** CLAUDE.md.
- **Crew:** `.claude/agents/` (builder, designer, engine-mechanic, hub-keeper = Research Lead, improvement-scout,
  qa-tester) with the cheapest model that can do each job. Skills: `.claude/skills/`.

## Where to learn more (written for AIs to read)
- Claude Code docs index for agents: https://code.claude.com/docs/llms.txt (append `.md` to any docs page URL for
  plain text). Most useful: best-practices, features-overview, skills, sub-agents, hooks-guide, memory, goal, costs.
- Plugin/skill catalog: search it with the SearchPlugins / SearchSkills tools; FilthE installs from the card.
  Worth having (2026-09-27): **frontend-design** and **Design** (design-critique, accessibility-review, ux-copy) for
  the app and print pieces. Already built in: `skill-creator` (improve and test our own skills), `/code-review`.

## Rules we took from the docs
- Give every job a check that says pass/fail (tests, the design gate, screenshots vs. mockups). Show the evidence.
- Keep CLAUDE.md short; a rule that must never break becomes a hook, a sometimes-needed procedure becomes a skill.
- A fresh session per job; a fresh reviewer (qa-tester) grades work it didn't write.
- Anything done by hand twice gets a script or a skill.
