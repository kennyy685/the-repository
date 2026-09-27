# Design quality gate - first run on HMP App v24.1 (2026-09-27)

**What this is:** the first run of the new automated design gate (T72, `tests/pages/design_gate.js`)
against the live v24.1 HMP App page (`pages/hmp-app.html` - the source for
https://claude.ai/artifact/9N97Uzv8J9EAueSKhCNSPT). FilthE asked for this after catching
white-on-white buttons, duplicate menus and a broken map by eye; the point of this first run is to
show it catches real things. It does. Some failures were expected going in - this is not a new
regression, it is the gate seeing the page for the first time.

Command: `node tests/pages/design_gate.js` (default page). Runtime: ~46s. Exit code: 1 (fails, as
expected). Full command output is reproducible any time - see "How to reproduce" below; the
per-run screenshots and text report live in the gitignored `tests/pages/design_gate_out/`, so they
are not checked in here.

**Result: 1,722 raw findings across 4 rules.** Read that number as noisy on purpose - the gate
re-renders the same page 16 times (2 base themes x 3 widths x 2 languages, plus a smaller
data-theme override spot-check) and every one of those renders re-reports the same underlying
issue. The real count of distinct problems is much smaller. In order of what actually matters:

## 1. Real bug: the bottom bar covers the last card before the fold (`overlap`, 168 raw hits)

On the **Now**, **Leads** and **Money** tabs, at the initial (unscrolled) phone viewport, the last
visible card or button sits partly *behind* the fixed bottom chrome - the tab bar (Now/Knock/Add/
Leads/Money) and, when it's open, the "Right Hand" strip docked on top of it. There is no bottom
padding reserved for that fixed strip on these views, so on some width/content combinations the
last item's bottom edge lands right where the fixed bar starts.

Three places this actually happens (screenshots in `tests/pages/design_gate_out/` after a rerun,
filenames `pages-hmp-app-html_light-system_360_en_tb-{now,leads,money}.png`):

- **Leads tab:** the last lead card ("1802 N Clarkson St" in the fixture) runs behind the Right
  Hand strip and the whole tab bar - confirmed visually: the card's last line of text ("then
  inspection set") is cut off right at the top edge of the Right Hand bar.
- **Money tab:** same shape - the last open-claim card ("1107 N H St") runs behind the same fixed
  strip.
- **Now tab:** the Sale Guide's "Guide" button overlaps the Knock/Add tab-bar buttons by ~57%.

This is exactly the "floating bar covering buttons" bug class the gate was built to catch, and it
is a real, reproducible layout bug: reserve bottom padding on the scrollable content equal to the
tab bar's height plus the Right Hand strip's height when it's open (the app already does this in
some other place - `body.rh-on .app{padding-bottom:calc(var(--nav-h) + 54px + 32px + ...)}` - so the
fix is probably making Now/Leads/Money's last-card spacing account for the same thing, or an
inherited padding rule not reaching these specific lists).

## 2. Contrast, real but marginal (`contrast` 132, `contrast-icon` 62)

- **Icons:** every tab-bar icon (Now/Knock/Leads/Money) measures **2.31:1** against its background
  (needs 3:1); the "+" add-sheet icons measure **2.48:1**. These are muted/secondary icon colors
  paired with a visible text label right next to them, so this is a judgment call, not an obvious
  breakage - but it is the same category of thing FilthE caught by eye before, so worth a look.
