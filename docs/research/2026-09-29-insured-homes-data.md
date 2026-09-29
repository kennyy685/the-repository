# Finding more likely-insured homes after hail (2026-09-29)

Research Lead, 3 scouts. Topic picked by the King. Rules kept: no owner names stored or shown, no bought lists, no cold texts, never say "insured", never quote a payout.
Honesty note: web fetches were weak (several hosts blocked). Anything marked (unverified) came from search snippets or memory; confirm before building.

## Ranked: payoff / effort

| # | Do this | Payoff | Effort | Who | Cost |
|---|---------|--------|--------|-----|------|
| 1 | **Storm stacking**: per house, count hail days >=0.75" over the last 3 seasons; small score bump (1.0 / ~1.15 / ~1.3, capped). Also show "hit 3 times since 2024" on the Knock screen. **This week's pick.** | High | S | Code | free |
| 2 | **Roof-age ranking + sweet spot**: sort inside hail by roof age (year built as proxy); flag ~8-14 yrs as prime, 15+ as "check the policy first" (Nebraska carriers increasingly pay old roofs on depreciated/scheduled terms) | High | S | Code | free |
| 3 | **Ask the assessors for an export**: one call/email each to Dodge, Douglas, Lancaster: "parcel and sales export with year built, no owner names". Could replace all scraping | High | S | FilthE/boss | free? |
| 4 | **Omaha re-roof permits** (only direct roof-age source): Omaha requires a permit for roof work over 2 squares; fill `roof_year`, drop houses re-roofed since the storm | High | M | Code | free |
| 5 | **Census ACS by block group**: B25003 (owner vs renter), B25035 (median year built). Free, no names, area level; feeds zone "likely insured" score | Med | S | Code | free |
| 6 | **Door-result tap** (inspection yes/no + roof age) so Aldaba builds its own hit-rate table. No one publishes real close rates per signal | High long-run | M | Code | free |
| 7 | Lincoln open data / permit search (portal thin, permit search 403); Douglas GIS hub parcels (fields unverified) | Med | M | Code | free |
| 8 | Don't cut zones at exactly 1": small hail counts | Med | S | Code | free |

## Q1. Data sources (Fremont / Omaha / Lincoln)
- **Omaha permits**: roof repair/replacement over 2 squares needs a permit + final inspection (City of Omaha notice, 2018 IRC). Accela Citizen Access portal (unopened). Direct roof age. Permits show only permitted roofs.
- **Lincoln**: ArcGIS open data (building footprints ~155k, planning apps); Building Permit Search page returned 403. https://opendata.lincoln.ne.gov/
- **Fremont / Dodge**: permits are phone/paper (Fremont 402-727-2638), so roof age is proxy only. Dodge Assessor 402-727-3911 (parcel search dodge.gworks.com / dodge.nebraskaassessors.com).
- **Assessors** (year built, last sale, class): Douglas (Beacon/Schneider, 402-444-7060; GIS hub data-dogis.opendata.arcgis.com), Lancaster (orion.lancaster.ne.gov; has a "GIS Extract Tool", https://www.lancaster.ne.gov/821/Maps-GIS-Services). NE Dept of Revenue lists lookup tools only, no bulk: https://revenue.nebraska.gov/PAD/county-assessors-and-parcel-search
- **State sales file** (NE PAD): request by email PAT.SalesFileREQ@nebraska.gov (unverified; format, fields, cost unknown).
- **Census ACS**: B25003, B25035 (from memory; verify with a targeted API call).
- **Owner names**: most parcel data includes them. Drop the column at import, never store. Paid sellers (Regrid, Mapping Solutions) include owners: no. Scraping Beacon/Accela may break terms: prefer official downloads or ask.

## Q2. What top reps and tools rank on
- Inputs vendors name: roof age, pre-storm condition, hail 1"+ and density, owner-occupied, home value, recent sale, claim likelihood (Reworked.ai, Knockbase/HailTrace guide). Vendor claims, **no published close rate per signal**. Unproven.
- Old roof + hail = replacement; young roof = repair. Nebraska: some carriers pay roofs 10-15+ yrs old on ACV/schedule (Eric Luebbe Agency guide). Percentages by age are unverified.
- Small hail counts: IBHS 2025 lab study, dense sub-1" hail aged shingles like ~10 years in 2 years; ZestyAI says counting all hail predicted loss far better than large hail alone.
- Speed: canvass in 24-48 hrs, best window 5-10 days after (Knockbase). Filing window commonly ~12 months (varies).
- Not covered: Hail Recon, SalesRabbit, Spotio, Enerflo, EagleView, Nearmap, Cotality feature pages (blocked/not searched). Retry with curl.

## Q3. The one engine add this week: storm stacking
- Today: engine scores one storm day at a time (size x recency x distance x roof age x house type x owner-occupied x sold-after). `roof_year` is NULL (hud.py:214); "not re-roofed" is fixed at 1.0 (doors.py:214).
- Build: add `stack_count` and `stack_max_in` per house from stored `nbhd_hits` (conv_day, mesh_max_in); backfill with `hh.py swaths --day`. Multiplier small, capped; size and recency stay dominant. Tune with `hh.py tune` from real door results.
- First check (5 min): how many current-zone houses were hit 2+ times in 3 years? If under ~10%, signal too rare.
- Evidence: IBHS lab (weathered roofs + two sub-severe hits up to 10x more susceptible). Lab only; no published door-ranking lift. Unproven.
- MRMS history: IEM keeps a 30-day cache; MTArchive to Oct 2014; AWS OpenData from Oct 2020 (product names unconfirmed).
- Rejected: wind-direction side (unproven), yard-sign signals (manual entry), permit exclusion for Fremont (phone calls first).

## Watch out
Never tell a homeowner their roof is damaged from repeat hail or what insurance pays (44-8604, adjuster rules). Say "likely insured" only as our internal proxy.

## Sources (opened or search-only as marked)
- https://www.blog.reworked.ai/insurance-restoration-marketing/
- https://www.knockbase.com/blog/using-hail-trace-data-for-storm-response-sales-a-tactical-guide-for-roofing-teams
- https://www.ericluebbe.com/blog/nebraska-hail-damage-claims-guide
- https://ibhs.org/hail/impact-testing-of-high-concentrations-of-small-hail/
- https://zesty.ai/resource/zestyai-and-ibhs-research-works-to-make-hail-losses-more-predictable
- https://mesonet.agron.iastate.edu/archive/mrms.php
- https://opendata.lincoln.ne.gov/ , https://data-dogis.opendata.arcgis.com/ (thin)
- Search-snippet only: Frontiers 2025 sub-severe hail paper, Insurance Journal 2025-10-02, Knockbase HailTrace integration page, Omaha roof notice.

**For FilthE:** should the Knock screen show "hit 3 times since 2024" and a one-tap "inspection yes/no + roof age"? Our pick: yes, so Aldaba builds its own hit-rate table.
