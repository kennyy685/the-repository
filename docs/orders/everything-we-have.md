# Everything we have (2026-09-29 evening, AFTER ALL sync by the Builder)

## Checks tonight (work branch after merging the King branch): ALL GREEN
- **pytest: 527 passed**, 0 failed. `hh.py selftest` PASS.
- **Release checks: 26 / 26 PASS** (`tests/release_checks.sh`, run in parts because the full run is longer than 10 min):
  legal + 11 module checks + selftest (13 fast) · shots, practice, full fake day, 24 h clock, hub live (50 scenarios),
  hub chat, HQ live, app live, real E2E day, bad signal, desk, open map night (12 browser) · design gate on all 4 pages
  (hub 162 views, app 4 sizes x 108 views, Practice Door 48, open map 12).
- **1 fix made:** the hub scrolled sideways on a 360 px phone (the "brief" box could not shrink below its text).
  One CSS line in `pages/crew-hq.html`; in the repo, **not published yet** (the live hub still has it; phone is "later").
- Live smoke (earlier today): all 5 live pages match the repo and render with 0 JS errors.
  Legend below: WORKS / PARTLY / BROKEN / UNVERIFIED.

## Hub (the crew's office)
- **AI Hub** https://claude.ai/artifact/Qkc52bt2JL5gW7ZKWBJDHU, v35 (Version 37). Where FilthE talks to the King, sees every robot live
  from the real chats, board, Hand off buttons, "why" lines, branch watch (unfinished work card), Sunday report, Shipped shelf. WORKS: 50 live
  scenarios + chat + shelf checks, live smoke clean. Known gaps: "your answer carried over" line never built; Sunday report $/ship reads
  "not tracked yet" until the King's Sunday run writes `crew/sessions.spend.week_usd`.
- **King Doorbell** https://claude.ai/artifact/ST8HwE23jUyazTpvHedqPx: a one-line page the hub "rings" to wake the King. Last ring is a self-test. WORKS, a workaround.
- **HMP HQ** https://claude.ai/artifact/HhK5UGhHG3VpNR7HuaqEpj: business dashboard from `hq/snapshot` (`pages/hmp-hq.html:578`).
  Version 3 (never stuck on Loading). Snapshot is refreshed only when asked. PARTLY (`tests/pages/hq_live_check.js` covers hangs/errors, not freshness).

## App (what a salesman uses)
- **HMP App** https://claude.ai/artifact/9N97Uzv8J9EAueSKhCNSPT, Version 15 "Desk" + no "free" wording (`pages/hmp-app.html` + module files, `pages/hmp-app.files.json`).
  Now / Knock / Leads / Money, EN+ES, MacBook layout. WORKS in tests: one full fake working day incl. Spanish + bad signal (`e2e_day_check.js`, `badsignal_check.js`, `desk_check.js`).
  Real db is EMPTY (0 leads/doors/claims); never used on a real door.
- **Practice Door** https://claude.ai/artifact/PFKkgWCMshKnE2nWFssM7B, Version 16 (`pages/practice-door.html`). Fake-door sales practice with scorecard. WORKS (`practice_check.js`, `fullday_check.js`).
  Practice houses are fake by design (`pages/v25/practice-houses.js`).
- **Aldaba Open Map** https://claude.ai/artifact/6LRaMpb63D8Z7UwznfqqxV, Version 15 (`docs/design/open-map/`). 7 AM home: real 2026 storm zones, top 3 with their own walks,
  "since last night". WORKS on real storm/street data (`open_map_night_check.js`). PARTLY: houses/doors on it are samples; a separate page, not inside the HMP App.
- **Aldaba Knock** https://claude.ai/artifact/9oDxg9iErVt9TteXeo5bLU (`docs/design/knock/`). Knock screen preview, QA PASS (`docs/research/2026-09-29-qa-storms-knock.md`). PARTLY: preview only, sample knocks.
- **Next-level compare page** (`docs/design/next-level/index.html`): shell only, not published. PARTLY.
- **HailHunter Core / Storm Watch** https://claude.ai/artifact/6cCATKJSoyWA7kbH4Em8VX: Cowork's, 6:54 AM. UNVERIFIED by us (read-only; Cowork's engine re-bundle T61 was never confirmed, `docs/orders/roadmap.md`).

