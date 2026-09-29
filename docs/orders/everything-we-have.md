# Everything we have (2026-09-29, Research Lead; the King updates it at the end of the round)

Checked today: 521 engine/unit tests OK + `hh.py selftest` OK + all module checks PASS (`tests/release_checks.sh --fast`).
NOT re-run today: the browser checks (shots, e2e day, desk, design gate); versions and "works" for those come from
the CHANGELOG (`docs/CHANGELOG.md`, QA PASS lines) + the live Artifact read. Legend: WORKS / PARTLY / BROKEN / UNVERIFIED.

## Hub (the crew's office)
- **AI Hub** https://claude.ai/artifact/Qkc52bt2JL5gW7ZKWBJDHU, v34 (CHANGELOG "King wake that lands"). Where FilthE talks to the King,
  sees robots, board, sessions. WORKS on the real db shapes (`tests/pages/hub_live_check.js`, `hub_chat_check.js`). PARTLY: whether a hub message
  actually lands in the live King chat was still unproven at last handoff (`docs/orders/king-handoff.md` "Real test"); v34 changes how it wakes.
- **King Doorbell** https://claude.ai/artifact/ST8HwE23jUyazTpvHedqPx: a one-line page the hub "rings" to wake the King. Last ring is a self-test. WORKS, a workaround.
- **HMP HQ** https://claude.ai/artifact/HhK5UGhHG3VpNR7HuaqEpj: business dashboard from `hq/snapshot` (`pages/hmp-hq.html:578`). Last published 09-27;
  snapshot is refreshed only when asked. PARTLY (`tests/pages/hq_live_check.js` covers hangs/errors, not freshness).

## App (what a salesman uses)
- **HMP App** https://claude.ai/artifact/9N97Uzv8J9EAueSKhCNSPT, v14 "Desk" (`pages/hmp-app.html` 6,205 lines + 20 module files, `pages/hmp-app.files.json`).
  Now / Knock / Leads / Money, EN+ES, MacBook layout. WORKS in tests: one full fake working day incl. Spanish + bad signal (`e2e_day_check.js`, `badsignal_check.js`, `desk_check.js`).
  Real db is EMPTY (0 leads/doors/claims); never used on a real door.
- **Practice Door** https://claude.ai/artifact/PFKkgWCMshKnE2nWFssM7B, v15 (`pages/practice-door.html`). Fake-door sales practice with scorecard. WORKS (`practice_check.js`, `fullday_check.js`).
  Practice houses are fake by design (`pages/v25/practice-houses.js`).
- **Aldaba Open Map** https://claude.ai/artifact/6LRaMpb63D8Z7UwznfqqxV, v13 (`docs/design/open-map/`). 7 AM home: real 2026 storm zones, top 3 with their own walks,
  "since last night". WORKS on real storm/street data (`open_map_night_check.js`). PARTLY: houses/doors on it are samples; a separate page, not inside the HMP App.
- **Aldaba Knock** https://claude.ai/artifact/9oDxg9iErVt9TteXeo5bLU (`docs/design/knock/`). Knock screen preview, QA PASS (`docs/research/2026-09-29-qa-storms-knock.md`). PARTLY: preview only, sample knocks.
- **Next-level compare page** (`docs/design/next-level/index.html`): shell only, not published. PARTLY.
- **HailHunter Core / Storm Watch** https://claude.ai/artifact/6cCATKJSoyWA7kbH4Em8VX: Cowork's, 6:54 AM. UNVERIFIED by us (read-only; Cowork's engine re-bundle T61 was never confirmed, `docs/orders/roadmap.md`).

## For the app (engine + things that run themselves)
- **Engine** `hh.py` + `hailhunter/` (13.3k lines, 40+ modules): storms, zones, walks, stacking, learning, night, season. WORKS (521 tests + selftest today).
- **Night shift**: trigger `trig_01C3zVLmdJNfikq5ocXwWNWQ`, 2:40 AM Central daily, last run SUCCEEDED; runs `hh.py night-shift` (`docs/orders/night-shift-runbook.md`),
  republishes only the map's `data/night.js` (brief dated 2026-09-29 in repo). WORKS; ~$0.30-0.60/night per runbook.
- **Weekly crew review** `trig_01Mg1PNnUNegxcYxmDjG3B5b`, Sundays 8:47 AM. Never run yet (next 10-04). UNVERIFIED.
- **Hub order robots** (5 poke-only triggers "Hub order -> ..."): fire on hub messages; only QA's has a recorded run. PARTLY.
- **Learning from knocks** (`hailhunter/learning.py`): honest under 20 doors, but fed only SAMPLE knocks until real knocking. WORKS, idle.
- Three 5-min King polls are enabled ("hub chain poll", "check 4 robots", "Check QA verdict"): usage burners (see Cut list).

## Around it
- **Print Kit** https://claude.ai/artifact/98jMahobUhX4DzyBfCRf2R (37 pieces, 09-27). PARTLY: PDFs in `docs/print` not re-rendered after the "roof check" wording change (CHANGELOG).
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
- King Doorbell + three 5-min polls: a workaround plus usage burners; drop the polls once the wake is proven.
- Old remote branches: the 09-29 branch sync (9d39a8f) merged or superseded most; delete the leftovers once the King confirms.
- Voicelog demo (`pages/voicelog`): not in `pages/hmp-app.files.json`, so not in the app.
