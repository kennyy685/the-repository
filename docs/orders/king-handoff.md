# King handoff (read this first, fresh King)

Written by SMUIPO, 2026-09-28 ~23:50 UTC, session `session_014eg28DpMQ1EZLj9hVosB8g` (~235k, handing off).
Work branch: `claude/amazing-gauss-yzfpq0`. Read CLAUDE.md (new today: King's 6 rules, hub dispatch, done = publish +
tell him, fewer bigger questions, every robot job = own session, max 2), then `docs/memory/questions-for-filthe.md`.

## SNAG (King session_01HnpGXN, 2026-09-28 23:55 UTC)
This King chat is at lineage depth 8 (the cap): create_trigger and create_session fail. So it could NOT make its own
wake trigger or start robot sessions. Old wake `trig_01RsYqTCZfeEnStkGS8LYinX` stays enabled and bound to the old King
`session_014eg28D`, which is kept OPEN (not archived) so Hub Chat still wakes someone. Fix: FilthE taps Fresh King on
the hub (starts from his account, depth 0); that King does the FIRST steps below, then archives 014eg28D + 01HnpGXN.
Next King handoffs should come from the hub button, not create_session, or the chain stays at the cap.

## FIRST, as the new King
1. Make your own hub wake trigger (create_trigger, no cron, binds to you) with the SAME prompt as
   `trig_01RsYqTCZfeEnStkGS8LYinX` (get_trigger it). Write its id to hub doc `system/king` (`wake_trigger`,
   `live_session`) and `system/robots.dispatch.king`, update CLAUDE.md's id line, disable (never delete) the old one.
2. Archive `session_014eg28DpMQ1EZLj9hVosB8g` (me) if I haven't.
3. Refresh hub `crew/sessions`, then one short hub post to FilthE (to:"you"): new King, what's running.

## KNOWN PROBLEMS (2026-09-28 23:58)
- King chain depth cap (8): a King made by a King can't create triggers/sessions. FilthE must tap Fresh King on the hub
  (starts from his account, resets the chain). session_01HnpGXN (capped King) archived; session_014eg28D stays King.
- Hub instant answers are stale (offered to publish Practice Door v12, already live): feed it what's live.
- Robot lines + robot->QA handoff untested; may hit the same cap.
- Rule: robots commit before any pause (a paused Engine lost ~$4 of work).

## Running now (2 = the max)
- `session_01MBkNjQQ28175TShNsVd7WN` Engine Mechanic: real 2026 storms + likely-insured signals (data + engine only).
  An earlier Engine run (session_01TqT879, 205k tokens) was paused + archived before committing: its work is lost.
- `session_01FAiZrYLTN74EXrzmpdCBSW` Designer: Knock screen in docs/design/knock/ (spec in its prompt).
Both hand off to QA via trig_01PVGRev9d4pF9PABSNcG9XH. When done + QA pass: publish per checklist and tell him.

## Next (after those)
7 AM screen (Designer session_01BBugaC archived mid-job, last commit 2566b1c) -> fresh Designer. Then "the map
learns from your knocks" + track record (lead = inspection yes). Apply new hub-order trigger prompts from
docs/research/2026-09-28-robot-upgrades.md (Upgrade session_01TuRXA7 done; archive it + Fixer + hub Builder).

## LIVE 2026-09-28 ~20:35 UTC
- Practice Door v12 = Version 13; AI hub = Version 30 (checks green).
- NEEDS FILTHE: publisher widened hub mcp grant to get_trigger, get_session, list_environments, create_session
  (Fresh King / Hand it off buttons). He never OK'd create_session. Keep or remove = his call (asked on hub).
  Real tap untested. Phone shot: chat bubble covers the Memory tab label.

## PAUSED by FilthE (2026-09-28 "too much at once"): resume only when he says
- Knock screen Designer session_0185evJPrsmWUGcHwM3u6Y9X (interrupted right after start; spec in its prompt).
- 7 AM screen: Designer session_01BBugaC was archived mid-job (last commit 2566b1c). Resume = fresh Designer.
- Waiting on the King: apply new hub-order trigger prompts from docs/research/2026-09-28-robot-upgrades.md.
- Done, waiting on "publish hub": Fixer session_01EXX2WM (instant chat + robot orders), hub Builder session_014TaKrJ (fn 1/2/4/6).
Engine session_01TqT879 (real 2026 storms) PAUSED too (interrupted 20:10 UTC to save usage; its files stay in that session,
resume by messaging it or a fresh Engine reading its commits). Nothing running except the publish helper. Max 2 at a time.
King session_014eg28D at ~225k context: next King takes over from here (FilthE offline, usage nearly out).

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
