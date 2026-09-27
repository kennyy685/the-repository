# HailHunter: storm lead engine for HMP Siding & Roofing LLC (Fremont, NE)

**Before any work here, read `~/2026/CLAUDE.md`, `~/2026/BOARD.md` and `~/2026/hailhunter-status.md` (Cowork's notes;
it replaced `cowork-to-code.md`)**: this folder shares a task board and rules with Cowork (a second AI, in the cloud).
Update your rows on the board and add a dated entry to `~/2026/hailhunter-status.md` before you stop.
**Cloud sessions (no `~/2026`):** the AI hub's `board/current` is the board (skill `crew-checkin`); skip the status file.

**Reference (load on demand):** skill `hailhunter-reference` = code layout, every `hh.py` command, scoring, the cloud
bundle, the HMP HQ snapshot fields and the claims schema. Engine edits: skill `engine-change`.

## Who and why
- **Owner/operator:** FilthE, the boss's bilingual (Spanish/English) right-hand man at HMP Siding &
  Roofing LLC, Fremont, Nebraska (residential and commercial, siding + roofing).
- **Goal:** win insurance/storm-restoration jobs, direct-to-homeowner. Find hail/wind-hit homes and
  buildings, knock and call, inspect, file claims with the homeowner, meet the adjuster, build the
  job, get paid.
- **What "done" means:** the goal is crews working jobs the system found, not a finished app.
  Measure progress in leads, inspections, claims and jobs.
- **How we work together:** suggest ideas and references; check in with FilthE before decisions
  you're unsure of (money, legal, anything customer-facing, deleting data); explain things in plain
  English, short - he has ADHD, keep it skimmable.

## Current orders (FilthE, 2026-09-25)
- **Build orders O1-O6:** `docs/orders/build-orders.md` + the hub board (T51-T60, T35); work them in order. The price
  sheet (T51) comes from FilthE and the boss. (Its "Crew HQ becomes the HMP App, same link" plan is **superseded** by
  the App / AI hub split below; current plan: `docs/orders/roadmap.md`.) The app chat is the one inbox that logs leads,
  doors and claims.
- **Top priority inside the app: O0 "Today's knock"**: one area a day, houses only in walking order, one tap per door
  (Not home / No / Interested / Booked). FilthE finds the command center too messy to use for this.
- **Where to knock = the engine's hottest zones** (via Today's knock / hot zones). Don't push "knock around The Edge /
  job-site neighbors" as the plan (the neighbor note is an optional extra).
- **Long-term:** he may sell the HMP App to other roofers someday, so build it clean enough to become a product
  (research round 4). **Ownership: FilthE owns the app** (the software); HMP is its first user.

## Workarounds for now (FilthE, 2026-09-26) - don't keep asking
- Prices (T51): the quick quote uses `prices_reference` market ranges, labeled "estimate range, not final", until the
  boss's prices arrive; then it switches automatically.
- Registration # (T64): print pieces keep a blank line to write it in by hand.
- Contract lawyer review: deferred. The draft (with the 3-day cancel notice + deductible notice) is the one to use,
  whole, never a handshake; the lawyer's OK comes later.

## The app's job (FilthE, 2026-09-26): the salesman's right hand
"The app should be the salesman's right hand: it guides him through the sale and assists through it, leading, guiding,
asking for info and telling him what to ask for. Like a construction worker's hammer." So every screen answers: **where
am I in the sale, what do I say/ask now, what do I collect, what's legally required, what's next.** A plain, fast tool
used all day, not a dashboard. Plan: `docs/orders/o7-sale-guide.md`.
**Standard:** keep researching and upgrading, using the best apps as references. "Works" isn't the bar: build what
reliably improves the salesman and the business.

## The core flow (FilthE, 2026-09-26) - build everything around this
"I open my phone: a Google-like map of hot zones near me. I drive to that neighborhood, open the app, and the AI tells me
which doors to knock (the houses most likely insured), in order. I just knock and use the app." So: Now = map of hot
zones (`zones/current`) -> Drive -> Start knocking = that zone's ranked walk (`walks/<zone>`) with a one-line why per
door. Insurance per house isn't public: "likely insured" = owner-occupied + residential + mortgage/recent sale proxies
(round 16).

