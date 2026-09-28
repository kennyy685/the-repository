# Practice Door v12: the rest of the sale

Lead plan, 2026-09-28, then built the same day (branch `pd-v11-wf_7deff063`, then stacked on the King's Practice Door v11 as v12). FilthE: "put yourself in the perspective
of a salesman, create scenes, use data on the internet to make better advice tips and to guide better." Built from 7
scout reports and 3 verifier passes (legal, evidence, realism), checked against the page (`pages/practice-door.html`),
HMP's own print pieces (`docs/print/claims-101.html`, `contingency-agreement.html`, `contract-draft.html`,
`adjuster-meeting.html`), the statutes in `docs/legal/`, `data/city_rules.json`, and fresh Census numbers pulled this
session (ACS 2020-2024 5-year summary file, direct download, Fremont city = place 3117670).

This file is the plan as shipped: every verifier fix is applied below, and the "Cut" list at the end says what was
dropped and why. The exact scene, tip and check wording lives in the page (search `v12`).

## In one breath
The first 28 homeowners were almost all "first knock". A storm rep's money (and legal risk) lives in the next
6 weeks: the photos in the driveway, the deductible shock at the table, the small first check with the bank's
name on it, the adjuster visit, the partial denial, the 3-day doubt call, the last-day walk-through. v12 adds
those 7 moments plus 3 real Fremont doors (the homeowner who looks you up, the bilingual couple, the old storm). It
also makes every scene's house match Fremont's owner homes (median built about 1961, not 1978-2004), weights the
Random homeowner by who really lives in Fremont, scores the next step on storm doors, and adds 10 scene checks the
coach can score from a transcript.

## Stacked on the King's v11 (why this is v12)
The King's Practice Door v11 (the 4-week Plan, the ready-to-knock checklist, the top 15 objections, lesson prompts, the
Aldaba look, the MacBook layout) shipped first, so this research release sits on top of it as v12. What changed in the
stack:
- The 10 new homeowners and the "After the knock" section use v11's cards and icons ("Looks you up" got v11's search
  icon). On the MacBook the picker has 3 columns, so a section's last card now fills its row (spans 3 when alone, 2
  when it is the second of 2); phones keep the 2-column rule.
- One objection, one answer: the "Ask before you answer" drill (T28) asked the same thing as top-15 card 4 ("That's
  more than I wanted to spend"), with the opposite first move. Card 4 keeps it, merged: one question first (T28's
  research), then v11's Good and Better; "most folks land on Better" dropped (a claim HMP can't back yet).
  `docs/orders/sales-path.md` card 4 matches word for word. The objection check keeps T30's sentence, so the move is
  still scored on every run. SKILL now adds 4 drills (16 in all).
- v11's HOA card says the deductible "is a board decision" / "es decisión de la junta": the deductible backup
  (dedTalk) now accepts that, so saying the card never fails the scorecard. The rx check sweeps all 15 cards.
- Ready to knock: passing "Answer the one who decides" also counts for the deductible item. The Random mix, the Plan's
  steps and the lesson prompts were checked against the 37 homeowners: every key exists.

## Fremont numbers used (ACS 2020-2024, Census Bureau, direct download)
| What | Number | Table |
|---|---|---|
| Occupied homes | 11,084: 62.0% owner, 38.0% renter | B25003 |
| Median year built (all homes) | 1966 | B25035 |
| All homes built 1939 or earlier / 1940s / 1950s / 1960s / 1970s | 19.7% / 5.9% / 14.8% / 15.3% / 12.9% | B25034 |
| All homes built 1980s / 1990s / 2000s / 2010s / 2020+ | 6.5% / 7.2% / 9.4% / 6.4% / 1.9% | B25034 |
| **Owner homes** built 1939 or earlier / 1940s / 1950s / 1960s / 1970s | 23.2% / 7.1% / 17.0% / 15.9% / 10.3% | B25036 (owner rows) |
| **Owner homes** built 1980s / 1990s / 2000s / 2010s / 2020+ | 5.8% / 5.6% / 9.2% / 5.5% / 0.4% | B25036 (owner rows) |
| Share of homes in the old generator range (1978-2004) | about 21% | B25034 |
| Owner homes with a mortgage | 59.2% | B25081 |
| Owner householders 65+ / 75+ | 32.7% (2,246 of 6,871) / 13.0% | B25007 |
| Owner householders by 10-year band: 45-54 / 65-74 | 21.0% / 19.7% | B25007 |
| Median home value | $214,700 | B25077 |
| Hispanic residents | 20.3% | B03003 |
| Speak Spanish at home (age 5+) | 15.8% | C16001 |
| Speak Spanish AND English less than "very well" (all residents 5+) | 7.0% (7.6% for all languages) | C16001 |
| Hispanic householders among owner households | 12.0% | B25003I |
| 1-unit detached / 1-unit attached (townhomes) | 68.5% / 7.5% | B25024 |

