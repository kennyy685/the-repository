# Brief: integration (director film, colophon, sound toggle, foundation requests)

Read first: `dev/briefs/00-base.md` (rules), `CONTRACT.md` (API), `HANDOFF.md` (state). By now every view is built
and reviewed. You own `js/director.js`, `css/director.css`, and the foundation files (`index.html`, `css/base.css`,
`js/core.js`, `js/world.js`, `js/boot.js`, `dev/*`, `files.json`, `CONTRACT.md`). You may make small, surgical edits
in view files only to wire cross-view events; say which in your report. No git commits.

## 1. The film: "Play the film" (js/director.js -> A.director = {play(), stop(), playing})
The app demos itself, like an Apple keynote product film, driving the REAL UI (not screenshots). ~70-90 s.
- Start: the top-bar "Play the film" click. That click is a user gesture: call `Sound.enable()` there and play
  WITH sound by default (a film has a score), with a visible mute control; remember the mute choice (A.store).
- Frame: cinematic letterbox bars slide in (transform only); chrome dims to a quiet state; a bottom film bar
  with chapter ticks (one per beat), elapsed time, play/pause (Space), prev/next chapter (Left/Right), mute (M),
  exit (Esc). Exit or the end hands control back on whatever view is showing: a card "Your turn" / "Te toca".
- Captions: COPY.film.beats (12 beats, EN/ES, <=12 words, 4 kickers). Lower-third, Bricolage, per-word rise with
  the hail spring; kicker in mono. Language follows A.lang live.
- A ghost cursor (a clean pointer with a soft orange ring) glides on eased curves to the real elements the beat
  uses (a tab, a zone row, a door outcome button, a deal step, the homeowner button, a Money lever), "presses"
  (scale + A.motion.ripple) and the director then calls the view's demo API. The cursor must never be required
  for the action (the director calls the API directly); it's choreography.
- Beats (map to COPY.film.beats order; timings are yours):
  1 cold open: `A.intro.play({force:true})` (or seek its timeline) over the real Aug 8 storm; Sound.hailBed/score.
  2 the 7 AM brief: `A.view.go('now')`, `A.nowAssemble` (the pick assembles).
  3 why Columbus: camera eases onto the pick; highlight the why line + stats (ring pulses).
  4 the zones: cursor hovers 3-4 ranked zones (rings pulse on the map), back to the pick.
  5 storm replay: `A.view.go('storms')`, `A.stormsDemo.seek(0)`, `.play()`, land on Aug 8 (`select`).
  6 the drive: back to now, the car travels ROUTE_BAKED Fremont -> Columbus (50 mi, 55 min) with mile ticks.
  7 the walk: `A.view.go('knock')`, route draws from the park spot, doors light in walk order.
  8 one tap per door: `A.knockDemo.tap(...)` x4-5 (no answer, talked, inspection set...) with Sound.knock.
  9 the legal armor: `A.view.go('deal')`, `A.dealDemo.step(i)` through intro -> photos -> inspection -> adjuster
    -> itemized description -> contract + 3-day cancel.
  10 the homeowner sheet: `A.dealDemo.open()` (HMP Siding & Roofing, EN/ES), hold, close.
  11 the path to $100k: `A.view.go('money')`, a lever moves (cursor drags it), numbers roll, the ring fills.
  12 sign-off: back to a wide map at dusk-dim, the Aldaba mark + "Claude's cut", "Your turn".
- Sandbox: the film must not change the viewer's saved state. Snapshot the A.store keys the views use (knock
  outcomes, deal checklists, money levers) before and restore them after (or use the views' demo modes).
- Robustness: every beat is wrapped (A.safe); a missing demo API skips that beat gracefully; `stop()` at any
  moment leaves a clean app (no stuck letterbox, cursor, captions, layers, sounds). A.still: the film still plays
  but as crossfades with no camera flights and no particles. Built on `A.motion.Timeline` so it can seek.

## 2. "Made by Claude" colophon
Clicking the "Claude's cut" tag (and a small "Credits" link) opens a drawer or full-screen end-card from
COPY.colophon: what is real (NOAA SPC / NWS LSR / NCEI / NEXRAD / MRMS with counts from NLX.storms2026.sources,
Nebraska GIS streets and rivers, US Census ACS 2024), what is sample (homes, commission example), how it was
built (one continuous map world, raw WebGL + Canvas2D, no frameworks, synthesized sound; show real numbers:
lines of code per module and the data sizes, from a small static manifest you generate into core or the
colophon), the design thesis in Claude's voice (one motif, many meanings), credits like a film end card
("Direction, design, engineering, motion, sound: Claude" / "Built with FilthE for HMP Siding & Roofing,
Fremont, NE"), and buttons "Replay intro" and "Play the film". EN/ES. Focus trap, Escape closes.

## 3. Top bar
A speaker toggle (sound on/off, remembered) next to "Play the film". Keyboard: `F` plays the film, `?` shows a
small shortcuts sheet (1-5 views, F film, M mute, Esc, N T I X B U on Knock).

## 4. Foundation requests from the builders (do the reasonable ones)
- srcTag keys 'bench' (industry benchmarks, vendor figures; replace with HMP's own after ~200 doors) and 'log'
  (your own log on this device); world pal gets `warn`/`warnBg`; then remove the views' local workarounds.
- World canvas labels should avoid view canvas labels where cheap (optional).
- Cross-view events: 'zone:focus' (Storms "Knock this storm" -> Now highlights that zone), 'deal:home' (Knock ->
  Deal), 'intro:handoff' (intro -> Now assemble). Verify each works end to end; wire what's missing.

## 5. Whole-app checks
`node dev/smoke.mjs` (all views) and `--motion`; shots of every view dark/light EN/ES at 1440, 1280, 400; a film
run: shots at several points of the film (add a dev hook `#now&film=<ms>` to start/seek the film), zero console
errors, zero horizontal scroll, `?gl=0` once. Update `files.json` for any new file, and `CONTRACT.md` + `HANDOFF.md`.
