# Aldaba-for-businesses study (2026-09-28)

Research Lead round. Both scout briefs (market/competitors, pricing/must-haves/GTM/risks) were run
directly in this session — no scouts were available, so I did the web research myself and merged it
below. Builds on round 32 (pricing-model shape) and round 44 (category-leader path, pilot playbook);
does **not** repeat round 42's per-competitor pricing/complaint breakdown (SalesRabbit, JobNimbus,
AccuLynx, CompanyCam, Roofr, SPOTIO, HailTrace, Hail Recon, Knockio/Knockbase are all already
vendor-verified there) — see that file for detail per vendor.

## For FilthE (read this part)

**Bottom line: keep doing what CLAUDE.md already says — HMP first, product second. This research
doesn't change that; it just gets the homework ready for when the time comes.**

- Roofing/storm restoration is the trade that would pay first for Aldaba, and it's already HMP's
  main trade. Good news: no pivot needed.
- Every competitor tool does ONE piece (photos, or canvassing, or storm data, or office/CRM) and
  charges $60-$250+ a month per person for that one piece. Nobody combines storm data + ranked
  doors + one-tap knock + legal armor + bilingual in one tool the way Aldaba's built to.
- When it's time to price this: charge a flat amount per crew (not per person). That's how the
  tools winning right now (Roofr, CompanyCam) actually price, and it fits a small bilingual crew
  better than punishing you for adding a guy.
- Before anyone outside HMP touches this: the app needs to keep each company's data separate
  (already on the list as T77), and the legal rules need checking state-by-state — Nebraska's rules
  don't just carry over to Texas or Colorado.
- Biggest risk isn't a competitor — it's splitting focus before HMP's own numbers are proven. Same
  warning round 44 already gave; this round agrees from the money side too.
- Nothing here needs a decision from you right now except one open question below (D27).

## What to work on next (ranked)

| # | What | Who | Effort |
|---|---|---|---|
| 1 | Keep building/proving on HMP only — no outside pitch yet (this round adds no new urgency to change that) | FilthE/Boss (decision, no build) | S |
| 2 | Finish T77 (settings/config, per-company data separation) before any outside-company conversation is even possible | Code | M |
| 3 | Add the pilot's proof-number fields to `hh.py weekly` now (doors, contact rate, inspection rate, signed-job rate, $/job, knock-to-signed time) — cheap to do early, expensive to reconstruct later | Code | S |
| 4 | Start a per-state legal-pack template, Nebraska's the first entry — verify (don't just repeat) the multi-state deductible-waiver list against real statute text before it's used anywhere | Code | M |
| 5 | When pricing day comes: use a hybrid flat-base-plus-seat model, not pure per-seat — write this into the eventual pricing doc so it isn't re-decided from scratch | Code (doc only) | S |
| 6 | Watch for HailTrace/Hail Recon/Interactive Hail Maps-style resellers of free NOAA data as the closest thing to real price competition on the data side, not on the sales-workflow side | FilthE (awareness only) | S |

### Board items to post
- **T207** (Code, M): Verify the multi-state deductible-waiver-law list (candidates: IL, TX, KS, OK,
  NE, MO, CO, IN, MN, SD) against each state's actual statute text before quoting it anywhere; start
  the per-state legal-pack template with Nebraska as the working entry.
- **T208** (Code, M): Finish T77 (settings/config + per-company data separation) — now a named
  precondition for any outside-company conversation, not just a nice-to-have.
- **T209** (Code, S): Add proof-number fields (contact rate, inspection rate, signed-job rate, $/job,
  knock-to-signed time) to `hh.py weekly` output, ahead of any pilot ask.
- **T210** (Code, S — doc only): Write the pricing-shape decision (hybrid flat-base + per-seat
  overage, informed by this round) into `docs/orders/` so it's ready, not re-researched, when pricing
  day comes.

### Question for the boss
- **D27**: Does HMP ever plan to run crews outside Nebraska (even a neighboring state)? That would
  change which states' door-to-door/insurance-restoration laws get a legal pack built first.

## Details

### 1. Which trades pay first, and why

Market-size figures vary a lot by source/definition (services revenue vs. materials market vs.
combined categories) — treated as rough orientation, not precise numbers.

