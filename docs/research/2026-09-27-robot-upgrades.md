# Robot upgrades: making the hub crew (`.claude/agents/*.md`) better

FilthE (2026-09-27): "make the robots better" - the King is the tip, the agents (builder, designer,
engine-mechanic, hub-keeper, improvement-scout, qa-tester) do the work. This round researched Claude
Code's own subagent docs (primary source, fetched directly, dated today) for what a subagent
definition can do, then applied the low-risk fixes straight to the agent files.

No prior round covered this (`grep`'d `docs/research/` for "subagent"/"agents.md" - nothing). This
round also stands in for the scouts: I have no way to launch `improvement-scout` helpers from inside
this run (no `Agent`/`Task` tool available to me here), so I read the primary sources myself instead
of two scouts researching in parallel - noted so nobody re-runs this expecting scout reports.

## What to work on next (ranked)

1. **Point every repo-touching agent at `docs/orders/crew-setup.md`, not just CLAUDE.md.** (Code -
   applied this round, effort S) Builder, Designer, Engine Mechanic and QA Tester only said "read
   CLAUDE.md first." Crew-setup.md holds the actual shared-tree rules (stage only your own files,
   stop-and-report instead of retrying a blocked publish, worktrees when files might collide) but a
   subagent auto-loads CLAUDE.md, never files CLAUDE.md merely points at. That gap is the likely
   cause of tonight's "publish blocked by the auto-mode guard" confusion and file mix-ups - the rule
   already existed, the robot just never read it. **Applied**: added a one-line pointer to
   `docs/orders/crew-setup.md` in builder.md, designer.md, engine-mechanic.md, qa-tester.md.

2. **Cap every agent's own report length in its own file, not only in CLAUDE.md.** (Code - applied,
   effort S) `docs/orders/crew-setup.md` already says "Helpers report back in 10 lines or fewer" but
   that line lives in a file agents weren't told to read (see #1); the agent files themselves had no
   length rule at all, which is the direct cause of "reports run long." **Applied**: added an explicit
   line-count cap to builder.md, designer.md, engine-mechanic.md, qa-tester.md, and tightened
   hub-keeper's own handback instruction.

3. **Preload the one skill each agent always invokes, via the `skills:` frontmatter field.**
   (Code - applied, effort S) Official docs (see sources) list `skills:` as a frontmatter field that
   "preloads" a skill's full text at agent startup instead of the agent discovering and calling it at
   runtime - their own best-practice #2 is "preload critical skills to avoid runtime discovery
   overhead." improvement-scout invokes `improvement-research` on *every* run and hub-keeper reads it
   too; engine-mechanic invokes `engine-change` on every change. Preloading those removes a guaranteed
   extra tool round-trip from every single run of those three agents - a real, free speed/cost win
   with no behavior change (the skill still gets used the same way, just already in context).
   **Applied**: `skills: [improvement-research]` on improvement-scout.md and hub-keeper.md,
   `skills: [engine-change]` on engine-mechanic.md, `skills: [crew-checkin]` on builder.md (it posts
   check-ins/handoffs constantly). Left out `artifact-design`/`artifact-capabilities`/`code-review`/
   `security-review` - these looked like they might be global/bundled skills rather than project
   skills under `.claude/skills/`, and an unresolvable name in `skills:` is exactly the kind of thing
   the docs warn causes a load error (their "zero tools" failure mode for a misspelled `tools:` entry
   suggests the same risk for `skills:`) - not worth risking an agent failing to load over a small
   speed win. Confirm scope before adding those.

4. **Give the Designer the same proxy fallback the research backlog already documented.**
   (Code - applied, effort S) `docs/research/backlog.md` already has the fix for tonight's "Designer's
   web fetch was blocked by the proxy" problem (curl through `$HTTPS_PROXY` reaches sites WebFetch
   can't) but it was written for research rounds, not for designer.md, so the Designer never saw it.
   **Applied**: one line in designer.md pointing to the curl fallback.

5. **The "publish blocked by auto mode" incident isn't a subagent-file problem - don't fix it there.**
   (FilthE/Code to know, no file change) Builder's own file already says "Don't publish or commit...
   Claude Code publishes after the QA Tester checks it" - Builder and Designer never call the publish
   tool themselves, so the classifier that flagged a publish was reviewing the King's own action, not
   a helper's. `docs/orders/crew-setup.md` already has the correct rule ("a helper that gets a refused
   publish stops and reports the exact message; only the King decides to resend"). Nothing to change
   in `.claude/agents/*.md` for this one - it's a King-workflow fact, already documented correctly.

6. **"Uncommitted files left behind" is also a King-side gap, not an agent-file one.** (Code, no file
   change this round) Builder/Engine Mechanic/QA Tester are all *told* not to commit - the King is
   supposed to commit their diffs (CLAUDE.md: "Commit work in progress to the repo every ~30 min").
   A helper's edits sitting uncommitted until the King's next commit is expected, not a bug in the
   robot. If this keeps happening, the real fix is a Stop hook that warns the King when `git status`
   shows changes older than ~30 min uncommitted (same pattern as the existing
   `stop-hub-reminder.sh`/`stop-legal-check.sh`) - that's a new hook, not an agent-file edit, so it's
   flagged here for a future round rather than applied now (task scope this round was agent-file
   edits only).