- **Text, right at the edge:** several labels measure **4.40:1** against a 4.5:1 requirement -
  "Next step" (the bold eyebrow on a lead/claim's next-step box), "Deposit"/"Progress"/"Final"
  (payment-plan column labels on the Money tab). These are a hair under the line, not blatant - an
  easy, low-risk tune if FilthE wants it clean.
- **Small badge numbers:** the "1"/"2"/"4" counts inside the Leads tab's filter pills measure
  **3.07:1** (they're `<small>` text, so the large-text 3:1 allowance doesn't apply to them; they
  need 4.5:1).

None of these read as "obviously broken" the way the overlap bug does - they're real contrast gaps
worth a design pass, not something that looks unfinished by itself.

## 3. Font size: one systemic choice, not scattered bugs (`font-size`, 1,360 raw hits)

Nearly all of these are the same thing repeated: this page's design system deliberately sets
**10-11px** for its "eyebrow"/label style, used everywhere - the tab bar's own labels ("Now",
"Knock", "Leads", "Money"), badge counts, status chips ("Due today", "No contact 3 days"), buttons
(`.btn{font-size:11px}`), and small section headers. This is declared directly in the CSS
(`pages/hmp-app.html` lines 69, 71, 80, 101, 151, 171, 249, 431, 1276, 1294, and others all set
`font-size:10px` or `11px`) - it is one intentional design-system decision, not 1,360 separate
mistakes. The gate's 12px floor is doing exactly what it was told to do; whether 10-11px labels are
acceptable on a phone screen (this is below Apple's and Google's own minimum body-text guidance,
though it's a common pattern for tab-bar labels specifically) is a call for FilthE/the builder, not
a bug to silently fix. Report it as *one* finding to act on, not a list of 1,360.

## 4. Clean: no findings at all for -

Tap targets (44px), sideways scroll, duplicate controls in any header/nav/toolbar, broken images or
0-size SVGs, headings truncated mid-word, empty/invisible button labels, and JS errors. The page
handles all of these correctly today across every width/theme/language combination tested.

## Two false leads the gate itself had to rule out (kept here so the next reader doesn't re-chase them)

- **A closed `<details>` "How a claim works" accordion looked "visible" at first.** Chromium hides
  a closed `<details>`'s content by suppressing it internally at paint time, not by setting
  `display:none` on the child the way the spec's suggested UA stylesheet implies - so a naive
  visibility check (computed `display`/`visibility`/`hidden` only) treats its hidden step labels as
  on-screen. `isVisible()` in `design_gate.js` now special-cases `<details>` without `[open]`, and
  a first pass's ~48 bogus "large text overlaps large text" hits (all pointing at that accordion's
  content) disappeared once that was fixed.
- **A wrong Playwright viewport option was silently testing a 980px-wide layout, not 360-420px.**
  This page has no `<meta name="viewport">` tag. Playwright's `isMobile` context option ("whether
  the meta viewport tag is taken into account") makes Chromium fall back to the classic 980px
  desktop-compatibility width when that tag is missing - so the gate's first few runs (which set
  `isMobile: true` for realism) were checking `window.innerWidth === 980` while reporting "360px" in
  every finding. Dropping `isMobile`/`hasTouch` (`tests/pages/shots.js` already does this, for the
  same reason) fixed it; `window.innerWidth` now correctly matches the requested width. This is also
  what first looked like a dramatic "garbled overlapping dollar figures" bug on the Money tab's
  summary tiles - at the real 360px width, those tiles render cleanly in a 2x2 grid with no overlap
  at all. Good reminder that "the check found something" always still needs a screenshot check
  before it goes in a report.

## How to reproduce

```
node tests/pages/design_gate.js                      # default: pages/hmp-app.html
node tests/pages/design_gate.js --page pages/crew-hq.html
```

Screenshots (one per failing view, capped at 3 per rule) and a full text report land in
`tests/pages/design_gate_out/report-<page-slug>.txt` (gitignored scratch, regenerated every run -
not part of this write-up). This repo is a shared, multi-agent workspace (see `CLAUDE.md`'s Code
lab / hub setup): two gate runs against different pages can genuinely run at the same time, which
is why the report filename is namespaced per page rather than a single shared `report.txt`.

## What ships next

Nothing here blocks a publish by itself - FilthE should see the bottom-bar overlap (section 1, a
real visual bug) and make the call on icon/label contrast and the 10-11px label choice (sections 2
and 3, both judgment calls, not breakage). Per the updated `.claude/agents/qa-tester.md`, this gate
now runs on every app-page review and is mandatory before any HMP App / AI hub / HMP HQ / Practice
Door publish - so the next publish's QA pass will show whether the bottom-bar padding got fixed.
