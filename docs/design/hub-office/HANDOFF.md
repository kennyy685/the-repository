# Hub handoff (2026-09-28): start a fresh chat here

FilthE OK'd everything built so far (2026-09-28: "everything looks good you got an okay from me").
Old chat closed to save usage. Read SPEC.md (decisions + walkthrough notes 1-11) before building.

## Do next, in order
1. **DONE 2026-09-28: published as hub Version 27.** ~~Publish v27.1 (smoothness fix).~~ Repo `pages/crew-hq.html` (commit 6b4ff0c) = the live page with the other
   session's live-King changes merged in; `pages/hub/scene.js` + `outfits.js` carry the fix. The design gate passes.
   Artifact tool: read https://claude.ai/artifact/Qkc52bt2JL5gW7ZKWBJDHU first (a publish is refused if not read). If the
   live page differs from the repo page, merge it. Then publish with file_path `pages/crew-hq.html`, files =
   `pages/crew-hq.files.json`, label "v27.1 smoothness". Ask FilthE to open the link with `?perf` at the end and
   send a screenshot (real MacBook fps).
2. **Society test** (walkthrough note 7): it was stopped before it finished. Re-run it with a qa-tester (simulated user
   panel + standard app checks) and write the results to `SOCIETY-TEST.md`.
3. **Shortlist of valuable functions** for FilthE to pick from (note 10: "not satisfied yet").
4. **Big build v28:** re-seat the floors per AI-HUB-BLUEPRINT.md (upper = Intelligence, lower = Execution, connector),
   RIGHT NOW list, Observatory, 7-state status, workflow capsules, plus notes 1-11: rain bending up, one-building
   look, King chat bubble, fewer cameras (keep the fun ones), more sound, FilthE as a roaming CAT, closable side
   panel, declutter, English only / not HMP-branded.

## Rules FilthE set for updates
- List "Done, waiting for your OK" first, then Running, then Next. Finished work stays listed until he acks it.
- Links/domains in copy-paste code blocks. Tell him about any tool or site that would help.

## Status 2026-09-28 13:55 UTC (cloud session on claude/amazing-wright-lds9q5)
- DONE: step 1 (v27.1 live as hub Version 27), step 2 (SOCIETY-TEST.md), step 3 (FUNCTIONS-SHORTLIST.md; waiting on
  FilthE's picks), research round RESEARCH-v28.1.md (verified), design gate now checks the hub at 1440 + tabs.
- v28.0 (BUILD-v28.md): PAGE track merged here (d152125). SCENE track on branch `hub-v28-scene` (worktree
  .claude/worktrees/agent-a346cb8509bd27da4): items 1-5 committed, finishing up.
- TO SHIP v28.0: merge `hub-v28-scene` → run `node tests/pages/design_gate.js --page crew-hq` (exit 0),
  `node tests/pages/shots.js`, `bash tests/release_checks.sh --fast` → look at a 1440 shot with three.js routed locally →
  Artifact read the hub URL (read every line) → publish `pages/crew-hq.html` with `pages/crew-hq.files.json` as files,
  label "v28.0 calm and clear" → CHANGELOG + SPEC "v28.0 live" → hub check-in → push-notify FilthE.
- FilthE is near his usage limit: keep it lean (no extra QA agent unless a check fails).

## PAUSED 2026-09-28 ~14:05 UTC (FilthE near his usage limit) - resume here
- v28.0 PAGE + SCENE are both merged on claude/amazing-wright-lds9q5 (32b5d40) but NOT yet checked together and NOT
  published. Live is still v27.1 (hub Version 27). The scene builder was stopped mid-way through trimming the old
  Tour camera code and before re-rendering `pages/hub/still.webp` (the still is still v27's picture).
- Resume: (1) `node tests/pages/design_gate.js --page crew-hq` exit 0, `node tests/pages/shots.js`, `bash
  tests/release_checks.sh --fast`; (2) 1440x900 shot with three.js routed locally (robots at the v28 desks, RIGHT NOW
  verbs match the room, The Call shows the avatar or the face, never a black box); (3) re-render still.webp from
  `#capture` if time allows; (4) publish per the steps above; ping FilthE.
- Waiting on FilthE: picks from FUNCTIONS-SHORTLIST.md; "yes Fable for v28.1" or not.

## SHIPPED 2026-09-28 ~18:20 UTC: v28.0 live as hub Version 28
- Checked together (gate, shots, release checks, 1440/1512/phone/no-CDN renders), 20 fixes (commit 7cdffff) + Ledger
  Send contrast (b9acc67), still.webp re-rendered from v28. Published with `pages/crew-hq.files.json`. Screens: shots/v28/.
- The King's branch (claude/amazing-gauss-yzfpq0) has an OLDER pages/crew-hq.html: its live-King wake edits are already
  inside v28. Never publish the hub page from that branch; merge claude/amazing-wright-lds9q5 into it first.
- Next: v28.1 "One building" (BUILD-v28.md). Waiting on FilthE: picks from FUNCTIONS-SHORTLIST.md.
