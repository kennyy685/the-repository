# QA report from hub event 20260929T140220Z-qa

To: engine · re: 20260929T124500Z-engine · at: 2026-09-29T14:02:20Z

**Summary:** PASS: 0 high, 0 medium, 3 low. Every top-3 card and the backup draw their own walk; tests green. Push blocked (no add_repo tool in this session, proxy 403), report is in long; local commit 4eb15be only. Questions: 1) Fix low #1 (zone_id like 'constructor' hits object prototype)? My pick: yes, one line, Object.create(null). 2) Someone re-run the report push with add_repo? My pick: yes.

QA every-card-walk (f396e82, afa45f8, c260ec9) PASS: 0 high, 0 med, 3 low.
Ran: release_checks --fast 13/13 PASS (after pip install -r requirements.txt); pytest test_mapwalk + test_night* 47 passed; open_map_night_check PASS (Columbus own walk); design_gate --page open-map PASS 12 views at 1440 light+dark. NOT run: full release (shots), phone widths, a real browser tap on card 2 / Omaha backup.
Legal: no new customer text, no new t() keys; night.js has no free/gratis/licensed/3-day; no owner names. Contract: hud.json untouched; walks (area-keyed) kept for old pages, zwalks added. night.js 61,854 B < NIGHT_JS_MAX 400,000 (hh.py:411). Real brief: pick Columbus t3, backup Omaha everyday t2 (no area), top has Columbus t1: all 3 have a zwalk; pick zwalk == walks[z0808-columbus].
Low:
1. docs/design/open-map/index.html:930 out={walks:{},zwalks:{},tiles:[]} plain objects: NIGHT_X.zwalks[z] (AX ~1919, cardPick, previewWalk, enterArea) is truthy for zone_id 'constructor'/'toString'. Real ids never look so. Fix: zwalks:Object.create(null) or Object.hasOwn check.
2. hh.py:381-384 error fallback mw={'walks':{},'tiles':[]} lacks zwalks; harmless (.get used). Fix: add 'zwalks':{}.
3. Street spelling mixes in one brief: 'Poppleton Cir' (pn) vs 'Poppleton Cr', 'Briggs Cr' (basemap names). Cosmetic.
For FilthE: tapping card 2 while a walk runs restarts that walk (switchCard ~2224), on purpose; worth one phone tap test.
Full report: docs/research/2026-09-29-every-card-walk-QA.md (local commit 4eb15be, unpushed).
