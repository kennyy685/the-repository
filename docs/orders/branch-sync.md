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
