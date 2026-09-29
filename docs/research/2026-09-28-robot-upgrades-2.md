# Robot upgrades, round 2: fixing tonight's three pain points

T194 (FilthE, via the King): find where Claude Code power users share setups (official docs, the
Claude Code GitHub repo, r/ClaudeAI, practitioner write-ups) and pull techniques for a King that hands
jobs to 6 `.claude/agents/` robots, 2 at a time, 3 fresh sessions/day, cost-sensitive. Read
`docs/research/2026-09-27-robot-upgrades.md` and `docs/orders/crew-setup.md` first - this round does
not repeat what they already cover (frontmatter field table, the existing `--hold` hack, model choice,
the curl-through-proxy fallback for Designer). It targets tonight's three named pain points instead.

Sources this round: Anthropic's own current docs, fetched directly (not summaries) -
`code.claude.com/docs/en/sub-agents`, `.../worktrees`, `.../hooks-guide`, `.../costs` - plus this
session's own proxy README (`/root/.ccr/README.md`) for the proxy-block pain point, and a WebSearch
pass over GitHub issues / r/ClaudeAI / practitioner blogs (2026) for anything the official docs missed.
No practitioner source added a technique the official docs didn't already cover better and more
precisely, so nothing below is sourced from a blog alone.

## What to work on next (ranked)

1. **Applied - stop treating "background work still running" as a bug.** (Code, effort S, payoff:
   removes wasted King turns and false alarms) Confirmed straight from the docs: a background
   subagent's result reaches Claude as a completion notification with **no polling tool** - asking it
   for progress before that arrives just spends a turn to get "still running" back. And: "a subagent
   that launches background subagents waits for their results before it finishes" - so a helper
   pausing on its own background work (what `--hold` in `hub_flush.py` already handles) is expected
   platform behavior, not a hook bug to chase. **Applied**: a note in `docs/orders/crew-setup.md`
   telling the King to check the hub/`list_sessions` instead of messaging a paused helper.

2. **Applied - `isolation: worktree` is confirmed real, but NOT safe to default yet - the actual
   reason "stray uncommitted files" keeps happening either way.** (Code, effort S this round / M for
   the real fix, payoff: prevents a much worse mix-up) Round 1 flagged making worktree isolation a
   Builder/Engine-Mechanic default as "needs a real decision" without saying why. The docs answer it:
   a worktree branches from the repo's **default branch** (`main`), not the session's current branch,
   unless `worktree.baseRef` is set to `"head"` in `settings.json`. Our real work happens on
   `claude/amazing-gauss-yzfpq0`, not `main` - so turning on `isolation: worktree` today, without also
   setting `worktree.baseRef: "head"`, would make Builder/Engine-Mechanic silently branch off a stale
   `main` missing the whole work branch, a worse mix-up than the stray-file problem it's meant to fix.
   **Applied**: the exact finding in `docs/orders/crew-setup.md` so nobody flips the switch half-done;
   `.claude/worktrees/` is already in `.gitignore` (checked, not new) so a worktree a helper does start
   correctly never shows up as untracked noise. **Not applied** (a `settings.json` edit, out of scope
   this round and the task said not to touch it): `worktree.baseRef: "head"`. Flagging for the King/
   FilthE to decide together with turning `isolation: worktree` on as a real default.

3. **Applied - close the loop between a blocked-site report and the retry that can fix it.** (Code,
   effort S, payoff: fewer research rounds that quietly give up on a topic) `docs/research/backlog.md`
   already had the fix (`curl -sS "$HTTPS_PROXY/__agentproxy/status"` names the real block/reset reason
   before assuming a site is unreachable, then `curl -sS -m 20 -A "Mozilla/5.0" <url>`) but, same gap
   round 1 found for Designer, no agent file pointed at it. Checked `improvement-scout.md`'s `tools:`
   line: it has no Bash, by design (haiku, research-only, never contact anyone) - so a scout genuinely
   cannot retry a blocked site itself, and adding Bash there would be loosening a permission this task
   said not to touch. **Applied instead**: `improvement-scout.md` now tells scouts to name the exact
   blocked host instead of dropping the topic; `hub-keeper.md` (the Research Lead, which does have
   Bash) now retries a scout's blocked host with the proxy-status check + curl before falling back to a
   search summary; `docs/orders/crew-setup.md` documents the pattern once for every Bash-capable robot.

