# v28.1 research: control panels, the cat, and one building

Scouted for the v28.1 "One building" chunk (BUILD-v28.md) — three topics, checked first against AI-HUB-BLUEPRINT.md
(1, 12), RESEARCH-v28.md, FUN-IDEAS.md, CONVENIENCES.md, FUNCTIONS-SHORTLIST.md and SPEC.md notes 1-11 so nothing
here repeats what's already found. `[opened]` = the page was actually fetched and read this round. `[search]` = only
a search-engine summary of the page, not opened directly (this container's egress proxy blocks most of these
domains — see the note at the end) — treat these as **unverified**, one step down from `[opened]`.

**Top 5, plain English:**
1. Give the shortlist's schedule/cost cards real scripts instead of guesses: GitHub's own "disabled because of 60
   days inactivity" banner + one **Enable** button, and a cost alarm at **50-70%** of budget, not 80% — both proven,
   both a one-line change to what's already planned.
2. There's already an open-source Shimeji-style cat built **for Claude Code** (`claude-pet`) with almost exactly our
   plan: one shared cat, states for thinking/working/needs-you/done/error. Steal its state list outright.
3. The cat's "needs you" cue has to ride on a real event and back off gently, or it becomes Clippy — Duolingo had to
   learn this the hard way and rewrote its whole streak system because of it. Bake that into the cat's rules now,
   before it ships.
4. The single cheapest fix for "two stacked boxes": wrap both floors in **one continuous outer frame** (corner posts
   / edge beams that run the full height, unbroken) — this is literally how SimTower-style games and split-level
   houses read as one building despite offset floors.
5. Keep the tube, the stair and every other cross-floor connector on the **exact same X/Z line** on both floors —
   Fallout Shelter's whole vault design turns on this one rule (misaligned shafts read as separate rooms).

---

## Topic 1: many-agent control panels

FUNCTIONS-SHORTLIST.md #1, #2, #4, #6 already spec the *data* (chats list, spend meter, schedule strip, ready-to-ship
card) from the hub's own docs. Nobody had checked what the best real fleet-of-agents products actually put on
screen. That's what's below — it doesn't change what data to show, it changes the exact wording, thresholds and
interaction each card should copy.

1. **A paused/disabled job names its own reason, with a one-click fix, in the job's own words.** GitHub disables a
   scheduled Action after 60 days with no repo activity, and shows the exact banner *"This scheduled workflow is
   disabled because there hasn't been activity in this repository for at least 60 days"* plus an **Enable workflow**
   button right there. Why it helps: FUNCTIONS-SHORTLIST #4 already wants "paused on purpose" to look different from
   "broke" — this is the literal copy pattern to use for the King's own schedule strip ("Storm Watch: off since
   9/26, no reason logged" + a **Turn it back on** button), not a generic red dot. Effort: **S**. Plugs into: v28.2
   (FilthE's picks from FUNCTIONS-SHORTLIST #4/#7), the `system/schedule` doc already spec'd there.
   [opened] `github.com/efrecon/gh-action-keepalive` (README explains the 60-day rule directly).

2. **Cost alarms fire at 50-70% of the budget, not at the limit, and can be scoped to one tag/model/session.**
   Langfuse's own guidance: a straight 80% threshold doesn't leave enough buffer for a bursty session, and alerts
   can be filtered to one environment or session so a single expensive chat doesn't get lost in the daily total.
   Why it helps: FUNCTIONS-SHORTLIST #2 already has the right shape ("$41 in 90 min. Hand off?") but no stated
   threshold — this gives an exact number to use instead of guessing one. Effort: **S** (a constant, not new
   plumbing). Plugs into: v28.2, FUNCTIONS-SHORTLIST #2's spend-meter build. [search, unverified]
   `langfuse.com/changelog/2026-06-19-monitors` (page itself is blocked by the egress proxy; summary only).

3. **A session that needs you says exactly what it needs, and a jump-to-the-result is one click away.** GitHub's
   "mission control" for Copilot coding agents lets you watch a session's real-time log, steer it mid-run (pause /
   refine / restart) without killing it, and jump straight from the session card to the pull request it produced.
   Why it helps: FUNCTIONS-SHORTLIST #1 ("what it needs from you in plain words") and #6 ("Ready to ship... preview
   link") both want this; this confirms "one click to the actual output" (PR, preview) belongs on the card itself,
   not a level down. Effort: **M** (needs a stored link per session, not just a status). Plugs into: v28.2,
   FUNCTIONS-SHORTLIST #1 + #6. [search, unverified] `github.blog` posts on Agent HQ / mission control (blocked by
   the proxy; summary only, corroborated by `visualstudiomagazine.com` and `agentpatterns.ai` search results).

