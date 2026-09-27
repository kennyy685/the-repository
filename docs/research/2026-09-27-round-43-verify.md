# Research round 43 (2026-09-27): VERIFY - checking old claims against now-reachable sources

FilthE opened more of the network (`curl -sSL -m 20 -A "Mozilla/5.0" <url>` now reaches roofingcontractor.com,
nachi.org, jameshardie.com, eagleview.com, nrca.net, repcard.com, wisetack.com, openphone.com, census.gov,
spc.noaa.gov, api.weather.gov, bbb.org, mopoa.com, hover.to, *.nebraska.gov, nebraskalegislature.gov, reddit,
youtube, spotio.com, companycam.com, roofr.com, salesrabbit.com, acculynx.com, hailtrace.com, wikipedia). Still
blocked: gaf.com, fema.gov, cityofomaha.org, lincoln.ne.gov, fremontne.gov, g2/capterra/jobnimbus,
support.wisetack.com, quo.com. This round re-checked every claim in the 2026-09-26 rounds and `data/*.json`
marked unverified/vendor-claim/search-summary against the priority list, using real page fetches (and BBB's own
Cloudflare bot-check meant some of those had to fall back to WebSearch corroboration instead of a direct open -
noted below where that happened).

**Biggest thing that changes advice: OpenPhone renamed itself Quo (quo.com) in Sept. 2025.** Anyone told to "buy
OpenPhone" (round 28, the board, FilthE's own notes) needs to go to **quo.com**, not openphone.com - the old
domain now 301-redirects there. Second-biggest: **the "63% of roofers are Latino" stat is wrong** - it's not in
the article that was cited for it (round 12, and repeated in `docs/orders/roadmap.md`); the real number is
"nearly 3/4 of new labor-force growth in roofing by 2020," a different and smaller-sounding but still very real
claim. Everything else below is either a confirmation (upgrades confidence, no advice change) or a smaller
correction (naming, a missing nuance).

## Summary table