Source: https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/
(files acsdt5y2024-b25003.dat, -b25034, -b25035, -b25036, -b25077, -b25081, -b25007, -b25024, -b03003, -c16001, -b25003i).
B25036 was pulled during the build (the realism fix on U1: B25034 counts apartments too, and the walk targets owner homes).

## Ranking of the new scenes (how often x how costly)
| # | Key | Moment | How often | Cost if wrong |
|---|---|---|---|---|
| S1 | founddmg | Driveway, damage found: "so insurance pays, right?" | Every damage find | Promise / handling the claim |
| S2 | deductShock | Kitchen table: 2% deductible shock, "knock it off" | Every insured job | Contract void (44-8608), fraud |
| S3 | checkday | First check small, bank on it, "bill insurance directly" | Every insured job, 59% have a mortgage | Promise, deal dies in week 3-6 |
| S4 | adjmeet | Day before the adjuster: "talk him into it" | Every insured job | Public-adjuster work, fraud |
| S5 | checklist | Door: "Looks you up": the state's hire-a-contractor list, only 6 reviews | Common after every storm | Lost trust, "licensed", money up front |
| S6 | losdos | Door: bilingual couple, she decides, "we pay nothing?" | 12% of owner homes Hispanic | Deductible in Spanish, lost deal |
| S7 | partial | Letter: roof yes, aluminum siding + gutters "cosmetic" | Common on older metal siding | Negotiating, 44-8603 cancel right |
| S8 | coldfeet | Phone: signed yesterday, cousin says scam | Every sale has a 3-day window | 69-1606(5), cancels |
| S9 | finaldone | Last day: review, yard sign, "add it to the insurance invoice" | Every finished job | Fraud, 44-8604, FTC review rule |
| S10 | latestorm | Door: storm a year ago, "is it too late? say it was the newer storm" | Everyday knocks on older homes | Date-of-loss fraud, a missed policy limit |

