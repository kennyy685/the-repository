# King handoff (read this first, fresh King)

Written by SMUIPO, 2026-09-27 ~23:15 UTC, from session `session_011e2f2UpFQsD7g4dCiYcFvm` (context ~400k: too big, so it
handed off). Work branch: `claude/amazing-gauss-yzfpq0` (everything is pushed). Hub board = the task list.

## FilthE's standing orders from tonight (also in CLAUDE.md)
- You are **SMUIPO, the King**. Your chat is his **conversation bubble**, not a workbench: you talk, decide, hand out
  jobs, report in a few lines. All work runs in helpers. **2 helpers at a time** unless he asks for a big push.
- You watch **every** Claude session: each run, `list_sessions` -> hub doc `crew/sessions` (title, working/needs
  you/done, doing, needs_you, cost). You can see, interrupt or archive other sessions but can't message them.
- **Hand yourself off** past ~200k tokens: rewrite this file, `create_session` a fresh "SMUIPO (King)", archive the old
  one. He should never have to open a new chat himself. Round 60 (`docs/research/2026-09-27-round-60-fresh-chats.md`)
  backs this: fresh chat per job, status via get_session, never rely on cross-session messages.
- Post to the hub as helpers start/finish (`python3 .claude/hooks/hub_flush.py`, see CLAUDE.md). Real UTC time.

## First thing: app v25.2 is READY but NOT LIVE (T199)
QA passed it (all app checks green, hard stops verified, old claims still render, legal lines right). The publish
was blocked by Claude's auto-mode guard when a helper tried it (and again when the old King relayed FilthE's "yes"
to a helper). **Only publish when FilthE tells YOU directly in your chat** ("publish the app" / "yes"). Then do it
yourself: Artifact `read` https://claude.ai/artifact/9N97Uzv8J9EAueSKhCNSPT (it saves the live copy to a file and
wants every line Read; the live page = our commit 492c72b, an ancestor of HEAD, so nothing is lost), then publish
`pages/hmp-app.html` with `files` = the map in `pages/hmp-app.files.json`. Never use force/overwrite_unread.
What goes live: Job #1 tracker (14 steps, hard stops for 44-8606 + 3-day cancel + materials), the T174 door-opener
fix, the quick-price phone fix. Known nit for later: "Step 5 of 14" wraps on phones (T205).

## Done tonight
Print Kit republished (pre-winter piece, ice-dam sheet). T151/T177/T183/T184 print done. Legal check 6 (door opener
order). Hub auto check-ins (T21). Engine: storm alert on your own accounts (T193 item 3, engine side). Research rounds
57-60. Merged two stray branches (quick-price fix, permit call sheet).

## Next jobs, 2 at a time (board has details)
1. After the app publish: **Builder T201 Practice mode** (in a worktree; an empty stopped worktree
   `.claude/worktrees/agent-acdc9022eabf9d432` can be deleted).
2. **Engine Mechanic T203** (storm-age dip/bump for winter walks) + write the new King-trigger prompt with the
   accounts step (T193) into `docs/orders/king-trigger-prompt.md`; the King applies it with update_trigger.
3. **QA T163** bad-signal stress test. **Research Lead**: finish round 59 (claim deadlines, EraHub) with pymupdf.
4. The "AI hub: Penthouse HQ" session (T190, 3D hub) works on `claude/funny-hawking-2rytou`: when it's done, merge it
   into the work branch (keep tonight's crew-hq design-gate fixes).
5. Old King session `session_011e2f2UpFQsD7g4dCiYcFvm`: archive it once FilthE is talking to you.

## Waiting on FilthE (don't nag)
T202 permit calls Monday 8 AM+ (Omaha 402-444-5233, Lincoln 402-441-7521; Columbus already confirmed: no permit).
T71 Fremont permit records request, T51 price sheet (boss), T64 registration # (boss).
