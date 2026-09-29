# AI hub code health, 2026-09-29 (the freeze)

FilthE: "fix broken code, stronger code, more efficient, smarter", for the hub. The live hub (Version 30, v28.1) froze
for him on his MacBook Air: clicks and typing did nothing. Every release check had passed, because they only ran offline
with a mock runtime that always answered at once.

## How we looked
- Read the live page back (Artifact read). It matched `pages/crew-hq.html` byte for byte, so the bug was in the code we had.
- Real db (agents, answers, board, crew, events, system, wakes) read into a mocked runtime (contract 0.2.58 shapes), where
  db / sample / mcp / user can succeed, fail or hang. Headless Chromium, with and without the three.js room.
- Two investigators ran in parallel (runtime-contract audit, main-thread profile) plus an adversarial verifier.

## Found
1. **The 3D room could block the whole page.** With software graphics, each frame took 0.6-0.8 s of main-thread time
   (a GPU readback wait, 432 draw calls, 32 shader programs), plus a ~7 s first-frame freeze. So every click and keystroke
   waited 0.6-3.8 s. There was no way out: the quality drop only runs when DPR > 1, and the 8 s "still view" fallback kept
   drawing behind the still. Nothing covered the buttons and nothing swallowed keys. The page was just starved.
2. **Runtime calls with no deadline, fired without his click.** Nothing bounded `claude.use()`, `canEdit`, sample or any
   MCP call. MCP (fire_trigger, get_session, get_trigger, list_environments, create_session) also ran from timers and
   snapshots: a held wake 4 s after load, the watchdog every 30 s, the chat sweep, and get_session when the King window
   opens and every 60 s. The first MCP call on a load asks for consent in a claude.ai prompt over the page, and a call can
   sit ~130 s with no answer. Fresh King (list_environments -> create_session) could hang forever with the button hidden.
3. **Re-rendering under his hands.** The board and the chat thread rebuilt their HTML on every snapshot and every 30 s,
   even when nothing had changed. That wiped half-typed board answers and could swap a button between mouse-down and up.
4. **Resubscribing on every focus.** Any focus or tab return after 120 s of quiet dropped all 8 live listeners and opened
   them again. Quiet docs send nothing, so this fired almost every time. It also silently lost the `wakes` listener.
5. **Writes from render and timers.** `writeStale` ran from `renderBoard`, so up to ~8 overlapping writes on load. `tidy()`
   deleted 100+ events one by one, unbounded, 8 s after load: that can eat the call budget his sends need.
6. **Small per-frame waste.** A new `Intl.DateTimeFormat` every frame, a forced layout every frame (`clientWidth`), an extra
   crew/sessions read before every instant answer (already live from the subscription), and one dead helper (`stColor`).

What the verifier could not prove: which of 1 or 2 hit him live. His same page worked at 23:53 UTC (a wake went through),
then nothing reached the db. A hung call alone never blocks the main thread. The 3D room is cheap on a healthy Apple GPU,
but it freezes exactly like this when the browser falls back to software drawing. A claude.ai consent prompt can sit over
the page. We fixed all of it.

## Fixed (pages/crew-hq.html)
- Every runtime call has a deadline: `use()` 12-15 s, `canEdit` 8 s, db writes 10 s, sample 2 min (abort signal), MCP
  reads 20/90 s (abort signal), MCP writes stop being waited on at 91 s. If `canEdit` never answers, his inputs stay (the db
  rules still refuse a non-editor's write).
- One door for MCP (`mcpCall`). A call that isn't his click never runs before one of his went through on this load. A
  refusal stops them all for the load. A held wake waits behind "Wake now" instead of firing by itself. A swept chat
  message shows Retry. Fresh King always comes back and says "No answer yet, check Chats" when the outcome is unknown.
  create_session is re-sent only after a refused permission_mode.
- 3D escape hatch: software WebGL (SwiftShader, llvmpipe, `failIfMajorPerformanceCaveat`) skips the room. Frames under
  ~7 fps for 4 s (after a 6 s warm-up) switch to the still view, the loop stops, and the next 3 days start there. A GPU
  context loss shows the still. Make it yours has a new "3D room on/off" switch. The scene loads by dynamic import (the
  importmap moved up), so a phone or laptop that can't draw it never downloads three.js.
- The board and the chat thread rebuild only when their HTML changed. The board never rebuilds while he's typing an
  answer (it catches up on blur).
- Subscribe once: resubscribe only after an error or 20+ min away. The `wakes` listener lives with the others.
- `tidy()`: at most 40 deletes a load, 1.5 s apart, bounded, starts after 60 s, stops if the tab hides. `writeStale`:
  one write in flight.
- Cached the date formatter and the stage size. Removed `stColor`. The instant answer uses the live sessions doc.

## QA pass (qa-tester) and what it changed
- Blocking, fixed: a failed board answer left its buttons disabled (the board cache skipped the repaint). A King Retry
  that failed again stayed disabled. Both now force a repaint, and the new `send-fail` scenario proves it (it fails on
  the pre-fix page).
- Fixed: turning 3D back on after the scene failed to load left a blank stage. A slow `use('mcp')` was treated as a
  refusal for the whole load. A held wake without a trigger now clears instead of waiting.
- Accepted: a half-typed answer in an unfocused box holds the board until blur or send. Resubscribing relies on the
  platform's own recovery unless there's an error or 20+ min away (db.d.ts says subscriptions recover by themselves).

## Published
Hub Version 31 (2026-09-29), capabilities carried forward. `tests/release_checks.sh --quick`: all 18 checks PASS. Claude
Code Remote argument names are unchanged from v28.1, whose fire_trigger worked live at 23:53 UTC.

## Tests
- `tests/pages/hub_live_check.js` (in `tests/release_checks.sh`): the hub on the real db shapes
  (`tests/fixtures/hub_live.json`, words scrubbed by `tests/pages/hub_live_fixture.py`) with `hub_runtime_mock.js`.
  Eleven scenarios: live (every tab, every button, chat, board answer), phone, quiet load (zero MCP calls with no click),
  MCP hang, sample hang, write hang, send fail, db fail, no db, user/sample/mcp hang, slow 3D. Run against the old
  live page, it fails 10 checks.

## Open
- We can't run the real claude.ai shell or his Mac's GPU here. If it ever freezes again: check whether a Claude
  permission box is showing, and whether Chrome's "Use graphics acceleration" is on.
- The 3D room itself is heavy for a hub (432 draw calls). The escape hatch covers it, but a lighter scene would make
  3D reliable on more machines.
- The Fresh King chain problem (depth cap) is untouched. It's the King's own flow, not page code.