| Trade | US market size (rough) | Businesses | Fit for Aldaba |
|---|---|---|---|
| **Roofing / storm restoration** | $92.5B services (IBISWorld) or ~$31-34B narrower materials-market estimate [1][2] | ~101,700-109,000 [1] | **Best fit.** Insurance/storm-driven work is reported as a large share of residential roofing revenue in a given year, and 2024 roof-related insurance claims were reported at ~$31B, up ~30% from 2022 — this is a search-summary finding (calljolt.com roundup), **not independently confirmed**; the primary trade-press article I opened (Roofing Contractor's own 2026 report) does not contain these two figures, so treat them as unverified until reached directly [3][4]. Aldaba's whole feature set (storm data, legal armor, claims) is built for exactly this trade. |
| **Siding** | $18.2B (siding-only estimate) or $75.4B combined with roofing [5] | ~35,000 siding-only, 130,000 combined [5] | **Second-best fit.** HMP's other core trade; benefits from hot-zones/ranked-doors even without a claims trigger every time. |
| **Gutters** | $778M [6] | ~4,929 [6] | **Weak standalone fit.** Tiny, fragmented market, usually sold as an add-on during a roofing/siding job rather than its own canvassing operation — not enough independent buyers to be a target trade on its own. |
| **Solar** | Field-sales-software market ~$3B overall, growing ~10%/yr; solar-specific software estimates range $242M-$1.08B depending on scope [7] | n/a | **Saturated, poor fit.** Solar D2D is already the most fought-over vertical for SPOTIO/SalesRabbit-style tools, and it has no storm-damage/insurance-claim trigger — most of Aldaba's actual feature set (storm data, claims, legal armor) would go unused. |
| **Pest control** | $13-30B depending on source/scope [8] | n/a | **Poor fit.** Heavy D2D culture but zero storm/insurance angle — same mismatch as solar. |
| **Windows** | not separately sized this round | n/a | **Weakest fit.** Lower canvassing-culture overlap than roofing/siding/solar/pest; not researched further given the other five already show a clear ranking. |

**Ranking for HMP: roofing/storm restoration first, siding second, everything else a distant third
or worse** — matches the trade HMP is already in, so no strategy change, just confirmation.

### 2. Competitors — what's new this round

Round 42 already did vendor-verified pricing + Google Play complaint analysis for SalesRabbit,
JobNimbus, AccuLynx, CompanyCam, Roofr, SPOTIO, HailTrace, Hail Recon, and Knockio/Knockbase. This
round only re-confirmed a few of those directly (primary-source curl fetches matched round 42's
numbers: roofr.com/pricing — Starter free, Essentials $249/mo, Scale $349/mo, $13-19/report on top
[9]; companycam.com/pricing — Core $63-79/mo, Crew $149/mo, Scale $249/mo, +$29-34/extra seat [10];
salesrabbit.com/pricing — Lite free, Team ~$59/user/mo, Pro $49-75/user/mo [11]) and adds one
genuinely new competitor:

**Interactive Hail Maps** (not covered in any prior round) [12]:
- Pricing (vendor page, fetched directly): 1 state/region $999/yr, 3 states/regions $1,499/yr,
  nationwide $1,999/yr — all quote unlimited hail maps, 10+ years of historical data, radar replay,
  and **integrated canvassing/territory management plus unlimited on-demand contact data**.
- This is the closest single competitor to Aldaba's storm-data + canvassing combination (closer than
  HailTrace/Hail Recon, which round 42 found are canvassing-adjacent but data-first). Still missing:
  no legal-armor/compliance workflow, no bilingual support, no claims tracking — same gaps round 42
  found across the board.
- **Unverified this round:** their contact-data source and whether "unlimited contact data" implies
  buying homeowner-name lists — worth checking against Nebraska's no-owner-names-for-homes rule and
  Do-Not-Call/TCPA exposure before ever recommending or integrating with this vendor.

### 3. Pricing recommendation

Round 32 already found the market split: legacy per-seat tools (AccuLynx ~$100+/user, $250+/mo;
JobNimbus ~$225-550/mo base + $20-75/user) vs. newer flat-tier tools (QuoteIQ, FieldFuze). This
round adds outside-view numbers on where that market is heading and what the actual current leaders
charge:

