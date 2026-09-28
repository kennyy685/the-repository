# King handoff (read this first, fresh King)

Written by SMUIPO, 2026-09-28 ~19:50 UTC, session `session_01AsMzvyKcsuQnKw9X8HHjzK` (context ~235k, handing off).
Work branch: `claude/amazing-gauss-yzfpq0`. Read CLAUDE.md, then `docs/memory/questions-for-filthe.md` (many answers
today: trust = show the work; claim-ready damage check; required photos gate "adjuster-ready"; HMP-branded homeowner
damage page; scorecard yes; short reasons).

## FIRST, as the new King
0. Read "HUB CHAT WIRING" below: FilthE's hub chat answers instantly in the page and hands orders to you. Keep
   `system/king.wake_trigger` pointing at YOUR poke-only trigger and ack + reply to every order (`re` = his id).
1. Make your own hub wake trigger (create_trigger, no cron, binds to you) with the SAME prompt as
   `trig_01Ay7rpe81rci7aYTfSFW112` (get_trigger it: it has the calm fallback line). Write its id to hub doc `system/king`
   (`wake_trigger`, `live_session`), update CLAUDE.md's id line, disable (never delete) trig_01Ay7rpe81rci7aYTfSFW112.
2. Archive `session_01AsMzvyKcsuQnKw9X8HHjzK` (me).
3. Reply to FilthE in the hub King thread (events/<stamp>-code-r, to:"you") in 3 short lines: new King, wake fixed,
   what's running. Refresh hub doc `crew/sessions` first (every tab, what it does).

## HUB CHAT WIRING (v28.1, keep it working; Builder 2026-09-28)
FilthE's main line is the hub chat bubble ("King" mode). How it works now:
- **Instant voice:** the page itself asks Claude (`sample` capability) as SMUIPO, grounded in board/current,
  system/king, system/memory, crew/sessions, the crew rows and recent chat. It saves `events/<stamp>-king-i`
  `{agent:"king", name:"SMUIPO", instant:true, to:"you", re:<his -you-k id>, text, long}`.
- **Question** -> answered there; his event gets `mode:"answered", kind:"note"`. No wake. Don't answer it again
  unless he taps "Send to the King too" (that fires a wake).
