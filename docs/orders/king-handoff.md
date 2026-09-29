# King handoff (read this first, fresh King)

Written by SMUIPO session_014eg28DpMQ1EZLj9hVosB8g, 2026-09-29 ~03:20 UTC (very long chat; FilthE is tapping Fresh King).
Work branch: `claude/amazing-gauss-yzfpq0`. Read CLAUDE.md (No confusion rule: 3 blocks Working on / Done / Needs you;
one job per area; ultracode on hub jobs; done + QA = publish + tell him; real round-trip after every hub publish).

## 2026-09-29 11:20 UTC: new King took over (session_01PJvb5QyxFcFZV1S5sftKNQ, branch claude/stoic-darwin-ikqmrj)
- Wake trigger trig_01PDsG5Y1TBi9XpzefRn74uH (hub system/king + robots.dispatch.king point to it); trig_01RB7w disabled;
  session_01JozofC archived; its safety check trig_01AknBnn + permit reminder trig_01DqmD72 disabled; permit reminder
  re-made via send_later trig_01GRQqBn5ufKuocKK1RBKEFs (13:02Z). Designer session_01HNcP3i done (HMP App v14 desk
  layout live), archived.
- 12:02: RUNNING session_01Ck7V69BXGkVHVim6SzdqNy Engine (drawn walks for top-3 + backup, handoff NEXT 1) and
  session_012136rntxeMkoRn5S6AezDk Builder ("free" sweep + PDF re-render, NEXT 2+3). Check-in via send_later ~12:47Z.
  Test wake at 11:22 and 7 AM wake at 12:00 both landed in this chat.
- 13:46: FilthE: 4 robots, ultracode on all. Engine session_01Ck7V69 done+archived (open map v13). RUNNING: Builder
  session_012136rn ("free" sweep, in QA), Engine session_019aik3Z (QA lows), Builder session_01RRaZWW (ultracode
  code-health sweep + fresh-King error text + save stuck QA reports), Designer session_01Us5Ubj (ultracode 3 next-level
  7 AM looks). QA trigger prompt now calls add_repo push first. Board + system/king rewritten (were 12 h stale: the hub
  told FilthE to press Fresh King; he doesn't need one). NEXT when a slot frees: hub "live board" (board/answers built
  from real events + sessions by themselves, ultracode).

## FIRST, as the new King (written 2026-09-29 11:20 UTC by King session_01JozofC8iSNPPy6vmgD4Muc)
Work branch for the King: `claude/stoic-darwin-ikqmrj` (merges in `claude/amazing-gauss-yzfpq0`, where robots commit).
1. Get your own session id (get_session, no id). Create your wake trigger: create_trigger, NO cron, bound to you, prompt =
   the prompt of trig_01RB7wJoBmgynC5qG7JzRpSY with your session id swapped in (get_trigger it). Write its id to hub doc
   system/king (wake_trigger, live_session) and system/robots.dispatch.king; update CLAUDE.md's trigger line.
   Disable (never delete) trig_01RB7wJoBmgynC5qG7JzRpSY. Then archive session_01JozofC8iSNPPy6vmgD4Muc.
2. HOW THE WAKE WORKS: the hub (v34) sets a TIMED fire on your trigger (update_trigger run_once_at next minute). A
   timed fire lands in your chat; fire_trigger never does (it opens a throwaway stand-in chat). After a one-shot fires,
   `enabled:true` alone is refused: always pass a new run_once_at. Test it YOURSELF (update_trigger run_once_at ~1 min
   out on your own trigger, see the turn arrive); never ask FilthE to test.
3. Re-create the 8 AM CT permit-call reminder for yourself if it's before 13:02Z (old one trig_01DqmD72 is bound to the
   archived King): post on the hub "2 permit calls: Omaha 402-444-5233, Lincoln 402-441-7521".
4. Watch robots with send_later check-ins (45 min while robots run). QA can't send results back to create_session
   robots; robots poll hub events themselves; read QA done events (reports may be in the `long` field).
5. Talk to FilthE only on the hub. Every reply = 3 blocks (Working on / Done / Needs you), grouped by area.