- Broad SaaS pricing census (1,919-1,552 companies, Aug 2026): flat/platform pricing is the single
  largest group at 42%; pure per-seat is 22%; hybrid models are growing from 43% to a projected 61%
  by end of 2026; median cheapest paid plan across all SaaS is ~$29/mo [13].
- The two competitors actually winning in this exact space price as a **hybrid**, not pure per-seat:
  Roofr (Starter free, Essentials $249/mo, Scale $349/mo — flat tiers, pay-per-report add-on) [9] and
  CompanyCam (flat base per tier, +$29-34 per extra seat beyond the included count) [10].

**Recommendation:** price Aldaba the same way — a flat base tier that covers a small crew (matches
HMP's own size), with extra seats priced well under what AccuLynx/JobNimbus/SalesRabbit charge per
head. Rough tiers to start the conversation with, not a commitment:
- **Starter** (flat, 1-3 users): ~$99-149/mo — priced near Roofr/CompanyCam's own entry tiers, since
  Aldaba does more than either alone.
- **Crew** (flat, up to 6 users): ~$249-299/mo, +$25-35/extra seat beyond 6.
- Justify the price against **replacing 2-3 separate subscriptions** (a photo tool + a canvassing
  tool + a hail-data subscription), not against any single competitor's price alone.

### 4. Must-haves before selling to any outside company

- **Multi-user teams / per-company data separation** — already flagged as open in round 32 (T77);
  this round makes it an explicit pre-condition, not just a nice-to-have, since nothing else here
  matters if two companies' leads/claims can mix.
- **Per-state legal packs.** Confirmed (WebSearch summary, **not independently opened — flag as
  unverified**) that several states besides Nebraska have similar deductible-rebate-prohibition laws:
  Illinois, Texas, Kansas, Oklahoma, Missouri, Colorado, Indiana, Minnesota, South Dakota [14]. Two
  useful things follow: (a) most of these overlap with the country's actual hail-heavy states, so the
  legal-pack list and the "where would Aldaba actually sell" list are nearly the same list; (b) this
  needs verification against real statute text (nebraskalegislature.gov-style primary sources) before
  it's used for anything, since a wrong legal claim in a sales tool is a real liability, not just a
  research miss.
- **Door-to-door permits are per-city, not per-state** (same pattern HMP already lives with — round
  57/T202's Omaha/Lincoln/Columbus permit calls). A "legal pack" per state covers insurance-
  restoration statute language; permit rules still need per-city lookup, same workflow HMP already
  has.
- **Onboarding** — round 44 already designed this (30-day pilot, one contractor, side-by-side against
  their current tool, 4-5 named numbers defined up front, free/discounted first cycle). Nothing new
  to add; just don't skip it for a second company either.
- **Data costs.** NOAA/NCEI Storm Events data is public-domain federal data, free since 2012, no
  copyright, reusable with attribution [15]. This is a real cost advantage: HailTrace/Hail Recon/
  Interactive Hail Maps all charge $999-$2,000+/yr per territory to resell essentially the same
  public data with added polish (meteorologist verification, contact lists). Aldaba's underlying data
  cost is near-zero today. **Open question, unverified:** whether a "meteorologist-verified" report
  layer (what HailTrace sells as a disputed-claim aid) is something Aldaba would eventually need to
  match legitimacy with adjusters, or whether raw NOAA/NWS data holds up fine on its own — not settled
  this round.

### 5. Go-to-market path

Round 44 already set the shape: HMP (then Nastase Contracting) as the first real pilot, 30 days,
free or steeply discounted, measured against a short list of numbers, public marketing held until
real numbers exist. This round adds:
- **Collect the proof numbers starting now**, before any pitch exists to attach them to: doors
  knocked, contact rate, inspection rate, signed-job rate, revenue per job, and knock-to-signed time.
  All map to `hh.py weekly` fields per round 44 — the ask here is to make sure they're actually being
  written, not just theoretically available.
- **Vertical-SaaS founders who step back from sales too early stall before they reach real scale** —
  one source frames this as "don't step back before ~$10M ARR" for a vertical-SaaS founder [16].
  Directly supports CLAUDE.md's existing order (FilthE stays the salesman first) rather than changing
  anything.
- A second-customer pitch needs a **specific number story** ("X% more signed jobs per rep" or "$Y
  revenue per door"), not a testimonial — matches what round 44 already found about wanting proof
  before public content marketing.

### 6. Top 3 risks

1. **Legal exposure varies by state and hasn't been checked yet.** Pitching Aldaba into a state where
   HMP hasn't verified the deductible-waiver, cancellation-window, or door-to-door permit rules risks
   quietly giving legal-sounding guidance that's wrong for that state. Mitigation: never claim a state
   is "covered" until its legal pack is built and checked against primary statute text (ties to T207).
2. **Founder focus dilution.** FilthE is both HMP's sales lead and Aldaba's builder; CLAUDE.md already
   guards against this ("HMP first, product second," no knocking until the app/permit/sales lessons
   are ready). This round's outside-view research (leaders don't step back before ~$10M ARR [16])
   agrees from the money side — flagging it here as the single highest risk, already mitigated by
   existing policy, not something new to fix.
3. **Data separation / a second company's bad first bug becomes a trust disaster.** Round 42 already
   found "nobody fixed my bug" as the single most common complaint across the 12 competitors checked;
   round 44 already flagged a pilot partner's first bad experience as the highest-risk moment for a
   small, word-of-mouth trade community. This round's addition: that risk is structurally impossible
   to avoid until T77 (per-company data separation) actually ships — it's not just a support-process
   decision, it's a missing technical precondition.

## Sources
[1] IBISWorld, "Roofing Contractors in the US - Market Size Statistics" - https://www.ibisworld.com/united-states/market-size/roofing-contractors/198/ (search summary)
[2] Mordor Intelligence, "United States Roofing Market Size & Share Outlook" - https://www.mordorintelligence.com/industry-reports/united-states-roofing-market (search summary)
[3] Roofing Contractor, "2026 State of the Roofing Industry Report" - https://www.roofingcontractor.com/articles/101643-2026-state-of-the-roofing-industry-report (fetched directly — does NOT contain the 40%-insurance or $31B-claims figures; those come from a different, unopened source, flagged unverified)
[4] CallJolt, "Roofing Industry Statistics 2026" - https://calljolt.com/blog/roofing/roofing-industry-statistics-2026 (search summary, page not opened — source of the 40%/$31B figures, unverified)
[5] IBISWorld, "Roofing & Siding Contractors in the US" - https://www.ibisworld.com/united-states/market-size/roofing-siding-contractors/6545/ ; siding-only figure from Freedonia Group summary (search summary)
[6] IBISWorld, "Gutter Services in the US - Market Size" - https://www.ibisworld.com/united-states/market-size/gutter-services/6321/ (search summary)
[7] MarkWide Research / FieldSalesTools, solar and field-sales software market estimates (search summary, ranges vary widely by source)
[8] IBISWorld / Market Data Forecast / Verified Market Reports, US pest control market size estimates (search summary, wide range by scope)
[9] Roofr, pricing page - https://roofr.com/pricing (fetched directly, vendor-verified)
[10] CompanyCam, pricing page - https://companycam.com/pricing (fetched directly, vendor-verified)
[11] SalesRabbit, pricing page - https://www.salesrabbit.com/pricing (fetched directly, vendor-verified)
[12] Interactive Hail Maps, pricing/FAQ pages - https://www.interactivehailmaps.com/pricing-page/ , https://www.interactivehailmaps.com/frequently-asked-questions/ (search summary, page not independently opened this round)
[13] SaaS pricing benchmark roundups (2026 census, ~1,500-1,900 companies) - https://www.thesaascfo.com/saas-per-seat-pricing/ , https://brandclickx.com/saas-pricing-benchmarks/ (search summary)
[14] Koley Jessen, "Residential contractors prohibited from rebating any portion of an insurance deductible" - https://www.koleyjessen.com/insights/publications/Insurance_Rebate_Prohibited (search summary only — page itself is egress-blocked; state list NOT independently verified against primary statute text, treat as unverified until checked)
[15] NOAA/NCEI Storm Events Database - https://www.ncei.noaa.gov/stormevents/ (public federal data, free since 2012, no copyright)
[16] Kalungi, "Founder-Led Growth in B2B SaaS" - https://www.kalungi.com/blog/founder-led-growth-in-b2b-saas (search summary)
