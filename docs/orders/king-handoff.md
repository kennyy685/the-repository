# King handoff (read this first, fresh King)

Written by SMUIPO, 2026-09-28 ~19:20 UTC, session `session_01FERv6AGSv3mJ7kZTLTcybV` (context ~265k, handing off).
Work branch: `claude/amazing-gauss-yzfpq0`. Read CLAUDE.md (new rules today: copy-paste blocks, "Done, waiting for
your OK" update format, every robot job = its own session, no phone app for now), then
`docs/memory/questions-for-filthe.md`.

## FIRST, as the new King
1. Make your own hub wake trigger (create_trigger, no cron, binds to you), write its id to hub doc `system/king`
   (`wake_trigger`, `live_session`), update CLAUDE.md's id line, disable (never delete) `trig_01NHQW42S6i4iKTWWcWAwbF4`.
2. Archive `session_01FERv6AGSv3mJ7kZTLTcybV` (me).
3. Reply to FilthE in the hub King thread: `events/<stamp>-code-r` with `to:"you"`, `re`, `text`, `long` (see skill
   crew-checkin, "Hub Chat with the King"). He was asked to send a test message to confirm the wake works.

## Live (done today)
- Open map v4 (click flow + Ledger light theme): https://claude.ai/artifact/6LRaMpb63D8Z7UwznfqqxV
- Practice Door v11: https://claude.ai/artifact/PFKkgWCMshKnE2nWFssM7B
- AI hub v28.0 + King thread (version 29): https://claude.ai/artifact/Qkc52bt2JL5gW7ZKWBJDHU. Built on the other hub
  session's live v28 (amazing-wright b2b50ad) + our King thread; committed fa3d33f.
- Engine: T211 mortgage share + owner-share fix QA'd PASS; T212 owner line cites "(Census)". 434 tests green.

## Running
- `session_01BBugaCxVHUih4FSarp88w2` "Designer: 7 AM home screen" (own session, per FilthE's new rule). It commits to
  the work branch, does NOT publish, posts on the hub board and archives itself. You review screenshots, then publish
  the open map (docs/design/open-map/index.html + files data/base.json, streets.json, homes.json, areas.json).
- `session_01STawByegL8ENCwJWZV6cQm` "Hub v28.0: check + ship (resume)" on branch amazing-wright: INTERRUPTED at
  FilthE's word (one King / one hub session only). Its status said "Practice Door v12 stacking in progress". Check
  `git log origin/claude/amazing-wright-lds9q5` for anything newer than e762abd; bring real work over by file (not a
  branch merge: no merge base), then archive that session. Watch out: it may have unpushed work.

## Waiting on FilthE
- Delete 6 old branches in GitHub (all contained in ours; git push to other refs is blocked here): funny-hawking-2rytou,
  dreamy-wright-nc4nby, eager-bardeen-lj7lfc, inspiring-goldberg-7wc0b4, trusting-dijkstra-luw0nu, focused-cannon-766o1q.
- Two weekday permit calls (Omaha 402-444-5233, Lincoln 402-441-7521), session_01QEYZAMyqfC3VcASSqJS3mx has the notes.

## Next (in order)
1. Review + publish the 7 AM screen. 2. Real 2026 storms + likely-insured signals in the map. 3. Knock screen
(MacBook first, no phone work). Small: Ledger (light) contrast in the hub top bar + RIGHT NOW (add Ledger to design_gate);
light-theme column-header overlap in the open map street list.

## The hub is NOT done (FilthE, 2026-09-28: "we had way more going for the hub")
Live = v28.0. Still to build: v28.1 "One building" + v28.2 "Dressed with data" (docs/design/hub-office/BUILD-v28.md),
the 9 functions in FUNCTIONS-SHORTLIST.md (King's pick 1, 2, 4, 6 first; asked FilthE 2026-09-28), CONVENIENCES.md
top 12, SPEC.md notes 1-11, remove the 90 s wake hold on card answers. Hub page source of truth = branch
claude/amazing-wright-lds9q5 until merged. Every wake: refresh hub doc crew/sessions (every tab, what it does).

## FilthE today
"Satisfied when it makes me money; a system with promising info, leads, guidance and efficiency." Robots = coworkers,
King = boss. He likes "do what's best" autonomy, but the safety guard needs explicit words for merges over the shared
tree ("yes, commit and push ...").
