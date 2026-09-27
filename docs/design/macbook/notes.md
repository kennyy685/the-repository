# Aldaba on a MacBook Air: 3 directions (2026-09-27)

**Frame:** 1470x956 CSS px first, checked at 1280x800. Graphite dark by default, Ledger light as an option, EN/ES on
every screen (`?lang=es`, `?theme=light`, `#now` `#knock` `#job`, keys N / K / J). Salesman screens show the Aldaba
mark. Sample data only. Every `$` is a `$ —` placeholder until the boss's price sheet comes in.
**The job of the screen (FilthE):** "we're a system trying to find leads so we can bring in profit." Every direction
opens on the same answer: where today's leads are (hot zones, ranked doors, calls) and what the pipeline holds
(New > Inspected > Signed > In production > Paid, with count, `$ —` and the next action on each).

Files: `a-cockpit.html`, `b-board.html`, `c-focus.html` (shared `shared.css` + `shared.js`), `compare.png` (all 9
screens side by side), `shots/` (1470 + 1280 + light/ES).

## About the link
The egress proxy blocks tabnav.com, so I could not read the article itself. Search snippets show what it values:
structure, spacing, hierarchy, and how the page feels to use; oversized, confident type (#paid); soft cards and
clarity (FeedSpring). For the work-tool side I used the product dashboards these lists usually hold up (Stripe,
Linear, Vercel). I left out the marketing parts (hero video, scroll storytelling, testimonials).

| Pattern | Where it's from | Where it's used |
|---|---|---|
| Money strip across the top: count + $ + a small bar per stage | Stripe's KPI row | A (top of Now), C (bottom ribbon) |
| Tables as the main surface: aligned numbers, mono digits, one highlighted row | Stripe | A (zones table, ranked walk, pipeline list) |
| Keyboard first: ⌘K search, N/K/J screens, 1-5 door outcomes, ↓ next door, J/K walk | Linear | all three |
| Dark by default, quiet hairlines, one accent color, 150-250 ms motion (turned off with reduced motion) | Linear | all three |
| Oversized, confident headline for the one thing that matters | #paid | B (the day's brief), C (next move, door address, job) |
| Soft cards with a lift on hover | FeedSpring | B (zone cards, lead cards) |
| Minimal color, strong hierarchy, placeholders designed as carefully as data | Vercel | `$ —` fields, "Prices pending" chips |
| Show first the one number that answers "is everything okay?", details on demand | all dashboard round-ups | A strip, B headline, C "Your next move" |

## The three directions

**A · Cockpit** (sidebar + money strip + map/tables + right rail). Everything that makes money on one screen:
pipeline $ strip on top, a hot-zone map with the best zone and a ranked zone table, and a "Next actions" queue on
the right. Knock is 3 panes: ranked walk | route map | door card with outcome keys 1-5. The job screen is the
pipeline list next to one job's tracker, papers and money.
*Lead to signed, fastest because:* nothing is hidden. The next call, inspection or paper is always one click away
in the right rail, and the stage strip jumps straight to the stuck deals. Built for 100+ leads.

**B · Board** (top tabs + today's brief + pipeline board). Home is a sales board: one bold sentence ("64 doors under
1.75″ hail, 0.8 mi away. 3 calls due today."), three zone cards, then five pipeline columns of lead cards, each with
its next step, a Today flag and `$ —`. Knock is a full-screen map with a floating walk list and door card.
*Lead to signed, fastest because:* you can see where every deal is stuck. Emptying the "Today" cards column by
column is the day's plan. Best for a manager or the boss looking over the whole pipeline.

**C · Focus** (icon rail + half "next move" in big type + half map). It says one thing at a time: the next best move
in 58-64 px type, with the reason, one orange button and "Then" (the next 4 moves). The pipeline sits as a ribbon at
the bottom. Knock puts the door address huge with big 1-5 buttons. The job screen is a vertical tracker with the
next step inside it, and money and papers on the right.
*Lead to signed, fastest because:* there's no deciding. The app always says the one next thing to do, which suits
ADHD and keeps pace up at the door. It gets thin once there are dozens of open deals.

## Pick: A · Cockpit
It answers "where are today's leads and what are they worth" in one look at 1470 px, and it still works when HMP has
hundreds of doors and dozens of claims. Worth borrowing: C's big-type door card for Knock and B's "Today" flag on
pipeline cards.

## Legal and brand checks built in
Say-first box on every door (69-1602). 3-day cancel form EN + ES and the itemized description to homeowner + insurer
(44-8606) show as papers with "Needed before work". "Homeowner files their own claim... no deductible help of any
kind (44-8604)" on every job. "Deductible · paid by homeowner" is listed as a money line. No owner names; "owner-lived",
never "insured". No coaching text. The mockups show no registration number (it stays blank until the boss gives it).

## A · Batcave layer (FilthE picked A, 2026-09-27: "like Batman's cave computers")
`batcave.css`, loaded by `a-cockpit.html` only (B/C and `shared.css` untouched). Dark: near-black room (vignette,
32/160 px grid, faint topo lines, soft scan lines), panels as dark glass monitors (1px cool edge, top highlight, inner
glow, corner brackets, mono HUD headers with one orange pip), segmented orange gauges, map as a tactical display
(grid, edge rulers, one slow 9 s sweep, off with reduced motion). Ledger light = clean lab console (same frame, no
scan lines). Muted text 6:1, faint 4.8:1 on panels. Shots: `shots/batcave-{now,knock,job}-{dark,light}.png`,
before/after: `batcave-compare.png`.
