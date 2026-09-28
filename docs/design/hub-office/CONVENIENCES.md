# Hub conveniences, ranked (2026-09-28)

FilthE: "I get extremely pleased by convenient things that are extremely helpful and carefully thought of, that I
wouldn't have thought of." Around 30 ideas were pitched for the AI hub and each one went past a skeptic who checked it
against the real `pages/crew-hq.html`. Here the near-duplicates are merged, every skeptic fix is applied, and the
result is ranked by **helpful x non-obvious** (out of 100). Everything stays inside the hub. Nothing reads or shows HMP
App data (no leads, doors, homeowners, claims or money). Nothing here repeats SPEC.md, FUN-IDEAS.md or
ART-DIRECTION.md. Where an idea overlapped something already planned, it upgrades that plan instead of adding a second
one.

**Rules every item follows**
- **Schedule.** Read the King trigger with `get_trigger` (next_run_at, last_run, enabled) when the page is allowed to.
  If it isn't, fall back to 7:52 AM / 12:52 PM / 5:52 PM and Storm Watch 6:54 AM, computed with Intl in America/Chicago
  so daylight saving can't shift them.
- **"The King checked in"** means agent `code` (`agents/code.at` or a `code` event). Agent `king` is the Right Hand,
  and the page writes that one itself.
- **"A King is running"** means `agents/code` is working with no check-out, or code or one of its helpers posted an
  event in the last 20 min. The hub never starts a second King while one is running.
- **Keys and buttons.** No key ever sends an answer, and the three answer buttons stay equal (ART-DIRECTION 7.3, 7.4).
- **No guesses as facts.** If the hub isn't sure, it says less. When there's nothing to say, nothing shows: silence
  is the premium state.

