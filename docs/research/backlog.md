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
- [ ] Pricing psychology for cash jobs: good/better/best, anchoring, same-day decisions and the 3-day cancel rule
- [ ] Hiring and paying a second salesman later: commission plans that are legal in Nebraska, onboarding with the app
- [ ] Selling the HMP App: pricing, pilot customers, what a first outside customer needs (multi-company, settings, support)
- [ ] GAF Master Elite's Service Finance dealer-tech tie-in: does hitting Master Elite unlock a lower financing bar than going direct
- [ ] Local NE bank/credit union home-improvement loan programs as a no-dealer-fee alternative to name to homeowners
- [ ] James Hardie "Select" contractor tier: exact requirements, and does The Edge job's Hardie lap siding work already qualify HMP
- [ ] Roof-chalking vs. insurer photo acceptance: settle the conflict found in round 22 (some sources say never chalk a roof before adjuster photos)
- [ ] Confirm exact door-to-door solicitation hours for Columbus and Schuyler by phone with the city PD/clerk (round 24's web research couldn't reach either ordinance's hours text; `data/city_rules.json` has both flagged "unverified")
- [ ] Annual/1-year check-up follow-up program for past customers (retention + referrals) - revisit once HMP has 10+ completed jobs (round 24 flagged as premature now)
- [ ] Directly open OpenPhone/Podium/CallRail's own pricing pages (blocked via WebFetch this round; try curl) to confirm round 28's missed-call text-back price table before FilthE/boss buy anything
- [ ] Once HMP has enough call volume that live text-back isn't enough, revisit AI-answering upgrade tiers (CallRail Voice Assist, Podium) for real Spanish-conversation support, not just template texts
- [ ] Bilingual (Spanish-language) kitchen-table/inspection sales training content - round 27 found none in the
      general sales-training literature; check trade-specific or Hispanic-market contractor associations directly
- [ ] Ask FilthE/boss which document HMP actually uses today before an adjuster visit (plain inspection
      authorization, a contingency-on-approval agreement, or going straight to the final contract) - round 27
      found the three are legally different and easy to blur; unknown from research, needs a direct answer

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
