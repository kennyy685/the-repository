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

## Start here: what every new session should already know
This file is the shared memory. Claude sessions don't share chat history (claude.ai chats, Cowork and
Claude Code each start blank), so **when FilthE tells you something important, add it here** instead
of making him repeat it next time.
**The company (from FilthE's company brief, 2026-09-26)**
- Early-stage but working: HMP mostly **subcontracts labor** today (the hiring contractor supplies
  materials). Contractors that hire HMP include **VTR Contracting** and **Nastase Contracting**. Services: siding (incl. James Hardie lap), flashing, soffit, fascia, remodeling, roofing,
  on houses and apartment complexes.
- **Several crews of 2-3 people**, adding another. Current main job: **The Edge Apartments** (5
  buildings: tear-off above the concrete, new flashing/tape/1x4 furring, gray lap siding, wood-look
  accents, caulk). Its live job board and a general job tracker were built in other Claude chats.
- **The boss** owns and runs it and speaks Spanish. **FilthE** is his right-hand man: translates, runs
  the AI/organization side, is the only one building this system, and does all the insurance sales.
- **New goal: insurance restoration** (hail, wind, fallen trees). This is the new part: selling
  direct to homeowners, buying materials, adjusters, waiting on insurance checks.

**How FilthE works (matters for anything you build)**
- Talks or sends short messages and job-site photos with short labels. **Never make him type into
  spreadsheets**: you read, log and manage the data.
- Build foundations that work for every job type; nothing rebuilt per job.
- **Spanish matters** for anything the boss uses. Long term: HMP's own app with AI; for now, Claude.
- New to AI and git: give click-by-click steps; simple tools he'll use beat clever ones to maintain.
  Limited Claude credit: short focused sessions, no features that don't help sell.

**Lead tool v1 (his spec) vs. what exists**
1. Storm finder (area + dates -> storms): built (engine + command center map).
2. Ranked lead list (storm severity, roof/home age, owner-occupied): built as door lists. Gaps:
   owner-occupied is per neighborhood, not per house (T23); roof age needs permit data, which no
   nearby city publishes as data.
3. Lead tracker with the 9 stages (Not contacted -> ... -> Done/Lost): built in the command center.
   Photos per lead not yet.
4. **Voice/short-message updates** ("123 Oak St, inspection Tuesday, hail on north slope"): NOT
   built. Highest-value gap for how he works.
5. Later: inspection damage-photo checklist; link a won lead into the job tracker.

**Answered already (don't re-ask):** Fremont, NE base; storms scanned within 250 mi, door lists
within ~120 mi. Direct to homeowner (cowork notes). Free public data only so far; ads parked; no
mailers; door knocking + calling business lines, no cold texts. Bilingual: yes.
**AI hub (task board + the King's orders):** HailHunter Crew HQ, https://claude.ai/artifact/Qkc52bt2JL5gW7ZKWBJDHU
- read its database docs `board/current` and `system/king` (Artifact/ArtifactData tools) for current tasks.
**Answered 2026-09-26:** registered and insured for roofing work: yes. Path: **both** - direct to
homeowners AND subbing for insurance restoration companies.
**Still unknown (ask once, then record here):** max travel distance for crews; any budget for paid
hail maps.

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
- Hail at each house = radar (MRMS MESH x one region-wide calibration factor, recomputed by `refresh`
  every 30 days) corrected locally by nearby trusted ground reports.
- House score = size x recency x distance x roof age x building type x owner-occupied x
  sold-after-storm flag.
- Size: 1" = 0.40, 2" = 0.93. Recency: full to 45 days, 0.4 at 1 yr. Distance: full to 30 mi.
- Wind (T6): `refresh` also pulls NWS wind reports into `wind_obs` and hud.json's `wind_events`
  (gusts in mph, own score). Informational only: door lists and neighborhood scores stay hail-only.

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
