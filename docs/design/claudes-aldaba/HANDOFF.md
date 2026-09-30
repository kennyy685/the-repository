# Claude's Aldaba: state (2026-09-30, after integration)

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
