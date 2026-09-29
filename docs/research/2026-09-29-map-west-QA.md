# QA: map-west (open map draws every pick's own walk) - 2026-09-29

Scope: `git diff dd029a1..HEAD` on hailhunter/mapwalk.py, hh.py, config.py, tests, open-map/index.html, runbook, data/night.js.
Verdict: **FAIL: 0 high, 3 medium, 3 low.** (No high: the real night.js is clean. The 3 mediums are latent, each with a
2-line fix.)

## Checks run (all here, offline)
- `python3 -m unittest tests.test_mapwalk tests.test_night`: 41 OK. Re-run with `socket.connect` and `create_connection`
  patched to raise: still 41 OK, so the night tests never touch the network.
- `python3 hh.py selftest`: OK (515 tests). `bash tests/release_checks.sh --fast`: all PASS (legal_check, practice_door_rx, selftest...).
- `python3 hh.py night-shift --dry-run`: exit 0, ends `DRY RUN (nothing to publish)`. It says "Map walks: 0, street tiles: 0"
  because the dry run forces offline: the dry run cannot catch a regression of the network part.
- `node tests/pages/open_map_night_check.js`: PASS (incl. new Columbus walk + junk walk/tile cases).
- `node tests/pages/design_gate.js --page open-map`: PASS (8 views, 42 controls, 1440 px, light + dark).
- Not run: MapLibre/WebGL path (CDN blocked offline; the check uses the canvas fallback map). `code-review` /
  `security-review` skills not invoked separately; I read the whole diff by hand and hit it with hostile data (below).
- Legal by eye: no customer or taught lines were added (no new page strings). Nothing to flag for 44-8604 / 69-1602 / cancel form.

## Privacy grep of the real docs/design/open-map/data/night.js (34.5 KB)
map.walks has 1 walk (Columbus): street names "22 St", "21 St", "40 Ave", cross streets, meters, door COUNTS (10/12/3),
street-vertex coordinates only. No `stops`, `pid`, `address` with a number, owner name, or door point. Regex
`\b\d{3,5} [NSEW]?\.? ?\d*\w* (St|Ave|Rd|Dr|Ln|Blvd)\b` = 0 hits. The only "owner" is `"owner":68` (a percent). The one tile
is 26 KB (limit 70 KB). CLEAN.

## Findings (most serious first)

1. **MEDIUM (privacy, latent)** `hailhunter/mapwalk.py:_addr_name` (line ~41) -> `night._street` (night.py:345). `_street`
   keeps the house number when the rest is one word. Reproduced: addresses "3601 Broadway" -> run name "3601 Broadway"
   (also "1306 Main", "12 Oak", "1200 1/2 Oak St" -> "1/2 Oak St"). That text goes straight into `map.walks.*.s[].n`, `.pn` and
   `f`/`t`... and then into the published night.js, and the run also splits into one street per door. Tonight's Columbus
   addresses all end in "St" so the real file is clean; a town with one-word street names (Broadway, Circle, Plaza) leaks.
   Fix in `page_walk`, right after `nm = ...`: `if sn and re.match(r"^\d+[A-Za-z]?\s+\S+$", nm) and not re.match(r"^\d+\s+(St|Av|Ave|Rd|Dr|Ln|Blvd|Ct|Pl|Way|Cir)$", nm, re.I): nm = sn["street"]`
   (use the snapped street name). Regression test: feed the Columbus fixture with every address rewritten to
   `"<num> Broadway"` and assert every `s[].n`, `pn`, `f`, `t` is in `{x["n"] for x in bm["streets"]}`. Also add to
   open_map_night_check.js: no name in `map.walks` matches `/^\d{3,}\s+[A-Za-z]{4,}$/` (house number + one word).

2. **MEDIUM (nightly reliability)** `hh.py:374-383` (night_cmd map block). Not guarded: `_basemap_maker(...)` and
   `mapwalk.extra(...)` sit outside any try. Reproduced: `mapwalk.extra` raising ValueError makes `hh.py night` crash before
   `brief.json` is written, so the whole 7 AM brief is lost for an optional map extra (runbook says a bad download only drops
   the walk). Real path to it: `get_tile` calls `maker._cached(key, False)` outside its try (json.loads of a corrupt cache row).
   Fix: wrap the block: `try: ... except Exception as e: log(f"Map walks skipped: {type(e).__name__}: {str(e)[:120]}")`
   (keep `maker.conn.close()` in a finally). Test: `mock.patch.object(mapwalk, "extra", side_effect=ValueError)` -> rc 0 and brief.json exists.

3. **MEDIUM (page crash on bad data)** `docs/design/open-map/index.html:936` `(b.map.tiles||[]).forEach(...)`. If
   `map.tiles` is an object or string (I fed `{"a":1}`), it throws at top level and the whole page never renders
   (`section.night` never appears, pageerror "forEach is not a function"). Same shape for `t.t.every` is fine (guarded by
   Array.isArray). Fix: `(Array.isArray(b.map.tiles)?b.map.tiles:[]).forEach(...)`. Add the case to check step 7b.
   Other hostile inputs I tried all degrade quietly with 0 JS errors: `walks` as array/string, odd-length tile lines,
   tile scale 1e-9, absurd origin, coords 1e9, `pn` as string, band 99, 6 duplicate tiles, `<img onerror>` name (escaped, no XSS).

4. low - `index.html:932` `h` is not bounded: `h: 1e308` freezes the tab (I killed it after 40 s). Clamp: `Math.min(500,Math.max(0,Math.round(x.h)))`;
   also cap tiles/walks (e.g. 8 tiles, 12 walks) so a big file cannot stall a phone.
5. low - `index.html:932` names are HTML-escaped once at load, but `toast()` (line 2441) uses textContent, so an apostrophe or `&`
   shows as `O&#39;Neill &amp;`. Real Nebraska streets with an apostrophe are rare. Escape at the innerHTML sites instead, or
   unescape for the toast. (Also cosmetic: walk street "40 Ave" next to cross street "40th Ave" - address form vs GIS form.)
6. low - scope note, not a bug: `mapwalk.extra` keeps the FIRST card per area id and skips cards with no `area_id`. Tonight
   the 3rd card "Columbus: 36 Ave & 18 St" shows the pick's 22 St walk, and the Omaha everyday backup gets no walk on the map. Say so in
   the runbook ("one walk per map area; everyday turfs without an area id draw nothing") so FilthE isn't surprised.

## Page weight / nightly routine
- night.js 34.5 KB now (was ~10 KB); one tile 26 KB. Worst case: 5 tiles x 70 KB + brief ~ 385 KB, under the 400 KB
  NIGHT_JS_MAX, but very close: over it, `night-shift` refuses to publish the WHOLE brief (exit 1) instead of dropping tiles.
  Suggest: in `night_cmd`, if the serialized brief > 380 KB, drop `map.tiles` from the last card backwards. The script tag is
  synchronous (index.html:900) but the page already loads base.json 894 KB + streets.json 1 MB, so 35 KB is noise.
- Runbook: no new step (night-shift fetches and embeds tiles, cache in engine db; fresh cloud session just re-fetches, ~1-2 s
  a walk, inside `basemap.budget_s` 90 s). Wording matches the code. OK.
- hud.json ids, `stops[].pid`, target keys: untouched (diff has no hud/engine writer changes; selftest passes).

For FilthE: the map now shows only one walk per area, so the sister Columbus turf and the Omaha old-house backup still have
no street walk of their own on the map; if you want "every card", say so and the engine can key walks by zone id instead.
