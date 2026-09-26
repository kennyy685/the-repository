# HailHunter

Storm-restoration lead engine for HMP Siding & Roofing (Fremont, NE). It finds where hail hit, ranks the areas and
houses worth knocking, and feeds the **HMP App** (the salesman's phone tool: hot zones, Today's knock, leads, claims,
quick price). Old-house (non-storm) door lists too.

## What's built
1. **Storm data** from 3 free public sources + NOAA MRMS radar hail grids, calibrated against ground reports.
2. **Neighborhoods + houses**: Census block groups and the Nebraska statewide parcel layer, hail at each house.
3. **Door lists, hot zones, walks** (door score v2), apartment/commercial targets and a business call list.
4. **Sales tools**: quick estimate, material takeoff, follow-up schedule, hail report, weekly results.
5. **Daily run**: Storm Watch refreshes the data every morning and alerts after 1"+ hail; the app gets
   `today/walk` + `calls/today` at 7:40 AM.

## Setup (once)
    python3 -m pip install --user -r requirements.txt

## Main commands (`python3 hh.py -h` for all)
    python3 hh.py refresh      # everything end to end (what Storm Watch runs)
    python3 hh.py zones        # hot zones near Fremont + a ranked walk per zone
    python3 hh.py todaywalk    # Today's knock: one walk for the app
    python3 hh.py calltoday    # today's business call list
    python3 hh.py doors --day 2026-08-08 --near Columbus   # one storm door list
    python3 hh.py everyday --near Fremont                  # old-house door lists
    python3 hh.py estimate --footprint 1400 --stories 2    # quick price range
    python3 hh.py status       # what's stored, last runs
    python3 hh.py selftest     # offline tests (JS twins: node tests/js/*_check.js)

## Files
- `hailhunter/` engine code (`sources/` one file per data source); `docs/app/*.js` JS twins used in the app
- `pages/` Claude page sources (HMP App, AI hub, Practice Door); `docs/print/` print kit; `docs/research/` research
- `config.json` all weights and settings; `data/` database (not tracked), exports, reference JSON
- Full reference (every command, layout, scoring): `.claude/skills/hailhunter-reference/SKILL.md`

## Good to know
- Door lists are Nebraska only (the state parcel layer). Lancaster County leaves type/year blank (type from zoning).
- Houses that SOLD AFTER the storm are flagged: the new owner may not be able to claim that storm.
- Never open data/hailhunter.db with a plain SQLite tool that writes - use hh.py.