| # | Old claim | What the source actually says | Verdict | Source (fetched 2026-09-27) |
|---|---|---|---|---|
| 1 | "Buy OpenPhone," openphone.com pricing | `openphone.com` 301-redirects to `www.quo.com` - OpenPhone rebranded Sept. 2025, now "Quo," an AI-front-office product (adds "Sona" AI voice agent) | **Corrected** (name/domain; price/feature need a fresh look at quo.com) | Direct `curl -I` of openphone.com and www.openphone.com; corroborated by PR Newswire, Yahoo Finance, GetVoIP (WebSearch, quo.com itself proxy-blocked) |
| 2 | Latinos are "~63% of roofers" (round 12, repeated in `docs/orders/roadmap.md`) | roofingcontractor.com/articles/99130 (round 12's own cited source) says Latinos were "36%... 54%... nearly three-quarters" of new roofing labor-force **growth** through 1990-2020 - never says "63% of roofers"; also gives 21.3% of roofing business owners as Latino/Hispanic (Zippia 2023, not previously used) | **Corrected** - drop "63%," it isn't in the source | Direct fetch, roofingcontractor.com/articles/99130-latino-roofing-contractors-workers-carving-a-larger-space-within-the-industry |
| 3 | James Hardie ALLIANCE = "Select / Preferred / Elite Preferred" tiers; Select unlocks the warranty; Elite Preferred needs $1M liability/BBB/90% score | jameshardie.com/alliance/ names four tiers **Enrolled -> Select -> Preferred -> Elite** ("Elite Preferred" isn't a real name); the page lists only marketing/lead-gen benefits per tier (leads, directory listing, marketing kit, rewards points) - **no fee, volume, or warranty language anywhere on the page** | **Corrected** (tier name) + **still unverified** (warranty tie-in, fees, requirements - not on Hardie's own page at all, a phone call is now the only way to get this) | Direct fetch, jameshardie.com/alliance/ |
| 4 | 2012 GAF/Wells Fargo financing promo applied equally to Master Elite and Certified contractors | Confirmed word-for-word: "offered exclusively for its Master Elite and Certified Contractors," "at no extra charge... beyond the minimum administrative fee already paid" for both | **Confirmed** (and flagged as a 2012 program - unknown if still live) | Direct fetch, roofingcontractor.com/articles/88505 |
| 5 | Wisetack: $500-$25,000 loans, 0-35.9% APR, 3-120 months, no participation fees | Confirmed word-for-word on wisetack.com's own pages (home, /faqs, /faqs-merchants) | **Confirmed** | Direct fetch, wisetack.com, wisetack.com/faqs, wisetack.com/faqs-merchants |
| 6 | Wisetack merchant fee = 3.9%/transaction | Not stated anywhere on wisetack.com's own reachable pages - still only a third-party support article (support.contractorplus.app); support.wisetack.com itself is proxy-blocked | **Still unverified** (as a primary-source fact; two independent secondary sources agree on 3.9%) | wisetack.com (fetched, doesn't mention it); support.contractorplus.app (WebSearch only) |
| 7 | Wisetack/Hearth accept ITIN/no-SSN borrowers | Not addressed anywhere on wisetack.com - neither confirmed nor denied | **Still unverified** - call 1-833-927-0333 | wisetack.com, /faqs (fetched, silent on this) |
| 8 | MOPOA membership fee unknown | mopoa.com/membership: Yearly Membership **$150/yr**; Vendor/Contractor tiers **$180-300/yr** (bundled with a newsletter ad or meeting sponsorship) | **Confirmed** | Direct fetch, mopoa.com/membership |
| 9 | BBB ratings for round 17b competitors (Home Pride A+/1994, ABC Seamless Fremont A+/not accredited, ABC Seamless NE "listed") | Home Pride: A+, accredited 3/17/1994, 4.74/5 over 117 reviews, 11 complaints/3yr. ABC Seamless Fremont: A+, not accredited. ABC Seamless of Nebraska: accredited, rating A | **Confirmed** (all three) | bbb.org blocks curl with a Cloudflare JS challenge (network-reachable, content isn't) - WebSearch corroboration of the same BBB profiles, not a direct open |
| 10 | Nebraska public-adjuster license requirement (44-9201 to 44-9219) | 44-9204(1): "A person shall not operate as or represent that such person is a public adjuster... unless... licensed." 44-9204(4)(c) exempts photographers/estimators/technical-assistance roles from that license. doi.nebraska.gov: a public adjuster "negotiate[s] a settlement... YOU HAVE TO PAY" them, a disclosed % of the settlement | **Confirmed**, plus a new detail (adjusters are paid a % - a real talking point) | Direct fetch, nebraskalegislature.gov statute 44-9204; doi.nebraska.gov/adjusters-what-are-my-options |
| 11 | "Don't chalk the roof, insurers reject chalked photos" (round 22) vs. "chalk one test square" (round 35) | InterNACHI's own "Mastering Roof Inspections" series (nachi.org): chalking a hit "will create the illusion of larger damage than actually exists" (a different reason than "insurers reject it"); adjuster test squares are 10'x10' (100 sq ft); "eight hits is a common number" for replacement | **Corrected** (the *reason* was wrong, not the practical rule) - closes the backlog item that wanted a trade-association primary source | Direct fetch, nachi.org/hail-damage-part10-37.htm and -part12-39.htm; NRCA's "Professional Roofing" May 2009 PDF (nrca.net/roofingguidelines) as a second confirming primary source |
| 12 | SPC hail climatology: NE hail peaks June (~31%), May (~21%), July (~19%) of reports, 1955-2015 | spc.noaa.gov is reachable, but `/climo/online/` and `/wcm/` are tools/graphic portals (national PNGs, a raw netCDF file), not a page stating Nebraska's month split as text | **Still unverified** (exact %s) - qualitative shape (April ramp, May-July peak, June worst) unchanged | Direct fetch, spc.noaa.gov/climo/online/, spc.noaa.gov/wcm/ (neither has the number in fetchable text) |
| 13 | `benchmarks.json` doors_to_conversation 20/30/40% | spotio.com's own blog: "the target is typically a 30-40% contact rate on a given pass" | **Confirmed** (typical/high exact match; low end is below SPOTIO's own stated floor) | Direct fetch, spotio.com/blog/door-to-door-sales/ |
| 14 | `benchmarks.json` overall_close_rate_exclusive_leads 25/30/35% | spotio.com: "well-run teams close 30-40% of qualified inspection leads" (different metric, same order of magnitude) | **Corroborated** (second independent directly-opened source, not identical wording) | Direct fetch, spotio.com/blog/door-to-door-sales/ |

## What to work on next (ranked)

1. **Tell FilthE/boss: if buying a missed-call text-back tool, it's "Quo" now, not "OpenPhone."** Who: FilthE/Boss.
   Effort: S. The $15-19/mo price is probably still right but wasn't confirmed on quo.com directly (blocked) -
   check the current plan page before paying, and specifically check whether the old one-way auto-text-back
   template still exists now that the product leads with an AI voice agent ("Sona").
