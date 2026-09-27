# HMP App design system (v25, theme A "Ledger" + "Ledger Night")

The code lives in `ds.css` (tokens + components), `icons.js` (the icon sprite) and `walkmap.js` (the map renderer).
The builder copies them into `pages/hmp-app.html`. Every value below is a token, so no raw px, hex or shadow goes
into component CSS.

## 1. Color tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #f6f7f8 | #101113 | page |
| `--card` | #ffffff | #191a1d | cards, sheets' content, inputs |
| `--soft` | #eff1f3 | #232428 | chips, segmented track, skeleton |
| `--line` / `--line-2` | #e3e5e8 / #d3d6db | #2b2d31 / #3a3c42 | hairlines / control borders |
| `--ink` / `--ink-2` | #18191c / #3d3f45 | #f1f2f4 / #c9cbd0 | text / secondary text, icons |
| `--muted` / `--faint` | #6c6f77 / #9a9da4 | #8f929a / #6b6e75 | captions / disabled, route done |
| `--on-ink` | #ffffff | #101113 | **text or icon on an `--ink` background** (the + tab, active segment, avatar, toast). This fixes the blank buttons. |
| `--hmp` / `--on-hmp` | #f5883a / #1b1206 | same | the ONE "do this" button per screen, current stop |
| `--hmp-ink` / `--hmp-bg` | #a4520f / #fdf1e7 | #ffa766 / 14% orange | orange text and tints (chips, time tiles) |
| `--late` / `--late-bg` | #c2362b / #fdecea | #ff7166 / 13% | late, overdue (always with a flag icon + words) |
| `--warn` / `--warn-bg` | #8a5a00 / #fbf2dc | #f0b54a / 12% | waiting, outside knock hours |
| `--ok` / `--ok-bg` | #1f7a4d / #e7f4ed | #4cc38a / 13% | done, collected |
| `--you` | #2f6fde | #5b8ff0 | "you are here", drive route |
| `--map-*`, `--heat`, `--route` | see ds.css | see ds.css | map land, lots, streets, major roads, labels, water, park |

Theme rule: the bare `:root` holds light. `@media (prefers-color-scheme:dark)` guarded by
`:root:not([data-theme="light"])` and `:root[data-theme="dark"]` both hold the full dark set. claude.ai stamps
`data-theme`, and FilthE's Mac stamps dark. Default = Auto, with Theme: Auto/Light/Dark in More.
**Never write `#fff`, `white` or `black` in a component.**

## 2. Type

- Faces: **Geist** 400/500/600 for everything, **Geist Mono** 500 only for `.label` (11 px uppercase eyebrows, at most
  one per card). Chips, statuses and numbers are sans.
