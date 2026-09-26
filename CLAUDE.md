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

## Current orders (FilthE, 2026-09-25)
**Build orders O1-O6 are in `docs/orders/build-orders.md`** and on the Crew HQ board (T51-T60, T35). Big change:
Crew HQ becomes the **HMP App** (same link; Today / Leads / Money / Crew tabs, one database), and the King chat
becomes the one inbox that logs leads, doors and claims. Work them in order; the price sheet (T51) comes from
FilthE and the boss. **Top priority inside the app: O0 "Today's knock"**: one area a day, houses only in walking
order, one tap per door (Not home / No / Interested / Booked). FilthE finds the command center too messy to use
for this. **Where to knock = the engine's hottest zones (FilthE, 2026-09-25)**, via Today's knock; don't push
"knock around The Edge / job-site neighbors" as the plan (the neighbor note is an optional extra). **Long-term (FilthE, 2026-09-25):** he may sell the HMP App to other roofers someday, so build it clean
enough to become a product (research round 4 covers this). **Ownership (FilthE, 2026-09-25): FilthE owns the app** (the
software); HMP is its first user.

## Workarounds for now (FilthE, 2026-09-26) - don't keep asking
- Prices (T51): the quick quote uses `prices_reference` market ranges, labeled "estimate range, not final", until the boss's
  prices arrive; then it switches automatically.
- Registration # (T64): print pieces keep a blank line to write it in by hand.
- Contract lawyer review: deferred. The draft (with the 3-day cancel notice + deductible notice) is the one to use, whole, never a
  handshake; the lawyer's OK comes later.

