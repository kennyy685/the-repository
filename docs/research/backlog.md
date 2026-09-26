# Research backlog (always on, FilthE 2026-09-26: "constant research for ways to become the best")

The hourly King check starts the top unchecked topic as a new round (Research Lead + scouts) whenever no round is running.
Each round: write `docs/research/<date>-round-<n>.md`, post board items, check the topic off here, and add 1-2 new topics it uncovered.
Web access: if WebFetch is blocked, use Bash `curl -sS -m 20 <url>` (it goes through the session proxy and usually works: state statutes, county GIS, Mesonet). Save statute text to docs/legal/.
Rule: every topic must end in something that improves sales, profit or the app. No research for its own sake.

## Next up (top first)
- [ ] Check whether Cowork's command center map UI actually renders `wind_events[].trees_down`/
      `tree_sample`/`wind_dir` (round 26: the data exists in hud.json since T116-118; display side unconfirmed,
      map source is outside this repo)
- [ ] One-time sweep of the open board (T51-T60, T35, O0-O7) for other "done in code but not checked off"
      items like round 26 found for T116-119 - do this before the next fresh research topic
- [ ] Get a plain answer from the boss/FilthE on how HMP intends to pay and classify a second salesman (W-2 vs.
      true 1099) before any hire happens (round 29: classification risk is real, but the decision needs the boss)
- [ ] Verify Nebraska's Employee Classification Act text and penalty amounts directly against `dol.nebraska.gov`
      or `nebraskalegislature.gov` once egress allows it (round 29: blocked for both WebFetch and curl; the
      $500/$5,000 fine figures are from a secondary source)
- [x] Selling the HMP App: pricing, pilot customers, what a first outside customer needs (multi-company, settings, support) - round 32
- [ ] GAF Master Elite's Service Finance dealer-tech tie-in: does hitting Master Elite unlock a lower financing bar than going direct
- [x] Local NE bank/credit union home-improvement loan programs as a no-dealer-fee alternative to name to homeowners - round 32
- [ ] James Hardie "Select" contractor tier: exact requirements, and does The Edge job's Hardie lap siding work already qualify HMP
- [ ] Roof-chalking vs. insurer photo acceptance: settle the conflict found in round 22 (some sources say never chalk a roof before adjuster photos)
- [ ] Confirm exact door-to-door solicitation hours for Columbus and Schuyler by phone with the city PD/clerk (round 24's web research couldn't reach either ordinance's hours text; `data/city_rules.json` has both flagged "unverified")
- [ ] Annual/1-year check-up follow-up program for past customers (retention + referrals) - revisit once HMP has 10+ completed jobs (round 24 flagged as premature now)
- [ ] Directly open OpenPhone/Podium/CallRail's own pricing pages (blocked via WebFetch this round; try curl) to confirm round 28's missed-call text-back price table before FilthE/boss buy anything
- [ ] Once HMP has enough call volume that live text-back isn't enough, revisit AI-answering upgrade tiers (CallRail Voice Assist, Podium) for real Spanish-conversation support, not just template texts
- [ ] Ask FilthE/boss which document HMP actually uses today before an adjuster visit (plain inspection
      authorization, a contingency-on-approval agreement, or going straight to the final contract) - round 27
      found the three are legally different and easy to blur; unknown from research, needs a direct answer
- [ ] Confirm by phone whether Hearth or Wisetack (round 21's picks) actually accept ITIN-only borrowers with
      no SSN - round 30 found ITIN home-improvement financing exists generally but couldn't confirm either
      named lender's own policy (pages blocked)
- [ ] Trade-specific or Hispanic-market contractor-association sales training (not general Hispanic-marketing
      content) for the bilingual kitchen-table pitch - round 30 still found nothing aimed at contractors
      specifically; try association sites (NARI, NAHB Hispanic councils) or Spanish-language contractor forums
      directly next time
- [ ] Confirm directly (call NUFCU/BCU, or reach catenergy.ne.gov/dwee.nebraska.gov once egress allows) whether
      the Dollar & Energy Saving Loan program and NUFCU/BCU home-improvement loans cover siding/roofing
      replacement specifically, and their real fee schedules (round 32: pages blocked, search-summary only)
- [ ] If/when HMP considers selling the app later: what a real first outside customer needs structurally
      (per-company data separation, second brand/logo slot, support hours) before any pricing conversation -
      round 32 only found pricing-model shape (flat-tier vs. per-seat), not the technical bar

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
Round 32 (backlog track): selling the HMP App to other roofers (not ready - no other customer, no multi-company
separation; when ready, price flat-tier not per-seat, following the market's own shift away from per-seat pricing)
+ NE bank/credit union home-improvement loans as a no-dealer-fee option (state Dollar & Energy Saving Loan program
plus NUFCU/BCU unsecured loans look like the right no-dealer-fee names to give homeowners; egress blocked every
lender/vendor page this round, so rates/fees are search-summary only - two new backlog items above to re-verify).
