# QA 2026-09-29: Path step 4 (real 2026 storms) + Knock screen mockup

Branch claude/amazing-gauss-yzfpq0 @ 0278929. Verdict: **Job 1 PASS (0 high, 0 medium, 3 low). Job 2 PASS with fixes (0 high, 2 medium, 4 low).**
No blocking issue for job 1. Job 2 is a design mockup that is never published; the 2 medium lines must be fixed before the Knock screen is built into the HMP App.

## Checks run
- `python3 -m unittest discover -s tests` (pytest is not installed here): **447 tests OK** (27 s), includes tests/test_season.py (13).
- `bash tests/release_checks.sh --quick`: **all 17 PASS** (legal_check, 9 module checks, hh_selftest, shots, practice, fullday, day24, badsignal, design_gate --quick). Logs: tests/pages/out/release_checks/.
- Headless Chromium (/opt/pw-browsers, Playwright) on docs/design/knock/index.html via local server, 1440x810 EN dark/light, 1280x800 ES light, 1470x866 ES: clicked all 5 outcome buttons (1-5), every toast refine button (come back x3, roofer x3, don't-knock-again, door hanger), "No soliciting sign", Undo, all 6 damage-seen toggles, YES sheet (every option button, phone field, Save lead), 3 log tabs, keys 1-5/S/Z/arrows/Esc, theme + EN/ES toggles. **0 page errors, 0 console errors** except one 404 for /favicon.ico (server, not a code fault). No horizontal scroll at any size.
- design_gate.js does not cover docs/design/knock (it reads pages/*.html); not run for it. Not published, so no gate needed.

## Job 1: storms + likely-insured (data/storms-2026.json, hailhunter/season.py)
PASS. Evidence:
- Real public data: 202 NE hail reports (LSR 202, SPC 168, NCEI 144), 8,050 NEXRAD signatures, 25 MRMS grids, Census ACS 2020-2024. I re-pulled the Iowa Mesonet LSR feed for 2026-04-23 and the top zone (Malcolm, 1.75 in, "5 SE Malcolm" 19:28 UTC, 40.86/-96.79) matches exactly. Sources have URLs in `sources[]`. errors[] is empty.
- No owner names or houses: report keys are only id/date/time/lat/lon/size/place/location/county/state/by/sources; `by` values are reporter types (Public, Trained Spotter...), no free text; no "licen*" anywhere.
- "Likely insured" everywhere: labels "Likely insured: high|medium|low" / "Probablemente asegurado: ..."; the word "insured" never appears alone; note says "never a fact about one home". Fields named `likely_insured`.
- hud.json contract intact: diff of hh.py + config.py is additive only (new `season` subcommand + config block); `season` never touches hud.json, the database or `refresh`; ids `<day>_<Town>`, `stops[].pid`, target key "address|city" not touched. hh_selftest PASS.
- Bbox check: all 202 reports inside the bbox, all NE; 211 unique zone ids.

Low, non-blocking:
1. low, data/storms-2026.json (zones `*~rural-area`, 93 radar zones): radar-only zones carry `hail_in` up to 4.21 in (MRMS MESH runs high; score is discounted x0.8 but the displayed size is not). Map should show radar size as "radar est." and cap or omit the number above 2.75 in. Fix: in season.py set `hail_in = min(mesh*mesh_trust, 2.75)` for `hail_basis == "radar"`, or label it in `why[]`.
2. low, zone `2026-04-23~malcolm`: `signals.homes` = 41,532 for an 8-zone at Lincoln's edge (block groups whose middle is inside a 2 km buffer are huge on the fringe). Homes weight (20%) inflates fringe zones; consider capping `homes` at homes_full or using area-weighted share.
3. low, zones named "Rural area": name has no town. Show `near_town` ("Rural area near Lincoln") in the UI.

## Job 2: Knock screen mockup (docs/design/knock/)
Passes: 69-1602 line present on every door ("At the door, first: your name . HMP Siding & Roofing . roofing, siding, gutters", index.html:619, name + HMP + what we sell first); no deductible offer (44-8604 line says the opposite); "insured" only as "likely insured/probablemente asegurada" and the reminder that the app never says a home is insured; no "licensed/licenciado"; no financing/price/warranty/start-date promise; no owner names (walk.json has none); "nearest report ... not confirmed at this address"; cancel form EN + ES reminder in the YES sheet; EN/ES switch complete (every string in T has en + es); no coaching prose (only law reminders + a collect checklist); MacBook Air layout fits 1440x810 / 1470x866 / 1280x800 without page scroll.

Findings:
1. **medium, docs/design/knock/index.html:497 (lg3 EN + ES)**: "3-day cancel form" / "formulario de cancelacion de 3 dias". The law is 3 BUSINESS days (69-1601(1)(c), 44-8603, docs/legal/*-summary). Fix EN: `An inspection is not a sale. Any sale later: the cancel form (3 business days), English and Spanish, every time.` ES: `Una inspección no es una venta. Cualquier venta después: el formulario de cancelación (3 días hábiles), en inglés y español, siempre.` Regex that would catch it next time: `\b3[- ]?d[ií]as?\b(?!\s+h[aá]biles)|\b3[- ]day\b(?!s? business)|three days(?! business)` on customer/taught lines.
2. **medium, index.html:480 (f_what EN + ES)**: "They agreed to a free inspection of" / "Aceptó una inspección gratis de". "Free" is a price promise the boss has not made (only docs/orders/sales-path.md uses it). Fix: `They agreed to an inspection of` / `Aceptó una inspección de`. Regex: `\bfree\b.{0,25}(inspect|estimate|quote)|(inspecci[oó]n|estimado|cotizaci[oó]n)\s+gratis`.
3. low, index.html:509 (hail tile label "Hail that hit it" / "Granizo que le pegó"): states hail hit this house, but the chip says "nearest report, 0.8 mi" and the README promises "never confirmed at this address". Fix: `Hail near it` / `Granizo cerca`.
4. low, index.html:749 chip "PA lic.": abbreviation of "public adjuster license" is cryptic and contains "lic."; use `Adjuster law` / `Ley de ajustadores`.
5. low, index.html:450 / 495: ES "Probablemente asegurada" (agrees with casa) vs engine label "Probablemente asegurado" in storms-2026.json; pick one so the map and door match.
6. low, layout: at 1280x800 the door body scrolls 87 px, so the "If they say yes, collect" row sits below the fold; at 1440x810 the last YES-sheet answers ("Prior claim: Not sure") clip 40 px until scrolled. Fine for a mockup; fit before building. Also add a favicon link (`<link rel="icon" href="data:,">`) to silence the 404.

Not checked: no real phone layout (out of scope per CLAUDE.md); Spanish read by eye only, not by Alex Mendez.
