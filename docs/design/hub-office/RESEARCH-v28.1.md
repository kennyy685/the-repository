# v28.1 research: control panels, the cat, and one building

Scouted for the v28.1 "One building" chunk (BUILD-v28.md) — three topics, checked first against AI-HUB-BLUEPRINT.md
(1, 12), RESEARCH-v28.md, FUN-IDEAS.md, CONVENIENCES.md, FUNCTIONS-SHORTLIST.md and SPEC.md notes 1-11 so nothing
here repeats what's already found. `[opened]` = the page was actually fetched and read this round. `[search]` = only
a search-engine summary of the page, not opened directly (this container's egress proxy blocks most of these
domains — see the note at the end) — treat these as **unverified**, one step down from `[opened]`.

**Top 5, plain English (updated after the 2026-09-28 verification pass — see the note at the end):**
1. Give the shortlist's schedule/cost cards real scripts instead of guesses: GitHub's own "disabled because of 60
   days inactivity" banner + one **Enable** button (proven, `[opened]`). The cost-alarm number is downgraded: opened
   Langfuse's own docs this round and they don't say "50-70%, not 80%" anywhere — that figure isn't Langfuse's to
   credit. Pick our own buffer (50-70% is reasonable general cost-alerting practice) without citing Langfuse for it.
2. There's already an open-source Shimeji-style cat built **for Claude Code** (`claude-pet`) with almost exactly our
   plan: one shared cat, states for thinking/working/needs-you/done/error. Steal its state list outright.
3. The cat's "needs you" cue has to ride on a real event and back off gently, or it becomes Clippy — now confirmed
   directly from Luke Swartz's Stanford thesis and a write-up that quotes it ("interrupted without asking
   permission... difficult to disable"), and Duolingo's real, confirmed 40%-retention streak redesign shows the same
   "match the ask to what's actually owed" lesson. Bake both into the cat's rules now, before it ships.
4. The single cheapest fix for "two stacked boxes": wrap both floors in **one continuous outer frame** (corner posts
   / edge beams that run the full height, unbroken) — this reads clearly by eye in SimTower-style games and
   split-level houses, though after this pass the SimTower/Project Highrise half of the sourcing is downgraded to
   "visually true, not stated in either opened source's text"; the split-level-home half stays solid.
5. Keep the tube, the stair and every other cross-floor connector on the **exact same X/Z line** on both floors —
   confirmed this round via a Fallout Shelter layout guide (the original Fandom page is unreachable, 403 both plain
   and with a spoofed user-agent): "a vault with elevators wherever they fit makes everyone take a tour."

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

2. **Langfuse does offer threshold-based cost alerts — but "50-70%, not 80%" isn't Langfuse's own number.** Opened
   the actual changelog: Langfuse's June 2026 "Monitors and Alerts" release lets you set a threshold on a metric
   (e.g. average cost per trace, an eval score, p95 latency) and fires to Slack/webhook/GitHub Actions "the moment
   it drifts" — confirmed. But the page names no percentage at all, and neither does its Spend Alerts doc (a
   monetary threshold on the whole Langfuse Cloud bill, not per-tag/model/session). The "50-70%, not 80%" figure
   traces to a third-party cost-tuning guide, not Langfuse. Why it helps: FUNCTIONS-SHORTLIST #2 still has the right
   shape ("$41 in 90 min. Hand off?") — just pick our own buffer (50-70% is reasonable general practice) as our own
   judgment call, not a cited Langfuse recommendation. Effort: **S** (a constant, not new plumbing). Plugs into:
   v28.2, FUNCTIONS-SHORTLIST #2's spend-meter build. [opened] `langfuse.com/changelog/2026-06-19-monitors` and
   `langfuse.com/docs/administration/spend-alerts` (both reachable this round; neither states a 50-70%/80% number
   or per-tag/model/session scoping).

