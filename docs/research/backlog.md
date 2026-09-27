# Research backlog (always on, FilthE 2026-09-26: "constant research for ways to become the best")

The hourly King check starts the top unchecked topic as a new round (Research Lead + scouts) whenever no round is running.
Each round: write `docs/research/<date>-round-<n>.md`, post board items, check the topic off here, and add 1-2 new topics it uncovered.
Web access (updated 2026-09-27, FilthE opened the network): Bash `curl -sSL -m 20 -A "Mozilla/5.0" <url>` reaches trade sites (roofingcontractor, nachi, nrca, jameshardie, eagleview, hover), tools (wisetack, openphone, repcard, spotio, companycam, roofr, salesrabbit, acculynx, hailtrace), gov (census, api.census.gov, api.weather.gov, spc.noaa.gov, *.nebraska.gov, nebraskalegislature.gov), bbb, mopoa, reddit, youtube, wikipedia. Prefer primary sources now. If WebFetch is blocked, use Bash `curl -sS -m 20 <url>` (it goes through the session proxy and usually works: state statutes, county GIS, Mesonet). Save statute text to docs/legal/.
Rule: every topic must end in something that improves sales, profit or the app. No research for its own sake.

## Next up (top first)
- [ ] Confirm Nebraska's actual entry/notice rule for construction in occupied rental units (Uniform
      Residential Landlord and Tenant Act, Ch. 76, nebraskalegislature.gov) before the round-51 tenant-
      notice template goes to print as a final piece - round 51 only found general national practice
      (24-48hr notice, daytime hours)
- [ ] Re-open osha.gov directly once egress allows and confirm the fall-protection sample-plan content
      against `data/commercial_bid_kit.json` step 4's safety-plan wording - round 51: osha.gov was
      blocked to both WebFetch and curl this session, so the OSHA content there is stated as the known
      federal standard, not quoted from the primary page
