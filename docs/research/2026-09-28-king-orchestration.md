# How the King runs the robots (research, 2026-09-28)

FilthE: "you focus on the main work, the hard work ... make your workers better, the better the better."

## What a great orchestrator does / doesn't
- Does: understand the ask, plan, hand out jobs, combine results, decide if more is needed. Doesn't do the searching or
  building itself; workers do that in their own context [1].
- Every job gets 4 things: goal, output format, tools/sources, boundaries. Vague jobs made workers duplicate work [1].
- Scale effort to the job: simple = 1 worker, big = several [1]. Tiny quick edits can stay in the main chat [3].
- Grove: a manager's output = the team's output; spend time on high-leverage work (decisions, training) [4].
  Kaizen: many small improvements, Plan-Do-Check-Act [5].

## Making workers better
- Keep ~20 real past jobs as a test set, grade against a rubric, re-run after prompt changes [1].
- After a failure, diagnose it and rewrite that worker's prompt (Anthropic: -40% task time) [1].
- Right model per job; tight tools; worker memory across runs [1][3]. Rules that must always happen = hooks [6].

## The King's 5 rules (in CLAUDE.md)
1. Hand out outcomes, not steps: goal, output, tools, limits, "done = ...".
2. The King decides, plans, reviews and answers FilthE; anything over ~2 tool calls goes to a robot.
3. After every robot result: one line, good/redo + why, and fix that robot's prompt/skill the same turn.
4. Keep 10-20 real past jobs as a test set; re-run after any robot change.
5. Right model per job; repeat mistakes become hooks or skills.

Sources: [1] anthropic.com/engineering/multi-agent-research-system [2] anthropic.com/engineering/building-effective-agents
[3] code.claude.com/docs/en/sub-agents [4] en.wikipedia.org/wiki/High_Output_Management [5] en.wikipedia.org/wiki/Kaizen
[6] code.claude.com/docs/en/hooks-guide