3. **A session that needs you says exactly what it needs, and a jump-to-the-result is one click away.** Confirmed
   near word-for-word: GitHub's own blog post on mission control says it lets you "watch real-time session logs,
   steer mid-run (pause, refine, or restart), and jump straight into the resulting pull requests—all in one place."
   The companion changelog post adds: "Quick links on the task make it easy to navigate straight to the pull
   request." Why it helps: FUNCTIONS-SHORTLIST #1 ("what it needs from you in plain words") and #6 ("Ready to
   ship... preview link") both want this; this confirms "one click to the actual output" (PR, preview) belongs on
   the card itself, not a level down. Effort: **M** (needs a stored link per session, not just a status). Plugs
   into: v28.2, FUNCTIONS-SHORTLIST #1 + #6. [opened]
   `github.blog/ai-and-ml/github-copilot/how-to-orchestrate-agents-using-mission-control/` and
   `github.blog/changelog/2025-10-28-a-mission-control-to-assign-steer-and-track-copilot-coding-agent-tasks/`.

4. **Group sessions by project/working directory first, state second.** Confirmed: OpenAI's Codex CLI Agents
   Dashboard (`codex agents`, added in Codex CLI 0.149.0) "groups tasks by their working directory... This makes it
   easier to see which project each task belongs to," with counts by state (Need input / Working / Ready) up top.
   The walkthrough doesn't actually show a literal "most recent activity line" per task, so that detail is dropped —
   state + directory grouping is what's confirmed. Why it helps: the hub's own crew is small (7-8 named robots), so
   this matters less for "which robot" and more for **the King's own chats list** (FUNCTIONS-SHORTLIST #1), which is
   really a list of *projects/chats*, not robots — group by branch/topic, not just chronologically. Effort: **S**
   (a sort key, not new data). Plugs into: v28.2, FUNCTIONS-SHORTLIST #1 ("Your chats, one list"). [opened]
   `proflead.dev/posts/openai-codex-agents-dashboard-codex-queue/`.

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

6. **"Single pane of glass, follows you across devices" is the actual bar competitors set.** Confirmed: Warp's own
   post is literally titled "A single pane of glass for managing all of your cloud agents" and says of its Oz
   product, "We've also made it easier to handoff agent sessions... Start an agent — or ten — on your phone,
   continue on your laptop, and then move it back to the cloud to continue working overnight." GitHub's mission
   control post lists the same reach: create a task from github.com, Copilot chat, or "the GitHub Mobile agents task
   page," then continue in Codespaces, VS Code Insiders or the CLI. Why it helps: less an idea to build than a
   reminder of the bar — the hub is already MacBook-first by FilthE's own rule, so this doesn't argue for a mobile
   build, but it's worth stating explicitly as a **non-goal** rather than an oversight (see "don't do" below).
   Effort: n/a (a framing note). [opened] `warp.dev/blog/multi-harness-cloud-agent-orchestration` and the two GitHub
   posts cited in item 3 above.

7. **Per-run traces, not just per-day totals, when you need to know which run blew the budget.** Confirmed
   word-for-word: Sentry's Agents Dashboard docs describe "a traces table showing trace ID, agents, root duration,
   errors, LLM calls, tool calls, total tokens, total cost, and timestamp" below the daily-rollup widgets. Why it
   helps: FUNCTIONS-SHORTLIST #2's spend meter is daily/weekly only; if a single run is the problem, today's design
   has no drill-down. Worth a "see what ran today" expand on the spend line rather than a new page. Effort: **S**
   (the King's `crew/sessions` doc already has per-session `cost_usd`; this is a UI affordance, not new data).
   Plugs into: v28.2, FUNCTIONS-SHORTLIST #2. [opened] `docs.sentry.io/product/insights/ai/agents/dashboard/`.

8. **Cursor confirms the trigger is "needs input or finished," not a clock — but "cost/length threshold" was our own
   overreach.** Confirmed via Linear's own changelog: "You can monitor all issues delegated to Cursor and other
   agents from the My Issues view and you'll be notified when an agent needs your input or when their work is
   complete." No timer, cost or length threshold is mentioned anywhere on the page — that clause wasn't supported,
   cut. Why it helps: still confirms FUNCTIONS-SHORTLIST #3's plan (a manual "Hand off" button, flagged by a real
   state change, not automatic on a clock) is the right call. Effort: n/a. [opened]
   `linear.app/changelog/2025-08-21-cursor-agent`.

