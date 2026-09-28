# Research round 61 (2026-09-28): where do I start, and how do I know it's real?

FilthE's feedback, answered: (1) he wants an open map to pick from, not a single pre-picked zone;
(2) he wants to see where the hail/damage/insurance evidence for a house comes from; (3) he wants
every high-chance area found fast, not just our own scored list.

**Note before anything else:** `docs/design/open-map/` already exists on this branch (Bricolage +
Geist font files staged, untracked, no page yet) — someone already started the "open map" direction
this finding recommends. Check with whoever staged it (Designer/Builder session) before starting new
work so this doesn't get built twice.

## Bottom line
1. **This is a surfacing problem, not a missing-data problem.** The engine already pulls NOAA MRMS
   MESH radar hail, NWS local storm reports/SPC reports, and mPING crowd reports (`hailhunter/mrms.py`,
   `srcName` map in `pages/hmp-app.html` line ~1572), and already tags per-house owner-occupied with
   its county source (`owner_source` in `hailhunter/doorscore.py`) and a real evidence sheet ("Radar
   estimate, NOAA MRMS, checked by HMP Storm Watch" + a caveat that it's weather data, not proof of
   damage — `pages/hmp-app.html` line ~4473). That is *more* free, sourced data than most paid
   competitor tools use. FilthE has never been shown it clearly because it's buried in a deeper sheet,
   not on the pin he's looking at.
2. **The Now screen hands him one zone card at a time** (`renderZones()`, `pages/hmp-app.html` line
   ~5177): a small locked map centered on the best (or selected) zone, one card, "all zones" behind a
   button. There's no free pan/zoom view of every hot area at once with tap-to-pick. That's exactly
   complaint #1.
3. **The category's paid tools split into two products HMP already does in one:** canvassing/CRM apps
   (SalesRabbit, SPOTIO) don't own hail data — SPOTIO's own roofing page sells its **integration** with
   HailTrace [1]; SalesRabbit licenses "storm map overlays" as an add-on [2]. The hail-intelligence
   side (HailTrace, Interactive Hail Maps/Hail Recon, CoreLogic/Verisk) sells the radar analysis
   piece alone, often at prices requiring a sales call [3][4][5]. HMP's engine already builds both
   halves in-house for free (NOAA data) — the fair comparison isn't "do we buy one of these," it's
   "do we finally *show* what we've already built as well as they show theirs."
4. **"Who called their insurer" isn't legally knowable, and no tool actually sells that.** CLUE claims
   history is a consumer report under the Fair Credit Reporting Act — restricted to the insurer
   underwriting the policy and the homeowner themselves [6][7]. CoreLogic/Verisk's hail products are
   **weather-exposure** models (hail size/probability at an address), not claims data [4][5] — same
   category as our own MRMS pull, just paid and no more legal to act on. There is no compliant
   workaround; the honest answer is to get faster and more complete on the exposure signals that
   *are* legal (below), not to chase claims data.
5. **Small-crew fit matters:** SPOTIO requires a 5-seat minimum and SalesRabbit locks into a 1-year
   contract [8] — both a bad fit for HMP's 1-2 salesman team right now. Building our own screen well
   is not just cheaper, it fits HMP's actual size better than any of these tools do.

## What to work on next (ranked)

