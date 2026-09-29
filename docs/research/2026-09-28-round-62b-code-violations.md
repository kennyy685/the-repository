# Round 62b (2026-09-28): Omaha/Lincoln/Fremont code-violation data — verified

## Verdict (read this, skip the rest if busy)
**Real, free, legal — but weaker than round 62 hoped, and it doesn't change which door FilthE knocks today.**
Omaha's 311 system ("Mayor's Hotline") does publish a public, no-login ArcGIS layer with a
`Code/Housing Violati[on]` category, ~88 new cases/month citywide, address-level, no owner names. But
the public data has **no roof/gutter/siding sub-type at all** — every case just says "Code/Housing
Violation," full stop, so it can't be filtered to exterior/roof issues the way round 62 hoped. It's also
**Omaha-only**: Lincoln/Lancaster publishes no such layer, and Fremont/Dodge County has no GIS open-data
presence to check at all. Since FilthE isn't knocking Omaha yet (Fremont-first, no permit push there),
this is a legitimate but **low-priority backlog item**, not a build-now signal. The specific dataset URL
round 62 flagged (`nebraskamap.gov/datasets/30cac7cf...`) does not resolve to anything findable — likely
a bad/unverifiable guess, not a real, distinct "Planning Building Code Violations" dataset separate from
the 311 layer below.

## 1. Does it exist and is it open? (Omaha)
**Yes, but it's Omaha's 311/"Mayor's Hotline" service-request system, not a stand-alone "Planning
Building Code Violations" dataset.** The exact nebraskamap.gov item id round 62 cited
(`30cac7cf734341a9ac71bef6d25a1d55`) returns **404 "Cannot find item"** when queried on ArcGIS's own
catalog, and does not appear anywhere in Omaha's ArcGIS org listing — treat that specific URL as
unverified/likely wrong, not confirmed. What I found instead, by searching ArcGIS Hub's public catalog
for Omaha's org (`orgid=tIBLyYZX96jUntYm`, found via `https://hub.arcgis.com/api/search/v1/collections/site/items?q=Omaha`,
which surfaces `planning-omaha.hub.arcgis.com` and sibling `-omaha` sites all owned by that org) and then
paginating `https://hub.arcgis.com/api/search/v1/collections/dataset/items?orgid=tIBLyYZX96jUntYm&limit=50`:

- **Layer**: `https://dcgis.org/server/rest/services/Cityworks/Mayors_Hotline_HubPage/FeatureServer/1`
  ("Service Requests - 12 months," point layer). Confirmed public: **access=public, license=none, source="City
  of Omaha"** on its ArcGIS Online item (`id 3bf9f289164a43a0bfc004833345f120`, viewable via the same
  orgid dataset listing above). No login, no API key — plain `?f=json` works.
- **Fields**: `OBJECTID, REQUESTID, PROBLEMCODE, DESCRIPTION, DETAILS, PROBADDRESS, INITIATEDBY,
  SUBMITTO, DATETIMEINIT, DATETIMECLOSED, WORKORDERID, SRX, SRY, STATUS, REQCATEGORY, PROBLEMSID,
  Request_Init_byOrg, Submit_To_byOrg, InitiatedDept, SubmitToDept`. **No owner-name field** — only
  `PROBADDRESS` (street address) identifies the property. Coordinates are in NE State Plane (wkid 103096 /
  6880, feet) — add `&outSR=4326` to any future query to get plain lat/lon, no manual reprojection needed.
- **Records**: 57,871 total in the current window, **all problem types combined** (potholes, graffiti,
  weeds, parking, etc. — this is the whole city 311 system, code violations are one bucket in it).
- **Date range**: exactly rolling 12 months — min date 2025-09-28, max date **2026-09-28 (today)**, checked via
  `.../FeatureServer/1/query?f=json&where=1=1&outStatistics=[{min/max on DATETIMEINIT}]`. It updates at
  least daily; there's no deeper archive in this public view (older cases roll off).
- A companion table, `.../FeatureServer/4` ("ProblemTypeCount"), gives the full 165-category breakdown in
  one call — that's how the numbers below were pulled, not by scraping every row.

