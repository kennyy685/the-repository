# King handoff (read this first, fresh King)

Written by SMUIPO 2026-09-28 ~12:15 UTC from session_01Dm6yRbGAvrPXcttc8q3p33 (hit ~190k tokens). Work branch
`claude/amazing-gauss-yzfpq0`. CLAUDE.md has all standing orders (new today: King is LIVE on the hub, every AI hands
itself off when heavy, FilthE's app reset in docs/memory/full-context.md last section).

## FIRST, as the new King (in this order)
1. Make your own hub wake line: `create_trigger` (name "Hub -> live King (instant, no schedule)", no cron, no
   persistent_session_id = binds to YOU, initiation own_followup, prompt "AI hub message from FilthE (live King wake).
   Read the hub text appended below, act on it, reply to him on the hub, flush check-ins.").
2. Write its id to hub doc `system/king` field `wake_trigger` (ArtifactData get, then update with if_version). The hub
   reads it on every wake. Update CLAUDE.md's trigger id line. Disable (don't delete) the old one
   `trig_01LNd9FCen5TUumzGCPvinAb` once yours is in `system/king`.
3. Archive the old King session_01Dm6yRbGAvrPXcttc8q3p33 once its 2 helpers are done (check the files below exist
   on the branch; if both are there, archive it).
4. Reply to FilthE on the hub (events, agent "king") that you're the new King.

## Live now
- HMP App v25.3 (artifact v11). AI hub v26 (Chat wakes the live King). 3x-daily King trigger PAUSED.
- NOT published: Practice Door v11 (QA SHIP + Day 20 fix 1112eff) and Print Kit fix (4d7d713). Need FilthE's word.

## FilthE's reset (most important)
He said the app feels pointless and confusing, looks flat ("HTML stuff", not alive), and he doesn't know how to lead
us. He wants: (1) an OPEN MAP of every area with a high chance of something to sell; HE picks, we never pick for
him; (2) the SOURCE of every fact shown (did hail fall, size, date, which source, confidence); (3) leads the second
they're out (all public signals, not just our scoring). Insurance claims are private: be honest, use legal proxies.
He needs guidance: consult other AIs, bring ONE conclusion + something to look at, build one screen at a time.
**App building is PAUSED until he agrees on the direction.**

## Running when I left (their results land as files)
1. Research Lead round 61 -> `docs/research/2026-09-28-round-61-lead-areas.md` (top tools, public lead signals
   ranked by speed, insurance-claims answer, recommended core screen + top 5 data layers).
2. Designer -> `docs/design/open-map/index.html` + `shot.png` (map-first "where to work" mockup, alive Aldaba look,
   sources on every number, EN/ES, sample data).
When both exist: read the research summary (grep the recommendation), look at the mockup, then give FilthE ONE
direction in plain words + publish the mockup as a private artifact for him to click (Artifact tool; the mockup is
ours). Ask him yes/no/more-like-this. Then build one screen at a time.

## Other sessions
- "Hub office handoff continuation" (session_01M33ssCLDWhuj7KBYtEqtW7, branch claude/amazing-wright-lds9q5) is
  working on hub v27.1. I posted a hub note: merge our branch first so it doesn't publish over the live-King wake.
  Check it; when done, merge its branch (and claude/funny-hawking-2rytou, 11 commits) into ours.
- Permit-calls session (session_01QEYZAMyqfC3VcASSqJS3mx) waits on FilthE's Omaha/Lincoln calls (T202).

## Waiting on FilthE / boss (don't nag)
T202 permit calls, T71, T51 price sheet, T64 registration #, D27.