## App / AI hub split (FilthE, 2026-09-26) - done
- **HMP App** = https://claude.ai/artifact/9N97Uzv8J9EAueSKhCNSPT (source `pages/hmp-app.html`), its own database
  (`leads`, `doors`, `claims`, `stats`, `handoffs`, `today/walk`, `calls/today`, ...). Salesman's tool + the chat that logs
  doors, leads and claims; no AI office.
- **AI hub** (old Crew HQ link) = https://claude.ai/artifact/Qkc52bt2JL5gW7ZKWBJDHU (source `pages/crew-hq.html`): board,
  crew, orders, "waiting on you".
- **No mixing:** no hub links, tasks or questions inside the app (the app does NOT get `hub/summary`), and no app links
  in the hub. The app chat passes crew requests silently via the app's `handoffs` collection.
- **Instant wake (approved):** app handoffs and hub answers/orders call the King trigger (`fire_trigger`, Claude Code
  Remote connector) so Claude Code acts in seconds; the hourly run is the backup.

## Answered 2026-09-26 (don't re-ask)
- App icon: **A** (bold HMP under the orange roof) = `docs/brand/app-icon.svg`.
- Twilio phone-call storm alerts (D6): **No for now**; push + email alerts stay.
- Capabilities sheet keeps "Labor sub: you supply the materials, we install".
- Homeowner screen: **Option B "Daylight report"** (docs/design/homeowner-screen/option-b.html). Good/Better/Best tiers:
  **pick per job** (siding only, roof only, or both).
- **Verified against the statutes (nebraskalegislature.gov):** 44-8607's deductible notice has 5 sentences (the
  contract drafts were missing the last 3; fixed, exact text now). 69-1601: the 3-day right applies even when the
  homeowner invited HMP (only narrow emergency/repair exceptions), so give the cancel form every time. 69-1604(3): HMP
  sells in Spanish, so the notice must be given in English AND Spanish. 69-1602: at the door, say your name, HMP, and
  what you sell, first thing.
- HMP business mailing address (D13): **2600 Laverna St, Apt 50, Fremont, NE 68025** (printed on the cancel notice).
- PR #5 merged to main (FilthE's OK); Cowork re-bundles (T61).
- **No field data for now:** he isn't knocking yet; tune coaching, goals and follow-ups with internet industry
  benchmarks (`data/benchmarks.json`, round 15) until real numbers come in. Don't wait on or ask for his door results.
