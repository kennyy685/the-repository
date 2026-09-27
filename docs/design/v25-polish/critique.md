# HMP App v24 → v25: design critique and polish plan

Designer, 2026-09-26. Input: live v24 (`pages/hmp-app.html`), harness renders at 390x844 (EN/ES, light and dark),
FilthE's three photos from his Mac. Mockups: `now.html`, `knock.html`, `lead.html`, `money.html` (states by hash:
`#dark`, `#es`, `#loading`, `#empty`, `#late`). System: `design-system.md` + `ds.css` + `icons.js`.
Before shots: `before/`. After shots: `after/`.

**One-line verdict.** v24 works, but it reads like a prototype. It uses 21 font sizes, 107 hex colors,
32 shadows and 10 corner radii, mixes text glyphs (⇄ → ✓ ⋯) with SVG icons, and has no working dark theme. Every
screen says each fact two or three times. The fix is mostly subtraction plus one strict system.

## What FilthE saw on his Mac (the photos), and the cause

| Photo | What he saw | Cause in the code | Fix |
|---|---|---|---|
| All 3 | Muddy grey-purple app | claude.ai stamps `data-theme="dark"`. v24's dark block is the old "Pro Dark" set and never got the Ledger tokens. Where the page is transparent, claude.ai's purple ground shows through. | Real dark twin "Ledger Night" (`ds.css`): neutral graphite, and every token is redefined. |
| All 3 | Blank white boxes: the button next to ES, the center **+**, the first List/Map segment, "Done for today" | These controls hard-code `color:#fff` on `background:var(--ink)`. In dark, `--ink` turns light, so the text is white on white. Reproduced in the harness: `#langEn`, `#kViewNext`, `#tDone`, the + tab. | New token `--on-ink` (white in light, graphite in dark). Never hard-code `#fff`. |
| 1 | Flat red polygon with zigzag dots, "Near Fremont" label while the zone is Columbus, 45 mi away | The map draws only the walk hull and raw stop points in walking order, which cross the street each time. It has no streets, lots, "you" dot or scale. The caption is the user's town, not the zone's. | Real vector map from the engine basemap, below. |
| 2 | Wall of red text "Outside knock hours…" | A full rules paragraph shown as an alert | One calm chip: "Outside knock hours · only booked visits ›". Tap it for the rules. |
| 2 | Two "…" menus stacked, "Built 1980" twice, "PASS 1 OF 3 · 25 LEFT THIS PASS" | The walk menu and the app menu both use ⋯. The house line and the why line repeat the year. "Pass" is system language. | One ⋯ (walk menu). The avatar "K" is the app menu. Each fact appears once. "Stop 3 of 12 · 10 to go". |
| 3 | Money empty = 8 boxed paragraphs | The claim explainer is dumped as the empty state | A tight vertical stepper (8 icons, one line each) and one CTA, "Log a signed job". |
| 1-3 | "Right Hand" pill floating over cards | `position:fixed` FAB | A composer docked above the tab bar (Now, Leads, Money). On Knock it moves to a mic in the top bar, so the four answer buttons own the thumb zone. |

