---
name: engine-change
description: The safe way to change the HailHunter storm engine (hh.py, hailhunter/) without breaking the command center or the daily Storm Watch run. Use before editing any engine code or hud.json output.
---

# Changing the HailHunter engine

The engine runs in two places: locally (`python3 hh.py ...`) and in Cowork's cloud every morning
at 6:54 AM (Storm Watch unpacks a bundle of this code into an EMPTY folder and runs `hh.py refresh`).
A change that works on a warm database can still crash that cloud run. Follow every step.

## 1. Before you edit
- Read `CLAUDE.md` (business rules) and the module you are changing, in full.
- Decide the smallest change that does the job. Additive beats clever.

## 2. The hud.json contract (the command center reads it)
- Never rename or remove an existing field. New data = new fields (e.g. `lists[].turfs[].heat`).
- Keep list ids `<day>_<Town>`, `stops[].pid`, and target `key` = "address|city" exactly: crew
  results in the command center's database are keyed on them.
- Keep hud.json under about 6 MB (check `os.path.getsize`).

## 3. Dependencies
- `refresh` may use numpy, pandas, requests, Pillow and matplotlib (the cloud runner has them).
- openpyxl and flask are optional: import them lazily inside the command that needs them and fall
  back to CSV when missing. Never add a new top-level dependency without adding it to
  `requirements.txt` and saying so.

## 4. Tests (required)
- Add an offline test in `tests/` for every behavior change; confirm it FAILS without your change.
- Run `python3 hh.py selftest` - everything must pass.
- Fresh-database check for anything touching `db.py`, `sources/` or `refresh`: run the affected code
  against a brand-new temp database (see `tests/test_fixes.py::FreshDatabase`), because the cloud
  always starts empty.
- Offline runs: `python3 hh.py --offline <command>` uses cached data only.

## 5. Scoring changes
- Curves live in `config.py` DEFAULTS and can be overridden in `config.json`; put new weights there,
  not as magic numbers in code.
- Keep every score explainable: return its parts (e.g. `score_parts`, `why`) so FilthE sees reasons.

## 6. Hand-off
- Don't push from a sub-agent. Report the diff summary, the new test names and the selftest result.
- After a push, the cloud keeps running the OLD bundle until Cowork re-bundles from GitHub main (T5):
  say so in the report.

Nebraska rules for anything customer-facing: never suggest waiving/covering/rebating a deductible
(44-8604); never promise insurance will pay; never negotiate claims; business phones only; owner
names only for apartment/commercial buildings.