## What was built (page code)
1. **`at`**: where the talk happens, used in the homeowner prompt and the first cue ("Kenny is with you at your kitchen
   table..."). Replaces the fixed "in your driveway, right after his free roof inspection" / "Kenny comes down the
   ladder" for every new after-scene. `cue` gives a custom first cue (coldfeet: Kenny picks up her call).
2. **No-damage hints scoped**: `f_nodmg` and `h_nodmg` now fire only for `sys === 'knockingNoDmg'` (before, any
   `after` scene got them). New fields `hint` (first rookie hint) and `fix` (a better "say instead" line per trap:
   `f_yourcall`, `f_olddmg`, `f_date`).
3. **7 new `sys` goal lines** (knockingFound, knockingDeduct, knockingCheck, knockingAdj, knockingPartial,
   knockingDone, knockingDoubt). The rookie AI hint now gets the scene's own goal line.
4. **Picker**: a 4th section "After the knock / Después de la puerta" (`sec: 'after'`) for founddmg, nodamage,
   adjmeet, checkday, deductShock, partial, gotcheck, adjno, finaldone. 38 cards.
5. **losdos** keeps Tony in English in a Spanish session too (`langBoth`), and its language chip always says EN/ES.
6. **coldfeet** is not a `phone` scene in code (so the phone-quote price scan never flags "$500 deposit"); `at` and
   `cue` set the call instead. It skips the next-date check (its own `nostart` check names the start date).
7. **Legal backups**: `DED_OK` accepts "the owner's part" / "la parte del dueño" (the S6 realism test showed the page
   failed Kenny for the right answer); `SIGN_ASK` hears "what am I signing" / "where to sign" / "qué estoy firmando"
   (so the cancel-form check shows up for founddmg and the fixed-income homeowner); `START_NOW` / `startsEarly` catch
   agreeing to start inside the 3-day window.
8. **Tests**: `tests/js/practice_door_rx_check.js` has 31 new cases, checks every homeowner opener, runs `dedTalk` on
   every line Kenny is taught (257 lines), and runs every drill's model answers through that drill's own local check.

## New scenes (S1-S10) as shipped, with the fixes applied
- **S1 founddmg (Jenna / Araceli)**. Fix applied: whether to file is her decision ("it's your claim and your call; if
  you file, you call your insurer yourself"). Realism fix: if he brings out HMP's agreement she asks "What am I
  signing?", and the good answer explains the contingency (HMP works only if insurance approves), gives the 3-day
  cancel form in EN or ES and says the deductible notice is in it. New RX: "I can call your insurance and file it for
  you" (passed clean before). Sources: `docs/print/claims-101.html` ("The homeowner files the claim. They call their
  own insurance company."; "Their decision, their call"); https://doi.nebraska.gov/hail-damage-does-my-roof-need-repair ;
  `docs/print/contingency-agreement.html`; `data/inspection_walk.json` (drill-show-photos-phone).
- **S2 deductShock (Paul / Ernesto)**. Fix applied: never "what your scope covers" (advising an insured on a claim is
  public-adjuster work, Neb. 44-9203(9)(c); 44-9204 has no contractor exemption). He goes over the work listed on the
  insurer's scope and HMP's payment schedule; policy questions go to the insurer. 44-8604 counts "granting any
  allowance or offering any discount against the fees", so free gutters = knocking it off. Sources: `docs/legal/44-8604.txt`,
  `44-8607.txt`, `44-8608.txt`; `docs/print/contract-draft.html`; https://www.ericluebbe.com/blog/nebraska-hail-damage-claims-guide
  (1-2% wind/hail deductibles); ACS B25077 ($214,700 median, so 2% is about $4,300-4,500, an example, not a quote).
- **S3 checkday (Darlene / Rocío)**. Fixes applied: her insurance company (not her paperwork, not Kenny) says whether
  the held-back part comes after the work; he does not read or interpret her policy; the deductible was already taken
  out of check 1 (Claims 101: ACV "paid first, minus the deductible"); he says "loss-draft department" out loud (the
  bank's term). Evidence corrections: Luebbe says ACV on a 14-year roof "might be 25% to 40% of the replacement cost",
  so depreciation is 60-75% (the scene's $6,200 of $17,000 = 36% ACV fits). "Loss-draft department" comes from
  AmeriSave, not Clovered. AmeriSave says the homeowner endorses first, which differs from Claims 101's "mortgage
  company, which signs first", so the scene stays silent on signing order. 44-8605 regulates assignments and does not
  ban them: "HMP is never on the check" is HMP's own rule (contingency agreement). Sources: `docs/print/claims-101.html`;
  `docs/print/contingency-agreement.html`; `docs/legal/44-8606.txt`; https://www.ericluebbe.com/blog/nebraska-hail-damage-claims-guide ;
  https://resolutionclaims.org/articles/rcv-vs-acv-replacement-cost-actual-cash-value ;
  https://www.amerisave.com/learn/your-insurance-claim-check-made-out-to-your-mortgage-lender-here-s-your-step-by-step-guide ;
  ACS B25081 (59.2%).
- **S4 adjmeet (Chris / Rubén)**. No fixes. HMP adjuster sheet: "We document damage. We don't set the settlement."
  "Never say you negotiate for the homeowner." DOI "After the Storm": be present at inspections. Sources:
  `docs/print/adjuster-meeting.html`; https://doi.nebraska.gov/sites/default/files/doc/AfterTheStorm-DisasterClaimsProcess_0.pdf ;
  https://nebraskalegislature.gov/laws/statutes.php?statute=44-9201 .
- **S5 checklist, relabeled "Looks you up" (Janet / Beatriz)**, tag "Only 6 reviews?". Fixes applied: HMP has no
  office (the business address is 2600 Laverna St, Apt 50), so Kenny gives HMP's business line and Fremont business
  address printed on the contract; the homeowner can still ask "Where's your office?". Realism fix: the "You're
  licensed, right?" test (chaser's) and the "deal with my insurance for me" test (agentwait's) were cut and replaced by
  the #1 AG/FTC scam sign: "Do I have to put money down to get on your list?" (right move: no money today, the look is
  free). Traps: license, cancel. Mix weight 3.5 -> 2.5 in season. Evidence corrections: the 91% is Clear Seas Research
  for ACHR News (2024, 400 homeowners, HVAC contractors: "91% rate online reviews as an important factor"), not
  BrightLocal. The homeowner's list is a combined one, not the same list from 5 agencies: AG = check with the Dept of
  Labor, check online, 2+ quotes, no full pay up front, written contract, never sign over the insurance check, stay
  involved in the claim; DOI = be present during inspections, avoid paying in full up front; FTC = proof of license or
  insurance, reviews, written contract; BBB = watch what they do, a real address, have your insurer inspect. No NICB
  list is cited. The Fremont permit (valid 30 days, carried on the person) is confirmed on fremontne.gov/73. Sources:
  https://ago.nebraska.gov/news/avoiding-storm-chasing-scam-artists ; https://doi.nebraska.gov/news/news-release-after-storm-you-sign-dotted-line ;
  DOI After the Storm PDF; https://consumer.ftc.gov/articles/how-avoid-scams-after-weather-emergencies-and-natural-disasters ;
  https://www.bbb.org/article/news-releases/22467-bbb-scam-alert-watch-out-for-free-roof-inspections-look-for-bbb-seal ;
  https://www.achrnews.com/articles/155206-91-of-homeowners-rely-on-online-reviews-before-picking-contractors ;
  `data/city_rules.json`; https://www.fremontne.gov/73/Solicitor-Licensing .
- **S6 losdos (Tony & Marisol / Tony y Marisol)**. Fixes applied: the answer is worded "always your part / siempre es
  su parte" and `DED_OK` now also accepts "the owner's part / la parte del dueño"; Tony keeps speaking English in a
  Spanish session (`langBoth`); the name stays "Tony" in Spanish. Marisol's deductible question is written as a "test
  once" so the homeowner prompt's never-ask-for-anything-illegal rule doesn't block it. Evidence corrections: 7.0% is
  residents 5+ who speak Spanish AND English less than very well (7.6% for all languages); NAHREP 2024 has nothing
  findable on "women run the finances" (Marisol running the money is a character choice, not a stat); the ATA link was
  about court-interpreter hiring (dropped); the Sage article only mentions relatives translating in passing (dropped).
  Kept: RISMedia ("the decision-maker may not even be the one purchasing"). Sources: ACS B03003, C16001, B25003I;
  https://www.rismedia.com/2023/03/14/four-ways-become-trusted-advisor-latino-homebuyers/ ; `docs/legal/44-8604.txt`.
- **S7 partial (Tammy / Alicia)**. Fixes applied: the 44-8603 cancel is in writing, to the business address, with a
  copy of the insurer's letter; the siding gets its own separate estimate at the regular price, with its own contract
  and 3-day cancel form, never tied to the claim (no 44-8604 allowance; 69-1604 and 69-1606(5) apply to what becomes a
  cash sale). Realism fix: hail cracks or punctures vinyl (functional damage); "cosmetic" denials hit dents on metal,
  so the scene says "hail dents on your aluminum siding and gutters" (fits Fremont's 1950s-70s houses). Extra checks:
  insurerCancel + itemized. Evidence correction: the goodliferoofs and uphelp pages say nothing about cosmetic
  exclusions; insurance.com ("Dented siding... typically classified as cosmetic") is the source. Sources:
  `docs/legal/44-8603.txt` (https://nebraskalegislature.gov/laws/statutes.php?statute=44-8603); `docs/print/contingency-agreement.html`;
  insurance.com on cosmetic hail damage.
- **S8 coldfeet (Heather / Claudia)**, Spanish label "Le entran dudas" (not "Se arrepiente", which means she already
  regrets it). Fixes applied: Kenny points her to the business address and business line printed on her contract
  (where a cancel notice goes), never "our office"; if she decides to cancel he tells her how with no pushback (sign the
  form in her copy, mail or hand it to that address, 69-1604(1)). LEGAL_LIST now flags agreeing to start inside the 3
  days on a cash sale (U6). Sources: `docs/legal/69-1604.txt`, `69-1605.txt`, `69-1606.txt`; `docs/print/contract-draft.html`
  ("If you cancel on time, every payment is returned within 10 days"); `docs/research/backlog.md`; `data/city_rules.json`;
  https://newsroom.statefarm.com/contractor-fraud/ .
- **S9 finaldone (Ron / Don Chuy)**. Fixes applied: the referral rule now covers reviews (LEGAL_LIST, `r_`/`n_referral`,
  and a new RX: "leave us five stars and we'll knock $200 off" passed clean before). Evidence corrections: the Roofing
  Contractor consumer survey is from 2006 and has no yard-sign data (dropped, with "seen by hundreds of households");
  the 91% is Clear Seas/ACHR News. Added the direct rule: FTC 16 CFR 465.4 (in effect Oct 21, 2024) bans incentives
  "conditioned expressly or by implication" on a review's sentiment; to an insured, a reward above nominal value is
  also 44-8604. Claims 101 step 8 (proof of completion releases the depreciation check) is why the insurer invoice must
  match the real covered work. Sources: FTC 16 CFR 465.4; `docs/legal/44-8604.txt`; `docs/print/claims-101.html`;
  `docs/print/completion-certificate.html`.
- **S10 latestorm (Duane / Don Rafael)**. Fix applied: Luebbe says most policies limit filing to "typically 12 months
  from the date of loss, sometimes 24", so on a 300-420-day-old storm "I won't rush you" can cost him the claim. The
  right move is now: "the limit depends on your policy and some are short, so check it or call your insurer this week"
  (no number, no pressure). Claims 101's "years, not days" is true for lawsuits (44-357 / 25-205), not the policy's
  reporting window: flagged for a separate correction (below). Stormersite's 123 reports within 10 miles since 2004 is
  confirmed. Sources: `docs/print/claims-101.html`; `docs/print/adjuster-meeting.html`; `docs/print/contract-draft.html`
  (Insurance Fraud Act notice); https://www.ericluebbe.com/blog/nebraska-hail-damage-claims-guide ;
  https://www.propertyinsurancecoveragelaw.com/blog/what-are-the-carriers-timelines-for-handling-my-hail-damage-claim-nebraska-coverage-series/ ;
  https://www.stormersite.com/hail_reports/fremont_nebraska .

## New scene checks (EXTRA_CK), with local backups (can only fail a pass)
| Check | Homeowner | Passes when | Local backup fails it when |
|---|---|---|---|
| showfacts | founddmg | photos (good next to damaged), says only what they show; insurer decides; her claim and her call | a promise / negotiate / deductible flag |
| deductfirm | deductShock | deductible always theirs; turns down BOTH deals; never reads or interprets the policy | a deductible / fraud flag, or no "your part" line |
| itemized | checkday, partial | homeowner AND insurer get the same itemized list before work; never interprets the policy | no line with "itemized/detallada" + "insur/aseguradora" |
| showonly | adjmeet | shows damage, adjuster decides, money talk is theirs, truthful about old damage | a negotiate / promise / fraud flag |
| insurerCancel | partial | 3 business days after the insurer's letter, in writing, their call (a copy of the letter is a plus) | a cancel / coach_cancel flag, or no 3-day line |
| proof | checklist | 2+ checkable proofs (permit, registration, business line and address, insurance certificate, contract); honest reviews; no money today | a license flag |
| bothlang | losdos | answers her in Spanish (usted), same answer in both languages, corrects "we pay nothing" | a deductible flag, or no Spanish line |
| nostart | coldfeet | her 3 days as a fact and how to cancel; deposit back in 10 days; no work before the window; a real start date | a cancel flag, no 3-day line, or agreeing to start early |
| reviewok | finaldone | review and yard sign with a thank-you only; insurer invoice = real covered work | a referral / fraud / deductible flag |
| datefact | latestorm | real storm date only; the limit depends on the policy and some are short (no number, no pressure); dated photos | a fraud / promise flag |

`itemized` dropped its "applies:false" clause (the realism fix: extras are graded `coach === true`, so "applies:false"
would have shown as a FAIL; both homeowners' briefs bring it up).

## Upgrades to existing scenes (U1-U8)
- **U1 houses match Fremont (global)**: `newScenario` now picks the decade by the owner-occupied rows of ACS B25036
  (not B25034, which counts apartments), then a year inside it (pre-1940 = 1900-1939). Cash scenes keep their own
  `built` range.
- **U2 retiree: the deductible burn**. Last storm the out-of-town crew said insurance would cover everything and he
  still paid a $2,500 deductible. Test line (realism fix): "Let me guess, you'll take care of my deductible too, like
  the last guys said?" Traps deductible + promise, plus a good line. Evidence correction: a third of Fremont owners are
  65+ (B25007: 2,246 of 6,871); by 10-year band, 45-54 (21.0%) edges 65-74 (19.7%). Neilsberg dropped.
- **U3 chaser: the city permit**. "Do you even have a permit to knock on doors here?"; good line adds "shows his City
  of Fremont solicitor permit". Fremont Ordinance 3970 (Municipal Code ch. 10, sec. 10-201/10-202): valid 30 days,
  carried on the person, revocable for high-pressure sales, false info or knocking at a posted house.
- **U4 fixed: the vulnerable-adult moment**. He repeats one question twice, then "You seem like a nice young man.
  Just show me where to sign." Good line: slows down, no signature today, offers to come back with a family member,
  leaves the written estimate. Evidence correction: the exploitation definition is Neb. 28-358 (taking a vulnerable
  or senior adult's money "by means of undue influence"); senior adult = 65+ (28-366.01), so it reaches every 65+
  owner; 28-348 only names the Act; the NDBF act covers broker-dealers and banks (dropped); "a family member can later
  challenge the contract" had no source (dropped). 75+ = 13.0% (B25007).
- **U5 oldhouse**: `built` 1905-1962 (the brief now says "this old house"). Legal fix: removing painted wood siding
  from a pre-1978 house is an EPA RRP renovation (Nebraska is run by EPA directly), so the good line adds "never says
  the old paint is safe or 'no big deal'". No "lead-safe certified" line until the boss confirms (question added).
- **U6 sharper legal rubric + RX**: deductible = any free upgrade, free extra work or other allowance (44-8604);
  negotiate = also offering to file the claim or call the insurer for them; cancel = also agreeing to start or work
  inside the 3 days on a cash sale (69-1606(5)); referral = a reward for a referral OR a review, or a 5-star review in
  exchange for anything (FTC 16 CFR 465.4); fraud = a false storm date or date of loss, or calling older damage storm
  damage. New RX (each with compliant look-alikes in the test): call/file "for you" (EN+ES), free extras for the
  deductible (EN+ES), a different storm date (EN+ES), a reward for a review (EN+ES).
- **U7 next step on storm doors**: `nextdate` now scores storm door homeowners too: PASS on a yes to a look now or a
  set day and time; "I'll call you" fails. Not for renter, rental, manager, HOA (the win is a contact), after-scenes or
  phone calls. It is in the coach's JSON template for storm doors, with a local fallback (a named day/time, or the
  coach's outcome "yes"). Evidence correction (Gong, B2B, medium confidence): in the fastest deals the seller "spent 53%
  more time discussing next steps" in the first meeting, and "close rates decline 71% when next steps are not discussed
  on the first call" (https://www.gong.io/blog/short-sales-cycle). The source does not say "I'll send you something"
  hurts.
- **U8 after plumbing**: see "What was built" 1-3.

## Tips as shipped
- **OBJ (13 new + 1 upgrade)**: founddmg (T1, "your claim and your call"), deductShock (T2, "the work on your
  insurance company's scope"; Spanish "el trabajo que aprobó su seguro", not the calque "el alcance de su seguro"),
  checkday x3 (T3; T4 with "loss-draft department"; T5 with the deductible out of check 1, "ask your insurance company",
  Spanish "valor real en efectivo"), adjmeet (T6), partial (T7, relabeled to her real question "So am I stuck with you
  now that they said no?", re-inspection first, then the 3 days in writing with a copy of the letter), coldfeet (T8),
  finaldone (T9, Spanish "¿Nos permite dejar el letrero en su jardín un par de semanas?"), latestorm (T10, "some limits
  are short"), checklist (T11, registration by company name, business line, a certificate of insurance), the city
  permit (T12, for chaser, checklist, retiree; business line, never "office"), No Soliciting (T13, "mark it Do Not
  Knock in the app"; Spanish label "¿Qué no vio el letrero de 'No se aceptan vendedores'?"), and "Is this legal?" now
  gives the DOI consumer line 1-877-564-7323 in English too (T14, for recien + checklist).
- **PRO (1)**: watch-from-the-yard (T16), also in `data/door_lines_pro.json`. The PLAY line "Walk the roof together /
  Venga conmigo a ver el techo" became "Watch from the yard / Si quiere, véalo desde el patio" (page + data file).
- **PLAY (2)**: the itemized list goes to both (T20, 44-8606); talk to the one who decides (T21; source RISMedia only).
  Both also in `data/spanish_sale_playbook.json`.
- **SKILL (5, now 4: T28 merged into top-15 card 4 in the v12 stack)**: doorbell camera (T25; 69-1602 applies at the speaker; the Lenny Gray page never mentions doorbells, so
  this drill is labeled role-play realism; model answer trimmed to 37 words), itemized both (T26, loc `itemized`), no
  work inside the 3 days (T27, loc `nostart`), ask before you answer (T28, loc `probe` = a question in the first two
  sentences; the 54.3% vs 31% stat is on https://www.gong.io/blog/sales-stats , not the objection-handling page),
  answer the one who decides (T29; model answers now say "su parte / your part" and the Spanish one is all Spanish).
- **Scorecard**: T30 became one sentence on the existing objection check ("For a stall or price objection, one
  clarifying question before answering is the strong move") instead of a new check id. T32 = the 10 checks above.

## Random homeowner mix (replaces `pick(REAL)`)
The old uniform pick gave Spanish scenes 18.5% and almost no after-the-knock moments. Now weighted by who opens Fremont
doors, by season, and never the same mystery homeowner twice in a row:
- Spanish-first ~13% (12.0% of owner households are Hispanic; 15.8% speak Spanish at home), of which 7% must switch to
  Spanish (rogelio 4 + consuelo 3; 7.0% speak Spanish and English less than very well).
- Renter / manager / HOA ~8% (38% of homes are rented, but the walk targets owner homes, so renters are leakage;
  townhomes are 7.5% of housing).
- About 29% of picks are 60+ homeowners (a third of owners are 65+); retiree has the biggest single weight (6).
- In season (Apr-Sep): door 46 / journey 25 / cash 21. Off season (Oct-Mar, round 52): cash rises to 40, Spanish stays 13.
- checklist in season is 2.5 (realism fix, was 3.5), so the in-season weights sum to 99; they are relative weights.
- Measured on the built page (20,000 picks, September): Spanish 12.9%, retiree 5.7%, founddmg 5.5%, 0 repeats.

## Cut, and why
From the plan (before the build):
1. "How have you been?" opener (Gong cold calls): B2B phone data; at a stranger's door it fakes familiarity and delays the 69-1602 name + HMP + what we sell.
2. Price-at-the-3/4-mark and budget-early stats (Gong): enterprise B2B; cash scenes already ask "what number did you have in mind".
3. "Bilingual reps close 3x" (Babbel, Language Testing): vendor marketing; rogelio's Spanish check already scores the switch.
4. Financing scene and the financing add-on to "too expensive" (72%, FICO 580+, -40%): vendor numbers, and HMP has no confirmed lender (T109/T110, ITIN question open). PRO "objection-price-afford" already covers it legally.
5. Warranty "will you be around in 5 years?" scene: needs the boss's workmanship warranty terms (hub D15, PRO_ON_HOLD). Retiree and chaser already test local proof.
6. "Franquicia vs deducible": Mexican Spanish insurance talk uses "deducible"; the PLAY rule to always say "deducible" stays.
7. "You have up to 2 years" / "most policies 12 months": policy-specific; Kenny never states a number (S10 now says "some limits are short, check this week").
8. "RESPA: lenders release in 5 business days", "attending cuts partial denials 20-30%", "wrong spouse = 60% lost": no checkable source.
9. "44-8605 forbids AOB": wrong reading. 44-8605 regulates post-loss assignments. HMP's rule (contingency agreement) is no assignment and never on the check, and the scenes use that.
10. "No peddler permit needed in Fremont" (field scout): contradicted by Fremont Ordinance 3970 (city_rules.json). Kenny carries the permit.
11. Kid answers the door, angry neighbor, loose dog: no sources, or they're safety calls rather than sales talk. Better as a crew safety note.
12. Knock-time and weather tips: they belong in the HMP App walk, and "4-7 PM" clashes with Omaha's 8 AM-6 PM permit hours.
13. "80% need 5+ touches / 44% quit after one": a widely repeated marketing stat that can't be verified. Follow-up lives in the app (T82); U7 scores the next step.
14. Separate scenes for "wait for the adjuster", "photos first", "cosmetic", "matching", "code upgrade", "reinspection": merged into adjmeet, partial, latestorm and agentwait. Matching and ordinance-or-law are policy questions for the insurer.
15. Frida (mother-in-law), La Abuela and Kid Translator as their own scenes: merged into losdos plus the new PLAY line. Consuelo covers the absent son.
16. Margaret (1938 widow): folded into U5 (oldhouse gets pre-1940 houses).
17. Duplex renters: renter and rental already cover them, and the data went into the mix.
18. Registration-lookup and Google-check scenes: merged into checklist.
19. New rejection-resilience drill: it already exists (drill-ratio-not-streak).
20. "$200 per referral" yard-sign idea: breaks HMP's thank-you-only rule and is risky under 44-8604 (and the FTC review rule).
21. "A 1/3 deposit is typical": HMP's deposit is the boss's call. Scenes only say "never full payment up front; the schedule is in writing" (PLAY already says it).
22. Registration number on cards: the number is still pending from the boss. Lookup goes by company name for now.

From the verifiers (during the build):
23. T15 PRO (itemized before work): duplicate of T20 (PLAY) and T26 (drill), same sentence. PRO is the trainer-sourced door-line set (open/trust/obj/book/close), and a pre-work line doesn't belong there.
24. T17 PRO (permit in hand): word for word T12 (same English, same Spanish).
25. T18 PLAY (city permit): same Spanish as T12, and OBJ already shows in Spanish mode.
26. T19 PLAY (who the check goes to): duplicate of T3 (same Spanish sentence, "HMP nunca va en el cheque").
27. T22 PLAY (the deductible is in the contract): duplicate of T2's Spanish. Its wording "la parte del dueño" also failed dedTalk, so Kenny would have been marked wrong for saying it (dedTalk now accepts it anyway).
28. T23 PLAY (their 3 days, as a fact): duplicate of T8 (same Spanish).
29. T24 PLAY (WhatsApp or text): a real need, but it depends on an ops fact (WhatsApp Business on the business line), and a PLAY_ON_HOLD list for one line is dead code. Parked in `docs/memory/questions-for-filthe.md`.
30. T31 SCORECARD (talk share): the homeowner is capped at 30 words, so Kenny's share is inflated by design; the source is B2B phone calls; another number on an ADHD-friendly card that never gets scored. Noise, not help.
31. T30 as its own scored check ("probe"): the objection check already covers it, and "a ? in the first two sentences" is a weak backup ("Does that make sense?" passes). Kept as one sentence on the objection check; the drill (T28) later merged into top-15 card 4 (v12 stack).
32. S5's "You're licensed, right?" and "deal with my insurance for me" tests: duplicates of chaser's and agentwait's tests. Replaced by "Do I have to put money down to get on your list?".

## For the boss / FilthE later (don't block v12)
- Does HMP's business line have WhatsApp Business? (unlocks the parked T24 PLAY line) - added to questions-for-filthe.md.
- Is HMP an EPA Lead-Safe Certified Firm with a certified renovator (RRP; any pre-1978 painted siding job)? Until
  then no "lead-safe certified" line anywhere - added to questions-for-filthe.md.
- A certificate of insurance ready to send (T11 promises "a certificate of insurance we can send you").
- The Fremont solicitor permit renews every 30 days: a reminder in the app. T12 is only true while it is current.
- **Correction needed in print**: Claims 101 says "Nebraska claim deadlines are measured in years, not days". That is
  the lawsuit window (44-357 / 25-205); most policies limit reporting to about 12 months (sometimes 24). Suggested:
  "Your policy sets how long you have to report a claim, and some limits are short. Check yours soon. We never rush you."
  (`docs/print/claims-101.html` line 173; a separate change.)
