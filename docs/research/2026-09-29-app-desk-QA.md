# QA: HMP App Desk (2026-09-29) - PASS (0 high, 0 medium, 2 low)

Copy of record from the QA Tester's hub done event `20260929T111500Z-qa-done` (its push was blocked; saved here by the Designer).

- Commits 0ab5885 e91c374 09c31d4 9ac6f07 (checked at dbc5c8b).
- RAN: release_checks --fast 12/12 PASS. desk_check.js PASS 6 runs (1440/1512/1280 + 390, light+dark, EN+ES).
  design_gate --page hmp-app FULL PASS: 432 views, 7110 controls, 17424 text runs at 1440/390/360/420.
  e2e_day_check PASS (EN, ES, slow signal). Eyeballed Knock 1280 dark ES and Money 1440 light ES shots: clean.
- DIFF: layout only (pages/v25/desk.css, markOpenRow() in pages/hmp-app.html, Money split into two .mcol wrappers).
  No new customer or taught text. Legal grep of added lines (free/gratis/licens*/3-day/deductible/waive/rebate): no hits.
  Wrappers are display:contents on phones, so the phone flow is unchanged.
- LOW 1: markOpenRow looped every [data-open] node on each open/close. Fixed: scoped to the lists (#lCards, #money, #tDue).
- LOW 2: CHANGELOG said "QA pending". Fixed at publish.
- NOT COVERED: real Safari / device at MacBook size (Chromium only).
