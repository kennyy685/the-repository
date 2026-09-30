# Claude's Aldaba: paused 2026-09-30 (resume here)

FilthE asked (2026-09-29): "demonstrate the true potential of Claude with its own version of the app... includes the
incredible motion designer you are... like it's for your resume, go all out, your own version of Aldaba."
Then (2026-09-30): "come to an appropriate pause so we can resume soon." Branch: `claude/modest-planck-qidroo`.

## What it is
A working MacBook-first app (one page, one continuous Nebraska map world) with a cinematic cold open and a
"Play the film" director that drives the real UI. Views: #now (7 AM brief), #storms (season replay), #knock (street
walk, one tap per door), #deal (door to signed job + Nebraska legal armor + HMP homeowner sheet), #money (honest
path to $100k). Thesis: one motif, many meanings (the knocker ring = hail stone, impact ripple, zone ring, door
marker, progress ring). Rules + API: `CONTRACT.md`. All JS parses at the pause point (`node --check`).

## Done (committed)
- Foundation: `index.html`, `css/base.css`, `js/core.js`, `js/world.js`, `js/boot.js`, `dev/{harness,shoot,smoke}.mjs`,
  `files.json`, `CONTRACT.md`. All tests green at its finish.
- Libraries: `js/lib/hailgl.js` (WebGL hail), `js/lib/house.js` (generative house portrait), `js/lib/funnel.js`
  ($100k math), `js/lib/route.js` (real 50 mi US-30 drive, baked), `js/lib/sound.js` (synth sound, off by default),
  `data/copy.js` (420 EN/ES strings incl. legal steps).

## Paused mid-way (files on disk hold partial work; nothing is broken syntactically)
| Part | State | Next |
|---|---|---|
| Now + Money (`js/now.js`, `js/money.js` + css) | built, reviewed (15 findings, 8 major) | fix pass was running |
| Knock (`js/knock.js` + css) | built, reviewed (9 findings, 1 blocker: walk-order route bug) | fix pass was running |
| Deal (`js/deal.js` + css) | build was running (845 lines on disk) | finish build -> review -> fix |
| Cold open + Storms (`js/intro.js`, `js/storms.js` + css) | build was running (714 + 682 lines) | finish build -> review -> fix |
The finished builder reports + reviewer findings are saved in `dev/paused-results.json` (4 entries: 2 builds, 2 reviews).

## Resume
- Same Claude chat: re-run the two workflows with `resumeFromRunId` (views `wf_e164582d-f2e`, cinema `wf_a5e42974-cb1`);
  finished builds/reviews replay from cache. Tell re-run builders: "a previous run already started these files;
  continue from what's on disk, don't restart."
- Fresh chat: read this file + `CONTRACT.md` + `dev/paused-results.json`, then launch: Fix Now+Money and Fix Knock
  (with their saved findings), Finish Deal and Finish Cold open + Storms (continue from disk) -> fresh-eyes review ->
  fix. Max 4 robots at once.

## Then (integration, not started)
1. Director film (`js/director.js`): COPY.film beats (12 captions EN/ES), drives A.intro, A.nowAssemble, A.stormsDemo,
   A.knockDemo, A.dealDemo, money; Sound.enable() from the Play click; pause/scrub/skip; ends "Your turn".
2. Colophon drawer "Made by Claude" (COPY.colophon), sound toggle in the top bar, "Replay intro".
3. Knock: "inside the 1-inch hail line" badge per door (A.world.hail.at(p) >= 1.0) (hail kit robot's idea).
4. Foundation requests from builders: shoot `--skip-intro`, srcTag keys 'bench' + 'log', world pal `warn`,
   deterministic clock for motion shots, COPY.knock.keys says "Keys 1 to 5" (Knock uses N T I X B U), singular forms
   in COPY.knock.recap, world labels avoiding view canvas labels, per-zone hail in NL.zones (engine).
5. Three reviewers (look/motion, legal/copy EN-ES, bugs/perf/responsive) -> one fix pass -> live smoke.
6. Publish as a new artifact (page `index.html`, `files` = `files.json`, icon "map"), hub post, CHANGELOG line.

## Open for FilthE (also in docs/memory/questions-for-filthe.md)
- $100k by Dec 31 at new-rep industry rates = ~285 doors/day; levers: commission per job (boss), close rate, siding
  and cash jobs, referrals. Nov 1+ sunset ~5 PM halves the 4-7:30 PM knock window.