7. **Consider `isolation: worktree` as a *default* on Builder, not just a King-invoked option.**
   (Code - not applied, effort M, needs a real decision) The `isolation` frontmatter field runs the
   agent in its own git worktree automatically, every time, without the King having to remember to
   pass it on the Agent call. `docs/orders/crew-setup.md` round 55 already uses this, but only when
   the King *thinks* to invoke it - a frontmatter default would make it automatic and remove a step
   the King can forget. Not applied because it's a real behavior change (every Builder run now needs
   a worktree merge step) worth FilthE/the King deciding on, not a "small edit."

8. **Per-agent model choice is already right - confirmed against the docs, not changed.**
   (no change) CLAUDE.md's rule ("scouts/chores = haiku, research/QA/publishing = sonnet, main model
   for real app/design/engine work") matches the frontmatter today (`improvement-scout: haiku`,
   `hub-keeper`/`qa-tester: sonnet`, `builder`/`designer`/`engine-mechanic: inherit`) and matches the
   docs' own advice to "test model performance... balances cost/quality for your use case." One
   watch-out for later: improvement-scout on haiku is asked to make legal judgment calls ("drop
   anything that bends Nebraska law") - if a future round finds haiku missing a legal red flag,
   that's the first place to look, but tonight gave no evidence of that happening, so no change.

9. **A future, slightly bigger idea: a Stop hook per repo-touching agent that blocks `git commit`/
   `git push` from inside that agent's own Bash calls** (Medium effort, Code) - turns "don't commit or
   push" from an instruction into a hard gate, the same way `block-git-add-all.sh` already hard-gates
   `-A`. Docs explicitly recommend hooks for "actions that must happen every time with zero
   exceptions." Not applied this round: hooks need folder-trust and are more than a "small edit" to an
   agent file, and testing one wrong could block a legitimate King action too.

## Details: what the primary source says (fetched today, not a search summary)

`code.claude.com/docs/en/sub-agents.md` and `.../best-practices.md` (Anthropic's own current docs -
opened directly, not a mirror or a blog summary):
- Frontmatter fields beyond what's used here today: `disallowedTools` (denylist, applied before
  `tools`), `maxTurns` (caps a runaway agent, output marked partial so the King can resume it -
  a real fix for "reports run long" if it ever means "session ran too many turns," not just "the
  final message was too long"), `memory: project` (persistent `.claude/agent-memory/<name>/MEMORY.md`,
  shareable via git - could let e.g. hub-keeper remember "already-covered topics" across rounds
  without re-grepping every time, but that's a bigger change than this round's scope), `effort`
  (override per-agent, e.g. run routine QA at `medium` instead of inheriting the King's `high`),
  `background: true`.
- Failure modes confirmed from the docs: a subagent with every `tools:` entry misspelled or
  unresolved gets "spawned with zero tools" and fails outright; `Bash(git push *)` in
  `disallowedTools` removes the *whole* Bash tool, not just that one command pattern (a real trap if
  anyone tries to block just `git push` via `disallowedTools` instead of a hook); a blocked/unavailable
  model in `model:` silently substitutes to the newest allowed version of that family.
- Confirmed: `Agent` is always removed from every subagent regardless of its `tools:` list (this is
  why hub-keeper genuinely "can't launch agents itself" - that's not a missing permission, it's a
  platform-level rule for every subagent, matching what hub-keeper.md already says).
- Best-practice #4 from `best-practices.md`, "Add an adversarial review step": run a reviewer in a
  fresh subagent context so it isn't biased toward code it just wrote - this is exactly what
  qa-tester already is; the docs also warn "a reviewer prompted to find gaps will usually report
  some, even when the work is sound... tell the reviewer to flag only gaps that affect correctness or
  stated requirements" - worth adding to qa-tester.md if it ever starts nitpicking style over bugs
  (not observed yet, so not applied this round).
- Best-practice "give Claude a way to verify its work" + "Stop hook as a deterministic gate" is
  already exactly the `tests/legal_check.py` Stop-hook pattern this repo uses - confirms the existing
  setup, not a new idea.

## Watch out
- Don't add `skills:` entries for skills whose scope (project vs. global/bundled) isn't confirmed -
  an unresolvable name risks the agent failing to load, same failure shape as a misspelled `tools:`
  entry.
- Don't set `isolation: worktree` as a blanket default without the King/FilthE agreeing - it changes
  every run of that agent into "produces a branch to merge," not "edits the shared tree directly."
- Legal rules and permissions were not touched: no `tools:`/`disallowedTools` was loosened, no rule in
  builder/designer/engine-mechanic/qa-tester about Nebraska law, "registered" vs. "licensed," or the
  deductible/claims rules was changed.

## Sources
[1] Claude Code subagent configuration reference - https://code.claude.com/docs/en/sub-agents.md
    (fetched 2026-09-27; frontmatter field table, model resolution order, tool inheritance rules,
    skills/`memory`/hooks configuration, scopes, failure modes)
[2] Claude Code best practices - https://code.claude.com/docs/en/best-practices.md (fetched
    2026-09-27; verification loops, subagent use for investigation and adversarial review, auto-mode
    classifier behavior, common failure patterns)
[3] `docs/orders/crew-setup.md` (this repo) - the existing rules that agent files weren't pointed at
[4] `docs/research/backlog.md` (this repo) - the curl/proxy fallback already known but not wired to
    the Designer
