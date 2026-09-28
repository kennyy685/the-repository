# Legal pack template (T207)

One "pack" per state HMP could ever sell insurance-restoration work in. The app loads a pack by
state so every screen shows the right words, the right form, and the right waiting period without
anyone re-typing law. Nebraska is filled in below as the working example; new states copy the same
field list.

**Where the pack lives in the app (proposed):** `hailhunter/legal_packs/<state>.json`, one file per
state, loaded by whatever screen needs it (contract screen, door script, cancel-form generator).
`hh.py` gets a `legal_pack_check` command that fails loudly if a required field is missing or a
statute cite is missing its "VERIFIED"/"UNVERIFIED" tag - never let an unverified state silently
reach a homeowner-facing screen.

## The fields

| Field | What it holds | Where the app uses it |
|---|---|---|
| `state`, `updated`, `status` | Two-letter code, date last checked, `VERIFIED` / `UNVERIFIED` | Header banner on any legal-pack-driven screen; app refuses to show homeowner-facing copy for an `UNVERIFIED` state without a visible warning |
| `door_opener_rule` | The exact words the law requires be said first at the door (name, company, purpose) + statute cite | Knock screen's opening-line prompt |
| `cancel_rule` | Cancel window length, what triggers the clock, any storm/claim-denial extension, statute cite | Contract screen countdown; the "can we start work" gate |
| `cancel_form` | Required caption/heading, minimum type size/boldness, languages required, statute cite | The cancel-form generator (PDF/print) |
| `pre_work_waiting_rule` | Whether work may start before the cancel window ends, and any exception, statute cite | Job-scheduling screen's earliest-start-date guard |
| `itemized_estimate_rule` | When an itemized description must go to homeowner + insurer, what it must contain, statute cite | Claims workflow's "send estimate" step |
| `deductible_rule` | Exact banned-conduct language (waive/rebate/absorb/cover), statute cite, penalty if known | Every banned-phrase filter (see below) and the sales-script screen |
| `registration_or_license` | Which word applies (`registered` vs `licensed`), the actual credential name, agency, statute cite | Anywhere the app prints HMP's own credential; the banned-phrase filter (never let the wrong word slip for a given state) |
| `public_adjuster_limit` | The "we don't negotiate your claim" boundary, statute cite | Claims-conversation screen's boilerplate |
| `assignment_of_benefits` | Whether AOB is restricted/banned/requires specific notice, statute cite | Contract-signing screen, if HMP ever uses an AOB form |
| `door_to_door_permit` | Statewide permit rule if one exists, else "local only - check city" | Onboarding checklist per new market |
| `banned_phrases` | A short list of phrases never to say/print in this state, each tied to the rule it violates | Real-time script/message linting (future) |
| `sources` | Every statute URL and fetch date used to fill the pack | Shown on the header banner's "verify" link |

## Nebraska, filled in

