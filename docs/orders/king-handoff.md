# King handoff (read this first, fresh King)

Written by SMUIPO, 2026-09-27 ~23:50 UTC, from session `session_014LdiwfVgCz482K16fTnADC` (context too big after reading
the whole live app to publish it). Work branch: `claude/amazing-gauss-yzfpq0` (everything pushed). Hub board = task list.
**First: archive `session_014LdiwfVgCz482K16fTnADC` and the older King `session_011e2f2UpFQsD7g4dCiYcFvm`.**

## Standing orders (also in CLAUDE.md)
- You are **SMUIPO, the King**: FilthE's conversation bubble. You decide and hand out jobs; helpers do the work.
  **2 helpers at a time.** Hand yourself off past ~200k tokens (rewrite this file, create_session, archive yourself).
- Post helper check-ins to the hub (`python3 .claude/hooks/hub_flush.py`).

## Done this session
- **App v25.2 is LIVE** (T199): https://claude.ai/artifact/9N97Uzv8J9EAueSKhCNSPT, version 10. Job #1 tracker, door-opener
  fix, quick-price phone fix. Publishing needs the whole live page Read first (about 300k tokens): next time let a
  helper do the read + publish, or publish from a fresh chat.
- PR #7 (work branch -> main) was opened by FilthE from the UI. Not merged; merges need his OK. This session watched it
  (no CI, no comments, clean). A fresh King can re-subscribe with subscribe_pr_activity if wanted.

## FilthE's phone: not our bug
Every Claude page (the AI Hub too) says "This browser isn't supported. Update it to open this artifact." in the Claude
iPhone app (iPhone 15). Told him: update the Claude app, or open claude.ai in Safari. **He said: "let's just focus on
the computer for now."** Don't chase it unless he brings it up.

## Next jobs, start now, 2 at a time (FilthE asked "what next")
1. **Builder, T201 Practice mode** in the app (in a worktree; the empty stopped worktree
   `.claude/worktrees/agent-acdc9022eabf9d432` can be deleted). Fold in **T205** ("Step 5 of 14" wraps on phones).
2. **Engine Mechanic, T203** (storm-age dip/bump for winter walks) + write the new King-trigger prompt with the accounts
   step (T193) into `docs/orders/king-trigger-prompt.md`; the King applies it with update_trigger.
Then: **Designer FIRST: FilthE picked MacBook direction A (Cockpit).** Restyle A's background + panels/boxes to feel
like Batman's cave computers: professional, premium, still Aldaba (docs/design/macbook/a-cockpit.html);
**Builder: Demo data + end-to-end test** (FilthE won't knock until the app is proven: load realistic mock
houses from public data into Practice/demo only, run a full fake day Now -> Knock -> lead -> claim -> job, fix what breaks);
**Research Lead FIRST: pro UI references** (FilthE: "improve the UI, look for professional references"): 10-15
FUTURISTIC, modern, really advanced, Apple-ad level (FilthE): Apple product pages + ads (Vision Pro/visionOS
glass, M-chip pages, Apple Watch Ultra), plus best-in-class desktop dashboards/command centers (Linear, Stripe, Palantir, Bloomberg, Vercel, Arc, Mobbin/Dribbble
finds, film HUD designers), what to steal for MacBook layout A, with screenshots; then
**PAUSED by FilthE (design first): Builder full fake day** (90bf61f: practice houses, photo-delete fix, 2 legal locks
(build day in cancel window, Job done before 44-8606 copies). LEFT: 390px Leads Due row not clickable + possible
duplicate rows (1418 N Irving, 1802 N Clarkson); drop FD_DEBUG line; wire fullday_check into release_checks; 24h
pieces not started. Then QA, then publish (the 2 legal locks matter for the live app));
**PAUSED by FilthE: Designer future layer** (work screens done as WIP fe86825+; left: intro.html cinematic
landing, future-compare.png, 24h safety note) - resume only when he says;
**Designer: apply the references** to layout A (ambient generative WebGL background, glass, luxury type,
micro-motion) + a cinematic Aldaba intro/landing (WebGL + scroll), per docs/design/references/README.md;
**Research Lead: Aldaba for businesses** (FilthE said yes: which trades pay first, competitor prices
(HailTrace, Hail Recon, SalesRabbit, Spotio...), pricing, must-haves like teams + other states' laws; output
docs/research/ file + one-page summary for FilthE); ~~upgrade the robots~~ (done, b7bcf05) (FilthE's order: research better prompts, tools, skills, models for
`.claude/agents/*`, then apply the best ones); **Designer/Research** read https://tabnav.com/blog/best-website-design-examples (FilthE sent it 2026-09-27)
and pull ideas for the Aldaba landing page + an HMP website; **QA T163** bad-signal stress test; **Research Lead** round 59 (claim deadlines, EraHub) with pymupdf; merge the
"AI hub: Penthouse HQ" work (T190, branch `claude/funny-hawking-2rytou`) when done, keeping the crew-hq design-gate fixes.
Session-start hook lists stray branches (dreamy-wright, eager-bardeen, focused-cannon, funny-hawking): check and merge
real work, or tell FilthE they look abandoned.

## Queue (FilthE 2026-09-28: "keep putting everyone to work", 2 at a time)
1. Research Lead: sales lessons path for FilthE (he won't knock until he can sell): week-by-week plan using the
   Practice Door + lessons with Claude, EN/ES objections, the legal door opener. 2. T210 pricing-shape doc (haiku).
3. Designer+Builder: bring MacBook layout A + Future look into the real app (ask FilthE before starting: big change).
4. **v25.3 READY (QA SHIP + door-name fix 4d7d713).** Publish app update (Practice mode, legal locks, date fixes, calls/alerts) after QA, only on FilthE's direct OK. Print Kit also needs a republish (its door line said "soy Alex Mendez", fixed in 4d7d713).

## Waiting on FilthE (don't nag)
T202 permit calls Monday 8 AM+ (Omaha 402-444-5233, Lincoln 402-441-7521). T71 Fremont permit records, T51 price sheet
(boss), T64 registration # (boss).
