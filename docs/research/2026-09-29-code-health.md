# Code-health scorecard, 2026-09-29 (board X0)

FilthE: "better our code, stronger, more efficient, smarter, fix broken code." Why it matters: the AI hub froze live while
every check passed, because the checks only ran offline with a runtime that always answered. The rule now is that
nothing the page calls (db, sample, mcp, user) can freeze it. Every call gets a deadline, a visible failure and a page
that stays usable.

Detail per page: `2026-09-29-hub-code-health.md` (hub, morning), `2026-09-29-app-code-health.md` (App + Practice Door),
this file (HMP HQ, open map, Fresh King, the checks, the summary).

## Scorecard

| Page | Bugs found | Fixed | Speed before -> after | Left (ranked) |
|---|---|---|---|---|
| **AI hub** (`pages/crew-hq.html`) | 7 morning (3D room starving the page, runtime calls with no deadline, re-render under his hands, resubscribe on every focus, writes from render, `tidy()` burst, per-frame waste) + 2 now | 9 | Morning: clicks waited 0.6-3.8 s on software graphics -> answer at once (3D falls back to the still). Now: zoom-unlock timer went from 16 wakeups/s all day to only while zooming | 1. Fresh King: see what code the new message shows (probably the `create_session` grant). 2. The 3D room is heavy (432 draw calls). |
| **HMP App** (page + modules) | 5 freezes (Loading forever, dead Right Hand, locked chat, Help me say it spinning, photo upload) + 13 dead functions | 18 | Load 0.5 s main thread at 4x CPU, tab switch 0.09-0.18 s, idle ~0. Already fast, so no change | 1. A timed-out Right Hand retry waits the full 2 min each time on a stuck runtime. 2. Unused i18n strings/CSS not swept (risky). |
| **Practice Door** | 3 freezes (Send locked, hint, sample never answering) | 3 | Load 0.4 s, idle 0. No change | None found. |
| **HMP HQ** (`pages/hmp-hq.html`) | 5: Loading forever when `use('db')` hangs; Loading forever when the snapshot never comes; error shown as "live data is on the published page"; a dropped feed swallowed silently; listener + render not guarded | 5 | 210-340 ms -> 170-570 ms at 4x CPU (same, within noise) | 1. The "N days old" note only refreshes on a new snapshot or a language tap. 2. HQ is only as fresh as the last refresh (the 8 AM/6 PM runs are paused). |
| **Open map** (`docs/design/open-map/`) | 0 high; 4 medium (MapLibre from a CDN blocks load; data fetches with no timeout; FX redraw 33 fps nonstop; relief built during boot); 3 low (idle work could starve, radar play double-start, dead `walkSt`) | 6 of 7 | Load 2.9-4.2 s -> 4.1-4.5 s, blocking ~4.7-4.9 s -> 4.5-5.0 s per 8 s (headless, software graphics, 4x CPU: noise). The slower redraw only applies behind an open card, which the test doesn't cover | 1. Vendor MapLibre (0.8 MB) into the published files (FilthE's call). 2. ~25 aria-label/title strings English-only. 3. 5 empty catches (harmless). |

## Fixed this pass (commits on `claude/amazing-gauss-yzfpq0`)
- `572e693` **Hub, Fresh King:** every failure showed "The hub needs its Claude Code Remote permission". Now the message
  names the real error (`Couldn't start a fresh King (not_granted: ...)`). The permission advice shows only for
  permission-type codes. A no-answer code gets "check Chats". Each failure also writes a `blocked` event to the King
  (`events/<stamp>-you-fkfail`, the step that failed plus the code). The likely cause: `create_session` isn't in the
  hub's published MCP grant (king-handoff: FilthE never OK'd it). The next failure will say so.
- `0d4853d` **Hub:** the scroll-zoom unlock timer runs only while a zoom glides (was a 60 ms timer all day).
- `99b592a` **HMP HQ:** `use('db')` gives up at 12 s and the first snapshot at 15 s more, then the page shows "Couldn't
  load the summary" (EN + ES). Late data still fills in. A feed that drops after data keeps the last summary with
  "Couldn't refresh just now". Render and listener are wrapped.
- `8d30524` **Open map:** data files time out at 20 s into their fallbacks. `idle()` has a 2 s cap (the FX loop kept
  the thread busy, so idle work could wait forever). Relief is built after first paint. The FX redraw drops to 15 fps
  behind an open card (a 5 fps unfocused rule was dropped after QA: the artifact frame is unfocused until the first click). Radar play cancels the old frame first. Dead `walkSt`
  removed.

## New checks (all in `tests/release_checks.sh`)
- `tests/js/en_es_parity_check.js`: every `{en:{...}, es:{...}}` string table has the same keys at every depth. It
  covers 28 tables in the App, Practice Door, the modules and the open map. All 28 are clean now, and it catches a
  planted gap.
- `tests/pages/hq_live_check.js`: HMP HQ on the real `hq/snapshot` in 7 scenarios (live, phone, db hang, snapshot
  hang, db fail, no db, late fail). 5 of the 7 fail on the old page.
- `tests/pages/hub_chat_check.js` (existed, never ran in the release checks): the King chat plus Fresh King. It now
  covers a refused `create_session` (real code in the toast, no false "permission" line, blocked event, button back)
  and a `not_granted` refusal (permission advice shown).

## Looked at, nothing to fix
- Intervals: hub 10, App 2. All are top-level (never stacked), gated on `document.hidden` or the open window. Practice
  Door has none.
- Quiet `.catch(() => {})`: all fire-and-forget logs or audio resumes, where the page shows its own state.
- Modules (translate, calls, walkmap, practice, estimate): the only runtime call (translate `use('sample')`) is
  already bounded.
- EN/ES: the App, Practice Door and HQ are bilingual. The hub is English-only on purpose (FilthE's page).

## Also saved
Seven QA reports that never reached the repo (their pushes were blocked) are now in `docs/research/`:
`night-shift-real-QA`, `every-card-walk-QA`, `every-card-walk-own-walk-QA`, `app-e2e-QA` (summary only),
`roof-check-wording-QA` (summary only), plus `age-deadline-QA` and `no-free-sweep-QA` (both came in during this pass).

## QA round 1 fixes (`bd73961`)
QA (in-session, 2026-09-29 ~15:05) found 1 medium, 4 low; all fixed:
- Medium: the open map's "unfocused = 5 fps" made the first open choppy inside claude.ai (the iframe has no focus until a
  click). Rule removed.
- Fresh King: a create_session timeout (King may still be starting) logged "failed"; it now logs "no answer, check
  list_sessions before another". `not_in_manifest`/`deferred` now say the hub was published without the grant.
- HQ: a page both stale and failing to refresh showed only the stale note; now shows both.
- Parity check now covers HQ, the claim tracker and the Knock page (38 tables, clean). Outside these commits:
  `docs/design/next-level/b/index.html:225` has `statArea` in EN, missing in ES (Designer's WIP).