4. **Group sessions by project/working directory first, state second.** OpenAI's Codex CLI dashboard (`codex
   agents`) groups tasks by working directory and shows each one's state plus its most recent activity line, so you
   scan by "which project" before "which robot." Why it helps: the hub's own crew is small (7-8 named robots), so
   this matters less for "which robot" and more for **the King's own chats list** (FUNCTIONS-SHORTLIST #1), which is
   really a list of *projects/chats*, not robots — group by branch/topic, not just chronologically. Effort: **S**
   (a sort key, not new data). Plugs into: v28.2, FUNCTIONS-SHORTLIST #1 ("Your chats, one list"). [search,
   unverified] `proflead.dev` walkthrough (blocked by the proxy; summary only).

5. **An activity heatmap (GitHub-style) makes "is this crew actually working" readable in one glance, for free.**
   `droid-dash`, an open-source TUI for Factory.ai's coding-agent sessions, puts a calendar heatmap of session
   frequency front and center, next to per-session token/cost breakdown (input, output, cache-write, cache-read,
   each priced separately). Why it helps: this is a genuinely new idea, not in FUNCTIONS-SHORTLIST — a small weekly
   heatmap on the Observatory or the King's card answers "has the crew actually been busy this week" without
   opening a chat log, and the cache-read/write cost split is a real gap (today's spend meter would just show one
   number). Effort: **M** (needs the King to log cache tokens too, which it may already receive from `list_sessions`
   but doesn't currently store). Plugs into: v28.2, alongside FUNCTIONS-SHORTLIST #9 (Sunday report card) — could
   literally be the same data, drawn as a heat-strip instead of a paragraph. [opened]
   `github.com/izikeros/droid-dash` README.

6. **"Single pane of glass, follows you across devices" is the actual bar competitors set.** Warp's cloud-agent
   dashboard and GitHub's mission control both frame themselves as one unified view that works the same on desktop,
   web, mobile and CLI — a session started one place is steerable from any other. Why it helps: less an idea to
   build than a reminder of the bar — the hub is already MacBook-first by FilthE's own rule, so this doesn't argue
   for a mobile build, but it's worth stating explicitly as a **non-goal** rather than an oversight (see "don't do"
   below). Effort: n/a (a framing note). [search, unverified] `warp.dev` blog and GitHub blog (both blocked by the
   proxy; summary only, cross-confirmed by two independent search results).

7. **Per-run traces, not just per-day totals, when you need to know which run blew the budget.** Sentry's AI Agents
   Dashboard keeps a table of every agent run — trace id, duration, tool calls, tokens, cost, timestamp — alongside
   the daily rollup. Why it helps: FUNCTIONS-SHORTLIST #2's spend meter is daily/weekly only; if a single run is the
   problem, today's design has no drill-down. Worth a "see what ran today" expand on the spend line rather than a
   new page. Effort: **S** (the King's `crew/sessions` doc already has per-session `cost_usd`; this is a UI
   affordance, not new data). Plugs into: v28.2, FUNCTIONS-SHORTLIST #2. [search, unverified] `docs.sentry.io`
   (blocked by the proxy; summary only).

8. **A "hand off to fresh session" button is table stakes, and Cursor's version confirms the trigger: "needs your
   input" plus a cost/length threshold, not a fixed timer.** Cursor's web dashboard tracks agents through Linear's
   "My Issues" view and flags one when it needs input or finishes; it doesn't auto-hand-off on a clock. Why it
   helps: confirms FUNCTIONS-SHORTLIST #3's plan (a manual "Hand off" button, not an automatic one) is the right
   call — no new build implied, just validation. Effort: n/a. [search, unverified] search summary only, multiple
   sources agree (`linear.app/changelog`, `techcrunch.com`).

**Note on this topic's sourcing:** almost every vendor's own blog/docs domain (github.blog, warp.dev, sentry docs,
langfuse.com, mindstudio.ai, danwahlin.github.io) is blocked by this container's egress proxy, so most of the above
is search-engine summary, not a page actually read — flagged `[search, unverified]` throughout. The two items marked
`[opened]` (GitHub's keepalive README, droid-dash's README) are the ones to trust most; the rest are worth a second
look by whoever builds v28.2, ideally from a session whose proxy allows those domains.

---

## Topic 2: a roaming pet that delights without annoying (the cat, note 6)

CONTRACT.md and BUILD-v28.md already spec the cat's *events* (naps, knocks a pencil off a desk, rides the slide,
sits at "your spot" when watching, a robot goes to it when it needs FilthE). Nothing existing spec'd **how often**,
what makes idle behavior read as alive vs. random, or the exact line between "delightful" and "Clippy." That's the
gap this covers.

1. **There is already a Shimeji-style cat built specifically for Claude Code — steal its state list outright.**
   `claude-pet` (open source) maps real Claude Code events straight to animal states: prompt sent → **Thinking**;
   tool running → **Working**; permission needed → **Attention**; task done → **Celebrating**, then back to idle;
   context compaction → a distinct **"Doubling"** animation; an error → its own **Error** pose. One pet instance is
   shared across every open session/subagent — it doesn't spawn a second cat per agent. Why it helps: this is
   almost exactly HMP's plan (CONTRACT.md's `cat` field, one cat, a robot "plays with it" when it needs FilthE) —
   confirmed independently by someone who built the same idea for the same tool. Steal the **state names** directly
   (Thinking/Working/Attention/Celebrating/Error) as the cat's `mood` vocabulary, and the **one-shared-instance**
   rule as a hard constraint, not a nice-to-have. Effort: **S** (naming + reusing states that mostly already exist
   in `HUB.needs`/status tokens). Plugs into: v28.1, "FilthE's cat" section, `HUB.cat` block. [opened]
   `github.com/xtrimsystems/claude-pet` README.

2. **Idle variety comes from a short, repeatable chain, not a big random table.** oneko (the original cursor-chasing
   cat, 30+ years of clones) doesn't pick from dozens of animations — it runs one fixed **idle chain**: sit → groom
   → paw at something → scratch → yawn → curl up and sleep, waking with a startle the instant the cursor moves, and
   occasionally waving while asleep. Why it helps: a short, well-ordered chain reads as "a cat doing cat things" far
   better than a big randomized pool, and it's much cheaper to build and QA. Effort: **S**. Plugs into: v28.1, the
   cat's idle behaviors (currently listed as a flat list: nap, knock a pencil, sit on a keyboard — turn that list
   into an ordered chain with one rare "wave" beat). [search, unverified] Wikipedia *Neko (software)* and multiple
   GitHub forks agree on this exact chain; not opened directly this round (a prior round may have opened Wikipedia
   *Neko*, but not this file's sources).

3. **A concrete, tunable "how often" number: idle actions fire every 3-8 seconds, and any single behavior can be
   set to frequency 0 to turn it off.** Shimeji's own config system uses this range for its randomized idle actions
   and lets each behavior be individually disabled. Why it helps: gives an actual number instead of "sometimes" —
   and the "can be set to 0" idea maps directly onto FilthE's Make-it-yours panel: if a specific cat gag (say,
   knocking things off desks) annoys him, he can turn off just that one, not the whole cat. Effort: **S** (one
   config table + a per-behavior toggle in Make it yours). Plugs into: v28.1, cat behaviors + the existing Make it
   yours panel. [search, unverified] search summary only (Shimeji-ee source/docs pages).

4. **The reward for watching a pet should be watching it — not points, timers or streaks.** Neko Atsume's own
   design (widely written about) has no wait-timers, no quests, no push to compete with friends; the "reward" a cat
   leaves when it goes is a small gift (fish), not a score, and the core loop is just "cats do cute things, you
   check in for 30 seconds." Why it helps: directly answers "how can a pet carry a notification without nagging" —
   the cat playing with a robot **is** the notification (you see it happening, no popup needed), and if a token is
   left behind (say, a pencil moved, a paw print), it should be a small found detail, never a counter FilthE has to
   manage. Effort: n/a (a design rule, not a build item). [search, unverified] search summary of multiple game-design
   retrospectives; not opened directly.

5. **The failure mode to avoid by name: taking control away from the user is where "funny" turns into
   "frustrating," even in games designed to be annoying on purpose.** Desktop Goose's own postmortem coverage: the
   goose stealing the literal mouse cursor is the one mechanic players call out as going from funny-once to
   actually-annoying on repeat; leaving notes and dropping memes stayed liked. Why it helps: a hard boundary for the
   cat — knock a (virtual) pencil off a desk, sit on a keyboard (visual only), fine; anything that steals the
   camera, blocks a click target, or takes over an input the user is mid-action on is not. Effort: n/a (rule).
   Plugs into: v28.1, cat behavior list (as a constraint, see "don't do" below). [search, unverified] search summary
   of GameSpot/press coverage; not opened directly.

6. **Clippy's actual failure, per Microsoft's own retrospective, wasn't the character — it was interrupting without
   being asked, and reappearing after being dismissed.** Luke Swartz's study (widely cited, including by Microsoft
   staff after the fact) found Clippy broke basic social norms: it appeared mid-task uninvited, offered help nobody
   asked for, and was hard to permanently dismiss. Why it helps: this is the exact shape of the risk in "when an AI
   needs him, that robot chases the cat" — as long as the chase only starts on a **real** `needs_you` event (never
   on a timer, never repeating after he's answered it), the hub is already on the safe side of this lesson by
   design. Worth stating explicitly as a locked rule, not an assumption. Effort: n/a (rule, already mostly true by
   the hub's own "every animation is a real event" principle). [search, unverified] search summary of multiple
   retrospectives citing the same 2003 Swartz study; not opened directly.

7. **Duolingo had to publicly walk back its escalating-guilt notifications and redesign around "one lesson keeps the
   streak," which lifted 7-day retention 40%.** The lesson explicitly stated in its own postmortems: match the
   notification's intensity to the actual cost of the miss, and never punish an off day. Why it helps: if the cat's
   "needs you" cue has levels (an ear-perk first, only later sitting and staring), it should scale with how overdue
   the thing actually is — CONVENIENCES.md already has this instinct for text notifications ("silence is a safe
   answer"); this extends the same rule to the cat's body language. Effort: **S** (2-3 intensity poses instead of
   one). Plugs into: v28.1, the cat's "needs you" cue. [search, unverified] search summary of Duolingo's own blog +
   press coverage; not opened directly.

8. **Rare, scheduled "big" events read better than constant small ones.** Neko Atsume and Animal Crossing both hold
   back their best moments (a rare cat, a rare visitor) for occasional appearances rather than constant rotation —
   the rarity is what makes them notable. Why it helps: reserve one or two genuinely rare cat behaviors (say, once a
   day at most: curling up asleep on the Observatory's warm under-glow, or riding the full tube capsule end-to-end)
   instead of adding more everyday idle animations — a rare beat is memorable, a common one becomes wallpaper.
   Effort: **S** (a daily-once guard on 1-2 specific behaviors). Plugs into: v28.1, cat behaviors. [search,
   unverified] general game-design consensus from the same sources above; not independently opened.

---

## Topic 3: making two floors read as one building (note 2)

BUILD-v28.md's v28.1 plan already says the right words in general ("a shared structural core around the glass tube
... columns + slab edge that run through both floors ... terraces") — these are the specific, cheap moves that make
that concrete, each checked against the "no new real-time lights, no new shadow casters" budget (RESEARCH-v28.md
item 1, BUILD-v28.md's M0 budget line).

1. **Wrap both floors in one continuous outer frame — the single highest-leverage move.** Project Highrise and
   SimTower (its direct ancestor) both keep a tower's whole cutaway inside **one unbroken outer envelope**: a single
   rectangular frame with floors as colored bands inside it, never two separate boxes stacked. Why it helps: this is
   probably the one change that does the most against "looks like two stacked boxes" for the least cost — extend
   the vertical corner posts / edge beams already planned for the "shared structural core" so they run the *full*
   height of the building silhouette (both floors), not just around the tube. It's geometry FilthE will register
   instantly even though he'd never describe it this precisely himself — exactly his rule. Effort: **M** (new static
   geometry, no lights). Plugs into: v28.1, SCENE "one building (note 2)". [search, unverified] Project Highrise
   reviews/Wikipedia describing the shared SimTower-style cutaway envelope; not opened directly this round.

2. **Keep every cross-floor connector on the exact same vertical line.** Fallout Shelter's elevator design is
   explicit about this: shafts stack in the *same two X/Y positions on every level*, and that's precisely what
   makes multi-floor vaults read as one connected structure instead of a "tour." An elevator placed wherever it fits
   on each floor is called out as the thing that breaks the read. Why it helps: audit the tube, the stair/bridge
   landing and any glass panel so they share one exact axis on both floors — right now the tube's base and top are
   already speced at fixed local coordinates (blueprint 5.3: x0.3, z2.95), so this is really a QA check ("does
   everything the eye should read as 'the spine' actually share one line from every camera angle"), not new
   geometry. Effort: **S** (a QA pass, maybe minor coordinate nudges). Plugs into: v28.1, SCENE "one building".
   [search, unverified] Fandom wiki summary; not opened directly.

3. **A genuine sightline through the building, not just the tube, sells "one structure" the way a real atrium
   does.** Double-height atria in real buildings use open risers and glass balustrades specifically so light and
   sightlines pass *through* the floor plate, not just around a central shaft — the eye tracks from the top level
   straight down to the bottom one. Why it helps: right now the only see-through element is the tube itself; a
   second, smaller gap in the upper floor's slab (even a 1-2 tile opening near the Observatory, guarded by a glass
   rail already planned) would let the camera see straight down to the lower floor's furniture at certain angles,
   which a single connector tube can't do alone. Effort: **M** (a slab cutout + one more static glass panel; no new
   lights). Plugs into: v28.1, SCENE "one building" / Observatory cantilever. [opened] `en.wikipedia.org` summary +
   architecture-press search results on double-height atria; the Wikipedia *Split-level home* page (opened, see
   below) makes the same point about staggered sightlines specifically.

4. **A shared, continuous roofline (or ceiling plane) is what makes split-level homes read as one house despite
   staggered floors.** Split-level architecture — the closest real-world analog to "two floors that don't sit at
   the same elevation but must read as one building" — solves it mainly with **one unbroken roof/ceiling line**
   over the whole footprint, even though the floors inside step up and down. Why it helps: this directly targets the
   actual complaint (two floors offset in the isometric view) with the cheapest fix available — make sure the upper
   floor's ceiling plane and the ceiling plane visible from outside are one continuous static mesh/material, not two
   separately modeled roofs. Effort: **S-M** (likely already close; a materials/UV continuity check more than new
   geometry). Plugs into: v28.1, SCENE "one building". [opened] `en.wikipedia.org/wiki/Split-level_home`.

5. **Reuse the room's own baked-texture trick to make the seam between floors match, not just the geometry.**
   RESEARCH-v28.md (item 7, already in the plan) has the room baking AO/wear into the same canvas textures used for
   the travertine and walnut grain. Townscaper's whole visual trick is the inverse of that same idea: one
   consistent procedural rule applied at every block boundary so facades always read as continuous, no matter how
   the blocks are placed. Why it helps: apply the *same* baked-texture pass across the floor-to-floor seam
   specifically (today likely two separately-baked textures that don't line up at the transition) so the material
   grain, not just the structure, continues from one floor into the next. Zero new runtime cost — reuses tooling
   that already exists. Effort: **S** (a texture-authoring pass, not new code). Plugs into: v28.1, alongside
   RESEARCH-v28 item 7/11 (already-planned baked AO/roughness work). [search, unverified] Townscaper design-process
   write-ups (GameDeveloper.com); not opened directly this round (search result, HN and ArchDaily corroborate).

6. **A single locked camera angle, with one or two verified "anchor" points, is how impossible-looking connections
   read as seamless.** Monument Valley's navigation system deliberately keeps manual markup to a minimum and instead
   verifies, in screen-space, that a handful of specific points line up from the game's fixed camera — the illusion
   only has to hold from that one angle. Why it helps: the hub already has a fixed isometric camera family (Whole /
   Follow / Eyes) — pick 1-2 specific points (the tube base against the lower floor, the Observatory's cantilever
   edge against the upper floor) and explicitly verify, per camera preset, that they align pixel-perfect; this is a
   QA checklist item, not new art. Effort: **S** (QA only). Plugs into: v28.1, camera QA before ship (the "every
   milestone" shot checklist in BUILD-v28.md). [search, unverified] GameDeveloper.com "Making the impossible
   possible in Monument Valley"; not opened directly this round.

7. **A soft, static contact shadow under the upper floor is cheaper and more convincing than more real lighting.**
   Standard isometric game-art practice: pick one light direction and bake a **single consistent soft shadow**
   wherever one shape overhangs another, rather than adding a real-time light to sell depth. Why it helps: the
   Observatory's cantilever and any part of the upper floor that overhangs the lower one should get a static,
   baked-in darkening decal on the lower floor's ceiling/props directly underneath — exactly the kind of "shadow as
   an animated texture" trick RESEARCH-v28.md (item 7) already commits to, just applied specifically to the
   floor-to-floor overlap instead of furniture. Effort: **S** (one more baked decal, no new light/shadow caster —
   stays inside the "no new real-time lights" budget). Plugs into: v28.1, SCENE "one building" / Observatory
   under-glow (already planned to be additive-sprite based, so this is the same technique one layer lower). [search,
   unverified] general isometric-art shadow tutorials (Screaming Brain Studios); not opened directly this round.

8. **Terraces/setbacks — already in the BUILD-v28.md wording — are what McLaren's own "fingers and streets" motif
   (already cited in the blueprint) does at building scale: it breaks a single flat facade into stepped volumes
   that still read as one campus.** This isn't a new reference (the blueprint already cites McLaren for the
   Observatory's half-disc), but it directly answers *why* "terraces" specifically (not just a shared frame) helps:
   a stepped-back upper floor, rather than a flat slab sitting exactly on top of the lower one, is what avoids the
   "two boxes stacked" read in the first place, independent of any texture or lighting fix. Effort: **M** (geometry
   change to the upper floor's footprint). Plugs into: v28.1, SCENE "one building" (terraces, already named in
   BUILD-v28.md — this just confirms why it's worth doing even if #1 above ships first). No new source — cross-
   referencing AI-HUB-BLUEPRINT.md's existing McLaren citation, not a new one.

---

## Don't do

- **Don't let the cat take control of anything the user is mid-action on** (no stealing the cursor, no blocking a
  click target, no covering the panel he's reading) — Desktop Goose's own community reaction is the warning label.
- **Don't trigger the cat's "needs you" chase on a timer, or let it repeat after he's already answered** — that's
  Clippy's exact failure mode, and the hub's "every animation is a real event" rule already protects against it as
  long as nobody adds a fallback timer "just in case" later.
- **Don't build a mobile/cross-device version of the control-panel ideas above** — MacBook-first is FilthE's own
  rule (SPEC.md), and every fleet-dashboard product cited treats cross-device sync as a selling point specifically
  because *their* users are away from their desk; FilthE isn't.
- **Don't add a new real-time light or shadow caster to sell "one building"** — every move in Topic 3 above is
  static geometry or a baked texture on purpose, to stay inside the budget RESEARCH-v28.md and BUILD-v28.md already
  set (net +20 draw calls, no new lights, no new shadow casters).
- **Don't turn the cat's gifts/tokens into a counter or streak FilthE has to manage** — Neko Atsume's whole appeal is
  zero admin; a fish-counter equivalent here would be exactly the kind of "childish" surface FilthE's rule warns
  against.
- **Don't add a big randomized idle-animation table for the cat** — oneko and Shimeji both get more mileage from a
  short, well-ordered chain than a large random pool; more variety isn't automatically better here.

---

## Sources

Opened this round:
- [claude-pet: Shimeji-style animated desktop pet for Claude Code](https://github.com/xtrimsystems/claude-pet)
- [Split-level home — Wikipedia](https://en.wikipedia.org/wiki/Split-level_home)
- [droid-dash: TUI dashboard for Factory.ai Droid session analytics](https://github.com/izikeros/droid-dash)
- [gh-action-keepalive: keeps scheduled workflows from GitHub's 60-day auto-disable](https://github.com/efrecon/gh-action-keepalive)

Search summaries only (page blocked by this container's egress proxy, or not fetched this round — treat as
unverified, worth a second look from a session that can reach these domains):
- GitHub Copilot "Agent HQ" / mission control: `github.blog/ai-and-ml/github-copilot/how-to-orchestrate-agents-using-mission-control/`,
  `github.blog/changelog/2025-10-28-a-mission-control-to-assign-steer-and-track-copilot-coding-agent-tasks/`,
  `visualstudiomagazine.com/articles/2025/10/28/github-introduces-agent-hq...`
- OpenAI Codex `codex agents` dashboard: `proflead.dev/posts/openai-codex-agents-dashboard-codex-queue/`,
  `developers.openai.com/codex/cloud`
- Cursor background agents / "My Issues": `linear.app/changelog/2025-08-21-cursor-agent`,
  `techcrunch.com/2025/06/30/cursor-launches-a-web-app-to-manage-ai-coding-agents/`
- Warp cloud agents "single pane of glass": `warp.dev/blog/multi-harness-cloud-agent-orchestration`
- Sentry AI Agents Dashboard: `docs.sentry.io/product/insights/ai/agents/dashboard/`, `docs.sentry.io/ai/monitoring/agents/dashboards/`
- Langfuse Monitors/alert thresholds: `langfuse.com/changelog/2026-06-19-monitors`, `langfuse.com/docs/observability/features/token-and-cost-tracking`
- Vercel cron / third-party heartbeat monitoring (Cronitor, Tickstem, PulseWatch pattern): community + vendor pages,
  `vercel.com/docs/cron-jobs/manage-cron-jobs`
- Neko/oneko idle chain: Wikipedia *Neko (software)*, `github.com/winebarrel/Neco`, `github.com/Sky-creates/Oneko`
- Shimeji-ee behavior frequency/config: `kilkakon.com/shimeji/affordances.php`, `sourceforge.net/app/shimeji-ee/`
- Neko Atsume design (no timers/quests, gifts not scores): `notes.highlysuspect.agency/blog/nekos/`,
  GameSkinny, Medium (Alexia Mandeville game-design breakdown)
- Desktop Goose postmortem/reaction: GameSpot, ScreenRant, `samperson.itch.io/desktop-goose`
- Clippy failure analysis (Luke Swartz study, Chris Pratley): `thenewstack.io/humanity-vs-clippy-...`,
  Medium ("5 Lessons from Microsoft's Clippy"), `windowsforum.com/news/clippy-lessons-for-microsoft-copilot-...`
- Duolingo streak redesign: `duolingo.deconstructoroffun.com/mechanics/streaks`, `blog.duolingo.com/hi-its-duo-the-ai-behind-the-meme/`,
  `designfolio.substack.com/p/crazy-ux-redesign-duolingo`
- Project Highrise / SimTower cutaway envelope: Wikipedia *Project Highrise*, `pietriots.com/2018/10/18/project-highrise/`
- Fallout Shelter elevator-shaft alignment: `fallout.fandom.com/wiki/Elevator_(Fallout_Shelter)`, Steam Community discussions
- Monument Valley screen-space anchor navigation: `gamedeveloper.com/design/making-the-impossible-possible-in-i-monument-valley-i-`
- Townscaper's per-block procedural facade continuity: `gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making`,
  Hacker News discussion, ArchDaily
- Double-height atrium / glass-stair sightlines: architecture-press roundups (Architizer, Elevated Stairs, Cindrebay)
- Isometric shadow/lighting convention: `screamingbrainstudios.com/isometric-shadows/`, `screamingbrainstudios.com/isometric-lighting/`

*Written by the Research Lead, 2026-09-28, for BUILD-v28.md's v28.1 "One building" chunk. Read alongside
AI-HUB-BLUEPRINT.md, RESEARCH-v28.md, FUN-IDEAS.md, CONVENIENCES.md and FUNCTIONS-SHORTLIST.md — nothing here
repeats their content. No 3 improvement-scouts were available to dispatch this round (no agent-launch tool in this
session); the Research Lead ran all three topics directly with WebSearch/WebFetch instead, so treat "opened" vs.
"search" tags above literally rather than as a scout's self-report.*
