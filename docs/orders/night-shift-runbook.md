# Night shift runbook (every night, ~2:40 AM Central, no human)

What it does: pulls last night's storm reports, re-ranks every walk, writes the 7 AM brief ("Since last night":
new hail, zones up/down, Aldaba's pick + backup + plan) and republishes ONLY the open map's `data/night.js`, so
FilthE's open map shows it when he opens it at 7 AM.
Open map: https://claude.ai/artifact/6LRaMpb63D8Z7UwznfqqxV (files map: `docs/design/open-map/index.files.json`).

Rules the brief follows (King, 2026-09-29): Aldaba's pick is a **storm zone only**; old-house (everyday) zones are
only ever the **backup**. No storm walk with doors left = no pick, the backup is named. The published copy names the
start **street** (no house number, spots rounded to ~100 m); never an owner name, never an insurance promise.

## The routine (the King creates it; this robot does not)
- `create_trigger`: `create_new_session_on_fire: true`, `cron_expression: "CRON_TZ=America/Chicago 40 2 * * *"`,
  name "Night shift", work branch `claude/amazing-gauss-yzfpq0`, model Sonnet (no design or engine judgment needed),
  notifications `{}` (quiet unless it fails; the hub shows it).
- Prompt (paste as is):

> You are HMP's night shift. Repo kennyy685/the-repository, branch claude/amazing-gauss-yzfpq0. Follow
> docs/orders/night-shift-runbook.md "Steps" exactly, then stop. Don't edit or commit code, don't create triggers.

## Steps (a fresh cloud session, empty folder)
1. `cd` to the repo (empty folder: `git clone https://github.com/kennyy685/the-repository` and `git checkout
   claude/amazing-gauss-yzfpq0`; no access = add_repo owner kennyy685, repo the-repository). `git pull origin
   claude/amazing-gauss-yzfpq0` (tonight runs the latest engine), then `pip install -q -r requirements.txt` (a fresh
   container has no numpy/pandas; without it the command fails at import).
2. Read last night's published brief (this also counts as "read before publish" for the Artifact tool):
   `Artifact` `action: "read"`, `url: https://claude.ai/artifact/6LRaMpb63D8Z7UwznfqqxV`, `path: "data/night.js"`.
   Note where it saved the file (= PREV). If the read fails, go on without PREV (the repo's copy is used).
3. Run the one command **in the background** (it takes ~12 min on an empty database, longer than one Bash call may
   wait): `python3 hh.py night-shift --prev PREV > night.log 2>&1` with `run_in_background: true`
   (no PREV: drop `--prev PREV`). Wait for the "completed" notice; don't poll with sleep.
4. Read the last lines of `night.log`:
   - exit 0 and a last line `PUBLISH {"url": ..., "file_path": "docs/design/open-map/index.html", "files": {"data/night.js": ...}}`:
     `Artifact` publish with that `url`, that `files` map, and `file_path: docs/design/open-map/index.html` (the
     tool refuses files without the page; tested 2026-09-29. The page is unchanged; other files left out are kept).
     No `icon`, no `capabilities`.
   - a `REFRESH FAILED: ...` line: publish anyway (the brief says on the map that it uses the day before's storm data),
     and say so in step 5.
   - exit 1 ("do NOT publish") or 2: don't publish. Go to step 5 as a failure.
5. Post one hub event (Crew HQ https://claude.ai/artifact/Qkc52bt2JL5gW7ZKWBJDHU, `ArtifactData` `set`
   `events/<YYYYMMDDTHHMMSSZ>-storm-watch`, time from `date -u`):
   `{agent: "storm-watch", at, kind: "done", lane: "chat", room: "storm", status: "done", task: "night-shift",
   text: "<the brief's headline, EN>"}`. On a failure: `kind: "blocked"`, `to: "code"`, text = what failed + the
   last error line. Then stop. Don't commit (the brief lives on the artifact, not in git).

## Time and cost
- Wall time: ~12 min on an empty database (measured 2026-09-29: 11 min 47 s; most of it Census + parcels + radar
  downloads), then ~5 s for the brief. The session itself is ~8 tool calls.
- Cost: Sonnet, ~8 short turns with little to read: about $0.30-0.60 a night, ~$10-18 a month. No paid data.

## When it fails
| What you see | What it means | Do |
|---|---|---|
| `REFRESH FAILED: ...` | a public storm feed (NWS/IEM, NOAA) was down | publish anyway; hub event says so; next night catches up |
| exit 1 "not a good night brief" | the brief file is broken | don't publish (yesterday's stays up); blocked event to the King |
| exit 2 "can't read the open map's files map" | repo checkout is wrong | don't publish; blocked event |
| Artifact read of `data/night.js` fails | first night, or the artifact changed | run without `--prev`; the brief says "First night brief" |
| Artifact publish refused (conflict) | the Designer published the page meanwhile | re-read, publish `data/night.js` again (only that file) |
| no brief at 7 AM | the routine didn't fire | the King checks `list_triggers` (last_run) and fires it by hand |

## Check it by hand (no network, nothing published)
`python3 hh.py night-shift --dry-run` runs the whole chain on the test fixture into a temp folder and ends with
`DRY RUN (nothing to publish): {...}`. Tests: `python3 -m unittest tests.test_night` (NightShiftCommand).
The page side: `node tests/pages/open_map_night_check.js` (loads the real brief, SAMPLE only on samples) and
`node tests/pages/design_gate.js --page open-map`.

## Known limits (tell the King, not the night shift)
- "Aldaba's top 3" on the open map now follows the brief (`top`: pick, backup, then the next storm walks), and the brief
  carries the map shapes (`map`, hailhunter/openmap.py) for any area it names that `data/real.js` lacks (e.g. Columbus,
  west of the map box); the home view widens to take in the pick + backup (Engine Mechanic, 2026-09-29). Nothing extra
  to run: it all rides in `data/night.js`. `data/real.js` itself (every other area on the map) is still built by hand
  (`hh.py season` + `data/build/real.py` + `areas.py`); a pick outside it has no street walk on the map yet.
- In September storm walks must be <= 60 days old (engine rule `today_walk.storm_max_days`); from Oct 1 it is 330 days,
  so older storms (Fremont Jun 13, Valley) come back into the pick.