| # | What | Why | Effort | Who |
|---|---|---|---|---|
| 1 | **Open, pannable map on Now**: every zone (and, further out, every fresh-hail area near a chosen town) shown at once as pins/heat, tap any pin to open it — replacing the single best-zone card as the only way in. Keep the ranked card as a "start here" default, not the only option. | Directly answers complaint #1 ("give me open views... I pick"). `docs/design/open-map/` already has fonts staged for this — confirm who started it first. | M | Designer + Builder |
| 2 | **Put the evidence badge on the pin itself**: source name + hail size + date + a one-line confidence note ("NOAA radar estimate, checked against 2 NWS reports"), one tap from the map, not buried behind zone -> card -> proof sheet. Reuse `srcName`/the existing proof sheet copy — just surface it higher. | Answers complaint #2. The data and wording already exist (`pages/hmp-app.html` ~4305-4497); this is a placement change, not new data. | S | Code |
| 3 | **Wire the Douglas/Lancaster owner-occupied endpoints round 48 already found and tested** (`gis.dcgis.org`.../Parcels_public, `gis.lincoln.ne.gov`.../TaxParcels — exact fields recorded in round 48) so more of the map shows the real "likely owner-occupied" signal instead of the area-level fallback. T164 is already a promoted board item — this just re-flags it as the fastest way to make more pins trustworthy. | Round 48 did the hard verification work and it's sitting unwired. | M | Code |
| 4 | **Add mPING as a same-hour first-look layer, ahead of MRMS MESH's ~2-hour settle time.** mPING reports post to a public map within minutes of submission [9]; MRMS MESH typically needs ~2 hours to fully resolve after a storm [10]. Use mPING to flag "something happened here" fast, MRMS to confirm hail size once it's ready. | Answers complaint #3 (find it "the second it's out") — mPING is the fastest free signal there is, and HMP isn't using its speed advantage yet (`srcName` already recognizes 'mping' as a source, so this is scoring/ranking work, not new plumbing). | S | Code |
| 5 | **Don't buy CoreLogic/Verisk hail-verification or a CLUE-adjacent product.** It's the same signal class (weather exposure) we already get free from NOAA, costs money, and gets us no closer to knowing who actually filed a claim (that data is legally closed to us either way). | Keeps the legal line clean and the budget on things that move the needle. | S | FilthE (decision only, no build) |
| 6 | **Low priority: a "someone's already working this block" layer from public roofing-permit lookups** (Omaha: Accela Citizen Access; Lincoln: app.lincoln.ne.gov permit search [11]). Fremont has no public online search found this round — a phone call to Fremont Building Permits would confirm. | Permits post days to weeks after a storm, so it's a competitor/re-roof check, not a lead-speed signal — real but not urgent. | M | Code |

**This week, no build:** show FilthE the existing evidence sheet on his phone right now (Now -> a
house -> the proof line) so he can see the sourcing already exists while #1/#2 above get built; that
alone may answer half of complaint #2 immediately.

## A. What the best tools do (map layers, source/confidence, what salesmen say)

- **SalesRabbit** (door-to-door sales/canvassing CRM): sells "Map Overlays & Storm History Reports"
  as an add-on — "storm data that takes restoration sales teams to their ideal customers... stop
  paying to have multiple solutions" [2]. It's a territory-mapping/lead-management platform first;
  weather is a bolt-on layer, not a built-in radar engine.
- **SPOTIO** (territory mapping/canvassing CRM): does not own hail data either — its roofing page
  markets a direct **integration** with HailTrace: "HailTrace storm data directly in SPOTIO to
  identify high-damage areas immediately after storms hit," plus AccuLynx/HubSpot/Salesforce/Pipedrive
  integrations [1]. Minimum 5 seats, custom-quote pricing (demo call required) [8].
- **HailTrace / Interactive Hail Maps (Hail Recon)**: the actual hail-radar layer these CRMs plug
  into. Interactive Hail Maps/Hail Recon markets "forensic-grade storm data within minutes of the
  hail falling," radar swaths pinpointing damage, a "blue dot" for your own location, and 15+ years of
  historical data [12] (site itself blocked to direct fetch this session — sourced from a third-party
  comparison summary, flag as **unverified detail, verified existence**). HailTrace markets itself as
  the deepest feature set in the category and pushes storm data straight into a CRM pipeline [12]
  (same caveat).
