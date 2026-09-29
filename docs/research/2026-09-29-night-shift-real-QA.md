<!-- Saved from hub event events/20260929T0915Z-qa-done (agent qa-tester, 2026-09-29T09:15:00Z) by the Builder on 2026-09-29: the QA session's push was blocked. -->

# QA report (2026-09-29)

QA night shift real (head 8b4f0bc, branch claude/amazing-gauss-yzfpq0). Save as docs/research/2026-09-29-night-shift-real-QA.md.
PASS: 0 high, 0 medium, 2 low.
RAN: release_checks --fast 12/12 PASS (needed pip install --ignore-installed blinker -r requirements.txt first; fresh container has no numpy/pandas, runbook step 1 already says so). unittest discover 515 OK (tests.test_night 30 OK). node tests/pages/open_map_night_check.js PASS. design_gate --page open-map PASS (1440, dark+light, 42 controls). hh.py night-shift --dry-run exit 0, ends with DRY RUN {url, file_path docs/design/open-map/index.html, files {data/night.js}} matching runbook step 4. NOT run: full design_gate/shots (--fast skips), real network refresh (~12 min).
RULES: pick = storm only (Columbus 2026-08-08, 52 days, inside 60-day Sept limit), backup = everyday (Omaha). No owner names; start is street only ('22 St', 'Arbor St'). Wording: only 'Likely insured: high' / 'Probablemente asegurado: alto'; no free/gratis/licensed/deductible/guarantee/3-day in night.js. All headline/why/plan/best_time have EN+ES.
LOW 1: docs/design/open-map/data/night.js (last commit d3f6054, before 343a17f) has map keys today/areas/storms only, no map.walks/map.tiles, so 'every pick draws its walk' isn't visible until the first real night run. Fix: python3 hh.py night --js-out docs/design/open-map/data/night.js (needs network) or note in runbook.
LOW 2: hh.py:1147 night-shift dry run on fixture prints 'Map walks: 0, street tiles: 0' (fixture, not a bug), but no test proves a walk/tile download error still lets night-shift publish (runbook promises it). Add test: patch tile fetch to raise, assert rc 0 + PUBLISH line.
REGEX: grep -nE '\b(free|gratis|licensed|licenciad[oa])\b|3[- ]day(?! *business)' night.js returned nothing.
For FilthE: the nightly job's first real run is the only proof the walks/tiles land; check the map at 7 AM after it fires.