- **Order** (build/fix/publish/decide, or anything the data can't answer) -> the page says "Got it, sending to the
  King: ..." and fires the CURRENT `system/king.wake_trigger` at once. His event gets `mode:"order", order, wake:
  "ok"|"fail"|"off", wakeAt, trig, deliv` (deliv = the trigger's last_run read ~12 s later).
- **Your job on each wake:** (1) post an ack at once: `events/<stamp>-code-a` `{agent:"code", kind:"progress",
  to:"you", re:<id>, text:"On it: ..."}` (the page shows "King is on it"); (2) do the work in helpers; (3) reply
  `events/<stamp>-code-r` `{agent:"code", kind:"note", to:"you", re:<id>, text, long}` (shows "Done"). Also sweep:
  every `-you-k` event with `mode:"order"` (or no mode) and no `-code-r` with its `re` is yours, even if its wake
  was lost.
- **Status he sees per message:** Sending -> Answered here | Sent to the King -> King got it -> King is on it ->
  Done. "Nudge again" appears after 4 min with no word, or when a wake failed. When you change the wake trigger,
  the page re-sends any message whose wake failed or went to the old trigger, once.
- **Publish needs:** capabilities `db`, `user`, `sample`, and `mcp` with server "Claude Code Remote", tools
  `["fire_trigger", "get_trigger"]` (get_trigger = the delivery check; without it the ack/reply still show).
  Check: `node tests/pages/hub_chat_check.js` (mocked round trip, dark + Ledger).
- **Handoff step:** the new King's trigger must be poke-only, bound to its own session, and its id written to
  `system/king.wake_trigger` BEFORE the old one is disabled. A wake that lands anywhere but the King chat says
  one calm line only (keep that line in the trigger prompt).

## WAKE LESSON (why FilthE saw "not working" notifications, 2026-09-28)
When the hub fires the wake while the King is mid-turn, the fire runs somewhere WITHOUT the repo or the hub, and its
reply ("can't reply, no hub access") lands on FilthE's Mac as a scary notification. FilthE: "it like panicked".
Fixes: (a) the trigger prompt now tells such a run to say one calm line only; (b) KEEP YOUR TURNS SHORT: answer him,
hand work to robots (Agent in background, or their own session), end the turn. Never do long work in the King chat.
(c) Answer EVERY hub message on the hub, never only in the Claude chat (CLAUDE.md rule, FilthE is the boss).

## Running now
- `session_01BBugaCxVHUih4FSarp88w2` Designer: 7 AM home screen (commits to the work branch, does not publish; ~190k
  context, may hand itself off). Review screenshots, then publish the open map (docs/design/open-map/index.html + files
  data/base.json, streets.json, homes.json, areas.json) after FilthE sees it (he wants to see it first: asked).
- `session_01WBuhN9Eg7VYnjKzKreQEbH` Builder: Practice Door v12 legal fixes (16 QA findings, docs/research/
  2026-09-28-practice-door-v12-QA-WIP.md). Does not publish; FilthE must say "publish".
- A send_later check-in fires into MY session at 20:03 UTC (trig_018x6yDcvUV4NKRX3CL7rZJn): delete it or ignore.
- Done: claim-ready inspection checklist docs/research/2026-09-28-claim-ready-inspection.md (feeds the Knock screen).
- Old hub session archived; its Practice Door v12 WIP brought over (9878b2a).

## Open with FilthE (on the hub)
1. Build hub functions 1, 2, 4, 6 next + remove the 90 s wake hold (our pick yes). 2. King double-checks handoffs
against real files before answering (our pick yes). 3. What does the finished hub feel like when he opens it?

## Live (done today)
- Open map v4 (click flow + Ledger light theme): https://claude.ai/artifact/6LRaMpb63D8Z7UwznfqqxV
- Practice Door v11: https://claude.ai/artifact/PFKkgWCMshKnE2nWFssM7B
- AI hub v28.0 + King thread (version 29): https://claude.ai/artifact/Qkc52bt2JL5gW7ZKWBJDHU. Built on the other hub
  session's live v28 (amazing-wright b2b50ad) + our King thread; committed fa3d33f.
- Engine: T211 mortgage share + owner-share fix QA'd PASS; T212 owner line cites "(Census)". 434 tests green.

## Waiting on FilthE
- Delete 6 old branches in GitHub (all contained in ours; git push to other refs is blocked here): funny-hawking-2rytou,
  dreamy-wright-nc4nby, eager-bardeen-lj7lfc, inspiring-goldberg-7wc0b4, trusting-dijkstra-luw0nu, focused-cannon-766o1q.
- Two weekday permit calls (Omaha 402-444-5233, Lincoln 402-441-7521), session_01QEYZAMyqfC3VcASSqJS3mx has the notes.

## Next (in order)
1. Review + publish the 7 AM screen. 2. Real 2026 storms + likely-insured signals in the map. 3. Knock screen
(MacBook first, no phone work). Small: Ledger (light) contrast in the hub top bar + RIGHT NOW (add Ledger to design_gate);
light-theme column-header overlap in the open map street list.

## HUB FROZEN (FilthE 2026-09-28: hub work felt like busywork)
Finish only: Fixer (instant chat + robot orders), Builder functions 1/2/4/6, tiny report card. Then stop hub work.
Next big job: Knock screen (MacBook first), start it when the hub Builder finishes.

## (old) The hub is NOT done (FilthE, 2026-09-28: "we had way more going for the hub")
Live = v28.0. Still to build: v28.1 "One building" + v28.2 "Dressed with data" (docs/design/hub-office/BUILD-v28.md),
the 9 functions in FUNCTIONS-SHORTLIST.md (King's pick 1, 2, 4, 6 first; asked FilthE 2026-09-28), CONVENIENCES.md
top 12, SPEC.md notes 1-11, remove the 90 s wake hold on card answers. Hub page source of truth = branch
claude/amazing-wright-lds9q5 until merged. Every wake: refresh hub doc crew/sessions (every tab, what it does).

## FilthE today
"Satisfied when it makes me money; a system with promising info, leads, guidance and efficiency." Robots = coworkers,
King = boss. He likes "do what's best" autonomy, but the safety guard needs explicit words for merges over the shared
tree ("yes, commit and push ...").
