# HailHunter: storm lead engine for HMP Siding & Roofing LLC (Fremont, NE)

**Before any work here, read `~/2026/CLAUDE.md`, `~/2026/BOARD.md` and `~/2026/cowork-to-code.md`
(or `cowork-to-code.md`'s replacement, `~/2026/hailhunter-status.md`, for Cowork's own notes) -
this folder shares a task board and rules with a second AI (Cowork, in the cloud) working the same
project. Update your rows on the board and add a dated entry to `~/2026/hailhunter-status.md`
before you stop.**

## Who and why
- **Owner/operator:** FilthE, the boss's bilingual (Spanish/English) right-hand man at HMP Siding &
  Roofing LLC, Fremont, Nebraska (residential and commercial, siding + roofing).
- **Goal:** win insurance/storm-restoration jobs, direct-to-homeowner. Find hail/wind-hit homes and
  buildings, knock and call, inspect, file claims with the homeowner, meet the adjuster, build the
  job, get paid.
- **What "done" means:** the goal is crews working jobs the system found, not a finished app.
  Measure progress in leads, inspections, claims and jobs.
- **How we work together:** suggest ideas and references; check in with FilthE before decisions
  you're unsure of (money, legal, anything customer-facing, deleting data); explain things in plain
  English, short - he has ADHD, keep it skimmable.

## This is the base copy
This folder (`~/Documents/HailHunter`) is the base codebase - full-featured, runs locally on this
Mac with pip-installed dependencies (numpy, pandas, matplotlib, openpyxl, flask). Cowork's cloud
runner can't pip install, so `hh.py bundle` packs a copy of this code for the cloud, and the parts
that need packages the cloud sandbox doesn't have (openpyxl for `.xlsx`, flask for `serve`) degrade
gracefully instead of crashing - `hh.py refresh` still finishes and writes CSV + hud.json either way
(see `doors.make_list` and `commercial.write_csv`, which try/except around the optional imports).
numpy/pandas/matplotlib/PIL ARE available in Cowork's cloud runner already (confirmed: its own code
imports them unconditionally and its Storm Watch task runs successfully) - only the two above are
genuinely missing there.

## Layout
- `hh.py`: command-line entry point (`python3 hh.py -h`)
- `hailhunter/`:
  - `config`, `geo`, `http`, `db` (SQLite), `models`
  - `ingest`, `analyze` (storm grouping), `mrms` (radar hail grids)
  - `nbhd` (Census block groups), `parcels` (NE statewide parcels)
  - `doors` (turf lists, xlsx/map optional), `commercial` (apartment/commercial targets, csv/xlsx)
  - `hud` (writes `data/export/hud.json` for the command center, includes `neighborhoods` - T16)
  - `report` (CLI printing), `web` (`serve`: local phone-friendly tracker, Flask)
- `hailhunter/sources/`: `lsr` (NWS storm reports via Iowa Mesonet), `swdi` (NEXRAD hail),
  `stormevents` (NCEI), `places` (Census towns)
- `vendor/shapefile.py`: vendored pure-Python shapefile reader (Census TIGER block group shapes) -
  no pip install needed for this piece even locally
- `config.json`: `pinned_lists` ([day, town] door lists always built), `backfill_days`,
  `agent_schedule`, plus the full scoring/threshold config
- `data/scout_contacts.json`: business phone numbers for top apartment/commercial targets, matched
  by address (Cowork maintains this; Code just reads it in `hud.py`)
- `data/hailhunter.db`: the database. `data/export/`: hud.json, lists/*.{csv,xlsx,png},
  refresh_summary.json, storms.json
- `tests/`: offline tests (real Sept 22 2025 Fremont storm data), run with `hh.py selftest`

## Commands
- `python3 hh.py refresh`: everything, in order: init (first run) -> ingest -> analyze -> radar
  swaths + calibrate -> rescore -> door lists (pinned + top 4 auto) -> commercial -> hud.json. This
  is what Cowork's daily Storm Watch task runs in the cloud (~8 min from empty there).
- `python3 hh.py doors --day 2026-07-01 --near Fremont`: one door list (csv + xlsx + map)
- `python3 hh.py commercial`: apartment/commercial targets (csv + xlsx)
- `python3 hh.py hud`: rebuild hud.json only
- `python3 hh.py diff --old OLD_hud.json`: new 1"+ hail within 150 mi vs an older hud.json (how
  alerts are found)
- `python3 hh.py serve`: local phone-friendly tracker on this Mac's wifi (backup/admin view - crews
  use the cloud command center instead, per D2 on the board)
- `python3 hh.py status`: table counts
- `python3 hh.py bundle --out engine.json` / `unbundle --src engine.json`: pack/unpack the code (the
  command center artifact carries a bundle so Cowork's scheduled task can run it)
- `python3 hh.py selftest`: offline tests

## The live system
- **Command center (HUD):** https://claude.ai/artifact/6cCATKJSoyWA7kbH4Em8VX (Cowork owns this)
  - Reads `data/hud.json`, published from here via `code/engine.json` bundles.
  - Shared database: `turfs/<listId>~t<n>` = {results}, `targets/<slug>` = {status}, `system/log`.
    Never delete or overwrite crew results in it.
- **Storm Watch:** Cowork's scheduled task, daily 6:54 AM Central. Unpacks the engine bundle, runs
  `refresh` + `diff`, republishes hud.json, logs an alert, sends FilthE a push + email.
- **This Mac's copy:** the base codebase (see above) - not "older," this is where changes are made
  and then bundled out to the cloud, per the shared desk's ownership rules in `~/2026/CLAUDE.md`.

## Scoring (short)
- Hail at each house = radar (MRMS MESH x calibration, factor recalculated per region) corrected
  locally by nearby trusted ground reports.
- House score = size x recency x distance x roof age x building type x owner-occupied x
  sold-after-storm flag.
- Size: 1" = 0.40, 2" = 0.93. Recency: full to 45 days, 0.4 at 1 yr. Distance: full to 30 mi.
- Wind damage is not yet scored (T6, planned) - engine is hail-only right now even though the same
  NOAA source carries wind reports too.

## Hard rules (legal and ethical) - see also `~/2026/CLAUDE.md`
- **Nebraska 44-8604:** never offer, advertise or imply covering, waiving or rebating an insurance
  deductible, and never pay homeowners for claims.
- Never promise insurance will pay. Don't negotiate claims on the homeowner's behalf or advertise
  that we do - that's public-adjuster work and needs a license. We meet the adjuster and document
  damage.
- **Contacts:** business phone numbers only for commercial (leasing offices, property managers,
  company lines) - no personal cells/emails/home addresses. Owner names only for apartment/
  commercial properties, never homes.
- No buying phone lists for cold calls or texts (TCPA/DNC risk). Door knocking and calling business
  lines are fine. No mailers (FilthE, 2026-09-25 - D1 on the board).

## Crew (subagents in .claude/agents, from Cowork's kit)
- `storm-analyst`: runs the engine and says where to work
- `commercial-scout`: finds business contacts for buildings
- `marketing-lead`: Google Business Profile, Local Services Ads, Facebook ads, bilingual copy
- `claims-coach`: inspection -> claim -> adjuster -> build -> commission playbook
- `engine-mechanic`: fixes and extends the Python code

Skills (slash commands, from Cowork's kit): `/storm-report`, `/door-list DAY TOWN`, `/call-list N`.