```json
{
  "state": "NE",
  "updated": "2026-09-28",
  "status": "VERIFIED",
  "door_opener_rule": {
    "text": "At the outset, clearly and expressly disclose your individual name, HMP Siding & Roofing (the business you represent), and what you're offering to sell - before anything else.",
    "cite": "Neb. Rev. Stat. 69-1602"
  },
  "cancel_rule": {
    "window": "3 business days",
    "starts_at": "the LATER of (a) the day the written contract is signed, or (b) the day the homeowner gets written notice from their insurer that all/part of the claim isn't covered - insurance-paid jobs only",
    "general_home_solicitation_window": "3 business days after signing (non-insurance sales)",
    "cite": ["Neb. Rev. Stat. 69-1604 (general)", "Neb. Rev. Stat. 44-8603 (insurance-paid work, claim-denial extension)"]
  },
  "cancel_form": {
    "caption": "BUYER'S RIGHT TO CANCEL",
    "type_spec": "capital and lowercase letters, not less than 10-point boldface type",
    "languages": ["English", "Spanish - required whenever the seller regularly uses Spanish in advertising, forms, or face-to-face negotiation with the buyer"],
    "cite": "Neb. Rev. Stat. 69-1604(1) and (3)"
  },
  "pre_work_waiting_rule": {
    "rule": "No work may begin on a non-insurance home-solicitation sale until the 3-day cancel window has run. If the seller performs services before cancellation, the seller is NOT entitled to any compensation for that work.",
    "cite": "Neb. Rev. Stat. 69-1606(5)"
  },
  "itemized_estimate_rule": {
    "rule": "Before repair/replacement work starts on an insurance-paid job, give the homeowner AND the insurer an itemized description of the work, materials, labor, fees, and total amount agreed to be paid.",
    "cite": "Neb. Rev. Stat. 44-8606"
  },
  "deductible_rule": {
    "banned_conduct": "Promising to rebate any portion of an insurance deductible as an inducement to the sale - includes any allowance, discount, or compensation to the insured or anyone associated with the property (except nominal-value items).",
    "cite": "Neb. Rev. Stat. 44-8604",
    "contract_notice_required": "Any contract/estimate/work order for insurance-paid work must carry a signed, 14-point capitalized notice of this rule, sent to the insurer before payment.",
    "notice_cite": "Neb. Rev. Stat. 44-8607",
    "violation_effect": "Contract is void.",
    "violation_cite": "Neb. Rev. Stat. 44-8608"
  },
  "registration_or_license": {
    "word": "registered",
    "never_say": "licensed / licenciado",
    "credential": "Nebraska Contractor Registration (Dept. of Labor)",
    "cite": "Neb. Rev. Stat. 48-2101 to 48-2117 (Contractor Registration Act)",
    "note": "Registration # is pending for HMP; print materials keep a blank line until issued."
  },
  "public_adjuster_limit": {
    "rule": "Never negotiate a homeowner's insurance claim - that requires a public-adjuster license HMP does not hold. Document damage and meet the adjuster; don't argue the settlement.",
    "cite": "practice rule, tied to Nebraska's public-adjuster licensing chapter (not yet pulled into docs/legal/ - flag for a follow-up round)"
  },
  "assignment_of_benefits": {
    "rule": "HMP does not use assignment of benefits. If one is ever considered: must name HMP as copayee only (not full assignee), go to the insurer within 5 business days, carry the required capitalized notice, and can't impair a mortgagee's interest or block insurer-homeowner communication.",
    "cite": "Neb. Rev. Stat. 44-8605"
  },
  "door_to_door_permit": {
    "rule": "No statewide permit; permits are per-town. HMP already holds the ones it needs for current towns.",
    "cite": "local ordinance, not state statute"
  },
  "banned_phrases": [
    {"phrase": "we'll cover/waive/rebate your deductible", "violates": "deductible_rule"},
    {"phrase": "insurance will pay for this", "violates": "no promising insurance pays (practice rule)"},
    {"phrase": "we'll handle/negotiate your claim", "violates": "public_adjuster_limit"},
    {"phrase": "licensed contractor / contratista con licencia", "violates": "registration_or_license (NE uses registered/registrado)"}
  ],
  "sources": [
    "https://nebraskalegislature.gov/laws/statutes.php?statute=69-1602",
    "https://nebraskalegislature.gov/laws/statutes.php?statute=69-1604",
    "https://nebraskalegislature.gov/laws/statutes.php?statute=69-1606",
    "https://nebraskalegislature.gov/laws/statutes.php?statute=44-8603",
    "https://nebraskalegislature.gov/laws/statutes.php?statute=44-8604",
    "https://nebraskalegislature.gov/laws/statutes.php?statute=44-8605",
    "https://nebraskalegislature.gov/laws/statutes.php?statute=44-8606",
    "https://nebraskalegislature.gov/laws/statutes.php?statute=44-8607",
    "https://nebraskalegislature.gov/laws/statutes.php?statute=44-8608",
    "48-2100 to 48-2117 (Contractor Registration Act) - see docs/legal/48-2100-contractor-registration-act.txt"
  ]
}
```

All Nebraska text above is read from statute text already saved in `docs/legal/` (fetched directly
from nebraskalegislature.gov). Nebraska's public-adjuster-license limit still needs its own
statute pulled into `docs/legal/` - it's stated here as a practice rule, not yet a verified cite.

## The other 9 states (from T207's verification pass)

None of the other 9 candidate states (IL, TX, KS, OK, MO, CO, IN, MN, SD) could be verified against
primary statute text in this environment - `nebraskalegislature.gov` is reachable, but every other
state's official legislature/statute site (ilga.gov, statutes.capitol.texas.gov, ksrevisor.gov,
oklegislature.gov / oscn.net, revisor.mo.gov, leg.colorado.gov, iga.in.gov, revisor.mn.gov,
sdlegislature.gov) came back `EGRESS_BLOCKED` for both WebFetch and curl. All 9 are marked
**UNVERIFIED** - compiled from 2+ agreeing secondary sources (Justia, FindLaw, state AG/agency
pages, trade press) each saved to `docs/legal/<state>-summary.txt` with the exact caveat and every
source URL. Two cites were corrected mid-round after a first search pass returned a wrong statute
number (Oklahoma's deductible rule and Indiana's deductible rule) - a reminder that even the
"confident" secondary-source cites need a real read of the .gov text before they go in front of a
homeowner or into a contract. Do not build a state's pack from these summary files alone; treat
them as a shortlist of what to go re-verify first, next time the network allows it or someone reads
the statute by hand.

Headline finding for FilthE, not a new state to chase yet: everything on the 9-state list follows
the SAME shape as Nebraska (deductible rebate ban, 3-day home-solicitation cancel right, a
contractor credential, door-to-door permits handled locally not statewide) - two real differences
worth remembering if HMP ever expands: **Illinois and Minnesota require an actual roofing LICENSE**
(exam + bond), not just registration like Nebraska/Kansas/Oklahoma/Colorado/Missouri; and **South
Dakota's deductible law voids the whole contract** on violation (harsher than Nebraska's same
remedy) and layers a 72-hour claim-denial cancel right on top of the usual 3 days.