- Scale (8 steps, nothing else): `--t-label` 11 · `--t-cap` 13 · `--t-body` 15 · `--t-row` 17 · `--t-title` 20 ·
  `--t-addr` 26 · `--t-num` 34 · hero 52-60 (one per screen: today's knocks, owed money).
- Weights: 400 text, 500 labels/buttons/row titles, 600 headings and figures. No 700/800.
- Numbers: `font-variant-numeric: tabular-nums` everywhere. Put the figure first and the word smaller after it
  ("2 / 25", "knocks today").
- Letter-spacing: -0.015 to -0.045em on 20 px and up, 0 on body, +0.07em on mono labels only.

## 3. Space, radii, elevation

- Space (4-pt): `--s1` 4 · `--s2` 8 · `--s3` 12 · `--s4` 16 · `--s5` 20 · `--s6` 24 · `--s8` 32 · `--s10` 40.
  Page gutter 16. Card padding 16. Gap inside cards 12. Gap between sections 24 (`.shead` margin).
- Radii: `--r-sm` 8 (chips, small buttons) · `--r-md` 12 (buttons, answer tiles, inputs) · `--r-lg` 16 (cards,
  lists, maps) · `--r-xl` 24 (sheet top) · `--r-pill` (composer, map chips, avatar).
- Elevation: **0** flat = page content. **1** `--e1` = cards and lists (1 px line + a 2 px whisper, none in dark).
  **2** `--e2` = things that float: sheets, toasts, map controls, map chips, menus. Nothing else gets a shadow.

## 4. Icons

- One set, `icons.js`: 24 grid, 1.75 stroke, round caps and joins, `currentColor`, no fills except tiny dots.
- Sizes: 16 (in chips, small buttons), 20 (default), 24 (tab bar). Always paired with a word, except the round icon
  buttons (close, map controls, call, mic), which carry `aria-label`.
- Never use text glyphs as icons (⇄ → ✓ ⋯ ▶ !). v24 has 48 → and 16 ✓ as text.
- Meaning is fixed: `door` = Knock / Not home, `ban` = No, `star` = Interested, `cal` = Booked / dates,
  `hail` = storm facts, `built` = year built, `flag` = late, `clock` = waiting, `mic` = Right Hand, `say` = scripts.

## 5. Components (all in ds.css)

| Component | Spec |
|---|---|
| **Top bar** `.top` | 52 px: HMP mark · screen title 20/600 · (date 13 muted on Now) · optional mic · ES/EN pill · avatar "K" = More. No second ⋯ in the bar. |
| **Tab bar** `.nav` | 5 slots, 52 px + safe area, 24 px icons, 11/500 labels on one baseline. Center "Add" = 52x34 ink tile with `--on-ink` plus. One red badge max (Now, late count). |
| **Composer** `.composer` | Right Hand entry, docked above the tab bar on Now/Leads/Money: 44 px pill, say-icon, example placeholder, ink mic. On Knock it becomes the top-bar mic. Never floats over content. |
| **Card** `.card` | `--card`, 1 px `--line`, `--r-lg`, `--e1`, 16 padding. One job per card. |
| **Offer card** | Card with: mono eyebrow + right-aligned count, a 20-26 px title, a facts row (icon + short fact, each fact once), a single coach line, secondary tools, primary action(s) at the bottom. Used for the zone (Now), the next door (Knock), the next step (lead/claim). |
| **List row** `.row` | min 60 px: optional 36 px icon tile · title 15/500 + one sub line 13 muted (both single-line, ellipsis) · end slot (chip, time, chevron, round action). Lists show 3 + "See all". |
| **Buttons** `.btn` | `sm` 36 px / default 48 / `lg` 56 · `.pri` orange (one per screen) · `.sec` card + `--line-2` border · `.ghost` text. The label is a verb ("Start knocking", "Log a signed job"). |
| **Answer tile** `.ans` | 60 px, 2x2, icon + 17/600 word + 12 hint. Only Booked is orange. |
| **Chip** `.chip` | 24 px (28 when tappable, with a chevron), `--r-sm`, 12/500, icon 13. Variants: neutral, `.hmp`, `.late`, `.warn`, `.ok`. Status is always icon + words + tint, never color alone. |
| **Segmented** `.seg` | soft track, raised white/`--card` thumb, 34 px. The only "selected" style in the app (replaces black-fill, orange-border and underline variants). |
| **Sheet** `.sheet` | Top radius 24, grab handle, header = title + meta + round × (36 px, `--soft`). No boxed "Close". `:focus-visible` only, so no ring on open. Content order: quick actions → stage bar → next-step card → guide → closed rows. |
| **Stage bar** | n equal segments 5 px: done `--ink`, current `--hmp`, rest `--line`. Under it: "**Stage name** · step 2 of 8" and "next: …" right. Shown once per sheet. |
| **Toast** `.toast` | Ink pill above the composer, `--on-ink` text, orange action ("Undo"). Auto-hides in 5 s. Confirms every Right Hand log. |
| **Empty state** `.empty` | 56 px icon tile, 17/600 title, 1-2 line muted body (≤28ch), one button. States what happens next ("Storm Watch looks again tomorrow"). Never a wall of explainer. |
| **Skeleton** `.sk` | The same shapes as the loaded screen (map block, card lines, row lines), soft shimmer 1.4 s, off with reduced motion. Show after 300 ms, never a spinner. |
| **Map** | `walkmap.js`. `renderZoneMap(svg, {zones, walks}, opts)` for Now, `renderWalkMap(svg, walk, opts)` for Knock (mini strip 118 px centered on the next door, or the full walk in the Big map). HTML chips on top: zone pin (ink pill + orange rank), edge chip for off-map "you", legend, scale bar, round controls (e2). Homeowner view: `renderHomeMap` (one house at lot scale) and `renderHailMap` (hail area + home, no zones), section 7. |

## 6. Copy rules (EN and ES)

- Salesman words: "Stop 3 of 25 · 23 to go", "Knocks today", "Owed to HMP". Never "pass", "turf", "sync", "handoff".
- Each fact appears once per screen. A why-line only adds what the numbers above it don't say.
- Word budget per screen: ≤130 visible words. Sheets ≤150 before any row is opened.
- ES labels are written short on purpose (not machine-length): "Siguiente · parada 3 de 25", "faltan 23".
- Legal copy stays: the deductible shows as money the homeowner owes (44-8604), "Their claim, not ours", "registered",
  and no promises that insurance pays.

## 7. Homeowner view (kitchen table) · `homeowner.html`

- **What it is:** the screen the salesman hands the family. Four chapters in a `.seg` stepper: Your home (damage map +
  spots + hail) → Photos (photo, thumbnails, where-on-the-house locator, plain words, "their insurer decides") →
  Options (Good/Better/Best, picked per job) → Next steps (timeline, 3-day cancel on the contract step, phone numbers,
  "yours to keep"). One orange button per chapter ("Next: …", then "Done"). No tab bar, no zones, scores or scripts.
- **Phone and tablet from one page:** container query at 900 px on the frame. Tablet (1180 x 820 landscape): the stepper
  moves into the top bar and each chapter fits one screen in two columns (map or photo left, 392 px column right).
- **Damage map:** `renderHomeMap(svg, walk, {home, finds, ppm, street, labelAt, toward, active, mini})`. The home lot
  (hmp-bg, dashed hmp-ink), neighbors soft, streets true to scale, a drawn hip roof, and each finding by kind:
  `slope` (hatched slope), `square` (10 x 10 ft test area to scale), `vent`, `gutter`, `wall` (orange edge). Pins are
  ink with the number in `--on-ink`; the finding open on Photos turns orange. `mini: true` = the 112 px locator.
  Roofs use `--map-roof-a/b/c`. Chips: north arrow (top-left), "Damage we found" key (bottom-left), 20 ft scale.
- **Hail card:** `renderHailMap(svg, data, {home, metersAcross, center})` + one hero figure (1.6″) + date + source +
  "Weather data, not proof of damage". **Engine asks (not blockers):** building outlines per lot (OSM / Microsoft
  footprints are free) to replace the drawn roof, and the radar hail contour to replace the padded zone hull.
- **Legal copy (fixed):** "Your insurance company decides what your policy covers. If you choose to file a claim, you
  file it." Tiers carry "Estimate ranges, not final prices" under the prices until HMP's prices exist. The 3-day cancel
  (with the insurance-denial extension) sits on the contract step, EN and ES. "Registered Nebraska contractor #" +
  blank line. No deductible words anywhere on this screen (the 44-8607 notice lives in the contract).
- **Settings the builder must wire (boss answers pending, hub D14 and D15). Both default OFF:**
  `offersClass4` (bool): when on, the Best roof reads "Class 4 impact-rated shingles" and the "Shingles tested for hail
  impact (UL 2218 Class 4)" row shows; when off, Best = "Premium architectural shingles" and the row is gone.
  `workmanshipYears` (number or null): when null the warranty row says "Manufacturer warranty" only; when set it reads
  "Manufacturer + HMP workmanship warranty · HMP workmanship: N years, written in your contract". Never show a Class 4
  or workmanship claim from a default. Mockup preview: `homeowner.html#p3-c4-wy5`.
- **Leaving:** the × or "Done" opens "Before you leave" for the salesman: hand over the leave-behind, cancel forms if
  signed, log the visit, then "Leave homeowner view".
