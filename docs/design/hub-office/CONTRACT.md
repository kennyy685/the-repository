# Hub page <-> 3D scene contract (T190), v2 for v27

v2 (2026-09-28) adds the fields in "v2 additions" at the bottom; the build plan is BUILD-v27.md. Every v2 field is
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
