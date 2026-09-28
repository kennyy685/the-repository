# AI hub v27 build plan (board T190 follow-up)

Architect's plan, 2026-09-28. Inputs: SPEC.md (every FilthE decision + RESUME HERE), ART-DIRECTION.md ("Nocturne"),
FUN-IDEAS.md (top 12 + outfits v2), CONVENIENCES.md (12 picks + 10 bug fixes), CONTRACT.md (now v2).

**Two tracks, two builders, no shared file.**
- **PAGE** track owns `pages/crew-hq.html` (and `pages/crew-hq.files.json` if a file is added).
- **SCENE** track owns `pages/hub/scene.js` (and `pages/hub/still.webp`, re-rendered at the end of S1 and S6).
- The only thing they share is **CONTRACT.md v2**. It is frozen for this round: a builder who needs a new field adds
  it to CONTRACT.md first, in its own commit, and tells the other track on the board. Never edit the other track's file.

**Rules for every milestone**
- Each milestone is testable on its own. Every new `window.HUB` / `window.SCENE` field is optional: the scene falls
  back to v26 behaviour when a HUB field is missing, and the page works with no scene at all (`.no-gl` still +
  hint). So PAGE M3 never waits on SCENE M3 and vice versa.
- Test the page with the CDN blocked (no scene) and with three routed locally (SPEC "Scene status"). Test the scene
  with a stub HUB (a copy of the page with fixture rows, or a small harness in the scratchpad; not committed).
- Checks per milestone: `node tests/pages/design_gate.js --page crew-hq` exit 0, `tests/pages/shots.js` clean, no
  JS errors, screenshots at **1440x900 and 1512x982** (MacBook, the priority) plus 420 px (phone keeps working).
- EN + ES for every word FilthE sees. Keys never fire while a field has focus; read `e.key`. **No key ever sends an
  answer.** Reduced motion = cuts and still frames. localStorage only inside try/catch.
- Legal copy stays clean: "registered", never "licensed"; nothing about deductibles; no "we handle your claim".
- Commit after each step with `git add <your file>` only (never `-A`), every ~30 min at most.

