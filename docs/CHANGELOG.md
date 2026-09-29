# HMP App changelog (newest first)

## Open map: every card draws its own walk - 2026-09-29 (every-card-walk; QA pending, then republished)
- Each of Aldaba's top 3 and the backup now has its own walk on real streets, not just #1. Tap #3 (another Columbus turf) and the map swaps to that turf's walk; tap the Omaha older-homes backup and its walk is drawn in Omaha. Today's plan stays on the pick's walk.
- The night shift makes them all every night (`map.zwalks` in `data/night.js`); nothing new to run. Streets only: no house numbers, no door points, no owner names.

## HMP App "Desk" - 2026-09-29 (MacBook layout; QA PASS, live: HMP App Version 14)
- On the MacBook the app fills the screen now: tabs in a left rail; Now = the hot-zone map large with Aldaba's pick under it and today's plan + calls beside it; Knock = the next 9 doors | the current door, big, with 4 big taps | the whole walk on a full-height map. One tap per door is still one tap.
- Leads and Money open a lead or job as a pane on the right: the list stays live (click another lead to swap), the open row stays lit; Money shows what's owed + to chase beside the open jobs. Short menus (Add, More) open as a centered card.
- The toast never covers the door card, the pane or a legal notice (on a phone the sheet now scrolls its last line clear of it). Phones keep the old layout exactly. New check `tests/pages/desk_check.js`; the design gate now runs the app at 1440 and 390 too. Options + why A: docs/design/app-desk/.

