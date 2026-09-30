# Claude's Aldaba: state (2026-09-30, after integration)

## DONE 2026-09-30: Version 3 live at https://claude.ai/artifact/9ek2812BsTUYS5WqrCJ7UK (finish workflow + polish workflow, both verify = ship). Only open cosmetic note: on Money the faint COLUMBUS place label sits on the Columbus zone's dot cluster. Everything below is history.

**FilthE (2026-09-30 ~12:20 UTC): "you're the boss this task claude, do as you wish."** Claude decides everything on this piece (scope, look, when to republish the same link) without waiting for his OK. Still off-limits: merges to main, spending money, deleting data.

## FILM + WIRING PASS DONE 2026-09-30 ~14:30 UTC (integration robot)
- **Root cause of "the film never finishes" found and fixed (js/core.js ticker):** adding a ticker callback from inside a frame
  (every chapter's Timeline starts inside the previous one's end cue) scheduled a SECOND rAF loop; loops piled up chapter by
  chapter until the page stalled (570k rAF callbacks in 4 s by the money chapter). The loop now holds `raf = -1` while it runs.
  `film.mjs --run --rate 2`: 12/12 chapters in 108 s wall (was a 1500 s timeout), 0 issues, 0 skipped, clean hand-back, store restored.
  Also green: `--rate 1`, `--still`, `--lang es --theme light --gl 0`, `--stops` (12 stop points clean), smoke all views still + motion ALL PASS.
- Film changes: the knock walk starts clean inside the sandbox even if the viewer is on #knock (`knockClean`); chapter 8 books the
  inspection's 4:30 PM slot (toast) and chapter 9 hands THAT door to Deal via `A.knockDemo.openDeal()` (Deal shows "Door 4",
  the inspection time); zone hovers aim at the rank ring; the money lever is revealed first (ES panel is longer); the sign-off
  dims the last view's layers + pins (`dir-dusk`) and scrolls phones back to the map; pausing holds the spotlights; dialogs
  (credits, key sheet, end card) are gone within 240 ms of Esc even on a slow renderer (fixed smoke --motion Esc failures).
- Other fixes: knock door ring threw on a negative arc radius (js/knock.js one-line guard); Deal's eyebrow shows the walk's door
  number from Knock's `walkIndex` (deal.js one-liner); 400 px top bar fits the whole "Aldaba" (base.css); Now's zone detail labels
  wrap in Spanish (now.css); credits close button gets a solid chip at 400 (director.css); manifest regenerated (14,333 lines).
- Dev: `film.mjs --lead <ms>` plays into a moment on the film clock and pauses there (the frame a viewer sees); `--stops` waits
  for fades. Chapter timings are in CONTRACT.md (The director).
- Open (not integration's files): `docs/legal/44-9204.txt` is missing (Deal cites it correctly); Deal still reads
  `canvas.__house.L.parts` as an optional refinement until House exposes per-part polygons.
- **Next:** republish the same URL (page `index.html`, `files` = files.json, no new files this pass), hub post, CHANGELOG line.

## RESUMED 2026-09-30 11:25 UTC: finish workflow `wf_bfe3e427-cbd` running (Finish Knock/cinema/Deal -> full film -> 3-lens review -> fixers -> verify). If paused again, resume it with resumeFromRunId in the same chat; otherwise follow the resume order below.

## PAUSED 2026-09-30 ~02:45 UTC (FilthE: "come to an appropriate pause now"). Resume here.
- **Preview is LIVE:** https://claude.ai/artifact/9ek2812BsTUYS5WqrCJ7UK (Version 1, private). Published after the
  whole-app smoke passed (5 views, 0 console errors, no horizontal scroll at 1440/1280/400). Republish = publish
  `index.html` again from this chat with `files` = `files.json` map (absolute paths), or from another chat pass the URL.
- **Stopped mid-way (all files parse; everything committed):** Knock fix pass (its work up to 02:32 is in the tree:
  blocker route fix + 1-inch badge status unknown, verify), cold open + Storms finisher (was polishing beats),
  Deal fresh-eyes review (no `dev/review/deal.json` written yet), integration (film + credits built; was running
  its final film test). director.js/css changed after the preview publish, so the next publish carries them.
- **Resume order:** (1) one robot each: finish Knock (verify dev/review/knock.json blocker + majors are fixed,
  then the badge), finish cold open + Storms (brief `dev/briefs/cinema.md`), Deal review + fix; (2) run
  `node dev/film.mjs --run --rate 2` + `--stops` and wire any demo handle `A.director.report()` lists; (3) the 3-lens
  final review + fix; (4) republish the same URL, hub post, CHANGELOG line. Max 4 robots at once.

FilthE asked (2026-09-29): "demonstrate the true potential of Claude with its own version of the app... includes the
incredible motion designer you are... like it's for your resume, go all out, your own version of Aldaba."
Branch: `claude/modest-planck-qidroo`. Rules + API: `CONTRACT.md`. Briefs: `dev/briefs/`.

## What it is
A working MacBook-first app (one page, one continuous Nebraska map world) with a cinematic cold open and a
"Play the film" director that drives the real UI. Views: #now (7 AM brief), #storms (season replay), #knock (street
walk, one tap per door), #deal (door to signed job + Nebraska legal armor + HMP homeowner sheet), #money (honest
path to $100k). Thesis: one motif, many meanings (the knocker ring = hail stone, impact ripple, zone ring, door
marker, progress ring).

