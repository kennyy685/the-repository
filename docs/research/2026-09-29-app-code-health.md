# HMP App + Practice Door code health (2026-09-29)

Builder, session_01AWPjP21NUan5qpHLM9pJX4. Why: the AI hub froze live while every check passed, because every check
ran offline with a runtime that always answers. FilthE: "better our code, stronger, more efficient, smarter, fix broken code."

## Found
Freezes (all 5 reproduced by the new smoke test on the old code, all 5 gone on the new):
1. **App stuck on "Loading" forever** if `use('db')` never answers (no time limit).
2. **Dead Right Hand button** if `use('user')` or `use('sample')` never answers: connect() waited on them one by one,
   so the button stayed on screen with nothing behind it, and assets / the outbox restart never ran.
3. **Right Hand chat locked forever** if Claude never answers: the only exit was the abort signal, which a stuck
   runtime can ignore (the same bug the hub had).
4. **Help me say it spins forever** ("Translating…"): the app calls it with no signal and no time limit.
5. **Practice Door: Send locked forever** ("waiting for them") if the homeowner's reply never comes; the Rookie hint
   also had no limit; a `use('sample')` that never answered left the Door on its start screen.
Also: photo uploads had no time limit; the app's `withTimeout` left a timer running after every write.

Efficiency (measured at 4x CPU slowdown ≈ a phone): load 0.5 s of main-thread work, tab switch 0.09-0.18 s, 5 live db
changes 0.08 s, idle 20 s ≈ 0 (no busy loops, no timers doing work). The app's memo/redraw design (v23) already holds.
Practice Door: load 0.4 s, idle 0. Nothing slow enough to be worth a risky change.

Dead code: 13 functions nothing called (v24 leftovers the v25 screens replaced): whoOf, followItems, followItemsNow
(+ followMemo), callbackCount, dueTodayN, dueChip, lIdx, orderBox, zoneLine, heatCls, knockRules (the city knock-hours
line; v25 shows it in the rules sheet), stampOf, HO_PHONE. Practice Door: none.

## Fixed (commits on claude/amazing-gauss-yzfpq0)
- `9ca1bb5` App: `within(p, ms)` on every runtime call: capabilities 12 s each and asked in parallel, Right Hand 2 min
  hard stop (also aborts the signal), photo upload 90 s, asset delete 10 s. withTimeout clears its timer.
- `768d52e` / `e0dffe7` App: slow is not gone: a db that answers after 12 s still connects when it arrives (the dot
  says off, then goes live); a slow user/sample turns the Right Hand on when it arrives.
- `54708b6` Help me say it: 45 s hard stop per translation (caller's signal still aborts), 12 s on `use('sample')`.
- `3e86174` Practice Door: homeowner reply 90 s, hint 45 s, `use('sample')` 12 s -> no-Claude screen.
- `6bee878` App: the 13 unused functions out (43 lines). Behavior identical.
- `f206082` / `bc76350` New release check `tests/pages/app_live_check.js` (in `tests/release_checks.sh`):
  realistic mock db (`app_live_fixture.py`: the engine's 7:52 AM output on the mock storm + the design-gate
  leads/claims, no names) behind the hub's runtime mock (+ assets). 18 scenarios: live (EN, ES, phone, Practice mode:
  every tab, every button and the sheets they open, Add > new lead, Help me say it, a door tap, the Right Hand
  logging doors), db hang / slow / fail, user+sample hang / slow, writes hang, Right Hand hang / fail, translation
  hang; Practice Door live / hang / fail / use-hang / no runtime. 0 console errors, 0 unhandled rejections, main
  thread answers in < 1.5 s.

No legal wording or feature changed (legal_check passes; only time limits and dead code).

## Open
- A timed-out Right Hand message goes to the outbox and retries (15 s, 45 s, 2 min) like a no-signal message. On a
  runtime that is stuck (not offline) each retry waits the full 2 min. Fine for now; revisit if it happens live.
- The smoke test clicks up to 30 buttons per tab and one level of sheets. Deeper flows (estimate builder, job tracker,
  claim steps) are covered by their own checks (fullday, jobtrack, estimate), not by this one.
- Unused i18n strings and CSS were not swept (low value, high risk of removing something a module builds by name).
