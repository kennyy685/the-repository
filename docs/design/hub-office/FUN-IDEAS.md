# Hub office: fun ideas, robot eyes, outfits v2

Follow-up to board T190 (Penthouse HQ) · 2026-09-28 · for `pages/crew-hq.html` + `pages/hub/scene.js`

FilthE asked: "make the outfits more appealing, open their points of view more, have fun ideas in mind and recommend
me stuff, I have a feeling we can make it funner."

**Status:** recommendations only. Nothing in this file is built or published. The Builder owns `pages/hub/scene.js`.

**How these were picked:** about 60 ideas from one idea round, two judges scoring fun / useful / classy / buildable,
duplicates merged, then re-ranked by FilthE's own rule (SPEC.md, 2026-09-28): *convenient, carefully thought-of things
he wouldn't have thought of* come first. Fun that also tells him something beats fun on its own.

**Rules every idea here keeps**
- Hub data only: `agents`, `events`, `board/current`, `answers`, `system/*`, weather. Never HMP App leads, doors,
  claims or money. Storm info = size, town and direction only, never addresses.
- Every animation comes from a real event. No fake help, no fake urgency, no invented handoffs.
- Red means blocked and nothing else. HMP orange = the light strip + each robot's one live light.
- MacBook first (1440-1512 px, trackpad + keys). Phones only need to keep working.
- Reduced motion: final poses and cuts; no spins, flights or rides.
- localStorage only inside try/catch, and never required for anything to work.

**Size key:** S = a few hours · M = about one Builder session · L = 2-3 sessions.

---

## 1. Top 12

### Build now

#### 1. Wardrobe v2: outfits that dress for the moment
- **Pitch:** every robot gets a real costume (a shape you know from across the room, a real fabric, a brass detail,
  one live light) that changes with what it's doing and fills up with what it has finished.
- **Trigger:** always on. State changes (`st` / `seq`) move the gear. `done` events and board DONE items add earned
  pieces.
- **Why it's fun + useful:** it's exactly what he asked for, and it doubles as a status screen he never has to read.
  Hat held to the chest = waiting on you. Hat over the eyes = asleep. Goggles down = the engine is running.
  3 of 5 crown gems lit = 3 board items done today.
- **Size:** L (static costume pass M + moving gear and earned pieces M).
- **Where:** scene.js `dress()` + the pose loop. The page adds `agent.gear` and redraws the flat avatars to match.
  Full spec in section 3.
- **Merges:** Series 1 wardrobe, Costume pass, Costume beats, Gear that reacts, Outfits that wear the mood, Hats off
  for the boss, The costume is the status light, Earned gear, Signature celebrations (one flourish per finish).

#### 2. The line at your spot
- **Pitch:** robots that need you queue behind brass posts and a velvet rope, oldest question in front, under a small
  brass sign: "Wait: 2 h 10 min / Espera: 2 h 10 min".
- **Trigger:** agents with `st` = waiting (plus board waiting questions not yet in `answers`), ordered by when they
  started waiting.
- **Why it's fun + useful:** who needs you, in what order and for how long, in one glance from across the room.
  When nobody needs you the rope hangs unhooked from one post: "all clear" without a word.
  - Posture ages with the wait: under 10 min, hovering alert with hands together. 10-60 min, settled lower with a
    glance up the stairs. 1-4 h, sitting on a small leather bench, reading. Overnight, dozing upright.
  - Answer one and it thanks you in its outfit's way (King bows with a cape sweep, Cowork salutes, Chat Reader tips
    his cap, QA pushes up its glasses, Builder taps its hard hat), then takes the tube or the slide back to its desk
    and the line steps up one place.
  - More than 5 waiting: the sign adds "+2". A robot blocked until you answer stands in a short priority lane.
- **Size:** M.
- **Where:** scene.js (5 queue slots on a gentle curve, bench, posts + rope merged into one mesh, sign CanvasTexture
  redrawn once a minute, the pose ladder, a `bow` pose). Page passes `since` and shows the same wait time in the
  NEEDS YOU pill so the page and the room agree.
- **Merges:** The Queue Line, Take a number, The line at your spot (posture), The polite line. Builds on the approved
  FilthE figure and thank-you.

#### 3. Eyes and body language
- **Pitch:** the two eye lights and the posture act out the real state, so the room reads without a single label;
  when someone finishes or asks a question, the others glance at it, eyes first, then heads.
- **Trigger:** each robot's `st`; `seq` flipping to done or waiting starts the glance; `since` drives the long-work
  and long-block acting.
- **Why it's fun + useful:** the fastest possible read of the whole crew, and the glance pulls his eye to whatever
  just happened.
  - **Eyes:** working = narrow ovals scanning like reading lines · waiting = big round eyes · blocked = one squint,
    the "huh?" look, in the red it already has · done = happy arcs (^ ^) · sleeping = two low flat lines · idle =
    soft ovals that blink and wander. Shapes morph, never pop.
  - **In the zone:** after 45 min of unbroken work the robot leans in 8°, its strip chases 1.5x faster and a warm
    pool of light forms on its desk. Robots passing within 1.2 m slow down and hover lower (tiptoeing). Card line:
    "in the zone 2 h 10 m / concentrado 2 h 10 min".
  - **Blocked, acted out:** try (hands to the screen, screen blips red), recoil, sigh (sinks 3 cm, strip dims), tap
    the visor, try again. The cycle slows from 6 s to 20 s as the block gets older: a slow sigh = an old problem.
    If the King is awake he glances at the stuck robot every 10 min. A neighbour only walks over when a real handoff
    names it.
- **Size:** M (eyes S + zone S + blocked cycle S).
- **Where:** scene.js only: a small eye ShaderMaterial plane per robot (uniforms `shape`, `look`, `open`) replacing
  `G.eyes`; a decaying `lookTarget` per sim; the stagger in the `sim.seq !== a.seq` branch; the blocked cycle
  replaces today's blocked hand wobble. Needs `since` from the page.
- **Merges:** EVE eyes, In the zone, Blocked acted out.

#### 4. The Call (answer without moving the camera)
- **Pitch:** when a robot reaches your spot with a question, its face pops up in a small corner window like FaceTime,
  looks right at you, and you answer there without leaving the view you're in.
