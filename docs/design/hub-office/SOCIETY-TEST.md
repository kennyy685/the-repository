# AI Hub society test (walkthrough note 7) - 2026-09-28

Run against the live v27.1 code (`pages/crew-hq.html` + `pages/hub/scene.js`, hub Version 27), before any v28
work. Rendered headless with the real 3D scene (three.js routed to a local copy, Chromium + swiftshader), a mocked
`window.claude` and three fixture states (busy morning, asleep at night, all caught up). Full method at the bottom.

## Verdict, top of the page

**The bones are good and it does not feel like a toy.** The needs-count is always accurate, answering a question
from the top strip takes 2 clicks and shows a receipt ("You answered Yes - With the King"), the calm states (asleep,
all caught up) are genuinely calm, and nothing broke: 0 console errors and 0 sideways scroll across every state,
fixture and size tested (390-1512 px). The automated design-gate pass is clean. The 5 fixes that would matter most
to FilthE, in order:

1. **Speech bubbles over two robots standing near each other overlap and clip each other's text** - reproduced
   twice on a normal busy-morning load, not an edge case (S1).
2. **The "Good morning" recap never says how many things need you** - it says "0 done - 1 stuck" and stays silent
   about the 6-7 things actually waiting, even though that is the one number the busy-morning promise is built on
   (S2).
3. **Selecting a robot's card keeps it open across tabs**, so checking the Board tab for blocked work pushes the
   real board list down and hides most of it behind the still-open card (S3).
4. **A stale robot's card can say two contradictory things at once**: status = idle (grey), but "NOW" still reads
   "Building the app layout" in the present tense (S5).
5. **Ship the closable panel + declutter pass already planned for v28.0** - this test independently rediscovered
   why it matters (the strip's 2-item cap, the card eating tab space, the bubble collisions all come from "too much
   is always on screen at once").

Nothing here is a crash or a broken control - it is all "confusing for a few seconds," which is exactly the kind of
thing this test is for.

## The panel

**1. Busy morning (ADHD, 8+ hours away, wants 5 seconds and a tap).** Score 7/10. Opened to a "Good morning" card
and a top strip reading a big, correct "07 NEEDS YOU." Tapped the first named chip (Designer), got a full card
with the question, three equal buttons and a "Type..." fallback, tapped Yes - 2 clicks total, count dropped to 06
immediately, and the card kept a receipt ("You answered Yes - 8:30 AM - With the King"). Liked that. Annoyed by:
the recap card's own words never mention "N need you," only 2 of the 7 waiting robots are named in the strip
("Designer," "Chat Reader," then a bare "+5"), and two robots' ask-bubbles overlapped each other in the room the
whole time, so for a few seconds it looked broken rather than busy.

**2. Just watching at night, for fun.** Score 9/10. Set the clock to 11:15 PM: every robot walks itself into a
charging pod, "07" becomes a quiet "00 - Nothing needs you," the room goes warm and dim, and nothing pops up or
makes noise (sound is off by default). Ten straight minutes of this would be pleasant, not annoying - nothing asked
for attention, nothing looped in an obviously fake way in the screenshots taken a few seconds apart.

**3. A first-time viewer FilthE shows this to.** Score 6/10. The header ("The Crew / AI hub - Fremont, NE"), the
hint line ("Click a robot to see what it is doing") and the canvas's own description explain the concept in one
glance, and every robot's status is glyph + word, not just a colored dot, so "what does orange mean" answers
itself. Undercut by two things a stranger would notice immediately: the overlapping ask-bubbles (finding S1) read
as a glitch, and the browser tab still says "HMP AI Hub" no matter what the hub is renamed to in "Make it yours" -
a leftover brand name on the one thing a guest looks at first (browser tab). That second one is already tracked
under note 11, not new.

**4. Keyboard + screen reader.** Score 7/10. Tabbed through 14 stops with no dead end and a visible brass outline
on every one (checked via computed style, not just eyeballing). Esc closes the right thing every time, checked
against the code's own priority order (eyes view, recap, "Make it yours," keys sheet, view menu, quick-answer
plate, "more" plate, selection - each one only if the one before it wasn't open). Roles are real (`role="tablist"`,
`role="dialog"`, `aria-live="polite"` on the card, `aria-selected` on tabs, a proper `aria-label` on the 3D canvas
itself). One real surprise: tab order visits the floating "Call" panel's Yes/No/Not now/Type buttons *before* it
reaches Today/Refresh/Make-it-yours/EN/ES, even though those last four sit in the same header row, right next to
where focus started (S6). Not tested with an actual screen reader (VoiceOver/NVDA); this is a structural read of
roles, names, order and focus visibility only.

