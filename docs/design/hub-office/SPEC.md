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

## Quality bar
Premium like the Aldaba landing page. Phone first (390 px), smooth, a still-image fallback with no WebGL, reduced
motion honored. Design gate exits 0 (`--page crew-hq`), `release_checks.sh --fast` and shots.js pass.
Screenshots are for our own review; FilthE said go live when done (below).

## Go-live rule (FilthE, 2026-09-27)
"Just go live when we're done": publish as soon as the build is finished and every check passes
(design gate `--page crew-hq` exit 0, shots.js, `release_checks.sh --fast`), no screenshot stop first.
Still: publish to the same hub URL with `pages/crew-hq.files.json` as `files`, omit capabilities, add a
CHANGELOG line, and tell FilthE in 5 lines. A refused publish stops the job; tell him the exact message.

## Page status (paused 2026-09-27 for the usage limit)
Done and pushed: `pages/crew-hq.html` (live data, Needs you, answers in cards incl. robot questions,
cameras, sky/weather, recap, ding, progress rings, trophies/board feeds for the scene, board, orders,
memory, Right Hand box, logs, EN/ES), `pages/crew-hq.files.json`, fixture rows, crew-checkin skill.
Design gate `--quick` on the page: clean except the missing `hub/scene.js`.
Left: plug in the scene (`pages/hub/scene.js` + `still.webp`, see the scene status below), then the
full design gate + shots.js, fix findings, publish (go-live rule above), CHANGELOG line.
Screenshot helper for this container (CDN blocked): route jsdelivr to a local `npm pack three@0.169.0`.
