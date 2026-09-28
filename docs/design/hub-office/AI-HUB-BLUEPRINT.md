# AI Hub blueprint v28: the visual operating system for the crew

For `pages/crew-hq.html` (the page) and `pages/hub/scene.js` (the 3D world). Written 2026-09-28 from FilthE's brief
(`BRIEF-v28.md`, including its "Framing" section) on top of SPEC.md, ART-DIRECTION.md (Nocturne), FUN-IDEAS.md,
CONVENIENCES.md and CONTRACT.md v2. Rendering fixes (shadows, smoothness, AA) are in `RESEARCH-v28.md`; this file
covers the concept, the functions and the build plan.

**Ground rule (FilthE's framing):** the live hub IS the product. We keep the isometric two-floor office, Nocturne,
the robots, outfits, slide, tube, "your spot", the line, the pods and the panel. Every change below has a
**functional reason** next to it. Nothing is rebuilt for looks.

---

## 0. The big idea, in five lines

1. **The building is the org chart and the pipeline.** Upstairs = Intelligence (know, test, watch). Downstairs =
   Execution (build, make, run). Where a robot stands tells you what kind of work it does.
2. **The spine carries the work.** The glass tube is the one connector between the floors. Findings and test
   verdicts ride it **down** to the builders; finished builds ride it **up** to QA. You watch the work move.
3. **The Observatory sits on the spine.** A round table wrapped around the top of the tube, half on the upper floor,
   half hanging out over the lower one. It is the org at a glance: who is working, what is stuck, what needs you.
4. **Dark cockpit.** When all is normal the room is calm and warm. Color only appears for exceptions: ember = needs
   you, oxide = stuck, green = just passed. Every color also has its own shape and its own motion.
5. **RIGHT NOW = the room, in words.** One line per robot, a status glyph and a verb. The verb always matches what the
   robot is visibly doing, and hovering either one lights the other.

---

## 1. What to steal (brief items 1-8)

The question for every reference: *"What can AI Hub steal from this?"* Each row gives the mechanic, **where it goes
in the hub** (zone / status / animation / UI) and the source. `[opened]` = I read the page. `[search]` = the host is
blocked by this container's egress policy, so I only had the search-result excerpt (see section 11).

### 1.1 Workplace research: Gensler (item 5)

| Steal | Where it goes | Source |
|---|---|---|
| **Zone by work mode, not by desk rows.** Gensler measures work in modes (alone/focus, together, learning, socializing), and "to focus on my work" is the top reason to come in. | The floor split and the zones: focus desks (Research, Designer), together (dispatch table, huddle sofa), learning (research wall), social/recharge (coffee bar, lounge). Each zone gets its own light temperature and floor finish so you can read the mode without labels (section 5). | Gensler Global Workplace Survey 2025/2026 [search] |
| **NEXT NEXT: "clear separation between human zones and machine operations"; labs flip to dry-lab/robotics ratios (50/50 to 30/70).** | The upper floor is the "dry lab": quiet, glass-walled, instruments. The lower floor is the shop. The human spot ("your spot", FilthE's figure) sits at the seam, at the front corner where both floors are in view. | Gensler, "NEXT NEXT: Redefining Science Work for the AI and Machine Era" [search] |
| **"Teams work in open zones while individuals retreat to private rooms for focus."** | A robot that has been working 25+ minutes with no event gets the "in the zone" pose (CONTRACT v2 `zone`). Upstairs a glass research wall screens the Research Lead's desk from the QA bench. | Same [search] |

### 1.2 Creative studio: IDEO (item 4)

| Steal | Where it goes | Source |
|---|---|---|
| **Working walls: ideas pinned up in public, "not a presentation culture".** When work lives in a drive, nobody can pull a good note back to the front. | Two walls. The **Research wall** (upstairs glass partition): each finding is a pinned card. The **Designer's pin wall** (downstairs, on the slat wall by its desk): the current design options as pinned frames. Both are drawn from real data (section 8). | IDEO journal "How we designed a studio space that reflects our values", Smashing "Up on the wall" [search]; Wikipedia *IDEO* [opened] |
| **Project space: the work of one project stays together in one place.** | The **dispatch table** (downstairs center): the board's NOW tasks lie on it as physical cards in four columns. A card slides one column when its status changes. | IDEO journal [search]; Wikipedia *Kanban board* [opened] |
| **Prototype first (the 5-day shopping-cart deep dive).** | The **staging tray** at the front of the build bench: a finished build sits here as an envelope until it rides the tube to QA. A queue you can count. | Wikipedia *IDEO* [opened] |

### 1.3 AI and robotics labs: DeepMind, Boston Dynamics, Toyota Research (item 2)

| Steal | Where it goes | Source |
|---|---|---|
| **Robots are shown doing real jobs in real facilities** (Spot on inspection rounds, Stretch moving boxes), never posing. | Every animation is a job verb from the data: Storm Watch walks the glass on a "patrol", QA stamps, Builder types. No idle dancing. Idle robots go to the lounge; they don't perform. | Wikipedia *Boston Dynamics* [opened] |
| **TRI: robots learn from demonstrations, and the lab counts skills learned** (60, then hundreds). | The **Shipped shelf** on the trophy wall counts real finishes per robot. Gear earned from real milestones (FUN-IDEAS outfits v2) is the "skills learned" count. | TRI news, "Robots can learn new actions faster" [search]; Wikipedia *Toyota Research Institute* [opened] |
| **Research output is published.** DeepMind's whole culture is papers and releases. | Research results leave the upper floor as a **blue-white capsule** down the tube to whoever asked. The Research wall keeps the last 6 findings with dates, like an index of papers. | Wikipedia *Google DeepMind* [opened] |

### 1.4 Command and control rooms: NASA, ATC, F1 (item 3)

| Steal | Where it goes | Source |
|---|---|---|
| **One big front wall everyone shares, consoles facing it by function, back rooms for support.** In the Apollo MOCR, the Flight Director sits mid-room with the whole picture, and support rooms feed the front room. | The **Observatory** is the front wall made round (everyone's state on one surface). Upstairs is the "back room" (MPSR): it analyses and advises, and downstairs acts. | Wikipedia *Apollo Mission Control Center*, *Christopher C. Kraft Jr. MCC* [opened] |
| **ATC flight strips: a strip's position on the board IS its state; a controller "cocks" a strip out of line to flag a problem; the word "handoff" comes from physically handing strips on.** | **RIGHT NOW** rows are strips. A stuck row is **cocked** 6 px right, with a hatched left edge. A handoff is a real object (an envelope or capsule) that moves between robots. | Wikipedia *Flight progress strip*, *Air traffic control* [opened] |
| **F1's race support room: specialists at the factory watch telemetry and feed the pit wall over separate channels.** | Chat Reader and Cowork sit in the "comms corner" downstairs (they read the other chats and run the storm ops). Their briefings are the tannoy line (section 9.3). | F1 race-support-room coverage (RaceFans, Pitpass, McLaren) [search] |
| **Andon: any worker pulls the cord; the first pull asks for help, the second stops the line; a stack light shows it.** | **The stuck signal.** A robot's first "blocked" = a steady oxide bar on its desk (help wanted). If it is still blocked when the King runs next, its desk's **andon lamp** (small stack light) turns on and the Observatory shows "1 STUCK". | Wikipedia *Andon (manufacturing)* [opened] |

### 1.5 Microsoft AI and agent UX (item 6)

| Steal | Where it goes | Source |
|---|---|---|
| **G1/G2: make clear what the system can do and how well.** | Hovering a desk shows the robot's **can-do line** ("Builds and fixes hub pages") and its **track record** ("12 shipped · 1 bounced by QA this week"). The Observatory shows QA's pass rate for the week. | Microsoft Research, *Guidelines for Human-AI Interaction* [opened] |
| **G3 time services, G8 efficient dismissal, G9 efficient correction, G11 explain why, G16 convey consequences, G18 notify about changes.** | G3 = the wake hold and The Call (already built). G8 = "Not now" plus dismissing a done ✓. G9 = "Change answer" on the card for 90 s. G11 = every status line has a **because** link to the event that set it. G16 = "Saved · the King has it". G18 = a **new-capability plaque** when a v-number ships. | Same [opened] |
| **Agent Space: "connecting, not collapsing", "easily accessible yet occasionally invisible". Agent Time: past = "reflecting on history", now = "nudging more than notifying".** | Connecting = the handoff threads that link robots. Occasionally invisible = the dark cockpit (a calm room when nothing needs you). Past = the Research wall and the Shipped shelf. Now = a nudge (breathing ember), never a modal. | microsoft/ai-agents-for-beginners, lesson 03 (Microsoft's agent UX principles) [opened]; microsoft.design "UX design for agents" [search] |

### 1.6 Isometric virtual offices: Gather, WorkAdventure, Pixel Agents, AI Town / Smallville (item 7)

| Steal | Where it goes | Source |
|---|---|---|
| **Pixel Agents: characters animate from real agent events (typing = writing, reading = searching) and a bubble appears when the agent waits for permission.** Detection comes from hooks, with transcript scanning as the fallback. | The **verb = animation = RIGHT NOW row** rule (section 7.3). `step` (a new field) picks the animation, so "Researching" is always the reading pose at the research wall, never a generic type loop. | github.com/pixel-agents-hq/pixel-agents [opened] |
| **Gather: being at your desk = available; open vs private desks; spotlight tiles.** | Desk = working. A robot away from its desk is travelling, in a huddle, in the lounge (idle) or in a pod (asleep), so position alone tells you its status. **Spotlight**: The Call's warm pool of light (already built). | Gather help center, "Desk overview" [search] |
| **WorkAdventure: map zones that trigger behavior; silent zones.** | Upstairs is a **silent zone**: no chimes and no bubbles there except for needs-you, so the Intelligence floor reads as quiet. Hovering a zone on the floor names it ("QA lab · 2 in queue"). | github.com/workadventure/workadventure [opened] |
| **AI Town / Smallville: an agent inspector panel over a live map; memories behind every action.** | The robot card gets a **Recent memory** strip: the last 3 events of that robot, each with its because link. | github.com/a16z-infra/ai-town [opened]; github.com/joonspk-research/generative_agents [opened] |

### 1.7 Games that show workflow (item 8)

| Game | Steal | Where it goes | Source |
|---|---|---|---|
| **Two Point Hospital** | (1) A pictorial bubble over the head shows the **one most urgent** need. (2) Room icons show the **queue size** (patients waiting outside). (3) The **tannoy**: a dry voice announcing what happens. | (1) Only the top-priority status shows over a robot. (2) The QA bench's queue rack shows its count (envelopes). (3) The tannoy line: one dry, witty line under the top band per real event, EN/ES ("QA Tester to the build bench, please"). | Wikipedia [opened]; Two Point wiki "Icons", "Tannoy" [search] |
| **Factorio** | (1) Warning icons sit **on the entity** until its status changes. (2) The alert list: hover an alert and arrows at the screen edge point to it. (3) Belts: you see items flow. | (1) Stuck = a small andon lamp on that desk, until the next check-in clears it. (2) Hovering a RIGHT NOW row off-screen puts an edge arrow pointing to that robot. (3) The **thread**: a handoff leaves a thin light trail along the aisles for 8 s. | Wikipedia [opened]; Factorio alerts excerpt [search] |
| **Satisfactory** | The HUB and Space Elevator: progress = parts **delivered** to one place, in phases. | The Observatory's lane ring counts tasks delivered this week per lane. A finished task goes onto the Shipped shelf (the elevator). | Wikipedia *Satisfactory* [opened] |
| **Frostpunk** | One **central generator** heats a radial city, and its heat radius is visible. Two meters (hope, discontent) sum up the whole society. | The Observatory is the generator: its under-glow radius grows with the share of the crew at work. Two meters on its bezel: **Flow** (done this week) and **Friction** (stuck plus waiting on you, in hours). | Wikipedia *Frostpunk* [opened] |
| **The Sims** | The plumbob over the selected Sim; its color is its mood. Emotions change animations. | The selected robot gets a thin brass **selection ring** on the floor (a plumbob would be childish), and its idle animation reflects its streak (FUN-IDEAS mood). | Wikipedia *Plumbob*, *The Sims 4* [opened] |
| **RimWorld** | (1) Work priorities 1-4 per colonist. (2) Pawns act on their own; the player sets priorities. (3) The storyteller paces events. | (1) The board's order is the robots' priorities; the dispatch table shows it. (2) Hub rule: you never drive a robot, you only answer it. (3) Director mode (key 8) paces camera cuts to real events. | Wikipedia *RimWorld* [opened] |
| **shapez** | Everything feeds one central hub, and a level = deliver N of a shape. | The Observatory center shows **"this week: 7 shipped"**; the Shipped shelf is the delivery count. | Wikipedia *Shapez 2* [opened] |

---

## 2. Reasoning: seven rules drawn from the research

1. **Place = kind of work.** (Gensler modes, NASA front room vs back room.) Intelligence up, Execution down. Nothing
   upstairs builds and nothing downstairs researches.
2. **State = position first, color second.** (ATC strips, Gather desks.) At a desk = working, on the tube = handing
   off, in the line = needs you, in the lounge = idle, in a pod = asleep. You should be able to read the room with
   the color turned off.
3. **Color is for exceptions (dark cockpit, andon).** Normal work is champagne, the room's own warm light. Only
   needs-you, stuck and just-passed get their own hue. A room where everything glows says nothing.
4. **Every signal is carried three ways: color + shape + motion.** About 8% of men have red-green color deficiency
   (Wikipedia *Color blindness*). So no two states may differ only by hue.
5. **Work is an object that moves.** (Factorio belts, flight strips, andon.) A handoff is an envelope. A verdict is a
   capsule. A task is a card on a table. You never need a log to see that something moved.
6. **One surface for the whole org (the Observatory).** (MOCR front wall, Frostpunk generator, shapez hub.)
7. **Words match the picture (HAX G1/G11, Pixel Agents).** The RIGHT NOW verb, the animation, the prop screen and the
   card all come from the same field. If the data can't say it, the room doesn't show it.

---

## 3. Design system (brief item 20, the complete design language)

### 3.1 Status: the system and why

The brief's first idea (green working, yellow waiting, blue researching, purple thinking, orange needs you, red
error) has three problems. It puts red and green on the most common states, which is the worst pair for color-blind
viewers. It colors normal work, which breaks the dark cockpit. And it invents "thinking", a state the data doesn't
have. **Decision:** 7 states from the real data, with color held back for the 3 that need action. Research and
thinking are shown by **place** (the upstairs floor and its blue accent), not by a status color.

| State (data) | Glyph | Room color (strip, desk bar) | Motion | Where the robot is | Verb examples | Priority |
|---|---|---|---|---|---|---|
| **Needs you** (`waiting` + `ask`) | ◆ solid diamond | ember `#f5883a` (L\*68) | 5 s breath (the only continuous pulse) | the line at your spot | Needs you · Te necesita | 1 |
| **Stuck** (`blocked`) | ■ square with a notch | oxide `#d9483b` (L\*51), text `#ef7a6c` | **steady**, never pulses; row cocked 6 px; desk bar hatched | its own desk, head down | Stuck: feed down · Atascado | 2 |
| **Just passed / done** (`done`, 6 s then idle) | ✓ check | verdigris `#3fbf94` (L\*70) | one gold-leaf fall + a 900 ms bar fill, then fades | cheers where it stands, then the coffee bar | Shipped · Verified · Listo | 3 |
| **Working** (`working`) | ● filled circle | champagne `#f1c48a` (L\*82): *normal, not a signal* | the chase dot along the strip + the job animation | its own desk or zone | Building 91% · Testing 12/18 | 4 |
| **Queued** (derived: a handoff to it not yet picked up, or its task `holds` on someone else) | ⧗ hourglass | stone `#cdb896`, dimmed | none; stands at the queue rack or its desk | its desk or the QA queue rack | Waiting on Builder · En espera | 5 |
| **Idle** (`idle`) | ○ ring | stone `#a39a8c` | the idle habit only | lounge or coffee bar | Free · Libre | 6 |
| **Asleep** (`sleeping`) | ◐ half | slate `#8e95ab`, strip off + brass pilot dot | 6 s pilot breath | a charging pod | Asleep till 6:54 · Dormido | 7 |
| **Silent** (watchdog, CONTRACT v2 `silent`) | ◌ dashed ring | grey, 70% | none | wherever it was | Quiet 40 min · Sin señal | 2b (under Stuck) |

**Why these hues (measured, CIE ΔE76 on simulated vision, Machado 2009 matrices):**
- ember vs oxide: normal 32 · deutan 22 · protan 32 · tritan 26. The earlier oxide `#e0685c` dropped to a
  **tritan ΔE of 10**, so oxide moves darker, to `#d9483b`. They also differ in lightness by 17 L\*, in shape
  (◆ vs ■) and in motion (breath vs steady).
- ember vs verdigris: 93 / 52 / 38 / 101. oxide vs verdigris: 106 / 38 / 31 / 125. The pair people can't bear to
  confuse, pass vs fail, stays apart in every vision type.
- verdigris vs champagne is only 18 under protan, but a ✓ never sits on a working robot, and the ✓ fades in 6 s.
- The hues follow Okabe-Ito's logic (orange, vermilion, bluish green and sky blue, told apart by lightness), lifted
  for a near-black background.
- **Intelligence blue** `#6cb8ec` (Okabe sky blue lifted, L\*72) is **not a status**. It marks the Intelligence
  floor: the research wall's pins, capsules going down, the research arc on the Observatory, and the upstairs task
  lights' edge. This keeps the brief's "blue = research" without adding a status to learn.
- All status text reaches 4.5:1 or more on `--bg #0c0d0f`. Oxide text uses `#ef7a6c`.

Tokens (the page, `:root`; the scene mirrors them in `PAL`). Stuck changes, and three tokens are new:
```css
--st-stuck:#d9483b; --st-stuck-ink:#ef7a6c;   /* was #e0685c: tritan ΔE 10 vs ember */
--st-done:#3fbf94;                            /* was brass-hi: a pass must read as "pass" */
--st-queue:#cdb896;                           /* new */
--intel:#6cb8ec; --intel-dim:rgba(108,184,236,.35);   /* new: the Intelligence floor accent, never a status */
```
"Make it yours" keeps working. Its accent replaces champagne (`work`) only. Needs, stuck and done stay locked, so
FilthE can never pick himself into a color-blind trap. (A theme with orange as the accent auto-switches `work` to
ivory.)

### 3.2 Type, space, surfaces
Unchanged from ART-DIRECTION section 4 (Bricolage display, Geist body, Geist Mono labels, museum wall text). One
addition: RIGHT NOW rows use Geist 13/20, the verb weight 500 in the status ink, and metrics in Geist Mono tabular
numbers, so "91%" never jitters.

### 3.3 Motion grammar
| Kind | Rule |
|---|---|
| Continuous | Only three: the needs-you breath (5 s), the working chase dot, the pilot dot (6 s). |
| One-shot | Done fill 900 ms, a card sliding a column 600 ms, a capsule ride 1.6 s, a thread trail 8 s fade. |
| Travel | A robot walks only for a real event (handoff, needs you, done, sleep). At most 2 robots travel at once; extra handoffs go by capsule only. |
| Camera | Under-move (RESEARCH-v28 item 10): 750 ms glides, never automatic except in Director mode and The Call. |
| Reduced motion | Final poses, no travel, no trails; capsules appear at their destination with a 200 ms fade. |

### 3.4 Materials and light, by floor (brief items 12, 13)
| | Upstairs, Intelligence | Downstairs, Execution | Spine + Observatory |
|---|---|---|---|
| Floor | honed travertine (keep) | polished dark stone (keep) | glass floor over the cantilever, brass ring |
| Walls | glass window wall, one new **glass research wall**, slat wall with the board (keep) | slat wall (trophy + pin wall), back wall (keep) | the tube (keep) |
| Wood | walnut on the desks | walnut: the dispatch table, build bench | walnut rim on the Observatory |
| Metal | brushed brass hairlines, bronze mullions | the same, plus matte black tool rail on the build bench | brass bezel |
| Light | cooler and quieter: **4000K** task light (brass shades, opal), `--intel` edge on the task lights, lamps at 0.85x | warm **3000K** pools (keep), the linear pendant moves over the dispatch table | a soft ivory under-glow ring; its radius = share of crew working |
| Sound | a silent zone (no chimes except needs you) | the chimes as now | the tannoy line only |

No new real-time lights. The 4000K upstairs look comes from retinting the existing lamp colors and sprites. The
light budget stays at 10 (ART 6.2).

---

## 4. Concrete visual references (brief item 9)

| Look at | For | Steal exactly |
|---|---|---|
| Apollo MOCR photos (Wikipedia *Apollo Mission Control Center*) | Observatory, dispatch table | rows of consoles facing one shared surface; the "Trench" in front |
| Flight progress strip boards (Wikipedia *Flight progress strip*) | RIGHT NOW | strips in bays; a cocked strip = trouble |
| Toyota andon boards and stack lights (Wikipedia *Andon*) | the stuck lamp | a small 2-tier stack light per desk, off until needed |
| Norman Foster, McLaren Technology Centre (Wikipedia) | architecture | one semicircular glass volume with "fingers" and "streets": the Observatory's half-disc cantilever |
| IDEO studio working walls (IDEO journal) | research wall, pin wall | foam-core boards, cards in clusters, hairline string between related cards |
| Frostpunk generator (Wikipedia) | Observatory under-glow | a radius of warmth around the one center |
| Two Point Hospital room queue icons | QA queue rack | a number on the room, not a list |
| Pixel Agents (GitHub README GIF) | animations | pose = what the agent is actually doing |
| Keep from ART-DIRECTION: Nighthawks, Case Study House #22, Farnsworth, Barcelona Pavilion | the whole mood | unchanged |

---

## 5. Architecture and floor plan (brief items 10, 11)

Both floors keep their size (9.2 x 6.8 m), height and split-level offset (the upper floor sits 3.1 m up and
back-left). Coordinates are local meters per floor: x to the right, z toward the viewer. The camera looks from the
front-right, so the left wall and the back wall are the walls you see, and the front and right edges are open.

### 5.1 UPPER = Intelligence (Research Lead, QA Tester, Storm Watch)
```
 x -4.6                       0                                  +4.6
z-3.4 ┌──────────── GLASS WINDOW WALL (the prairie, the sky) ───────────────┐
      │ [bookshelf] [07 RESEARCH LEAD]  [ EXPERIMENT TABLE ]    [09 STORM   (olive)
      │  keep       desk (was hot desk) (was the King's desk:   WATCH radar]│
      │                                  sources, papers, graph) (was RH desk)
 S    │           ┆                                                         │
 L  ◀ │ THE BOARD ┆ GLASS RESEARCH WALL      · quiet ·      [storm strip on │
 A    │  (keep)   ┆ findings pinned, blue                    the glass: dry │
 T    │           ┆ string to tasks                           days, last hail]
      │                        [06 QA TEST BENCH ▮andon][QUEUE RACK ##]      │
 W    │ [reading  (rug, keep)   devices: phone, laptop,                     │
 A    │  chair,                 pass/fail ticks                              │
 L    │  keep]                                                   [SLIDE TOP] │
 L    │                     ╭────── OBSERVATORY ──────╮          (keep)     │
z+3.4 └── glass rail ───────┤ ring table around the  ├──────────────────────┘
                            │ TUBE TOP, half over    │  ← cantilevered half-disc,
                            ╰── the lower floor ─────╯     glass floor, brass lip
```
- **Research lab (left half):** a focus desk, the experiment table, the reading chair, the research wall.
  *Functional:* research is quiet work, kept apart from the QA bench's activity. Findings pinned up = the crew's
  knowledge, visible.
- **QA lab (center-right):** the two old lab desks at x 1.05 / 2.35 become one 2.4 m test bench. It holds devices
  (a phone and a laptop frame whose screens show test ticks), the queue rack (an envelope per build waiting) and an
  andon lamp. *Functional:* QA validates, so it lives with Intelligence, and its queue is countable.
- **Monitoring (back-right, by the glass):** Storm Watch's radar table moves up from downstairs, beside the window.
  *Functional:* it watches the sky, so it faces the sky. It also frees the space downstairs for the build bench.
- **The board stays on the upper slat wall.** *Functional:* the plan belongs with the Observatory, where the whole org
  is summed up. It also saves a rebuild. Stand-ups: the King rides the tube up to the board, points, and slides back
  down, which tells the story "plan up here, do down there".
- The old lab desks at x -1.55 / -0.25 are removed. *Functional:* the Builder and Designer moved downstairs, and a
  quiet floor needs empty floor (ART: at least 30% empty).

### 5.2 LOWER = Execution (Claude Code, Right Hand, Builder, Designer, Engine Mechanic, Chat Reader, Cowork) + YOU
```
 x -4.6                       0                                  +4.6
z-3.4 ┌──── back wall ─────────────────────────────────────────────────────┐
      │ [PODS x4 ········]  [10 CHAT READER]  (SLIDE    [08 COWORK]         │
      │  under the upper    press desk (was   landing,   storm ops desk     │
      │  floor (keep)       the spare desk)   keep)      (keep)            │
 S    │ (TUBE BASE)◀ capsules land here                                     │
 L    │   keep                                                              │
 A  ◀ │ [03 BUILDER][05 ENGINE MECH]   [ DISPATCH TABLE  ]    HUDDLE SOFA   │
 T    │  BUILD BENCH, one walnut slab   01 King at the head,  (the lounge, │
      │  + matte black tool rail        02 Right Hand beside; keep): talks │
 W    │  [staging tray: builds → QA]    NOW tasks as cards    + handoffs   │
 A    │                                 in 4 columns                        │
 L    │ [04 DESIGNER]   [COFFEE BAR]                                        │
 L    │  studio desk,     (keep)                        ╭─ YOUR SPOT ─╮     │
 (trophy wall →      easel, pin wall                    │ + the line  │     │
  Shipped shelf)                                        ╰─ (keep) ────╯     │
z+3.4 └──────────────────────────────────── open edge ─────────── ◀ viewer ┘
```
- **Dispatch table (center, 2.6 x 0.9 m walnut; replaces the Chat Reader desk at x 0.5, z 0.55):** Claude Code at
  its head facing the viewer, the Right Hand beside it. NOW tasks lie on it as cards in TODO / DOING / REVIEW / DONE.
  The linear brass pendant moves here. *Functional:* the King dispatches and the Right Hand relays, so the two sit
  together, where every build and every verdict passes.
- **Build bench (left-center, where the radar was):** Builder and Engine Mechanic at one walnut slab, with the
  **staging tray** at its front. It sits right next to the tube base. *Functional:* builds go up to QA and verdicts
  come back down by the shortest path.
- **Design studio (front-left):** the Designer's desk, an easel, and a **pin wall** on the slat wall. The trophy
  wall's plaques shrink into a **Shipped shelf** strip along the top of the same wall. *Functional:* design options
  are pinned where you see them; shipped work is the end of Execution.
- **Comms corner (back):** Cowork (keep) and the Chat Reader (at the existing spare desk, x -0.25, z -2.55).
  *Functional:* the two robots that talk to other chats sit together, out of the build traffic.
- **Kept as they are:** the pods, the coffee bar, the lounge (now the **huddle**: a helper→helper handoff that isn't
  a build happens here as a 3 s sit-and-talk) and **YOUR SPOT + the line** (front-right, closest to the viewer =
  closest to FilthE).

### 5.3 The connector and the Observatory (the spine)
```
          UPPER (Intelligence)                         side section
   ─────────────────────╮                      upper ━━━━━━━━━━━━━┓   ╭─Observatory─╮
      ╭──────────────╮  │                       floor              ┃━━━┿━━━━╋━━━━━┿━ cantilever
      │  ◯ ← TUBE    │  │ glass rail                               ┃   │    ┃     │  (glass floor)
      │ ring table   │  │                                          ┃   ╰────╂─────╯
      ╰──────────────╯  │                                          ┃        ┃ TUBE ↑ builds, questions
   ──────── edge ───────╯                                          ┃        ┃      ↓ findings, verdicts
            ┃ tube                                   lower ━━━━━━━┻━━━━━━━━╋━━━━━━━━━━
            ┃                                        floor           tube base (next to the build bench)
          LOWER (Execution)
```
- **Where:** the tube's top already lands at the upper floor's front edge (local x 0.3, z 2.95). The Observatory is a
  2.7 m round table **threaded on the tube**: the tube is its axis, like an orrery's spindle. Its back half stands
  on the travertine, and its front half cantilevers 1.2 m over the lower floor on a glass floor with a brass lip.
  From the camera it sits at the exact seam of the two floors, the visual center of the building. Nothing else
  needs to move.
- **Why it answers "Intelligence → Execution":** every cross-floor handoff passes through the Observatory's center.
  A capsule going down (blue-white, `--intel`) = a finding or a verdict for the builders. A capsule going up
  (champagne) = a build for QA or a question going up for review. As a capsule passes, the table's bezel flips to
  that event's text. The slide stays the robots' way down, and the tube their way up (SPEC).
- **The table top** (one 1024² CanvasTexture, redrawn only on data change) has three rings and a center:
  - **Outer ring, the org as a compass.** 10 seat ticks, each placed at the true bearing of that robot's desk from
    the table. Intelligence seats fall on the back arc, Execution seats on the front arc, so the ring is a map of
    the building. Tick = status glyph + color. A needs-you tick breathes.
  - **Middle ring, the lanes.** RESEARCH · BUILD · QA arcs, one segment per DOING task (owner → lane), filled by
    progress. Satisfactory/shapez: a week counter "7 shipped" sits in the gap.
  - **Inner ring, Flow and Friction** (Frostpunk's two meters): Flow = done this week; Friction = hours stuck plus
    hours waiting on you.
  - **Center:** the **NEEDS YOU** numeral (Bricolage, ember when > 0, brass `00` when zero), and under it either
    `SYSTEM HEALTHY ✓` or the top problem ("1 STUCK · Engine Mechanic").
  - **Bezel:** the most recent event as one line, with a 600 ms split-flap when it changes.
- **Under-glow:** an additive ring sprite on the lower floor's ceiling, under the cantilever. Its radius = the share
  of the crew working, so the "heat" of the org is visible from the whole building (Frostpunk).
- **Legibility:** at Whole-building zoom the table reads as shapes (ticks, arcs, one big numeral). Key **O**, or a
  click on it, glides the camera to a 60° view of the table and opens a DOM **Observatory card** with the same data
  as text, EN/ES. The 3D is for glancing and the DOM is for reading.

---

## 6. Characters (brief item 14)

Unchanged: the matte-ceramic hover robots, the outfits v2, the strips and the personalities (FUN-IDEAS). The
additions are functional:
- **Held object = current work.** Builder: an envelope while handing off. QA: a clipboard, and a red card on a fail.
  Research Lead: a finding card walking to the wall. Right Hand: a note to the line. The object is the handoff.
- **Head = attention.** A queued robot looks toward whoever it waits on; the robot in The Call looks at the viewer.
- **One status mark over the head, only when it matters** (Two Point): ◆ needs you, ■ stuck, ✓ done. Working and idle
  show nothing over the head. The strip and the desk bar carry them.
- **Floor ring:** a thin brass selection ring under the selected robot (a Sims plumbob, grown up).

---

## 7. Status, interaction and UI (brief items 15, 17)

### 7.1 RIGHT NOW (the new always-on list)
The top of the right panel, above the tabs, always visible on the MacBook. It replaces the Crew tab's list, and the
Crew tab keeps the full cards. One strip per robot, sorted by priority, then by age:
```
RIGHT NOW · AHORA                                  3:02 PM
◆ Right Hand       Needs you · Photo proof ok?           12m
■ Engine Mechanic  Stuck · County permit feed down        5h   ← cocked 6 px, hatched edge
● Builder          Building · hub page      91%          20m
● QA Tester        Testing · build T211     12/18         4m
● Research Lead    Researching · 142 sources, 3 findings  1h
⧗ Designer         Waiting on QA                          8m
● Claude Code      Dispatching · 3 tasks out             just now
✓ Cowork           Shipped · storm bundle                 now
○ Chat Reader      Free                                   2h
◐ Storm Watch      Asleep till 6:54 AM
```
- **The glyph is the status color (section 3.1). The verb is the same verb the room shows** (7.3). A metric is shown
  only when the crew posts one (8.2).
- **Row ↔ room:** hovering a row puts the spotlight scrim on that robot. If the robot is off-screen, an edge arrow
  points to it (Factorio). Hovering a robot lights its row. Click = select + card, double-click = Follow.
- When needs > 0, a **You** row sits on top: `◆ You · 2 to answer · oldest 40m` (click = The Call).
- At most 10 rows plus You, 24 px each: about 280 px. The tabs below get the rest.
- ES: "Te necesita", "Atascado", "Construyendo", "Probando", "Investigando", "En espera", "Listo", "Libre",
  "Dormido hasta las 6:54".

### 7.2 Other UI (kept, with small changes)
| Element | Change | Functional reason |
|---|---|---|
| Needs strip (top) | keep; add the tannoy line under it (one line, fades after 8 s) | what just happened, without opening the Log (HAX G4) |
| Robot card | add a **can-do line**, a **track record**, **Recent memory** (last 3 events with because links), and "Change answer" for 90 s | HAX G1, G2, G9, G11; AI Town's inspector |
| Observatory card (new, key O) | the table's data as text | legibility, EN/ES |
| Zone hover | the floor zone names itself with its count ("QA lab · 2 in queue") | WorkAdventure zones; Two Point room queues |
| Keys | O = Observatory, 0 = RIGHT NOW focus, the rest as SPEC (1-9) | one-hand MacBook use |
| Overlay key **V** (Two Point overlays) | toggles a **status overlay**: the room goes 40% grey and only status colors stay lit | find the problem in 1 s on a busy day |

### 7.3 Verb = animation = row (the matching table)
The verb comes from, in order: `step` (new field) → the event kind (`handoff` → "Handing to QA") → status → a keyword
map on `doing` → the role default. The same verb selects the animation and the desk-screen texture:

| Robot | Verbs (EN / ES) | What you see in the room |
|---|---|---|
| Builder | Building / Construyendo · Fixing / Arreglando · Handing to QA / Pasando a QA | types at the build bench, the lit page frame fills to `progress`; carries the envelope to the tube |
| Engine Mechanic | Tuning engine / Afinando · Running engine / Corriendo motor | the open engine box, the wrench turning, a gauge needle |
| Designer | Designing / Diseñando · Pinning options / Colgando opciones | at the easel; a new frame appears on the pin wall |
| Claude Code (King) | Dispatching / Repartiendo · Planning / Planeando · Reviewing / Revisando · Publishing / Publicando | at the dispatch table sliding cards; up the tube to the board for planning |
| Right Hand | Relaying / Pasando recado · Filing / Archivando · Needs you / Te necesita | carries a note between the table and the line |
| Chat Reader | Reading chats / Leyendo chats · Briefing / Informando | turns newspaper pages; walks a note to the King |
| Cowork | Running storm ops / Operando tormentas · Shipped / Listo | pins on the map table move |
| Research Lead | Researching / Investigando · Scanning N sources · Writing findings / Escribiendo hallazgos | reads at the experiment table; walks a card to the research wall |
| QA Tester | Testing n/N / Probando · Investigating / Investigando · Verified / Verificado · Failed / Falló | device screens tick green/oxide; stamps; a fail = a red card |
| Storm Watch | Watching radar / Vigilando radar · Hail found / Granizo · Asleep till 6:54 | the radar sweep; walks the glass (the patrol); runs to the rail on hail |

---

## 8. Data map: what the hub really has, and the small fields to add

### 8.1 Visuals from data the crew already posts
| Visual | Data (exists today) |
|---|---|
| Floor + desk of each robot | agent id → `def.floor` (the page's defs; **flip** Builder, Designer, Engine Mechanic, Claude Code and Right Hand to `down`; Storm Watch to `up`) |
| Status glyph / color / position | `agents/<id>.status` (+ the staleness correction, `silent` from the watchdog) |
| RIGHT NOW verb (fallback) | `doing` keyword map, the event `kind`, the role default |
| Progress ring, page frame fill, "91%" | `agents/<id>.progress` `{done, of}` or 0-1 |
| The Call, the line, the You row | `status:'waiting'` + `ask`, `answers/*`, `board/current.waiting` |
| Dispatch table cards | `board/current.now` + `.next` (`status` → the column; `owner` → which robot's side) |
| Observatory lane arcs | `board/current.now` where DOING, `owner` → the lane (up robots: Research, or QA for `qa-tester`; down robots: Build) |
| Observatory "NEEDS YOU" | `HUB.needs.ids.length` |
| SYSTEM HEALTHY | derived: no `blocked`, no `silent`, `system/king.answersReadAt` fresher than the last run slot, no failed wake |
| Bezel / tannoy line | the newest `events/*` `text` (+ a template per kind) |
| Envelope Builder → QA, capsules | `events/*` `kind:'handoff'` with `to` |
| Stuck andon lamp (second pull) | a `blocked` state that is still set after a King run (`system/king` run time) |
| Flow / Shipped count / Shipped shelf | `done` events this week + board DONE |
| Research wall (fallback) | `system/memory.facts` (the last 6) + `decided` events |
| Recent memory in the card | the last 3 `events` of that agent |

### 8.2 New check-in fields (all optional; CONTRACT v3 + the crew-checkin skill)
| Field | Shape | Example | Feeds |
|---|---|---|---|
| `step` | a verb id from the table in 7.3 (`building`, `testing`, `investigating`, `verified`, `failed`, `researching`, `scanning`, `writing`, `designing`, `dispatching`, `planning`, `publishing`, `relaying`, `reading`, `watching`, ...) | `"step":"testing"` | RIGHT NOW verb, the animation, the desk screen |
| `metrics` | an object of whitelisted counts: `sources, findings, tests, passed, failed, issues, files, checks, chats, scans` | `{"sources":142,"findings":3}` | the row suffix, the Research wall count, QA device ticks |
| `result` (on a `done` event, and on the agent row until its next state) | `{passed, of, issues}` | `{"passed":17,"of":18,"issues":1}` | "TEST COMPLETE 17/18 · 1 ISSUE" on the Right Hand's card and the bezel; the QA bench's device screens |
| handoffs between helpers | a `handoff` event with `agent` = the sender, `to` = the helper, `task`; the King may post it on a helper's behalf with `by:"code"` | Builder → `qa-tester`, task T211 | the envelope walk, the tube capsule, the thread trail |
| `finding` (Research Lead, on a `note` event) | `{title, task?}` (EN or `{en, es}`) | `{"title":"Top crews film every roof"}` | a card pinned on the Research wall, with blue string to its task |
| `lane` on a board row (optional) | `research` \| `build` \| `qa` | when the owner doesn't imply it | Observatory arcs |

Rules: every new field is optional, and when one is missing the hub falls back to 8.1. No field carries HMP App data
(leads, doors, homeowners, claims, money). The whitelist keeps `metrics` from turning into a junk drawer.

### 8.3 The page's derived objects (page → scene, CONTRACT v3)
- `HUB.now`: `{v, rows:[{id, glyph, st, verb:{en,es}, metric, since, cocked}]}`: RIGHT NOW + the scene's
  animation pick. One source for both, so they can't disagree.
- `HUB.observatory`: `{v, seats:[{id, st}], lanes:{research:[w], build:[w], qa:[w]}, needs, health:{ok, top},
  flow, friction, shipped, last:{text, at}}`. The scene redraws the table texture only when `v` changes.
- `HUB.flows`: a queue of `{from, to, task, dir:'up'|'down'|'same', kind:'build'|'verdict'|'finding'|'note'}`,
  made from handoff events. It replaces `HUB.handoffs` (old entries are still accepted).
- `agent.step`, `agent.metrics`, `agent.result` passed through; `seq` bumps when `step` changes.

---

## 9. Animations, fun, efficiency (brief items 16, 18, 19)

### 9.1 The signature story: Builder → QA → Right Hand (all from real events)
1. `builder` posts `done` + a `handoff` to `qa-tester`. The Builder's page frame fills to 100%, it stands, picks the
   envelope out of the staging tray and walks 2 m to the tube base. RIGHT NOW: "Handing to QA".
2. It rides the tube up (1.6 s). The capsule passes the Observatory, whose bezel flips: "Builder → QA · T211".
3. It walks to the QA bench, drops the envelope in the queue rack (count +1), nods to QA and slides back down.
4. `qa-tester` posts `working` + `step:"testing"` + `progress`. The device screens tick row by row (n/of). On a fail
   the tick turns oxide and QA stamps. On `result` with issues, QA carries a red card to the Builder (FUN-IDEAS).
5. QA posts `done` + `result` + a handoff to `king` (the Right Hand). A **blue-white verdict capsule** drops down the
   tube to the dispatch table. The Right Hand opens it, and its card and the bezel read **"TEST COMPLETE · 17/18
   PASSED · 1 ISSUE"**. A thin thread trail (8 s) lights the whole path: bench → tube → Observatory → table.
Reduced motion: each step's final state, no walking.

### 9.2 Other functional animations
| Trigger | Animation | Why |
|---|---|---|
| A research `finding` | Research Lead walks a card to the wall; a blue string draws to its task | knowledge you can see accumulating |
| A board status change | its card slides one column on the dispatch table (600 ms) | the board moves in the room |
| Stuck, second pull | the andon lamp lights on that desk; that desk's aisle gets a faint hatch | Factorio: the problem is marked where it is |
| Needs you | as built (The Call, the line); the Observatory numeral rolls | unchanged |
| Hail (Storm Watch `storm`) | as built; plus Storm Watch walks to the glass rail over the Observatory | the event is seen at the center |
| Night | the pods fill; the Observatory dims to a brass `00` and "all quiet" | the calm is itself information |

### 9.3 Fun, not childish
- **The tannoy** (Two Point): one dry line per real event, rotating from a written set, EN/ES. "Engine Mechanic,
  your feed is still down." "QA to the bench, one build waiting." Never a joke about FilthE; off with the sound
  switch.
- **Earned, not given:** gear and plaques only from real milestones (FUN-IDEAS). The Shipped shelf is a record, not
  confetti.
- **Rhythm:** the room is quiet most of the time, so a handoff walk is an event you notice. That scarcity is what
  keeps it premium.

### 9.4 Efficient, not boring: the 10 questions, each answered in one place
| Question (brief "Efficiency first") | Answered by |
|---|---|
| What am I working on? | the You row + the Needs strip |
| What are agents doing? / who works? | RIGHT NOW verbs; robots at their desks |
| Who waits? | ⧗ rows; robots at the queue rack or looking at who they wait on |
| Who needs me? | ◆; the line at your spot; the Observatory numeral |
| What recently happened? | the tannoy line; the bezel; the Log tab |
| What needs action? | the You row (sorted by the "real blocker" rule, CONVENIENCES #9) |
| What's researched? | the Research wall (the last 6 findings) |
| What's built? | the Shipped shelf; Flow on the Observatory |
| What failed? | ■ rows (cocked); andon lamps; QA red card |
| What completed? | ✓ rows (6 s), then the Shipped shelf |

---

## 10. Change list: every change and its functional reason

| # | Change | Functional reason | Cost |
|---|---|---|---|
| 1 | Re-seat to the new floor split | FilthE's split: place = kind of work | move desks and nav nodes; no new rooms |
| 2 | Radar table up by the glass | the watcher faces the sky; frees the build bench space | move 1 group |
| 3 | 2 lab desks up → 1 QA bench; 2 removed | a countable QA queue; a quiet floor | merge meshes |
| 4 | Chat Reader desk → dispatch table; the Chat Reader to the spare desk | King + Right Hand together, where work passes | 1 new table |
| 5 | Old King desk → experiment table; hot desk → Research desk | the research lab gets its tools | retexture screens |
| 6 | Glass research wall (new) | visible knowledge; acoustic zoning | 1 plane + 1 canvas |
| 7 | Pin wall + Shipped shelf on the lower slat wall | design options visible; shipped work visible | resize the trophy atlas |
| 8 | The Observatory on the tube top | one surface for the org; the Intelligence → Execution seam | ~8 draw calls, 1 canvas |
| 9 | Stuck oxide `#e0685c` → `#d9483b`; done → verdigris | color-blind separation; pass must read as pass | tokens only |
| 10 | RIGHT NOW list | glanceable, matched to the room | page only |
| 11 | Capsules both ways + the thread trail | work visibly moves | reuse the capsule; 1 line mesh |
| 12 | Upstairs task light to 4000K, `--intel` accent | the two floors read differently without labels | recolor only |
| 13 | New fields `step`, `metrics`, `result`, `finding` | the visuals show real numbers, not invented ones | skill + contract |

**Performance budget (MacBook Air):** net **+20 draw calls at most** (removing 2 desks and the radar's old props
offsets about 10). **No new real-time lights, no new shadow casters.** The Observatory texture is redrawn only on
data change. The thread trail is one `Line2`, reused. At most 2 walkers at once. All other smoothness work is in
RESEARCH-v28.md (items 1-4 first).

---

## 11. Build plan (milestones; SCENE = `pages/hub/scene.js`, PAGE = `pages/crew-hq.html`)

A contract change goes first, in its own commit (CONTRACT.md rule). Each milestone ends with the design gate
`--page crew-hq`, shots.js, `release_checks.sh --fast` and 1440/1512 MacBook shots, light and dark.

**M0 · Contract and crew fields (half a session)**
1. CONTRACT.md v3: `HUB.now`, `HUB.observatory`, `HUB.flows`, `agent.step/metrics/result`, the status tokens (3.1),
   `def.floor` flips.
2. The crew-checkin skill: `step`, `metrics` (whitelist), `result`, helper→helper `handoff` (with `by`), `finding`.
3. Fixture rows (demo data) that exercise every state, plus one full Builder → QA → Right Hand chain.

**M1 · Re-seat + RIGHT NOW (1 session; the highest functional value)**
4. SCENE: move `DESKS`, `DESK`, the seat plates and the desk bars to the new floors (5.1, 5.2); move the radar
   group up; merge the QA bench; add the dispatch table (reuse `desk()` + walnut); move the pendant; update
   `NODES/EDGES` and the `POOL`s (the huddle, the queue-rack spot at the QA bench).
5. PAGE: flip `def.floor`; build `HUB.now` (the verb resolver in 7.3, sorting, cocked); render RIGHT NOW above the
   tabs with row ↔ room hover, edge arrows and the You row; EN/ES strings.
6. SCENE: an animation pick from `step` (reuse type/read/radar and the prop screens; add `stamp`, `pin`, `slide-card`).

**M2 · The status system (half a session)**
7. PAGE: the new tokens; the glyph set (◆ ■ ✓ ● ⧗ ○ ◐ ◌) in the rows, tags and cards; the V overlay (grey room).
8. SCENE: the strip and desk-bar colors from `HUB.theme`; the hatched desk bar for stuck; the andon lamp
   (an instanced 2-tier stack, off by default); a status mark over the head only for ◆ ■ ✓; the selection ring.

**M3 · The Observatory (1 session; the signature)**
9. SCENE: the ring table on the tube (walnut rim `CylinderGeometry` + brass torus + a dark glass top), the half-disc
   glass cantilever with a brass lip, and the under-glow sprite; the table texture drawn from `HUB.observatory` when
   `v` changes (the compass seats from the real desk bearings); the bezel split-flap.
10. PAGE: build `HUB.observatory` (lanes from board owners, health rule, flow/friction/shipped); key O +
    `cam:'observatory'` + the Observatory card (EN/ES).

**M4 · Workflow made visible (1 session)**
11. PAGE: `HUB.flows` from handoff events (direction from both floors; kind from the sender's role); tannoy lines;
    RIGHT NOW "Handing to X".
12. SCENE: the Builder → QA → Right Hand story (9.1): the envelope pick, the tube ride, the queue rack drop, the
    verdict capsule down, the thread trail (one reused `Line2`, 8 s fade), the bezel flip as a capsule passes; the
    2-walker cap and a capsule-only fallback.

**M5 · Zones dressed with data (1 session)**
13. SCENE: the glass research wall (a canvas of up to 6 finding cards + blue strings), the pin wall + Shipped shelf
    (resize the trophy atlas), the QA device screens ticking from `progress/result`, the queue-rack count,
    the dispatch-table cards, the 4000K upstairs retint.
14. PAGE: the card additions (can-do line, track record, Recent memory with because links, Change answer), zone
    hover names with counts.

**M6 · Review and ship (half a session)**
15. Perf pass against the budget (read `SCENE.info`, RESEARCH-v28 item 4); the color-blind check (simulate
    deutan/protan/tritan on the shots); an adversarial review (taste, function, rules); CHANGELOG line; publish per
    the go-live rule (same URL, `crew-hq.files.json` as files).

**Top 5, if only five get done:** 4+5 (re-seat + RIGHT NOW) · 7+8 (the status system) · 9+10 (the Observatory) ·
11+12 (Builder → QA → Right Hand) · M0's fields (so the numbers are real).

---

## 12. Sources

Opened (read in this session):
- Microsoft Research, *Guidelines for human-AI interaction design* (the 18 guidelines):
  https://www.microsoft.com/en-us/research/blog/guidelines-for-human-ai-interaction-design/
- Microsoft, *AI Agents for Beginners*, lesson 03, agentic design principles (Space / Time / Core):
  https://github.com/microsoft/ai-agents-for-beginners/blob/main/03-agentic-design-patterns/README.md
- Pixel Agents: https://github.com/pixel-agents-hq/pixel-agents
- WorkAdventure: https://github.com/workadventure/workadventure
- AI Town: https://github.com/a16z-infra/ai-town · Generative Agents (Smallville): https://github.com/joonspk-research/generative_agents
- Wikipedia: [Apollo Mission Control Center](https://en.wikipedia.org/wiki/Apollo_Mission_Control_Center),
  [Christopher C. Kraft Jr. Mission Control Center](https://en.wikipedia.org/wiki/Christopher_C._Kraft_Jr._Mission_Control_Center),
  [Mission control center](https://en.wikipedia.org/wiki/Mission_control_center),
  [Flight progress strip](https://en.wikipedia.org/wiki/Flight_progress_strip),
  [Air traffic control](https://en.wikipedia.org/wiki/Air_traffic_control),
  [Andon (manufacturing)](https://en.wikipedia.org/wiki/Andon_(manufacturing)),
  [Kanban board](https://en.wikipedia.org/wiki/Kanban_board), [IDEO](https://en.wikipedia.org/wiki/IDEO),
  [Boston Dynamics](https://en.wikipedia.org/wiki/Boston_Dynamics),
  [Google DeepMind](https://en.wikipedia.org/wiki/Google_DeepMind),
  [Toyota Research Institute](https://en.wikipedia.org/wiki/Toyota_Research_Institute),
  [McLaren Technology Centre](https://en.wikipedia.org/wiki/McLaren_Technology_Centre),
  [Two Point Hospital](https://en.wikipedia.org/wiki/Two_Point_Hospital), [Factorio](https://en.wikipedia.org/wiki/Factorio),
  [Satisfactory](https://en.wikipedia.org/wiki/Satisfactory), [Frostpunk](https://en.wikipedia.org/wiki/Frostpunk),
  [RimWorld](https://en.wikipedia.org/wiki/RimWorld), [Shapez](https://en.wikipedia.org/wiki/Shapez),
  [The Sims 4](https://en.wikipedia.org/wiki/The_Sims_4), [Plumbob](https://en.wikipedia.org/wiki/Plumbob),
  [Color blindness](https://en.wikipedia.org/wiki/Color_blindness)

Search excerpts only (this container's egress policy blocks these hosts, so the pages could not be opened; the
claims above use only what the excerpts say):
- Gensler: NEXT NEXT https://www.gensler.com/blog/next-next-the-future-of-labs · Global Workplace Survey 2025/2026
  https://www.gensler.com/gri/global-workplace-survey-2025 · 10 workplace trends 2026
- IDEO journal: https://www.ideo.com/journal/how-we-designed-a-studio-space-that-reflects-our-values ·
  Smashing Magazine, "Up on the wall" (working walls)
- Microsoft Design, "UX design for agents": https://microsoft.design/articles/ux-design-for-agents/
- Gather help center, "Desk overview" / "Best practices in office design"
- F1 race support rooms: Pitpass "The Race Support Room", Autosport "Inside the Mercedes mission control",
  McLaren "Mission Control"
- TRI news, "Robots can learn new actions faster": https://www.tri.global/news/robots-can-learn-new-actions-faster-thanks-ai-techniques
- Factorio alerts (wiki.factorio.com/Alerts, forums) · Two Point Hospital wiki "Icons" and "Tannoy"
- Okabe-Ito palette references (Color Universal Design, 2002; Wong, *Nature Methods* 2011)

Measured here: the ΔE numbers in 3.1 (sRGB → CIELAB, with Machado 2009 CVD matrices at full severity), computed in
this session.
