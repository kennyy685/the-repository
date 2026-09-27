# Hub page <-> 3D scene contract (T190)

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
  Tester: round glasses + clipboard), `explorer` (Research Lead: explorer hat + magnifier), `newsboy` (Chat Reader:
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
| `#stage` (or `HUB.stage`) | the office box (`.stage`, `position:relative`, `overflow:hidden`). The scene sizes the renderer to its `clientWidth`/`clientHeight`, starts drag-to-turn from `pointerdown` on it (not on `.bub`, buttons, links, inputs or `[data-nodrag]`), and reports anchors in its pixel space. The page places the overlay (tags, bubbles, zzz, rings) inside it. Phone height: `clamp(460px,138vw,640px)`; desktop (>= 900 px): fills the window behind the side panel. |
| `#gl` (or `HUB.canvas`) | the WebGL canvas, absolutely filling `#stage`, transparent (the CSS sky shows through). Created and prepended to `#stage` if missing. Hidden by `.no-gl`. |
| `#sky` | the CSS sky behind the canvas. The page sets its colors; the scene sets `--horizon` (a % of the stage height, 8-92) on it every frame so the CSS horizon lines up with the building's floor for the current view. |
| `#still` | `hub/still.webp`, shown only under `.no-gl` (after `HUB.fallback()`, or when the CDN or module fails). Transparent background, rendered from `hub/scene.js` with the page opened at `#capture` (renderer keeps its buffer; after 7 s the frame lands as a data URL in `textarea#cap`). |

Camera views: `all` = both floors; `up` = the upper floor; `down` = the lower floor, and the upper floor lifts away
and hides (robots on it too, their anchors report `visible:false`) so nothing covers downstairs; `follow` = the selected
robot. Reduced motion = cut instead of glide or lift.
