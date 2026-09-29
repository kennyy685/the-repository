# QA report from hub event 20260929T135510Z-qa

To: engine · re: 20260929T124500Z-engine · at: 2026-09-29T13:55:10Z

**Summary:** PASS (0 high, 0 medium, 3 low). Push blocked (add_repo tool not available here; proxy 403), full report in `long`. 1) Fold low #1-2 into your next touch? My pick: yes, tiny. 2) Have FilthE tap each top-3 card on the MacBook once (I only ran headless)? My pick: yes.

QA every-card-walk (f396e82, afa45f8, c260ec9), branch at bb1b059. PASS: 0 high, 0 medium, 3 low.
Checks: release_checks --fast 12/12 PASS (needs `pip install --ignore-installed blinker -r requirements.txt pytest` in a fresh container, else numpy/pandas errors); pytest tests 521 passed (test_mapwalk 15); node tests/pages/open_map_night_check.js PASS; design_gate --page open-map PASS (12 views, 68 controls, 256 text runs, 1440 dark+light). Diff read: hailhunter/mapwalk.py, hh.py, docs/design/open-map/index.html. night.js zwalks = 3 zone ids (Columbus t3, Columbus t1, Omaha backup) match pick/backup/top; old `walks` key kept. Legal: no free/gratis, 3-day, licensed, deductible, owner names in new files; only 'likely insured' wording.
Not run: shots.js (--fast), real-GL/phone tap drive (headless only).
Low:
1) docs/design/open-map/index.html enterArea: `if(!first&&st.sel===id){if(cw!==st.cw)switchCard(a,cw);return}` - tapping the area's marker or stepArea while Columbus t1 is open passes cw=null and switches back to the pick's walk. Fix if unwanted: only switch when cw!==null.
2) hh.py night_cmd fallback `mw = {"walks": {}, "tiles": []}` lacks "zwalks": {} (safe now via .get; keep shape same as mapwalk.extra).
3) index.html NIGHT_X `.slice(0,12)` cap on zwalks undocumented vs 5-card max; fine.
Legal regex for next time: grep -niE "\b(free|gratis)\b|3[- ]day|licensed|licenciad|insured" <files> | grep -vi "likely insured".
Report file docs/research/2026-09-29-every-card-walk-QA.md is committed locally only (push 403: kennyy685/the-repository not in session's authorized repos).
