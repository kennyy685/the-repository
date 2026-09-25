# HMP build orders (FilthE, 2026-09-25)

FilthE's orders: make the system one app he actually uses, then let real doors tune it. Work them in
this order. Each order names its owner, what "done" means, and what it needs first. The Crew HQ board
(`board/current`) carries the same ids; update it when you start and finish.

Rules for every order: read `CLAUDE.md` first. English + Spanish for anything the boss sees. FilthE never
types into spreadsheets. Nebraska 44-8604 (never cover, waive or rebate a deductible), never promise
insurance pays, never negotiate claims. QA Tester checks every page/engine change before it goes live.

## Why one app (the design decision behind O1-O2)
Claude pages can't read each other's databases, so "one app" has to be one page with one database.
Crew HQ (https://claude.ai/artifact/Qkc52bt2JL5gW7ZKWBJDHU) already has the database, the task board,
the answer buttons and the live King chat, so **Crew HQ becomes the HMP App** (same link). The
Claim Tracker (empty so far) folds into it. HMP HQ and the command center stay, linked from it; the
command center keeps the storm map and door lists (Cowork's).

## O0 · TODAY'S KNOCK — the heart of the app (FilthE, 2026-09-25) — Builder first
FilthE: "I want to load up the app, read where the AI wants me to knock today, and report the results. The
command center shows so many apartments, houses, numbers and addresses that it's messy for a human."
So the **Today tab leads with one simple knock plan**, and nothing technical:
- **One area per day** (storm walk if fresh hail, else an everyday/old-house walk), a one-sentence "why"
  (from the list's `why` reasons, plain words), a goal (e.g. 25 doors, ~2 hours) and a small map.
- **Houses only, in walking order, street by street.** No apartments/commercial (they stay in the command
  center), no scores, ids or geoids on screen.
- **One tap per door:** Not home (left hanger) · No · Interested · Booked (asks day + time). Undo on tap.
  Not-home doors come back on the next pass (3 passes). Interested/Booked create a `leads` record + follow-up.
- Live tally at the bottom (doors, talked, interested, booked) + call-backs due today + "Done for today"
  (writes `stats/week-*` and a one-line event for the King).
- **Where the list comes from:** pages can't read another page's data, so Claude writes today's walk into
  this app's db each morning: doc `today/walk` {date, area, why{en,es}, goal_doors, kind: storm|everyday,
  list_id, stops:[{pid, address, city, lat, lon, pass}]} picked from the command center's hud.json
  (`lists` or `everyday_lists`, houses only). The King's morning routine does it (add to O4); Claude Code can
  do it by hand until then. Door taps go to `doors/<date>_<pid>` {result, at, pass}.
- Voice/text still works (O2): "knocked 20, 1 interested at 615 Linden" updates the same records.

## O1 · The HMP App (T54 + T55) — Builder, QA Tester
Turn Crew HQ into a phone-first app with 4 tabs, remembered per viewer:
- **Today** (opens first): FilthE's 3 tasks from the board, follow-ups due today, streets to knock
  (from the latest door lists; link to the command center), the loud "N waiting on you" questions,
  and this week's 5 numbers: doors, conversations, inspections, estimates, signed.
- **Leads**: every homeowner lead in one list, storm AND everyday (old-house) AND referrals, with the
  9 stages (Not contacted -> ... -> Done/Lost), next step + due date, source, notes. Tap for detail.
- **Money**: claims (the Claim Tracker's view and schema, moved into this db as `claims`) plus cash
  (non-insurance) jobs: contract price, deposit, paid, owed. Totals on top.
- **Crew**: the existing office, board, chain of command and logs, unchanged.
Data (new collections in the Crew HQ db, Claude- and King-writable): `leads/<address-slug>`
{address, city, first_name, phone?, source: storm|everyday|referral|sub, type: insurance|cash,
stage, next_step{en,es,due}, notes, doors_visits[], created_at, updated_at, updated_by};
`claims/<slug>` (exact Claim Tracker schema in CLAUDE.md); `stats/week-<YYYY-WW>` {doors,
conversations, inspections, estimates, signed}. EN/ES toggle on every tab.
Done = FilthE opens one link on his phone and sees what to do today in 5 seconds; QA passes;
the old Claim Tracker page shows a "moved to the HMP App" note with the link.

## O2 · Talk to log (T53) — Builder, then the King
The "Talk to the King" box becomes the one inbox. FilthE types or dictates (keyboard mic) things like
"knocked 20, talked to 4, inspection 1418 Irving Tuesday 3pm, hail on the north slope" and the King
writes it: creates/updates `leads`, bumps `stats`, adds a follow-up, updates `claims`. Extend the
page's existing King actions (`applyActions`) with `log_lead`, `update_lead`, `log_doors`,
`update_claim`, `add_followup`; show a one-line receipt ("Logged: 1418 Irving -> Inspection set, Tue
3 PM"). Works in Spanish too (the boss or Alex can log). Done = 5 sample messages in EN and ES
produce the right records in the mock harness.

## O3 · Porch tools (T51 -> T52, + hail report + photos) — FilthE/Boss, Builder, Engine Mechanic
1. **T51 price sheet (FilthE + boss, blocks T52):** siding per square (vinyl, Hardie), roof per
   square (tear-off + shingles), trim, soffit/fascia, gutters, minimum job. Send it as a photo or text.
2. **T52 quick estimate** in the app: pick the job type, enter squares/feet, get a range in EN/ES;
   "Text this estimate" copies a clean message. Ranges, never a promise; insurance jobs say "your
   insurer's scope decides".
3. **Hail report on the phone:** the engine publishes per-address hail evidence for the latest door
   lists into hud.json (additive key); the lead detail in the app shows it. (Engine Mechanic, then
   Builder.)
4. **Photos per lead:** use the page `assets` capability so FilthE can add inspection photos to a lead
   (roof slopes, gutters, siding). Photos also feed the Google profile.

## O4 · Automatic follow-ups (T58) — King (+ FilthE approval on the Mac)
Every morning the King fills Today: who to call back, which doors to revisit (3 passes), adjuster
meetings, checks to chase. Needs the King's scheduled prompt changed; those prompts only change with
FilthE's approval on his MacBook, so Claude Code drafts the new prompt text and FilthE approves it.

## O5 · Learning loop (T35) — Engine Mechanic, after ~50 doors are logged
Compare door results (from `leads` + `stats`) with the Hot Zones and everyday heat scores; retune the
weights in config; report which reasons actually predicted inspections. Don't start before 50 doors.

## O6 · Boss view in Spanish (T59) — Builder
A simple Spanish screen for the boss inside the app: jobs in progress, crews, money in and owed, and
this week's inspections. Big text, no English, no AI office.

## Also on the board (not builds)
- **T5 (Cowork):** bundle the engine from GitHub main into the command center.
- **T50 (Engine Mechanic):** old-house leads, in progress.
- **T56 (FilthE):** before/after photos at The Edge + first 5 Google reviews (guide in docs/guides).
- **T57 (everyone):** the King + Claude Code run the day; helpers are called for real jobs.
- **T49 (later):** Crew HQ new look (round 3 plan in docs/research).

## How to start when usage is back
Paste into Claude Code: *"Read CLAUDE.md and docs/orders/build-orders.md, then run O0, O1 and O2 with
the Builder and QA Tester, and O3.3 with the Engine Mechanic, in parallel. Update the Crew HQ board
as you go."*