**One override of ART-DIRECTION.md (from the lead's M1 brief).** The Ledger sheet (ART 5, 7.5, 8.2 detent 3) is
replaced by the **right panel with tabs Crew / Board / Log / Chat**. Everything the Ledger held lives in those tabs:
Board = board table + King's orders; Log = upstairs + downstairs logs; Chat = Right Hand box + Memory (folded).
The scroll dolly stops at detent 2 (the robot + its card). Everything else in ART-DIRECTION stands.

---

## PAGE track (`pages/crew-hq.html`)

### P1. One screen, Nocturne, always fresh, answers that don't misfire  (highest impact, ~1 session)
**Layout (>= 900 px wide and >= 600 px tall):**
- `html, body {height:100%; overflow:hidden}`. **No page scroll at 1440x900 or 1512x982** (also check the real
  browser viewport ~1440x780 and the 720 px minimum).
- `#stage` is `position:fixed; inset:0`: the office fills the viewport behind everything.
- Top band y 0-72 (ART 5): brand + folio left, Needs strip center, live dot + clock + weather + "updated just now"
  + refresh button + EN|ES right. `--scrim-top`, no `backdrop-filter`.
- **Right panel** `#panel`: x `W-380 .. W-40`, y 88 .. `H-24`, `--col-w:340px`, `--scrim-col` behind, no glass box.
  Top to bottom:
  1. **Robot card** slot (only when a robot is selected; ART 7.3 look). While open, the Crew tab's list folds into
     the 40 px crew rail at the top of the card. The card's body scrolls inside itself; max ~60% of the panel.
  2. **Tab bar**: Crew / Equipo · Board / Tablero · Log / Registro · Chat / Chat. Mono 11 labels, 1 px brass
     underline on the active tab, `role=tablist`, arrow keys move between tabs. Last tab remembered (`hub-tab`).
  3. **Tab body**: `flex:1; min-height:0; overflow:auto; overscroll-behavior:contain`. Crew = the roster (ART 7.2:
     seats 01-10, UPSTAIRS/DOWNSTAIRS, fixed order, glyph + word). Board = `#boardPanel` + King's orders.
     Log = the two feeds. Chat = the Right Hand box + Memory `<details>`.
  - Move the existing `<main class="hub">` sections into the tab bodies (DOM move, same ids, so every existing
    render function keeps working).
- Bottom row y `H-56 .. H-24` left of the panel: camera buttons ("1 WHOLE ↑ UP ↓ DOWN 4 FOLLOW ·· MORE"), then
  "SKY LIVE · SOUND OFF". MORE lists only views in `SCENE.views` (CONTRACT v2).
- Publish `HUB.area` (CONTRACT v2): `{x0:40, y0:88, x1:W-420, y1:H-64}` on desktop, v26 values on phone. The
  scene stops reading `--panel-w`.
- **Phones (< 900 px):** the page scrolls, tidy: bar, Needs (stacked), stage (`clamp(460px,138vw,640px)`), then
  the panel inline with the same tab bar (tab bodies at natural height, no inner scroll), card as a bottom sheet.

**Nocturne tokens as a theme (ART 3):**
- Replace `:root` with ART section 3, split in two layers: fixed neutrals (`--bg*`, `--ink*`, `--rule*`) and **theme
  tokens** `--work` (champagne `#f1c48a`), `--need` (ember `#f5883a`), `--need-ink`, `--need-bg`, `--need-line`,
  `--jewel` (brass `#c9a45c`), `--stuck` (oxide). Keep `--ember`/`--champagne`/`--brass` as aliases to them so
  ART's CSS drops in. Nothing is named "HMP" or tied to HMP orange; P3's "Make it yours" rewrites only the theme layer.
- Set `HUB.theme` (CONTRACT v2) from the same values so the room's strips match.
- `HUB.breath` getter: the shared 5 s ember breath; the count-window dot uses it.
- Delete mint `#62d6a0`, lilac `#a9b4e6`, `#ff8479`, the teal owner chips, `hashColor`'s orange. Status = glyph +
  word + color everywhere (● working, ○ idle, ◐ asleep, ◆ needs you, ■ stuck, ✓ done). Radii 10/6, hairlines,
  no outer shadows, only the card blurs.

**Reconnect + refresh (CONVENIENCES #6 core):**
- On `visibilitychange` (visible), `pageshow`, `focus` and `online`: if `dbState !== 'on'` or the newest data is
  2+ min old, **unsubscribe every listener** (keep the handles `connect()` returns) and `connect()` again with backoff
  2 / 5 / 15 / 60 s. "Reconnecting… / Reconectando…" only after 4 s. `onErr()` schedules the same reconnect.
- A refresh button (↻, 36 px, `aria-label` EN/ES) and the **R** key do the same on demand plus `refreshAll()`,
  `renderBoard()`, `fetchWeather()` if older than 15 min.
- "Updated just now / Actualizado hace un momento" beside the clock, from `lastDataAt` (any snapshot), ticking in
  place (mono tabular, no reflow). Live dot: sage live, oxide lost, steady.

**Ship-first bug fixes (CONVENIENCES "Ship first" 1-10), each its own small commit:**
1. `kingSeen()` (~line 816): count only `code`, code's helpers and `agents/code.at`; never `king` (the Right Hand).
2. **Not now** (`sendAnswer`, ~817): save `answers/<id>` = `{answer:'Not now', back:{after:now+2h}, snoozes:n}`;
   no wake, no Right Hand follow-up. `openAsks()` / `waitingBots()` hide it until `back.after`, then it is open again
   (the full "Parked" chip comes in P5).
3. **Wake hold** (`wake()`/`fireWake()`, ~1093): answers save at once; the wake fires once, 90 s after his last
   answer, or when he answers the last open item, or on `visibilitychange` hidden. Keep the held wake in localStorage
   (`hub-wake-held`) and send it on the next open. `wakeLastAt` no longer starts at 0 = instant.
4. `askKing()` busy early-return: queue the follow-up and send it when the Right Hand is free (one batched call).
5. `qidOf()` (~582): id = agent + a short hash of the normalized ask (not `at`). Read both the new id and the old
   `at`-based id when looking up answers, so today's answers stay attached.
6. `needItems()` (~709, cap at 722): stopped robots first, then board questions oldest first; show 2 on desktop,
   then "+N" that opens a plate with all of them.
7. Right Hand `remember` (~1223): never drop the oldest silently; at 20 facts reply "memory is full, merge first" and
   write nothing. `close_question` (~1206) keeps its note in a `decided` event.
8. Seen/recap (~964-970): re-read `lastSeen` on every return, reset `recapShown` on return, `markSeen()` only after
   5 s visible and focused, then every 60 s while focused.
9. Hail sky test (~598): `mentionsHail(text)` that ignores negated mentions (no / zero / without / sin / ningún /
   no hay … hail / granizo). The P4 hail moment reuses it.
10. Orphan helpers: a helper still "working" after its King (`code`) checked out goes idle at once with the note
    "its run ended at 1:30 PM without a check-out"; the 3 h rule stays only as the backstop.

**Done when:** no page scroll at 1440x900 / 1512x982, the panel scrolls inside, tabs work by mouse and keys,
ES fits, 420 px is tidy, the gate and shots pass, and each fix has a quick fixture test (screenshot or console
assertion) noted in the commit.

### P2. Functions: the hub does the work for him  (~1 session)
- **Needs strip quick answers** (ART 7.1): count window with rolling digits + breathing dot on `HUB.breath`; up to 2
  chips then "+n"; hover/focus a chip opens a plate with the full question, three equal buttons Yes / No / Not now
  (Sí / No / Ahora no) and "Type… / Escribir…" (opens the card). Zero state: muted `00`, brass ✓, "Nothing needs you
  / Nadie te espera ahora". Publish `HUB.needs` (CONTRACT v2).
- **Tab title:** "(1) Designer needs you — The Crew" / "(1) Diseñador te espera"; plain title at zero.
- **Notifications** (CONVENIENCES #10 rules): only while the tab is hidden, only his loops (newly blocked on him,
  15 min pre-run with questions open, missed run, his loop closed), max one per 10 min, merged. Needs the
  notifications capability: **load `artifact-capabilities` first**; if it is not available, ship the tab title +
  chime only and leave a TODO. Click focuses the tab and opens that card.
- **Task detail:** click a board row (Board tab) or a task id anywhere: the card slot shows the task (id, title,
  owner, status, age from the newest of row `at` / events naming it, every event that names it, answers linked to
  it). Esc closes.
- **History:** Log tab gets day headers, a filter (All / Upstairs / Downstairs / Handoffs / Answers) and "Older"
  that reveals the rest of the loaded events. Handoffs read "Builder → QA Tester".
- **New-since dots:** a small brass dot on a tab, a roster row and a board row that changed since he last looked
  (per device, `hub-seen-map`); cleared when that tab/row is viewed. Never orange.
- **Search:** `/` focuses a search field in the panel header: filters the active tab (roster names/tasks, board
  rows, log lines, memory facts). Esc clears. EN/ES placeholder.
- **Copy:** a quiet copy button on task ids, answers, King's orders and log lines ("Copied / Copiado" 1.5 s), plus
  "Copy for Cowork" (CONVENIENCES "Also good") on an order to Cowork when Cowork has been silent 24+ h.
- **Shortcuts + `?` overlay:** 1-8 views (only built ones), 9 eyes, ↑/↓ floors, N names, R refresh, `/` search,
  A next question (focus Yes, never send), ←/→ crew rail, C/B/L/H tabs (Crew, Board, Log, cHat), Esc close, `?`
  this sheet. EN/ES, Bricolage title, mono keys.

### P3. Make it yours, the mind, the push-in  (~1 session)
- **"Make it yours" / "Hazlo tuyo" panel** (opened from a small ◇ button by EN|ES and from `?`): accent color
  (6 curated swatches + custom picker for "working"), needs-you color (ember default, 4 curated warm swatches; the
  gate's contrast check must still pass, so reject a pick under 4.5:1 with a one-line reason), theme (Nocturne dark
  default; "Ledger" light option; "Midnight" deeper), strip mode (`ember-only` default / `brand`), the hub's name
  (default "The Crew / El Equipo", 24 chars), sound on/off, reduced effects. Saved per device in `hub-theme`
  (try/catch). Live preview; "Reset / Restablecer". Every change bumps `HUB.theme.v`.
- **The mind** (ART 6.5): `<canvas id="mind">` in `.sky`, half-res, 30 fps, 700 particles (250 phone), driven by
  working share, sleep, stuck, needs (ember band at the waiting robot's `SCENE.anchors[id].x`) and handoffs (a brass
  comet from sender to receiver x, fired when the page pushes onto `HUB.handoffs`). Pauses hidden/off-screen; still
  frame under reduced motion; off under `.lowfx`. Colors come from `HUB.theme`.
- **Scroll push-in** (ART 8.2, minus the Ledger): wheel over `#stage` only, `pointer:fine`, >= 900 px. Normalize
  `deltaMode`, 90 px per detent, lock until `!SCENE.tweening` and 180 ms of quiet. Detents: 0 Whole (`cam='all'`)
  → 1 the focus robot's floor → 2 the focus robot (`cam='follow'`, `selected`, card open). Focus = first in
  `HUB.needs.ids`, else first stuck, else selected, else the King. Pinch maps the same; horizontal ignored. One-time
  hint "Scroll to move in · N for names / Desliza para acercarte · N para nombres". Publish `HUB.dolly`.

### P4. Awareness, interactive scenes and the fun layer, page side  (~1-2 sessions)
- **Greeting:** on open, the Right Hand's bubble says good morning / afternoon / evening (Fremont time, EN/ES) +
  one "since you left" count; push cue `arrive` (roll call). Once per visit.
- **Pointer + presence:** keep `HUB.pointer` (stage px, 10 Hz) and `HUB.watching` (focused + pointer moved in the
  last 2 min) for heads that follow the cursor and the "straighten up" rule. `HUB.hover` from roster-row hover and
  a 10 Hz `SCENE.pick`. Spotlight scrim (ART 7.4) on hover/selection.
- **Thank-you:** after an answer, push cue `answered {id: asker, qid}` (Special Delivery + bow) and show the brass
  receipt "Saved · the King has it / Guardado · el Rey ya lo tiene".
- **The Call window** (FUN 4): a `.call` card at the stage's bottom-left with a `#pip` box (the scene renders the
  robot's face into it, CONTRACT v2), the question and the same three buttons + type box; stacks "+2"; folds to a
  face chip after 60 s; never opens while an input has focus.
- **Robot eyes HUD** (FUN 5): key 9 / "Eyes / Ojos" on the card sets `cam='eyes'`; the page draws the gear frame
  (CSS/SVG per robot, v1: King, QA, Engine Mechanic, Storm Watch) and the HUD line (name, task, `doing`, progress).
- **Interactive:** double-click a robot → cue `poke {id, line}` with a real number line in an EN/ES speech chip
  (QA checks passed, Storm Watch last scan, Builder last version, King items done; 8 s cooldown). Drag the coffee
  cup icon (bottom row) onto a robot → cue `coffee {id}`. Stand-up / QA red card / high-five chain are scene-driven
  from data (no page work beyond `spot` and events already in HUB).
- **Signature chimes** (FUN 6, ART 8.8 levels): per-robot WebAudio synth behind the one sound switch, 1 per 3 s,
  quiet 10 PM-7 AM except hail, "Sound check" row in Make it yours.
- **Data for the scene's fun:** `agent.since`, `agent.gear`, `agent.silent`, `HUB.stormWatch`, `HUB.flap`,
  `HUB.bugs`, `HUB.sky.state.wind`, `HUB.afterHours` (all in CONTRACT v2). Pin colors: Storm Watch `#f2c230`,
  Research Lead `#a3a86a` (FUN 3 rule 10). Flat avatars redrawn to outfits v2 silhouettes (match
  `outfits/lineup.html`).

### P5. Conveniences  (~1-2 sessions; in CONVENIENCES rank order)
1. **One wake per sitting** (#1): ride the next run when it starts within 20 min or in quiet hours; "Rides the 12:52
   run · in 9 min · Wake now"; hold while a King is running; safety net 15 min after the slot; two-device check;
   urgent skips the hold. Reads the King trigger with `get_trigger` when allowed, else the fixed Central slots via Intl.
2. **Run watchdog + one health line** (#2) in the live pill; scene dims silent robots via `agent.silent`.
3. **Not now means later** (#3): the "Parked · 2" chip, return after `after`, then/now line, "Let the King decide".
4. **You already decided this** (#4): exact re-post carry-over + near-match "Same answer" (no preselect).
5. **Silence is a safe answer** (#5): crew pick line, "Your call" tag, "Crew is going with: X" after `by`.
6. **Battery** (#6 rest): `HUB.power` = `saver` when unfocused or no pointer 2+ min.
7. **Nothing changes behind your back** (#7): `decided` events list with Undo / Reopen; memory meter at 18+.
8. **Proof it landed** (#8): Saved → Rides 12:52 / With the King → Read → Done; change until Read; dropped-answer line.
9. **Real blocker on top** (#9): `holds` sort, "Holding up Builder + QA · waited 1 run", "Can wait · 3" fold.
10. **Forgotten tasks float up** (#11): per-row age, "quiet 4 days", `system/stale` once a day.
11. **The morning note** (#12): three lines max, "All clear … You can close the lid", "Today" pill.
12. "Also good" smalls: saving mode after a limit, today's usage on the King's card, Right Hand keeps promises, chat
    survives reload, stuck across runs, KFET storms overnight, "12:52 run in 10 min" header.
- Crew-side contract changes (new `answers` fields, `decided` events, `rec/why/by/default/holds`) go to the
  crew-checkin skill in a separate change owned by the King, not this track.

### P6. Performance, gates, release  (~0.5 session)
- `HUB.power` / `HUB.onLowFx` wiring: 30 fps idle cap, `.lowfx` (card solid, mind off), phone mind 250.
- Design gate: add the orange allow-list grep (ART risk 9) for the page's `--need`/`#f5883a` uses; contrast in every
  sky state and theme.
- Screenshots 1440x900 + 1512x982: night, blue hour, day, storm, card open, a waiting robot, each tab, ES, Make it
  yours open; 420 px. v26 vs v27 side by side (ART risk 1).
- `release_checks.sh --fast`, CHANGELOG line, publish per the SPEC go-live rule with `crew-hq.files.json`.

---

## SCENE track (`pages/hub/scene.js`)

### S1. Nocturne light, champagne/ember strips, the camera system  (highest impact, ~1 session)
- **Tone + materials** (ART 9 steps 1, 3): `NeutralToneMapping` exposure 1.0 (night 1.05); the `MAT` retune to ART 3
  (satin ceramic, honed travertine, polished dark downstairs stone, oiled walnut, brushed brass, neutral glass,
  cognac leather, oat rug). A/B one pair against AgX. Custom PMREM studio replaces `RoomEnvironment`.
- **Light rig** (ART 6.2): hemisphere -45%, 3200K raking key with the 8° clamp + night moon, cool rim, lamps per
  ART 3, delete `shadow.radius`, the linear brass pendant + one PointLight over the Code lab, sprite halos (bloom).
  The call SpotLight created at init at 0. Budget 10 lights, none added at runtime.
- **Strips** (ART 6.6) from `HUB.theme` (CONTRACT v2) with ART's defaults: working = `work` (champagne) + chase dot;
  idle = work mixed toward ceramic; waiting = `need` (ember) + halo on `HUB.breath` (fallback: own 5 s clock);
  stuck = oxide steady (delete the `Math.random()` flicker); sleeping = off + brass pilot dot. `stripMode:'brand'`
  keeps every strip `need`-colored. Never `multiplyScalar` orange. Re-color on `HUB.theme.v` change only.
- **Orange discipline in the room:** slide inlay, tube cap ring, "your spot" ring, pod strips, ledge light → brass
  or champagne. Board TONE green/red → sage/oxide.
- **The Call pool** (ART 6.2/8.4): when `HUB.needs.ids[0]` (fallback: first waiting agent) exists, pool rises to 18
  over 1.2 s above it, lamps ease to 0.88x; reverse on clear.
- **Camera system skeleton:**
  - One view registry `VIEWS = {all, up, down, follow, blueprint, cctv, ride, window, tilt, tour, director, eyes}`;
    each entry `{built, rect(), perspective?}`. S1 builds `all` (1 Dollhouse), `up`, `down`, `follow` (4 Ride-along
    = follow framing for now). Unbuilt ids resolve to `all`. Publish `SCENE.views` = built ids.
  - A 750 ms easeInOutCubic tween on the ortho rect for every discrete change (view, floor, selection, card
    open); Follow keeps damped tracking (k = 5); reduced motion cuts. `SCENE.tweening` getter.
  - Key 9 `eyes`: stub that falls back to `follow` until S6.
  - `area()` reads `HUB.area` (CONTRACT v2), falls back to today's `--panel-w` math.
- **Done when:** night / blue / day / storm screenshots at 1440x900 show pools of warm light with shadow between,
  champagne workers, one breathing ember, brass not yellow (ART risk 4: waiting strip within ΔE 5 of the theme's
  need color); re-render `still.webp` from `#capture`.

### S2. The room, finished: precision, depth, delivery  (~1 session)
- Architecture (ART 6.3/6.4): bronze .04 mullions with 2 mm offset, poche cut faces + brass reveals with
  `polygonOffset`, the tower with fins + fog on exterior materials only, polished-floor reflection sprites, three
  lamp streaks on the front glass.
- Fewer, better (ART 6.6): three plants, grouped props + one 1.25x hero prop per desk, brass desk plates "No. 01-10",
  MeshBasic desk status light bars, the glass board showing real counts (from `HUB.boardInfo`), one needs row ember.
- Handoff = manila envelope with a brass seal + brass trail; gold-leaf confetti; trophy plaque light sweep.
- **Special Delivery** (ART 8.5): consume cue `answered` from `HUB.cues`: brass capsule to the tube base, up the
  tube, lands at the King's desk; the asker bows; skip the bow if hidden.
- `agent.silent`: strip grey, robot dims slightly. `HUB.afterHours`: lamps x1.2 at #ffb877, desk lamp + cup on
  robots still working.
- **Power:** `HUB.power` (`full` / `saver` 30 fps + DPR 1.25 / `paused`), 30 fps idle cap after 10 s calm,
  `SCENE.busy`; on DPR auto-drop call `HUB.onLowFx(true)` and halve sprites.

### S3. Outfits v2  (~1-2 sessions)
- Everything in FUN-IDEAS section 3: split `dress()` into moving groups (`R.hatG`, `R.faceG`, `R.prop`, `R.cape`,
  `R.tie`, `R.card`, `R.anemo`, `R.jewel`) with pivots at the hinge; the ten "editions"; fedora for Research Lead;
  4 material families; one live light per robot; budgets (7 draw calls, ~1.5k tris desktop / 800 phone).
- **State grammar:** working gear on; waiting = hero piece offered to the camera; blocked = askew 8-15°; sleeping =
  over the eyes; done = one flourish ≤ 1.2 s; idle = relaxed tilt; whole board done = hat toss once a day.
- **Earned gear** from `agent.gear` (CONTRACT v2): crown gems, decals, sash badges, hail pins, PASS pin, etc.
- Replace the magic `R.hat` offsets with real bounding-box tops. Re-run the 40 px silhouette row in
  `outfits/lineup.html` and one row per state (scratchpad screenshots).

### S4. Eyes, mood and personalities  (~1 session)
- Eye ShaderMaterial plane per robot (`shape`, `look`, `open`) replacing `G.eyes`: working scan, waiting round,
  blocked squint, done ^ ^, sleeping flat, idle wander; shapes morph.
- Glance: on a `seq` flip to done/waiting the others look (eyes, then heads). In the zone after 45 min (from
  `agent.since`): lean 8°, chase 1.5x, desk pool, passers tiptoe. Blocked acted out, cycle 6 s → 20 s with age.
- Motion pass (ART 8.3): breathing phase by seat, head leads body, cape/tie/antenna spring, sleep slow-in.
- Personalities: King's cape swish, QA re-checks its clipboard, Storm Watch yawns at 6:54, Designer squints at the
  board, one idle habit per robot at full amplitude.
- Mood lighting from real streaks/blocks (`HUB.flap`): tiny warm/cool shift, never orange.

### S5. Awareness + interactive scenes  (~1-2 sessions)
- Roll call on cue `arrive` (seat order, 70 ms apart, King nods last, 1.2 s, once per visit).
- Heads follow `HUB.pointer` for robots within ~300 px; `HUB.hover` perks one up; idle robots straighten while
  `HUB.watching`, lounge again after.
- **Your figure** at "your spot" while the hub is open; **the line at your spot** (FUN 2): brass posts, velvet rope,
  up to 5 queue slots in `HUB.needs.ids` order, wait sign from `agent.since` (redrawn once a minute), posture ages
  with the wait, rope unhooked at zero. Publish `SCENE.points.spot` for the page.
- Thank-you per outfit on cue `answered` (bow, salute, cap tip, hard-hat tap), then back to its desk.
- Interactive: cue `poke` (in-character reaction; the page shows the line), cue `coffee` (perks up), QA carries a
  red card to the Builder on a QA `blocked` event naming the Builder's task, stand-up gather (`spot:'standup'` x3+:
  King points, one dozes), big finish = high-five chain + victory lap down the slide.
- Thought icons over working robots from `agent.doing` keywords (hail cloud, bug, paintbrush, wrench, book).

### S6. Cameras, eyes and the fun layer  (~2 sessions)
- Views 2 Blueprint, 3 Security cam (Cam 1 up / Cam 2 down, timestamp + grain via page overlay class), 5 Through the
  window, 6 Tilt-shift, 7 Tour, 8 Director (auto-cuts: finish → celebration, question → your spot; 400 ms settle).
  Add each to `SCENE.views` when built.
- **Robot eyes** (key 9, FUN 5): shared `eyeCam(id)`, own head on layer 1, v1 lenses King, QA, Engine Mechanic,
  Storm Watch; slide/tube ride in first person (fov 110); reduced motion = still.
- **The Call face-cam** (FUN 4): render the asker's face into the `#pip` box (scissor render, 360 px target, every
  other frame, only while `HUB.pip` is set).
- **Storm Watch's morning** (FUN 7): fog note on the glass, "days since hail" flip counter, real-direction cloud from
  `HUB.stormWatch`, rim notch per hail day. **Hail alert moment**: sky darkens, lightning, everyone turns to the
  window, Storm Watch runs to your spot (on cue `hail`).
- **Station board** (FUN 8): split-flap on the glass board (one InstancedMesh + glyph atlas) flips when the King's run
  updates `HUB.boardInfo`; the coffee-bar sign from `HUB.flap`.
- Re-render `still.webp`.

---

## Sync points between the tracks
| When | PAGE provides | SCENE provides |
|---|---|---|
| P1 / S1 | `HUB.area`, `HUB.theme`, `HUB.breath`, `HUB.needs` (P1 may ship `needs` early; S1 falls back) | `SCENE.views`, `SCENE.tweening` |
| P2-P3 / S2 | `HUB.cues` (`answered`), `HUB.dolly`, `HUB.power`, `HUB.onLowFx`, `agent.silent`, `HUB.afterHours` | `SCENE.busy`, delivery + bow |
| P4 / S3-S5 | `agent.since`, `agent.gear`, `HUB.pointer`, `HUB.watching`, `HUB.hover`, cues `arrive`/`poke`/`coffee`/`hail` | reactions, the line, `SCENE.points` |
| P4 / S6 | `#pip`, `HUB.pip`, `cam:'eyes'` HUD, `HUB.stormWatch`, `HUB.flap`, `HUB.bugs` | eyeCam, faceCam, flaps, views 2-8 |

## Later (too big for this round)
- Pneumatic mail (FUN 9; replaces the envelope; pipes across two floors).
- Welcome back: brass elevator + dial, the interview chair and its EN/ES line bank (FUN 10).
- QA's bug jar (FUN 12) and "Poke it" for the other six robots.
- The other six eye lenses (Right Hand, Builder, Designer, Research Lead, Cowork, Chat Reader) and the heavy filters.
- "Your chair" camera (key 0) and the See-what-it-sees picture-in-picture on every card.
- Drag-a-coffee physics beyond the drop target; weekend ping-pong; Employee of the Week; Team photo button; work
  buddies; the Chat Reader's news ticker; answer capsule stations at your spot.
- SBB clock downstairs, charging-pod countdown arcs, Solari flips beyond the board, "Picked up in 0:42" lap time
  (needs a King pickup timestamp in the crew-checkin contract).
- FUN "Parked" list (frosted visor, chase variants, scout drones, Polaroids, the office grows, Nebraska calendar,
  multiviewer, fitting room, sealed orders, desk miniatures).
- Idea Vault round (IDEA-VAULT.md) re-run, if FilthE wants it.
