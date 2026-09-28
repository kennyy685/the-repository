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
