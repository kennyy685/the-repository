# Penthouse HQ: the real AI hub (board T190)

Build spec for `pages/crew-hq.html`. The approved look is `penthouse.html` in this folder (FilthE: "AWWW that looks so
cute"). This file records every decision FilthE made while it was being built (2026-09-27), so a restart loses nothing.

## What it is
The hub's first screen is the 3D office. The crew are matte-ceramic hover robots with HMP-orange light strips, running on
the live hub database (`agents/<id>`, `events`, `board/current`, `answers`, `system/memory`, `system/king`). Everything
the hub already did stays underneath the office: board, answer buttons, King's orders, memory, the Right Hand box,
both logs, EN/ES. The hub stays its own place (nothing from the HMP App).

## FilthE's decisions (2026-09-27, in order)
1. **Dressed for the job.** King = crown + cape. Right Hand = headset + gold tie. Cowork = captain's cap. Storm Watch
   = yellow rain hat + blinking antenna. Builder = orange hard hat + tool belt. Designer = beret + pencil. Engine
   Mechanic = welding goggles + wrench. QA Tester = round glasses + clipboard. Research Lead = explorer hat +
   magnifying glass. Chat Reader = newsboy cap + stack of papers. Same outfits on the flat avatars.
2. **Answer in the hub, not the chat.** Board questions and any robot waiting on him get Yes / No / Not now + a type
   box right in its card. The answer saves to `answers/<id>` + a handoff event, and wakes the King instantly.
   Robot questions use id `<agent>-<YYYYMMDDTHHMMSSZ of the agent's at>`; see the crew-checkin skill.
3. **Two floors, so nobody is crowded.** Upstairs = the King (Claude Code), Right Hand, the board, and one desk each
   for Builder, Designer, Engine Mechanic, QA Tester, Research Lead. Downstairs = Cowork's storm desk, Storm Watch's
   radar table, the Chat Reader, the coffee bar, the lounge, "your spot", the trophy wall and charging pods.
   Down = a spiral slide. Up = a glass suction tube ("fwoop"). Trips only when the work says so.
4. **No open-chat mission control.** FilthE talks to the King in Claude Code. Instead: one robot, the **Chat Reader**
   (`chat-reader`), a cheap helper on the King's runs that reads the other Claude chats and tells the King what is
   going on. It checks in like every robot.
5. **All information stays together** in the hub's one database; the HMP App stays separate on purpose.
6. **Camera views:** Whole building (default), Upstairs, Downstairs, Follow (stays on the tapped robot, through the
   slide and the tube). Smooth glides; reduced motion = cut. Drag still turns the room. Last view remembered.
7. **All 7 extras, now:**
   - "While you were away": after 3+ hours away, a short replay then one line ("3 done, 1 stuck, 2 need you").
   - Progress rings over a working robot from the optional `progress: {done, of}` field.
   - A soft ding when a robot newly needs him. Off by default, one switch.
   - Trophy wall: finished tasks (board DONE + `done` events) become plaques downstairs.
   - Real Fremont weather in the windows (api.weather.gov) when the page may fetch it; clock-only sky otherwise.
   - Visible handoffs: a glowing folder flies from sender to receiver on a `handoff` event.
   - Bedtime: sleeping robots dock in charging pods downstairs.

## Screen priority (FilthE, 2026-09-27)
"This AI hub is primarily for a MacBook, don't worry about an app." Design and polish for the MacBook screen first
(1440-1512 px wide, ~900 px tall, trackpad + keyboard). Phones only need to keep working (the design gate still
checks 360/420 px); no phone-first trade-offs.

## Fun camera views (FilthE, 2026-09-27: "I know you can come up with funner camera POVs")
Keys 1-8 on the MacBook, plus the camera buttons: 1 Dollhouse (whole building, Wes Anderson cutaway framing),
2 Blueprint (top-down architect's plan, robots as glowing dots), 3 Security cam (fish-eye corner CCTV, timestamp +
grain, Cam 1 up / Cam 2 down), 4 Ride-along (right behind a robot through walks, the slide and the tube),
5 Through the window (outside in the dusk looking in, Hopper's Nighthawks), 6 Tilt-shift (close, low, shallow depth
of field so it reads as a real miniature), 7 Tour (slow cinematic orbit), 8 Director mode (auto-cuts to the action:
a finish -> the celebration, a question -> "your spot"; doubles as a screensaver). Reduced motion: cuts, no orbits.

## Fun layer approved (FilthE, 2026-09-27: "yes I like the ideas")
1. Robot eyes: a "See what it sees" picture-in-picture per robot (Storm Watch = live radar, QA = checks going
   green/red, Builder = the page it builds, etc.).
2. Personalities: own walk + idle habits per robot (King's cape swish, QA re-checks its clipboard, Storm Watch
   yawns at 6:54 AM, Designer squints at the board).
3. Real wins get real parties: confetti + a victory lap down the slide on a finished task; a 5-in-a-row streak
   lights the trophy wall.
4. Hail alert moment: real hail from Storm Watch -> sky darkens, lightning, every robot turns to the window, Storm
   Watch runs to "your spot".
5. Unlockable outfits: milestones earn gear (Builder's 100th page = gold hard hat, King's winter scarf in December,
   Huskers hats on game day).
6. After-hours mode: late at night the lights go warm and low; robots still working get a desk lamp + coffee cup.
Plus the ranked picks in FUN-IDEAS.md and the outfit redesign ("make the outfits more appealing").

## Interactive scenes + human/AI awareness (FilthE, 2026-09-27: "add interactive funny scenes, allow more human
and AI awareness of each other")
The crew notices FilthE:
- On open, robots look up, the King nods, the Right Hand waves and greets him by time of day, EN/ES, with a
  one-line "since you left" count.
- Robots near the cursor turn their heads to follow it; hover perks one up.
- A small FilthE figure stands at "your spot" while the hub is open; a waiting robot walks right up to it.
- Answering a robot's question -> it thanks him (bow / fist-pump) and goes back to work.
- Idle robots straighten up while he's actively watching; after he goes idle for a while they lounge again.
FilthE sees the AIs' awareness of each other:
- Handoff lines: an order draws a glowing line from sender to receiver.
- Thought icons over working robots (hail cloud, bug, paintbrush...) from what they're doing.
Interactive funny scenes (tied to real events where possible, classy):
- Double-click a robot = an in-character reaction (QA drops its clipboard, Storm Watch grumbles, the King fixes its
  crown).
- Drag a coffee cup onto a tired/long-working robot = it perks up.
- A QA "blocked"/bug report -> QA carries a red card to the Builder, who facepalms.
- A stand-up (several robots working at the board) -> they gather, the King points, one dozes in the back.
- A big finish -> a high-five chain and a victory lap down the slide.

## More ideas from awareness (lead's picks, 2026-09-27; FilthE asked for more, ranking pending)
FilthE's desk with sticky notes (each open question is a note; answering sends it flying to the robot) · answers
ride the suction tube in a capsule · robots talk in short bubbles built from real handoffs ("Builder, T190 is
yours" / "On it, boss") · work buddies (frequent handoff pairs sit together, fist-bump in passing) · office mood
lighting from real streaks/blocks · Employee of the Week plaque (most finishes, Sundays) · Team photo button (posed
crew shot with the date, saved to the trophy wall) · weekend ping-pong for idle robots · Chat Reader's news ticker.

## What pleases him most (FilthE, 2026-09-28)
"I get extremely pleased by convenient things that are extremely helpful and carefully thought of, that I wouldn't
have thought of." Rank every idea by this first: anticipatory, saves time or worry, non-obvious, zero effort for him.

## Design directive (FilthE, 2026-09-28)
"Create a premium AI look with abstract generative forms, cinematic scroll interactions, immersive WebGL scenes,
luxury typography and a dark futuristic aesthetic that feels alive." Applied to the one-screen MacBook hub:
- Dark futuristic default: deep graphite night; HMP orange + brass are the only warm light; glass and shadow.
- Abstract generative forms: a live generative layer (flow-field particles / noise shader) behind the office = the
  crew's "mind": speed/brightness from how many robots work, orange when something needs him, calm when they sleep;
  handoffs send a streak of light between robots.
- Immersive WebGL: soft bloom on lights, depth/fog through the glass, floor reflections (guard MacBook Air speed).
- Cinematic scroll: trackpad scroll over the stage drives the camera (whole building -> floor -> the robot that
  needs him), not the page; panels reveal with gentle parallax. The page itself stays one screen.
- Luxury type: large Bricolage display with tight tracking, spaced mono labels, refined numerals.
- Alive = every motion is driven by real crew data.

## Its own identity (FilthE, 2026-09-28)
"Don't base the main colors off the HMP stuff or the name either; I can customize this part to our looking since
it's only my account." The hub is private to FilthE: its palette and its name are its own, not HMP orange/graphite
and not "HMP"/"Aldaba". Then: "don't worry, use whatever colors": the lead picks the palette (Nocturne-based, see ART-DIRECTION.md),
no option round; plus a "Make it yours" panel in the hub (accent color, theme, the hub's name), saved per device.

## Quality bar
Premium like the Aldaba landing page. Phone first (390 px), smooth, a still-image fallback with no WebGL, reduced
motion honored. Design gate exits 0 (`--page crew-hq`), `release_checks.sh --fast` and shots.js pass.
Screenshots are for our own review; FilthE said go live when done (below).

## Go-live rule (FilthE, 2026-09-27)
"Just go live when we're done": publish as soon as the build is finished and every check passes
(design gate `--page crew-hq` exit 0, shots.js, `release_checks.sh --fast`), no screenshot stop first.
Still: publish to the same hub URL with `pages/crew-hq.files.json` as `files`, omit capabilities, add a
CHANGELOG line, and tell FilthE in 5 lines. A refused publish stops the job; tell him the exact message.

## Page status (2026-09-27): ready to publish
Done: `pages/crew-hq.html` with the scene plugged in, `pages/hub/scene.js`, `pages/hub/still.webp` (70 KB, from
`#capture`), `pages/crew-hq.files.json`, fixture rows, crew-checkin skill. Checks: design gate `--page crew-hq` exit 0
(12 views), shots.js clean, `release_checks.sh --fast` pass. With the CDN blocked (gate, shots.js) the page shows the
still and the hint; everything else works.
Left: publish per the go-live rule (same URL, `crew-hq.files.json` as `files`, omit capabilities, CHANGELOG line).

## Scene status (2026-09-27): rendering, reviewed at 390x844 and 1440x900
- Renders in the real page (three r169 routed locally), day, dusk, night, EN + ES, card open, all four cameras.
- Fixes in the first browser run: the floor slab z-fought the stone floor (dark stripes; the stone now sits 6 mm above
  the slab and is a warm mid-tone like the mockup); the furniture merge now keeps each floor's meshes in its own group;
  Down lifts the upper floor away; progress rings sit beside name tags; bubbles avoid tags; the stage-bar sky button
  shows its icon when pressed; the still's alt text is EN/ES.
- Not done (optional): `scene-harness.html` + `shots/v2-*`. Screenshot helper for this container: route
  cdn.jsdelivr.net/npm/three@0.169.0 to a local `npm pack three@0.169.0`, chromium with `--use-angle=swiftshader`.
- Watch on a real phone: frame rate (DPR drops itself if frames run long) and the phone blocked bubble, which shows
  the blocked text without the robot's name (narrow layout hides names in bubbles; tap opens the card).

## Live (2026-09-27)
Published as hub Version 24 (v26 "Penthouse HQ") to https://claude.ai/artifact/Qkc52bt2JL5gW7ZKWBJDHU with
`pages/crew-hq.files.json` as files; capabilities carried forward. The live version before it was identical to the
repo's pre-T190 crew-hq.html (nothing to merge). Not yet seen on a real phone GPU. The instant-wake call
(`fire_trigger`) is unchanged from v25.

## RESUME HERE (paused by FilthE, 2026-09-28)
Research is done or landing: ART-DIRECTION.md ("Nocturne"), FUN-IDEAS.md (+ outfits v2), IDEA-VAULT.md and
CONVENIENCES.md (committed when their rounds finish). Palette call (lead, FilthE said "use whatever colors"): Nocturne
night, working = champagne-gold, "needs you" = warm ember orange, all themable via "Make it yours".
Next step = the v27 build (not started; nothing changed in pages/): 1) architect writes BUILD-v27.md + CONTRACT.md v2
split into a PAGE track (pages/crew-hq.html) and a SCENE track (pages/hub/scene.js); M1 page = one-screen MacBook
layout (office fills the screen, right panel tabs Crew/Board/Log/Chat scroll inside) + Nocturne palette +
reconnect/refresh (R, visibilitychange/online); M1 scene = Nocturne lighting/materials + champagne/ember strips +
camera system. 2) both builders in parallel. 3) QA + fix loops (gate, shots, fast checks, MacBook 1440/1512 shots).
4) adversarial review (taste, function, perf + rules). 5) publish per the go-live rule.
Idea Vault round (IDEA-VAULT.md) was stopped mid-run on pause; re-run it before or during the build if wanted.
CONVENIENCES.md is in (12 picks + 10 small answer/wake bug fixes to ship first).

