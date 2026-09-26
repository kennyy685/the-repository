---
name: storm-report
description: Short "where do we knock" report from the engine's latest data (fresh hail, best walk, today's calls). Use for "storm report", "any new hail", "where should we knock".
---
# Storm report

1. Use `data/export/hud.json` if it is under 36 h old; otherwise run `python3 hh.py refresh` (needs network; say so if it fails).
2. Run `python3 hh.py storms` and `python3 hh.py todaywalk --doors 25 --out /tmp/walk.json`.
3. Reply in 6 lines max, plain English (FilthE has ADHD):
   - newest 1"+ hail within 150 mi (day, town, size, miles from Fremont)
   - today's walk: area, doors, avg hail, best time
   - business calls today: count from `python3 hh.py calltoday`
   - one recommendation
Never promise insurance pays; never mention covering a deductible.
