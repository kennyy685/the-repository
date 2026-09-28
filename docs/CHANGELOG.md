# HMP App changelog (newest first)

## AI hub v28.1 "Know everything at a glance" - 2026-09-28 (ready, waits on FilthE's "publish hub")
- New Chats tab (S): every open Claude chat in one list, the ones that need you on top (and in your Needs strip; answer right there, the King passes it into that chat). Each shows what it's doing, what it cost, and a link to open it.
- Spend meter on top: today and this week, about. A chat that passes $25, or burns $10+ an hour, gets flagged "Hand it off?" with one button (the King has it write its note and start fresh).
- "Is everything running?": every scheduled job with On / Paused (grey, on purpose) / Broke (red, and an alert), last run and next run. "Ready to ship" cards on the Board: what it is, QA result, what changes, Preview, one Ship it button. Answers now wake the King a few seconds after you tap (the 90-second wait is gone).

## Practice Door v12 - 2026-09-28
- 10 new homeowners: the rest of the sale after the knock (damage found, deductible shock, the first check, the adjuster visit, partly covered, "second thoughts" call, job done) plus someone who looks you up, a bilingual couple and an old storm. New "After the knock" section.
- Houses and the Random homeowner now match Fremont (real house ages, Spanish speakers, retirees, hail season vs. winter). The next step is scored on storm doors too, plus 10 scene checks, 4 drills and 13 new answers in EN/ES.
- Tighter legal backup: offering to file or call the insurer "for you", free extras to cover the deductible, a different storm date, and a reward for a review now get flagged.
- QA fixes before publish (not live yet): "signed with another company" card now says 3 business days and never nudges them to cancel; no financing promise; no claim advice on the partly-covered letter; "registered and insured", never "licensed"; cancel form in English AND Spanish; rookie hints, cheat sheet (no door tips after the knock), Spanish-only check, dark-theme seam and MacBook layout fixed.
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