## 2. Can we filter to roof/gutter/siding per address?
**No — this is the round's key negative finding.** The relevant bucket is `PROBLEMCODE = 'Code/Housing
Violati'` (Esri truncates to 20 chars) — **1,056 cases in the last 12 months (~88/month)**, of which
**347 are still open ("IP") and 685 already "CLOSED"** (query:
`.../FeatureServer/1/query?f=json&where=PROBLEMCODE='Code/Housing Violati'&returnCountOnly=true`, then
repeated with `AND STATUS='IP'` / `='CLOSED'`). A separate `Zoning Violation` code exists too (84/12mo),
unrelated to exterior condition. But **`DESCRIPTION` just repeats the problem code** ("Code/Housing
Violation") and **`DETAILS` is blank on 99.7% of all 57,871 records** (only 159 non-blank, checked with
`WHERE DETAILS IS NOT NULL AND DETAILS <> ''`) — sampled 15 real "Code/Housing Violation" rows and every
one had an empty `DETAILS`. **The public data cannot tell you whether a given case is a bad roof, peeling
paint, a broken window, or an occupancy issue** — Omaha's own "common violations" page lists all of those
under code enforcement, but the 311 layer doesn't carry the sub-type. Other violation flavors that
*might* overlap roofs/gutters in spirit (litter, junk vehicles, weeds, graffiti) already have their own
separate, unrelated problem codes, so "Code/Housing Violation" is probably weighted toward structural/
housing-condition issues — but that's inference, not something the data proves.
There's also **no residential/owner-occupied field** — every address (rental, commercial, vacant) is
mixed in; using this for real would need a spatial join to HMP's existing parcel/owner data
(`hailhunter/owners.py`), which isn't built.

## 3. Lincoln/Lancaster and Fremont/Dodge County
- **Lincoln: nothing public.** Lincoln's ArcGIS org (`orgid=wpJGOi6N4Rq5cqFv`, found the same way via a
  Lincoln-unique dataset — `StarTran Bus Stops` — search, then confirmed at
  `https://gis.lincoln.ne.gov/public/rest/services?f=json`). Checked every relevant folder directly:
  `BuildingSafety` (Addresses, BuildingFootprints, CountyFees, InspectorAreas only — no violations/
  citations layer), plus `Planning`, `UrbanDevelopment`, `CityCounty`, `Health`, `InformationServices`,
  `RTSD`. Also searched inside the org via
  `https://hub.arcgis.com/api/search/v1/collections/dataset/items?orgid=wpJGOi6N4Rq5cqFv&q=<term>` for
  `violation`, `nuisance`, `code enforcement`, `complaint`, `citation` — the only real hits are Lincoln
  Police traffic-stop/arrest/citation datasets (irrelevant) and internal housing-committee survey forms.
  **No code-enforcement/property-maintenance layer exists in Lincoln's public GIS.**
- **Fremont/Dodge County: no GIS presence found at all.** No ArcGIS Hub site or org turned up for either
  (`site`/`dataset` searches for "Fremont Nebraska" and "Dodge County Nebraska" both returned 0-2
  irrelevant hits). `dodgecounty.nebraska.gov` is blocked from this container so I couldn't double-check
  directly; `fremontne.gov` is reachable but is the plain city website, not a GIS/API. This matches round
  61's existing "Fremont code search = an unconfirmed phone call" backlog item — not newly resolved here,
  and out of scope for the ArcGIS method this round used.
- **Council Bluffs**: skipped per instructions.

## 4. Legal / fit
- **Public record, fine to use for choosing doors.** It's a government-run, openly licensed
  (`license: none`, `access: public`) 311 system, no login, no ToS click-through — the same class of
  public data as the county deed/assessor records round 62 already used. Not insurance-related (44-8604
  deductible rules and claims-negotiation limits don't touch routine city code enforcement), not a bought
  list, not a scrape of anything gated.
- **No owner names in the usable layer** — `PROBADDRESS` is the only per-property identifier, which fits
  HMP's rule. Two things to build around, not around: (1) a **sibling layer in the same service**,
  `.../FeatureServer/7` ("Service Requests Initiated by Citizen Reporter"), is *also* marked public and
  its schema includes `EMAIL`, `LASTNAME`, `ORGANIZATION`, `COMMENTS` — this looks like the 311
  *reporter's* contact info exposed on a public endpoint (the city built a separate, deliberately
  PII-stripped "read-only view" for their own public app, and this isn't it). I did not query it beyond
  field names, and it should never be touched or stored by HMP. (2) The layer we *do* want has an
  `INITIATEDBY` field that's usually a generic "Citizen, Reporter" placeholder but sometimes shows what
  looks like a real staff name — never read or store that field either.
- **Tact flag, not a legal one.** A flagged address means the city is pressuring an owner to fix
  something, sometimes on a deadline — that can be genuine, honest urgency (comparable to storm urgency,
  totally fine to act on as a private prioritization signal), but it can also mean an owner in real
  hardship, an absentee landlord, or a renter who isn't the decision-maker. If this ever gets built:
  it's a **prioritization signal only** — never something mentioned at the door ("I saw your violation"
  reads as surveillance and helps nobody), same handling as every other proxy score already in the app.

