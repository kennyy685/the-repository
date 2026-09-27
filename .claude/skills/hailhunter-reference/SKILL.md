---
name: hailhunter-reference
description: HailHunter reference - code layout (hh.py, hailhunter/*.py, docs/app JS twins, pages/), every hh.py command, how scoring works, the cloud bundle, the HMP HQ snapshot fields and the claims schema. Use before running or changing the engine, writing app/HQ database docs (claims, hq/snapshot, today/walk, zones), or answering "how does the engine/score/command work".
---

# HailHunter reference

Stable reference moved out of `CLAUDE.md` (research round 10, T78). Orders, answered questions, hard rules
and live links stay in `CLAUDE.md`. Engine edits: also follow the `engine-change` skill.

## Base copy and the cloud bundle
The repo is the base codebase (FilthE's Mac copy `~/Documents/HailHunter`, and the cloud repo). Locally it runs
with pip-installed numpy, pandas, matplotlib, openpyxl, flask. Cowork's cloud runner can't pip install, so
`hh.py bundle` packs a copy of the code for the cloud. Parts that need packages the cloud lacks (openpyxl for
`.xlsx`, flask for `serve`) degrade gracefully: `hh.py refresh` still writes CSV + hud.json (see
`doors.make_list` and `commercial.write_csv`, which try/except the optional imports). numpy/pandas/matplotlib/PIL
ARE available in the cloud runner; only openpyxl and flask are missing.

## Layout
- `hh.py`: command-line entry point (`python3 hh.py -h`)
- `hailhunter/` (engine):
  - basics: `config`, `geo`, `http` (cached fetches), `db` (SQLite), `models`
  - storms: `ingest`, `analyze` (storm grouping), `mrms` (radar hail grids), `wind` (T6 wind reports, info only),
    `watch` (T31 alerts for watched places, `data/watch_list.json`), `maps` (hail map pictures)
  - areas and houses: `nbhd` (Census block groups), `parcels` (NE statewide parcels), `owners` (T23 per-house
    owner-occupied from county owner mailing addresses; see Scoring), `doorscore` (door score v2,
    round 16), `doors` (storm turf lists, xlsx/map optional), `everyday` (T50 old-house lists), `zones` (hot zones +
    one walk per zone), `todaywalk` (O0 Today's knock), `commercial` (apartment/commercial targets, csv/xlsx),
    `calltoday` (business call list), `accounts` (round 54: new hail/wind over HMP's own accounts)
  - selling: `estimate` (T52 price range), `takeoff` (material order list), `followups` (follow-up schedule),
    `hailreport` (T32 one-address hail report)
  - results and learning: `weekly` (week report), `tune` (T35 learning loop), `benchmarks` (T84, reads
    `data/benchmarks.json`)
  - output: `hud` (writes `data/export/hud.json` for the command center), `report` (CLI printing), `web` (`serve`,
    local Flask tracker)
- `hailhunter/sources/`: `lsr` (NWS storm reports via Iowa Mesonet), `swdi` (NEXRAD hail), `stormevents` (NCEI),
  `places` (Census towns)
- `docs/app/*.js`: JS twins of engine math (`estimate.js`, `takeoff.js`, `followups.js`), each one closure that sets
  `window.HMPEstimateMath` / `HMPTakeoff` / `HMPFollowups` in a page and `module.exports` in node; checked by
  `node tests/js/*_check.js`. The HMP App loads them as separate published files (below)
- `pages/`: sources of the Claude pages (`hmp-app.html`, `crew-hq.html`, `practice-door.html`, `voice-test.html`,
  retired `claim-tracker.html`; `estimate/`, `translate/`, `vendor/` modules). **The HMP App is a multi-file artifact
  (T169):** `pages/hmp-app.files.json` maps each published path (`app/estimate.js`, `translate/translate.js`...) to
  its repo file; the page loads them with `<script src>`/`<link href>`, and a publish passes that map as `files`.
  Edit the module file, never paste it into the page (`node tests/js/app_files_check.js` fails if one comes back)
- `docs/print/`: print kit (html + pdf). `docs/orders/`: build orders and roadmap. `docs/research/`: research rounds.
  `docs/design/`, `docs/brand/`: design picks and the app icon.
- `vendor/shapefile.py`: vendored pure-Python shapefile reader (no pip install needed)
- `config.json`: `pinned_lists` ([day, town] door lists always built), `backfill_days`, `agent_schedule` (notes
  only, read by no code), `door_score` weights, `prices_reference` / `prices`, plus the scoring/threshold config
- `data/`: `scout_contacts.json` (business phones for commercial targets, Cowork maintains, `hud.py` reads),
  `benchmarks.json` (round 15 industry numbers), `glossary_en_es.json` (T81), `supplement_items.json`,
  `hailhunter.db` (database, not tracked), `export/` (hud.json, lists/*.{csv,xlsx,png}, refresh_summary.json,
  storms.json)
- `tests/`: offline tests (real Sept 22 2025 Fremont storm data), run with `hh.py selftest`; `tests/js/` JS checks

## Commands
- `python3 hh.py refresh`: everything, in order: init (first run) -> ingest -> analyze -> radar swaths + calibrate ->
  rescore -> door lists (pinned + top 4 auto) -> everyday lists (top 3) -> commercial -> hud.json. What Cowork's
  daily Storm Watch runs in the cloud.
- Storm data: `init`, `ingest`, `analyze`, `swaths`, `calibrate`, `wind`, `storms`, `events`, `hoods --near T`,
  `map --day D --near T`, `export` (storms.json), `status` (table counts).
- `python3 hh.py doors --day 2026-07-01 --near Fremont`: one door list (csv + xlsx + map)
- `python3 hh.py everyday --near Fremont --radius 40 --lists 5`: old-house (non-storm) door lists ranked by
  "everyday heat" (share of older homes, owners, value, distance); published in hud.json `everyday_lists`. `refresh`
  also always builds one list per town in config.json `everyday_towns` (T97: Schuyler, Columbus, Lexington NE; best
  neighborhood within `everyday.town_radius_mi` 5 of each); those lists carry `town_pick`, and every everyday list
  carries `spanish_share` + `good_for_spanish` (share >= language.spanish_high). hud.json
  also carries `hail_evidence` per address for storm lists (porch proof).
- `python3 hh.py todaywalk --doors 25 [--date D] [--results doors.json] [--out walk.json] [--evidence-out ev.json]`:
  O0 "Today's knock": ONE walk (fresh strong storm walk, else best everyday walk), houses only in walking order, for
  the HMP App's `today/walk` doc; adds est_minutes, walk_mi, drive_from_home_mi, best_time{en,es}, stale + stale_note
  (hud.json >36 h old), spanish_share + who, per-stop `coach {en, es, tags}` (T83); no walk -> stops [] +
  none_reason{en,es}. `--evidence-out` writes `evidence/<slug>` docs (slug = "address city" lowercased,
  non-alphanumerics to "-"). `--results` = the app's door taps. Seasonal: Oct-Mar storm walks may use storms up to
  330 days old; Nov-Feb knock 3:30-5:30 PM.
- `python3 hh.py zones [--near Fremont] [--radius 60] [--top 12] [--doors 25] [--out zones.json] [--walks-out walks.json]`:
  hot zones (app doc `zones/current`: id = walk id, center, polygon, score, heat 0-1, why EN/ES) + one walk per zone in
  today/walk shape (`walks/<zone id>`), houses ranked by door score v2 (weights in config.json `door_score`); every
  stop has `door` + `why`.
- `python3 hh.py calltoday [--hud hud.json] [--date D] [--out calls.json] [--csv f]`: today's BUSINESS call list
  (apartment/commercial with a known business line in fresh 1"+ hail), EN/ES why + opener (free inspection, no
  insurance talk); JSON for the app's `calls/today` doc. `--accounts f` (+ scout contacts, always): the doc also gets
  the "Your accounts hit" block, shown FIRST (round 54, additive; every old field stays): `accounts_title {en, es}`,
  `accounts_count`, `accounts_checked` (null = no check ran), `accounts_hit[]` = the alerts below plus call-card
  fields {rank, name, phone, ask_for, hail_in, day, days_ago, why{en,es}, opener{en,es}, also[], call_rank}. Homes
  (lead/claim/door): name = the address, phone "" (the app's own record, by `key`); never an owner name. Businesses:
  one row per business line (other buildings in `also`); when that line is also a building call, the row has
  `call_rank` and the call gets `account_hit: true`. Openers: a free roof and siding check, no insurance talk.
- `python3 hh.py accounts [--accounts f] [--hud f] [--date D] [--days N] [--no-scout] [--out f]`: round 54 "storm alert
  on your own accounts" (`accounts.py`). Accounts file = a list of {kind: lead|claim|door|commercial, key, address,
  city, lat?, lon?, since?} or the app's exports as one file {leads, claims, doors} (leads/claims except stage "lost";
  doors with result interested/booked; `since` = created_at / date_of_loss / tap date: only LATER hail is new), plus
  `data/scout_contacts.json` businesses (business lines only). Hail bar = `call_today.min_hail`; window = config
  `accounts.max_days`, else `today_walk.storm_max_days` (60). Out: {date, since, days, min_hail, checked, located,
  radar, alerts[], not_located[]}; alert = {key, kind, address, city, event_date, days_ago, peril hail|wind,
  max_hail_in, max_wind_mph, distance_mi, source, match at|near, hail_report {day, hail_in, nearest_report,
  radar_max_in} (hud.json hail_evidence shape; null for wind), hail_report_hint {doc "evidence/<slug>", en, es},
  other_days[]} (+ name, phone, ask_for for businesses). `source`, best first: `radar` (engine database radar at
  the address; local only), `hail_evidence` / `door_list` / `commercial` (hud.json, that exact address), then
  "near": `near_house` (storm door-list house within `accounts.near_mi` 0.6), `storm_report` (hud.json storms within
  `accounts.report_mi` 3), `wind_report` (wind_events with a wind band, 58+ mph or damage, within 3 mi).
- `python3 hh.py followups --leads leads.json [--date D] [--out f] [--export-rules]`: follow-ups due for
  Interested/booked leads (touches 2/5/10 days after first Interested), grouped today/tomorrow/later, EN/ES.
- `python3 hh.py weekly --doors doors.json --leads leads.json [--week YYYY-WW|all] [--hud hud.json] [--out f]`: results
  from the app's door taps + leads (totals, by kind/list/walk, best/worst area EN/ES, follow-ups, funnel, `learning`).
  T84: `industry` = each funnel rate next to data/benchmarks.json ranges {yours, low, typical, high, source_note, vs},
  labeled "industry estimate, not your numbers" (`--benchmarks f`; missing file -> null). todaywalk's goal_note adds an
  industry doors/hour time estimate (+ `pace`) when there are no door results yet.
- `python3 hh.py daily --out-dir DIR [--date D] [--hud f] [--results f] [--dnk f] [--leads f] [--accounts f] [--near T]
  [--doors N]`: the morning app job in one go (todaywalk + evidence, calltoday + accounts_hit, zones + walks, followups
  when --leads given). Accounts = `--accounts` + the `--leads` and `--results` exports + scout contacts; alerts with a
  hail report also get `evidence__<slug>.json` (unless the walk wrote it); manifest `accounts` {checked, located,
  alerts, radar}. One JSON
  file per app doc, named by doc path with "/" -> "__": `today__walk.json`, `calls__today.json`, `zones__current.json`,
  `walks__<zone id>.json`, `evidence__<slug>.json`, `followups__today.json`, plus `manifest.json` {date, files{doc
  path: file}, skipped[], errors[]}. One part failing never stops the others; exit 1 only if today/walk wasn't written.
- `python3 hh.py tune ...`: T35 learning loop, real door results -> small weight changes (dry run unless `--apply`;
  waits for ~50 doors).
- `python3 hh.py estimate --json job.json` (or `--footprint 1400 --stories 2`): quick price range from
  `prices_reference` until HMP's `prices` are set. `--export-rules [--out f]` = the app's `system/prices` doc;
  re-export whenever prices change.
- `python3 hh.py takeoff --json job.json [--text] [--export-rules]`: material order list, EN/ES supplier text, no
  prices; `--export-rules` = the app's `system/takeoff` doc.
- `python3 hh.py hailreport ... [--json]`: one-address hail report EN/ES (JSON feeds `docs/print/hail-report.html`).
- `python3 hh.py commercial`: apartment/commercial targets (csv + xlsx)
- `python3 hh.py hud`: rebuild hud.json only
- `python3 hh.py diff --old OLD_hud.json`: new 1"+ hail within 150 mi vs an older hud.json (how alerts are found)
- `python3 hh.py serve`: local phone-friendly tracker on the Mac's wifi (backup/admin only; crews use the HMP App)
- `python3 hh.py bundle --out engine.json` / `unbundle --src engine.json`: pack/unpack the code for the command
  center's `engine/engine.json` (Cowork re-bundles, T61)
- `python3 hh.py selftest`: offline tests. JS twins: `node tests/js/{estimate,takeoff,followups,translate}_check.js`

## Scoring (short)
- Hail at each house = radar (MRMS MESH x one region-wide calibration factor, recomputed by `refresh` every 30 days)
  corrected locally by nearby trusted ground reports (fades out over ~4 mi).
- House score = size x recency x distance x roof age x building type x owner-occupied x sold-after-storm flag.
  Door score v2 (`doorscore.py`, used by zones): hail, owner-occupied share + recent sale, single-family, roof age,
  value. "Likely insured" = owner-occupied + residential + mortgage/recent sale proxies (round 16).
- Per-house owner-occupied (T23, `owners.py`): where a county publishes the owner's MAILING address, same as the
  house address = owner lives there (True), different = landlord (False), blank/PO box = unknown. Downloaded by
  parcel tile when door lists are built (doors/everyday, try/except, 120 s budget, cached 180 days in db tables
  `owner_occ` + `owner_tiles`); `hud.py` sets stop `owner_occ` + new field `owner_source` from the cache (offline).
  Door score v2 then uses the house flag (`parts.owner_basis` = "house") instead of the neighborhood share.
  Sources (`owners.SOURCES`): **Sarpy, Douglas and Lancaster work** (Sarpy: ArcGIS Online `Parcel_Sales2`, ~77k
  parcels, with sale date; Douglas: dcgis.org `Parcels_public`; Lancaster: gis.lincoln.ne.gov Assessor/TaxParcels;
  the last two have no sale date). **Dodge (Fremont) is not wired**: dodge.gisworkshop.com's TLS certificate is
  expired and http is refused, and TLS checks are never skipped; add a `SOURCES` entry once it is fixed. Owner NAMES
  are never requested or stored (homes rule); the mailing address is compared in memory and dropped.
- Everyday heat (T163): also x `afford` = `everyday.income_curve` on the block group's median household income
  (ACS B19013, table `acs_income`, optional load in `nbhd.load_income`; unknown = 1.0). Cash/old-house score only,
  never storm, door-score or zone scores.
- Size: 1" = 0.40, 2" = 0.93. Recency: full to 45 days, 0.4 at 1 yr. Distance: full to 30 mi.
- Wind (T6): `refresh` pulls NWS wind reports into `wind_obs` and hud.json's `wind_events` (gusts in mph, own
  score). Informational only: door lists and neighborhood scores stay hail-only.
- Wind zones (T116-T118, round 23): `wind_events[]` also carries `wind_score` 0-100 (= 100 x gust band x the hail
  recency + distance curves; bands in config `wind_score`: <58 mph 0, 58-64 0.35, 65-74 0.65, 75-89 0.85, 90+ 1.0;
  damage report with no gust 0.35) + `wind_parts`, `trees_down` / `tree_sample` (NWS files fallen trees as wind
  damage with "TREES DOWN" in the remark; there is no separate tree type), and `wind_dir` (the LSR feed has NO
  direction field; only filled when the remark says it, e.g. "winds from the northwest"; `wind_obs.bearing` is the
  direction from home base, not wind). `hh.py zones` appends kind "wind" zones after the walk zones (own map
  layer, no walk, cap `zones.wind_top` 8). Never folded into hail house/door scores.
- All weights in `config.json`; README has the storm score table.

## HMP HQ snapshot (`hq/snapshot` on https://claude.ai/artifact/HhK5UGhHG3VpNR7HuaqEpj)
How to refresh: the `refresh-hmp-hq` skill. Fields: `needs_you[]` {sev critical|warning|info, en, es, link};
`storms` {latest_storm_day, headline{en,es}, best_walk{area,day,turf,streets,doors,avg_hail,link}, fresh[] top 5 by
score, last 60 days {day,place,state,hail,dist_mi,score}, link}; `leads` {stages[] {key,en,es,count} for the 9 stages
+ Lost, hot[] {address,stage,next}, doors_logged, calls_logged, link}; `jobs[]` {name, scope_en, scope_es, progress,
buildings[] {name,progress,crew,updated_at,flag?{sev,en,es}}, link}; `crews[]` {names,job,where}; `ai` {en,es,link}.
Every sentence in both English and Spanish; stamp `updated_at` (UTC ISO) and `updated_by`.

## Claims schema (HMP App db `claims`, https://claude.ai/artifact/9N97Uzv8J9EAueSKhCNSPT)
Claims moved from the old Claim Tracker page (CoMGoPQWcM5ZyHGoMAYqSG, retired) into the HMP App. FilthE texts
updates ("1418 Irving, adjuster Tuesday, State Farm, claim 45-889"); Claude writes one doc per job, id = address
slug: {address, city, homeowner_first_name, stage (inspected|claim_filed|adjuster_set|scope_in|signed|supplement|
materials_ordered|installed|depreciation_requested|paid|lost), insurer, claim_no, adjuster{name,phone},
date_of_loss, adjuster_date, scope_date, rcv, acv{amount,received,deposited}, depreciation_held,
mortgage{company,amount,check_sent,check_returned}, supplements[]{date,item,asked,approved},
materials{ordered,supplier,cost}, install{start,done}, completion_sent, depreciation_check{amount,date},
contract_price, deductible (homeowner's cost, display only), next_step{en,es,due}, notes, updated_at, updated_by};
tips in `meta/guide` {en, es}. Money in dollars, dates YYYY-MM-DD.

## Command center database (Cowork owns, https://claude.ai/artifact/6cCATKJSoyWA7kbH4Em8VX)
Reads published `data/hud.json` (from the `engine/engine.json` bundle). Shared db: `turfs/<listId>~t<n>` = {results},
`targets/<slug>` = {status}, `calls`, `system/log`. Old storm-list tracking; never delete or overwrite crew results.
