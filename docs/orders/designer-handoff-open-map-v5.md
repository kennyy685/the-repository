# Designer handoff: open map v5 (real 2026 storms) — 2026-09-29

Paused at ~200k tokens (King's rule). Steps 1–2 of the job are half done; 3–6 are not started.

## Done (pushed, 08b6bd8)
- Engine (`hailhunter/season.py`, `config.py` season block), QA's 3 low notes fixed, 3 new tests, 449 tests + selftest green:
  - radar-only zones: `hail_in` = MESH x 0.8, capped 2.75 in (`mesh_in` keeps raw); why line says "Radar estimate only".
  - zone Census rows = block groups within 2 km of the zone's reports (not the whole circle). Malcolm now 12,446 homes
    (was 41,532); it still ranks #1 because its 8 reports really run into NW Lincoln.
  - no town inside -> `name` "Rural area near X", `name_es` "Zona rural cerca de X", `nearest_town`, `nearest_km`.
    Radar zones with no NE place within 30 km (Iowa) dropped. Now 198 zones, 0 bare "Rural area".
- `data/storms-2026.json` rebuilt with that; `docs/design/open-map/DATA-2026.md` updated.

## Not done: the map swap (step 1) + 7 AM finish (3) + smoke test (4) + QA (5) + publish (6)
Page: `docs/design/open-map/index.html` (2,400 very long lines: grep, never read whole).

**Key facts found:**
- Basemap/streets/homes cover only bbox `-96.95,40.72,-95.80,41.70` (`data/build/fetch.py`). About 55 real zones sit
  inside it (Malcolm, Lincoln x3, Millard, Raymond, Roca, Elkhorn x2, Gretna x2, Fremont x3, Ashland, Plattsmouth,
  Valley, Colon/Prague on Sep 13 = newest, ...). Use only those for areas; say "N more zones outside this map".
- Sample model to replace (line ~946–1110): `STORMS` (per storm: date, days, time, d, long, path, w[3 band half-widths
  km], core, wind), `AREAS` (id, st, name{en,es}, sub, c, r[rx,ry,rot], hail, homes, roof, owner, permits, conf,
  county, rep[[src, {en,es}, time]], why), `DAILY` (90 days), `TOWNS`/`TOWN_OF`/`MORT` keyed by area id.
- Suggested build: new `data/build/real.py` reads `data/storms-2026.json` -> `open-map/data/storms.json` in that shape:
  STORMS = one per storm day (key = date); path = the day's in-bbox reports by UTC (else a short SW->NE line through
  the biggest zone, marked decorative); AREAS = in-bbox zones: ring = `outline` (ground) or circle `radius_km`
  (radar); hail = hail_in (+ "radar est." label when hail_basis radar); homes = signals.homes; owner =
  owner_share x100; conf = agree_pct; rep from `reports[]` (src lsr->nws, spc->spc, ncei->add a SRC entry "ncei";
  radar zones -> one mrms line); why = zone why[] as is; name = name/name_es; county from reports.
  Page: load storms.json in `loadData()` (line ~2319) before first render; `areaFeat` uses `a.ring` when present;
  `hailFeat` = one polygon per zone (band 1/1.5/2 by hail_in); drop the wind layer (no wind data).
- No real data for roof age or permits: `roof` = Census home age (2026 - median_year_built) relabelled "typical home
  age"; claim bar (roofMix, line ~1764) from `built_before_2000_share`; permits = "not checked yet" (TAG tbd), never a
  number. MORT by ZIP -> use zone `signals.mortgage_share` instead.
- Timeline/buttons are 7/30/90 days (lines 738–740, 1207, 1684–1712 use 90 hard-coded). Real storms are 15–206 days
  old: make it 30 / 90 / Season (since Mar 1) and default to Season, or the map is nearly empty.
- `data/areas.json` (best streets + walks) is keyed by the 12 sample ids and built by `data/build/areas.py` from
  `Street_Centerlines.json` + `blocks.json` (not in git; re-pull with `fetch.py Street_Centerlines` + `blocks.py`,
  gis.ne.gov, browser UA). Change areas.py to read the real areas (id, ring, band) instead of its AREAS/STORMS copy.
- 7 AM home (`renderHome`, `computePicks`, `pickScore` ~2068–2160) already exists: check #1 lit, one-line reason,
  tap flies in, "Start knocking" -> https://claude.ai/artifact/9oDxg9iErVt9TteXeo5bLU.
- Tag: switch SAMPLE tag to REAL PUBLIC DATA for storms; homes on the map stay samples (no owner names ever).
- Then: smoke test (Playwright, executablePath /opt/pw-browsers/chromium, 1440x810 light/dark EN/ES, 0 JS errors),
  qa-tester (sonnet) incl. legal grep, publish to https://claude.ai/artifact/6LRaMpb63D8Z7UwznfqqxV (read it first; files
  map = index.html + data/*.json + fonts), one hub event to:"you".