## 5. Verdict against round 62's test
Round 62 flagged this as "potentially the single most direct, government-verified 'this house needs a
roof' signal." Verified reality is smaller: it's a generic "some code/housing violation exists" flag with
no exterior/roof sub-type, Omaha-only, capped around **~88 new cases/month citywide across all
housing-violation types** (not roof-specific), only **~347 still open right now** (all types, all of
Omaha) — and even that needs a parcel join HMP hasn't built before it's usable as an address list.
**Does it change which door FilthE knocks today? No.** He isn't knocking Omaha yet, and even there this
can't isolate roof-relevant houses without either building the parcel join or opening each city case
by hand (which defeats the point of a bulk signal). **Recommendation: log it, don't build it now.** Keep
it below round 62's #1-2 (ACV/roof-age education, the free Census mortgage layer) and the Nextdoor/
referral/Google-LSA items — revisit only once HMP's everyday-lead reach actually extends into Omaha
(`everyday_towns`, T97).

## Sources (exact URLs queried this round)
- Omaha org discovery: `https://hub.arcgis.com/api/search/v1/collections/site/items?q=Omaha` (surfaces
  `orgid=tIBLyYZX96jUntYm` via `planning-omaha.hub.arcgis.com` and sibling sites)
- Omaha org's full dataset list: `https://hub.arcgis.com/api/search/v1/collections/dataset/items?orgid=tIBLyYZX96jUntYm&limit=50` (paginated via `links.rel=next`, 203 items)
- Round 62's flagged item, checked and NOT found: `https://www.arcgis.com/sharing/rest/content/items/30cac7cf734341a9ac71bef6d25a1d55?f=json` — host blocked; retried via `https://hub.arcgis.com/api/search/v1/collections/dataset/items/30cac7cf734341a9ac71bef6d25a1d55` — **404 Not Found**
- Omaha 311 folder: `https://dcgis.org/server/rest/services/Cityworks?f=json`
- The layer itself: `https://dcgis.org/server/rest/services/Cityworks/Mayors_Hotline_HubPage/FeatureServer/1?f=json` (fields), `.../FeatureServer/1/query?f=json&where=1=1&returnCountOnly=true` (57,871), `.../FeatureServer/1/query?f=json&where=1=1&outStatistics=[...]` (date range)
- Problem-type breakdown table: `https://dcgis.org/server/rest/services/Cityworks/Mayors_Hotline_HubPage/FeatureServer/4/query?f=json&where=1=1&outFields=*&resultRecordCount=2000`
- Code/Housing Violation counts: `.../FeatureServer/1/query?f=json&where=PROBLEMCODE='Code/Housing Violati'&returnCountOnly=true` (1,056), same with `AND STATUS='IP'` (347) / `='CLOSED'` (685)
- DETAILS-field check: `.../FeatureServer/1/query?f=json&where=DETAILS IS NOT NULL AND DETAILS <> ''&returnCountOnly=true` (159 of 57,871)
- PII-risk sibling layer (field names only, not queried for rows): `https://dcgis.org/server/rest/services/Cityworks/Mayors_Hotline_HubPage/FeatureServer/7?f=json`
- Lincoln org discovery: `https://hub.arcgis.com/api/search/v1/collections/dataset/items?q=StarTran` (surfaces `orgid=wpJGOi6N4Rq5cqFv` via `gis.lincoln.ne.gov`)
- Lincoln folders checked: `https://gis.lincoln.ne.gov/public/rest/services?f=json`, then `/BuildingSafety`, `/Planning`, `/UrbanDevelopment`, `/CityCounty`, `/Health`, `/InformationServices`, `/RTSD` (each `?f=json`)
- Lincoln org text search (no relevant hits): `https://hub.arcgis.com/api/search/v1/collections/dataset/items?orgid=wpJGOi6N4Rq5cqFv&q=<violation|nuisance|code enforcement|complaint|citation>`
- Fremont/Dodge County (nothing found): `https://hub.arcgis.com/api/search/v1/collections/site/items?q=Fremont%20Nebraska` and `?q=Dodge%20County%20Nebraska` (0 and 0 relevant matches)
- Network notes: `nebraskamap.gov`, `dogis.org` (incl. `gis.dogis.org`), `opendata.arcgis.com`, `opendata.cityofomaha.org`, `www.arcgis.com`, `services1-8.arcgis.com`, `utility.arcgis.com`, `tiles.arcgis.com`, `dodgecounty.nebraska.gov`, `planning.cityofomaha.org` all blocked from this container (403 on CONNECT). `hub.arcgis.com`, `services.arcgis.com`, `dcgis.org`, and `gis.lincoln.ne.gov` answered directly and are the ones this round's findings rest on.