## STATE at 11:20 UTC 2026-09-29 (FilthE wakes ~12:00Z; morning post already on the hub, event 20260929T111701Z-code-r)
- LIVE: HMP App v13 (full-day e2e test, 22 checks; cancel date skips Saturday; "roof check"), open map v12 (real
  night brief, top 3 = pick, pick's walk drawn on real streets; Columbus 22 St tonight), hub v34 (timed wake),
  Practice Door v15 ("roof check"), assessor emails docs/orders/assessor-email.md (Dodge, Washington, Saunders).
- ROUTINE: "Night shift" trig_01C3zVLmdJNfikq5ocXwWNWQ, every night 2:40 AM CT, fresh sonnet session runs
  docs/orders/night-shift-runbook.md (~$0.34/night, test run worked 09:04). Check its storm-watch hub event each morning.
- RUNNING: session_01HNcP3iMT2tTbDWF7opFt8T Designer (ultracode): HMP App desk layout for MacBook; QA PASS 11:15,
  publishing. When live: verify, archive, report card, tell FilthE.
- FilthE's orders last night: "be serious, work in what matters" (money: app proven, real lead data, night shift; no
  hub features), "I want to be wowed" / "out of the copper age" (ultracode is the King's call), "stay working while i
  sleep", "i shouldnt have to chat for you to check" (King checks things itself).
- OPEN QUESTION to FilthE (on the hub): score every call = (a) he tells Aldaba what happened after a real talk and it
  scores it like the Practice Door? King's pick (a). Build it (App) after his yes.
- NEXT (King's picks, in order): 1) open map: every top-3 card and the backup get their own drawn walk (small engine
  job). 2) "free estimate" + other leftover "free" lines flagged by the roof-check builder: sweep to the same rule.
  3) Re-render the print PDFs (still say free). 4) When FilthE sends the assessor emails and data arrives: wire real
  year-built / owner-occupied / sale data into the engine ("likely insured"). 5) Score every call after his yes.
- Report card (hub crew/report_card) is current through 11:17.

## 2026-09-29 03:26 UTC: new King took over (session_01JozofC8iSNPPy6vmgD4Muc, branch claude/stoic-darwin-ikqmrj)
- Done: wake trigger trig_01RB7wJoBmgynC5qG7JzRpSY (hub system/king + robots.dispatch.king point to it); old
  trig_01RsYq disabled; session_014eg28D archived; 8 AM permit reminder re-made (trig_01DqmD72zV5REK12wGLmkNMM), old
  trig_01SutpBH paused (delete blocked by the safety guard); 5-min check trig_01PfHF already fired + off.