- **App theme: A "Ledger"** (docs/design/references/direction-a.html): light, clean, orange accent (#f5883a); B's big
  door counter on Knock. *History: this replaced "HMP Pro Dark" (charcoal + silver/white, Barlow Semi Condensed +
  Montserrat), ordered earlier the same day.* Print pieces keep the charcoal/orange brand look.
- **Product name: "Aldaba"** (the iron door knocker; FilthE's pick 2026-09-27; docs/design/product-brand/aldaba/). It's the
  app's brand when sold to other roofers; HMP stays the first customer and its own brand. Before public use: USPTO
  trademark search + a lawyer, and check the .com/.app names.
- Community flyer: **use both** A "Letrero" (color, boards/Chamber) and B "Boletín" (church bulletins, B&W copies) (docs/print/community-flyer/).
- PR #6 merged to main (FilthE's OK, 2026-09-26); Cowork re-bundles.
- Referral thank-you (D17): **a handwritten thank-you note only**, no gift cards or money.
- App layout (T75): **Option B "Next step"** (docs/design/app-layout/option-b.html): tabs Now / Knock / + / Leads /
  Money; home = the Sale Guide card for what to do next; + = add lead / quick price / "help me say it"; ES toggle on
  every script line; C's big door buttons on Knock. No Crew tab in the app (the crew lives in the AI hub as a clean
  team board: a card per AI with role, status dot, now doing, last result).

## How we ship (FilthE, 2026-09-27: "it has to look like a finished product")
Every page publish follows `docs/release-checklist.md`: all checks green, the King looks at light + dark screenshots against
the approved mockups (`docs/design/v25-polish/`), legal boxes ticked, then `docs/CHANGELOG.md` gets a line.
Helpers commit only their own files (`git add <paths>`, never `-A`).

## Chain of command (FilthE, 2026-09-26)
- **Claude Code (the cloud session) is the King / lead**: sets priorities on the hub board, gives the orders, runs the
  Code lab helpers, and acts on the hub + app every hour (7 AM-10 PM Central) or instantly on a wake.
- **The Right Hand** (the old King) answers FilthE live in the app chat ("Talk to your Right Hand", the page's `sample`
  model), logs what he says (leads, doors, claims), and passes his words to Claude Code as handoffs (`to: "code"`). It
  takes orders from Claude Code and doesn't reassign Code-lab work.
- **Scheduled jobs (FilthE, 2026-09-27, to save usage):** one King trigger `trig_01MNxMWzvD3ZgRqWxfjtJLEU`, a FRESH
  session 3x a day (7:52 AM, 12:52 PM, 5:52 PM Central): morning = app data (`hh.py daily`), follow-ups, HMP HQ, brief
  (+ Monday scorecard); midday = check only; evening = wrap. The hub's instant wake fires the same trigger. Paused, not
  deleted (they fired into one giant session and burned usage): hourly `trig_012h6pQqggc88n8vsj93zayJ`, 7:40 AM
  `trig_01V4ijQRdxkFTiR8FuHsPDvE`, Monday `trig_01DUjrKndHBN6rQAa1fDpueG`; old Mac routines
  `trig_01NKMVTpCBNnHwSC1hdZBHwM`, `trig_011XswCar2enDNHr1B5N16pi`. Never bind a recurring trigger to a long session.
- **Cowork** still owns the command center and Storm Watch.

## Start here: what every new session should already know
This file is the shared memory. Claude sessions don't share chat history (claude.ai chats, Cowork and Claude Code each
start blank), so **when FilthE tells you something important, add it here** instead of making him repeat it.