## Open map: every pick draws its walk - 2026-09-29 (map-west; QA pending, then republished)
- Tap Aldaba's pick anywhere (Columbus, Schuyler, David City, Fremont, Blair, Wahoo, Omaha-Lincoln) and the map draws that pick's own walk: the Knock app's order, starting on the start street (tonight: 22 St, then 21 St), on real streets. Street by street, corner to corner: no house numbers, no door points, no owner names.
- Outside the old Omaha-Lincoln street box the night shift adds a small street tile around the walk (~15-30 KB, gis.ne.gov, same source as the rest of the map), so the page stays light on hotel wifi. It all rides in `data/night.js`; the night routine is unchanged.
## Open map: top 3 agrees with Aldaba's pick - 2026-09-29 (open map republished; QA PASS, its 3 notes fixed)
- "Aldaba's top 3" now follows the night brief: #1 = Aldaba's pick, #2 = the backup, then the next storm walk (tonight: Columbus 22 St & 21 St, Omaha older homes, Columbus 36 Ave & 18 St). No more Malcolm on the list while the pick says Columbus.
- A pick outside the old map box (Columbus) now opens as a real area, and the home view widens to show the pick + backup. The brief carries it (`top` + `map` in `data/night.js`), so it stays right every night with no extra step.
## Roof-check wording - 2026-09-29 (live: Practice Door Version 15; QA PASS)
- Practice Door, print sheets and the door lines now say "roof check" / "revisión del techo", never "free inspection" / "gratis" (King's call until the boss okays promising free).
- The scorecard neither rewards "free" nor penalizes "roof check"; "free estimate" is still used and flagged for the boss.
- PDFs in docs/print not re-rendered (no script): re-print from the HTML before handing out.

## Night shift real - 2026-09-29 (open map: QA pending, then republished)
- "Since last night" now shows the REAL brief: last night's real storm reports, the engine's real walks, real streets. Aldaba's pick is always a storm walk (tonight: Columbus, 1.6" hail Aug 8, 25 doors); an older-homes area is only ever the backup, and when no storm walk has doors left it says so and names the backup. The map names the start street, never a house number.
- One command runs the whole night with no human (`python3 hh.py night-shift`: refresh, brief, the map's `data/night.js`, then one publish line); runbook `docs/orders/night-shift-runbook.md` for a ~2:40 AM routine (~12 min, about $0.30-0.60 a night).
- SAMPLE tag only on the samples, which moved under Preview (Last night / Quiet night / Storm night). A failed storm update says so on the strip. The open map is now in the design gate (night strip, 1440 dark + light) and has its own page check.

## HMP App "Proven day" - 2026-09-29 (live: HMP App Version 13; QA PASS)
- A full real work day now runs as one automatic test (7 AM map -> knock -> lead -> inspection -> claim -> price -> contract -> follow-ups -> day numbers), in English, Spanish and on a slow signal: `tests/pages/e2e_day_check.js`, part of the release checks.
- A bad signal never loses a tap now, even if the app closes mid-save, and every Done shows at once instead of waiting. "Done for today" opens the review right away.
- The contract step shows the fixed cancel notice (EN + ES, with the cancel date) and the deductible notice word for word, one tap each. Report: docs/research/2026-09-29-app-e2e.md.
- Safer by default (King's calls on QA's notes): the 3-day cancel date now skips Saturdays too until the boss confirms (a later date is always safe; dates already written stay), and the app says "roof check" / "revisión del techo" instead of "free inspection".

## Night shift "Since last night" - 2026-09-29 (live: open map Version 8; QA PASS)
- While you sleep, Aldaba gets your morning ready: the open map's 7 AM home now opens with "Since last night": new hail by town and size, zones that moved up or down, walks that changed (doors knocked), and a plain line like "No new hail since last night; best zone is still Malcolm." Tap any chip to fly there. Your top 3 show "↑ from #5" when a zone climbed overnight.
- Engine `hailhunter/night.py` + `hh.py night`: refresh, re-rank, then one small brief (Aldaba's pick + where to start the walk + door count + why + a backup zone), keeping last night's for the diff. The page runs on SAMPLE briefs (a quiet night, and a replay of the real Sep 13 storm night; switch under Preview). hud.json and Storm Watch untouched; nothing is scheduled yet (the King decides).

## AI hub v28.4 "King wake that lands" - 2026-09-29 (live: hub Version 34)
- Your hub messages now reach the King's own chat: the page books the King for the next whole minute (a timed wake) instead of the old instant poke, which opened a stand-in chat the King never saw. The hub says "The King gets it in about a minute". The first time, claude.ai asks you to Allow the new permission once.
- QA fixes before going live: the page now has permission to book that timed wake, and the "did it arrive?" re-check runs (it used to crash quietly), so a wake that never went shows "Didn't reach the King" with a Retry button.

## AI hub v28.3 "One building" - 2026-09-29 (live: hub Version 33)
- One building: a bronze frame runs through both floors around the glass tube, with a stair landing and a planted terrace. The Observatory sits on the tube top: a ring table showing research / build / QA lanes, what needs you, Flow, Friction and Shipped (key O, plus an Observatory card in the Crew tab).
- Work rides the tube: when a robot hands off, a capsule travels to the next robot with a fading thread, and RIGHT NOW says "Handing to QA Tester". One dry line under the top band says what just happened.
- Your cat (Miso by default; name, coat and on/off in Make it yours): roams both floors, naps in the sun, sits on keyboards, knocks pencils off desks. A robot that needs you goes and plays with it, once per question (never nags). Y = where's my cat; Pet and Treat in the ··· menu. New Report card in the Crew tab: one line per robot job, good or redo, why, cost.

## The map learns from your knocks - 2026-09-29 (live: open map + Knock preview, 2026-09-29)
- Every door you log now builds a track record. The Knock door card says "Doors like this: 2 inspection yeses from 34 doors (~6%)" (same hail size, likely-insured signals, roof age); each of the map's top 3 says "This zone" or "Zones like this" the same way.
- Honest by design: under 20 doors it says "not enough doors yet (7 of 20)", never a %; the % leans toward a typical 5% while doors are few; once knocks are real, a good record moves a pick up at most 15% (sample knocks never reorder the picks).
- Engine `hailhunter/learning.py` + `hh.py learn`; the pages run on made-up SAMPLE knocks (fake homes, tagged SAMPLE) until real knocking starts. hud.json and Storm Watch untouched.

## Storm stacking + roof-age band - 2026-09-29 (live: open map + Knock preview, 2026-09-29)
- A zone or house hit by hail again and again now ranks a bit higher (x1.15 for 2 hail days since 2024, x1.3 for 3+, capped) and says so in one line: "Hail here 4 times since 2024". Real public reports (NWS, SPC, NOAA) within 5 km; 2024-2025 history pulled by the new `hh.py stack-history`.
- Knock screen: the roof tile now flags the roof age: young, prime (8-14 yrs) or "check the policy first" (15+), always marked an estimate; old houses say "roof age unknown". Each knock saves the repeat-hail count and roof band so Aldaba can learn which ones lead to a yes.
- Engine: today's walk and zone walks use the same bump (no data files = no change); hud.json and the 6:54 AM Storm Watch are untouched.

## Open map v5 "Real storms" - 2026-09-29 (live: open map Version 5, 2026-09-29)
- The map now shows the real 2026 hail season: 57 zones from 17 storm days around Fremont, Omaha and Lincoln (plus 141 more in Eastern Nebraska, off this map). Default view is the whole season since Mar 1.
- The 7 AM home picks Aldaba's top 3 from real storms (Malcolm #1 today), each with its storm date and one-line reason; "Start knocking" opens the Knock page.
- Nothing made up on real zones: home age comes from the Census, permits say "not checked yet", radar-only zones say so and ask you to see damage first. Houses, doors and visits are still samples.

## HMP App + Practice Door "Never stuck" - 2026-09-29 (live: HMP App Version 12, Practice Door Version 14, 2026-09-29)
- The App can't hang anymore: loading, the Right Hand chat, photo uploads and Help me say it all have time limits, and a slow connection still goes live when it finally answers.
- Practice Door always gives you the text box back, even if the homeowner or the hint never answers.
- 13 old unused pieces of code removed; a new release check runs both pages on realistic data with a connection that works, fails or hangs.

## AI hub v28.2 "Never frozen" - 2026-09-29 (live: hub Version 31, 2026-09-29)
- Fixed the freeze: a 3D room the computer can't draw fast enough (or software graphics) now switches to the still picture by itself instead of making every click and key wait. Make it yours has a new "3D room on/off" switch.
- Every call to Claude, the database and Claude Code now has a time limit, and nothing asks for a Claude Code permission unless you clicked. A held wake waits behind a "Wake now" button, and Fresh King always comes back with an answer.
- Lighter and steadier: the board keeps your half-typed answer, the chat and board only redraw when something changed, one live connection instead of reconnecting on every click, gentler log cleanup. New release check: the hub on real data with a runtime that fails or hangs.

## AI hub v28.1 "Know everything at a glance" - 2026-09-28 (live: hub Version 30, 2026-09-28)
- New Chats tab (S): every open Claude chat in one list, the ones that need you on top (and in your Needs strip; answer right there, the King passes it into that chat). Each shows what it's doing, what it cost, and a link to open it.
- Spend meter on top: today and this week, about. A chat that passes $25, or burns $10+ an hour, gets flagged "Hand it off?" with one button (the King has it write its note and start fresh).
- "Is everything running?": every scheduled job with On / Paused (grey, on purpose) / Broke (red, and an alert), last run and next run. "Ready to ship" cards on the Board: what it is, QA result, what changes, Preview, one Ship it button. Answers now wake the King a few seconds after you tap (the 90-second wait is gone).

## Practice Door v12 - 2026-09-28 (live: Practice Door Version 13)
- 10 new homeowners: the rest of the sale after the knock (damage found, deductible shock, the first check, the adjuster visit, partly covered, "second thoughts" call, job done) plus someone who looks you up, a bilingual couple and an old storm. New "After the knock" section.
- Houses and the Random homeowner now match Fremont (real house ages, Spanish speakers, retirees, hail season vs. winter). The next step is scored on storm doors too, plus 10 scene checks, 4 drills and 13 new answers in EN/ES.
- Tighter legal backup: offering to file or call the insurer "for you", free extras to cover the deductible, a different storm date, and a reward for a review now get flagged.
- QA fixes (in this live version): "signed with another company" card now says 3 business days and never nudges them to cancel; no financing promise; no claim advice on the partly-covered letter; "registered and insured", never "licensed"; cancel form in English AND Spanish; rookie hints, cheat sheet (no door tips after the knock), Spanish-only check, dark-theme seam and MacBook layout fixed.
- Built on top of v11 (Plan, top 15, Aldaba look): new homeowners in v11's cards, the MacBook picker fills every row, top-15 card 4 now asks one question first (merged with the research drill, one answer per objection), and v11's HOA card no longer trips the deductible check.

## AI hub v28.0 "Calm and clear" - 2026-09-28 (live: hub Version 28)
- RIGHT NOW list on the right: every robot's status in one line (needs you, stuck, working, queued, done, free, asleep, quiet). Robots now sit by kind of work: upstairs thinks (Research Lead, QA, Storm Watch), downstairs does. Press V and the room goes grey so only problems stay lit.
- Calmer screen: P hides the side panel (it slides back when something needs you), a round chat bubble bottom-right talks to the King (K), 4 camera buttons (Whole, Follow, Eyes, More), name tags only when they matter, straight rain only in the sky, English only, named "AI Hub".
- The Call shows the robot's real face (was a black box), more sounds (still off by default, with a volume slider), and about 20 fixes from a full check before going live.
- Talk to the King right in the hub: the chat bubble opens a King thread (your message wakes Claude Code at once; its reply lands in the same thread as easy-to-read paragraphs and numbered questions, with a dot and a toast). The Right Hand is one tap away for instant answers.

## AI hub v27.1 - 2026-09-28 (live: hub Version 27)
- Smoother: robots no longer redraw the room's shadows every frame (the stutter); shadows only update when the light moves.
- Shadow glitches fixed (shadow settings follow the sun's angle; the shadow area fits the building). Lighter on Retina Macs.
- Add ?perf to the hub link to see live speed numbers in the corner.

## v25.3 - 2026-09-28
- Practice mode (60 practice houses, a full fake sales day) to try the app risk-free; Calls today on Now (account hits + business calls) and a storm-age line on claims.
- Legal locks: tear-off/install can't be logged until the itemized description reached the homeowner AND the insurer (44-8606) and the 3-day cancel window is over; the spoken door opener now says the knocker's own name in EN and ES (69-1602), not always Alex's.
- Midnight/Central-time fixes (day-keyed listeners roll over correctly, the 7 PM Central off-by-one is gone), a bad-signal-safe outbox retry scheduler, and coaching/sales-script text removed from the app (a pro needs eyes and memory, not canned lines).

## Practice Door v11 - 2026-09-28
- New Plan tab: the 4-week practice-only path (docs/orders/sales-path.md) with today's day on top of Practice, one tap to start each step (language, homeowner and Rookie mode set for you), a checkbox per day and its own streak. Saved on this device only.
- Ready-to-knock checklist that checks itself from your practice (opener passes in a row per language, runs, Rookie-off runs, drills passed, clean trap and Spanish-only runs, streak), plus "I can" for the one only you can judge.
- Objections tab: the top 15 legal answers, EN and ES side by side, searchable, with "I know it by heart" marks (they feed the checklist). Lesson prompts are buttons: copy or open straight in Claude.
- Aldaba look (graphite by default, Bricolage titles, the Aldaba mark) and a two-column MacBook layout; phone layout unchanged in order.

## AI hub v27 "Nocturne" - 2026-09-28
- One MacBook screen, no page scroll: the office fills it and a side panel has Crew / Board / Log / Chat tabs. New dark night look (champagne = working, orange only when something needs you), "Make it yours" to change it, a living "mind" in the sky, and trackpad scroll flies the camera in.
- Answer from the top bar, task cards, search (/), keyboard shortcuts (? shows them), reconnects by itself after the Mac sleeps, refresh with R, proof your answers landed, plus 12 conveniences (smart King wake-ups, missed-run alerts, "Not now" that comes back, a morning note).
- New outfits and personalities, robots notice you and your cursor, the line at your spot, poke/coffee reactions, stand-ups and celebrations, 9 camera views (blueprint, security cam, ride-along, robot eyes, director mode...).
- AI hub: Chat wakes the live King instantly; no scheduled runs.

## v25.2 - 2026-09-27
- Job tracker on every insurance claim: the 14 steps from the contingency agreement to the thank-you note, each with who does it, the papers by name, when, the legal line and the money. One tap logs a step with today's date (Undo on the toast); done steps fold into one line.
- Hard stops: tear-off can't be logged until the itemized description went to the homeowner AND the insurer (NE 44-8606) and the 3-day cancel is over (the end date shows); materials can't be logged until the ACV check is deposited or a supplier account is approved. The Right Hand chat follows the same stops and logs the new steps ("permit pulled, number 1234").
- Due reminders in amber (today) and red (late): mortgage endorsement the day the ACV check comes, depreciation request the day the job finishes, review link within 24 hours, warranty registration. The door opener now says your name, HMP and what we sell first (NE 69-1602).

## AI hub v26 "Penthouse HQ" - 2026-09-27
- The hub opens on a live 3D office on two floors (slide down, suction tube up). Every AI is a robot dressed for its job and moves when it really checks in: working at its desk, waiting at "your spot", stuck with a red light, asleep in a charging pod, a sparkle when it finishes.
- "Needs you" at the top: board questions and any robot waiting on FilthE. Tap one to answer Yes / No / Not now or type a reply; Claude Code is woken in seconds. Camera buttons (All / Up / Down / Follow), live Fremont sky, a "while you were away" replay, progress rings, a trophy wall and an optional ding.
- Board, Claude Code's orders, memory, the Right Hand box and both logs are below the office, EN/ES everywhere. New robot: the Chat Reader, which keeps the King up to date on other chats.

## v25.1 - 2026-09-27
- New look, the brand page FilthE picked: dark graphite by default (even when the phone is in light mode), silver text, one orange "do this" button with a soft glow, cards with thin edges and depth. More > Theme: Dark / Light / Auto, saved per phone (every phone starts on Dark once).
- Real fonts now load with the app (Geist, and Bricolage for screen titles and big numbers like knocks today, the stop address and owed to HMP); before, phones showed their own font.
- Top bar shows the app's own mark; everything a homeowner sees (homeowner view, print pieces, texts) still says HMP Siding & Roofing. Sheets slide in and out; nothing else moved.

## v25 - 2026-09-27
- New v25 look in light and dark (Theme: Auto / Light / Dark in More, saved per phone), one icon set, and the Right Hand bar docked above the tabs.
- Now shows the best zone on a street map with Drive / Start knocking and today's appointments; Knock shows the next door, four big answer buttons and "Stop 3 of 25"; Money shows what's owed to HMP and what to chase.
- New homeowner view (Your home, Photos, Options, Next steps) with the 3-day cancel notice in English and Spanish; the quick-price sheet no longer scrolls sideways on phones.

## Practice Door v10 - 2026-09-27
- New v25 look (light + dark): homeowner cards with icon, difficulty and language chips; chat-style door with the homeowner's avatar and a mic + keyboard bar; cheat sheet as a bottom sheet; scorecard with a big score, pass/fail rows and "Knock again" always at the bottom.
- Two new hard legal flags, same stop as the deductible: promising their insurance rate won't go up (EN/ES), and "licencia / con licencia" about HMP in Spanish (say "registrados").
- Cheat sheet adds 21 pro door lines (round 47), the 22-line Spanish playbook (round 49) and 3 first-3-seconds moves; Spanish talks now score "usted" as a coaching point, not a legal fail.

## v24.1 - 2026-09-27
- Fixed blank white buttons in dark mode, duplicate menus, "Built 1980" twice, wrong map caption.
- Knock hours: shown only where they're verified (Omaha 8-6, Lincoln 8-8); calm one-line status.
- Right Hand bar docked above the tabs, never covering cards.

## v24 - 2026-09-26
- New layout: Now / Knock / Add / Leads / Money; Ledger theme; hot-zone map first.
- Sale Guide, one Due list, 2/5/10-day follow-ups, end-of-day review, referral thank-you note.
- Legal steps: 3-day cancel (69-1606(5)), itemized description to insurer (44-8606), no assignment of benefits.

## v23 - 2026-09-26
- Faster first screen and taps; AI hub removed from the app; 44 px tap targets.
