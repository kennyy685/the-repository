# Hub build queue (FilthE, 2026-09-29 ~14:05 UTC: "make sure ultracode is on, yes finish all tasks, sync everything,
# test it and wait till my next asks, so we can [get] a brief summary of all we have")

One Builder at a time on pages/crew-hq.html (same page). Every chunk: prompt starts with "ultracode", release checklist,
live-data smoke test, publish, REAL round trip (King checks the live hub matches list_sessions), hub post, archive.
The King starts the next chunk the moment the previous Builder is archived. Specs: docs/design/hub-office/.

1. RUNNING  Live hub: robots + board + instant answers built from real sessions/events (session_013wezScDeoduPTP4moTMHqb)
2. QUEUED   Fix-it buttons: every warning carries the one button that fixes it (FUNCTIONS-SHORTLIST #7)
3. QUEUED   "Why" line on each robot (#8)
4. QUEUED   One-tap fresh chat / Hand off button (#3)
5. QUEUED   Unfinished-merge watch + one Merge button (King merges after his Yes) (#5)
6. QUEUED   Sunday report card (#9)
7. QUEUED   v28.2 "Dressed with data" (BUILD-v28.md) - research wall, Shipped shelf, QA screens, card additions
8. QUEUED   Top 12 conveniences (CONVENIENCES.md)
Chunks 2-4 may go to one Builder together; 5-6 together; 7-8 together (3 Builders total after the live hub).

AFTER ALL: sync = every robot's work merged into claude/amazing-gauss-yzfpq0 and the King branch, all pages
re-checked (release_checks + live smoke), hub docs current. Then the King STOPS starting new work and waits for
FilthE's next ask, with a brief "everything we have" summary ready (docs/orders/everything-we-have.md + hub post).
