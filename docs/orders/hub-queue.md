# Hub build queue (FilthE, 2026-09-29 ~14:05 UTC: "make sure ultracode is on, yes finish all tasks, sync everything,
# test it and wait till my next asks, so we can [get] a brief summary of all we have")

One Builder at a time on pages/crew-hq.html (same page). Every chunk: prompt starts with "ultracode", release checklist,
live-data smoke test, publish, REAL round trip (King checks the live hub matches list_sessions), hub post, archive.
NO GAPS (FilthE 14:08: "the second tasks finishes start the next"): each hub Builder, as its LAST step after publish +
round trip, starts the next QUEUED chunk itself (create_session, title "Builder (ultracode): <chunk>", branch
claude/amazing-gauss-yzfpq0, prompt = this file's chunk + the same done-rules + this no-gaps rule), marks it RUNNING
here with the session id, pushes, then archives itself. The King polls every 5 min as a backup. Specs: docs/design/hub-office/.

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

## 14:04 UTC: FilthE "ping me once everything is done ... use up usage in the next 37 min" -> 8 robots running
Live hub session_013wezScDeoduPTP4moTMHqb | code health session_01RRaZWWf6iNmTYc7ycLVdb7 | engine session_019aik3ZgNmJCAEueHiCdj4v |
Designer looks session_01Us5UbjDH7t2GnhrnFxf9f3 | branch sync session_01QWjHv7ABHZ7BT5c6YnVBnx | no-free QA+publish
session_0198WMMBLyNhuDqjngDSS7RZ | hub chunk specs session_011x69CLsekQqvCCEPFoa6Aj (Builders for chunks 2-8 read
docs/design/hub-office/QUEUE-SPECS.md) | everything-we-have summary session_01Hrxq1jY88e4GX15hnXtXf2.
PING = one hub post to "you" when ALL are done (+ docs/orders/everything-we-have.md). No phone push (CLAUDE.md).
After the usage reset: back to max 4 at once.
