# T174 (round 47): door-opener audit vs. Nebraska 69-1602

QA pass over every live door-opener in the app and in print: does the salesman's name, "HMP" (Siding
& Roofing), and what we sell come out **first**, before any storm/hail hook, question or offer?
Checked against `docs/legal/69-1602.txt` ("the seller shall, at the outset, clearly and expressly
disclose the seller's individual name, the name of the business firm... and the identity or kind of
goods or services he offers to sell"). Also swept for "licensed/licenciado", deductible-covered/
waived language, "free roof", and "insurance will pay" claims. Audit only - nothing edited.

## Openers checked

| # | File : line | Lang | Pass/Fail | Why |
|---|---|---|---|---|
| 1 | `pages/hmp-app.html:2999` (`NSX.en.said.doorIns`) | EN | **FAIL** | No individual name; disclosure order broken (see Finding 1) |
| 2 | `pages/hmp-app.html:3000` (`NSX.en.said.doorCash`) | EN | **FAIL** | Same |
| 3 | `pages/hmp-app.html:3089` (`NSX.es.said.doorIns`) | ES | **FAIL** | Same |
| 4 | `pages/hmp-app.html:3090` (`NSX.es.said.doorCash`) | ES | **FAIL** | Same |
| 5 | `pages/hmp-app.html:4359,4364` (`HO_MSG.hi`, the "send report" text) | EN/ES | PASS | Follow-up text to an existing lead, not the first door disclosure; names the rep first |
| 6 | `pages/hmp-app.html:2923` (48h follow-up text template) | EN/ES | PASS | Follow-up, names the rep first |
| 7 | `data/door_lines_pro.json:5-6` `opener-compliant-general` | EN/ES | PASS | name + HMP + what we sell, then hook, then ask |
| 8 | `data/door_lines_pro.json:13-14` `opener-storm-neighbor` | EN/ES | PASS | Same order |
| 9 | `data/door_lines_pro.json:21-22` `opener-everyday-age` | EN/ES | PASS | Same order |
| 10 | `data/spanish_sale_playbook.json:4` "First words at the door" | ES | PASS | Correct order, formal "usted" |
| 11 | `pages/practice-door.html:1358-1360` (pro-line library, word-for-word copy of #7-9) | EN/ES | PASS | Matches the compliant data file |
| 12 | `pages/practice-door.html:1887` (AI grading rule for the trainee's first line) | - | PASS | Correctly FAILs the trainee if name, HMP, local, or what-we-sell is missing from the first line |
| 13 | `docs/print/first-knock-day.html:138,229` | EN/ES | PASS | name + HMP + what we sell, then storm hook |
| 14 | `docs/print/wind-playbook.html:226,352` | EN/ES | PASS | Same order, real names (Kenny Cruz / Alex Mendez) |
| 15 | `docs/print/pocket-card/pocket-card.pdf` p.1 "OPEN" / p.2 "ABRA" | EN/ES | PASS | Labeled "First thing at every door - NE law 69-1602"; correct order |
| 16 | `data/commercial_bid_kit.json:15-16` | EN/ES | PASS | "At the start, say your name, HMP, and that you're there to document..." |
| 17 | `docs/print/door-hanger.html`, `door-hanger-everyday.html` | EN/ES | N/A (pass) | Left-behind notice for a no-answer door, not a spoken sale; HMP name/logo is the headline |
| 18 | `data/followup_scripts.json` (all touch 1-3, door/phone/business_phone) | EN/ES | PASS | Follow-up after first contact, not the opener; phone lines name Kenny/Alex first |
| 19 | `data/objection_scripts_2.json`, `data/practice_drills.json` | EN/ES | PASS | Mid-conversation objection handling and drill criteria, not openers; drill criteria correctly encode 69-1602 |

**No hits** anywhere in `pages/*.html`, `docs/print/*.html` or `data/*.json` for "licensed/licenciado"
as a claim about HMP (every hit is either the correct "registered/registrado" instruction, or inside
Practice Door's red-flag detection regex / a trainer's "don't say this" list - the audit's own
carve-out for rules forbidding the phrase). No hits for "free roof", "we cover/waive/rebate the
deductible", or "insurance will pay" as a real claim - same carve-out applies to the rule text that
forbids them.

## Findings, most serious first

### 1. FAIL - the app's live door opener drops the salesman's name and says the storm hook before what HMP sells (`pages/hmp-app.html:2999-3000, 3089-3090`)

This is the actual "Say" line shown to the salesman in two places: the per-lead Sale Guide "Next
step" card (`nsSay`, called at line 3282) and the "At the door" sheet shown before knocking on a
walk house (`doorGuide`/`renderGuide`, called at line 5278) - i.e. it is the literal words the app
puts in front of Kenny or Alex at the door, right under the "First, by law" reminder
(`W.law` at line 4825/4870: *"Say your name, HMP, and what you sell, first thing (NE 69-1602)."*).

Current EN (`doorIns`, line 2999):
> "Hi, I'm with HMP Siding & Roofing, a registered contractor from Fremont. We are checking homes on
> this street after the recent storms. We're doing free inspections for the neighbors. Can I take a
> quick look at your roof and siding?"

- **The individual seller's name is never said.** 69-1602 requires "the seller's **individual
  name**" at the outset, not just the firm name. `SETTINGS.people.en.first` ("Kenny") /
  `SETTINGS.people.es.first` ("Alex") exist and are already used this exact way elsewhere in the
  same file (line 2923: `'Hi {first_name}, this is ' + SETTINGS.people.en.first + ...`; line 4359:
  `` `Hi ${n}, this is ${SETTINGS.people.en.first} with ${SETTINGS.company.name}.` ``) - the door
  opener is the one place in the file that forgot it.
- **The storm hook comes before what HMP sells is stated plainly.** "We are checking homes... after
  the recent storms" (the hook) sits ahead of "roof and siding" (buried in the closing question).
  Compare the compliant line already in this codebase, `data/door_lines_pro.json`'s
  `opener-compliant-general` (used verbatim in Practice Door, and even in the printed pocket card
  the same salesmen carry): name + firm + "we do siding and roof repair and replacement" *first*,
  then the hook, then the ask. `doorCash` (line 3000) and both Spanish lines (3089-3090) have the
  same two problems.
- Everything else in the line is legally fine (says "registered," not "licensed"; "free
  inspections" not "free roof"; no deductible or insurance-pays claim).

**Confirmed by reading the source** (not by running the app): `nsSay` (line ~3282) and `doorGuide`
(line ~5278) both call `S.doorIns(r)`/`S.doorCash(r)` from `NSX.en.said`/`NSX.es.said`, and those are
the exact strings at lines 2999-3000 and 3089-3090. `SETTINGS.people.{en,es}.first` are defined at
line 1198 and already used the same way at lines 2923 and 4359/4364.

### 2. No other legal defects found

Every other door opener, objection line, follow-up script, print piece and Practice Door reference
line checked out fine on 69-1602 order, "registered" vs. "licensed," and the deductible/insurance-pay
rules. Practice Door's own grading logic (line 1887) already independently enforces the same rule
that the live app opener is currently breaking, so the training tool and the compliance rule are
correct - only the app's actual script text is wrong.

## Fix list by owner

### Builder (`pages/hmp-app.html`)

Fix all four lines to name the rep first and state what HMP sells before the hook, matching the
compliant pattern already in `data/door_lines_pro.json` and the pocket card. Suggested replacements
(keep the `${r || '...'}` hook mechanism as-is; only reorder and add the name):

- **Line 2999 (EN `doorIns`):**
  `` r => `Hi, I'm ${SETTINGS.people.en.first} with ${SETTINGS.company.name} — we do siding and roof repair and replacement, a registered contractor from ${SETTINGS.company.city}. ${r || 'We are checking homes on this street after the recent storms.'} We're doing free inspections for the neighbors — can I take a quick look at your roof and siding?` ``
- **Line 3000 (EN `doorCash`):**
  `` r => `Hi, I'm ${SETTINGS.people.en.first} with ${SETTINGS.company.name} — we do siding and roof repair and replacement, a registered contractor from ${SETTINGS.company.city}. ${r || 'We are working on older homes in this neighborhood.'} Can I give you a free estimate for new siding or a roof?` ``
- **Line 3089 (ES `doorIns`, usted throughout):**
  `` r => `Hola, soy ${SETTINGS.people.es.first} de ${SETTINGS.company.name} — hacemos reparación e instalación de techos y siding, contratista registrado de ${SETTINGS.company.city}. ${r || 'Estamos revisando casas en esta calle después de las tormentas recientes.'} Estamos haciendo inspecciones gratis a los vecinos — ¿puedo revisar rápido su techo y su siding?` ``
- **Line 3090 (ES `doorCash`, usted throughout):**
  `` r => `Hola, soy ${SETTINGS.people.es.first} de ${SETTINGS.company.name} — hacemos reparación e instalación de techos y siding, contratista registrado de ${SETTINGS.company.city}. ${r || 'Estamos trabajando en casas antiguas de este barrio.'} ¿Le puedo dar un presupuesto gratis para siding o techo nuevo?` ``

### Designer

No print-piece changes needed - every print opener checked (door hangers, first-knock-day, wind
playbook, pocket card) already gets the order right and can stay as the reference for the Builder's
fix above.

## Proposed `tests/legal_check.py` rule (not implemented - for FilthE/Builder to add)

The existing banned-phrase scan (Check 3) can't catch this class of bug: nothing here is a banned
word, it's a missing name and a wrong order. Suggested **Check 6, "door opener order (69-1602)"**:

1. In `pages/hmp-app.html`, extract the four arrow-function template literals with
   `re.search(r"door(?:Ins|Cash):\s*r\s*=>\s*` + "`" + r"([^`]*)" + "`" + r'"', ...)` once inside the
   `en:` block and once inside the `es:` block of `NSX` (or, more robustly, restrict the search to
   the `said:` object of each language block so it can't accidentally match an unrelated `doorIns`).
2. For each extracted string, **fail** if it does not contain a name token before the hook: look for
   `${SETTINGS.people.en.first}` (EN) / `${SETTINGS.people.es.first}` (ES) - or, if someone
   hardcodes a name later, any of `SETTINGS.people.en.name`/`.first`/`SETTINGS.people.es.name`/
   `.first`'s literal value - and require its string index to be **less than** the index of the
   `${r` hook interpolation in the same string. Missing the name token, or finding it after `${r`,
   is a failure with the file:line of the `doorIns:`/`doorCash:` definition.
3. Same check for any future `said.door*` entries other languages/kinds get added under.

This directly targets the exact shape of bug found here (name omitted, hook-before-disclosure) without
having to hand-parse full sentence grammar.

## Checks run

- `python3 tests/legal_check.py` - **PASS** (all 5 checks; as expected, does not catch Finding 1 -
  see proposed rule above).
- `python3 hh.py selftest` - **376 tests, OK**, including `test_legal_check.py`. (`numpy`/`pandas`/
  etc. were missing in this sandbox; ran `pip install -r requirements.txt` first, no repo changes.)
- `node tests/pages/shots.js` - **PASS**, all 3 pages x 2 sizes render with no JS error and no
  sideways scroll (some Google Fonts loads failed for lack of network in this sandbox - logged, not
  counted as failures per the script's own rule).
- `node tests/pages/design_gate.js` - `pages/hmp-app.html` **PASS** (198 views), `pages/practice-door.html`
  **PASS** (24 views). `pages/crew-hq.html` **FAILS** with 7 problems (1 contrast hit on the
  "Blocked" status chip, 6 tap-targets under 44x44px on `#langEn`/`#langEs` and three `<summary>`
  disclosure rows) - **out of scope for T174** (crew-hq isn't a door-opener surface) but real and
  worth a separate look before the hub's next publish; flagging it here rather than silently ignoring
  it since the design gate is mandatory on every review that touches `pages/*.html`.