(The blue robot at the right edge of his screen belongs to claude.ai, not to our page. We can't remove it.)

**Theme decision.** Light "Ledger" is the reference and the default for the phone in daylight. The app follows the
viewer's choice, and his Mac asks for dark, so dark ships as a full twin rather than an afterthought. More (avatar)
gets Theme: Auto / Light / Dark, stored per device, default Auto.

## The map, redesigned (drawn from the engine's real basemap, Columbus 22 St & 21 St)

Data: `data/columbus.js` = the engine output of 2026-09-26 (12 zones, 12 Columbus walks with `basemap`
{bbox, streets, lots, labels}, today's walk with 25 stops), trimmed. Renderer: `walkmap.js`, with no tiles and no
libraries. The builder reuses it as-is.

- `renderZoneMap(svg, {zones, walks}, opts)` (Now): stitches every walk's basemap into one town view. It draws faint
  lots, streets with casing (major roads warm) and de-duplicated street names with collision checks. Each zone's hull
  is a blurred heat whose strength follows `zone.heat`. Ranked pins show 2-12. The featured zone gets a dashed
  outline plus an HTML pin ("1 · 22 St & 21 St · 1.6″"), so pin, heat and card read as one thing. "You" is 45 mi away
  in Fremont, so it becomes an edge chip ("You: Fremont · 45 mi ›") instead of the wrong "Near Fremont" caption. The
  map also has a legend and a scale bar (500 ft).
- `renderWalkMap(svg, walk, opts)` (Knock): hairline lots, named streets and heat behind. **Each house is snapped to
  its street, so the route runs along 22nd St** instead of zig-zagging across it (that zigzag was the "WVW" in his
  photo). A tick connects each house to the street. Where two streets share no corner in the data, the hop is drawn
  as a light dashed line, never a solid line through yards. Stops: done = grey check, No = grey ×, current = orange
  with a halo, upcoming = outlined number. "You" stands on the street. Mini strip (118 px, 250 m across, centered on
  the next door) on Knock; the full walk behind the map button (`knock.html#map`).
- Options: `status[]`, `you {lat,lon}|{atStop}`, `center`, `metersAcross`, `fit`, `numbers`, `heat`, `r`. Both
  functions return `xy(lon,lat)` so the page can place HTML chips.
- **Two engine notes** (for the engine mechanic, not blockers): (1) the zone polygon for "22 St & 21 St" covers all
  60 homes down to 17th St, while the walk is the first 25 around 22nd/21st, so the Now outline looks bigger than
  the walk. Send the walk hull or `walk_center` for the pin. (2) 39th Ave has no segment between 22nd and 21st in the
  basemap, so the route hop from 2252 39 Ave to 21st St shows as a dashed gap.

## Word counts (visible text in the scrolling area, EN, 390 px)

| Screen | v24 words | v25 mockup | Target | Other v24 counts |
|---|---|---|---|---|
| Now | 239 | 145 (about 25 are street names on the map) | ≤130 text | 15 text styles, 16 buttons |
| Knock | 147 (+ rules banner in live data) | 108 | ≤120 | **26 text styles**, 14 buttons, 2 ⋯ menus |
| Leads | 187 | – | ≤120 | 3 chips + a red box per card |
| Money | 358 | 106 | ≤120 | 19 styles; the empty state is ~220 words |
| Lead sheet | **681** | 108 | ≤150 | **52 buttons**, "Step 2 of 8" shown twice |
| Claim sheet | 418 | – | ≤150 | "Adjuster meeting" heading twice |
| + sheet | 44 | – | ≤40 | fine |
| Right Hand | 46 | composer | ≤15 | explains itself in a paragraph |
| More | 36 | – | ≤36 | fine; add Theme |

## Screen by screen

### Now
- **Hierarchy:** the map is 300 px of nothing: two labels on grey, one of them cut off ("Fremont: E 16th St & N Li…").
  **Fix:** the vector map, with the zone card overlapping its bottom edge as an "offer card" (Uber Driver).
- **Repeated info:** "1.6 in hail · 6 homes · Sep 22" is followed by "1.6-inch hail on Sep 22; most homes built
  before 1980." **Fix:** three number tiles (1.6″ hail / 6 homes / 30 min to knock) and one why-line with only the
  new fact ("Most homes built before 1980, likely owner-lived").
- **Buttons:** Drive is an outlined box and "Apple Maps" is a bare underlined link on the same row, two treatments
  for one job. **Fix:** one "Drive" secondary button (car icon), which picks Apple or Google Maps inside. "Start
  knocking" is the only orange.
- **Label:** "Keep knocking" vs "Start knocking" is unexplained. **Fix:** "Start knocking" when the zone has 0 doors
  today, and "Resume · 2 of 25" once doors exist, so the number shows why the label changed.
- **Mono overuse:** "START HERE · 0.8 MI", "NOW · STEP 2 OF 8" and "Near Fremont / Simple map" all use letter-spaced
  mono caps, which reads like a dev tool. **Fix:** at most one mono label per card. Status goes in sans chips.
- **The Sale Guide card on Now** repeats the whole lead guide (Say/Collect/Guide button) under the fold. **Fix:** one
  "Today" row per appointment ("4:00 PM · Inspection · 615 N Linden Ave · Rosa", call icon). Tap it for the lead.
- **Due list:** type labels ("CLAIM", "LEAD") in mono beside addresses, "! Overdue 2 days · Sep 23" in mono red, and
  an inline door script inside the Due list. **Fix:** row = address / one action line / chip "2 days late" with a
  flag icon. Show 3, then "See all 5". Scripts live on the lead.
- **Badges:** every tab has a count badge (5, 10, 5, 4), so nothing stands out. **Fix:** one red badge, on Now, for
  late items only.
- **Empty/loading:** none designed. **Fix:** a skeleton in the same shapes (map block, card, 2 rows), and an empty
  state with "Checked today 6:54 AM", "No fresh hail within 120 mi" and "Knock old houses instead".

### Knock
- **26 distinct text styles on one screen.** **Fix:** the type scale in `design-system.md` (8 sizes, 3 weights).
- **The header** stacks the DOORS TODAY label, a ⋯, the giant 2, "of 25", a bar, 4 stats, the area name, a rules
  paragraph and an orange evidence box before the first door. **Fix:** area name + one ⋯ first, then one rules chip,
  then "2 / 25 knocks today" with talked/interested/booked as three right-aligned numbers, a 25-cell bar, and the walk
  map.
- **Unclear terms:** "Pass 1 of 3", "9 left this pass", "~2 hours left". **Fix:** "Stop 3 of 12 · 10 to go". Rounds
  (coming back to not-homes) show only when round 2 starts, as the chip "Round 2: not-homes from earlier".
- **Next door card:** "Hail proof" and ⋯ are grey boxes that look disabled, and "What to say" is a full-width orange
  outline competing with Booked. **Fix:** a row of three small secondary buttons (What to say · Hail proof · skip
  icon). The 2x2 answers get icon + word + hint: door/Not home, ban/No, star/Interested, calendar/Booked (the only
  orange).
- **"Then" list:** house numbers in a separate column look like a table with no header. **Fix:** a numbered circle
  that matches the map pin, address, and a one-line why.
- **Footer:** "Next door" + "5 call-backs due today" + a black "Done for today" + a "This week · 44 doors" row with
  broken wrapping. **Fix:** "Done for today" moves to the walk ⋯ menu and to + ("Done for today"). The week number
  lives in the evening review only.
- **ES:** the rules paragraph runs to 4 lines and the eyebrow wraps to 2. **Fix:** short ES labels ("Siguiente ·
  parada 3 de 12", "faltan 10"), shown in `after/knock-es.png`.

### + (Add)
- Good 2x3 grid, but orange icons on every tile break "one orange per screen", and the sheet header "What now?" with
  a boxed "Close" is heavy. **Fix:** ink icons in a soft 36 px tile, a title-only header with a round × button, and
  "Help me say it" first (most used at the door).

### Leads
- Each card = address (wraps to 2 lines at 26 px) + 1-3 chips + "Step 1 of 8" pill + "then inspection set" + a pink
  NEXT STEP box + "1 door visit · last Sep 23": 7 pieces for one lead. **Fix:** a list row: address 17 px / next
  action line / late chip. The source and type chips move into the lead. Filters (All/Storm/Everyday/Referral) become
  one segmented control under Due/Active/Won/Lost, or go into a filter button.
- The "Active" black segment + orange-bordered "All" chip = two selected styles. **Fix:** one `.seg` style.

### Money
- Four equal tiles plus a two-color bar plus a gold-bordered "To chase" box with ▶ triangles and 20 px colored
  sentences. There is no single figure. **Fix:** one hero figure ("Owed to HMP $19,040 on 2 open jobs", Stripe), a
  stacked bar with a 4-row legend (at the mortgage co. / held by insurer / homeowner deductible / supplement approved),
  "To chase" as list rows with chips, and claim cards with a 10-step mini progress bar and the next action.
- The deductible shows as money the homeowner owes. This is deliberate: it keeps 44-8604 visible, because the
  deductible is collected and never waived.
- **Empty:** replace the 8 boxed paragraphs with the vertical stepper. Orange-tinted icons mark the steps "you do";
  grey marks homeowner/insurer steps. It says "Their claim, not ours" and has one CTA.

### Lead sheet
- **681 words, 52 buttons on one sheet.** Step 2 of 8 appears in the header AND the guide card. "Close" is a
  48 px boxed button with an orange focus ring on open (`:focus` instead of `:focus-visible`). Reminder texts are
  printed in full twice. There are 14 photo slots inline, 8 text templates inline, and the estimate, homeowner
  report, details and door visits all expanded.
- **Fix:** header (address, name · city, 2 chips, round ×), then 4 quick actions (Call/Text/Directions/Photos 4), an
  8-segment stage bar with "next: inspection", and the **Next step card** (time chip, "Inspection · bring the ladder",
  orange "Start inspection" + calendar icon). After that, one guide card: Say (a single EN/ES switch for the whole
  card), Ask (2), Collect (3 of 5 as round checks, with an inline "Send" on the missing reminder). Then 3 closed rows
  (photos, estimate, notes and visits). Everything else opens from those rows.

### Claim sheet
- The italic "No next step yet. Tell the Right Hand what happens next." sits in a grey box on top. "Adjuster meeting"
  is the heading twice (date card, then checklist). Checkboxes are 44 px grey squares. **Fix:** the same layout as
  the lead (stage bar, next-step card with the adjuster date, and an "Add a time" button when the time is missing),
  the checklist as a closed row "Adjuster checklist · 0 of 14", and round 22 px checks.

### Right Hand
- A sheet that explains itself in a paragraph ("log doors, leads and claims, pass things to the crew…") plus two
  buttons that duplicate +. **Fix:** the docked composer ("Tell the Right Hand… 'knocked 20, 4 talked'" + mic).
  Replies appear as a toast with Undo, and the conversation opens only on tap.

### More
- Fine as a list. Add Theme (Auto / Light / Dark), and use the avatar "K" as its button so ⋯ means one thing only.

## Top 15 fixes, ranked by impact

1. **Dark theme + `--on-ink`:** fixes the blank buttons and the muddy look he actually sees (P0 bug).
2. **The vector map** on Now and Knock (streets, lots, route, numbered stops, you-dot, heat, legend, drive chip).
3. **Lead sheet cut from 681 to about 110 words:** next-step card first, the rest behind 3 rows.
4. **One type scale** (8 sizes, 3 weights), replacing 21 raw px sizes. Mono only for tiny labels.
5. **One icon set** (`icons.js`, 24 grid, 1.75 stroke) on every control. No text glyphs as icons.
6. **Each fact once:** remove the duplicate hail, year, step and "Adjuster meeting" lines, and the Sale Guide copy
   on Now.
7. **Knock header:** one rules chip in place of the paragraph and evidence box, one ⋯, and "Stop 3 of 12 · 10 to go".
8. **Answer buttons** with icon + word + hint; Booked is the only orange.
9. **Docked Right Hand composer** in place of the floating pill.
10. **Money hero figure + stacked bar**; the empty state becomes the 8-step stepper + one CTA.
11. **List rows** for Due and Leads (address / action / chip), show 3 + "See all".
12. **Status chips** (icon + words + tint) in place of mono red text with "!".
13. **Bottom bar:** 24 px icons, labels aligned to the baseline, the + labeled "Add", one badge only.
14. **Designed loading + empty states** for every tab (skeleton in the real shapes).
15. **Sheets:** round × close, `:focus-visible` only (no orange ring on open), 24 px top radius, one grab handle.

## Build order for the builder (v25)

1. Tokens + `--on-ink` + the dark block (fixes 1). 2. Icons sprite + nav + composer. 3. Knock header + offer card.
4. Now zone card + Today rows. 5. Lead sheet restructure. 6. Money hero + empty stepper. 7. Map renderer, once the
engine ships `streets/lots/stops` per zone (until then, draw the same map from walk stops + a block pattern, so it
never looks like the red blob). 8. Leads/Claim/+/More using the same components.