**5. Low-vision / color-blind.** Score 8/10. Status is glyph + word + color everywhere in the code
(`// status: glyph + word + color, never color alone`), so nobody has to tell orange from red to know a robot is
stuck vs. waiting. Spot-checked the token colors against the page's own dark background: every status and text
color clears WCAG AA (5.6:1-17.4:1; tightest are the muted timestamp gray at 5.56:1 and the stuck/oxide red at
5.84:1, both still comfortably over the 4.5:1 minimum). The automated design-gate contrast check (real pixels
behind the text, not just token math) passed with zero findings at both phone sizes. Not independently re-verified
at 1440/1512 px - see the Method section's coverage-gap note.

**6. Older MacBook Air (load, fans, battery, hidden tab).** Score 7/10. Could not measure real frame rate - per the
brief, headless swiftshader numbers are not a MacBook number, so I'm reporting draw calls/triangles/heap only (see
Measurements) and saying plainly that real fps needs FilthE's own machine. What I could verify from the code and
from testing: the tab going hidden fully pauses the render loop (`power === 'paused'`), 2 minutes unfocused or
untouched drops to a 30 fps / DPR-1.25 "saver" mode, and shadows only redraw when the light actually moves - all
real, sensible battery choices already shipped. The one flag: a cold load in this sandboxed, software-rendered
container took about 24 seconds for the office to appear at all, which is almost certainly this environment (disk
I/O for the locally-routed three.js modules plus CPU-only WebGL), but a multi-second blank stage on a real machine
before the scene shows up is worth watching for.

**7. Skeptical engineer (is this live, did my click land, what if it drops).** Score 7/10. Real strengths: a
reconnect path on `visibilitychange`/`pageshow`/`focus`/`online` with backoff, a live dot with distinct states, and
- the best one - every answer keeps a visible receipt in its card ("You answered Yes - With the King," with a
"Change" link). No-WebGL and CDN-blocked both fell back cleanly to the static picture with zero console errors,
exactly as documented. Trust took two small hits: the Builder card's contradiction (S5) and the browser tab title
frozen at "HMP AI Hub" (already tracked, note 11) both look like the page not quite keeping its story straight.