- Map learns: done + archived (Knock v3, open map v7 live). Hub v28.1 One building (session_016ezDyT): review_ready, QA next.
- FilthE saw "Couldn't start a fresh King ... needs its Claude Code Remote permission" on the hub button: not needed
  (he started this King from the app); the grant is his call (he never OK'd create_session).

## 2026-09-29 06:05 UTC (King session_01JozofC)
- LIVE: hub Version 33 (One building, Observatory, cat Miso, report card).
- RUNNING: session_01VQR2UaWsBPRWd6QRKLsUMX Builder: hub v28.4 QA fixes + publish (timed King wake via update_trigger;
  QA FAIL 05:08 = missing update_trigger grant + checkDelivery `t` scope bug). Earlier builder session_017r7vUf archived.
- LESSON: QA "sends back" by firing the sender's trigger; builders made with create_session have none, so QA's FAIL
  sat unread. The King must read QA done events and re-dispatch (fresh session) itself.
- King wakes: own trigger trig_01RB7w run_once_at 12:00Z (7 AM CT); 8 AM permit reminder trig_01DqmD72.
- 06:51: FilthE "stay working while i sleep". RUNNING too: session_01HKC68ebVCsZSjHwxwYAnXD Engine: night shift
  (hh.py night + "Since last night" strip on open map). Ask him in the morning: score every call = (a) or (b)
  (questions-for-filthe.md). Queued: county assessor email draft (Around it). Nightly schedule for night shift = King's call after QA.
- 06:57: big push ("wow me", "out of the copper age", ultracode OK). ALSO RUNNING: session_01GER2WgJcay2qjVvKG2W4hD
  Builder ultracode: HMP App proven end to end; session_01FV41BBpetuNZMhK5SsYv2k Research Lead: assessor email.
  Overnight check = trig_01GiUdj3 chain; morning post before 12:00Z.

## LIVE (2026-09-29)
- AI hub v32 (freeze fix, wake fix: wakeErr shown on failed messages), HMP App v12 + Practice Door v14 (never freeze),
  open map v6 (real 2026 storms, 7 AM home, storm stacking, roof-age sweet spot), Knock preview v2
  https://claude.ai/artifact/9oDxg9iErVt9TteXeo5bLU.
## RUNNING
- session_016ezDyTJ7bpC4c8kzD8WMCJ hub v28.1 One building (ultracode, ~$32+).
- session_017rLPE1DSw1vubyGUNKMB8N map learns from knocks (built + QA'd 03:12, publish next).
- send_later 8 AM CT permit-call reminder fires into the OLD King session (trig_01SutpBHFRzzTSCgtD2zVcLM): re-create it
  for yourself and delete that one. Old 5-min robot check (trig_01PfHFzh37foqKhgsZomQVLs): delete; make your own.
## NEXT
Hub: v28.2 + functions 3/5/7/8/9 (ultracode). For the app: 7 AM "what's new since yesterday" if he wants; score every
call + night shift (his approved deep ideas). Release checks take ~10 min: run each with its own timeout.
Stash stash@{0} in the old container is redundant (drop blocked by classifier; ignore).
Open for FilthE: email the 3 county assessors for a data export (King's pick yes, draft it for him to send).

## 2026-09-29 01:46 UTC (latest)
- LIVE: AI hub Version 31 (freeze fixed, 18-scenario live check), Knock preview https://claude.ai/artifact/9oDxg9iErVt9TteXeo5bLU.
- RUNNING: hub v28.1 One building session_016ezDyTJ7bpC4c8kzD8WMCJ (ultracode); open map v5 Designer
  session_019jAdfacYrQmrfkPBuf1xov; app code-health finisher session_01MnduKbrqyhnd66wsr61WhL.
- King checks every 5 min via send_later (FilthE asked). Hub next after v28.1: v28.2 + functions 3/5/7/8/9, ultracode.
  Then deep ideas he approved: score every call + night shift.

## 2026-09-29 01:07 UTC: FilthE OK'd 3 robots ("usage can handle it")
- Hub: session_01PwbnuZLG2xnZVnniirsJuB (ultracode) freeze fixed, 18 checks pass, final QA + publish. Then v28.1 build.
- For the app: session_01GW26yM9kK9WaGLzHzLqeew Designer, open map v5 = real storms + 7 AM home, publish.
- App: session_01AWPjP21NUan5qpHLM9pJX4 Builder, app + Practice Door code-health, publish.
- send_later check-in armed (trig_01FYUkbWc7tcdAQUGYoLBqjq, 01:12 UTC).

## 2026-09-29 00:08 UTC (FilthE: "wait to start the hub, focus on the coding")
- FilthE meant: code-health for the HUB. RUNNING: session_01PwbnuZLG2xnZVnniirsJuB (ultracode): fix the freeze,
  stronger/faster hub code, live-data smoke test, QA, publish. App sweep session_01Q1oxa3 cancelled (not wanted now).
- QUEUED right after the hub fix (same page, so not in parallel), FilthE said "you do that": build the rest of the hub
  with ultracode, one chunk at a time, publish each: v28.1 One building (tube, Observatory, cat, workflow), v28.2
  Dressed with data, functions 3/5/7/8/9, CONVENIENCES top 12, report card. Plus the wow ideas once he picks.
- QA PASSED storms + Knock (docs/research/2026-09-29-qa-storms-knock.md). Knock fixes applied; Knock preview LIVE:
  https://claude.ai/artifact/9oDxg9iErVt9TteXeo5bLU. Storms data is engine-only: wiring it into the open map = next Designer job.
- Done: Engine storms (447 tests) + Knock screen (docs/design/knock/): publish after QA passes.

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