- [ ] Open bridgman.org's real government RFP bid-packet PDF (a live example of a full commercial
      roofing bid-package structure) and shieldlineroofing.com's RFP/RFQ template directly, not just via
      search summary (round 51 found both but didn't fetch either)
- [ ] Check whether Cowork's command center map UI actually renders `wind_events[].trees_down`/
      `tree_sample`/`wind_dir` (round 26: the data exists in hud.json since T116-118; display side unconfirmed,
      map source is outside this repo)
- [ ] One-time sweep of the open board (T51-T60, T35, O0-O7) for other "done in code but not checked off"
      items like round 26 found for T116-119 - do this before the next fresh research topic
- [ ] Get a plain answer from the boss/FilthE on how HMP intends to pay and classify a second salesman (W-2 vs.
      true 1099) before any hire happens (round 29: classification risk is real, but the decision needs the boss)
- [x] Verify Nebraska's Employee Classification Act text and penalty amounts directly against
      `nebraskalegislature.gov` - round 35
- [x] Roof-chalking vs. adjuster-photo-acceptance conflict (round 22) - practical rule resolved round 35
      (still no manufacturer/adjuster primary source - see new item below)
- [ ] Fold the "chalk one test square at a time, don't chalk the whole roof" rule into
      `docs/guides/adjuster-meeting.md` and the inspection checklist print piece (round 35 found the answer,
      didn't edit the docs)
- [x] Get GAF's or a direct adjuster's own confirmation on chalk-marking acceptance (manufacturer/insurer primary
      source, not a contractor blog) - **round 43**: reached InterNACHI's own official "Mastering Roof
      Inspections" series (nachi.org, by Kenton Shepard/Nick Gromicko) instead - a real trade-association
      primary source. It confirms chalk is standard practice but warns it "will create the illusion of larger
      damage than actually exists" (a different, more precise reason than "insurers reject chalked photos"),
      and confirms adjuster test squares are 10'x10' (100 sq ft), with "eight hits is a common number" for
      replacement. GAF's own guidance still not reached (gaf.com still blocked) - good enough to close this
      item; the "why not to over-chalk" reasoning in `docs/guides/adjuster-meeting.md` should say "makes
      damage look bigger than it is," not "insurers reject the photos."
- [ ] Post the §48-2910 bilingual (English/Spanish) worker-classification notice once HMP has a fixed job site or
      shop to post it at (round 35: a real, cheap NE posting requirement most small contractors miss; low
      priority until a second salesman or fixed site exists)
- [x] Selling the HMP App: pricing, pilot customers, what a first outside customer needs (multi-company, settings, support) - round 32
- [x] GAF Master Elite's Service Finance dealer-tech tie-in: does hitting Master Elite unlock a lower financing bar than going direct - round 33
- [x] Local NE bank/credit union home-improvement loan programs as a no-dealer-fee alternative to name to homeowners - round 32
- [x] James Hardie "Select" contractor tier: exact requirements, and does The Edge job's Hardie lap siding work already qualify HMP - round 33
- [ ] Confirm exact door-to-door solicitation hours for Columbus and Schuyler by phone with the city PD/clerk (round 24's web research couldn't reach either ordinance's hours text; `data/city_rules.json` has both flagged "unverified")
- [ ] Annual/1-year check-up follow-up program for past customers (retention + referrals) - revisit once HMP has 10+ completed jobs (round 24 flagged as premature now)
- [x] Directly open OpenPhone/Podium/CallRail's own pricing pages (blocked via WebFetch this round; try curl) to confirm round 28's missed-call text-back price table before FilthE/boss buy anything -
      **round 43: big find - OpenPhone renamed itself Quo (Sept. 2025); openphone.com now 301-redirects to
      quo.com (confirmed by direct fetch). Tell FilthE/boss to sign up at quo.com, not openphone.com. Price
      ($15-19/mo Starter) corroborated but quo.com/pricing itself is still proxy-blocked, so re-check the
      auto-text-back feature (product now leads with an AI voice agent, "Sona") before paying.**
- [ ] Once HMP has enough call volume that live text-back isn't enough, revisit AI-answering upgrade tiers (CallRail Voice Assist, Podium) for real Spanish-conversation support, not just template texts
- [ ] Ask FilthE/boss which document HMP actually uses today before an adjuster visit (plain inspection
      authorization, a contingency-on-approval agreement, or going straight to the final contract) - round 27
      found the three are legally different and easy to blur; unknown from research, needs a direct answer
- [ ] Confirm by phone whether Hearth or Wisetack (round 21's picks) actually accept ITIN-only borrowers with
      no SSN - round 30 found ITIN home-improvement financing exists generally but couldn't confirm either
      named lender's own policy (pages blocked). **Round 43: Wisetack's own site (now reachable) was checked
      directly and simply doesn't address this question either way - still needs the phone call. But the
      $500-$25,000 / 0-35.9% APR / 3-120mo loan terms and the "no participation fees" language ARE now
      confirmed straight from wisetack.com.**
- [x] Trade-specific or Hispanic-market contractor-association sales training (not general Hispanic-marketing
      content) for the bilingual kitchen-table pitch - round 30 still found nothing aimed at contractors
      specifically; try association sites (NARI, NAHB Hispanic councils) or Spanish-language contractor forums
      directly next time - **round 47**: tried a third angle (well-known D2D roofing trainers/YouTube
      specifically) - still nothing beyond general Hispanic-marketing/engagement content (IKO, Roofing
      Contractor's "Techos y Más" launch). Recommend not re-assigning this exact sub-topic again without
      new evidence (e.g. real YouTube transcripts becoming fetchable, or a Spanish-language contractor
      forum surfacing). **Round 49: the new evidence showed up.** roofingcontractor.com/Techos y Más opened
      directly this round (curl) and led to a real, named bilingual sales trainer - **Ricardo González,
      founder/CEO of Bilingual America** (clients incl. Coca-Cola, National Roofing Partners; teaches
      SpanishPower/SuccessWithHispanics courses) - with two of his own Spanish-language trust-building
      columns for roofing contractors. Nebraska's own DOI consumer brochure ("After the Storm," opened as a
      PDF) added real state-level material too (be present at the inspection; the consumer hotline). See
      `docs/research/2026-09-27-round-49.md` + `data/spanish_sale_playbook.json` (22 entries). Consider this
      angle answered; a future round could instead try Ricardo González's own site/courses directly if
      network access to bilingualamerica.com or ricardogonzalez.com ever opens.
- [x] Roof-chalking vs. adjuster-photo-acceptance conflict (round 22, still open after round 31) - find a
      primary source (manufacturer guidance or an adjuster directly), not another blog - **stale duplicate,
      already closed round 43** (InterNACHI's own "Mastering Roof Inspections" series, see above); leaving
      this checked instead of deleting so the round-43 note above stays the reference.
- [x] Word-for-word scripts for the "site unseen quote" and "wants three bids before deciding" objections on
      cash jobs - round 38 (`data/price_objections.json`)
- [ ] Confirm directly (call NUFCU/BCU, or reach catenergy.ne.gov/dwee.nebraska.gov once egress allows) whether
      the Dollar & Energy Saving Loan program and NUFCU/BCU home-improvement loans cover siding/roofing
      replacement specifically, and their real fee schedules (round 32: pages blocked, search-summary only)
- [ ] If/when HMP considers selling the app later: what a real first outside customer needs structurally
      (per-company data separation, second brand/logo slot, support hours) before any pricing conversation -
      round 32 only found pricing-model shape (flat-tier vs. per-seat), not the technical bar
- [x] Confirm MOPOA/REOMA/Omaha Landlords Association membership fees and whether HMP needs to join vs.
      just calling the listed number (round 34: contact info found, cost unverified, pages blocked) -
      **round 43: MOPOA confirmed by direct fetch of mopoa.com/membership - $150/yr base, $225-300/yr
      vendor/contractor tiers with newsletter ads or meeting sponsorship. REOMA and Omaha Landlords
      Association fees still unconfirmed (lower priority - Omaha-adjacent, not Lincoln).**
- [x] Word-for-word script + legal-flag check for "who signs the HOA claim / who pays the deductible"
      questions from an individual unit owner - round 36 (`data/objection_scripts_2.json`)
- [x] Get a primary source (Nebraska case law or bar-association guidance, not a contractor blog) on the
      tortious-interference line for talking to a homeowner who already signed with another contractor -
      round 36's script is careful but sourced only from marketing blogs, not a legal primary source -
      **round 48**: found a real, citable Nebraska Supreme Court case (*George Clift Enterprises, Inc. v.
      Oshkosh Feedyard Corp.*, 306 Neb. 775, 947 N.W.2d 510 (2020)), confirmed by 4 independent legal-
      reference sites; round 36's script already sits inside the "truthful information / legitimate
      competition" safe harbor these sources describe. Case-law and law-firm domains themselves stayed
      blocked this session (WebSearch-summary sourced, not directly fetched) - see new item below.
- [ ] Wire `data/objection_scripts_2.json` into Practice Door's legal-flag scorecard and add its 3
      situations as new roleplay scenarios (round 36's ranked #1-2; not done yet, needs Builder/Designer)
- [ ] Re-open gaf.com's Residential Program Guidelines PDF and contractors.gaf.com directly once egress
      allows, to get the real 2026 Service Finance dealer-fee schedule and confirm whether Master Elite
      gets better financing terms than plain Certified or a non-GAF-tier contractor (round 33: WebFetch and
      curl were both fully blocked on every domain tried, search-summary only). **Round 43: gaf.com still
      blocked (per FilthE's network-opened list), but the 2012 roofingcontractor.com precedent for tier
      parity was confirmed by direct fetch - see round 33's update. gaf.com itself is still the open item.**
- [ ] Call James Hardie's contractor line directly to confirm Select-tier enrollment requirements and
      whether The Edge job's Hardie lap siding installs (done as a sub) count toward Select, or only jobs
      run under HMP's own Hardie account after enrolling count (round 33). **Round 43: confirmed the
      jameshardie.com/alliance/ page itself has zero enrollment requirements or fee info published for any
      tier - this phone call is now the only way to get that answer, not just the best way.**
- [ ] Confirm with the boss whether HMP's Contractor Registration Act number is currently active/renewed
      and record the renewal date (round 37: 48-2107, annual, $40 fee; up to $500 penalty for a first
      citation, no grace period since 2009)
- [ ] Fold the "zero compensation for any work started before the 3-day cancel window closes" rule
      (69-1606(5), round 37) into `docs/guides/adjuster-meeting.md` and O7's sale-guide script, kept
      distinct from the insurance-specific emergency-work carve-out (44-8603/8607)
- [ ] Confirm whether HMP/the boss holds Fremont's city contractor registration (Council Resolution
      2019-049, $65 fee, $250,000 liability insurance naming the City as additional insured) -
      separate from the state 48-2107 Contractor Registration Act (round 39; primary-sourced from
      fremontne.gov, unconfirmed whether HMP already has it)
- [ ] Re-verify Omaha's roof-permit repair-exemption threshold (commonly cited as 2 squares/200 sq ft)
      and open Lincoln's "Re-Roof Policy" page directly once egress allows - both city sites blocked
      curl again in round 39, search-summary only
- [ ] Add the 44-8606 itemized-description-to-the-insurer step (not just the homeowner) and the
      44-8605 assignment-of-benefits notice/filing rule into the sale-guide/O7 script (round 39, both
      primary-sourced from nebraskalegislature.gov)

- [ ] Once HMP has real commercial call data, re-check round 38's 5-touch/~18-day cadence
      (`data/commercial_calls.json`) against what actually gets a callback - it's adapted from general
      B2B research (email/LinkedIn-heavy), not roofing- or phone-only-specific
- [ ] Get a primary source (a property-management trade site or an actual PM interview, not general B2B
      cold-calling blogs) on how apartment/commercial roof vendor decisions really get made in eastern
      Nebraska specifically - round 38's property-manager-vs-asset-manager split is a general CRE pattern,
      unverified for HMP's actual market size (small/mid apartment complexes, not big REITs)
- [ ] Re-open spotio.com, rooflink.com or a similar roofing-sales-training primary source directly (round 40:
      WebFetch/curl blocked again) to confirm the 2-3x in-person-close-rate claim and get exact script wording
- [ ] Once the damage-map screen (T158) exists, check it against round 31's `data/inspection_walk.json`
      point-then-photo-then-explain sequence so the app screen and the in-yard walk match (round 40)
- [ ] Add ACS median household income (B19013) per block group to `nbhd.py`'s `load_acs` (same pattern as
      med_value/med_year already there) so door-list ranking has an affordability signal, not just age/value
      - round 41 (T163)
- [x] Re-test Douglas (dcgis.org), Lancaster (gis.lincoln.ne.gov) and Sarpy (geodata.sarpy.gov) parcel/owner-
      mailing endpoints for T23 owner-occupied from the actual cloud/Mac runner - round 41 found all three
      answering 200/301 from this sandboxed session tonight, contradicting the 2026-09-26 "blocked" note;
      needs the exact ArcGIS layer/field names, then wiring, if confirmed reachable where refresh runs (T164) -
      **round 48**: found the real working endpoints and exact fields for Douglas
      (`dcgis.org/server/rest/services/vector/Parcels_public/FeatureServer/0`, `OWNER_NAME`/`ADDRESS1-2`/
      `OWNER_CITY` vs. `HOUSE`/`STREET_NAM`/`PROP_CITY`) and Lancaster
      (`gis.lincoln.ne.gov/integration/rest/services/Assessor/TaxParcels/MapServer/0`, `OWNERNME1`/
      `PSTLADDRESS` vs. `SITEADDRESS`, plus `RESYRBLT`/`CLASSDSCRP` for free) - both live-tested with real
      sample rows, ready for Code to wire (T164 promoted to a board item, not just research).
- [ ] Get real Reddit (r/Roofing, r/doortodoor, r/sales) and YouTube-comment quotes on unmet roofing-sales
      software needs - round 44's WebSearch couldn't reach reddit.com (bot-blocked) or specific comment
      threads, so topic 2's findings are review-site/vendor-blog sourced, not forum-verified
- [ ] Sign up for EraHub's free/demo tier directly (not just its blog) to confirm how real its "native
      dual-language, single-click EN/ES toggle" claim is in practice, before HMP repeats "no competitor
      does Spanish" in any pitch or landing page (round 44, T166)
- [ ] Wire `data/door_lines_pro.json` (round 47, 22 EN/ES door-approach/objection/appointment lines) into
      Practice Door's script library and the app's Sale Guide door-approach + appointment steps - not
      done yet, needs Builder/Designer
- [ ] Confirm HMP's actual written workmanship-warranty terms (length, exactly what's covered) with the
      boss before using any specific-year warranty line at the door - round 47's `trust-warranty-backed`
      line is deliberately generic ("a written workmanship warranty") until this is confirmed
- [ ] If a real transcript-fetching method becomes available (round 47: YouTube blocks full player/caption
      data behind a sign-in wall for raw curl/WebFetch - only page title+description came through, no
      actual dialogue), retry pulling real door-knock footage from Roof Strategist/D2D Experts/Adam
      Bensman's channels - this round could not verify any trainer's script word-for-word from footage
- [ ] Test Douglas's (`dcgis.org`) and Lancaster's (`gis.lincoln.ne.gov`) parcel `FeatureServer`/`MapServer`
      query limits (`maxRecordCount`, pagination, whether bulk `where=1=1` pulls need an API key) before
      wiring a full-county pull into `nbhd.py` (round 48 only tested 3-row samples, unauthenticated, both
      worked); also look up Douglas's single-letter `CLASS` field's code table (residential vs. commercial/
      ag - unconfirmed, needed to filter the door-list feed to houses)
- [ ] Once egress allows, open `law.justia.com/cases/nebraska/supreme-court/2020/s-19-700.html` or
      CourtListener's copy of *George Clift Enterprises, Inc. v. Oshkosh Feedyard Corp.*, 306 Neb. 775 (2020)
      directly, to quote the Nebraska Supreme Court's own five-element/improper-means text verbatim instead
      of round 48's converging-search-summary version (crokerlaw.com, horganlawfirm.com, justia.com,
      courtlistener.com, findlaw.com, nebraska.gov court pages, leagle.com, supremecourt.nebraska.gov were
      all blocked this session, WebFetch and curl alike)

## Done
Rounds 1-21 (docs/research/2026-09-25-*, 2026-09-26-round-*): knocking, sales, claims, siding, legal, 90-day rookie plan,
Claude pro skills, app IA, translation, product path, voice, benchmarks, door-picking data, competitors (17, 17b), outside-the-box
+ profit (18), community leads (19), supplements + O&P (20), Hispanic outreach + financing (21). Round 22: GAF Master Elite +
James Hardie Elite Preferred requirements, adjuster-meeting checklist (docs/guides/adjuster-meeting.md). Round 23: wind/
fallen-tree claims (wind-zone scoring factors, tree-lead layer) + commercial/apartment roofs (TPO/EPDM, PM budget cycle).
Round 24: retention/reviews (legal Google review asks, completion packets, warranty registration) + door-to-door rules by
city (Fremont, Omaha, Lincoln, Columbus, Schuyler - hours + no-knock in `data/city_rules.json`).
Round 25: hail season calendar (peak May-July, config change proposed for `today_walk.storm_max_days_by_month`) + claim
deadlines (Nebraska gives years, not days - no legal urgency to use as a sales line) + AI tools other contractors use
(missed-call text-back flagged as HMP's top near-term buy; photo-to-quote/estimate tools flagged as ideas to fold into
the app rather than buy separately). Network egress was blocked for most WebFetch targets this round - findings rely on
search summaries; see the two new backlog items above to re-verify.
Round 26: wind/tree data topic turned out already built and tested in code (T116-119, `hailhunter/wind.py` -
trees-down detection + wind direction from remark text, both flowing into hud.json `wind_events[]`); no new
build needed, just board/backlog cleanup. Claim-deadline statute re-check: nebraskalegislature.gov still
blocked, but search summaries now quote 25-205/44-357 text directly (5-year written-contract limit; insurers
can't shorten it) - higher confidence than round 25, still flagged unverified-fetch.
Round 28: confirmed 25-205 and 44-357's exact text via direct `curl` fetch (5-year written-contract limit;
insurer can't write a shorter deadline) - closes the unverified-fetch flag. Vetted missed-call text-back
vendors: OpenPhone cheapest ($15/user/mo, auto-text-back on every tier) vs. Podium (~$399/mo), CallRail
($55/mo + $95/mo AI add-on), ServiceTitan ($245-500/tech/mo) - vendor pricing pages themselves stayed
blocked, so treat prices as search-summary sourced until FilthE/boss double-check before buying. Left the
wind-display-UI and board-sweep backlog items unchecked (they're code/board checks, not scout research
topics) for Code/Cowork to do directly.
Round 27 (second track, sales-craft): top-1% door-to-door habits (stance/tone/one-small-ask/daily routine,
`data/practice_drills.json` - 10 new Practice Door drills) + contingency agreement vs. plain inspection permission
vs. final contract (legally different, easy to blur; which one HMP uses today is unconfirmed - see backlog above).
Round 30 (sales-mastery track): bilingual kitchen-table scripts (who's-on-the-deed as a paperwork reason, not a
pressure tactic; no-status reassurance line) + follow-up scripts for the 2/5/10-day touches after "let me think
about it" (`data/followup_scripts.json` - 9 EN/ES scripts by touch x channel: door/phone/business_phone).
Round 29 (backlog track): pricing psychology for cash jobs (Good/Better/Best tiers + anchoring raise close rate
and ticket size, already planned in O7 - add a visible top tier; same-day close is legal since HMP's 3-day cancel
notice is already built in; never rush or bury that cancel notice) + hiring a second salesman (Nebraska presumes
construction workers are employees, not 1099 contractors, regardless of what the paperwork says - real
misclassification risk if HMP hires commission-only; draw-against-commission for the first 60-90 days is the
industry-standard fix). Two new backlog items above need the boss's decision and a re-verify once egress allows it.
Round 31 (sales-mastery track): the inspection walk as a sales moment (`data/inspection_walk.json` - walk the
perimeter together, point-then-photo-then-explain, show photos back on the phone before leaving the yard, one
plain-sentence finding, one named next step) + price objections on cash jobs with Good/Better/Best framing
(`data/price_objections.json` - validate/ask-what's-high/offer-a-path, 3-tier anchoring, "cheaper bid elsewhere"
handled by scope comparison not price matching). WebFetch and curl both blocked again; everything is
search-summary sourced. Two new backlog items above (chalking primary source, two more objection scripts).
Round 32 (backlog track): selling the HMP App to other roofers (not ready - no other customer, no multi-company
separation; when ready, price flat-tier not per-seat, following the market's own shift away from per-seat pricing)
+ NE bank/credit union home-improvement loans as a no-dealer-fee option (state Dollar & Energy Saving Loan program
plus NUFCU/BCU unsecured loans look like the right no-dealer-fee names to give homeowners; egress blocked every
lender/vendor page this round, so rates/fees are search-summary only - two new backlog items above to re-verify).
Round 33 (backlog track): GAF Master Elite financing tie-in (the one precedent found gave reduced financing
fees to both Master Elite and plain Certified contractors, not a Master Elite-only perk - don't chase the tier
for financing alone) + James Hardie ALLIANCE's Select tier (the realistic near-term target, not Preferred/
Elite - unlocks the full manufacturer warranty and a free directory listing; unclear whether The Edge's Hardie
installs count toward it). WebFetch and curl were both fully blocked on every domain this round (even
Wikipedia) - everything is search-summary sourced; two new backlog items above to re-verify directly.
Round 35 (backlog track): Employee Classification Act text and penalties confirmed via a direct
`nebraskalegislature.gov` fetch (not a summary this time) - the 3-part presumption test (§48-2903) and the
$500/$5,000-per-worker penalty (§48-2907) round 29 flagged as secondary-sourced are now primary-verified and
unchanged; two of that section's old cross-referenced sections were quietly repealed in 2026 (LB847/LB1048) but
not the parts HMP cares about. Roof-chalking vs. adjuster-acceptance conflict (open since round 22) got a
practical resolution from converging trade sources: chalk one 10'x10' test square at a time for your own hail
count, don't leave a whole roof chalk-marked for the adjuster's camera - still search-summary sourced (nachi.org,
contractor blogs), not a manufacturer/insurer primary source, so a narrower follow-up item stays open.
Round 36 (sales-mastery track): word-for-word EN/ES scripts for three situations (`data/objection_scripts_2.json`)
- HOA unit-owner deductible questions (redirect to the association's master policy, never discuss
dollar amounts - closes the round-34 backlog item), a homeowner already signed with another contractor/
storm chaser (state the 3-day cancel right as fact, never coach cancellation, no disparaging the
competitor), and turning "no damage found" into a trust/referral moment instead of a lost visit.
WebFetch/curl blocked on every source tried again; search-summary sourced throughout.
Round 34 (sales-mastery track): rookie 60-day ramp (volume-gated week-by-week plan for a solo ADHD rookie,
`data/rookie_plan.json` - 7 day-range blocks with EN/ES daily goals + linked Practice Door drills) +
landlords/HOA boards (MOPOA/REOMA/Omaha Landlords Association contact numbers, Nebraska SOS corporate search
for HOA management-company contacts, reserve-study sales angle, vendor packet (COI/W-9/lien-waiver)
requirement, and the HOA master-policy/unit-owner legal boundary). Two new backlog items above (membership
fees, HOA-claim-boundary script).
Round 38 (sales-mastery track, done directly by the Research Lead - no scout subagent tool available this
round): two new word-for-word EN/ES objection scripts for cash jobs - "quote me over the phone" and "I want
three bids first" (`data/price_objections.json`, closes a round-31 backlog item) - plus commercial/apartment
decision-maker calling: property manager (gathers bids) vs. asset manager (approves capital spend, often
off-site), a first-call goal that's never a sale, and a 5-touch/~18-day phone-and-in-person cadence
(`data/commercial_calls.json`). Also worked out the "5 numbers to check Monday" self-review, mapped directly
to existing `hh.py weekly` fields (no new build). WebFetch/curl blocked on every source tried again -
search-summary sourced; two new backlog items above.
Round 37 (backlog track): Nebraska Contractor Registration Act (48-2101 to 48-2117, `docs/legal/
48-2100-contractor-registration-act.txt`) fetched direct - closes round T38's open question: the Act does
NOT require printing the registration number on contracts/ads (HMP's current practice exceeds the legal
minimum); $500/$5,000 penalty structure matches the Employee Classification Act; the old 60-day
penalty-free registration grace period expired in 2009. Home Solicitation Sales Act's last two sections,
69-1606/69-1607 (`docs/legal/69-1606.txt`, `69-1607.txt`), fetched direct: 69-1606(5) - zero compensation
for any work performed before a buyer cancels, a stricter rule than the insurance-specific emergency-work
carve-out in 44-8603/8607, and one to keep separate in scripts/docs. Two new backlog items above.
Round 44 (product/strategy track): how CompanyCam/Jobber/Roofr/Hover/ServiceTitan became category
leaders (each founder solved a real, narrow problem for their own/a family trade business first, for
years, before selling to a stranger - the wedge was always one free/cheap narrow feature, never a full
CRM); what roofing salespeople/owners want but don't get beyond round 42's bug list (automatic
follow-up with no manual setup, one job file for sales+office, small shops wanting fewer reliable
features not enterprise AI - Reddit/YouTube quotes stayed unreachable, see new backlog items); a
12-month path (HMP-only through this storm season, then one pilot contractor - Nastase first - for a
30-day side-by-side with 4-5 numbers defined up front and free/discounted pricing, settings/config +
onboarding + a named support answer built before any outside user, brand/landing page held until a
pilot's real numbers exist). Also found EraHub, a smaller roofing CRM already marketing a native EN/ES
toggle - tempers the "no competitor does Spanish" claim from rounds 12/42. WebFetch/curl blocked on
every vendor/blog/reddit domain tried this round - all findings are WebSearch summaries; two new
backlog items above to re-verify directly.
Round 39 (backlog/legal track): finished fetching the whole Insured Homeowners Protection Act
(44-8601-8608, `docs/legal/44-8601.txt`, `44-8605.txt`, `44-8606.txt`, `44-8608.txt`) direct from
nebraskalegislature.gov - Nebraska's actual storm-chaser/assignment-of-benefits law; HMP isn't taking
AOBs today but 44-8606 requires an itemized description of work to go to the insurer too, not just the
homeowner, before repair work starts, or the contract is void (44-8608). Fremont's own building-permit
page (fremontne.gov, direct fetch) confirmed roof AND siding repair/replacement both need a City permit,
and surfaced a separate local requirement round 37's state-level check missed: Fremont's own $65
contractor registration (Resolution 2019-049) for anyone pulling a building permit in city limits/2-mile
jurisdiction - unconfirmed whether HMP has it. Omaha/Lincoln permit pages stayed blocked; three new
backlog items above.
Round 47 (sales track): learning from real door-to-door roofing trainers - opened three named-author
practitioner sources this round (SPOTIO's Trey Gibson, two Roofr posts by Joel Castelli, Roofing
Contractor magazine's Jill Bloom), a step up from rounds 25-42's search-summary-only pattern. Real
mechanics found: knock 3x never the bell, 2 steps back + turn sideways, "did I catch you at a good
time?", and a direct specific-day appointment ask. The one dangerous find - scripts telling reps to
claim insurance rates legally can't rise on an "Act of God" claim - was rewritten out entirely, not
used. YouTube video pages loaded but full player/caption data stayed walled behind a sign-in prompt, so
no real door-knock transcript could be pulled (see new backlog item above); Reddit stayed fully blocked.
Spanish-neighborhood sales-script content is still not found anywhere reachable, third round confirming
the gap (rounds 30, 38, 47) - deprioritized per the updated item above. Output: `data/door_lines_pro.json`
(22 EN/ES lines, all legal_ok) + this file.
Round 51 (sales track, done directly by the Research Lead - no scout subagent tool available this
session, same as 38/45/48): the commercial/apartment MEETING after the call gets booked - the property
walk-through on a multi-building property, the bid package property managers actually check for
(direct-fetched NRCA primary source), the two free habits a 2006 trade-magazine survey (direct fetch)
found separate a winning bid from a typical one (real folder/PDF, say the warranty + certification out
loud), phasing/tenant-notice for occupied buildings, and post-bid follow-up cadence (distinct from
round 38's pre-call cadence). Output: `data/commercial_bid_kit.json` (14 EN/ES steps, legal_check
passes) + `docs/research/2026-09-27-round-51.md`. Three new backlog items above (Nebraska landlord-
tenant notice law, osha.gov re-fetch, bridgman.org/shieldlineroofing.com direct fetch).
Round 48 (backlog track, done directly by the Research Lead - no scout subagent tool available this round,
same as 38/45): closed T164 for real - found the live, working Douglas County (`dcgis.org`) and Lancaster
County (`gis.lincoln.ne.gov`) ArcGIS parcel endpoints and their exact owner-mailing-vs-site-address fields
(round 41 only got as far as the bare domain, which was a dead default page, not real services), both
live-tested with real sample rows - ready for Code to wire into `nbhd.py`'s owner-occupied loader alongside
Sarpy's existing layer. Also found a real, citable Nebraska Supreme Court case for the tortious-interference
line (*George Clift Enterprises, Inc. v. Oshkosh Feedyard Corp.*, 306 Neb. 775, 947 N.W.2d 510 (2020),
converged across 4 independent legal-reference sites) confirming round 36's "already signed with another
contractor" script already sits inside the legal safe harbor. Every law-firm/case-law domain itself stayed
blocked this session (WebFetch and curl both `403`) - the case citation is WebSearch-summary sourced, not
directly fetched; two new backlog items above to re-verify/extend.