## Done
- Foundation: `index.html`, `css/base.css`, `js/core.js`, `js/world.js`, `js/boot.js`, `dev/*`, `files.json`, `CONTRACT.md`.
- Libraries: `js/lib/{hailgl,house,funnel,route,sound}.js`, `data/copy.js` (EN/ES).
- Views: Now + Money (finished), Deal (finished, under a fresh-eyes review). Knock, cold open (`js/intro.js`) and Storms:
  their builders were still working when integration ran; the film calls their demo handles defensively.
- Integration (`js/director.js`, `css/director.css`):
  - The film: 12 chapters, 1:23, from COPY.film.beats (cold open 7.8 s, brief 6.4, why Columbus 6.0, zones 5.6, season
    replay 8.4, drive 6.6, walk 5.6, one tap per door 7.6, legal armor 8.8, homeowner sheet 5.8, path to $100k 7.6,
    sign-off 6.6). Letterbox at the hand-off, captions with a per-word rise, a ghost cursor pressing the real UI,
    chapter ticks, Space / Left / Right / M / Esc, sandboxed store, "Your turn" card. Seekable anywhere.
  - "Made by Claude" credits (the "Claude's cut" tag, the map's "Credits" link): real vs sample with counts, how it was
    built with lines per file (`dev/manifest.mjs` writes them), why one ring, end credits, Play the film / Replay intro.
  - Top bar: sound switch (`A.sound`, remembered), F plays the film, ? shows the key sheet, M sound.
  - Foundation requests done: srcTag keys `bench` + `log`, EN/ES srcTag labels, world pal `warn`/`warnBg`/…, layer
    `avoid(f)` for world labels, `A.view.reserve`, Timeline `realtime`, `#view&k=v` hashes, reduced-motion rule no longer
    turns on transitions, `zone:focus` wired (Storms → Now), `House.layout()` + `transparent`, Deal title "Trato".
- Tests: `dev/smoke.mjs` (now also the film, ?, M), `dev/film.mjs` (shots at film times, full run, stop anywhere).

## Next
1. When Knock / cold open / Storms land: `node dev/film.mjs --run --rate 2` and `--stops`; `A.director.report()` lists any
   demo handle that went missing or threw. Film shots: `node dev/film.mjs --shots <ms,...> --hold --theme both --lang both`.
2. Views still carry local workarounds the foundation now covers: Knock's `srcTag({label:'bench'|'log'})` → `srcTag('bench'|'log', {note})`,
   `A.tok('--warn')` → `f.pal.warn`; Deal reads `canvas.__house.L` → `House.layout(canvas)`.
3. Three reviewers (look/motion, legal/copy EN-ES, bugs/perf/responsive) → one fix pass → live smoke.
4. Publish as a new artifact (page `index.html`, `files` = `files.json`, icon "map"), hub post, CHANGELOG line.

## Open for FilthE (also in docs/memory/questions-for-filthe.md)
- $100k by Dec 31 at new-rep industry rates = ~285 doors/day; levers: commission per job (boss), close rate, siding
  and cash jobs, referrals. Nov 1+ sunset ~5 PM halves the 4-7:30 PM knock window.