**Ship first: real bugs found while checking these.** Each is small, and each is named again under its item.
1. `kingSeen()` counts agent `king` (the Right Hand), so "✓ picked up" can turn green even when Claude Code never ran. (#8)
2. "Not now" is saved as a final answer, so the question disappears for good. It also starts a King session. (#3)
3. The first answer wakes the King instantly (`wakeLastAt` starts at 0), and every tap more than 20 s later wakes it
   again. (#1)
4. `askKing()` returns early while the Right Hand is busy, so the follow-up for that answer is lost. (#1)
5. `qidOf()` builds the question id from the robot's `at`, so a re-posted question drops his answer. (#4)
6. `needItems()` puts board questions before stopped robots and caps the list at 2 under 1,560 px. On a MacBook that
   hides the real blocker. (#9)
7. The Right Hand's "remember" keeps only the last 20 facts and drops the oldest one silently. `close_question`
   throws away its note. (#7)
8. `lastSeen` is read once, `recapShown` never resets, `markSeen()` writes on the first visible instant, and `onErr()`
   never reconnects. (#6)
9. The sky test `/hail|granizo/` turns the sky stormy on "no new hail". (Also good)
10. A helper stays "working" for 3 h after its run ended without checking it out. (#2)

## Top 12

### 1. One wake per sitting: answers ride the next run
Score 81 (9 x 9). Merges: Nothing runs while you sleep · One wake, at the right time · One wake per sitting (both) ·
Smart wakes · Catch the next run · Rides the next run when it's close.
- **Pitch:** answers save instantly, and the King wakes once when he's done answering. If a run is about to read the
  answers anyway, it doesn't wake at all.
- **Quietly handles:** his usage limit. Five answers over 3 minutes can start five fresh King sessions plus five Right
  Hand calls today, and two Kings can overwrite each other's `board/current`. All he'd see is the usage bar jump.
- **Trigger:** every answer and every Right Hand order (`wake()` / `fireWake()`).
- **Build:** page M, crew S.
- **How:**
  1. Answers and orders save at once, as they do today, so nothing is lost if the lid closes. Only the wake waits.
  2. **Hold.** Send one wake with everything when any of these happens first: 90 s pass after his last answer, he
     answers the last open item, or the tab goes hidden (`visibilitychange`; an async call started on `pagehide`
     dies). The held wake is also kept in localStorage, so a tab that froze sends it on the next open.
  3. **Ride.** If the next run starts within 20 min, or it's quiet hours (10 PM to 7:30 AM Central), don't wake.
     Line: "Rides the 12:52 run · in 9 min · Wake now" / "Va en la corrida de las 12:52 · en 9 min · Despertar ya".
     At night: "Saved. Rides the 7:52 AM run. Nothing runs while you sleep." / "Guardado. Va en la corrida de las
     7:52 AM. Nada corre mientras duermes."
  4. **Mid-run.** While a King is running, hold the wake until it checks out. Then wake only if it missed the answer
     (the answer's `at` is newer than `system/king.answersReadAt`). Line: "The King is working; it reads this before
     it checks out."
  5. **Safety net.** If the run the answers are riding hasn't checked in 15 min after its slot, send the held wake
     anyway. Skip this when #2 shows a usage limit.
  6. **Two devices.** Just before firing, skip if a King checked in after the hold started. So if his phone already
     woke it, the Mac doesn't fire a second one.
  7. **Not now never wakes anything.** Yes / No / Not now skip the Right Hand follow-up. Typed replies get one
     batched call ("I answered D12, D14: ..."), which fixes the follow-up that gets lost while the Right Hand is busy.
  8. **Urgent skips the hold.** That covers an item the King marked `urgent:true`, an order with urgent words (EN/ES),
     and a tap on "Wake now".
  9. The line shows only when a hold lasts more than 10 s. It's text only: no draining ring, no "wakes saved" counter.

### 2. The run watchdog, and one honest status line
Score 72 (9 x 8). Merges: Run receipts and a missed-run alarm · All-clear line + run watchdog · A receipt that notices
a missed run · Missed-run watchman · The run clock · Resting or broken.
- **Pitch:** the hub knows when the crew is due. A run that never came or died becomes one plain line with the right
  fix. When all is well, one calm line says so.
- **Quietly handles:** "did the 7:52 even run, or did I hit my limit?" Today a run that never happened leaves nothing
  on screen, and he finds out hours later from a stale board.
- **Trigger:** on every open, and every 5 min after that. It also works in hindsight: opened at 3 PM, it still sees
  that 12:52 never checked in.
- **Build:** page M, scene S (dim state).
- **How:**
  1. **Read the trigger.** Once per open, and again after a miss, read `get_trigger` (last_run status / fired_at /
     finished_at, enabled, suspension_reason, next_run_at), plus `get_session` status_bucket if allowed. This costs
     no Claude usage. If the page can't read it, fall back to: no `code` check-in from 5 min before to 20 min after
     the slot.
  2. **Name the cause, and offer the matching fix:**
     - "The 12:52 run never started · Run it now"
     - "Started but never checked in · Run it now"
     - "The King's schedule is paused (subscription paused)", with no button
     - "Hit the usage limit · the 5:52 run tries again", with no button, because re-running before the reset just
       fails
     - If the next run is under 60 min away: "The 12:52 run will pick it up in 40 min", with no button.
     - It never fires while a run is live.
  3. Two misses in a row show as one line: "2 runs missed since 7:52 · the schedule may be paused".
  4. **Storm Watch:** "Storm Watch didn't run at 6:54 AM · the Mac was probably asleep or Cowork was closed". Storm
     Watch is a Cowork task on his Mac, so the fix is opening Cowork, not waking the King. The check turns on only
     after Storm Watch has checked in at least once, so there's no false alarm every morning.
  5. **Orphans.** A helper still "working" after its King checked out goes idle right away, with the note "its run
     ended at 1:30 PM without a check-out". There's no alarm. Today it takes 3 h.
  6. **One health line** in the live pill, so the watchdog and the robots never report the same silence twice:
     - "All normal · 3 working · next run 5:52 PM" / "Todo en orden · 3 trabajando · siguiente corrida 5:52 PM"
     - "Quiet by design · next run 5:52 PM"
     - or the amber watchdog line.

     Limits are fixed: a helper counts as silent after 30 min, the King after 45 min. A silent robot dims and its
     strip turns grey. No cause is printed unless session data confirms it.
  7. The line clears itself on the next check-in.
  - Cut: a per-device history of run lengths, "King silent 25 min = died", learned check-in rhythms, the
    broken-antenna pose.

### 3. Not now means later
Score 64 (8 x 8). Merges: Not now comes back · "Not now" brings it back when you're back · the Not-now parts of
Answers that remember and Nothing runs while you sleep.
- **Pitch:** "Not now" parks a question and brings it back the next time he sits down at the Mac. If it stopped
  mattering in the meantime, it never comes back.
- **Quietly handles:** today "Not now" is a final answer. `openAsks()` / `waitingBots()` drop the question for good,
  and the tap still starts a King session. He almost certainly thinks it's a snooze, and the Right Hand's own rules
  say "remind me later keeps it open".
- **Trigger:** tapping Not now / Ahora no.
- **Build:** page S-M, crew S.
- **How:**
  1. It saves `answers/<id>` = {answer:'Not now', back:{after: now + 2 h, snap:{ask, doing, task, progress}},
     snoozes:n}. No wake.
  2. While parked, the question is hidden. A dim "Parked · 2" / "Pospuestas · 2" chip ends the Needs strip, and a tap
     on it lets him answer early. The robot shows idle with a small clock on its name tag, not "back to work".
  3. It returns to the top of Needs on the first MacBook-width session after `after`, once the tab has been visible
     30 s, tagged "parked 2:14 PM". A then/now line shows only if something changed: "Then: T190 2/5. Now: 4/5,
     still waiting."
  4. It's dropped silently if the D# left `board.waiting`, the robot posted a newer ask, its task went DONE, or the
     robot is no longer waiting.
  5. On the second return, "Not now" becomes "Let the King decide" / "Que decida el Rey". The King researches, picks,
     and posts one `decided` event, which shows in #7 and can be reopened.
  6. The handoff tells the crew: "postponed, not declined; don't act on it, don't re-ask it, give the helper other
     work."
  7. Migration: old "Not now" answers come back once, and only if they're still on `board.waiting` or the robot is
     still waiting on them.

### 4. You already decided this
Score 64 (8 x 8). Merges: Already answered · Asked before? · You already decided this · the matching part of Answers
that remember · the carry-over fix from The answer is already picked.
- **Pitch:** when a robot re-asks something he already answered, his old answer shows above the buttons with one
  "Same answer" tap, and the crew is told to stop asking.
- **Quietly handles:** answering the same thing twice (his standing rule) and answering it differently by accident.
  It also fixes a bug: when a robot re-posts the same ask with a new check-in time, `qidOf()` gives it a new id, his
  answer comes loose, and the question lights up again.
- **Trigger:** an item enters Needs.
- **Build:** page S, crew S.
- **How:**
  1. **Exact re-post** (same robot, same normalized ask, new `at`): the old answer carries over by itself. The card
     says "same question as 10:02; your answer carried over", and the King is told, because it means the answer
     never reached the robot.
  2. **Near-match**, done locally with no Claude call. It counts only if (a) both share a T#/D#, or (b) they share
     the same scope word (hub / app / print / door), 60% or more of the content words overlap, and no numbers or
     version ids differ. Rare tokens weigh heavily; common words like publish/publicar don't count. Memory facts are
     matched one at a time. English doesn't match Spanish; the crew rule below covers that.
  3. The old question and answer show word for word: 'You answered this Sep 26 (D9): "Alex does the Spanish side."
     · Same answer'. Nothing is ever preselected, prefilled or sent without his tap. "Not the same" hides it on that
     device.
  4. An old "Not now" shows as "You said Not now on Sep 26": no Same answer, and it isn't counted as a crew failure.
     An answer older than ~14 days offers "Still true?" instead of "Same answer".
  5. If he answers the opposite way, one line says "This changes your Sep 26 answer (D31). The crew will be told.",
     and the handoff says "overrides D31".
  6. "Same answer" adds "(same as D9)" to the note and "re-ask of D9 by Builder: save to memory" to the wake. The
     King saves the fact to memory and CLAUDE.md, so the next fresh session already knows it.
  - With no match, nothing shows.

### 5. Silence is a safe answer
Score 64 (8 x 8). Merges: Questions that can't stall the crew · The crew's pick, already on the button · the rec/why
part of The answer is already picked.
- **Pitch:** every question arrives with the crew's pick, one reason, and what they'll do if he says nothing. Easy ones
  settle themselves. Only real "your call" questions wait on him.
- **Quietly handles:** "what happens if I don't answer?" A Friday question stops looking urgent all weekend, the crew
  never stalls on him, and his inbox shrinks to what only he can decide. That's his "research first, don't ask" rule
  made visible.
- **Trigger:** every new board question or robot ask.
- **Build:** crew M, page S.
- **How:**
  1. **Two-way doors** show quietly, with no orange and no ding: "Going with Yes at the 5:52 run unless you change
     it" / "Se hace Sí en la corrida de las 5:52 si no lo cambias". Zero taps. Once `by` passes, the page itself
     shows "Crew is going with: X".
  2. **One-way doors** have `default:null`, a brass "Your call" / "Tú decides" tag, and are never decided
     automatically or batched. They are exactly CLAUDE.md's only-a-person list: the boss's prices, registration #,
     warranty promises, spending money, signing, deleting data, and anything legal or customer-facing.
  3. **The card:** a small line above the three equal buttons: "Crew suggests: Yes · it's already built". The A key
     focuses the suggested button instead of Yes, and Enter confirms it. No orange ring, no extra keys. An either-or
     question uses the crew's `options` as its buttons.
  4. At the deadline the King writes `answers/<id>` {answer:'Default', by:'King', note} plus a `decided` event. It
     shows in #7 with "Change it" / "Cambiar". Overriding rewrites the answer and wakes the King per #1.
  5. Save `followedRec` so the King learns how often its picks are right.
  - Cut: an accept-all button with an 8 s undo, guessing either-or options from the text, "about 30 s" estimates.

### 6. The tab you left open fixes itself
Score 63 (7 x 9). Merges: Lid-open catch-up.
- **Pitch:** when the MacBook wakes with last night's hub still open, the tab reconnects by itself and tells the
  overnight story like a fresh load. Left open all day, it idles gently.
- **Quietly handles:** a dead tab he'd never suspect ("Lost the live connection" never reconnects today), a 2-second
  glance wiping out "since you left", and a warm fan while nothing moves.
- **Trigger:** the tab becomes visible, `pageshow`, focus, or `online`.
- **Build:** page M, scene S (`SCENE.busy()`, `setDPR()`).
- **How:**
  1. If the connection is off, or the newest data is 2+ min old: unsubscribe every old listener first (otherwise he'd
     get double listeners and double dings), then `connect()` again with backoff 2 / 5 / 15 / 60 s. "Reconnecting…"
     shows only after 4 s.
  2. The seen time is written only after 5 s visible and focused, then every 60 s while focused. `lastSeen` is
     re-read on every return and the recap resets, so a tab left open overnight gets the same morning note (#12) as a
     fresh load.
  3. The weather is fetched again if it's older than 15 min.
  4. **Battery.** Only when the window has lost focus, or there's been no pointer for 2+ min, drop to ~30 fps with
     DPR 1.25. Full speed comes back on the next pointer move. Don't go to 10 or 5 fps, because choppy robots break
     "alive". Don't use `getBattery()`, which Safari and Firefox lack. A hidden tab is already paused by the browser.
  - Nothing new appears on screen.

### 7. Nothing changes behind your back
Score 56 (7 x 8). Merges: Nothing decided behind your back · the memory half of Quiet dust.
- **Pitch:** when he comes back, anything the crew decided without him comes first, each with one-tap undo. The shared
  memory never silently deletes a fact.
- **Quietly handles:** "did they decide something for me?" A closed question, a new memory fact or rewritten orders
  steer every future run. Today the Right Hand's 21st "remember" also silently drops the oldest fact every AI relies
  on.
- **Trigger:** a return after ~45 min or more away, with at least one decision to show. Also any memory write.
- **Build:** page M, crew S.
- **How:**
  1. It's built on events. Every crew decision writes a `decided` event with its reason: closing a question, adding a
     memory fact, rewriting orders, a default from #5, a "Let the King decide" from #3. The page's own
     `close_question` does the same with its note. The list is simply the `decided` events since he last looked, so
     it works on any device. A local snapshot is only a safety net for writes that skipped the event.
  2. Lines, in order:
     - "Closed without your answer: D12 · King: no longer needed · Reopen"
     - "Remembered: 'Hub stays MacBook-first' · Undo"
     - "New orders: <title>"
     - "Went with the default on D14: orange · Change it"
  3. His own actions are left out (his answers, and his Right Hand orders and remembers).
  4. It lives inside the existing recap / morning note (#12). With zero decisions, it shows nothing at all.
  5. Undo on memory writes an event that keeps the removed fact, so an undo can itself be undone.
  6. **Memory.** A "18 of 20" meter shows only at 18 or more. At 20, the Right Hand must merge or retire a fact (a
     new `replace {old, fact}` action) instead of dropping one. The retired fact goes to the King as a note to fold
     into full-context.md, so nothing is lost and he sees no new UI.
  - Cut: Done/New task lines (the planned recap count covers them).

### 8. Proof it landed
Score 49 (7 x 7). Merges: Proof receipts on every answer · the receipt steps from A receipt that notices a missed run ·
the dropped-answer check from All-clear line + run watchdog.
- **Pitch:** under every answer, one word that only moves forward on real proof: Saved → Rides 12:52 (or With the
  King) → Read → Done. He can change the answer until it's read.
- **Quietly handles:** "did that reach anyone?" Today "✓ picked up" turns green seconds after a board answer, because
  the page's own Right Hand posts as `king` and `kingSeen()` counts that, even when Claude Code never ran.
- **Trigger:** any `answers/<id>` written by him.
- **Build:** page M, crew S.
- **How:**
  1. **Fix first:** `kingSeen()` counts only `code`, code's helpers and `agents/code.at`. It's one line; ship it
     alone if nothing else ships.
  2. One status word, with the time on hover. It reads "Read" only when a `code` event's `re` equals that answer id.
     It reads "Done" when a later event with that `re` is a start, handoff or done, and a tap shows the King's own
     words: "King 1:18: passed to Builder, T201". After that it collapses to "Done 1:21 PM" and leaves the answered
     fold after 24 h.
  3. **Change it until it's read.** Until the word says Read, the answer can be changed or undone. Undo deletes
     `answers/<id>` and its event and rewrites the held wake from #1. That's the undo: more time than a 6 s toast,
     and nothing lost if the lid closes.
  4. **Dropped answer.** It was meant for a helper, and a King run started and checked out after it, but no
     code-to-helper handoff followed: "Your answer to D41 hasn't reached Designer · Resend".
  - Cut: four dots per answer, the cross-device retry claim, fuzzy "the text names it" matching.

### 9. The real blocker is always on top
Score 49 (7 x 7). Merges: Needs ranked by what waiting costs · One-liners that say what it's holding up · the
ordering fix from The morning note.
- **Pitch:** the Needs strip sorts by who is stuck, says it in plain words, and folds away what can wait.
- **Quietly handles:** on a MacBook the strip shows only 2 items, and board questions always come first. A robot
  actually stopped on him can be hidden behind a thumbs-up question.
- **Trigger:** every Needs render.
- **Build:** page S-M, crew S.
- **How:**
  1. **Fix first:** stopped robots go first, then board questions oldest first, and a capped list shows "+N".
  2. The crew adds `holds:[ids]` to every ask, and a robot's own ask always holds that robot. Sort by robots held,
     then runs missed, then age. With no field, sort by age with no tag; never guess from event text.
  3. One true line: "Holding up Builder + QA · waited 1 run" / "Frena a Builder + QA · esperó 1 corrida". Age is
     counted in runs, not minutes, because the crew only works in runs. The task title comes from the board, clipped
     at ~70 characters.
  4. Items that hold nobody fold into "Can wait · 3" at the end. They never ding, never notify and never wake the
     King (#1).
  - Cut: ETAs from progress, and "idle until 7:52 AM (14 h)" deadlines that don't exist.

### 10. Only your loops ping you (for when Mac notifications arrive)
Score 49 (7 x 7). Merges: Only your loops ping you · the notification parts of Rides the next run and Missed-run
watchman.
- **Pitch:** Mac notifications stay silent for routine work. They speak only when something is blocked on him, a run
  is about to need him, a run was missed, or something he started is done.
- **Quietly handles:** the obvious build, a ping on every finish, gets muted within a day. What he actually waits on
  is the result of his own taps and orders.
- **Trigger:** only while the hub tab is hidden.
- **Build:** page M, plus the notifications capability (added through artifact-capabilities).
- **How** (in rank order):
  1. A robot is newly blocked on him (it holds someone, #9).
  2. 15 min before a run, if he has questions open, one notice that replaces itself: "2 quick questions. Answer
     before 12:52 and the King handles them without an extra session."
  3. A missed run (#2). Not for a usage limit, where there's nothing to do.
  4. His loop closed: a `done` for the task id of his answer or order, such as "Designer finished what you picked ·
     T205". Loops with no task id stay at the receipt and never notify.
  - At most one per 10 min; extras merge into "2 of yours are done". Nothing while the tab is visible, and night is
    left to macOS Focus. Never for start/progress, robot-to-robot handoffs, board edits or hail (Storm Watch already
    sends its own push and email). MacBook only, since web notifications on an iPhone need a home-screen install.
    Clicking one focuses the tab and opens that card.
  - The quiet half needs no permission: when nothing needs him, the Needs strip reads "· 2 of yours moving" / "· 2 de
    lo tuyo en marcha", and hovering lists them.

### 11. Forgotten tasks float up
Score 49 (7 x 7). The task half of Quiet dust.
- **Pitch:** every board row shows when anything last happened on it. A task nobody touched for days gets a soft flag
  and rises in its group.
- **Quietly handles:** telling a live task from a forgotten one. Today any small board edit resets the whole-board
  "may be out of date", so nothing ever looks stale.
- **Trigger:** every board render.
- **Build:** page S, crew S.
- **How:**
  1. Each row gets a faint mono age ("2h", "4d"), taken from whichever is newer: the row's own `at` or the newest
     event that names it. The crew stamps `at` on every row it touches, because only the newest 300 events are kept
     and events alone would lie.
  2. A task in DOING/REVIEW quiet for 3+ days, or BLOCKED for 2+ days, gets an amber "quiet 4 days" / "4 días sin
     movimiento". Stale BLOCKED tasks sort first in their owner's group, his own tasks included.
  3. The whole-board "may be out of date" is removed.
  4. Once a day his device overwrites one doc, `system/stale`, with the list. The King reads it on its run and pokes
     the helper or parks the task. No new event every day.

### 12. The morning note
Score 48 (8 x 6). It upgrades the planned "While you were away" recap and adds no second overlay.
- **Pitch:** the first open of the day answers "do I have to do anything before I leave?" in 5 seconds.
- **Quietly handles:** the morning question he'd otherwise answer by scrolling past the office or watching a replay.
  It also tells him outright when he can close the lid.
- **Trigger:** the first open between 5 and 11 AM Central (per device), or any return after 6+ hours.
- **Build:** page S-M.
- **How:**
  1. Three lines at most, EN/ES:
     - "Overnight: 4 done · 1 stuck" (it names two, then "+N more")
     - Storm Watch's latest line, or "Storm Watch hasn't checked in today" (from #2)
     - the King's plan, from `system/king.summary`, when it's from today
  2. Decisions made without him (#7) and parked questions coming back (#3) sit above those lines when there are any.
  3. When nothing needs him: "All clear. Next run 12:52 PM. You can close the lid." / "Todo en orden. Siguiente
     corrida 12:52 PM. Puedes cerrar la laptop."
  4. The top need (#9) is one tap away, and the planned A key opens it. There are no Y/N keys and no type-anywhere
     typing: keys 1-8 are cameras, and no key sends an answer.
  5. The replay stays available as a quiet "Watch it" link. The note fades on Esc, on his first drag, or 2 s after he
     answers. A small "Today" pill by the clock brings it back until midnight.
  - Cut: scoring questions by how often a D# is mentioned (noisy and hard to explain).

## Also good
- **The sky reads "no hail" correctly.** One helper ignores negated mentions (no / zero / without / sin / ningún / no
  hay ... hail / granizo), so "no new hail within 250 miles" stops turning the sky stormy. The planned hail-alert
  moment uses the same helper. Page S; ship now.
- **Saving mode after a limit.** If the Right Hand or `fire_trigger` comes back rate-limited, every wake rides the next
  run, and one line says "Saving mode · instant wakes resume after the next successful call". It gives no reset time,
  because the hub can't see Claude Code spend. Page S, crew S.
- **Today's usage on the King's card:** "Today: 3 runs · 2 wakes · 5 Right Hand replies". Store one small doc per wake
  (`usage/wakes/<stamp>-<device>`), never one array that two devices can overwrite. It never goes in the Needs header.
  Page S.
- **Copy for Cowork.** An order to Cowork, when Cowork hasn't checked in for 24+ h, shows "Cowork last checked in 3
  days ago; it reads this next time it opens the hub" plus a ready-to-paste "Copy for Cowork" message. The King has no
  line into Cowork's chat. Page S.
- **The Right Hand keeps its promises.** Its reply JSON gets a `promised` flag. If a reply promises to pass something
  on but carries no order, his own words go to `code` as an order that rides the next run, with no wake. No
  word-matching guesses. Page S.
- **The Right Hand chat survives a reload.** It keeps the last 12 turns for 48 h on that device. `logKing` also saves
  his own words, so the King reads what he said and not only the summary. Page S.
- **Stuck across runs.** When the same robot is blocked on the same task in 2 runs, one line says "Builder spent 2
  runs on T190's wall · Re-plan it", which is a handoff to `code` riding the next run. It needs a small localStorage
  map, since only 120 events load. Page S.
- **Storms at Fremont airport overnight.** Next to a Storm Watch miss, the hub checks weather.gov KFET observations
  for the last 24 h (the list endpoint, not `/latest`). If they show thunder, one line reads "storms at Fremont airport
  overnight". Page S.
- **"12:52 run in 10 min" header.** While questions are open, the Needs strip header shows the next run. That's the
  pre-run nudge until notifications (#10) ship. Page S.
- **Cut on purpose, so nobody re-adds them:** Y/N single-key answers, type-anywhere, preselected or prefilled old
  answers, accept-all with an 8 s undo, learned check-in rhythms, ETAs, reset-time guesses, 10/5 fps idle, the
  broken-antenna pose, "about 30 s" estimates, a "wakes saved" counter, cross-device retry claims.

## How the crew makes these possible
- **Check in fast.** Every King run posts its start check-in as `code` within its first minutes, tagged
  `run:'scheduled'|'wake'` (#2, #1).
- **Re-read answers before checking out.** The King reads `answers/` written since it started, acts on them, and
  writes `system/king.answersReadAt` (#1, #8).
- **Every scheduled run reads all answers newer than its last run**, whether or not a wake fired (#1, #3).
- **Put the answer id in `re`** on the event that acts on an answer or an order (#8, #10).
- **Every question carries `rec`, `why` (90 characters max, EN+ES), `by`, `default` and `holds`.** Add `options` for
  either-or questions and `urgent:true` only when it truly can't wait. `default:null` is only for the only-a-person
  list. `by` is at least one evening after asking (#5, #9, #1).
- **Apply defaults first on every run.** Any question past `by` with no answer gets `answers/<id>` by:'King' plus a
  `decided` event (#5).
- **Log every decision as a `decided` event with its reason:** closing a question, a memory fact, new orders, or a
  choice made for him (#7).
- **Honor "Not now".** Don't act on the question or re-ask it before it comes back, and give the helper other work. On
  "Let the King decide", research it and post one `decided` line (#3).
- **Check before asking.** Search `answers`, `system/memory` and docs/memory/full-context.md before posting an ask. If
  it's already answered, act on it and save a memory fact. On "re-ask of D9 by Builder", save the fact to memory and
  CLAUDE.md, and fix that robot's habit (#4).
- **Stamp `at` on every board row you touch**, and read `system/stale` each run to poke or park (#11).
- **Merge memory at 18 or more facts:** move retired facts into full-context.md instead of letting them fall off (#7).
- **Helpers check out** (idle or done) before their run ends. The page tidies orphans anyway (#2).
- **Storm Watch posts a start and a done check-in** every morning (#2, #12).
- **Read `system/usage.saving` at the start of a run.** If it's set, run light: haiku helpers, no research rounds
  (Also good).
- **One-time:** before Sunday Nov 1 (daylight saving ends), confirm the King trigger's cron starts with
  `CRON_TZ=America/Chicago`, and let the page read `get_trigger` if the connector permission allows it (#1, #2).
