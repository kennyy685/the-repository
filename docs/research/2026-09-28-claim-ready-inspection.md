# Claim-ready inspection: the "damage I see" checklist (2026-09-28)

**Purpose:** a data checklist for the Knock screen so every inspection is adjuster-ready. Documentation only. HMP records what is there; it never gives a verdict, never negotiates a claim, never says insurance pays.
**Builds on** (not repeated): `2026-09-26-inspection-checklist.md` (walk order, safety, hail-vs-wear), `data/photo_checklist.json`, `data/inspection_walk.json`. This file adds the claim data layer: loss date, storm proof, homeowner/carrier info, per-item chips, denial map.

## Summary
- Adjusters decide on four things: was there a **storm on a known date**, is there **collateral evidence** at that size, are the marks **fresh hail (not wear/old)**, and is it **filed in time**. Each chip below feeds one of those.
- Biggest gaps vs. what the app has: date of loss + storm proof, homeowner/carrier block, "already repaired / prior claim" question, chip-level required-photo flags, hit count per test square recorded as a number.
- Nebraska: most policies set a claim-notice window (commonly 12 months, sometimes 24; unverified in an actual policy, so the app must say "check the policy"). The lawsuit deadline is 5 years from loss and a policy cannot shorten it (44-357; 25-205).

## What to work on next (ranked)
| # | Task | Who | Effort |
|---|---|---|---|
| 1 | Add "Claim basics" card at start of damage step: date of loss, date noticed, carrier, claim # (optional), roof age, prior claim/repair Y/N/unknown | Code | S |
| 2 | Auto-attach storm proof: nearest SPC/NWS hail report (date, time, size, miles away) from the engine to the house; show "reported" vs "not reported nearby" honestly | Code | M |
| 3 | Chip list per section below, with photo-required flags and a "not seen" tap (a checked "none found" is evidence too) | Code + Designer | M |
| 4 | Test-square counter: one tap per hit, per slope, stores count + photo; no verdict text | Code | S |
| 5 | Completeness meter: "Adjuster-ready 9/12" using only the required photos (no coaching text) | Designer + Code | S |
| 6 | Export "Damage Report" PDF (EN/ES) for the homeowner; adjuster copy goes from the homeowner/HMP per 44-8606 | Code | M |
| 7 | Boss: confirm the carrier-facing wording HMP is comfortable sending; registration # on the report | Boss | S |

## The checklist (walk order)
Chip label EN / ES. **Photo:** R = required, O = optional. "Why" = what the adjuster cares about. Each chip also has a "Not found" state.

### A. Claim basics (ask, do not assume)
| Chip EN / ES | Photo | Why the adjuster cares |
|---|---|---|
| Date of storm / Fecha de la tormenta | no | Ties damage to one covered event; policy period and notice clock start here |
| Date homeowner first noticed / Fecha en que lo notó | no | Shows prompt notice; a long gap invites "late filing" |
| Insurance company / Aseguradora | no | Routes the report; some carriers have their own roof rules |
| Claim # (if filed) / Número de reclamo | no | Lets the adjuster match the file |
| Already filed? Y/N / ¿Ya reportó? | no | Sets whether HMP is documenting before or after the adjuster |
| Roof age (years) / Edad del techo | R: label or permit if visible | Age drives wear arguments and depreciation |
| Prior hail claim or repair on this roof? / ¿Reclamo o reparación anterior? | no | Old unrepaired damage is a top denial reason; "unknown" is a valid answer |
| Any leak now? / ¿Hay goteras? | no | Function vs. cosmetic argument |
| Temporary repairs done (tarp etc.) / Reparación temporal | R: before photo | Policies require preventing more damage; keep receipts (DOI [1]) |

### B. Storm proof
| Chip | Photo | Why |
|---|---|---|
| Storm reported nearby (auto: date, size, distance) / Tormenta reportada cerca | no (screenshot saved) | NWS/SPC local reports carry time, place and size; carriers check them [6][7] |
| Hail size seen by homeowner (pea, penny, quarter, golf ball) / Tamaño que vio | O | Gives a size when no report is close; approximate only [7] |
| Neighbors with the same damage (count) / Vecinos con daños | no | Area pattern supports the date |

Limit: NOAA reports are estimates (compared to coins/balls) and can be miles from the house, so the app should say "nearest report", not "confirmed at this address" [7].

