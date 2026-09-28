# AI hub v28 build plan (board T190)

Lead's plan, 2026-09-28. Inputs: HANDOFF.md step 4, AI-HUB-BLUEPRINT.md (the concept, section 11 = milestones),
SPEC.md walkthrough notes 1-11, RESEARCH-v28.md, SOCIETY-TEST.md (the panel's fix list), FUNCTIONS-SHORTLIST.md
(FilthE picks; not in this plan until he does). Live today: v27.1 (hub Version 27).

**Three publishes, not one big bang.** Each chunk ends live (go-live rule, SPEC.md): FilthE sees value sooner and a
bad chunk is small.

| Chunk | What FilthE notices | Blueprint | Notes |
|---|---|---|---|
| **v28.0 "Calm and clear"** | RIGHT NOW list, robots re-seated by kind of work, 7-state status, a closable panel, a King chat bubble, fewer cameras, straight rain, calmer screen, English only, no HMP name | M0, M1, M2 | 1, 3, 4, 5, 8, 9, 11 + society quick fixes |
| **v28.1 "One building"** | the floors read as one building around a glass spine, the Observatory on it, work riding the tube (Builder → QA → Right Hand), FilthE's cat roaming | M3, M4 | 2, 6 |
| **v28.2 "Dressed with data"** | research wall, pin wall + Shipped shelf, QA screens, card additions, plus whatever FilthE picks from FUNCTIONS-SHORTLIST.md | M5 | 10 |

**Tracks (no shared file).** PAGE = `pages/crew-hq.html` (+ `pages/crew-hq.files.json`). SCENE = `pages/hub/scene.js`,
`pages/hub/outfits.js`, `pages/hub/eyes.js`, `pages/hub/still.webp`. The shared file is CONTRACT.md: v3 lands first,
in its own commit, before either track starts. A builder who needs a new field adds it to CONTRACT.md first and says
so in its report; never edit the other track's file.

**Every milestone:** `node tests/pages/design_gate.js --page crew-hq` exit 0 · `node tests/pages/shots.js` clean ·
`bash tests/release_checks.sh --fast` pass · no console errors · shots at 1440x900 and 1512x982 (MacBook first) and
390x844 (phone keeps working), with three.js routed to a local copy and with the CDN blocked (still + hint).
Every new HUB/SCENE field optional (scene falls back to v27, page works with no scene). Keys never fire in a field;
no key ever sends an answer; reduced motion = cuts and final poses; localStorage only inside try/catch. Commit with
`git add <your files>` only, never `-A`.

---

## v28.0 "Calm and clear"

### M0 · Contract v3 + crew fields (lead, before the tracks start)
- CONTRACT.md v3: `HUB.now`, the status tokens, `def.floor` flips, `agent.step/metrics/result`, `HUB.panel`,
  `SCENE.views` v3 list. (Blueprint 8.2, 8.3; `HUB.observatory` and `HUB.flows` are specified now, built in v28.1.)
- crew-checkin skill: optional `step`, `metrics` (whitelist), `result`, `why`; helper→helper `handoff` with `by`.
- Fixture rows (`tests/pages/design_gate_fixture.json` hub part): every state incl. queued and silent, a `step` +
  `metrics` per working robot, one `result`.

### PAGE (v28.0)
1. **English only, its own name (note 11).** Remove the EN/ES toggle and the `es` string table (keep the `D()`
   defs' `.en`). Title/brand default "AI Hub" (Make it yours still renames it), folio without "Fremont, NE" if it
   reads as HMP; no "HMP" in the hub's own UI (pointers to "the HMP App" for logging stay: they name another page).
2. **RIGHT NOW (M1, blueprint 7.1).** Above the tabs, always visible on the MacBook: one row per robot + the You
   row, verb from the resolver (7.3: `step` → event kind → status → `doing` keywords → role default), metric only when
   posted, row ↔ room hover (spotlight + the robot's tag; edge arrow when off-screen), click = select, double-click =
   Follow. It replaces the Crew tab's roster at the top; the Crew tab keeps the full list.
3. **7-state status (M2, blueprint 3.1).** Tokens (`--st-stuck:#d9483b`, `--st-stuck-ink:#ef7a6c`,
   `--st-done:#3fbf94`, `--st-queue:#cdb896`, `--intel:#6cb8ec`), glyphs ◆ ■ ✓ ● ⧗ ○ ◐ ◌ in rows, tags and cards,
   queued derived (handoff not picked up / `holds`), silent from the watchdog. Key V = status overlay (the room greys,
   only status colors stay lit). Make it yours may change `work` only; needs/stuck/done locked.
4. **Closable side panel (note 8).** One button on the panel edge + key `P` (and `]`) hides it; the office fills the
   screen (`HUB.area` widens, `SCENE.resize()`); it slides back by itself when something new needs him (a new id in
   `HUB.needs`), and the choice is remembered (`hub-panel`). When closed, a slim tab on the right edge shows the
   needs count.
5. **The King chat bubble (note 3).** A floating round button bottom-right (above the panel's bottom when open,
   screen corner when closed): opens a small chat window to talk to the King (the Right Hand box that lives in the
   Chat tab today moves here; the Chat tab keeps Memory). Visible whenever the page can talk (`SAMPLE && CAN_EDIT`);
   otherwise the bubble explains in one line why not. Key `K` opens it.
6. **Fewer cameras (note 4).** Buttons: Whole · Follow · Eyes · More (Security cam, Through the window, Tilt-shift,
   Director). Cut Blueprint (the V overlay replaces its job) and Tour (Director covers the screensaver); Up/Down leave
   the button bar but stay on ↑/↓ and the scroll dolly. Keys renumbered and the keys sheet updated.
7. **More sound (note 5), still off by default.** A small sound kit on the existing WebAudio code: tube fwoop (have),
   slide whee, a soft done chime per robot (have), typing ticks when the hovered robot types, rain ambience when the
   sky rains, a paper flick on handoffs, a low hum on the Observatory later. One master switch + a volume slider in
   Make it yours; quiet hours 10 PM-7 AM except hail (have).
8. **Declutter (note 9, dark cockpit).** Calm by default: name tags only on hover/selection/needs-you/stuck (not all
   at once on wide screens); the stage bar shows cameras + one "···" for sky/sound/replay/coffee/keys; the top band
   drops the weather words unless the sky is stormy; bubbles only for needs-you and stuck; the morning note max 3
   lines. The society test's clutter list decides the rest.
9. **Straight rain, only in the sky (note 1).** The CSS rain is a 104° repeating gradient in a 90 px tile: the lines
   don't meet at the tile seams, so streaks zig-zag ("bend up"). Replace it with a seamless layer (a small canvas or
   an SVG pattern whose tile matches the streak angle), mask it to above `--horizon`, no rain on the land.
10. **Wake safety.** Drop the hard-coded `WAKE_TRIGGER_FALLBACK` (that trigger is now switched off). If
    `system/king.wake_trigger` is missing, answers ride the next run and the health line says "Instant wake off".
11. **Society test quick fixes** marked "quick fix now" in SOCIETY-TEST.md.

### SCENE (v28.0)
1. **Re-seat by kind of work (M1, blueprint 5.1/5.2, change list 1-5).** Upper = Research Lead, QA Tester, Storm
   Watch (radar table up by the glass, one QA bench from the two lab desks, the experiment table). Lower = Claude
   Code, Right Hand (together at a new dispatch table), Builder, Designer, Engine Mechanic, Chat Reader, Cowork, and
   YOU. Move `DESKS`, `DESK`, seat plates, desk bars, the pendant; update `NODES/EDGES` and the `POOL`s. No new rooms.
2. **Step animations (M1 #6).** Pick the work animation from `step`: reuse type / read / radar + the prop screens;
   add `stamp` (QA verdict), `pin` (Designer), `slide-card` (King at the dispatch table).
3. **Status visuals (M2 #8).** Strip + desk-bar colors from `HUB.theme` with the new tokens; hatched desk bar for
   stuck; a small 2-tier andon lamp per desk (instanced, off until needed); a status mark over the head only for
   ◆ ■ ✓; a selection ring; silent = grey strip, slight dim.
4. **Views v3.** `SCENE.views` without `blueprint` and `tour` (keep the code paths only if free). `HUB.area` changes
   when the panel closes: re-frame on `resize()`.
5. **Upstairs 4000K retint** (change list 12) if cheap in this chunk; else v28.2.
6. Re-render `still.webp` from `#capture` at the end.

Budget (MacBook Air): net +20 draw calls max, no new real-time lights, no new shadow casters (blueprint 10).

---

## v28.1 "One building"
- SCENE: **one building (note 2)**: a shared structural core around the glass tube (columns + slab edge that run
  through both floors), the connector as a real stair/bridge landing, terraces, so the floors read as one building,
  not two stacked boxes. **The Observatory (M3)** on the tube top: walnut ring table, brass torus, dark glass top,
  half-disc glass cantilever, under-glow sized by share working, table texture from `HUB.observatory` on `v` change,
  bezel split-flap. **Workflow (M4)**: envelopes and capsules both ways on the tube, the Builder → QA → Right Hand
  story from real handoffs, a thread trail (one reused `Line2`, 8 s fade), max 2 walkers.
- SCENE + PAGE: **FilthE's cat (note 6)**: a cat that roams both floors doing cat things (naps in the sunbeam or on
  a warm desk, sits on a keyboard, knocks a pencil off a desk, chases the capsule in the tube, rides the slide).
  When a robot needs him, that robot goes to the cat and plays with it (the cat is how "needs you" finds him in the
  room). The cat stands at "your spot" when he's watching (`HUB.watching`). Page: a `HUB.cat` block (name, coat from
  Make it yours) + cues; key `Y` = "where's my cat" (camera follows it).
- PAGE: `HUB.observatory` (lanes from board owners, health rule, flow/friction/shipped), key O + the Observatory
  card; `HUB.flows` from handoff events; the tannoy line; RIGHT NOW "Handing to X".

## v28.2 "Dressed with data"
- SCENE: research wall (≤6 finding cards + strings), pin wall + Shipped shelf, QA device screens from
  `progress/result`, queue-rack count, dispatch-table cards.
- PAGE: card additions (can-do line, track record, Recent memory with "because" links, Change answer for 90 s), zone
  hover names with counts; FilthE's picks from FUNCTIONS-SHORTLIST.md.

## Review and ship (each chunk)
QA pass (the checks above + a repeat of the society panel's top complaints), adversarial review (taste, function,
rules), CHANGELOG line, publish to the same URL with `pages/crew-hq.files.json` as `files` (omit capabilities),
SPEC.md "vNN live" note, hub check-in, tell FilthE in 5 lines.