**The company (FilthE's company brief, 2026-09-25)**
- Early-stage but working: HMP mostly **subcontracts labor** today (the hiring contractor supplies materials).
  Contractors that hire HMP include **VTR Contracting** and **Nastase Contracting**. Nastase (Omaha, family-owned since
  1977, roofing/siding/gutters, residential + commercial) already does storm-damage and insurance-claim work: the
  natural partner for the "sub for restoration" path. VTR: no public web presence found (2026-09-25); ask FilthE for
  city/full name. Services: siding (incl. James Hardie lap), flashing, soffit, fascia, remodeling, roofing, gutters (FilthE confirmed 2026-09-26), on houses
  and apartment complexes.
- **Several crews of 2-3 people**, adding another. Current main job: **The Edge Apartments** (5 buildings: tear-off
  above the concrete, new flashing/tape/1x4 furring, gray lap siding, wood-look accents, caulk). Its live job board and
  a general job tracker were built in other Claude chats.
- **Brand (logo shared 2026-09-25):** chrome "H.M.P" letters under an orange roof-line chevron, an orange underline,
  "SIDING & ROOFING LLC", "RESIDENCIAL y COMERCIAL", on dark charcoal metal siding. Colors: charcoal ~#404145, orange
  ~#f5883a, silver/white. Company phone on the logo: 402-889-3385. Use this look on everything printed; the photo
  lives in the Mac/claude.ai chat, not the repo (recreate it as SVG when needed).
- **Print contacts:** English side = Kenny Cruz, cell 402-936-2709. Spanish side = **Alex Mendez**, business line
  402-889-3385.
- **The boss** owns and runs it and speaks Spanish. **FilthE** (Kenny Cruz; phone for printed materials 402-936-2709;
  contractor registration # pending from the boss) is his right-hand man: translates, runs the AI/organization side,
  is the only one building this system, and does all the insurance sales.
- **Not storm-only:** storms are one lead source, not the only one. HMP also sells regular (non-insurance) siding and
  roofing to **old houses** with worn siding or roofs. Lead tools, door lists and print pieces need an everyday version
  too (house age / year built, not just hail).
- **New goal: insurance restoration** (hail, wind, fallen trees): selling direct to homeowners, buying materials,
  adjusters, waiting on insurance checks.

**How FilthE works (matters for anything you build)**
- Talks or sends short messages and job-site photos with short labels. **Never make him type into spreadsheets**: you
  read, log and manage the data.
- Build foundations that work for every job type; nothing rebuilt per job.
- **Spanish matters** for anything the boss uses. Long term: HMP's own app with AI; for now, Claude.
- New to AI and git: give click-by-click steps; simple tools he'll use beat clever ones to maintain. Limited Claude
  credit: short focused sessions, no features that don't help sell.

**Lead tool v1 (his spec) vs. what exists**
1. Storm finder (area + dates -> storms): built (engine + command center map; hot zones for the app).
2. Ranked lead list (storm severity, roof/home age, owner-occupied): built as door lists, zones and walks (door score
   v2). Gaps: owner-occupied is per neighborhood, not per house (T23); roof age needs permit data, which no nearby
   city publishes as data.
3. Lead tracker with the 9 stages (Not contacted -> ... -> Done/Lost): **in the HMP App** (`leads` collection, Leads
   tab). The command center's `turfs/targets/calls` are the old storm-list tracking. Photos per lead not yet.
4. **Voice/short-message updates** ("123 Oak St, inspection Tuesday, hail on north slope"): short text messages are
   built (the app chat logs doors, leads and claims, O2). **Voice logging is planned**: the Voice Test page exists
   (`pages/voice-test.html`, https://claude.ai/artifact/9u7eck3TvFyj7AzvmtVL7m). Mac desktop results: keyboard mic and
   read-aloud work, in-page speech recognition/recording blocked; iPhone not tested yet.
5. Later: inspection damage-photo checklist; link a won lead into the job tracker.

**Answered already (don't re-ask):** Fremont, NE base; storms scanned within 250 mi, door lists within ~120 mi. Direct
to homeowner (cowork notes). Free public data only so far; ads parked; no mailers; door knocking + calling business
lines, no cold texts. Bilingual: yes. FilthE has his door-to-door permits. Registered and insured for roofing work:
yes (2026-09-25). Path: **both** - direct to homeowners AND subbing for insurance restoration companies.
**Still unknown (ask once, then record here):** max travel distance for crews; any budget for paid hail maps.

## The live system
- **HMP App** (salesman's tool, leads/doors/claims): https://claude.ai/artifact/9N97Uzv8J9EAueSKhCNSPT
- **AI hub** (board + the King's orders): https://claude.ai/artifact/Qkc52bt2JL5gW7ZKWBJDHU. `board/current` is the
  SOURCE OF TRUTH for tasks (BOARD.md only mirrors it); `system/king`; FilthE's button answers land in `answers` (+ an
  event to the King): act on them, then drop them from `board.waiting`; `system/memory` {facts[]} is the short
  shared-memory panel; `events` = check-ins and handoffs. How to post: skill `crew-checkin`. The hub chat is "Tell the
  Right Hand" (live replies are events `...-king-live`, orders `...-king-o<n>`; the scheduled King treats them as its
  own decisions); it refuses logging: doors, leads, claims and money go in the HMP App chat.
- **HMP HQ** (business dashboard, EN/ES): https://claude.ai/artifact/HhK5UGhHG3VpNR7HuaqEpj - shows only `hq/snapshot`,
  rebuilt at the 8 AM standup and 6 PM wrap (skill `refresh-hmp-hq`).
- **Command center (HUD, Cowork owns):** https://claude.ai/artifact/6cCATKJSoyWA7kbH4Em8VX - reads published
  `data/hud.json` from the `engine/engine.json` bundle. Never delete or overwrite crew results in its db.
- **Storm Watch:** Cowork's scheduled task, daily 6:54 AM Central: unpacks the engine bundle, runs `refresh` + `diff`,
  republishes hud.json, logs an alert, sends FilthE a push + email. Then the King's
  7:52 AM run writes the app's `today/walk`, `calls/today` and hot zones; Mondays add the week scorecard.
- **Edge Site Map** (job board db `buildings`): https://claude.ai/artifact/6wBLswpVCaBMoc6dbrKcyn
- **Practice Door:** https://claude.ai/artifact/PFKkgWCMshKnE2nWFssM7B - AI homeowner role-play (EN/ES) + scorecard with
  legal flags; uses FilthE's Claude usage.
- **Claim Tracker** (CoMGoPQWcM5ZyHGoMAYqSG): retired, claims moved into the HMP App (`claims`).
- **Print kit (`docs/print/`, html + pdf, all final):** door hangers (storm + everyday), pocket card (B), contract drafts
  EN/ES, cancel notice, estimate sheet + packet, inspection checklist + report, hail report, claims-101,
  adjuster-meeting (replaced adjuster-checklist), wind-playbook, supplement-checklist, first-knock-day, walk sheet, neighbor note, yard sign, business card, capabilities sheet, completion certificate,
  and more.
- **This repo** is the base codebase: changes are made here and bundled out to the cloud (Cowork re-bundles, T61),
  per the shared desk's ownership rules in `~/2026/CLAUDE.md`.

## Hard rules (legal and ethical) - see also `~/2026/CLAUDE.md`
- **Nebraska 44-8604:** never offer, advertise or imply covering, waiving or rebating an insurance deductible, and
  never pay homeowners for claims.
- Never promise insurance will pay. Don't negotiate claims on the homeowner's behalf or advertise that we do - that's
  public-adjuster work and needs a license. We meet the adjuster and document damage.
- **Contacts:** business phone numbers only for commercial (leasing offices, property managers, company lines) - no
  personal cells/emails/home addresses. Owner names only for apartment/commercial properties, never homes.
- **No work before the 3-day cancel window ends on a regular (non-insurance) home solicitation sale:** under 69-1606(5)
  HMP gets nothing for work done before a buyer cancels. Only insurance emergency work (e.g. tarping) under a signed
  44-8603 approval is different. Verified from the statute text (docs/legal/, round 37).
- **Insurance jobs (44-8606, verified):** before starting repair work, give BOTH the homeowner and the insurer an
  itemized description (work, materials, labor, fees, total). Never take an assignment of benefits / be named on the
  check without 44-8605's notice and filing (HMP doesn't do this today).
- No buying phone lists for cold calls or texts (TCPA/DNC risk). Door knocking and calling business lines are fine.
  No mailers (FilthE, 2026-09-25 - D1 on the board).

## Crew (Claude Code's helpers, `.claude/`)
A few main roles (FilthE, 2026-09-25); one-off helpers work under them and get no robot of their own in the hub. Keep
the crew small: add a helper only for work that repeats.
- Agents (`.claude/agents/`): `engine-mechanic` (engine code), `builder` (Claude pages: HMP App, AI hub, HMP HQ,
  Practice Door), `designer` (print pieces, brand look, page design; 2-3 options for FilthE to pick), `hub-keeper` =
  the **Research Lead** (id kept for hub history; cheaper model) with its `improvement-scout`s (one web topic each, run
  in parallel), `qa-tester` (reviews + tests before anything ships; cheaper model).
- Skills (`.claude/skills/`): `hailhunter-reference`, `engine-change`, `crew-checkin`, `refresh-hmp-hq`,
  `improvement-research`, `/storm-report`, `/door-list DAY TOWN`, `/call-list N`.
- **Cost rule (FilthE, 2026-09-27):** every helper runs its own requests, so pick the cheapest model that can do the job
  and keep prompts tight (point to files, don't paste them; ask for short reports). Scouts = haiku (one web topic); Research
  Lead + QA = sonnet; routine chores (HMP HQ refresh, board posting, data seeding, small doc edits) = haiku via the Agent
  `model` override, or the King does them directly; builder/designer/engine-mechanic = the main model only for real app,
  design or engine work. **Run 1 helper at a time (2 max)**, even if asked to "keep everyone busy" (7 at once burned his
  whole usage in under an hour, 2026-09-27). Helpers grep the 8,400-line app file, never read it whole; screenshots only
  for the final pre-publish review; start a new chat per job instead of one endless session.
- **Research:** FilthE wants regular rounds (he worries about missing areas or focusing on the wrong things); they go
  to `docs/research/` and show in the hub's Code lab. Round 1: knocking, not software, is the bottleneck. Round 2:
  FilthE hasn't knocked a door or run a claim yet and will learn; foundation first (D11: no build freeze), so build
  tools that also teach him sales and claims.
