# HailHunter

Storm-restoration lead engine for a siding and roofing company in Fremont, NE.
It finds where hail hit, ranks the areas worth knocking, and (in later steps)
turns them into street-by-street door lists and tracks every door through to a finished job.

## Build plan
1. **Storm data engine** (done): pulls hail from 3 free public sources, merges duplicates,
   groups the reports into storms, splits each storm by town, and scores it 0-100.
2. **Hail swaths + neighborhoods** (done): NOAA MRMS radar hail grids (1 km) for every storm day,
   calibrated against 2,796 ground reports and corrected locally by nearby reports
   (radar + ground fusion), then measured over 7,572 Census block groups with housing data.
3. **Door lists + apartment/commercial targets** (done): every building in the hail zone from the Nebraska
   statewide parcel layer, hail estimated at each house, scored, and packed into ~60-door walks
   (up one side of the street, back down the other). Printable Excel with a result dropdown and live counts.
   Apartments/commercial are ranked separately with owner names from Douglas, Sarpy and Lancaster county GIS.
4. Field app on your phone: map, knock list, one-tap door log, pipeline, AI helper.
5. Scheduled agent: checks every morning and alerts you after 1"+ hail.

## Setup (once)
    python3 -m pip install --user numpy pandas requests pillow matplotlib openpyxl flask

## Commands (run inside this folder)
    python3 hh.py init        # load towns, neighborhoods, Census housing - once
    python3 hh.py ingest      # hail reports: first run backfills 2 years; later runs catch up
    python3 hh.py swaths      # radar hail maps -> neighborhood scores
    python3 hh.py calibrate   # re-check radar vs ground reports (then: swaths --rescore)
    python3 hh.py storms      # ranked towns hit, best first
    python3 hh.py hoods --near Fremont          # ranked neighborhoods (also --day, --since)
    python3 hh.py map --day 2026-06-13 --near Fremont   # map picture -> data/export/maps/
    python3 hh.py doors --day 2026-08-08 --near Columbus   # door list: xlsx + csv + turf map -> data/export/lists/
    python3 hh.py commercial --since 2026-03-01             # apartment & commercial targets with owners
    python3 hh.py events      # storm by storm
    python3 hh.py status      # what's stored, last runs, errors
    python3 hh.py serve       # phone-friendly command center: door lists, commercial, pipeline tracking
    python3 hh.py selftest    # offline tests

## Data sources (all free, public)
| Source | What | Delay |
|---|---|---|
| NWS Local Storm Reports (Iowa Environmental Mesonet API) | hail reports from spotters, public, mPING | minutes |
| NEXRAD hail signatures (NCEI SWDI nx3hail) | radar hail-size estimates per storm cell | ~1-3 days, has gaps |
| NCEI Storm Events Database | official, checked record + damage estimates | 2-4 months |
| NOAA MRMS MESH on AWS | 1-km radar hail-size grid, 24-h max per storm day | ~1 hour |
| Census Gazetteer | towns and locations | static |
| Census ACS 5-year (table files) | homes, % owner-occupied, median year built, value | yearly |
| Census TIGER block groups | neighborhood shapes | yearly |
| Nebraska Statewide Parcels (gis.ne.gov) | address, type, year built, sq ft, value, last sale | yearly |
| Douglas / Sarpy / Lancaster county GIS | owner name + mailing address (public record) | weekly-ish |

## Score (0-100) = 100 x size x recency x distance x confidence x houses
- **size**: 1" = 0.40, 1.5" = 0.72, 2" = 0.93, 2.5"+ = 1.0
- **recency**: full for 45 days, 0.7 at 6 months, 0.4 at 1 year, 0.1 at 2 years (claim windows depend on each policy)
- **distance** from Fremont: full to 30 mi, 0.75 at 100 mi, 0.45 at 250 mi
- **confidence**: trusted ground report 1.0, only app/mPING reports 0.85, radar only 0.65, +0.05 if sources agree
- **houses**: town population (rural 0.35 -> 10k+ people 1.0)

Neighborhood score = 100 x size x coverage x recency x distance x owners x homes x age
(coverage = share of the area with 1"+ hail; owners = % owner-occupied; age = median year built).

All weights are in `config.json`.

## How radar and ground reports are combined
Radar (MESH) sees everywhere but guesses size; people measure size but only at a few points.
1. Calibration: across all trusted reports, ground size / radar size has a median of ~0.96.
2. Fusion: near each trusted report the radar map is scaled toward what was measured,
   fading out over ~4 miles. Example: Sept 22 2025 Fremont radar said ~0.9", people measured
   1.5-2"; fused estimate 1.2-1.6" across Fremont.

## Files
- `hailhunter/` engine code; `hailhunter/sources/` one file per data source
- `data/hailhunter.db` SQLite database; `data/cache/` downloaded files; `data/mrms/` daily hail grids
- `data/export/storms.json` for the app/agent; `data/export/maps/` map pictures
- `vendor/` small add-on library (pyshp) for reading map shapes
- `tests/` offline tests (real Sept 22 2025 Fremont storm data)

## Good to know
- Nebraska only for door lists (the state parcel layer). Iowa/Kansas need county sources - not added yet.
- Lancaster County (Lincoln) leaves type/year blank in the state layer: type comes from zoning, year shows 'unknown'.
- Houses that SOLD AFTER the storm are flagged: the new owner may not be able to claim that storm.
- Never open data/hailhunter.db with a plain SQLite tool that writes - use hh.py. (The synced folder blocks the
  journal delete; hh.py repairs itself if that ever happens.)