## For the app (engine + things that run themselves)
- **Engine** `hh.py` + `hailhunter/` (13.3k lines, 40+ modules): storms, zones, walks, stacking, learning, night, season. WORKS (527 tests + selftest tonight).
- **Night shift**: trigger `trig_01C3zVLmdJNfikq5ocXwWNWQ`, 2:40 AM Central daily, last run SUCCEEDED; runs `hh.py night-shift` (`docs/orders/night-shift-runbook.md`),
  republishes only the map's `data/night.js` (brief dated 2026-09-29 in repo). WORKS; ~$0.30-0.60/night per runbook.
- **Weekly crew review** `trig_01Mg1PNnUNegxcYxmDjG3B5b`, Sundays 8:47 AM. Never run yet (next 10-04). UNVERIFIED.
- **Hub order robots** (5 poke-only triggers "Hub order -> ..."): fire on hub messages; only QA's has a recorded run. PARTLY.
- **Learning from knocks** (`hailhunter/learning.py`): honest under 20 doors, but fed only SAMPLE knocks until real knocking. WORKS, idle.
- The three 5-min King polls are gone (not in the enabled trigger list tonight). Enabled now: Night shift, Sunday review, 5 "Hub order ->" robots,
  and one-shot "King: check final sync".

## Around it
- **Print Kit** https://claude.ai/artifact/98jMahobUhX4DzyBfCRf2R (37 pieces, 09-27). PARTLY: repo PDFs were re-rendered with the "roof check" wording (982ebe2), but the published kit (09-27) predates it.
- **Legal armor**: `tests/legal_check.py` PASS; statute text in `docs/legal/`; 3-day cancel + deductible notice in the app. Contract lawyer review still deferred (`docs/memory/full-context.md:42`).
- **Crew setup**: 6 robots (`.claude/agents/`), hooks (`.claude/hooks/`), release checks, research rounds in `docs/research/`.

## Mock vs real
- REAL: 2026 hail reports, radar, Census owner/mortgage/home-age numbers, street geometry, Aldaba's nightly pick + walks (`docs/design/open-map/DATA-2026.md`).
- MOCK: every house/door on the map, Practice houses, learning knocks, "Our doors" (labeled SAMPLE). Roof age = Census estimate, permits "not checked yet".
- EMPTY: the real db. No owner names anywhere, by rule.

## Top 5 gaps to $100k by end of 2026
1. **No real houses.** Owner-occupied is per area, roof age is a guess (`full-context.md:160`). Fix: county assessor/permit data export (King's pick: draft the email for FilthE).
2. **Permit not in** (his rule before knocking). It is the calendar gate for everything; nothing we build moves it.
3. **Sales skill unproven.** Practice Door exists; lessons with Claude and real practice runs don't. Nobody has been through the door test.
4. **Boss blockers**: registration #, warranty promise, OK to say "free" (`questions-for-filthe.md:96-103`) hold the contract, homeowner screen, print.
5. **Two front doors.** Open map + Knock preview live outside the HMP App; Path step 7 "build it for real into the app" isn't done (`docs/orders/path.md`), and the claim-to-commission path is untested on real claims.

## Cut list (built, not earning their keep)
- Retired/old artifacts: Claim Tracker (`pages/claim-tracker.html`, retired into the app), HMP Tracking System, "Everything We Built", Look Book, Layouts, v25 Polish, "Paso or Ronda", Voice Test (`pages/voice-test.html`), Edge Site Map (FilthE: "forget The Edge"). Unpublish or archive.
- CruzEterna x3 artifacts: unrelated to HMP.
- Hub extras: cat, Observatory, outfits (`pages/hub/`; crew-hq.html is 4,138 lines): fun, but zero leads. Freeze further hub work.
- King Doorbell: a workaround; drop it once the hub wake is proven.
- Old remote branches: all merged or superseded except `amazing-wright-lds9q5` (Practice Door v12 WIP with unfixed QA, 14 conflicts;
  Practice Door Version 16 is live, King default: drop it) and `funny-hawking-2rytou` (16 superseded hub commits). Delete once FilthE OKs.
- Voicelog demo (`pages/voicelog`): not in `pages/hmp-app.files.json`, so not in the app.

## Waiting on FilthE
- **PR #7** https://github.com/kennyy685/the-repository/pull/7 (work branch -> main, approved by him 14:12): still open; he clicks Merge.
- Work branch and King branch (`stoic-darwin`) are synced tonight (same commit).
- Delete leftover branches `amazing-wright` + `funny-hawking` (King default: yes).
- Boss questions in `docs/memory/questions-for-filthe.md` (registration #, warranty, OK to say "free").