- **CoreLogic Hail Verification / Verisk Location HAIL**: forensic radar analysis sold to
  insurers/adjusters and, secondarily, contractors — hail size, "probability of severe hail," wind
  speed and a proprietary "Hail Impact Energy" score at a specific address, built on high-resolution
  radar reflectivity [4][5]. Confidence is expressed as a probability/severity score, not a plain
  "how sure are we" line for a salesperson. One 2021 Florida court excluded a CoreLogic-based wind
  opinion because the underlying methodology couldn't be verified under the Daubert evidence standard
  [13] — a reminder that a vendor's swath, ours included, is a lead signal, never a legal/insurance
  proof, exactly the caveat HMP's own evidence sheet already states.
- **CompanyCam / Roofr**: not hail-area finders at all. CompanyCam is job-photo documentation
  organized by address [14]; Roofr's flagship is an instant aerial roof-measurement/estimate tool
  [15]. Relevant to HMP later (photo proof, fast estimates) but not to "where do I start."
- **What reps actually run into (review-site sourced, not forum-verified this round — reddit.com
  wasn't reachable again, same gap round 44 flagged):** pricing opacity — SalesRabbit is the only one
  of these with public per-seat pricing; SPOTIO, HailTrace and AccuLynx all require a sales call for a
  quote [8]. SalesRabbit's contract is a 1-year minimum with auto-renewal, a poor fit for a small or
  seasonal crew [8]. SPOTIO requires 5+ seats, a poor fit for a solo or two-person team [8] — which is
  HMP right now. **Net for HMP: none of these tools fit a 1-2 person crew well, cost-wise or
  contract-wise, and the hail-data half of what they sell, we already pull for free.**
- **2025-26 newcomers, low confidence:** JobNimbus and AccuLynx both added AI features in 2025-26 —
  JobNimbus "lead intelligence" surfacing, AccuLynx AI-assisted insurance scope/supplement writing
  [16]. Consumer-facing site myhailscore.com (HailScore) appeared repeatedly as a homeowner DIY hail
  self-check tool — worth a five-minute look next round, not urgent. Most other "AI roofing lead gen"
  results this round were SEO listicle content (RoofD AI, Origami, BizAI, MyQuoteIQ) with no
  independent evidence behind the claims — **treat as unverified, don't act on these without a second
  look.**

## B. Free/cheap public signals, ranked by speed x usefulness

| Signal | Speed after storm | Cost | Legal for HMP | Notes |
|---|---|---|---|---|
| **mPING crowd reports** | Minutes — reports post to a public map almost immediately after submission [9] | Free | Yes — public NOAA/OU citizen-science data | Fastest signal that exists; low precision (a person's guess at hail size), best as an early flag, confirm with MRMS |
| **NWS Local Storm Reports (LSR) / SPC storm reports** | Minutes to hours — issued as the storm happens, preliminary log online same day | Free | Yes — public NOAA/NWS data | Already used (`srcName: lsr/spc`); ground-truth but sparse (spotter/media reports only, misses many hail-hit blocks) |
| **NOAA MRMS MESH radar hail** | ~2 hours to fully resolve after the storm, updates on a ~2-minute radar cycle underneath that [10] | Free (AWS Big Data) | Yes — public NOAA product | Already the engine's main layer (`hailhunter/mrms.py`); best size estimate, needs the ~2h settle time so pair with mPING for the first hour |
| **Radar (NEXRAD/SWDI) raw** | Real-time, ~2 min | Free | Yes | Underlies MRMS; not worth pulling separately when MESH already exists |
| **CoCoRaHS hail reports** | Same day to next day (volunteer-entered, measured with a ruler) | Free | Yes | More precise per-report than mPING, much slower and sparser (few thousand observers nationwide) — a confirm-later signal, not a first-look one |
| **County assessor: owner-occupied + roof/house age** | Static (updated by the county on its own schedule, not storm-linked) | Free (public parcel data) | Yes — public record, no owner names shown per HMP's own rule | Already partly wired (T23); round 48 found and tested Douglas + Lancaster endpoints, not yet wired in (see item #3 above) |
| **Recent home sales** | Days to weeks (county recording lag) | Free/low-cost (county records) | Yes — public record | Useful for the "likely underinsured / new owner" angle already folded into door score's owner_fit, not a storm-speed signal |
| **Roofing/building permits (Omaha Accela, Lincoln app.lincoln.ne.gov)** | Days to weeks after work starts, not after the storm | Free (public record) | Yes — public record | Tells you who's *already* been sold, useful to avoid re-knocking or to see competitor activity; Fremont has no confirmed public online search (call the city, per existing backlog item) |
| **Wind reports (NWS LSR wind/trees-down)** | Same as hail LSRs — minutes to hours | Free | Yes | Already wired (`hailhunter/wind.py`, T116-118) |
| **Nextdoor / public Facebook neighborhood-group posts** | Minutes to hours (homeowners post about storm damage fast) | Free, manual only | Gray area if automated/scraped; fine if a person reads public posts manually, joins as a normal member, and never scrapes or buys the data | Real, fast, human-verified signal ("my roof got hit"), but manual-read-only — no bulk scrape, and never turn a post into a mailer/text list (that would cross the no-bought-lists/no-cold-texts rule) |
| **CoreLogic / Verisk hail-verification API** | Similar to MRMS (radar-derived) | Paid, sales-call pricing | Same legal footing as our own free MRMS — no advantage, and it's a *weather* signal, not claims data | Skip — same signal class as what we already have free |
| **CLUE / claims data** | N/A | N/A | **No** — FCRA-restricted to the insurer and the homeowner [6][7] | Not obtainable or usable by a contractor at any price; see section C |

## C. The insurance-claims question, answered honestly

**Can HMP legally know who filed a claim or called their insurer? No, not directly, and no vendor
legitimately sells that.** A CLUE report is a consumer report under the federal Fair Credit Reporting
Act: access is restricted to a company with a "permissible purpose" (the insurer underwriting or
paying the claim) and to the homeowner themselves, who can request their own free copy [6][7]. There
is no legal secondary market for it, and nothing in Nebraska's contractor law creates an exception —
if anything, 44-8605 (no assignment of benefits) and the ban on negotiating claims without a public
adjuster license push the other way: HMP's role is to document damage and meet the adjuster, never to
know or manage the claim itself.

What CoreLogic/Verisk actually sell under the word "hail" is **weather exposure at an address**
(radar-estimated hail size/probability), not claims history — the same category of data as our own
free NOAA pull, just paid and proprietary [4][5]. Buying one of these would not get HMP any closer to
"who called their insurer" — it would just be a paid version of data the engine already has for free.

**The only legal, HMP-rules-compliant path to "likely something to sell here" is exposure + property
proxies, stacked:**
1. Fresh, sizeable hail at the address (MRMS/mPING/LSR) — the storm actually reached the house.
2. Owner-occupied (never say "insured") — a renter can't authorize the work or file on their own
   policy; owner-occupied homes are the real buyer pool (already in door score v2).
3. House/roof age and last-sale date — an older roof or an owner who's been there a while is a better
   prospect than a place with a 2-year-old roof.
4. What the homeowner or a neighbor *volunteers* at the door ("my neighbor already called someone
   out") is legal to hear and act on — HMP just can't go looking for it in a database, buy a list of
   it, or text/mail based on it.

None of this tells HMP "this specific house filed a claim." It tells HMP "this house is a good bet to
knock" — which is exactly what door score v2 already computes, and exactly why the fix here is making
that existing, legal signal visible on the map (item #1-2 above), not finding a new, riskier data
source.

## D. Recommendation: the one core screen

**Now, rebuilt as one open map:** a full, pannable/zoomable map of the area around wherever FilthE
is (or a town he picks), every zone/hot area shown as a pin sized and colored by heat, each pin
carrying its evidence inline (hail size, storm date, source name) on tap — with the current
best-ranked pick still shown as a "start here" suggestion, never the only way onto the map. He drives
where he wants, sees why any pin is hot before he commits, and the ranking becomes a suggestion he
can override, not a gate. Top 5 data layers for it, in priority order:

1. **Hail exposure (MRMS MESH size + mPING/LSR speed)** — the core "something happened here" signal,
   already built; just needs mPING promoted as the fast-first layer ahead of MRMS's ~2h settle.
2. **Owner-occupied likelihood, with its source shown** — already computed (door score v2), needs the
   Douglas/Lancaster feeds wired (#3 above) and its source county named on the pin, not just implied.
3. **House/roof age (assessor year built)** — a plain, free, legal "how likely is this roof actually
   old enough to need us" signal, cheap to show once pulled.
4. **Doors left to knock / walk status** — already tracked per zone (`homes`, `walk_homes`); keeps the
   open map useful for "where haven't we been" not just "where's hot."
5. **Competitor/permit activity (low priority, once #6 above exists)** — a light "already re-roofed"
   or "permit pulled here" flag to avoid wasted knocks, not a lead-speed signal.

## Sources

[1] SPOTIO roofing/storm restoration solutions page (HailTrace integration) - https://spotio.com/solutions/roofing-storm-restoration-sales-crm/
[2] SalesRabbit Weather page (storm map overlays) - https://salesrabbit.com/weather/
[3] SPOTIO / HailTrace / SalesRabbit pricing and seat-minimum notes (search-summary of roofingsoftwareguide.com, roofingsoftwareguide.com and hailtrace.com themselves were egress-blocked this session) - via WebSearch
[4] Verisk Location HAIL product page (search-summary; verisk.com blocked to direct fetch this session) - https://www.verisk.com/products/hail-risk-assessment/
[5] CoreLogic Hail Verification Report datasheet/sample (search-summary; wvs.corelogic.com blocked to direct fetch this session) - https://www.wvs.corelogic.com/pdfs/hail-verification-report-datasheet.pdf
[6] Fair Credit Reporting Act, consumer-report permissible-purpose restriction - https://en.wikipedia.org/wiki/Fair_Credit_Reporting_Act
[7] CLUE report structure and access restriction (search-summary of Frascona law firm + Coverage Cat) - https://frascona.com/clue-reports-comprehensive-loss-underwriting-exchange-reports/
[8] SPOTIO/SalesRabbit seat-minimum and contract-term notes (search-summary, fieldsalestools.com/roofingsoftwareguide.com) - via WebSearch
[9] NOAA "New smart phone app lets public report rain, hail, sleet and snow" (mPING) - https://www.noaa.gov/new-smart-phone-app-lets-public-report-rain-hail-sleet-and-snow-noaa
[10] MRMS MESH real-time/latency description (search-summary of NSSL/HailScore explainer; mrms.nssl.noaa.gov reachable, latency figure from myhailscore.com/what-is-mrms-mesh, not independently re-verified) - https://mrms.nssl.noaa.gov/ and https://www.myhailscore.com/what-is-mrms-mesh
[11] City of Omaha Accela permit search; City of Lincoln permit search - https://aca-prod.accela.com/OMAHA/Cap/CapHome.aspx?TabName=Home&module=Permits and https://app.lincoln.ne.gov/aspx/city/buildperm/default.aspx
[12] Interactive Hail Maps / Hail Recon / HailTrace feature claims (search-summary only; both domains egress-blocked to direct fetch this session) - via WebSearch
[13] Property Insurance Coverage Law Blog, on a 2021 Miami-Dade ruling excluding a CoreLogic-based expert opinion - https://www.propertyinsurancecoveragelaw.com/blog/the-courts-just-made-it-tougher-for-adjusters-and-engineers-to-use-some-automated-weather-reports/
[14] CompanyCam homepage (direct fetch) - https://companycam.com/
[15] Roofr homepage, Instant Estimator (direct fetch) - https://roofr.com/
[16] JobNimbus/AccuLynx AI feature claims 2025-26 (search-summary, listicle-sourced, low confidence) - via WebSearch
