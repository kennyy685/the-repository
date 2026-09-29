<!-- Saved from hub event events/20260929T132000Z-qa (agent qa-tester, 2026-09-29T13:20:00Z) by the Builder on 2026-09-29: the QA session's push was blocked. -->

# QA: open map, every card draws its own walk (2026-09-29)
Order: hub event 20260929T124500Z-engine. Commits f396e82, afa45f8, c260ec9 on claude/amazing-gauss-yzfpq0.

PASS: 0 high, 0 medium, 3 low

## Ran
- `bash tests/release_checks.sh --fast`: 12/12 PASS (legal_check, module checks, hh_selftest). shots.js and full gate skipped by --fast.
- `python3 -m pytest -q tests`: 519 passed (incl. test_every_card_gets_its_own_walk).
- `node tests/pages/open_map_night_check.js`: PASS (incl. 7d: Columbus pick draws its own walk on real streets).
- `node tests/pages/design_gate.js --page open-map`: PASS, 1440 wide, light + dark, EN. `--self-test`: PASS (8/8 x3).
- Read the diff: hailhunter/mapwalk.py extra(), hh.py night_cmd, open-map index.html (NIGHT_X, AX(), previewWalk, switchCard, knockPlan pin).

## Code read
- mapwalk.extra keys zwalks by zone_id, keeps walks by area (first card wins) for older pages; JS validates both (finite numbers, escaped names, 12 max). Copy of walk doc made, brief's docs unchanged. OK.
- hh.py fallback path `mw={"walks":{},"tiles":[]}` has no zwalks; guarded with `.get`. OK.
- AX(id,z) falls back to AREAX when the card has no zwalk; knockPlan pins AXZ to the pick and resets in `finally`. OK.
- Names go through escN/esc before innerHTML/data attributes. No new outside-data injection path found.

## Legal read (night.js + diff strings, EN + ES)
- Only "Likely insured: high" / "Probablemente asegurado: alto"; no "insured" alone, no "licensed", no free/gratis, no deductible, financing or warranty words, no 3-day text (none needed on this screen).
- No owner names or house numbers: walks are street runs only. "owner-lived" is a Census share, not a person. OK.

## Findings (low)
1. low, docs/design/open-map/data/night.js (why/"51 days ago"): brief dated 2026-09-29, hail Aug 8 = 52 days by calendar. Likely a UTC-vs-local-evening off-by-one. Fix: compute days from the storm's local (America/Chicago) date, or confirm the storm timestamp is Aug 9 UTC. Test case: storm 2026-08-08 23:00 CT, brief 2026-09-29 -> "52 days ago".
2. low, tests/pages/design_gate.js: open-map gate renders EN only; Spanish card labels (long "Maneja a ... empieza en ...") not checked for overflow at 1440. Fix: add an ES pass for open-map, or eyeball one ES shot.
3. low, requirements.txt: fresh sandbox `pip install -r requirements.txt` aborts on Debian's blinker; QA needed `pip install --ignore-installed blinker -r requirements.txt pytest`. Fix: note it in docs/orders/crew-setup.md.

Not run: full release_checks (no --fast) and live-map click-through of switching cards in a real browser (covered only by open_map_night_check).