- **Trigger:** a robot arrives at your spot in the waiting pose.
- **Why it's fun + useful:** the most convenient way to answer on a MacBook: no camera move, no hunting for the card.
  Same Yes / No / Not now + type box, same save (`answers/<id>` + handoff + the King's instant wake). Two or more
  waiting stack like call waiting ("+2"). Ignored for 60 s, it folds down to a small face chip. No ringing loop.
  - **Your chair (key 0, "Your chair / Tu silla"):** a camera from your own seat at your spot. The line from idea 2
    stands in front of you holding its question cards and you work through them like office hours. Nobody waiting:
    "Nobody needs you right now / Nadie te necesita ahora".
- **Size:** M.
- **Where:** scene.js `faceCam` (fov 30, 0.7 m in front of the head, 360 px target, every other frame, only while
  open) + a `chair` camera mode. Page owns the `.call` card and reuses the existing answer function. It never opens
  while an input has focus and waits behind any camera shot that's already playing.
- **Merges:** The Call, Your chair.

#### 5. Robot eyes (key 9)
- **Pitch:** pick a robot, press 9 (or "Eyes / Ojos" on its card) and see the office through its eyes, framed by its
  own gear, then ride the slide with it in first person.
- **Trigger:** on demand. Director mode cuts to it whenever a robot rides the slide or the tube.
- **Why it's fun + useful:** the direct answer to "open their points of view". Each view carries a layer of real
  data that robot owns (the King sees everyone's task, QA sees its checks), so it's a fun camera and a detail view
  at the same time. All 10 are in section 2.
- **Size:** L (shared rig + 4 lenses M; each other lens S).
- **Where:** scene.js: one shared `eyeCam(id)`, also used by the approved "See what it sees" picture-in-picture.
  Page: the gear frames as CSS/SVG overlays (no extra 3D cost), the HUD, key 9 and Esc.
- **Merges:** Gear is the lens, Visor cam (x3), Wear their hat, See the office through their eyes, Hat-cam victory lap.

#### 6. Signature chimes + a tab that tells you
- **Pitch:** each robot gets its own tiny, classy sound, so from another tab you know who needs you by ear, and the
  tab title says it too: "(1) Designer needs you / (1) Diseñador te espera".
- **Trigger:** a robot newly waiting plays its chime once (in place of the generic ding). Done = the chime resolves
  upward. Blocked = it bends down.
- **Why it's fun + useful:** he works with other tabs open; this is the zero-effort way to know the crew needs him,
  and every sound has a visual twin (the tab title), so it still works muted.
  - King: low brass fifth · Right Hand: concierge desk bell · Builder: two woodblock taps · Designer: harp pluck ·
    Engine Mechanic: anvil tink · QA: rubber-stamp thunk · Research Lead: three rising notes · Cowork: double ship's
    bell · Storm Watch: rising minor third, distant thunder only on real hail · Chat Reader: typewriter bell.
  - Rules: off by default (the one existing sound switch), at most one sound every 3 s, quiet 10 PM-7 AM except
    hail, max -20 dB, nothing loops. A "Sound check" row plays each chime with the robot's name.
- **Size:** S.
- **Where:** page only (WebAudio synth, no audio files; AudioContext starts on the first click; switch saved in
  localStorage inside try/catch).
- **Merges:** Every robot has its own chime, A signature sound for each robot.

#### 7. Storm Watch's morning
- **Pitch:** every morning Storm Watch drags itself up at 6:54, scans, and leaves you a note fogged on the window: a
  crossed-out hailstone for nothing, or the size when it finds hail. A brass flip counter on its table reads
  "Days since hail / Días sin granizo".
- **Trigger:** Storm Watch leaving `sleeping` (its real 6:54 run) and its `done` event.
- **Why it's fun + useful:** the morning scan result stays on the glass all day, readable from across the room.
  - **The wake:** the pod opens, a small brass alarm rattles, it taps it off, it rattles once more (always exactly
    one snooze). Sou'wester on crooked, straightened, then it drifts to the radar at 70% speed with a tiny espresso.
  - **No hail:** it breathes on the glass, finger-draws a hailstone with a slash + "6:54" and goes back to bed. The
    counter clacks up one.
  - **Hail:** the counter snaps to 00, the hat blows off, the approved hail alert plays, and the storm cloud appears
    **on the horizon in the real direction from Fremont**, taller for bigger hail (1 in = modest, 2 in+ = towering).
    Robots turn to that window. One small brass notch is cut into the radar table's rim per hail day, so the table
    becomes a record of the season.
  - Open the hub before 6:54: Storm Watch opens one eye light at you and closes it again.
- **Size:** M (note + counter S; the real-direction cloud M).
- **Where:** scene.js (fog-note plane with a CanvasTexture drawn stroke by stroke over 1.5 s, flip counter, cloud
  billboards on a ring at the town's bearing, rim notches). Page computes `HUB.stormWatch`. One optional check-in
  field for Storm Watch: `storm: {inches, town}` (crew-checkin skill).
- **Merges:** Storm Watch's 6:54 note, Dry-spell flip counter, The storm shows up where it really is, Storm bell
  (rim notches), Storm Watch's dawn report.

#### 8. The station board (the King's three runs flip it)
- **Pitch:** the glass task board becomes a brass split-flap departures board; when the King really runs (7:52 AM,
  12:52 PM, 5:52 PM) it clatters over to the new plan, each task a "flight" with its crew and status.
- **Trigger:** `board/current` updated by the King (`updatedBy` code, new `updatedAt`). A show only plays for a run
  that happened.
- **Why it's fun + useful:** he sees that the King ran and what the plan is without opening anything.
  - Statuses: ON TIME / A TIEMPO (working) · BOARDING / ABORDANDO (just started) · DEPARTED / SALIÓ (done) ·
    DELAYED / RETRASADO (blocked) · SEE YOU / TE ESPERA (waiting on you). Robots that just got a task turn to the board.
  - A smaller flap sign over the coffee bar with three rows: DAYS WITHOUT A BLOCK / DÍAS SIN BLOQUEOS ·
    SHIPPED THIS WEEK / ENTREGADO · WAITING ON YOU / TE ESPERAN. It flips between English and Spanish every 20 s.
    A new block: QA floats over, sighs, and flips it back to 00 by hand. A new record: the brass warms and the King
    slow-claps from the balcony. (Count blocks, not "bugs": not every block is a bug.)
  - 5:52 PM wrap: one line fades up on the glass, "Today: 7 done · 1 stuck · 0 need you / Hoy: 7 terminadas ·
    1 bloqueada · 0 te esperan", and a Postcard button saves a tilt-shift photo of the room with that caption.
- **Size:** M for the board + sign (one flap renderer serves both). The rope-drop and goodnight light sequences are
  a later M.
- **Where:** scene.js (one InstancedMesh of flap halves + one shared glyph atlas, about 3 draw calls per board, only
  animating while it flips). Page computes the rows, keeps the best streak in the hub db (`system/records`), and
  writes the tally line to an aria-live region.
- **Merges:** Showtimes, Split-flap sign, The King's rally (postcard).

### Next

#### 9. Pneumatic mail
- **Pitch:** brass pneumatic tubes along the ceiling, like an old bank; every handoff shoots a glass capsule through
  the pipes ("fwoop... thunk") into the receiver's desk tray, where it glows until the robot actually picks it up.
- **Trigger:** `handoff` events. FilthE's answers leave from a brass station at your spot. "Picked up" = the receiver
  checks in after it.
- **Why it's fun + useful:** glowing capsules = unread messages, including his. Three glowing in the King's tray =
  the King hasn't run since you answered.
  - Inside the glass you see the sender's own item: Chat Reader a rolled newspaper, Designer a swatch card, Builder a
    blueprint roll, QA a stamped sheet, Right Hand an envelope, Engine Mechanic a brass cog. The King's orders carry
    an orange wax seal.
  - A capsule unopened for 24 h dims: a quiet "stale", no alarm.
- **Size:** L (routing pipes across two floors is the cost).
- **Where:** scene.js (pipes = one merged brass mesh per floor, a precomputed curve per sender-receiver pair,
  capsules = one InstancedMesh, a tray with 3 slots per desk). Page supplies "picked up". Replaces the approved
  glowing folder.
- **Merges:** Pneumatic mail, Paper airplanes / tube mail, The King's sealed orders (seal + stale), signature handoffs.

#### 10. Welcome back
- **Pitch:** on the first open of the day you arrive by brass elevator, and the needle on an Art Deco dial above the
  doors stops on how many things need you before the doors part; after 3+ hours away, 2-3 robots sit in an interview
  chair by the window, The Office-style, and each gives one dry line about what really happened.
- **Trigger:** first open of the local day (elevator, about 4 s, any key skips). 3+ hours away (the interviews
  replace the plain replay).
- **Why it's fun + useful:** the recap he'd want, told the funny way.
  - Lines are hand-written ahead of time in EN and ES with the real numbers dropped in. No AI writing at runtime,
    no line repeated within 7 days.
  - Samples: QA "It passed. Everything. First try. I'm going to test it again." · King "I don't micromanage. I just
    posted 6 orders before 8 AM." · Storm Watch "6:54. Four states. Zero hail. Great." · Builder, after a QA
    block: "QA found a bug." (looks at the camera).
- **Size:** L (the line bank is the real work).
- **Where:** page (line bank per robot x event kind, picker ranked hail > blocked > done > orders > handoff,
  captions + lower-third in Bricolage/Geist). scene.js (elevator doors + dial, interview chair, camera preset with a
  slow push-in).
- **Merges:** The Arrival, The Confessional. Builds on the approved "While you were away".

#### 11. Poke it
- **Pitch:** click an idle robot and it does its outfit's trick plus one real number: QA flips its clipboard,
  "212 checks passed this week"; Storm Watch shows its last scan time; the Builder holds up its last published version.
- **Trigger:** a click with no drag, 8 s cooldown per robot. A working robot holds up one finger ("one sec") and
  shows its progress ring instead.
- **Why it's fun + useful:** exploring the office is also checking on it. Secret: poke the King 5 times in a row and
  he offers you the crown (a crown shadow crosses your view).
- **Size:** M (ship QA, Storm Watch, Builder and King first).
- **Where:** scene.js raycast + short pose clips. Page shows the EN/ES speech chip with the number. Upgrades the
  approved double-click reactions with a real number each.

#### 12. QA's bug jar
- **Pitch:** QA keeps every open block it raised as a small amber firefly in a glass jar on its desk; when that task
  is fixed, QA lets one out the window and it becomes a faint star over the grain elevator.
- **Trigger:** a QA `blocked` event (into the jar); that task going DONE (released). Stars clear Monday morning.
- **Why it's fun + useful:** the jar is what's still open, the stars are what got fixed this week. Gag: jar empty for
  24 h, QA peers into it with its loupe, suspicious that it's too quiet. Hover the jar for the open task ids.
- **Size:** M.
- **Where:** scene.js (glass jar + brass lid, up to 12 fireflies as Points in amber `#ffc46b`, never red; star Points
  outside the glass). Page computes `HUB.bugs`.

### Build order
1. Wardrobe v2 static pass + split the moving gear into its own groups, then Eyes and body language. Everything after
   reuses those groups.
2. The line at your spot + The Call + chimes: the "needs you" trio. Add `since` to the contract once.
3. Robot eyes: shared rig + King, QA, Engine Mechanic and Storm Watch first.
4. Storm Watch's morning + the station board.
5. The Next list, in order.

Every publish follows `docs/release-checklist.md` (design gate `--page crew-hq`, shots.js, `release_checks.sh --fast`,
CHANGELOG line) and the go-live rule in SPEC.md.

### Data the page adds (one contract change, CONTRACT.md)
All optional. The scene falls back to today's look when a field is missing.
- `agent.since`: ms timestamp the current state began (from the agent row's `at`). Used by ideas 2, 3, 4.
- `agent.gear = {count, progress:{done, of}, flag}`: earned pieces and live readouts (section 3, rule 8). Bump `seq`
  when it changes.
- `HUB.stormWatch = {dryDays, lastHailAt, inches, town, dir}` (idea 7).
- `HUB.flap = {blockDays, bestBlockDays, shipped, waiting}` (idea 8). Best streak lives in `system/records`.
- `HUB.bugs = {open:[taskIds], fixedThisWeek:[taskIds]}` (idea 12).
- `HUB.sky.state.wind` in mph, from the NWS observation the page already fetches (Storm Watch's anemometer).

Check-in change (crew-checkin skill): Storm Watch may add `storm: {inches, town}`. Nothing else is required.

---

## 2. Robot eyes (all 10)

**Shared rig.** One `eyeCam(id)` in scene.js: a PerspectiveCamera (fov ~64, near .02) at the visor, head-space
(0, -.004, .2), aimed at what the robot is really looking at, smoothed by a critically damped spring with the yaw
clamped so it never lurches. The robot's own head, visor and hat go on layer 1 and are hidden from this camera.
- Full screen = key 9 or "Eyes / Ojos" on the robot's card. Esc glides back to the last view.
- The approved "See what it sees" picture-in-picture is the same camera at 480x300, at most one eye rendered per frame.
- Gear frames are CSS/SVG overlays over the stage: sharp on Retina, about 1 KB each, no extra 3D cost.
- Every view shares one quiet HUD at the bottom: name, task id, its real `doing` line and progress ring, EN/ES.
- When the robot rides the slide or the tube, you ride it in first person (wide fov 110 with a slight barrel curve).
  Director mode cuts to this view for every ride.
- Reduced motion: a still frame, no ride, no drips or sparks.

**What it looks at follows its real state:** working = its desk screen (drawn with its real `doing`), waiting = your
spot and your figure, stand-up = the board, sleeping = the inside of its charging pod, riding = the slide or tube
ahead.

**v1:** King, QA Tester, Engine Mechanic, Storm Watch. Heavy filters (wireframe room, grey-except-orange) come later.

**The King**
- Frame: the crown's points silhouetted along the top edge; a thin gold 2.39:1 letterbox. Looks down from the balcony.
- Real-data layer: a small tag over every robot with its board task id + status (a command view). The robot that got
  his latest order is centred, with that order as the subtitle.
- Gag: the Right Hand is always in frame, standing a little too close.

**Right Hand**
- Frame: the headset band at the edges and a thin live voice waveform along the bottom (moving while its last event
  is under 2 min old). An "ON AIR / AL AIRE" tally in the corner while it's relaying your message.
- Real-data layer: everything dims except robots waiting on FilthE and the newest handoff line. It looks at your figure.
- Gag: in the King's view it's too close; in its own view the King is always just out of frame, and it keeps checking.

**Builder**
- Frame: the orange hard-hat brim across the top, the headlamp's warm pool on its screen, a tiny brass bubble level
  at the bottom.
- Real-data layer: its screen shows the page it's building as an outline that adds one block per progress step.
  Later: the room drawn as blueprint edges, with the thing it's building glowing.
- Gag: the bubble never quite levels until the task is done, then it clicks dead centre.

**Designer**
- Frame: the black beret's edge top-left, crop marks in the four corners, a faint rule-of-thirds grid; the view
  settles onto the thirds.
- Real-data layer: its swatch strip along the bottom (orange, cream, graphite, brass, rose). While it waits on you,
  the strip shows exactly three options: A / B / C.
- Gag: one trophy-wall frame is 1.2° crooked, with a thin brass measurement. The Designer straightens it when idle;
  someone bumps it again later.

**Engine Mechanic**
- Frame: two round amber goggle lenses with a brass rivet ring vignetting the view; a few sparks at the rims while the
  engine runs.
- Real-data layer: a small gauge needle in the corner that follows its real progress (done of).
- Gag: when it's idle the goggles are up, so the view flares bright for a moment and it squints (a quick exposure bump).

**QA Tester**
- Frame: two brass lens rings under a green-tinted band at the top (the eyeshade). While it tests, a 2x loupe circle.
- Real-data layer: a checklist that ticks green once per progress step and shows one red row when blocked; small
  checks float over what it tested today.
- Gag: after a full pass, the loupe keeps looking anyway.

**Research Lead**
- Frame: a round brass magnifier inset at about 2x that follows your cursor, under the fedora's brim.
- Real-data layer: while a round runs, a row of small round tiles, one per scout topic; each turns into a check card
  when that scout reports (from progress).
- Gag: hold the magnifier over another robot and its eyes go huge.

**Cowork**
- Frame: a brass ship's porthole with 8 bolts and a compass bezel.
- Real-data layer: it looks out the window at the storm map's side of the sky; the bezel needle points at the last
  storm direction Storm Watch reported.
- Gag: every so often it checks the horizon through its spyglass (the view zooms 2x for a second, then back).

**Storm Watch**
- Frame: the yellow sou'wester brim at the top with rain beads running off it; a faint radar sweep ring.
- Real-data layer: the real Fremont sky from the weather feed. After a hail find, the sweep locks on the real
  direction and shows size + town.
- Gag: before 6:54 the view is mostly eyelid (two dark bars) that opens a crack at you and closes again.

**Chat Reader**
- Frame: newspaper column rules down both sides and a masthead strip on top with the live time
  ("THE CREW TIMES · 6:52 AM / EL DIARIO DEL EQUIPO · 6:52 AM").
- Real-data layer: every robot's name tag becomes a headline from its latest event, built from a fixed EN/ES pattern
  per event kind with real names and task ids ("BUILDER SHIPS V26"), plus a short dry kicker from a small written
  bank. No AI writing at runtime.
- Gag: the page turns at the bottom edge whenever a new event arrives.

---

## 3. Outfits v2

**Look at it now:** `docs/design/hub-office/outfits/lineup.html` (source) and `outfits/lineup.png` (full size, the
real 40 px size, and the black-silhouette test). All 10 robots are nameable from their black silhouette alone at 40 px.

Every item FilthE picked is kept. The one shape swap: the Research Lead's explorer hat becomes a fedora instead of a
pith helmet (the pith helmet has colonial baggage, and its dome looked the same as the hard hat and the sou'wester).

**Units.** All numbers are robot-local, inside the 1.24 hov scale. **H** = head space (origin at the head centre,
top y +.125, face z +.155). **Bd** = body/hov space (base y 0, light strip y .25). `HALF`, `BRIM`, `PEAK`,
`part()`, `bake()` and `tex()` are the existing helpers in scene.js.

**What changes in today's code.** `dress()` merges every head part into `R.head`, so nothing on the head can move;
only the King's crown is its own group. Each outfit below names its moving groups (`R.hatG`, `R.faceG`, `R.prop`,
plus `R.cape`, `R.tie`, `R.card`, `R.anemo` where listed), each with its pivot at the hinge. Everything else stays
baked per material.

### The King (Claude Code): "Coronation capelet"
Ceramic · pin `#4fb8ac` · a modern monarch: solid gold-on-red crown, short velvet capelet. The tallest robot and the
only one with a cape. The capelet is cut short on purpose (Edna Mode's "No capes!"): it never catches in the tube and
never hides his light strip.
- **Hero, crown** → group `R.crown` at H(0,.15,0), scale 1 (sizes are baked in; drop the old 1.25 scale).
  - Velvet cap `HALF(.135)` scaled (1,.6,1) at H(0,.17,0): oxblood `#6b1528`, phys rough .6, sheen 1, sheenColor `#d66a7a`.
  - Band `Cylinder(.158,.152,.06,40)` at H y .145: brushed brass `#c9a45c`, metal 1, rough .32.
  - Ermine rim `Torus(.16,.014,6,40)` rotX π/2 at H y .11: cream bouclé `#f4efe6`, rough .9, sheen .6; 10 black
    flecks `Box(.007,.018,.004)` at r .172 (jewelry).
  - 5 tall points `Cone(.032,.11,4)` (4 sides = crisp facets) at r .15, every 72° starting at the front, H y .23.
    5 short points `Cone(.022,.058,4)` at 36° + i·72°, H y .20. Brass.
  - Tip gems `Sphere(.018,12,8)` on the tall tips (H y .29): brass until earned, then orange enamel (phys `#f5883a`,
    clearcoat 1, rough .15, emissive `#f5883a` .8).
  - Front cabochon `Sphere(.021)` scaled z .6 at H(0,.145,.158): MeshBasic `#f5883a`, his live light.
  - Crown top reaches H y .31: tallest in the crew.
- **Support, capelet** → group `R.cape`.
  - `Cylinder(.15,.295,.31,32,1,true, π-1.75, 3.5)` in the velvet, DoubleSide, at Bd(0,.46,-.005): spans y .305-.615,
    wraps far enough to show at the sides from the front, hem above .30.
  - Collar `Torus(.13,.032,8,32)` rotX π/2, scaled y .75, at Bd y .625: cream bouclé + 8 flecks.
  - Clasp: 2 brass `Sphere(.016)` at Bd(±.045,.6,.12) + chain `Torus(.045,.004,4,12,π)` (jewelry).
- **Delete** today's full-length cape and its hem torus: it runs down to y .10 and hides the strip from behind.
- **Earned:** one tall-point gem turns orange per board item marked DONE today (max 5, resets at midnight Central).
  One look at the King = how far today's board has moved.
- **States:**
  - Working: cabochon steady, cape sways ±2° (slow sine). The crown no longer spins all the time; it spins only in the cheer.
  - Waiting: crown dips forward 8° (a royal nod), cabochon pulses with the strip.
  - Blocked: crown slips 10° to one side (rotZ, x +.02), cabochon off. Red stays on the strip and eyes only.
  - Sleeping: crown lowers .03 and tips back 15°; the capelet wraps forward like a blanket (rotX +.25, scale x .9);
    gems at 30%.
  - Done: the new gem pops (scale 0 → 1.3 → 1 in .5 s, with `burst()`), crown spins once.
  - Idle: crown pushed back 10°. Tube ride: the capelet flips up (rotX -1.2) during the fwoop, then settles.

### Right Hand: "The Concierge"
Ceramic · pin `#9b7be0` · half hotel concierge (the golden crossed keys of Les Clefs d'Or, "we open any door"), half
Mission Control flight director (the man in the vest who talks live and passes orders). The violet V on the white
body is the strongest front colour block in the crew.
- **Hero, waistcoat** (static body).
  - Two panels `Cylinder(.168,.21,.27,24,1,true, θstart, θlength)` at Bd(0,.435,0), scaled 1.015 so they sit proud of
    the body (y .30-.57). Robot-left θ .12 → 3.0, robot-right -3.0 → -.12, leaving a .24 rad front gap where the
    white "shirt" shows.
  - Lapels `Box(.05,.15,.008)` at Bd(±.042,.49,.172), rotZ ±.3, rotX -.35: they close the gap into a V from y .57 to .40.
  - Violet lacquer `#4a2466` (phys clearcoat .8, rough .3), lapel edge `#6b3a92`. 3 brass buttons `Sphere(.009)` at
    Bd(-.03, .31 / .345 / .38).
- **Tie (kept)** → group `R.tie`: knot `Box(.042,.034,.03)` at Bd(0,.555,.13); blade `Cone(.034,.19,4)` point down,
  scale z .28, at Bd(0,.455,.168), rotX -.3 (tip at y .36, above the strip). Gold silk `#d6a743`, metal .35,
  rough .35, sheen .6.
- **Support, headset** → group `R.faceG`.
  - Band `Torus(.2,.017,8,40,π)` graphite leather `#26262b` + brass inner stripe `Torus(.19,.004)` (today's .011 band
    disappears at 40 px).
  - Ear cups `Cylinder(.07,.07,.05,24)` rotZ π/2 at H(±.222,-.005,0): leather `#1c1c20`, violet enamel ring
    `Cylinder(.071,.071,.018)` `#4a2466`, brass rim `Torus(.07,.005)`. Head silhouette widens to ±.25.
  - Boom: `TubeGeometry` r .006 on a CatmullRom H(.235,-.03,.03) → (.2,-.1,.13) → (.09,-.115,.2), `#1c1c20`.
  - Mic capsule `Sphere(.02)` at H(.085,-.115,.205): MeshBasic `#f5883a`, his live light.
- **Jewelry:** crossed-keys pin at Bd(-.128,.47): two keys (`Box(.007,.058,.004)` + bow `Torus(.011,.003,4,12)` + bit
  `Box(.012,.008,.004)`) crossed ±35°, polished brass `#e6c987`.
- **Earned:** the keys throw a small moving glint (a .3 s additive sprite sweep) every time the Right Hand passes one
  of FilthE's messages to the King (handoff `king` → `code`).
- **States:**
  - Working: mic lit and swung in front of the mouth, small nods.
  - Waiting: boom swings up out of the way (rotX -.6), free hand to an ear cup ("go ahead, I'm listening"), mic pulses.
  - Blocked: headset cocked 15°, one ear cup lifted off (rotZ .5), mic off.
  - Sleeping: headset drops around the neck like a DJ (band rotX 1.75, y -.16), mic off. Waistcoat stays.
  - Done: the tie flips up on a spring (rotX -1.0, settles in .8 s), keys glint. Idle / coffee: headset around the neck.

### Builder: "Foreman's rig"
Ceramic · pin `#5aa9e6` · a premium job site: HMP-orange lacquered hard hat, saddle-leather carpenter's rig with
copper rivets, a brass headlamp. Like real crews' hard hats, his collects stickers: one enamel decal per page shipped.
- **Hero, hard hat** → group `R.hatG`, pivot H(0,.105,0).
  - Shell `HALF(.188,32)` scaled (1,.8,1.08) at H(0,.105,0): HMP-orange lacquer `#f5883a`, phys clearcoat .85,
    clearcoatRoughness .15, rough .28.
  - Ridge `Torus(.17,.02,6,24,π)` rotY π/2 (runs front to back) `#e8772a`.
  - Brim `BRIM(.222)` + `PEAK(.245)` at H y .11 in a darker lacquer `#d4631c` so the edge reads.
  - Headlamp `Cylinder(.028,.03,.03,16)` rotX π/2, brushed brass, at H(0,.155,.2); lens `Circle(.018)` warm white
    `#fff1d6` + glow sprite .16: his live light.
  - Decals: up to 6 `Circle(.02,14)` flush on the dome (lookAt the outward normal) at azimuth ±40 / ±80 / ±120°,
    elevation 35°; cream `#f3eee6` / graphite `#2c2d32` / brass `#c9a45c`, each with a .004 brass rim.
- **Support, tool rig** (static body).
  - Belt `Torus(.207,.022,8,48)` rotX π/2 at Bd y .167 (below the strip): saddle leather `#a0582a`, rough .55.
  - Buckle: brass frame of 4 thin boxes, .056 x .04 outer, at Bd(0,.167,.215).
  - Pouches `RoundedBox(.1,.13,.065,2,.018)` at Bd(±.215,.1,.07), rotY ±.9, dark leather `#6b3a1f`; flaps
    `RoundedBox(.1,.05,.07)` `#8e4b2a` (existing `MAT.leather`); copper rivets `Sphere(.006)` `#b87333` (jewelry).
    Waist silhouette widens to ±.28.
  - Keep today's hammer in the left pouch. Brass tape measure `Cylinder(.028,.028,.022)` with an orange face on the right.
- **Earned:** one decal per page the Builder shipped this week (its `done` events, Monday reset). The first decal of a
  week that includes a hub or App publish is solid brass.
- **States:**
  - Working: headlamp on (warm glow on the desk), tiny hammer-tap bob in the typing pose.
  - Waiting: hat off, held to the chest in the right hand (hat in hand); the orange disc at chest height reads from
    across the room.
  - Blocked: hat pushed back 20°, both hands up at the brim, lamp off.
  - Sleeping: hat tipped forward over the visor 25°, lamp off.
  - Done: hat lifts .08 and settles while the new decal pops on with a sparkle. Idle: jaunty 8°, lamp off.

### Designer: "Atelier"
Ceramic · pin `#e07a9a` · a Paris studio meets a Pantone book: black merino beret worn with a hard tilt, a gunmetal
Blackwing pencil behind the ear, a rose silk scarf, and a brass-riveted swatch fan in the crew's own palette.
- **Hero, beret** → group `R.hatG`, pivot H(0,.12,0).
  - `Sphere(.2,24,12)` scaled (1.12,.26,1.08) at H(-.05,.145,0), rotZ .24: droops to one side and overhangs the head
    by about .10. That tilt is what separates it from a cap at 40 px.
  - Black merino felt `#1c1a20`, phys rough .85, sheen .5, sheenColor `#6a6470`. Stalk `Cylinder(.008,.01,.032)` on
    top. Leather sweatband `Torus(.17,.007)` `#3b2418` (jewelry).
- **Pencil (kept, now a Blackwing)** → own small group (moves ear ↔ hand).
  - Hex `Cylinder(.012,.012,.23,6)` gunmetal lacquer `#3b3d42`, rough .35, behind the right ear at H(.2,.03,-.01),
    rotX π/2-.35, rotZ .4: it pokes up and back about .05 past the head outline.
  - Brass ferrule `Cylinder(.013,.013,.022)`, flat eraser `Box(.024,.02,.012)` `#e88a9a`, cedar point
    `Cone(.012,.04,6)` `#e8c89a` with a graphite tip.
- **Support, silk scarf.**
  - Neck ring `Torus(.075,.024,8,24)` rotX π/2 at Bd(0,.66,0): rose silk `#d9728c`, phys sheen 1, sheenColor
    `#ffc0cf`, rough .45. Knot `Sphere(.03)` at Bd(.03,.645,.085).
  - Two tails `Box(.045,.13,.008)` rotZ ±.3, rotX -.25; the second one darker `#b85a72`. Three brass dots (jewelry).
- **Prop, swatch fan** → `R.prop`: 5 strips `RoundedBox(.034,.175,.005,1,.004)` on a brass rivet
  `Cylinder(.012,.012,.012)`: HMP orange, cream, graphite, brass, rose. Closed = stacked. Open = orange / cream /
  graphite spread at -26 / 0 / +26°.
- **No live light.** The fan is the signal: it snaps open to exactly three strips (A/B/C) whenever the Designer is
  waiting on FilthE, so the outfit itself says "pick one", and snaps shut with a click when he answers.
- **States:**
  - Working: pencil moves from ear to hand and sketches over the tablet; beret tilts .1 further.
  - Waiting: fan open toward the camera, beret straight, strips pulse faintly with the strip.
  - Blocked: fan shut, pencil back behind the ear, beret slid down over one eye (y -.03, rotZ .35).
  - Sleeping: beret pulled down over the visor like an eye mask (rotX .55, y -.05).
  - Done: the beret does one flat spin (a chef's flourish), scarf tails lift. Idle: tails flutter slowly (±.08).

### Engine Mechanic: "Railroad welder"
Ceramic · pin `#d0693e` · vintage brass cup goggles with amber lenses that drop and glow while the storm engine runs,
over a reversed welder's cap in hickory stripe (the cloth of railroad engineers' caps: a quiet "engine" pun), a big
chrome spanner, and a brass pressure gauge on the chest whose needle is his real progress.
- **Hero, goggles** → group `R.faceG`, hinge at H(0,.12,0) (rotates on x).
  - Strap `Torus(.198,.012,6,40)` rotX π/2: black leather `#1a1718`.
  - Cups `Cylinder(.056,.06,.05,20)` rotX π/2 at H(±.08,.135,.16): brushed brass. Bridge `Box(.064,.016,.02)` brass.
    6 rivets per cup `Sphere(.004)` `#7a5f2c` (jewelry).
  - Lenses `Circle(.042)` at z .186: amber glass phys `#ffa347`, rough .1, clearcoat 1, emissive `#f5883a`
    (0 idle, 1.6 working). His live light.
  - Up = on the forehead as placed. Down = +.55 rad on the hinge, lenses over the eyes.
- **Support, welder's cap** (static head).
  - Crown `Sphere(.19,24,12)` scaled (1.02,.45,1.06) at H(0,.105,0), hickory-stripe canvas 64² via `tex()`: indigo
    `#2e3a57`, cream `#e9e2d0` 3 px stripes every 9 px, a fine `#aeb6c6` line, vertical, repeat 6x1, rough .9.
  - Bill **reversed**: `PEAK(.12)` at H(0,.11,-.16), rotY π, rotX -.25. It sticks about .09 out the back: the key
    that separates him from the Builder in silhouette. Top button `Sphere(.013)` `#2e3a57`.
- **Support, chest gauge** at Bd(.1,.46, surface +.011), facing along the body normal.
  - Case `Cylinder(.047,.047,.022,24)` brass. Face `Circle(.036)` cream `#f1ece0` with ticks from a 64² canvas.
  - Needle `Box(.003,.03,.002)` `#141416`, -135° → +135°, orange dot at full scale. Glass dome `Sphere(.037)` scaled
    z .3, `MAT.glassTop`.
- **Prop, spanner** (1.6x today's wrench): shaft `RoundedBox(.032,.21,.014)` chrome `#dadde2`; open jaw = an extruded
  U (outer r .048, mouth .04, depth .014); box end `Torus(.024,.009)`.
- **Readout:** the needle = his real `progress {done, of}`. At 100% it taps the peg and puffs a little steam (reuse the
  coffee steam sprites).
- **States:**
  - Working: goggles down, lenses glowing: two amber discs, unmistakable at 40 px. A small spark sprite every ~2 s at
    the desk.
  - Waiting: goggles up on the forehead, spanner under the arm, hand raised.
  - Blocked: goggles pushed up crooked (rotZ .2), spanner raised to the head (scratching it), lenses dark; the needle
    stays on the true value and trembles ±2°.
  - Sleeping: goggles down but dark, like sunglasses at the beach.
  - Done: the spanner twirls one full turn, the gauge dings the peg with a puff of steam, goggles flip up. Idle: goggles up.

### QA Tester: "The proofreader"
Ceramic · pin `#7cc47a` · the old newsroom copy desk: an emerald celluloid eyeshade (what copy editors and auditors
wore for fine print) over big round brass spectacles (FilthE's round glasses, kept and enlarged), a flip-down brass
loupe, and a saddle-leather clipboard whose ticks are the real test count.
- **Hero, eyeshade** → group `R.hatG`, hinge at H(0,.085,0).
  - Band `Cylinder(.192,.192,.03,40,1,true)` at H y .075: black grosgrain `#1a1718`, DoubleSide. It sits low, so the
    dome of the head still shows above it.
  - Visor `Ring(.19,.30,32,1, θstart, 1.9 rad centred on the front)` laid flat (rotX -π/2), then tipped down .38 at
    the front, at H(0,.095,0), scaled z 1.08: projects about .11 in front of the face.
  - Emerald celluloid `#1f8a52`: phys, transparent, opacity .82, rough .15, clearcoat 1, depthWrite false, DoubleSide.
    Not emissive. Brass binding `Torus(.30,.005,4,32,1.9)` along the outer edge (jewelry).
- **Support, spectacles** → own small group (they slip when blocked).
  - Frames `Torus(.06,.009,8,28)` brushed brass at H(±.07,0,.176): bigger than today's .043, so each eye light sits
    inside a bright ring. Lenses `Circle(.057)` `MAT.glassTop`.
  - Keyhole bridge `Torus(.018,.006,6,12,π)` at H(0,.015,.178). Temples `Cylinder(.005,.005,.12)` to the ears.
- **Loupe** → group `R.faceG`, hinge at H(.13,.058,.176): `Cylinder(.024,.022,.045,16)` brass + black eyecup
  `Cylinder(.02,.02,.01)` `#141416`. Up = rotX -1.4, resting on the eyeshade. Down = over the right lens.
- **Prop, clipboard** → `R.prop`: board `RoundedBox(.15,.2,.012)` saddle leather `#8e4b2a`, brass clip
  `Box(.06,.03,.02)`, paper `Box(.12,.16,.003)` with a 48x64 canvas of tick rows in `#2f7a4a`, redrawn only when
  progress changes.
- **Earned:** a PASS pin for 24 h after a full pass: `Cylinder(.024,.024,.006,20)` cream enamel `#f3eee6` with a brass
  check (two .004-wide boxes) and brass rim, at Bd(.1,.44, surface).
- **No live light.** Readout: the clipboard's tick rows fill one by one from its real `progress {done, of}`.
- **States:**
  - Working: loupe down, head tipped toward the clipboard, ticks filling.
  - Waiting: clipboard turned face-out toward the camera in the raised hand, loupe up.
  - Blocked: glasses slide down the "nose" (y -.03, rotX .15), clipboard lowered to its side, loupe up.
  - Sleeping: eyeshade pulled down over the visor like a sleep mask (rotX .6); the glasses hide.
  - Done: a small brass rubber stamp thumps the clipboard once and the PASS pin pops on. Idle: eyeshade pushed up 10°.

### Research Lead: "Expedition leader"
Ceramic · pin `#b39ddb` · still an explorer hat (FilthE's pick), now a sand felt fedora with a wide Akubra-weight
brim (the Indiana Jones "Poet" shape), an olive scout sash with one enamel badge per research round, and an oversized
brass magnifier. While a round runs, his scouts orbit the hat as tiny firefly lights.
- **Hero, fedora** → group `R.hatG`, pivot H(0,.12,0).
  - Crown: `LatheGeometry` of profile [(0,.135), (.1,.15), (.14,.13), (.155,.08), (.158,0)], 24 segments (the dip at
    the centre is the crease), scaled z 1.12, at H(0,.125,0). Front pinch: for vertices with z > .06,
    x *= 1 - .3·(z-.06)/.12.
  - Sand fur felt `#b99d72`, phys rough .8, sheen .4.
  - Band `Cylinder(.158,.16,.042,24)` scaled z 1.12 at H y .148: chocolate grosgrain `#2b1a12`.
  - Brim `Cylinder(.305,.305,.012,40)` scaled z 1.12 at H y .125, `#a88d62`, bent: z > .15 → y -= (z-.15)·.35 (front
    snapped down); z < -.15 → y += (-z-.15)·.2 (back up). The widest brim in the crew.
  - Brass compass `Cylinder(.015,.015,.006)` on the band's left side (jewelry).
- **Support, scout sash** over the robot's RIGHT shoulder to its LEFT hip (keeps it off the crew pin).
  - Sample 48 angles in the plane through Bd(0,.45,0) tilted .6 rad; at each, march out until you leave the body
    profile (`bodyPts`), push out +.006; build a flat ribbon .05 wide along those points. Lowest point about y .30
    (clear of the strip). Olive twill `#5d6340`, rough .9.
  - Badges `Cylinder(.02,.02,.005,16)` + brass rim `Torus(.02,.004)` up the front arc, up to 6; faces cycle cream,
    orange, graphite, rose, pale brass `#ecd296`.
- **Prop, magnifier** (1.4x today's): walnut handle `Cylinder(.013,.015,.12)` `#6b4226` + brass ferrule; rim
  `Torus(.062,.013,8,32)` brushed brass; lens `Circle(.058)` `MAT.glassTop`.
- **Scouts:** 3 firefly sprites (`glowTex`, `#ffb070`, scale .06) orbiting the hat at r .35 while a round runs
  (count = progress `of` when 5 or fewer, else 3). Sprites, not a live light.
- **Earned:** one sash badge per research round finished (its `done` events). Every 10th is solid brass with a
  thicker rim. The sash shows the latest 6; the card shows the total ("Round 56 / Ronda 56").
- **States:**
  - Working: magnifier raised to the right eye, with a second eye mesh behind the lens at 1.6x (the classic big-eye
    gag, very readable). Scouts orbit.
  - Waiting: hand to the brim, a hat tip held in place; scouts hover still.
  - Blocked: hat pushed far back (rotX -.35), magnifier lowered; the scouts land and sit on the brim.
  - Sleeping: hat tipped fully over the face (the fedora nap), scouts off.
  - Done: hat raised overhead while the new badge stitches onto the sash (scale pop). Idle: relaxed, magnifier at its side.

### Cowork: "Harbor master"
Graphite · pin `#e0a84a` · the storm map's ship captain: a white-top merchant-navy cap with gold oak leaves on a black
lacquer peak, four-bar shoulder boards (the Master's rank), double-breasted brass buttons and a rolled storm chart.
White and gold on graphite is the strongest contrast downstairs.
- **Hero, captain's cap** → group `R.hatG`, pivot H(0,.1,0).
  - Band `Cylinder(.168,.162,.085,32)` black `#16161a` at H y .148.
  - Crown plate `Cylinder(.232,.2,.045,36)` white `#f6f3ee`, phys clearcoat .3, at H(0,.205,-.01): overhangs the band
    by .06, the classic plate.
  - Peak `PEAK(.165)` black lacquer `#0b0b0e`, clearcoat 1, rough .08, at H(0,.108,.07), rotX .3.
  - Chin cord `Torus(.166,.005,4,32,π)` brass across the front at H y .115, side buttons `Sphere(.011)` brass.
  - Badge: brass wreath `Torus(.027,.008,6,20)` with an orange enamel centre `Circle(.014)` at H(0,.148,.172): his
    live light.
- **Earned, "scrambled eggs":** up to 10 brass leaves `Sphere(.012,8,6)` scaled (1.7,.45,1) in two arcs along the
  peak edge, 5 each side. One leaf per day in a row the storm bundle ran clean (consecutive days with a Cowork `done`
  check-in). Miss a day and they reset. In real navies the leaves mark command; here they mark reliability.
- **Support, shoulder boards:** `RoundedBox(.124,.012,.06,1,.006)` black lacquer `#101013` with a brass edge line at
  Bd(±.17,.548,0), rotZ ±.62 (lying on the shoulder slope); 4 brass bars each `Box(.009,.004,.05)`. The outer ends
  sit about .05 past the body, so the shoulders widen to ±.24.
- **Support, buttons:** 6 brass `Sphere(.012)` at Bd(±.055, .33 / .39 / .45, surface +.004). Check the lower-left
  pair against the crew pin at Bd(-.1,.36) in the lineup; nudge inward if they touch.
- **Prop, storm chart** → `R.prop`: `Cylinder(.025,.025,.22,16)` cream `#f1ece0`, an orange ribbon band
  `Cylinder(.026,.026,.018)`, end caps `#d8d0c0`.
- **States:**
  - Working: at the storm desk with the chart unrolled flat (the prop hides, a flat chart plane shows on the desk),
    badge lit.
  - Waiting: a crisp salute, hand to the peak (its own waiting gesture instead of the wave).
  - Blocked: cap pushed back 15°, chart rolled tight under the arm, badge off.
  - Sleeping: cap tipped forward over the visor.
  - Done: cap toss: it rises .3, turns once and is caught. Idle: cap cocked 6°.

### Storm Watch: "Lighthouse keeper"
Graphite · pin `#6f9fe0` · a New England sou'wester in signal-yellow oilskin, longer at the back like the real ones,
a standing storm collar, and a brass mast on the hat with a cup anemometer that spins at Fremont's real wind speed,
topped by the orange beacon (his blinking antenna).
- **Hero, sou'wester** → group `R.hatG`, pivot H(0,.1,0).
  - Crown `HALF(.172)` scaled (1.05,.85,1.05) at H(0,.11,0): signal-yellow oilskin `#f2c230`, phys clearcoat .9,
    clearcoatRoughness .15, rough .3. Stitch rings `Torus(.13 / .08, .003)` `#b98b16` (jewelry).
  - Brim `Cylinder(.27,.27,.014,40)` at H y .115, underside `#dcab1c`, bent: back (z < 0) z *= 1.25 and
    y -= .09·(-z/.34) (long droop over the neck); front (z > 0) z *= .78 and y -= .012 (short front).
- **Support, mast + anemometer + beacon.**
  - Mast `Cylinder(.006,.006,.22,8)` brass from H(.075,.2,-.02) up to y .42.
  - Anemometer → group `R.anemo` at H(.075,.42,-.02): hub `Sphere(.011)`, 3 arms `Cylinder(.003,.003,.05)` at 120°,
    3 cups `HALF(.017)` facing tangentially. Brushed brass.
  - Beacon `Sphere(.021)` at H(.075,.46,-.02): MeshBasic `#f5883a`, his live light. (Today's tip is `#ff6a3d`;
    moving it to brand orange keeps the only live colour the brand's.)
- **Support, storm collar:** `Cylinder(.105,.165,.1,28,1,true, .06, 2π-.12)` at Bd(0,.65,0), yellow oilskin,
  DoubleSide; 4 brass snaps `Sphere(.008)` in the small front gap.
- **Earned, hail pins:** up to 8 `Icosahedron(.009,0)` ice white `#eef3f7`, rough .2, along the crown's lower edge at
  H y .13: one per hail alert this month (monthly reset).
- **Readout, real wind:** the cups spin at ω = .35 rad/s per mph, capped at 25 mph, from the NWS observation the page
  already fetches (`properties.windSpeed.value` km/h x 0.621 → `HUB.sky.state.wind`). Stopped when unknown or under
  reduced motion. Glance at Storm Watch = how windy it is outside, even while it sleeps.
- **States:**
  - Working (the 6:54 scan): beacon blinks at 1 Hz, radar pose, cups spinning.
  - Waiting: beacon on the slow wait pulse; it taps the brim.
  - Blocked: the mast sags (rotZ .4 at its base) like a limp antenna and the beacon flickers dim: "no signal"
    without using red.
  - Sleeping: hat pulled down over the visor, beacon off; the cups keep freewheeling with the real wind.
  - Done (alert sent): 3 quick beacon flashes and a hail pin pops on.
  - Stormy sky (`HUB.sky.state.storm`): hat and collar go glossier (clearcoatRoughness .05), collar stands taller
    (scale y 1.2).

### Chat Reader: "Press room"
Graphite · pin `#c9a45c` · the newsroom runner: an eight-panel newsboy cap in LIGHT oatmeal herringbone (today's dark
tweed vanishes on graphite), a PRESS card in the band like a 1930s reporter, a waxed-canvas satchel of rolled papers,
and a real broadsheet in hand.
- **Hero, newsboy cap** → group `R.hatG`, pivot H(0,.1,0).
  - Crown `Sphere(.205,24,12)` scaled (1.03,.4,1.1) at H(0,.14,.02): pulls forward over the peak.
  - Oatmeal herringbone canvas 64² via `tex()`: ground `#b3a48a`, chevrons `#8f7f66`, a few `#d9772f` and `#f3eee6`
    flecks, the 8 panel seams drawn in. Rough .95.
  - Band `Cylinder(.176,.176,.032)` `#3a3128` at H y .1. Button `Sphere(.02)` `#9c8b70` on top.
  - Peak `PEAK(.14)` at H(0,.1,.135), rotX .25, `#8a7a61`.
- **PRESS card** → group `R.card`: `Box(.088,.06,.003)` at H(.14,.19,.08), rotY .5, rotZ -.28, tucked in the band and
  sticking about .05 above the crown (the silhouette key). Double-sided canvas 128x88: front cream `#f6f1e6` with
  "PRESS" (ES "PRENSA") in black Geist 600; back cream with "¡EXTRA!" in HMP orange.
- **Support, messenger satchel.**
  - `RoundedBox(.13,.11,.05,2,.014)` waxed canvas `#8b7a55` at Bd(.23,.36,.03), rotY .5. (Moved up from the draft's
    y .32, which dipped into the strip band; at .36 the bottom sits at y .305.) Flap `#6f6143`, brass buckle, 2 rolled
    papers `Cylinder(.013,.013,.07)` cream poking out.
  - Strap: a ribbon from the Research sash generator, .025 wide, `MAT.leatherDark` `#5e2f1a`, right shoulder to the
    bag, lowest point y ≥ .30, clear of the crew pin.
- **Prop, broadsheet** → `R.prop` (replaces the 4-sheet stack): two `Box(.14,.18,.003)` hinged as an open paper,
  canvas masthead "THE CREW TIMES / EL DIARIO DEL EQUIPO" (by `HUB.lang`) with column rules. While reading, the stack
  height = progress done (max 6 sheets).
- **No live light.** Flag: the card flips to "¡EXTRA!" while a brief for the King is waiting (a handoff to `code` not
  yet followed by a King check-in) and flips back once the King picks it up.
- **States:**
  - Working: broadsheet open in both hands, cap pushed back 8°.
  - Waiting: paper held headline-out toward the camera; card on EXTRA.
  - Blocked: paper crumpled (prop scale y .6 with a small random turn), cap askew 12°.
  - Sleeping: napping under the newspaper, tented over the visor.
  - Done: tosses a rolled paper to the King (the handoff flight uses a rolled-newspaper mesh when the sender is the
    Chat Reader). Idle: papers under the arm, cap forward.

### Global rules (one design language for all 10)
1. **One body, ten editions.** The ceramic/graphite shell never changes; the outfit is the "edition" (the Be@rbrick
   idea). Headwear at 1.2-1.3x real scale, props at 1.4-1.6x, the way toys exaggerate. The King is the tallest and
   the only one with a cape; everyone else gets 1 hero piece + at most 2 supports. Anything smaller than .03 is
   jewelry, meant only for close views.
2. **Silhouette first** (Valve's TF2 rule). Every robot is nameable from its solid black shape at 40 px.
   - Head tops: King spiky crown · Right Hand big ear cups + band · Builder smooth dome + ridge + short peak ·
     Designer tilted flat disc + pencil · Engine Mechanic goggle bumps + backward bill · QA forward green bill, no
     crown · Research pinched crown + widest brim · Cowork tall flat plate · Storm Watch dome + back-drooping brim +
     mast · Chat Reader puffy cap + card sticking up.
   - Body/hands: cape · V waistcoat · pouches · fan · spanner · clipboard · sash + lens · shoulder boards + chart
     roll · collar · satchel + paper.
   - A hero piece adds at least .10 to the outline (about 4 px at 40 px); a colour block is at least .12 x .08.
3. **Value contrast.** Ceramic robots wear mid-to-dark values (oxblood, violet, orange lacquer, black felt, hickory,
   emerald, sand/olive). Graphite robots wear light or bright values (white cap, signal yellow, oatmeal, cream paper).
   One signature fabric per robot, no repeats.
4. **Four material families only.**
   - Lacquer: phys, clearcoat .8-.9, rough .25-.35 (hats and hard goods).
   - Brushed brass: metal 1, rough .3-.45; `#c9a45c`, dark `#9c7c3e`, polished `#e6c987`. Every outfit has at least
     one brass note, echoing the brass ears.
   - Soft goods: felt, tweed, velvet, silk, leather, canvas; rough .6-.95, sheen on velvet, felt and silk.
   - Enamel pins: a flat cylinder .005-.006 thick with a brass rim torus.
5. **Light and colour.** One live light per robot, in HMP orange `#f5883a` (the Builder's headlamp is warm white
   `#fff1d6`): King cabochon, Right Hand mic, Builder headlamp, Engine Mechanic lenses, Cowork badge, Storm Watch
   beacon. Designer, QA, Research and Chat Reader have none. Live lights are on only while working or waiting, pulse
   with the strip while waiting, and are off when blocked or sleeping. No bright red anywhere in an outfit: red means
   blocked. (Check in the lineup that the King's dark oxblood never reads as "blocked" red.) Green only on QA's
   eyeshade, never glowing.
6. **Never cover.** The strip band (Bd y .22-.28): hems, belts, sashes and bags stay above .30 or below .20. The eyes,
   except the deliberate sleep and working gags. The crew pin at Bd(-.1,.36): diagonal straps go over the robot's
   RIGHT shoulder to its LEFT hip.
7. **State grammar** (the same for everyone, so FilthE learns it once).
   - Working: gear on, live light on.
   - Waiting on FilthE: the hero piece is **offered to the camera** (hat in hand, fan open, clipboard or paper
     face-out, salute, hat tip), live light pulses with the strip.
   - Blocked: the hero goes **askew** 8-15° (tilted hat, crooked goggles, slipped glasses, sagging mast), light off.
   - Sleeping: gear pulled **over the eyes** (hat, beret, eyeshade, newspaper), lights off.
   - Just finished: **one** flourish of 1.2 s or less (spin, toss, salute, stamp, twirl) + the newly earned piece pops on.
   - Idle: a relaxed 5-8° tilt.
   - Whole board done (at most once a day): everyone tosses their hat once and the King tips his crown.
   - Reduced motion: final poses only; no spins, flutters, tosses or anemometer spin.
8. **Earned gear** (collectible AND informative; hub data only).

   | Robot | Earned piece | Counts |
   |---|---|---|
   | King | crown gems | board items DONE today (max 5, midnight reset) |
   | Right Hand | key glint | each message it passes to the King |
   | Builder | hard-hat decals | its `done` events this week (Monday reset) |
   | Designer | fan opens to A/B/C | waiting on FilthE for a pick |
   | Engine Mechanic | gauge needle | `progress {done, of}` |
   | QA Tester | clipboard ticks + PASS pin | `progress`; a full pass (pin lasts 24 h) |
   | Research Lead | sash badges | research rounds finished (latest 6 shown) |
   | Cowork | gold leaves on the peak | days in a row with a clean storm bundle |
   | Storm Watch | hail pins | hail alerts this month |
   | Chat Reader | EXTRA card | a brief the King hasn't picked up yet |

   The page computes `agent.gear = {count, progress:{done, of}, flag}` from events/board and bumps `seq` when it
   changes; the scene only reads it. The robot's card lists it in EN/ES ("3 decals this week / 3 calcomanías esta
   semana").
9. **Build rules** (scene.js).
   - Static pieces keep `part()` / `bake()` merging per material.
   - Moving pieces live in named groups with the pivot at the hinge (`R.hatG`, `R.faceG`, `R.prop`, plus `R.cape`,
     `R.tie`, `R.card`, `R.anemo` where specced). Aim for about 3 moving groups per robot.
   - Jewelry goes in `R.jewel`: hidden when the robot is under 60 CSS px tall on screen, and always on phone.
   - Budget per outfit: 7 draw calls or fewer, about 1.5k triangles on desktop, 800 on phone (12-16 segment circles).
   - Only 3 small canvas textures via `tex()`: hickory 64², oatmeal herringbone 64², press card 128x88. Plus two data
     textures redrawn only on change: QA's tally, the gauge face.
   - Reuse existing `MAT` entries where the colour matches (`brass`, `leather`, `leatherDark`, `hatWhite`,
     `hatBlack`, `hatYellow`, `chrome`, `paper`, `glassTop`, `orange`); add the rest per outfit above.
   - Replace the magic `R.hat` offsets (`makeRobot`, scene.js ~line 919) with each hat group's real bounding-box top.
   - Update the flat avatars in crew-hq.html ("the robot heads, dressed for the job") to the new silhouettes so the
     side panel matches the room. Update the outfit line in CONTRACT.md.
   - Before shipping: re-run the 40 px black-silhouette row in `outfits/lineup.html`, plus one row per state.
10. **Pin colours (two-way door, default chosen).** The crew pin colour (`def.color`, crew-hq.html ~line 529) also
    drives name tags, rings and avatars. Change two for v1: **Storm Watch → signal yellow `#f2c230`** (its whole
    look) and **Research Lead → sash olive `#a3a86a`** (today's lavender sits too close to the Right Hand's violet).
    The King keeps teal (oxblood would read as the red "blocked" colour); the Builder keeps blue (orange is the
    strip's colour). The rest already match or don't clash. Check all 10 side by side in the lineup first.

---

## 4. Parked (good, not now)
1. **Frosted visor:** a blocked robot's visor slowly fogs over (clear at 0, full at 2 h); wipe it with the cursor in
   its eye view to read the blocker. Pick this or "blocked, acted out" as the one block-age signal, not both.
2. **Chase variants:** rare one-day finishes from real events: Night Owl (worked 11 PM-5 AM → midnight-pearl finish
   next day, shows where overnight usage went), Storm Chaser slicker on a hail day; at most 2 on screen.
3. **Scout drones:** when the Research Lead sends scouts, tiny brass drones lift off its hat, fly out through the
   glass, and come home one by one as each scout reports (progress done of).
4. **Crew Polaroids:** every real finish snaps an instant photo of the victory lap and pins it to its trophy plaque;
   finishes that happened while the hub was closed get an honest "Portrait / Retrato" label; Sunday "Week in pictures".
5. **The office grows:** real progress slowly furnishes the penthouse (10 done: a fiddle-leaf fig, 25: a record
   player, 50: a brass telescope aimed at the water tower); the done streak lights rings on the water tower.
6. **Night shift + the Nebraska calendar:** the office knows Fremont's year: hail-season slickers, harvest trucks at
   the elevator, first-snow knit scarves (from the weather feed), Día de Muertos marigolds, December posada lights.
7. **Tally-light multiviewer:** a control-room wall of every robot's eye cam, with an "on air" light per tile
   (orange = needs you, red = blocked, green pulse = just finished). Heavy on a MacBook; low-res tiles only.
8. **The fitting room + collector card:** a "Wardrobe" button spins the robot on a brass turntable under a spotlight
   with every outfit piece labelled like a luxury watch page, earned and locked pieces included; Photo saves it.
9. **The King's sealed orders:** the King rolls each order into a scroll with an orange wax seal; the robot carries it
   until the task is done, so counting scrolls = open orders. Its seal and "stale after 24 h" already live in
   Pneumatic mail.
10. **Desk miniatures:** one tiny collectible per desk that is this week's number (Builder's brick tower = pages
    shipped, the King's chess board = board items done, Storm Watch's snow globe = hail days). Pick 3-4 at most.