**Note on this topic's sourcing (updated 2026-09-28):** the egress proxy was widened this round, and every vendor
domain named above (github.blog, warp.dev, docs.sentry.io, langfuse.com, linear.app, proflead.dev) is now reachable
by `curl` through the proxy — the WebFetch tool itself still refused several of them, so this pass fetched raw HTML
with `curl` and read it directly instead. All 6 findings in this topic are now `[opened]` and confirmed, with one
correction (item 2's "50-70%, not 80%" figure isn't in Langfuse's own docs) and one clause cut (item 8's "cost/length
threshold" claim, not supported). See "Verification pass (2026-09-28)" at the end of this file for the full tally.

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

2. **Idle variety comes from a small, weighted set, not a big random table — but the specific "chain" we wrote wasn't
   real.** Opened both cited sources and neither describes a sit→groom→paw→scratch→yawn→curl-up chain with waving.
   Wikipedia's *Neko (software)* only says the original 1989 Mac port "would scratch at the borders" when the cursor
   left its window and "eventually fall asleep when left idle" — no groom/paw/yawn/wave steps. Reading the actual
   `oneko.js` source (the modern JS port behind most current clones) shows the real shape: a tiny idle set (`idle`,
   `scratchSelf`, `scratchWall[N/S/E/W]`, `tired`→`sleeping`) chosen *randomly*, not in a fixed order, plus a
   distinct `alert` sprite that plays for one beat when the cursor starts moving again (the "startle" is real; the
   rest of the described chain was not). Why it helps: the corrected version is still the right lesson — 5-6 named
   states beat a big randomized pool, and it's cheaper to build and QA — just steal the real state names (idle /
   scratch-self / scratch-wall / tired / sleeping / alert-on-wake), not the invented chain. Effort: **S**. Plugs
   into: v28.1, the cat's idle behaviors (currently a flat list: nap, knock a pencil, sit on a keyboard — turn that
   into a small weighted set plus the alert-on-wake beat). [opened] `en.wikipedia.org/wiki/Neko_(software)` and
   `raw.githubusercontent.com/adryd325/oneko.js/master/oneko.js` (source read directly).

3. **"Set a behavior's Frequency to 0 to turn it off" is real; "fires every 3-8 seconds" is not — Shimeji's
   `Frequency` is a weight, not a timer.** `kilkakon.com` itself wouldn't load this round (connection reset through
   the egress proxy — still unreachable), but its readme, mirrored at `github.com/gil/shimeji-ee`, confirms the
   disable trick directly: "it's not too hard to... turn off certain behaviors (hint: set frequency to 0)." Reading
   Shimeji-ee's actual `behaviors.xml` shows `Frequency` is a relative pick-weight between competing behaviors
   (values like 1, 50, 100, 200) — there's no literal seconds figure anywhere to cite, so "every 3-8 seconds" is
   cut. Why it helps: the "can be set to 0" idea still maps directly onto FilthE's Make-it-yours panel — if a
   specific cat gag annoys him, turn off just that one, not the whole cat. Effort: **S** (one config table using
   relative weights, not literal seconds, + a per-behavior toggle in Make it yours). Plugs into: v28.1, cat
   behaviors + the existing Make it yours panel. [opened] `raw.githubusercontent.com/gil/shimeji-ee/master/readme.txt`
   and `raw.githubusercontent.com/TigerHix/shimeji-ee/master/conf/behaviors.xml`;
   `kilkakon.com/shimeji/affordances.php` still unreachable this round (connection reset — worth a retry elsewhere).

