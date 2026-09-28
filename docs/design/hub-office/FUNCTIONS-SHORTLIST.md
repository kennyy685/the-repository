# Hub: new functions shortlist (for FilthE to pick) - 2026-09-28

Walkthrough note 10: "There could be more valuable functions. I'm not satisfied yet." These are **new** jobs the hub
could do for you. Nothing here is already in v27 or already planned for v28 (the RIGHT NOW list, the Observatory,
re-seating the floors, notes 1-11 are all coming anyway). Ranked by your rule: saves time or worry, things you
wouldn't think of, zero effort for you. Every item was checked against today's real data (2026-09-28).

## Pick list

| # | Function | What you get | Why now (seen today) | Effort |
|---|---|---|---|---|
| 1 | **Your chats, one list** | Every open Claude chat in one list: working / needs you / done, what it's doing, what it needs from you in plain words, what it cost. A chat that needs you joins "Needs you" at the top. Answer it from the hub; the King passes it into that chat. | The King already writes this list (`crew/sessions`) but the hub never shows it, and it's 13 h stale. The "permit calls" chat needs you and you'd only see it by opening that chat. | Page M, crew S |
| 2 | **Spend meter + runaway alarm** | One line: "Today $X · this week $Y". A chat that passes $25, or burns $10+ an hour, gets flagged: "King chat: $41 in 90 min. Hand it off?" | Your archived chats add up to **$1,017**; one King chat alone cost **$149**. Each session reports its own cost, so this is real data, not a guess. | Page S, crew S |
| 3 | **One-tap fresh chat** | A "Hand off" button on a long or pricey chat: it writes its handoff note, saves it to GitHub, a fresh chat starts from that note, and the old one is archived once the new one confirms. | You close chats by hand to save money. This session started from a handoff note that was sitting on a different branch than the one checked out. | Crew M, page S |
| 4 | **Is everything running?** | A small schedule strip: every scheduled job (King runs, Storm Watch 6:54, morning data 7:40, Monday scorecard) with on / paused, last run ✓ or ✗, next run. "Paused on purpose" looks different from "broke". | Right now **all 7 scheduled jobs are paused**, Storm Watch included. The hub only notices Storm Watch after 6:54 AM, and only if it checked in before. | Page S, crew S |
| 5 | **Unfinished-merge watch** | "3 branches have finished work that isn't on main yet", in plain words, with one "Merge it" approval (the King does the merge after your Yes). | Work is spread across 8 branches today; main is ~190 commits behind the hub work. Easy to lose or redo work. | Crew S, page S |
| 6 | **Ready to ship** | Anything waiting for your "publish/merge" gets its own card: what it is, a preview link, the QA result, what changes if you say yes. One "Ship it" button; the King does it. | Right now "App v25.3, Practice Door v11 and Print Kit are QA'd and wait on your word 'publish'" is buried in the King's orders text. | Page S, crew S |
| 7 | **Fix-it buttons** | Every warning comes with the one button that fixes it: Storm Watch paused → "Turn it back on"; instant wake broken → "Reconnect"; a chat stuck on you → "Answer". | The instant-wake backup trigger written into the page was switched off at 12:02 today; the hub still works only because the King updated the live one. | Page S, crew S |
| 8 | **"Why" line on each robot** | One line under "Now" on every robot: why this job, why now ("because you said Yes to D12", "next on the board after T199"). | Research round v28 (#12): the best agent-town tools show the *why*, not just the *what*. You never have to ask "why is it doing that?" | Page S, crew S |
| 9 | **Sunday report card** | One card on Sunday night: shipped, hours stuck, hours the crew waited on you, $ spent, $ per thing shipped, best helper, vs last week. | Nobody tracks whether the crew is getting better or more expensive. | Page M |

Items from the society test (panel complaints that are really missing functions) get added below when the test lands.

## My pick (lead)
**1, 2, 4 and 6** first: they're the ones where you currently have to go dig (open chats, check costs, check
schedules, read orders text). All four read data that already exists, so they fit inside the v28 build without new
permissions. 3 and 5 next (they need the King to do more per run). 7-9 ride along where cheap.

## How each works (for the builders)
- **1 Chats:** the King's run already calls `list_sessions` and writes hub doc `crew/sessions`
  `{sessions:[{id, title, state, doing, needs_you, cost_usd, updated}], archived:{count, cost_usd}, updatedAt}`.
  Fields to read from `list_sessions`: `status_bucket`, `post_turn_summary.needs_action` / `status_detail`,
  `external_metadata.usage.cost_usd`, `updated_at`. The page shows it (Crew tab section + `needs_you` rows in the Needs
  strip, key `s:<session id>`). An answer is saved as `answers/s-<session id>` + a handoff event to `code`; the King
  relays it into that chat (`SendMessage` to the session) and posts `re`. Stale guard: show "as of 13 h ago" when
  `updatedAt` is older than the last run slot.
- **2 Spend:** from the same doc: sum today's and this week's `cost_usd` (Central days); flag a session at $25+ or
  $10+/h (cost delta between two King runs). Label it "about" (session-reported usage; the hub's own Right Hand replies
  aren't counted).
- **3 Hand off:** a `handoff` event to `code` with `kind:'handoff'`, `task:'fresh-chat'`, `session:<id>`. The King
  asks that chat to write + commit its handoff note, calls `create_session` with a prompt pointing at the note's
  branch + path, and `archive_session` on the old one only after the new one checks in. Starting/stopping chats is on
  FilthE's only-a-person list, so the button itself is his OK.
- **4 Schedule:** the King writes hub doc `system/schedule` from `list_triggers` each run:
  `{jobs:[{id, name, enabled, cron, next_run_at, last:{status, at}}], at}`. (Or give the page `list_triggers` in its
  `Claude Code Remote` grant; the doc route needs no new permission.)
- **5 Merges:** the King writes `system/git` `{branches:[{name, ahead, behind, last_commit_at, summary}], main, at}`
  from GitHub each run; "Merge it" = a question with `options` → the King merges after Yes (merges to main need
  FilthE's OK per CLAUDE.md).
- **6 Ready to ship:** a board `waiting` item with new optional fields `ship: {what, preview_url, qa, changes}`; the
  page renders it as its own card type. Answer "Ship it" → wake → the King publishes per the release checklist.
- **7 Fix-it:** alerts gain a `btn` per kind (the page already supports `data-alert` buttons); each button = a
  handoff/wake with the fix named. Also: drop the hard-coded `WAKE_TRIGGER_FALLBACK` (now a disabled trigger); if
  `system/king.wake_trigger` is missing, answers ride the next run and the health line says "Instant wake off".
- **8 Why:** optional `why` (90 chars) on agent check-ins, else derived: an event with `re` → "because you answered
  <id> <answer>"; a board row → "next on the board after <id>".
- **9 Report card:** computed on the page from `events` (done, blocked durations, `you` answer latency) +
  `crew/sessions` costs; shown Sunday 6 PM Central to Monday noon, then in the Log.