## App look (FilthE, 2026-09-26)
The HMP App uses **"HMP Pro Dark"**: charcoal + silver/white text, orange (#f5883a) only for accents/primary actions, no pixel
art or neon. Fonts match the print pieces: **Barlow Semi Condensed** (headings, numbers, buttons) + **Montserrat** (body). The
Crew tab is a clean **team board** (a card per AI: role, status dot, now doing, last result), not the pixel office.

## Chain of command (FilthE, 2026-09-26)
**Claude Code (the cloud session) is now the King / lead**: it sets priorities on the Crew HQ board, gives the orders, runs
the Code lab helpers, and checks Crew HQ every hour (7 AM-10 PM Central) to act right away. **The old King (the claude.ai
project chat + its 8:12 AM / 6:12 PM routines) is the Right Hand**: it answers FilthE live in the app's King box, logs what
he says (leads, doors, claims), runs the standup/wrap summaries and HMP HQ refresh, and passes his words to Claude Code as
handoffs (`to: "code"`). It takes orders from Claude Code and doesn't reassign Code-lab work. Cowork still owns the command
center and Storm Watch.

## Start here: what every new session should already know
This file is the shared memory. Claude sessions don't share chat history (claude.ai chats, Cowork and
Claude Code each start blank), so **when FilthE tells you something important, add it here** instead
of making him repeat it next time.
**The company (from FilthE's company brief, 2026-09-25)**
- Early-stage but working: HMP mostly **subcontracts labor** today (the hiring contractor supplies
  materials). Contractors that hire HMP include **VTR Contracting** and **Nastase Contracting**.
  Nastase (Omaha, family-owned since 1977, roofing/siding/gutters, residential + commercial) already
  does storm-damage and insurance-claim work: the natural partner for the "sub for restoration" path.
  VTR: no public web presence found (2026-09-25); ask FilthE for city/full name. Services: siding (incl. James Hardie lap), flashing, soffit, fascia, remodeling, roofing,
  on houses and apartment complexes.
- **Several crews of 2-3 people**, adding another. Current main job: **The Edge Apartments** (5
  buildings: tear-off above the concrete, new flashing/tape/1x4 furring, gray lap siding, wood-look
  accents, caulk). Its live job board and a general job tracker were built in other Claude chats.
- **Brand (FilthE shared the logo 2026-09-25):** chrome "H.M.P" letters under an orange roof-line chevron, an orange
  underline, "SIDING & ROOFING LLC", "RESIDENCIAL y COMERCIAL", on dark charcoal metal siding. Colors: charcoal
  ~#404145, orange ~#f5883a, silver/white. Company phone on the logo: 402-889-3385. Use this look on everything
  printed; the photo lives in the Mac/claude.ai chat, not the repo (recreate it as SVG when needed).
- **Print contacts:** English side = Kenny Cruz, cell 402-936-2709. Spanish side = **Alex Mendez**, business line
  402-889-3385 (FilthE, 2026-09-25).
- **The boss** owns and runs it and speaks Spanish. **FilthE** (Kenny Cruz; phone for printed materials
  402-936-2709; contractor registration # pending from the boss) is his right-hand man: translates, runs
  the AI/organization side, is the only one building this system, and does all the insurance sales.
- **Not storm-only (FilthE, 2026-09-25):** storms are one lead source, not the only one. HMP also sells regular
  (non-insurance) siding and roofing to **old houses** with worn siding or roofs. Lead tools, door lists and print
  pieces need an everyday version too (house age / year built, not just hail).
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
**HMP HQ (the business dashboard, EN/ES):** https://claude.ai/artifact/HhK5UGhHG3VpNR7HuaqEpj
- The page only shows db doc `hq/snapshot`, written by Claude. "Refresh HMP HQ" = read the sources, rewrite
  that one doc (ArtifactData set), stamping `updated_at` (UTC ISO) and `updated_by`. The King should do it
  at every morning standup and evening wrap. Sources: Edge Site Map db `buildings`
  (https://claude.ai/artifact/6wBLswpVCaBMoc6dbrKcyn); command center db `turfs`, `calls`, `targets`,
  `system/log` + published `data/hud.json` (https://claude.ai/artifact/6cCATKJSoyWA7kbH4Em8VX); Crew HQ
  `board/current` waiting list.
- Snapshot fields: `needs_you[]` {sev critical|warning|info, en, es, link}; `storms` {latest_storm_day,
  headline{en,es}, best_walk{area,day,turf,streets,doors,avg_hail,link}, fresh[] top 5 by score, last 60 days
  {day,place,state,hail,dist_mi,score}, link}; `leads` {stages[] {key,en,es,count} for the 9 stages + Lost,
  hot[] {address,stage,next}, doors_logged, calls_logged, link}; `jobs[]` {name, scope_en, scope_es,
  progress, buildings[] {name,progress,crew,updated_at,flag?{sev,en,es}}, link}; `crews[]` {names,job,where};
  `ai` {en,es,link}. Every sentence in both English and Spanish.
**Claim Tracker (EN/ES):** https://claude.ai/artifact/CoMGoPQWcM5ZyHGoMAYqSG. FilthE texts updates ("1418 Irving,
adjuster Tuesday, State Farm, claim 45-889"); Claude writes db collection `claims`, one doc per job, id = address
slug: {address, city, homeowner_first_name, stage (inspected|claim_filed|adjuster_set|scope_in|signed|supplement|
materials_ordered|installed|depreciation_requested|paid|lost), insurer, claim_no, adjuster{name,phone}, date_of_loss,
adjuster_date, scope_date, rcv, acv{amount,received,deposited}, depreciation_held, mortgage{company,amount,check_sent,
check_returned}, supplements[]{date,item,asked,approved}, materials{ordered,supplier,cost}, install{start,done},
completion_sent, depreciation_check{amount,date}, contract_price, deductible (homeowner's cost, display only),
next_step{en,es,due}, notes, updated_at, updated_by}; tips in `meta/guide` {en, es}. Money in dollars, dates YYYY-MM-DD.
**Practice Door:** https://claude.ai/artifact/PFKkgWCMshKnE2nWFssM7B - AI homeowner role-play (EN/ES) + scorecard with
legal flags; uses FilthE's Claude usage. **Print kit (`docs/print/`):** door hanger (styles A/B/C in `styles/`, FilthE
picking), `claims-101.pdf`, `adjuster-checklist.pdf`.
**Claude Code's helpers (in this repo, `.claude/`):** 5 main helpers (FilthE, 2026-09-25: a few main
roles; one-off helpers work under them and get no robot of their own in Crew HQ): `engine-mechanic` (engine code), `builder` (Claude pages and
tools: Crew HQ, HMP HQ, Practice Door, Claim Tracker), `designer` (print pieces, brand look, page
design; makes 2-3 options for FilthE to pick), `hub-keeper` = the **Research Lead** (id kept for Crew
HQ history; cheaper model) with its team of `improvement-scout`s (web research, one topic each, run in
parallel), and `qa-tester` (reviews + tests everything before it ships, cheaper model);
skills `engine-change` (safe engine edits), `crew-checkin` (posting to Crew HQ), `refresh-hmp-hq`,
`improvement-research` (research method + report format). FilthE wants regular research rounds: he
worries about missing areas or focusing on the wrong things. Research rounds go to `docs/research/`.
They show in Crew HQ's Code lab. Keep the crew small: add a helper only for work that repeats.
**AI hub (task board + the King's orders):** HailHunter Crew HQ, https://claude.ai/artifact/Qkc52bt2JL5gW7ZKWBJDHU
- read its database docs `board/current` and `system/king` (Artifact/ArtifactData tools) for current tasks.
- Since 2026-09-25: `board/current` in Crew HQ is the SOURCE OF TRUTH for tasks (update it directly,
  stamping `updatedAt` + `updatedBy`; BOARD.md only mirrors it). FilthE answers the "waiting on you"
  questions with buttons on the board: his answers land in the `answers` collection (+ an event to the
  King); act on them, then drop answered items from `board.waiting`. `system/memory` {facts[], updatedAt,
  updatedBy} is the short shared-memory panel. Post to `events` with {agent, at, kind, to, lane, room,
  status, task, text}; a handoff shows "picked up" once the receiver checks in after it.
- Crew HQ also has a live "Talk to the King" chat (page `sample` capability): while FilthE has the page
  open, "King (live)" replies in seconds and may close/add questions, change tasks, send orders to
  Cowork/Code (events `...-king-o<n>`) and add memory. Its replies are events `...-king-live`; the
  scheduled King treats them as its own decisions. FilthE has his door-to-door permits (don't ask again).
**Research:** rounds live in `docs/research/`. Round 1 (2026-09-25): knocking, not software, is the bottleneck.
Round 2 (2026-09-25): FilthE hasn't knocked a door or run a claim yet and will learn; plan is foundation
first (D11 answered No: no build freeze), so build tools that also teach him sales and claims.
**Answered 2026-09-25:** registered and insured for roofing work: yes. Path: **both** - direct to
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
- `python3 hh.py everyday --near Fremont --radius 40 --lists 5`: old-house (non-storm) door lists ranked by
  "everyday heat" (share of older homes, owners, value, distance); also built by `refresh` (top 3) and published
  in hud.json `everyday_lists`. hud.json also carries `hail_evidence` per address for storm lists (porch proof).
- `python3 hh.py todaywalk --doors 25 [--date D] [--results doors.json] [--out walk.json] [--evidence-out ev.json]`: O0
  "Today's knock": picks ONE walk (fresh strong storm walk, else best everyday walk), houses only in walking order, for the
  HMP App's `today/walk` doc; adds est_minutes, walk_mi, drive_from_home_mi, best_time{en,es}, stale + stale_note (hud.json
  >36 h old), spanish_share + who; no walk -> stops [] + none_reason{en,es}. `--evidence-out` writes `evidence/<slug>` docs
  (slug = "address city" lowercased, non-alphanumerics to "-"). `--results` = the app's door taps.
- `python3 hh.py weekly --doors doors.json --leads leads.json [--week YYYY-WW|all] [--hud hud.json] [--out f]`: results report
  from the HMP App's door taps + leads (totals, by kind/list/walk, best/worst area EN/ES, follow-ups, funnel, `learning`
  section for T35). todaywalk is seasonal: Oct-Mar storm walks may use storms up to 330 days old; Nov-Feb knock 3:30-5:30 PM.
- `python3 hh.py calltoday [--hud hud.json] [--date D] [--out calls.json] [--csv f]`: today's BUSINESS call list (apartment/
  commercial buildings with a known business line in fresh 1"+ hail), one call per line, EN/ES why + opener (free inspection,
  no insurance talk); JSON for the HMP App's `calls/today` doc.
- `python3 hh.py estimate --json job.json` (or `--footprint 1400 --stories 2`): quick price range; uses `prices_reference`
  (market ranges) until HMP's `prices` are set. `hh.py hailreport ... --json` also writes JSON for docs/print/hail-report.html.
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
