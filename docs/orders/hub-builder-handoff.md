# Hub Builder handoff (2026-09-29 ~16:30 UTC, from session_01CsyPqrNV48JSKXdYQXqqXz, past 200k tokens)

## Done
- **Hub v33 live** (AI hub version 35, "v33 live chats"): reads list_sessions every 60 s. Page grant now =
  Claude Code Remote [fire_trigger, update_trigger, get_trigger, get_session, create_session, list_environments,
  list_sessions] + sample, assets, db (read view / write admin), user. Contract 0.2.58. Real check vs my own
  list_sessions: matches (2 working Builders, King review-ready = Done, archived chats in Done). CHANGELOG + hub
  done event posted. QA's 5 v33 findings fixed before publish.
- crew-checkin skill: King hand-off step protocol (asked/noted/started/archived with `re` = tap id) + fix-* tasks.

## In the tree, NOT published: v34 = QUEUE-SPECS A + B + E (commit after 4272a30, "v34 QA fixes")
- A Hand off on every open chat card, 4-step receipt under the Chats row, archived drops the row, 30 min amber
  "Ask again", King's chat -> startFreshKing. B fix button per alert (Hand it off / Run it again / Reconnect /
  Check on it / How to fix), once per 10 min per fix id (localStorage + events `fix_id`). E whyOf(a) fallbacks.
- QA (static) findings 1-5, 6b, 6c, 8 fixed. NOT fixed: 6a spend chip has no Keep going (it's on the card/Ops
  flag), 6d stale King-titled row could start another King (isKingSess also matches title), 7 new strings EN-only
  (hub is English-only per orders; fine).
- 5 new scenarios pass (handoff, handoff-steps, handoff-king, fix-buttons, why) + live-chats.

## Next (do in order)
1. Full checks on v34: `node tests/pages/hub_live_check.js` (31 scenarios, ~15 min), `hub_chat_check.js`,
   `design_gate.js --page crew-hq` (~5 min), `bash tests/release_checks.sh --fast`. Run each with timeout 900 in the
   background; never edit crew-hq.html while they run (they read it live). Don't `pgrep -f <name>` in a wait loop:
   it matches the loop itself; wait on an EXIT line in the log.
2. Publish v34 exactly like v33: a sonnet subagent that Artifact-reads the live page first, copies pages/ into its
   scratchpad (the Artifact tool refuses /home/user/hubwork as root), publishes with pages/crew-hq.files.json files,
   NO capabilities (grant already has list_sessions). CHANGELOG line, hub done event to "you".
3. Then QUEUE-SPECS C (merge watch: King writes system/git; Merge it = board waiting item with merge:{...}) + D
   (Sunday report card, crew/weeks/<YYYY-Www>), then F (Shipped shelf, needs CONTRACT.md HUB.shipped first), then G
   (verify the 12 conveniences) + the AFTER ALL sync in docs/orders/hub-queue.md.
- Worktree note: /home/user/the-repository's local branch is a stale amazing-wright copy (50 commits); do NOT
  push it. Work in a worktree off origin/claude/amazing-gauss-yzfpq0 (`git worktree add -b hubwork <dir> origin/...`).
- Test hook: `window.__hubT` (only when the mock sets `window.__MOCK`) exposes needItems, select, computeWatch,
  alerts, fixClick, alertChip, byId, answers, whyWith.