**8. Picky product designer (clutter, hierarchy, the panel).** Score 6/10. The visual craft is genuinely premium -
isometric office, restrained materials, real glyph iconography, nothing cartoonish. But this session's own "find
the board's blocked tasks" and "answer three questions on a busy morning" tasks are exactly what surfaced the
crowding: the always-open card eating the Board tab (S3), the strip's silent 2-item cap next to an unexplained
"+5" (phone's clearer "All 7" doesn't match desktop's wording), and the bubble collisions (S1). The panel still
cannot be closed (note 8, confirmed still true in every screenshot taken) - the office never gets to fill the
screen the way FilthE asked for.

## Findings, ranked

| id | finding | who hit it | evidence | proposed fix | effort | now or v28 | notes coverage |
|---|---|---|---|---|---|---|---|
| S1 | Two nearby waiting robots' ask-bubbles overlap and clip each other's text | busy morning, first-time viewer, designer | `shots/society/04-needs-chip-opened-card.jpg`, `shots/society/13-keyboard-focus-6th-tab.jpg`, `shots/society/02-macbook-1440-perf-hud.jpg` (same overlap in 3 independent captures) | give ask-bubbles a simple z-order/offset rule when two robots' anchors are close together | M | fold into v28.0 (bubble-visibility rules are already being redesigned, BUILD-v28.0 item 8) | NEW - related to note 9's general "too crowded," not called out itself |
| S2 | "Good morning" recap never states how many things need you, only done/stuck counts | busy morning | `shots/society/03-needs-strip-busy.jpg`, `shots/society/21-empty-all-caught-up.jpg` - same phrasing "Overnight: N done - N stuck" with the needs-you count (07, in the strip right above) never repeated in the card's own words, even though SPEC.md's own example line is "3 done, 1 stuck, **2 need you**" | add the needs-you clause to the recap sentence | S | quick fix now | NEW |
| S3 | Selecting a robot keeps its card open across tab switches, pushing the Board tab's own list (and its "blocked" items) below the fold | designer, busy morning (the "find blocked tasks" task) | `shots/society/07-board-tab-blocked.jpg` - Designer's card fills ~45% of the panel above "BOARD / NEEDS YOU 4," only 1 of 4 items visible without scrolling | close or auto-collapse the card on leaving the Crew tab | M | fold into v28.0 (same area as the closable-panel work, note 8) | NEW - related to note 9 |
| S4 | Side panel still cannot be closed; the office never fills the screen | designer, everyone (panel is in every screenshot) | every screenshot in `shots/society/` | (already planned) | M | already in progress | **covered by note 8** - not new, confirmed still true |
| S5 | A stale/orphaned robot's card can show "idle" (correct) right next to "NOW: Building the app layout" (stale, present tense) - the real explanation ("no check-out since then") is several lines further down | skeptical engineer, busy morning | `shots/society/11-builder-card-silent.jpg` | when a robot's `st` is idle-by-staleness (not a real idle), relabel "NOW" to "LAST TASK" or similar | S | quick fix now | NEW |
| S6 | Keyboard Tab order visits "The Call"'s Yes/No/Not now/Type buttons before the header's Today/Refresh/Make-it-yours/EN/ES controls, even though the header row sits visually right next to where focus started | keyboard-only | captured tab-order JSON (14 presses; `notes` kept in the run's log, not committed) | move The Call earlier or later in DOM order to match its visual position, or give it a distinct focus region | M | fold into v28.0 (The Call is being redesigned as the King-chat bubble, note 3) | NEW - related to note 3 |
| S7 | Desktop "+5" (needs strip) is less clear than the phone layout's "All 7" for the same overflow | busy morning, designer | `shots/society/03-needs-strip-busy.jpg` vs `shots/society/23-size-phone.jpg` | match desktop's wording to phone's ("All N") | S | quick fix now | NEW, small |
| S8 | `design_gate.js`'s automated check never exercises crew-hq at >=900 px (the MacBook layout FilthE actually uses) and never clicks into its Crew/Board/Log/Chat tabs or "Make it yours"/Keys sheets - `PAGES` lists it with `tabs: null, views: []` | test coverage, not the page itself | `tests/pages/design_gate.js` lines ~74-79 | add a 1440x900 (or 1512x982) size and a `views` list of clicks for crew-hq | S/M | fold into v28.0 QA step (BUILD-v28.0 says every milestone runs the gate + shots at 1440/1512) | process note, not a page bug |
| S9 | Could not confirm "Make it yours" opens via automated click; the button itself hit-tests as clickable and unobstructed in an isolated check, so this looks like the ~3-4 fps headless render starving Playwright's own click-stability wait, not a real bug | (automation only) | isolated hit-test confirmed `#mineBtn` clickable; one `page.click` timeout in the main run | none - recommend a 10-second manual click to confirm, nothing to fix from this alone | - | - | unverified, low confidence |

## Measurements

| what | value | notes |
|---|---|---|
| `design_gate.js --page crew-hq` | **PASS**, 0 findings | 12 views (360x800 + 420x900 x 4 theme combos, EN), 348 controls / 822 text runs checked, 23 s. Phone widths only - see S8. |
| Cold load, "Whole" office visible | ~24.0 s | headless, software-rendered (swiftshader), locally-routed three.js modules - **not a MacBook number**, but flags a real dependency chain worth a quick real-device check |
| Draw calls (Whole view, busy fixture) | 444 (peak 460) | matches SPEC's own prior note ("~450 draw calls in Whole view") |
| Triangles | 118.0k | moderate for a stylized office |
| Geometries / textures | 300 / 45 | |
| fps / p95 frame time (headless) | 3 fps / 350 ms | **swiftshader software rendering - not representative of a MacBook GPU**; real fps needs FilthE's machine with `?perf` |
| JS heap | ~18.5 MB visible -> ~20.0 MB after 4 s hidden | one sample, not a leak test; render loop does pause when hidden (`power:'paused'`) |
| Click count: answer a top-strip question | 2 (chip -> Yes) | receipt shown immediately, count decremented live |
| Click count: see the board's blocked tasks | 1 (Board tab) | render time not reported - too noisy in this environment to trust as a real number |
| Console errors/warnings | 0 | across busy/night/empty fixtures, 5 sizes, no-WebGL, CDN-blocked, 200% zoom, camera keys 2-9 |
| Sideways scroll | none found | 390, 1280, 1440, 1512 px, and at 200% zoom on a 1440 base |
| Keyboard focus | 14/14 stops visible | brass outline, `outline-style: solid` on every one measured |
| Contrast (token math vs. `--bg`) | 5.56:1 - 17.4:1 | all clear WCAG AA (4.5:1); tightest are muted gray (5.56:1) and stuck/oxide red (5.84:1) |
| prefers-reduced-motion | honored | `matchMedia(...).matches` true and motion cuts confirmed in `scene.js` |

## Keep list - do not lose these in v28

- **Proof it landed**: every answered question keeps a visible receipt in its card ("You answered Yes - 8:30 AM -
  With the King," with a "Change" link). This is exactly what the skeptical-engineer persona wants and should
  survive any redesign.
- **The needs-you count is always right** and updates live the moment you answer (07 -> 06 in this session, with no
  reload).
- **2 clicks to answer** a question from the top strip - genuinely fast for the busy-morning persona.
- **"Good morning" / "all caught up" copy** is plain, short and reassuring ("All clear. Next run 12:52 PM. You can
  close the lid.") - exactly FilthE's "skimmable" brief.
- **Status is glyph + word + color, never color alone** - a real accessibility foundation, confirmed in the CSS
  comments and in every screenshot.
- **Calm states are calm**: asleep-at-night and all-caught-up both read as genuinely quiet, not just "nothing
  rendered."
- **Graceful fallbacks**: no-WebGL and CDN-blocked both show the same static picture of the office with zero
  console errors - it never looks broken, just different.
- **Battery sense already built in**: hidden tab pauses rendering, 2-minute idle drops to a 30 fps saver mode,
  shadows only redraw when the light moves.
- **Zero console errors** across every state and size this test touched.

## Method

Rendered `pages/crew-hq.html` (+ `pages/hub/scene.js`, `outfits.js`, `eyes.js`) headless via Playwright/Chromium
(`--use-angle=swiftshader`), served through `tests/pages/serve.js` so the multi-file artifact's `hub/scene.js` and
fonts load correctly. `cdn.jsdelivr.net/npm/three@0.169.0/*` was routed via `page.route` to a local
`npm pack three@0.169.0` (the CDN itself is reachable by curl through the proxy but Chromium can't validate the
proxy's TLS cert). `window.claude` was mocked with the same fixture-backed `db`/`user`/`sample` shape
`tests/pages/design_gate.js` uses, frozen with `Date` overridden to a fixed instant per scenario, built from three
fixtures derived from `tests/pages/design_gate_fixture.json`: **busy** (7 things needing him, one silent/stale
robot, one blocked, a full board, ~80 log events, clock 8:30 AM the morning after), **night** (all 10 asleep, clock
11:15 PM, after-hours), and **empty** (all idle, nothing needing him, empty board and log). Sizes: 1440x900 (primary),
1512x982, 1280x800 and 390x844, plus 200% zoom and `prefers-reduced-motion: reduce` variants. `#test` was used to
turn off transitions; the real 3D scene rendered in every screenshot except the explicit no-WebGL and CDN-blocked
checks (canvas `getContext('webgl*')` stubbed to return null, and CDN requests aborted, respectively - both fall
back to the still image as documented). `?perf` supplied the draw-call/triangle/fps HUD. Ran
`node tests/pages/design_gate.js --page crew-hq --shots` separately for the automated contrast/tap-target/overlap/
empty-control/duplicate/js-error pass. 32 screenshots were captured; 15 were kept as evidence (~1.8 MB total) under
`docs/design/hub-office/shots/society/`, the rest deleted as redundant.

**Not tested / could not test:** real frame rate, fan noise, battery drain and cold-load time on an actual MacBook
(the brief is explicit that headless swiftshader numbers aren't a MacBook number - draw calls, triangles, heap and
the pause/saver-mode *logic* are reported instead); a real screen reader (VoiceOver/NVDA) - only roles, names,
order and focus visibility were checked structurally; a literal ten-minute real-time watch for the night persona
(assessed from code + screenshots a few seconds apart instead); Spanish strings (out of scope per note 11); and a
handful of automated clicks that likely failed only because of this environment's ~3-4 fps headless render
starving Playwright's own action-stability check (S9) - flagged as unverified rather than reported as bugs.