### C. Ground and collateral (before the roof)
| Chip | Photo | Why |
|---|---|---|
| House number + address plate / Número de la casa | R | Ties every photo to this property |
| Wide shot each elevation (F/R/L/Back) / Foto amplia de cada lado | R x4 | Location context; direction of the storm |
| Gutters: round dents / Canaletas: abolladuras | R | Soft metal is the closest thing to a hail gauge; size and density show hail size and wind direction [2][3] |
| Downspouts: dents / Bajantes | R | Same, at ground level |
| Roof vents, caps, flashing dented / Ventilas y tapajuntas | R | Collateral on the roof itself |
| AC fins / condenser top / Aletas del aire acondicionado | R | Fins bend from hail; shows direction |
| Window screens torn/holed / Mallas de ventana | R | Cheap, common, and tied to storm date |
| Garage door, mailbox, fence, deck, grill cover / Puerta de garaje, buzón, cerca | O | More collateral at the same size |
| Cars in area with dents (not the customer's claim) / Autos con abolladuras | O | Area evidence only; do not photograph plates |
| Spatter marks fresh (clean marks on oxidized metal) / Marcas de salpicadura frescas | R | Fresh spatter fades in roughly 1-2 years; helps date the storm and estimate size [4] |
| Dent look: clean vs. dirt-filled / Abolladura limpia vs. sucia | R close-up | Dirt or grime in a dent suggests older damage [4] |
| Metal type (aluminum, galvanized, copper) / Tipo de metal | no | Dent size needed depends on metal [3][4] |

### D. Roof, per slope
Test square = 10 ft x 10 ft on each directional slope, away from trees and foot traffic; count hail hits, record type of damage [2].
| Chip | Photo | Why |
|---|---|---|
| Slope label (N/S/E/W or front/back) + pitch / Pendiente | R wide | Damage is directional |
| Material (3-tab, architectural, metal, other) / Material | R | Thresholds differ by material |
| Layers / Capas | O | Code and carrier rules |
| Test square hit count (number) / Golpes en cuadro de prueba | R: wide, medium, close with scale | Carriers use hits per square to decide repair vs. replace; thresholds vary by carrier, so record the number, no verdict [2][8] |
| Bruise / soft spot (felt by hand) / Golpe blando | R close | Counts as a hit only if the mat is bruised or fractured [2] |
| Granule loss with exposed mat / Pérdida de gránulos | R close | Functional damage |
| Fracture / crack / puncture / Fractura | R close | Functional damage |
| Not hail: blistering, wear, foot traffic, nail pops / No es granizo | R | Say what it is; honest notes protect credibility. Blisters are evenly spread with no bruise; wear is linear near valleys and vents [8] |
| Ridge/hip caps, valleys, flashing / Cumbreras y valles | R | Often the first to show damage |
| Chimney, skylights, pipe boots / Chimenea, tragaluces, botas | O | Collateral and leak points |
| Existing repairs/patches / Parches | R | Explains prior work; avoids "pre-existing" surprise |
| Wet, icy, steep or unsafe: not walked / No se subió | no | Records why a square is missing (safety) |

Chalk: sources split. Trade guides say circle one hit and show the mark in frame, or outline the test square [8][9]; HMP's earlier round warned some carriers read a fully chalked roof as altered evidence. Default: chalk or tape ONLY the 10x10 square being counted, never the whole roof; take a plain photo first. FilthE/boss can override.

### E. Siding, per elevation
| Chip | Photo | Why |
|---|---|---|
| Material (vinyl, aluminum, fiber cement, wood, other) / Material | R | Vinyl cracks around 1 in.+, fiber cement ~1.5 in.+ (prior round) |
| Cracks (crescent near fasteners) / Grietas | R | Classic vinyl hail sign; sharp edges = fresh [5] |
| Holes / punctures / Agujeros | R | Water entry |
| Chips on bottom edges / Astillas | R | Best seen from below [5] |
| Dents (aluminum) / Abolladuras | R, angled light | Circular dents; bare metal at creases means coating broken [5] |
| Chipped paint, hairline cracks (fiber cement) / Pintura astillada | R | Easy to miss; look at edges and joints [5] |
| Trim, fascia, soffit, corner boards / Molduras, fascia | R | Often damaged with siding |
| Count per elevation (0 / 1-5 / 6-20 / 20+) / Cantidad por lado | no | Density shows the storm's direction; chips faster than exact counts |
| Old or weathered damage (gray edges, no impact) / Daño viejo | R | Documented honestly so the adjuster sees the difference [5] |

### F. Windows, doors, wraps
| Chip | Photo | Why |
|---|---|---|
| Window wraps / trim dented or chipped / Molduras de ventana | R | Soft metal collateral |
| Glass cracks, seal failure (fog) / Vidrio agrietado | R | Separate line item; seal fog can be age |
| Screens (see C) | | |
| Door and garage door dents / Puertas | O | Collateral |

### G. Interior
| Chip | Photo | Why |
|---|---|---|
| Water stain on ceiling/wall (location) / Mancha de agua | R | Shows the loss was functional |
| Stain looks old (rings, mold) vs. fresh / Mancha vieja o nueva | R | Old stains trigger "pre-existing" |
| Attic decking wet/stained (only if homeowner allows access) / Ático | O | Hidden leaks |

### H. Photo rules (apply to every R)
1. Order: address plate, wide of elevation, medium of the area, close-up with scale (coin/tape) [5][8].
2. Location and time on: EXIF timestamp and GPS are the proof of when/where; app stores capture time itself [8].
3. One damaged item per close-up; one clean comparison shot next to a damaged one.
4. Photograph BEFORE any cleanup, tarp or repair [1][5].
5. No people's faces, no plates, no owner names.
6. Homeowner watches while photos are taken and gets the set.

### I. Measurements
Roof: squares or rough length x width per slope, pitch. Siding: wall length x height per elevation, minus openings. Gutter linear feet, downspout count. Store as numbers; they feed the itemized description (44-8606).

## Why claims get denied and how this checklist blocks it
| Denial reason | What blocks it |
|---|---|
| Old / pre-existing damage | Prior-claim question; fresh vs. dirty dents and fresh spatter; "old damage" chip with photo; honest notes [4] |
| Wear, blistering, mechanical | "Not hail" chip per square; hail pattern must appear on collateral too [8] |
| No collateral / not enough hits | Collateral section is required; test-square count recorded per slope; "not found" is stated, not hidden [2][3] |
| Late filing | Date of loss and date noticed are the first two fields; app shows "check your policy notice window" (12 months is common, some 24, verify in policy) [6] |
| Cosmetic-only argument | Function chips (granule loss, fracture, leak, seal) separate from dents [8] |
| Weak documentation | Required-photo meter, timestamp/GPS, scale in frame |
| Repairs before adjuster | Before-photos and receipts for any temporary repair [1] |

## Legal lines built into the screen (Nebraska)
- The report says "damage observed", never "covered" or "insurance will pay". No verdict on repair vs. replace.
- We may meet the adjuster and show photos; we do not discuss the amount or argue coverage (public-adjuster law).
- 44-8604: no deductible language except the required notice; 44-8607 notice goes on any insurance-paid contract.
- 44-8605: no assignment of benefits: the report must not carry a "direction to pay" field.
- 44-8606: before work, homeowner AND insurer get the itemized description (work, materials, labor, fees, total).
- Say "registered". Leave the registration # line blank until issued.

## Unverified / open
- The 12-month notice window comes from contractor and lawyer blogs, not a policy or the DOI page. Verify with a real Nebraska policy before printing any number [6].
- Hit-count thresholds (e.g. 8 per square) vary by carrier; the app must not show one.
- Nebraska DOI PDF (HailDamage_0.pdf) could not be text-extracted (no pdftotext); the DOI web page carried the same advice and was used.
- HRTI and Gorilla Roofing pages blocked or only seen as search summaries; chalk practice rests on trade summaries [8][9].
- 44-8607 phrasing: the notice must be signed by the insured and sent to the insurer (docs/legal text).

For FilthE: ask the boss one thing only he knows: what wording HMP is OK putting on a report that goes to a carrier (photos + counts only, or notes too).

## Sources (opened)
1. Nebraska DOI, Hail Damage: Does My Roof Need Repair? - https://doi.nebraska.gov/hail-damage-does-my-roof-need-repair
2. Haag, Test Square Method - https://haagglobal.com/featured-post/testsquaremethod/
3. InterNACHI, Mastering Roof Inspections: Hail Damage Part 7 - https://www.nachi.org/hail-damage-part7-34.htm
4. Brush Claims, All About Hail Spatter - https://brushclaims.com/blog/adjusters/all-about-hail-spatter/
5. Crown Exteriors, How to Inspect Siding After Hail - https://www.crownexteriorsllc.com/how-to-inspect-siding-after-hail/
6. Property Insurance Coverage Law Blog, Nebraska time limit (44-357, 25-205) - https://www.propertyinsurancecoveragelaw.com/blog/time-limit-for-filing-lawsuit-in-nebraska-related-to-insufficient-nonpayment-your-property-damage-claim/ ; policy notice windows from search summaries (ericluebbe.com, goodliferoofs.com), not opened
7. HailByAddress, Methodology and limits - https://hailbyaddress.com/methodology/ ; SPC reports https://www.spc.noaa.gov/climo/online/ and NCEI Storm Events https://www.ncei.noaa.gov/stormevents/ (search summaries)
8. Search summaries only: HRTI, Gorilla Roofing, Econo Roofing photo guides; SPJ Adjusting and Reliable Roofing denial-reason pages
9. Same as 8 (chalk practice)
10. Statutes: docs/legal/44-8604, 44-8605, 44-8606, 44-8607, 44-357 (nebraskalegislature.gov)