2. **Stop saying "63% of roofers are Latino."** Who: FilthE (don't repeat it out loud), Code (already fixed the
   one place it lived in `docs/orders/roadmap.md`). Effort: S. Use instead: "Latino workers drove nearly 3 out
   of 4 new hires in roofing by 2020 (BLS)" - still a strong pitch for HMP's bilingual edge, just accurate.
3. **Drop "Elite Preferred" from how anyone talks about James Hardie; say "Preferred" or "Elite."** Who:
   FilthE/Code (any future print/app copy). Effort: S. And downgrade urgency on chasing Hardie tiers for
   warranty reasons specifically - the ALLIANCE program looks like a marketing rewards ladder, not a
   warranty-gating system; the phone call to Hardie (already on the backlog) is now the *only* way to learn
   what actually gates the warranty and what Select requires.
4. **Sign up for MOPOA's Vendor/Contractor tier ($225/yr - membership + sponsor one meeting).** Who: FilthE/Boss.
   Effort: S. Cost: $225/yr, confirmed cheap, gets HMP in front of "hundreds" of Omaha-metro landlords who
   decide roofing/siding jobs on multiple rental units at once - a real, legal lead channel already flagged
   round 34, now unblocked by a real price.
5. **Fold the corrected chalk-marking reason into `docs/guides/adjuster-meeting.md` and the inspection checklist
   print piece** (round 35 found the practical rule but never edited the docs; round 43 found the right reason
   to give). Who: Designer/Code. Effort: S. Say "chalking makes a hit look bigger than it is - chalk one test
   square to count, not the whole roof," not "insurers reject chalked photos."
6. **Before promising Wisetack's fee % or ITIN acceptance to a homeowner, FilthE still needs to call
   1-833-927-0333** - unchanged from round 30, now double-confirmed that Wisetack's own public pages don't say
   either. Who: FilthE. Effort: S.

## Watch out
- BBB's site blocks automated fetching with a Cloudflare challenge - anything sourced to bbb.org this round (or
  earlier) is WebSearch-corroborated, not a page Claude actually opened. Treat as reliable but not primary-fetch
  verified.
- quo.com and support.wisetack.com remain proxy-blocked even though their parent brands (openphone.com,
  wisetack.com) are reachable - a reachable root domain doesn't guarantee every subdomain/redirect target is.
- Two items stay genuinely unresolved after a real attempt: Wisetack's merchant fee % and ITIN acceptance, and
  the exact NE monthly hail-report percentages. Don't upgrade either to "confirmed" without a phone call or raw
  NOAA data pull respectively.

## Sources
[1] https://www.jameshardie.com/alliance/ (direct fetch, 2026-09-27)
[2] https://www.wisetack.com/ , /faqs , /faqs-merchants (direct fetch, 2026-09-27)
[3] https://openphone.com/ , /pricing ; https://www.openphone.com/ (direct `curl -I`, confirms 301 to quo.com, 2026-09-27)
[4] https://www.mopoa.com/membership (direct fetch, 2026-09-27)
[5] https://www.roofingcontractor.com/articles/99130-latino-roofing-contractors-workers-carving-a-larger-space-within-the-industry (direct fetch, 2026-09-27)
[6] https://www.roofingcontractor.com/articles/88505-gaf-and-wells-fargo-to-offer-master-elite-and-certified-contractors-reduced-fees-for-low-or-nointerest-financing- (direct fetch, 2026-09-27)
[7] https://nebraskalegislature.gov/laws/statutes.php?statute=44-9204 (direct fetch, 2026-09-27)
[8] https://doi.nebraska.gov/adjusters-what-are-my-options (direct fetch, 2026-09-27)
[9] https://www.nachi.org/hail-damage-part10-37.htm , https://www.nachi.org/hail-damage-part12-39.htm (direct fetch, 2026-09-27)
[10] https://www.nrca.net/roofingguidelines/pdf?id=158908&k=1789444 - "Learn how to identify hail damage on roof systems," Professional Roofing (NRCA), May 2009 (direct fetch, 2026-09-27)
[11] https://spc.noaa.gov/climo/online/ , https://spc.noaa.gov/wcm/ (direct fetch, 2026-09-27 - tools/portal pages, no NE-specific monthly % in fetchable text)
[12] https://spotio.com/blog/door-to-door-sales/ (direct fetch, 2026-09-27)
[13] BBB profiles for Home Pride Contractors, ABC Seamless of Fremont, ABC Seamless of Nebraska - bbb.org (Cloudflare-blocked to curl; WebSearch corroboration of the same profile pages, 2026-09-27)
[14] OpenPhone->Quo rebrand corroboration: PR Newswire, Yahoo Finance, GetVoIP, quo.com/blog/next-chapter (WebSearch, quo.com itself proxy-blocked, 2026-09-27)
