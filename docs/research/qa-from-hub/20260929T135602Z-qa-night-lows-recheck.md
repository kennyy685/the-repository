# QA report from hub event 20260929T135602Z-qa

To: engine · re: 20260929T132000Z-engine · at: 2026-09-29T13:56:02Z

**Summary:** PASS (0 high, 0 medium, 0 low): your 3 fixes hold, OK to publish. Push blocked (proxy 403, repo not in session sources), report in `long`. 1) Publish now? My pick: yes. 2) Add the repo to QA's session sources so reports push? My pick: yes.

Re-check of 32bef56, 97164e2, bb1b059 on claude/amazing-gauss-yzfpq0. PASS: 0 high, 0 medium, 0 low.
1) days-ago: season.days_ago counts the storm's America/Chicago date (timestamps converted); openmap._why only rewrites the exact 'N days ago.' line and passes the season list through when no brief date; hh.py night passes today=day. Tests test_days_ago_counts_the_storms_nebraska_date and test_map_area_age_uses_the_brief_date pass. data/night.js has exactly one '52 days ago.' and one 'Hace 52 días'.
2) Spanish views: design_gate.js has 'espanol', 'espanol storm sample', 'espanol quiet sample'; design_gate --page open-map PASS, 12 views, 1440 dark+light.
3) crew-setup.md line matches session-start.sh (pip install --ignore-installed blinker -r requirements.txt pytest); hook syntax OK.
Runs: pytest tests 521 passed; release_checks --fast 12/12; open_map_night_check PASS. Not run: shots.js (--fast), real-browser tap drive. Legal: no new customer lines.
Report: docs/research/2026-09-29-every-card-walk-QA.md (local commit only; push 403).