4. **Not applied, worth a future round: `memory: project` for the Research Lead.** (Code, effort M)
   The docs confirm a real `memory` frontmatter field (`.claude/agent-memory/<name>/MEMORY.md`,
   git-shareable, first 200 lines/25KB loaded into context automatically) built exactly for "remember
   what's already been covered across rounds" - which is currently done by hand (`grep`'ing
   `docs/research/` every round, per the "Before any round" note already in `hub-keeper.md`). Real
   savings (no more re-grepping 60+ round files every round) but it's a new file + new habit to keep
   in sync with `docs/research/`, not a one-line edit - flagging for a future round rather than
   applying blind.

5. **Not applied, needs FilthE: `experimental.cacheTtl: "1h"` on the Research Lead.** (Code, effort S,
   payoff: cheaper long research rounds) Confirmed field, requires Claude Code v2.1.248+. The cache's
   default lifetime is 5 minutes once on usage credits (1 hour on a plain subscription) - a research
   round that reads 2-4 scout reports plus `docs/research/` can easily run past 5 minutes between big
   tool calls, causing a real cache-miss reprocess of the whole context. Didn't apply because we don't
   know from inside this session whether HMP is on usage credits or a plain subscription (changes
   whether this matters at all) - a one-line ask for FilthE/the King to confirm, not a research
   question.

6. **Not applied - `maxTurns` + resume for a runaway Research Lead.** (Code, effort S) The docs describe
   a real mechanic: a subagent that hits `maxTurns` returns output marked partial, and the caller
   resumes it with `SendMessage` instead of losing the run. Could cap a research round that spirals
   (e.g., a scout topic that keeps chasing blocked sites). Not applied: no evidence tonight that a
   round actually ran long enough to need this instead of just finishing tighter reports; adding an
   arbitrary cap risks cutting off a round of genuinely useful research for no real problem observed.

## Watch out
- No `tools:`/`disallowedTools`/`permissionMode` was loosened on any agent (checked `improvement-scout`
  specifically - it still has no Bash). No legal rule (Nebraska 44-8604/8605/8606, "registered" vs.
  "licensed", claims negotiation) was touched. `settings.json` was not edited.
- `isolation: worktree` is confirmed to work as documented, but turning it on for Builder/Engine-
  Mechanic without also setting `worktree.baseRef: "head"` would be worse than the problem it's meant
  to solve (branches from stale `main`, not the real work branch) - see #2. Don't apply it alone.
- Practitioner blogs (Tembo.io, thepromptshelf.dev, felixschmidt.software, hidekazu-konishi.com, etc.)
  turned up in search but were not opened - everything applied this round traces to Anthropic's own
  docs or this session's own proxy README, both fetched directly.

## Sources
[1] Claude Code subagent configuration reference - https://code.claude.com/docs/en/sub-agents (fetched
    2026-09-28; frontmatter table, background/resume mechanics, no-polling confirmation)
[2] Claude Code worktrees - https://code.claude.com/docs/en/worktrees (fetched 2026-09-28; `isolation:
    worktree`, default-branch-not-current-branch behavior, `worktree.baseRef`, `.gitignore` advice)
[3] Claude Code hooks guide - https://code.claude.com/docs/en/hooks-guide (fetched 2026-09-28)
[4] Manage costs effectively - https://code.claude.com/docs/en/costs (fetched 2026-09-28; model choice,
    cache TTL/lifetime, `maxTurns`, subagent token attribution)
[5] This session's own agent-proxy README, `/root/.ccr/README.md` - the exact diagnostic command and
    failure classes for a blocked research site
[6] `docs/research/backlog.md` (this repo) - the curl/proxy-status fallback that existed but wasn't
    wired to `hub-keeper.md`/`improvement-scout.md`
[7] `docs/research/2026-09-27-robot-upgrades.md` (this repo) - round 1, not repeated here