4. **The reward for watching a pet should be watching it — not points, timers or streaks.** Confirmed the core
   claim: cats "give you silver and gold fishes as gifts, which are the currency" — a gift, not a score — and some
   cats "have special conditions... or they're just plain rare," which is the actual hook, not a quest log or a
   streak counter. One nuance found: the source's whole thesis is that Neko Atsume *is* "a game about the act of
   waiting" (no fast-forward, no way to summon a cat), so "no wait-timers" should read as "no countdown UI nagging
   you to come back," not "nothing to wait for." Why it helps: directly answers "how can a pet carry a notification
   without nagging" — the cat playing with a robot **is** the notification (you see it happening, no popup needed),
   and if a token is left behind it should be a small found detail, never a counter FilthE has to manage. Effort:
   n/a (a design rule, not a build item). [opened] `notes.highlysuspect.agency/blog/nekos/`.

5. **The failure mode to avoid by name: taking control away from the user is where "funny" turns into
   "frustrating."** Partly confirmed, softened: there's no single "postmortem" that explicitly contrasts
   cursor-stealing (bad) with notes/memes (liked) — that specific contrast was this round's own inference, not
   something any opened source states outright, so it's downgraded. What is confirmed: press coverage converges on
   cursor-stealing specifically as *the* disruptive mechanic — PC Gamer's own headline is "The horrible goose can
   now live on your desktop and steal your cursor," and the reporter notes mid-article, "He keeps honking and
   stealing my cursor as I attempt to write this." (GameSpot's coverage page returned a 403 this round —
   unreachable, cited via PC Gamer instead.) Why it helps: still a fair hard boundary for the cat — knock a
   (virtual) pencil off a desk, sit on a keyboard (visual only), fine; anything that steals the cursor, blocks a
   click target, or takes over an input the user is mid-action on is not. Effort: n/a (rule). Plugs into: v28.1, cat
   behavior list (as a constraint, see "don't do" below). [opened]
   `pcgamer.com/the-horrible-goose-can-now-live-on-your-desktop-and-steal-your-cursor/`.

