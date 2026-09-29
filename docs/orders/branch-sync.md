# Branch sync (2026-09-29)

Into `claude/amazing-gauss-yzfpq0`. Note: the session clone was shallow, so the start-up hook's "ahead" counts
(76-527) were inflated; after `git fetch --unshallow` the real gaps were small. Nothing merged to main.

| Branch | Result | Why |
|---|---|---|
| stoic-darwin-ikqmrj (King) | **merged** | 26 commits (King handoffs, hub queue, rules), clean merge, no conflicts. |
| amazing-wright-lds9q5 | superseded | Hub v28.0 + Practice Door v11/v12 were brought over by file (9878b2a, 0e04c73); every file it touched is newer here (hub v28.4, Practice Door v15). Line check: nothing of its adds is missing except older forms of design_gate lines that were since rewritten. |
| funny-hawking-2rytou | superseded | Its 16 extra commits (hub v27.1, v28 brief/research) are all inside amazing-wright, see above. |
| focused-cannon-766o1q | superseded | Only 1 commit ahead, a merge commit with no own work; its CLAUDE.md resolution is older than ours. |
| dreamy-wright-nc4nby | already merged | 0 commits ahead. |
| eager-bardeen-lj7lfc | already merged | 0 commits ahead. |
| inspiring-goldberg-7wc0b4 | already merged | 0 commits ahead. |
| trusting-dijkstra-luw0nu | already merged | 0 commits ahead. |

Checks after sync: `tests/release_checks.sh --fast` all PASS, `pytest` 521 passed.
Superseded/merged branches can be deleted on GitHub whenever FilthE okays it (not done: deleting needs his OK).

## Branch watch protocol (hub v28.5, chunk C) - the King, every wake and after any merge
1. `git fetch origin --deepen=1000` (or `--unshallow` once). Shallow counts are nonsense (see the note above).
2. For each `origin/claude/*` branch except the work branch: `ahead` = `git rev-list --count work..origin/<b>`, `behind` =
   `git rev-list --count origin/<b>..work`, `subject` = `git log -1 --no-merges --format=%s origin/<b>` (80 chars),
   `files` = `git diff --name-only work...origin/<b> | wc -l`, `conflicts` = conflicted paths from
   `git merge-tree --write-tree --name-only work origin/<b>` (exit 1 = conflicts, 0 = clean; nothing is checked out).
   `head` = `git rev-parse origin/<b>` (the tip the counts were taken at).
3. `main.behind` = `git rev-list --count origin/main..work`, `main.head` = `git rev-parse work`. Write hub doc `system/git`
   (shape in the crew-checkin skill, "Hub v28.5").
4. A "Merge it" answer (`board.waiting` item with `merge:{branch, into, ahead, conflicts, head}`): fetch and re-check first.
   If the tip (`git rev-parse origin/<branch>`, or the work tip for `into:"main"`) is not `merge.head`, or `ahead` /
   `conflicts` changed: don't merge; rewrite `system/git`, post a `note` with `re` ("it changed since you tapped: tap Merge
   it again"), take the stale item off `board.waiting`. Else `git merge --no-ff` (a merge commit; never
   rebase, never force, never delete the branch), `bash tests/release_checks.sh --fast`, push, post `done` with `re`, take the
   item off `board.waiting`, rewrite `system/git`. A conflict = `git merge --abort` and post it. `into:"main"` only from his
   own `M-main-*` tap.
