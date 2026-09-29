# QA report from hub event 20260929T0945Z-qa-mapwest-done

To: engine-mechanic · re: None · at: 2026-09-29T09:45:00Z

**Summary:** PASS, 0 high, 0 medium, 3 low. Walks use street points only (no doors, all >8 m from every door in the test), hostile/malformed data is dropped, page weight is capped, nightly routine needs no new step. Push blocked (403), report is in 'long'. Questions: 1) Fix the apostrophe double-escape on map labels (low 1)? My pick: yes, small. 2) Cap tiles on the page at 6? My pick: yes.

QA map-west (343a17f). Save as docs/research/2026-09-29-map-west-QA.md. PASS: 0 high, 0 medium, 3 low.
RAN green: unittest tests.test_mapwalk+test_night 41 OK; full unittest discover 515 OK; hh.py night-shift --dry-run exit 0 with PUBLISH-shaped line; node tests/pages/open_map_night_check.js PASS; design_gate --page open-map PASS (1440 light+dark). NOT run: real gis.ne.gov fetch (needs the nightly cloud session).
PRIVACY PASS: mapwalk.py builds every point from street-centerline vertices (mapwalk.py:192-206), each run pushed to its corner (ext_max_m 250), 5 decimals; names = street with house number cut (_addr_name). tests/test_mapwalk.py:88 asserts every walk point (runs, connectors, returns, park) is >8 m from every mock door. No owner names in map.walks; h = door COUNT only.
HOSTILE DATA PASS: page validates numbers/arrays, drops malformed walk/tile (index.html:930-945); night check 5b/5c feeds <img onerror> in walk names + junk shapes: no script, no JS error.
WEIGHT PASS: NIGHT_JS_MAX 400 KB, tiles ~15-30 KB, tile_max_kb 70, 3 tiles tested.
NIGHTLY PASS: no new step; a failed download = no walk for that card, brief still publishes.
LOW 1: index.html:934 n:esc(x.n) (also f,t,pn) then index.html:1973 addLabel(...s.n...) uses textContent, so an apostrophe or & in a street name shows as &#39; / &amp; on map labels (rows at 2095 use innerHTML and are right). Fix: store raw, escape in the row template (${esc(r.n)}). Test: street 'O'Neill St' -> label text equals 'O'Neill St'.
LOW 2: index.html:936 out.walks[String(id)]= with id '__proto__' sets the prototype (harmless today). Fix: skip that id or use Object.create(null).
LOW 3: index.html:938 tiles have no count cap on the page (only the 400 KB file cap in hh.py). Fine while only the nightly job writes it; add .slice(0,6).
Regex: grep -nE 'textContent *= *L\(l\.txt\)' docs/design/open-map/index.html (labels are text nodes: never feed them escaped strings).
For FilthE: the first real night is the only proof the Columbus walk draws on live street data; checks use a saved Columbus street file.
