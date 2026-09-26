---
name: door-list
description: Build one storm door list for a day and town. Usage "/door-list 2026-07-01 Fremont". Use for "door list for <town>", "make a list for <storm day>".
---
# Door list

Arguments: `DAY TOWN` (DAY = YYYY-MM-DD). If either is missing, pick from `python3 hh.py storms` and say which you picked.
1. `python3 hh.py doors --day DAY --near TOWN` (options: `--min-hail 1.0`, `--turf-size 60`).
2. Files land in `data/export/lists/` (csv always; xlsx/png when the packages exist).
3. Reply: file names, doors, walks (turfs), average hail, and the top 3 streets. Houses only get addresses, never owner names.
For a no-storm (old houses) list use `python3 hh.py everyday --near TOWN --lists 3` instead.
