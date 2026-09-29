# Hub Builder handoff (2026-09-29 ~19:35 UTC, from session_01JH3N6TYXtFVNW4aiw3zVCp, at ~200k tokens)

## Done
- **Hub v34 live** (AI hub Version 36): QUEUE-SPECS A + B + E.
- **Hub v35 live** (AI hub Version 37): C branch watch, D Sunday report, F Shipped shelf (scene.js + HUB.shipped
  {v,list,count} in CONTRACT.md), G 11 convenience scenarios + proofOf fix. 3 QA rounds, all fixed. Checks green:
  hub_live_check 50 scenarios (~15-16 min: run with timeout 1800), hub_chat_check, hub_shelf_check, design_gate
  --page crew-hq, release_checks --fast. CHANGELOG + hub done events posted. hub-queue.md items 1-8 DONE.
- Hub doc `system/git` seeded by the Builder (the King should refresh it each wake per crew-checkin "Hub v28.5").
- Sync: King branch stoic-darwin merged into the work branch (clean). dreamy-wright, eager-bardeen,
  inspiring-goldberg: already in. focused-cannon: only a merge commit (nothing new). funny-hawking: 16 superseded hub
  commits (6 conflicts), leave. amazing-wright: Practice Door v12 WIP with unfixed QA (65 commits, 14 conflicts):
  needs a Practice Door owner, do NOT merge as is.

## Next (AFTER ALL sync in docs/orders/hub-queue.md)
1. Full `bash tests/release_checks.sh` (with browsers: shots + design_gate on every page), background, timeout 1800,
   wait for its EXIT line. Fix or name anything red.
2. Live smoke of each page (HMP App, HQ, Practice Door, hub) per release checklist; no publishing needed unless red.
3. Write/refresh `docs/orders/everything-we-have.md` (brief: every live page + version + what it does, robots,
   what's waiting on FilthE) and post it to the hub as one event to "you".
4. Not done on purpose: pushing the work branch into the King branch (stoic-darwin) needs FilthE's OK (never push
   to another branch without it). Then STOP starting new work and wait for FilthE.

## Notes
- hub_live_check takes args to run single scenarios: `node tests/pages/hub_live_check.js round3 sunday-report`.
- The suite is at ~15 min; next scenarios should go in a second file or a --shard option.
- Known gaps: convenience #4 "your answer carried over" line never built (text unused in page); the King's Sunday
  routine should write crew/sessions.spend.week_usd or the report's $/ship reads "not tracked yet".
