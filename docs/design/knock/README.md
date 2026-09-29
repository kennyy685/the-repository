# Knock screen mockup (docs/design/knock/)

The screen FilthE works from at the door, after the open map's "Start knocking". Design mockup only: not the HMP App,
never published. Open `index.html` through a local server (`cd docs/design && python3 -m http.server`), then
`/knock/index.html`. URL options: `?lang=es`, `?theme=light`, `?fresh=1` (reset to the sample log), `?yes=1` (open the
YES moment), `?seen=gutters,screens`.

## What's real, what's fake
- **Real:** street names + lines (Nebraska GIS centerlines) and homes per street (2020 Census blocks), both from
  `docs/design/open-map/data/`; the storm reports are the open map's sample storm s1.
- **Fake:** every home (house number on Fremont's block grid, year built, roof age, owner/mortgage/sale signals) and
  the 14 knocks already logged this afternoon. Never owner names. Built by `data/build/walk.py` -> `data/walk.json`,
  then `data/build/stack.py` adds `stack` (REAL repeat-hail days near each fake home), `rb` (roof-age band, estimate)
  and the open score with "repeat hail 10" (`score0` = the old score). walk.py no longer reruns as is (the open map's
  areas.json moved to real zones), so stack.py edits walk.json in place and can run again safely.

## At the door, in 2 seconds
House number (huge), street, door N of 103 · **Why this house**: hail that hit it (size, date, the 3 reports behind
it, nearest distance), likely insured (3 signals: owner lives here, mortgage on record, recent sale; never "insured"),
roof age (no roof permit since year) · Aldaba score (open formula, hover) · **If they say yes, collect** (time, what
to inspect, their phone, date + insurer, 26 photos) · 69-1602 line: your name, HMP Siding & Roofing, what we sell.
**Repeat hail** under the hail tile ("Hail here 7 times since 2024": real public reports within 5 km since 2024 plus
this storm) and a **roof-age band** under the roof tile (young / prime 8-14 yrs / check the policy first 15+, an
estimate); both from `data/build/stack.py` (engine `hailhunter/stacking.py`). Every number carries a source tag (hover = who said it, real / sample / rule / estimate).

## One tap per door
Keys 1-5 or click: No answer · Not interested · Come back · Has a roofer · **Inspection YES**. S = No soliciting sign
(skip, logged), Z = undo, arrows = prev/next. A tap saves at once and moves to the next door; the toast offers an
optional refine (come back when; roofer signed/quotes/came; "don't knock again"; door hanger left).
Rentals, logged signs and 2025 roof permits are skipped in the walk (one tap "Knock anyway").
Walk list shows done/next/skipped, "next to a yes" tags, and a sunset line: doors past it move to tomorrow.

## The YES moment
Burst + counter, saved the instant it's tapped. Then optional fast capture: when (now / 6:30 / tomorrow / pick),
what to inspect, phone they give, when they noticed damage, storm date (auto from the nearest report, "not confirmed
at this address"), insurer, already reported, prior claim or repair, leak now. Adjuster-ready photo list (26, from
`docs/research/2026-09-28-claim-ready-inspection.md`); items seen from the street are pre-flagged; locked until all
are in. Legal lines: no deductible talk (44-8604), we document / insurer decides (public-adjuster law), 3-day cancel
form EN + ES at any sale (69-1604), itemized description to homeowner and insurer (44-8606).

## What every knock logs (localStorage `aldaba.knock.v1` in the mockup; the app's db later)
```
{ id, at (ISO UTC), m (minutes after midnight, local), door, st, no, ll:[lon,lat], zone, storm,
  o: "na"|"no"|"back"|"roofer"|"yes"|"sign",
  seen: ["gutters","screens","ac","vents","siding"|"none"],   // damage seen from the street
  sig: { hail, own, mort, sale, roof, score, stack, rb },    // the signals shown at the door, frozen at knock time
  when?: "tonight"|"tomorrow"|"sat"   (come back)   roofer?: "signed"|"quotes"|"came"
  dnk?: true (asked not to be knocked again)        hanger?: true (door hanger left)
  sec (seconds at the door), by, src:"mockup",
  yes?: { when, scope:[...], m, phone, noticed, carrier, filed, prior, leak, photos:{req, done} } }
```
So the map can learn per street and per signal: answer rate, yes rate, best hours, which signals predicted a yes
("Map learns" tab shows the per-street version). Nothing here is a verdict on coverage.

## Screens (shots/)
door dark/light EN 1440×810, dark ES 1470×866, light ES 1280×800, come-back toast, revisited done door, YES dark EN
and light ES. 810/866 tall = a MacBook Air browser window (screen minus browser chrome).