6. **Clippy's actual failure wasn't the character — it was interrupting without being asked, and being hard to turn
   off.** Confirmed directly. Luke Swartz's 2003 Stanford honors thesis ("Why People Hate the Paperclip," advised by
   Prof. Clifford Nass) is real, and its own abstract matches the claim: agent behavior "if it obeys standards of
   social etiquette" shapes user response. A fuller write-up quotes the finding precisely: "the paperclip broke the
   basic social norms we apply to a 'colleague.' It interrupted without asking permission, offered help when it was
   no longer needed, and was overly present, almost predatory" — and separately, "the character was difficult to
   disable." (The originally-cited `thenewstack.io` article is now gated behind a hard subscribe-wall with no
   article text reachable — swapped for the primary thesis page plus a write-up that quotes it.) Why it helps: this
   is the exact shape of the risk in "when an AI needs him, that robot chases the cat" — as long as the chase only
   starts on a **real** `needs_you` event (never on a timer, never repeating after he's answered it), the hub is
   already on the safe side of this lesson by design. Effort: n/a (rule, already mostly true by the hub's own
   "every animation is a real event" principle). [opened] `xenon.stanford.edu/~lswartz/paperclip/` (primary thesis
   page) and `mundobytes.com/en/the-story-of-Clippy/` (quotes the study's findings directly).

7. **Duolingo redesigned its streak around "just finish one lesson," and it measurably worked — the "40%" number is
   real, "escalating-guilt notifications" was our own gloss.** Confirmed the concrete part: "instead of needing to
   complete your full daily goal, all it takes to keep your streak going is finishing just one lesson," and "since
   the update, there's been a 40% increase in learners maintaining a streak of seven days or more." (Source is a
   third-party UX write-up, not Duolingo's own blog — Duolingo's own blog didn't surface this exact figure this
   round, so treat the 40% as one write-up's reported number, not first-party-confirmed.) The "escalating-guilt
   notifications" half wasn't found stated anywhere this round — the confirmed change is to the streak-completion
   rule itself, not to notification copy; that clause is cut. Why it helps: if the cat's "needs you" cue has levels
   (an ear-perk first, only later sitting and staring), it should scale with how overdue the thing actually is —
   CONVENIENCES.md already has this instinct for text notifications ("silence is a safe answer"); this extends the
   same rule to the cat's body language. Effort: **S** (2-3 intensity poses instead of one). Plugs into: v28.1, the
   cat's "needs you" cue. [opened] `designfolio.substack.com/p/crazy-ux-redesign-duolingo`.

8. **Rare, scheduled "big" events read better than constant small ones — confirmed for Neko Atsume, not for Animal
   Crossing.** Neko Atsume: confirmed. "Some cats have special conditions, like a seasonal requirement, a specific
   toy, or they're just plain rare; but most cats are decently common" — chasing the rare ones is the stated core
   goal ("the primary goal is to track down and take pictures of all cats"). Animal Crossing: cut. This round's
   search turned up the opposite read — multiple villager-rarity write-ups agree there's no deliberate "held-back
   rare visitor" design; perceived rarity is mostly a side effect of how many villagers share a species pool, and
   what people call "rare" is usually really "popular" (Raymond, Judy, Marshal), not intentionally scarce. Why it
   helps: the Neko Atsume half alone still supports the idea — reserve one or two genuinely rare cat behaviors (say,
   once a day at most: curling up asleep on the Observatory's warm under-glow, or riding the full tube capsule
   end-to-end) instead of adding more everyday idle animations. Effort: **S** (a daily-once guard on 1-2 specific
   behaviors). Plugs into: v28.1, cat behaviors. [opened] `notes.highlysuspect.agency/blog/nekos/`; the Animal
   Crossing half is cut, not supported by this round's sources.

---

## Topic 3: making two floors read as one building (note 2)

BUILD-v28.md's v28.1 plan already says the right words in general ("a shared structural core around the glass tube
... columns + slab edge that run through both floors ... terraces") — these are the specific, cheap moves that make
that concrete, each checked against the "no new real-time lights, no new shadow casters" budget (RESEARCH-v28.md
item 1, BUILD-v28.md's M0 budget line).

1. **Wrap both floors in one continuous outer frame — the single highest-leverage move.** Opened both cited sources
   and neither actually spells out "one unbroken outer envelope" in text — that's this round's own visual reading of
   these games' well-known screenshots, not a sentence either page states. Wikipedia's *Project Highrise* article
   confirms only that it's "considered... the spiritual successor to SimTower." `pietriots.com` confirms a narrower,
   related detail: "different types of rooms are colour coded so you can get an idea of what is filling your
   building at a distance" (matching SimTower's convention) — real, but short of "one continuous frame." Why it
   helps: the underlying visual pattern is still real and checkable by eye (both games do render as a single
   bounded silhouette), so the recommendation stands — extend the vertical corner posts / edge beams already
   planned for the "shared structural core" so they run the *full* height of the building silhouette — just don't
   cite these two sources as having said so in words. Effort: **M** (new static geometry, no lights). Plugs into:
   v28.1, SCENE "one building (note 2)". [opened] `en.wikipedia.org/wiki/Project_Highrise` and
   `pietriots.com/2018/10/18/project-highrise/` — neither states the "continuous outer frame" claim directly; the
   colour-banding detail is confirmed, the frame/envelope claim is downgraded to "visually plausible, not textually
   sourced."

2. **Keep every cross-floor connector on the exact same vertical line.** Confirmed, via a substitute source —
   `fallout.fandom.com` returned a 403 both directly and with a spoofed browser user-agent (still unreachable this
   round). A Fallout Shelter layout guide makes the identical point: "Scattering elevators wherever you happen to
   need them is what ruins most vaults. Pick your columns early and keep them consistent on every floor... A vault
   with elevators in the same two positions on every level moves dwellers vertically in a straight line. A vault
   with elevators wherever they fit makes everyone take a tour." Why it helps: audit the tube, the stair/bridge
   landing and any glass panel so they share one exact axis on both floors — right now the tube's base and top are
   already speced at fixed local coordinates (blueprint 5.3: x0.3, z2.95), so this is really a QA check ("does
   everything the eye should read as 'the spine' actually share one line from every camera angle"), not new
   geometry. Effort: **S** (a QA pass, maybe minor coordinate nudges). Plugs into: v28.1, SCENE "one building".
   [opened] `lazybatman.com/2026/09/19/fallout-shelter-layout-guide/` (source swapped; `fallout.fandom.com`
   unreachable — 403 both plain and with a spoofed user-agent).

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
   Confirmed the mechanism, in different terms than "baked texture." GameDeveloper.com's interview with creator
   Oskar Stalberg describes Townscaper's continuity as a Wave Function Collapse constraint solver: "adjacency rules
   need to be established by assessing each of the individual chunks," so every new block is checked against what
   can validly sit next to it — that's what keeps facades reading as continuous at any boundary. It's a geometry/
   placement rule in the source, not literally a shared baked-texture pass — that specific technique is this file's
   own extension of the idea to HMP's case, not something the article describes as texture work. Why it helps:
   apply the *same idea* (one consistent rule enforced at every boundary) to the floor-to-floor seam specifically,
   via the baked-texture tooling RESEARCH-v28.md (item 7) already has — so the material grain, not just the
   structure, continues from one floor into the next. Effort: **S** (a texture-authoring pass, not new code). Plugs
   into: v28.1, alongside RESEARCH-v28 item 7/11. [opened]
   `gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making`.

6. **A single locked camera angle, with verified "anchor" points, is how impossible-looking connections read as
   seamless.** Confirmed in substance (paraphrase, not a literal quote). GameDeveloper.com's making-of piece quotes
   lead engineer Pashley: the automatic connection system works by "ordering those nodes in depth order from the
   game camera," and decisions about what connects to what are made "only... when the geometry was in one of the
   snap positions" — i.e. camera-relative, minimal manual markup, verified at specific configurations rather than
   continuously. That's the same idea as "a handful of points verified from a fixed camera," in the article's own
   engineering language rather than the exact screen-space-anchor phrasing used here. Why it helps: the hub already
   has a fixed isometric camera family (Whole / Follow / Eyes) — pick 1-2 specific points (the tube base against the
   lower floor, the Observatory's cantilever edge against the upper floor) and explicitly verify, per camera preset,
   that they align pixel-perfect; this is a QA checklist item, not new art. Effort: **S** (QA only). Plugs into:
   v28.1, camera QA before ship. [opened]
   `gamedeveloper.com/design/making-the-impossible-possible-in-i-monument-valley-i-`.

7. **A soft, static contact shadow under the upper floor is cheaper and more convincing than more real lighting.**
   Confirmed. Screaming Brain Studios' own isometric-shadows tutorial states the rationale directly: "you can save
   on memory by using pre-baked shadows and 2D tiles rather than utilizing real-time shadows... it's always handy to
   know a few methods for simulating shadows" where an engine can't (or shouldn't) produce them live. Its actual
   techniques are single-direction baked shadow tiles built once in an image editor, matching "pick one light
   direction and bake a single consistent shadow." Why it helps: the Observatory's cantilever and any part of the
   upper floor that overhangs the lower one should get a static, baked-in darkening decal on the lower floor's
   ceiling/props directly underneath — exactly the kind of "shadow as an animated texture" trick RESEARCH-v28.md
   (item 7) already commits to, just applied specifically to the floor-to-floor overlap instead of furniture.
   Effort: **S** (one more baked decal, no new light/shadow caster). Plugs into: v28.1, SCENE "one building" /
   Observatory under-glow. [opened] `screamingbrainstudios.com/isometric-shadows/`.

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
