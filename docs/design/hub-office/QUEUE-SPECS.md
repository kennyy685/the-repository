# Hub queue specs: chunks 2-8 (Designer, 2026-09-29)

For the Builders in `docs/orders/hub-queue.md` (on `claude/stoic-darwin-ikqmrj`). **Don't build from the old
docs alone.** A lot of FUNCTIONS-SHORTLIST, BUILD-v28 and CONVENIENCES is already in `pages/crew-hq.html` (checked
against the page at `origin/claude/amazing-gauss-yzfpq0` on 2026-09-29). Each chunk below lists what already exists,
what's missing, and what was cut. FilthE's rule: "focus on what actually needs to be done", with money first.

## Order by payoff (the Builder does them in this order)

| # | Chunk | Payoff | State today | Size |
|---|---|---|---|---|
| A | **Hand off, end to end** (#3) | $ saved on every long chat (one King chat cost $149) | button + event built; no receipt, no King protocol, only on "hot" chats | page S, crew S |
| B | **Fix-it buttons** (#7) | minutes of digging and a missed Storm Watch morning | 5 of 8 alerts have a button, and 2 of those only open a tab | page S |
| C | **Unfinished-merge watch** (#5) | stops lost or redone work (8 branches, 250-527 commits each off the work branch) | nothing (`system/git` not written, not read) | crew S, page S |
| D | **Sunday report card** (#9) | shows whether the crew gets cheaper per shipped thing | the per-robot report card is built; no weekly roll-up | page M |
| E | **"Why" line** (#8) | fewer "why is it doing that?" moments | posted `why` shows on the card and tooltip; no fallback, not on RIGHT NOW | page S |
| F | **v28.2 "Dressed with data"** | looks only | only the Shipped shelf is kept (see F) | scene S |
| G | **Top 12 conveniences** | none left to build | 11 of 12 live; #10 blocked (no notifications capability) | test only |

Pairing for 3 Builders (the queue says 2-4 / 5-6 / 7-8): **Builder 1 = A + B + E** (one alert and card pass),
**Builder 2 = C + D**, **Builder 3 = F + G** (small, then the verification pass, then the "AFTER ALL" sync).

## Rules for every chunk
- **Data first.** Read through the existing helpers (`sessions()`, `jobs()`, `events`, `answers`, `byId`,
  `rcRows()`), not raw docs: the live-hub Builder (chunk 1) may move `sessions()` onto `list_sessions` directly.
- **Every button's click either does the fix or hands it to the King** as an event `{agent:'you', kind:'handoff',
  to:'code', task:<fix id>, ...}` plus `wake(text, true)`. Nothing needs a new grant unless a chunk says so.
  **Grant rule:** publish without `capabilities` (the stored grant carries over). If a chunk truly adds a tool, restate
  the whole `mcp` servers list: a non-empty declaration replaces the stored one.
- **Tapping twice never does it twice.** After a tap the button becomes a receipt line: "Sent · the King's on it".
  The same fix id can't send again for 10 min (`store` key `hub-fix-<id>`, in try/catch).
- **Silence is the premium state.** No alert, no line, no card when there's nothing to say. Never state a guess as
  fact. Unknown data says "not tracked yet".
- **Only-a-person list** (CLAUDE.md): merging to main, spending money, deleting anything. The button tap *is* his
  OK for that one item. Never batch it, and never on a key press.
- Every chunk: `node tests/pages/design_gate.js --page crew-hq`, `bash tests/release_checks.sh --fast`, new scenarios
  in `tests/pages/hub_live_check.js` (fixture `tests/pages/hub_live_fixture.py`), shots at 1440x900 + 1512x982 (+390
  phone), CHANGELOG line, publish with `pages/crew-hq.files.json` as `files`. New doc shapes go in the crew-checkin
  skill ("Hub v28.5") in the same commit.

---

## A. Hand off, end to end (#3)
**What FilthE sees.** Every chat that's still working has a quiet **Hand off** button on its card in the Ops/chats
list, not just the ones over $25 or $10/h. The hot flag keeps its orange "Hand it off?". After a tap, the row turns
into a four-step receipt that fills in by itself:

```
 King chat · $41 · 2 h 10 m                                   [Hand off]
 ─ after the tap ─────────────────────────────────────────────────────────
 King chat   ✓ Asked   ✓ Note saved (docs/orders/king-handoff.md)   ● Fresh chat starting   ○ Old one closed
             Fresh chat: "SMUIPO (King)" · open ↗                           as of 2 min ago
```
When all four are ticked, the row drops out of the list and the Log gets one line: "Handed off King chat ($41) →
SMUIPO (King)".

**Data.**
- Tap: already writes `events/<stamp>-you` `{kind:'handoff', to:'code', task:'fresh-chat', session}` + wake (see
  `askHandoff`). Keep it.
- The King posts one event per step: `{agent:'code', kind:'note', task:'fresh-chat', re:'<the tap event id>',
  session:<old id>, step:'asked'|'noted'|'started'|'archived', note_path?, new_session?, new_title?}`. The page
  matches on `re` and shows the furthest step.
- Chat list data: `sessions()` → `{id, title, st, cost, startMs, atMs}` (from `crew/sessions` or `list_sessions`
  `status_bucket`, `external_metadata.usage.cost_usd`).

**King protocol** (put it in the crew-checkin skill and the King's orders). It's a protocol and not a new tool
because the King can't message other sessions:
1. `asked`: write a board note for that chat ("write your handoff note, commit + push, then stop"). If the chat is a
   helper the King owns, `SendMessage` it.
2. `noted`: `git fetch`, and the note file exists on the work branch.
3. `started`: `create_session` (title = old title, branch = the work branch, prompt = "read <note_path> and resume").
4. `archived`: `archive_session(old)` **only after** the new session shows in `list_sessions` as working. Never
   archive a chat whose note never landed.
- **For the King itself** don't run this. The existing "Fresh King" flow (`pending_king`, `system/king.wake_trigger`)
  handles it, and the button on the King's own row calls that flow instead.

**Grants.** None new (the King does steps 2-4). The page only reads.

**Edge cases.** The old chat already finished (`done`): skip to `archived`. The note never shows after 30 min: the
receipt turns amber, "No note yet · Ask again". Tapped on the phone and the Mac: the second tap sees the open receipt
(same `session`, less than 2 h old) and does nothing. The old chat is `failed`: the King writes the note from its
transcript (`list_events`) itself.

**Acceptance.**
1. Fixture: a session with cost 3 and st working shows a Hand off button. A done or failed one shows none.
2. A tap writes exactly one event, and a second tap within 2 h writes none.
3. Fixture events with steps asked→noted show 2 ticks and a ● on "Fresh chat starting". With `archived`, the row is
   gone and the Log line is there.
4. `noted` missing 30 min after `asked` shows the amber "Ask again", and that tap writes a new handoff event.
5. The King's row calls the Fresh King path (spy on `create_session` args: the prompt names king-handoff.md).

## B. Fix-it buttons (#7)
**What FilthE sees.** Every amber line in the Needs strip ends with **one** button named for the fix. When there's
nothing to fix, the line doesn't exist.

```
 ⚠ Storm Watch didn't run at 6:54 AM                         [How to fix]  → "Open Cowork on the Mac; it runs on the next open." (copy)
 ⚠ Instant wake is off · answers ride the next run            [Reconnect]
 ⚠ King chat: $41 in 90 min                                   [Hand it off]   [Keep going]
 ⚠ Morning data job broke (last run failed)                   [Run it again]
 ⚠ Builder quiet 40 min                                       [Check on it]
```

**What's built vs missing** (`computeWatch()`, `convClick()`):

| alert `k` | today | change |
|---|---|---|
| `missed` | Check now (wake) ✓ | keep |
| `stuck` | Re-plan ✓ | keep |
| `dropped` | Resend ✓ | keep |
| `spend` | opens the chat card | the chip itself gets **Hand it off** + Keep going (reuse `flagHtml`), wired to A |
| `sched` | opens the Ops tab | **Run it again** = handoff `task:'fix-sched', trigger:<id>`: the King runs `fire_trigger` if the job is ours and enabled, or `update_trigger enabled:true` only if `jobState` is broke because `enabled:false` **and** there's no `why` (a pause with a reason stays paused and never gets a button) |
| `storm` | no button | **How to fix**: shows the one-line fix and copies it. Storm Watch is Cowork's on his Mac, so we can't restart it from here. |
| wake off (`wakeOff()`, health line only today) | none | new alert `k:'wake'`, **Reconnect** = handoff `task:'fix-wake'`: the King makes its poke-only trigger and writes `system/king.wake_trigger` (the CLAUDE.md flow). Answers still ride the next run meanwhile. |
| silent robot (watchdog) | dims only | new alert `k:'silent'` for **helpers** only after 30 min, **Check on it** = handoff `task:'fix-silent', agent`: the King runs `get_session`/`list_events`, then either marks it idle with the reason or re-runs the job |

**Data.** `jobs()` (`system/schedule`: `enabled, why, ended_reason, last.status, next_run_at`), `wakeOff()`, the
watchdog `silent` flag, `sessions()` for spend.
**Grants.** None. Every fix goes through the King. (Giving the page `fire_trigger` was cut: one more consent prompt
for a button used about once a month.)
**Cut.** A button that "restarts Cowork" (not possible from a page). Auto-fixing without a tap (paused jobs are
usually paused on purpose: all old King triggers are).

**Acceptance.** One fixture per `k` shows exactly one button with the label above. A tap writes one handoff event
with the right `task`, and a repeat within 10 min writes none. A job with `enabled:false` and `why` set shows grey in
Ops and raises **no** alert. Storm "How to fix" writes nothing to the db. The alert list is empty on a healthy fixture
(the health line shows "All normal").

## C. Unfinished-merge watch (#5)
**What FilthE sees.** Only when something's unmerged, one card on the Board ("Ready to ship" style):

```
 Unfinished work · 3 branches
  eager-bardeen      12 finished commits not on the work branch · "Open map: area days-ago counts"   2 h ago
                     no conflicts ✓                                                  [Merge it]  [Not yet]
  stoic-darwin        4 commits · hub queue + specs · conflicts in 1 file ⚠            [Ask the King]
  trusting-dijkstra  0 new work (already in) · looks done                            [Hide]
 main is 190 commits behind the work branch                                          [Merge to main]
```

**Data.** The King writes hub doc `system/git` on every wake (and after any merge):
`{at, work:'claude/amazing-gauss-yzfpq0', main:{behind:<n>}, branches:[{name, ahead, behind, last_at, subject,
files:<n>, conflicts:<n>|null, done:bool}]}`.
- `ahead` = `git rev-list --count work..origin/<b>`. `conflicts` = the conflicted file count from
  `git merge-tree --write-tree work origin/<b>` (no checkout, nothing touched). `done` = `ahead === 0`.
- `subject` = the newest non-merge commit subject, 80 chars, plain words.
- Needs full history: `git fetch --deepen` or `--unshallow` first. The cloud clone is shallow, and on a shallow
  clone `rev-list` gives nonsense counts ("unrelated histories").

**Buttons.** **Merge it** → a board `waiting` item with `merge:{branch, into, ahead, conflicts}` (reuse the `ship`
card renderer), so his tap is the answer. The King merges (a merge commit, never a rebase or force), runs
`release_checks --fast`, pushes, and posts `done`. **Merge to main** = the same thing with `into:'main'`. That's on
the only-a-person list, so it's never batched and always a separate tap. **Ask the King** (conflicts) = handoff
`task:'fix-merge'`. **Hide** = local only (`hub-git-hidden`). Branches are never deleted from the hub.

**Edge cases.** No `system/git` doc: no card, and the Ops tab says "Branch watch starts on the King's next wake". A
doc older than 24 h: "as of yesterday". `ahead` over 200 on an old branch: show "old branch · 250 commits, check
first" and no Merge it button (it's probably a stale parallel line like the SessionStart hook's list, not finished
work).

**Acceptance.** Fixture with 3 branches (clean, conflicted, done) shows the three button sets above. `ahead` 250
shows no Merge it. Merge it creates exactly one `waiting` item with `merge.branch`. `main.behind` 0 hides the main
line. A missing doc renders no card and throws no error.

## D. Sunday report card (#9)
**What FilthE sees.** From Sunday 6 PM to Monday noon (Central), one card at the top of the Crew tab, then kept in the
Log. Five numbers, each with an arrow vs last week. It follows the 4-6 KPI rule for reviews that actually get read.

```
 Week of Sep 22 – 28                                     vs last week
  Shipped          7   (App v25.3, Practice Door v11, …)     ▲ 2
  Spent        $312                                          ▼ $90
  $ per ship     $45                                         ▼ $31   ← the one that matters
  Waited on you  6.5 h   (longest: D14, 2 d)                 ▲ 1 h
  Stuck          3 h                                         ▼ 4 h
  Best helper  Builder · 9/10 good
```

**Data** (the page computes it and nothing needs the King):
- Shipped: publish/merge events this week (reuse `SHIP_RX`/`NOT_SHIP_RX`, the same count as the Observatory's
  "Shipped").
- Spent: `crew/sessions.spend.week_usd`. If that's missing, show "not tracked yet" and **no** $ per ship. Never
  guess from partial samples.
- Waited on you: the sum of (answer `at` − question start) for answers this week, plus open questions up to now.
  Stuck: blocked spans from agent status events.
- Best helper: `rcRows()` this week, at least 3 jobs, then the highest good rate.
- Last week: on first render after Sunday 6 PM the page writes `crew/weeks/<YYYY-Www>` with the five numbers (only if
  it's missing, guarded by `if_version`), and reads last week's doc for the arrows. No doc = no arrows.

**Cut.** "Hours the crew waited on you" split per robot, charts, $/hour. Five numbers, no graph.

**Acceptance.** A fixed-clock fixture on Sunday 18:05 CT shows the card, at Monday 12:01 it's gone from Crew but in
the Log, and Wednesday shows nothing. Spend missing means "not tracked yet" and no $/ship row. A second open doesn't
rewrite `crew/weeks/...`. A week with 0 ships shows "$ per ship: nothing shipped" (no divide by zero).

## E. "Why" line on each robot (#8)
**What FilthE sees.** Under "Now" on every working robot's card, and as a dim second line on its RIGHT NOW row when
the row is hovered: *"Why: you said Yes to D12"*.
**Built:** a posted `why` (90 chars) shows on the card and tooltip.
**Missing: the fallback, in order, first hit wins.** (1) posted `why`. (2) An event from this robot with `re`
pointing at his answer → "you answered D12: Yes". (3) Its board task has `after:<id>` or is next in its column →
"next on the board after T199". (4) A handoff to it → "Builder handed it over". (5) Nothing matches → **no line**. It
never says "Why: working".
**Acceptance.** One fixture per rule shows the right text. With none of them, the card has no `Why` row. Nothing is
longer than 90 chars.

## F. v28.2 "Dressed with data": cut to the Shipped shelf
Kept: **the Shipped shelf** in the design studio (scene.js line ~555 already leaves room). One small box per ship this
week (the same list as D), newest on the left, max 8. Hover shows its name. It gives D a physical home and costs about
2 draw calls.
Needs `HUB.shipped = {v, list:[{id, text, at}]}` in CONTRACT.md first.
**Cut** (to FUN-IDEAS "later"): research wall, pin wall, QA device screens, queue-rack count, dispatch-table cards,
zone hover counts, can-do line. They're pretty, but none of them saves money, time or worry, and each one costs
MacBook frame time. Track record is already covered by the report card. "Change answer" is already covered by
`undoAnswer` + the "decided" Change button.
**Acceptance.** 3 fixture ships = 3 boxes. 0 = an empty shelf with no label. No-WebGL still unchanged. The draw call
count rises by at most 4.

## G. Top 12 conveniences: verify, don't build
Live in the page (section comments): #1 wake policy, #2 watchdog + health line, #3 Not now parks, #4 Same answer, #5
crew suggests + King defaults, #6 resubscribe on return, #7 decided without him, #8 Proof it landed, #9 real blocker
on top, #11 forgotten tasks, #12 morning note.
**#10 (notifications) is cut.** Artifact runtime 0.2.63 (checked 2026-09-29) has no notifications capability. The
tab title + chime stay. Re-check when the runtime changes (the TODO in the page says what to build).
**Job:** one scenario per item in `hub_live_check.js` if it's missing, fix only what fails, then run the "AFTER ALL"
sync in hub-queue.md.

---
Sources for the patterns: actionable alerts carry a one-click fix and an impact line
([Atlassian](http://pages.eml.atlassian.com/rs/594-ATC-127/images/Whitepaper-Creating-Actionable-Alerts-to-Maximize-Resolution-Speed-Prospect.pdf),
[incident.io](https://incident.io/blog/automated-runbook-guide),
[OneUptime](https://oneuptime.com/blog/post/2026-02-20-monitoring-alerting-best-practices/view)); weekly reviews
work at 4-6 KPIs with cost per delivered outcome
([getleo.ai](https://www.getleo.ai/blog/engineering-kpis-that-predict-delivery),
[Pensero](https://pensero.ai/blog/engineering-delivery-metrics)).
