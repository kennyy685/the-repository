# Hub page <-> 3D scene contract (T190), v3 for v28

v3 (2026-09-28, v28) adds "v3 additions" at the very bottom (build plan BUILD-v28.md); v2 (v27) added "v2 additions" (BUILD-v27.md). Every v2 field is
optional: the scene falls back to v26 behaviour when one is missing, and the page works with no scene. Two builders
work in parallel (PAGE = `pages/crew-hq.html`, SCENE = `pages/hub/scene.js`); a new field goes here first, in its
own commit, before either file uses it.

The hub is a multi-file artifact (`pages/crew-hq.files.json`):
- `pages/crew-hq.html` (page): data, sky tokens, overlay (name tags, bubbles, progress rings, zzz), Needs strip,
  cards, answers, board, memory, Right Hand box, logs, EN/ES. Owner: the hub builder.
- `pages/hub/scene.js` (published `hub/scene.js`): the three.js world. Owner: the Builder helper.
- `pages/hub/still.webp`: the no-WebGL still (rendered from the scene's `#capture` mode). Owner: the Builder helper.
- Fonts come from `pages/fonts/` (read only; published as `fonts/...`).

The page loads three.js r169 with an import map (`three`, `three/addons/` on cdn.jsdelivr.net) and then
`<script type="module" src="hub/scene.js">`. If WebGL, the CDN or the module fails, the page shows the still and
everything else keeps working. The container that builds this can't reach jsdelivr: tests route the CDN URLs to a
local copy of three@0.169.0.

## window.HUB (set by the page before scene.js runs)
| field | meaning |
|---|---|
| `RM` | `matchMedia('(prefers-reduced-motion: reduce)')`; read `.matches` every frame |
| `agents` | one array for the page's life (it may grow, never shrinks). Each agent below. |
| `byId` | `{id: agent}` |
| `selected` | getter: selected agent id or null |
| `cam` | getter: `'all'` (both floors, default) / `'up'` / `'down'` / `'follow'` (keep the selected robot framed) |
| `wide` | getter: viewport >= 900 px (desktop layout: side panel on the right, `--panel-w` wide) |
| `lang` | getter: `'en'` / `'es'` |
| `sky.state` | `{alt, storm, flash, rain, glow:[r,g,b], low:[r,g,b], top:[r,g,b], lights}` updated by the page every frame; the page also drives the CSS sky behind the canvas (`#sky`, `--horizon` is set by the scene) |
| `boardInfo` | `{v, title, when, cols:[{label, items:[{tone:'orange'|'white'|'green'|'red', w:0..1}]}]}`; redraw the board when `v` changes |
| `trophies` | `{v, list:[{id, text, at}]}` newest first, at most 12; plaques on the downstairs trophy wall |
| `handoffs` | a queue the page pushes `{from, to}` agent ids onto; the scene shifts it and flies a glowing folder |
| `fallback()` | the scene calls it when WebGL can't start |
| `layout()` | the scene calls it once ready |

Agent: `{id, def, st, spot, seq, instant, hidden}`
- `def`: `{name:{en,es}, color:'#hex', graphite:bool, outfit, floor:'up'|'down', title?:{en,es}}`.
  outfit: `crown` (King: crown + cape), `headset` (Right Hand: headset + gold tie), `captain` (Cowork: captain's
  cap), `rainhat` (Storm Watch: yellow rain hat + blinking antenna), `hardhat` (Builder: orange hard hat + tool
  belt), `beret` (Designer: beret + pencil), `goggles` (Engine Mechanic: welding goggles + wrench), `glasses` (QA
  Tester: round glasses + clipboard), `explorer` (Research Lead: fedora + sash + magnifier in outfits v2; the id stays `explorer`), `newsboy` (Chat Reader:
  newsboy cap + stack of papers).
- `st`: `working` | `idle` | `sleeping` | `waiting` | `blocked` | `done` (already staleness-corrected).
- `spot`: `null` or `'standup'` (working in a meeting at the board).
- `seq`: bumps on every state change; the scene re-plans when it changes. `instant`: true for the first state (place,
  don't walk).
- Where each state goes (the scene decides the exact spot): working = own desk (or stand-up by the board), waiting
  = "your spot" downstairs, blocked = own desk, sleeping = a charging pod downstairs, done = cheer where it stands,
  then coffee, then the lounge; idle = lounge/coffee. Trips between floors use the slide (down) and the tube (up).

## window.SCENE (set by scene.js once it is drawing)
| field | meaning |
|---|---|
| `ready` | true |
| `anchors` | `{id: {x, y, fx, fy, pose, moving, visible}}`: screen px of the top of the head (`x,y`) and the floor under the robot (`fx,fy`); `pose` = `wait` / `blocked` / `cheer` / `sleep` / `type` / `read` / `lounge` / `coffee` / `ride` / ... ; the page shows the "waiting" bubble only once `pose === 'wait'` |
| `frame(t, dt)` | the page's animation loop calls it every frame (seconds) |
| `resize()` | the page calls it on layout changes |
| `dragged` | getter: true right after a drag (the page then ignores the tap) |
| `pick(x, y)` | optional: robot id under a stage point, or null |

## DOM contract (what scene.js looks for in the page)
| element | rule |
|---|---|
| `#stage` (or `HUB.stage`) | the office box (`.stage`, `position:relative`, `overflow:hidden`). The scene sizes the renderer to its `clientWidth`/`clientHeight`, starts drag-to-turn from `pointerdown` on it (not on `.bub`, buttons, links, inputs or `[data-nodrag]`), and reports anchors in its pixel space. The page places the overlay (tags, bubbles, zzz, rings) inside it. Phone height: `clamp(460px,138vw,640px)`; desktop (>= 900 px, v2): `position:fixed; inset:0`, the whole viewport, with the top band and the right panel over it; the camera frames inside `HUB.area`. |
| `#gl` (or `HUB.canvas`) | the WebGL canvas, absolutely filling `#stage`, transparent (the CSS sky shows through). Created and prepended to `#stage` if missing. Hidden by `.no-gl`. |
| `#sky` | the CSS sky behind the canvas. The page sets its colors; the scene sets `--horizon` (a % of the stage height, 8-92) on it every frame so the CSS horizon lines up with the building's floor for the current view. |
| `#still` | `hub/still.webp`, shown only under `.no-gl` (after `HUB.fallback()`, or when the CDN or module fails). Transparent background, rendered from `hub/scene.js` with the page opened at `#capture` (renderer keeps its buffer; after 7 s the frame lands as a data URL in `textarea#cap`). |

Camera views: `all` = both floors; `up` = the upper floor; `down` = the lower floor, and the upper floor lifts away
and hides (robots on it too, their anchors report `visible:false`) so nothing covers downstairs; `follow` = the selected
robot. Reduced motion = cut instead of glide or lift.

## v2 additions (v27)

### window.HUB, new fields (page writes, scene reads)
| field | meaning |
|---|---|
| `area` | getter: `{x0, y0, x1, y1}` in stage px, the rect the camera frames the room in. Desktop `{x0:40, y0:88, x1:W-420, y1:H-64}`; phone the v26 values. Replaces reading `--panel-w`. Missing: the scene keeps its v26 math. |
| `theme` | `{v, work, idle, need, stuck, sleep, jewel, stripMode:'ember-only'\|'brand', name}`: colors as `#hex`. Defaults: work `#f1c48a` (champagne), idle `#cdb896`, need `#f5883a` (ember), stuck `#e0685c` (oxide), sleep `#3a3632`, jewel `#c9a45c` (brass). Set from "Make it yours"; `v` bumps on every change and the scene re-colors only then. Not tied to HMP colors. |
| `breath` | getter: 0.35..1, the shared 5 s "needs you" breath, `.35 + .65*(.5-.5*cos(2*PI*t/5))` from `performance.now()`. Strip halo, count dot and the mind all use it. |
| `needs` | `{v, ids:[agentId]}`: robots waiting on FilthE in the page's order (stopped robots first, then oldest). `ids[0]` gets the call pool and the front of the line. Missing: the scene uses agents with `st==='waiting'`. |
| `cam` | getter, v2 values: `all` (1 Dollhouse) / `up` / `down` / `follow` (4 Ride-along) / `blueprint` (2) / `cctv` (3) / `window` (5) / `tilt` (6) / `tour` (7) / `director` (8) / `eyes` (9, the selected robot's eyes). The page only offers ids in `SCENE.views`; an unbuilt id renders as `all` (`eyes` as `follow`). |
| `dolly` | getter: 0 whole / 1 floor / 2 robot, the scroll push-in detent (the page also sets `cam` + `selected` to match; the scene may use it for framing tightness only). |
| `cues` | a queue the page pushes one-shot moments onto; the scene shifts them. `{kind:'arrive'}` roll call · `{kind:'answered', id, qid}` Special Delivery + that robot's thank-you · `{kind:'poke', id}` in-character reaction (the page shows the line) · `{kind:'coffee', id}` perks up · `{kind:'hail', inches, dir}` hail alert moment. Unknown kinds are ignored. Reduced motion: final pose only. |
| `pointer` | `{x, y, in, t}`: last pointer in stage px, `in` = over the stage, `t` = ms timestamp. Updated at most 10 Hz. Heads follow it. |
| `watching` | getter: tab focused and pointer moved in the last 2 min (idle robots straighten up). |
| `hover` | getter: agent id hovered in the roster or the room, or null (head turns to camera, tag lights). |
| `power` | getter: `full` / `saver` (unfocused or no pointer 2+ min: 30 fps, DPR 1.25) / `paused` (tab hidden). |
| `onLowFx(on)` | the scene calls it when its DPR auto-drop fires; the page adds `.lowfx` (card solid, mind off). |
| `pip` | getter: `null` or `{id, kind:'face'}` while The Call window is open; the scene renders that robot's face into `#pip`. |
| `afterHours` | getter: true 10 PM-5 AM Fremont: warm low lamps; robots still working get a desk lamp + cup. |
| `stormWatch` | `{dryDays, lastHailAt, inches, town, dir}` (dir in degrees from Fremont), for Storm Watch's morning. |
| `flap` | `{v, blockDays, bestBlockDays, shipped, waiting}` for the coffee-bar flap sign and mood lighting. |
| `bugs` | `{open:[taskId], fixedThisWeek:[taskId]}` (Later: QA's bug jar). |
| `sky.state.wind` | mph from the NWS observation the page already fetches. |

New agent fields (page computes, bumps `seq` when `gear` or `silent` changes):
- `since`: ms timestamp the current state began (from the agent row's `at`). The line's wait sign, in-the-zone, blocked age.
- `gear`: `{count, progress:{done, of}, flag}`: earned pieces and live readouts (FUN-IDEAS section 3, rule 8).
- `silent`: true when the run watchdog says this robot went quiet (helper 30 min, King 45 min): strip grey, slight dim.
- `doing`: its current `doing` line (EN or ES as posted), for thought icons and the eye-view screen. `task`: its board task id or ''.
- `def.color` v2 pin colors: Storm Watch `#f2c230`, Research Lead `#a3a86a`; the rest unchanged.

### window.SCENE, new fields (scene writes, page reads)
| field | meaning |
|---|---|
| `views` | array of built `cam` ids, e.g. `['all','up','down','follow']` in S1. The page shows keys/buttons only for these. |
| `tweening` | getter: true while a camera glide runs (the scroll push-in waits for false). |
| `busy` | getter: true while a glide, flight, ride, celebration or cue plays (the page holds `power:'saver'` until false). |
| `points` | `{spot:{x, y, visible}, tube:{x, y, visible}}` in stage px, updated every frame: "your spot" and the tube base, for the page's overlays and the mind. |
| `cctv` | getter: `1` (Cam 1, upstairs) or `2` (Cam 2, downstairs) while `cam` is `cctv`; the scene switches every 8 s, the page labels its timestamp overlay with it. |
| `anchors[id].pose` | v2 adds `bow`, `poke`, `queue` (standing in the line), `zone` (in the zone). The page still shows the waiting bubble only for `wait` or `queue`. |

### DOM, new elements (page owns them)
| element | rule |
|---|---|
| `#panel` | desktop: the right panel (x `W-380..W-40`), with the card slot, the tab bar (Crew / Board / Log / Chat) and a tab body that scrolls inside. Drag-to-turn never starts on it (`[data-nodrag]`). |
| `#mind` | the generative "mind" canvas inside `#sky` (page code, not three.js). The scene never touches it. |
| `#pip` | The Call's face box (about 180 x 180 CSS px). The scene reads its rect relative to `#stage` and scissor-renders the face there while `HUB.pip` is set. Hidden = no render. |

### Ownership reminders
- Keys and wheel: the page owns every key and the wheel; it only sets `HUB.cam`, `selected`, `dolly` and cues. The
  scene keeps drag-to-turn and `pick()`.
- The page pushes each handoff onto `HUB.handoffs` and fires its own mind comet at the same moment; the scene still
  shifts the queue.
- No field ever carries HMP App data (leads, doors, homeowners, claims, money).

## v3 additions (v28, 2026-09-28)

v3 serves BUILD-v28.md. Every v3 field is optional: the scene falls back to v27 when one is missing; the page works
with no scene. `HUB.observatory`, `HUB.flows` and `HUB.cat` are specified now and built in v28.1.

### English only (note 11)
`HUB.lang` stays and always returns `'en'`. `def.name`, `def.title` keep their `{en, es}` shape (old data), but only
`.en` is shown. Nothing new needs Spanish.

### def.floor v3 (the floors = kinds of work, blueprint 5)
| floor | agents |
|---|---|
| `up` (Intelligence: know, test, watch) | `hub-keeper` (Research Lead), `qa-tester`, `storm-watch` |
| `down` (Execution: build, make, run) | `code` (the King), `king` (Right Hand), `builder`, `designer`, `engine-mechanic`, `chat-reader`, `cowork` + YOU |
The page flips `def.floor`; the scene owns the desks, the dispatch table (King + Right Hand), the QA bench, the radar
table by the upstairs glass and the experiment table. Sleeping still = a charging pod downstairs.

### window.HUB, new fields (page writes, scene reads)
| field | meaning |
|---|---|
| `now` | `{v, rows:[{id, st7, step, verb, metric, since, cocked}]}`, one row per robot in RIGHT NOW order (priority, then age). `st7`: `needs` \| `stuck` \| `done` \| `working` \| `queued` \| `idle` \| `asleep` \| `silent`. `step`: the resolved verb id (table below), the scene picks the animation from it, so the list and the room never disagree. `verb`: the words shown. `metric`: short text or `''`. `since`: ms. `cocked`: true for stuck rows (the page tilts the row; the scene may tilt the desk bar). `v` bumps when any row changes. Missing: the scene uses `agent.st` + its v27 work poses. |
| `panel` | getter: `'open'` \| `'closed'` (the side panel, note 8). `HUB.area` already reflects it (closed: `x1:W-40`); the page calls `SCENE.resize()` right after a toggle. |
| `theme` (v3 keys) | adds `done:'#3fbf94'` (verdigris), `queue:'#cdb896'` (stone), `intel:'#6cb8ec'` (the Intelligence floor accent, never a status); `stuck` default becomes `#d9483b`. Make it yours changes `work` only; `need`, `stuck`, `done` are locked. |
| `cam` (v3 values) | `all` / `up` / `down` / `follow` / `cctv` / `window` / `tilt` / `director` / `eyes`; v28.1 adds `observatory` (key O) and `cat` (key Y). `blueprint` and `tour` are no longer offered (a stored old value maps to `all`). |
| `observatory` (v28.1) | `{v, seats:[{id, st7}], lanes:{research:[w], build:[w], qa:[w]}, needs, health:{ok, top}, flow, friction, shipped, last:{text, at}}` (blueprint 8.3). Redraw the table texture only when `v` changes. |
| `flows` (v28.1) | a queue of `{from, to, task, dir:'up'\|'down'\|'same', kind:'build'\|'verdict'\|'finding'\|'note'}` from handoff events; the scene shifts it. The page keeps pushing `handoffs` too until v28.1 ships; a scene that reads `flows` ignores `handoffs`. |
| `cat` (v28.1) | `{v, name, coat:'#hex'}`: FilthE's cat. The scene owns its roaming; a robot in `HUB.needs.ids` walks to the cat and plays with it; while `HUB.watching`, the cat sits at "your spot". Cues: `{kind:'cat', what:'pet'\|'treat'}` (page buttons). |

### Agent, new fields (page passes through from `agents/<id>`; `seq` bumps when `step` or `queued` changes)
- `step`: the raw verb id the crew posted (optional); `HUB.now.rows[].step` is the resolved one the scene should use.
- `metrics`: whitelisted counts `{sources, findings, tests, passed, failed, issues, files, checks, chats, scans}`.
- `result`: `{passed, of, issues}` on the agent row until its next state (QA screens, the Right Hand's card).
- `why`: one line, 90 chars max, "why this, why now" (FUNCTIONS-SHORTLIST #8; optional).
- `queued`: true when a handoff to it isn't picked up yet or its task `holds` on someone else (page-derived).

### Verb ids (`step`) → what the room shows
| step | robots | scene animation |
|---|---|---|
| `building`, `fixing`, `tuning`, `writing`, `publishing`, `filing` | Builder, Engine Mechanic, Research Lead, King, Right Hand | `type` at its desk; the page frame / desk screen fills to `progress` |
| `running` | Engine Mechanic | `type` + the gauge needle |
| `designing`, `pinning` | Designer | `pin` at the easel / pin wall |
| `dispatching`, `planning`, `reviewing` | the King | `slide-card` at the dispatch table (`planning`: at the board) |
| `relaying`, `handing` | Right Hand, anyone | carries an envelope (v28.1 walks it to the tube; v28.0 = `type`) |
| `reading`, `briefing` | Chat Reader | `read` (newspaper) |
| `researching`, `scanning` | Research Lead | `read` at the experiment table |
| `testing`, `investigating`, `verified`, `failed` | QA Tester | `stamp` at the QA bench (device screens tick) |
| `watching`, `hail` | Storm Watch | `radar` (hail: to the glass rail) |
| `storm-ops`, `shipped` | Cowork | `read` at the map table / cheer |
| `needs`, `stuck`, `waiting-on`, `free`, `asleep`, `quiet` | anyone | the v27 state poses (line, head down, queue rack, lounge, pod, dim) |
Unknown ids fall back to the v27 work pose. New anchor poses: `stamp`, `pin`, `slide-card`.

### window.SCENE (v3)
| field | meaning |
|---|---|
| `views` | v28.0: `['all','up','down','follow','cctv','window','tilt','director','eyes']` (only what is built). |
| `anchors[id].pose` | adds `stamp`, `pin`, `slide-card`. Off-screen robots report their projected `x,y` anyway (may be outside the stage) so the page can draw an edge arrow. |

### DOM, new elements (page owns them)
| element | rule |
|---|---|
| `#now` | RIGHT NOW, the top of `#panel` above the tabs. Drag-to-turn never starts on it. |
| `#panelTab` | the slim right-edge tab shown when the panel is closed (needs count). `[data-nodrag]`. |
| `#kingBubble`, `#kingWin` | the floating King chat button and its window (note 3). `[data-nodrag]`. |