## v27 live (2026-09-28)
Published as hub Version 25 ("Nocturne"). Open items: real MacBook Air frame rate unmeasured (~450 draw calls in Whole view), pod shells too white in daylight, days-since-hail counter small, face-cam in #pip unconfirmed (blank in headless), no notifications capability yet (tab title + chime only), run watchdog uses fixed slots.

## FilthE's v27 walkthrough notes (2026-09-28)
"The concept is good, it looks good, but it looks a little plain; let's take it further."
1. The rain streaks down then bends up in the background: fix it (straight, believable rain, only in the sky).
2. The two floors look stacked on top of each other: make it read as ONE building (shared core/structure, the
   connector, terraces), not two boxes piled up.
3. Still no chat bubble to talk to the King: a visible, always-there way to talk to the King (floating bubble).
4. Too many cameras: cut the un-fun ones, keep the fun ones.
5. More sound effects (still off by default / easy toggle).
6. HIS CHARACTER = A CAT that roams everywhere doing cat things (naps in sunbeams, knocks things off desks, sits on
   keyboards, chases the capsule in the tube, rides the slide...). When an AI needs him, that robot chases the cat or
   plays with it.
7. Test it on "society": a simulated user panel + the usual problems app developers check (first-run clarity,
   usability, accessibility, performance, trust, annoyance), then fix what they'd complain about.
8. The side panel must be closable: one click (and a key) hides it so the penthouse fills the whole screen; it
   slides back when needed (e.g. something needs him) and remembers his choice.
9. "It all looks a little too crowded": declutter. Fewer labels/chips/controls visible at once; show detail on
   hover/when relevant (dark-cockpit rule). Calm by default.
10. "There could be more valuable functions. I'm not satisfied yet, I know we can add more." Keep hunting for
   high-value functions (society test + conveniences + blueprint), ranked by usefulness to him.
11. PERSONAL, ENGLISH-ONLY (FilthE, 2026-09-28): "This hub is for me. It shouldn't even be called the HMP AI hub.
   The AI hub lives in my computer; it's strictly mine. It can be in English." -> English only (no ES work needed;
   keep existing ES strings only where free), no "HMP" in its name or UI; its name is his to pick (Make it yours;
   default "AI Hub").
