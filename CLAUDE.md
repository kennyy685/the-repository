# HailHunter / HMP App for HMP Siding & Roofing LLC (Fremont, NE)

Short on purpose (it loads on every message). Full history, company brief, answered decisions and page details:
**`docs/memory/full-context.md`** (read the section you need). Code/commands: skill `hailhunter-reference`. Engine edits:
skill `engine-change`. Board posts: skill `crew-checkin`. Mac sessions: also read `~/2026/CLAUDE.md` + `~/2026/BOARD.md`.

## Who
- **FilthE** (Kenny Cruz, 402-936-2709): builds this system, does insurance sales, bilingual, owns the app (product name
  **Aldaba**, trademark pending). Plain English, short, skimmable (ADHD). Never make him type into spreadsheets.
  Don't re-ask answered questions (see full-context). He's the idea person ("a kid behind a computer screen making an
  idea come to reality"): don't ask him HMP operations facts (crews, pay, budget); those wait for the boss
  (docs/memory/questions-for-filthe.md). Ask him about ideas, taste and the app.
- **Research first, don't ask (FilthE, 2026-09-27):** "stop asking me for info when there's a whole web to use." Anything
  the web can answer (laws, industry norms, tools, Spanish terms, best practice): research it, pick the best default,
  tell him in one line (he can override). Only ask a person for what only HMP knows or must commit to: the boss's
  prices, registration #, warranty promises, spending money, signing anything, deleting data.
- **Crew's own setup (hooks, one-command checks, AI docs, plugins):** `docs/orders/crew-setup.md`. Improve it like the app.
- **Decide with `docs/orders/decision-method.md`:** outside-view numbers, every seat at the table, pre-mortem, now vs.
  later, one-way vs. two-way door. FilthE gets the decision + one reason, not the homework.
- **The boss** owns HMP, speaks Spanish. Spanish side of print = Alex Mendez, 402-889-3385. Mailing address:
  2600 Laverna St, Apt 50, Fremont, NE 68025. Registration # pending (print keeps a blank line).
- HMP: siding, roofing, gutters, residential + commercial; subs labor for VTR / Nastase (multi-building apartment
  siding jobs); goal = insurance restoration direct to homeowners, plus everyday old-house sales. Don't plan around any
  one named job (FilthE: "forget The Edge, keep the idea"); say "current jobs".

## Goal and core flow
**FilthE's vision (2026-09-27):** in 12 months HMP thrives because of this system: he's knocking and earning
commissions, crews love and push the app, HMP is the main contractor with "a lot of signs in a lot of yards", lots of
networking. Then: an AI consultant selling software (Aldaba) to businesses. Order: HMP first, product second.
Success = crews working jobs the system found. App flow: **Now** = map of hot zones (`zones/current`) -> drive ->
**Knock** = that zone's ranked walk (`walks/<zone>`), one tap per door. "Likely insured" = owner-occupied + residential +
recent-sale proxies (never say "insured"). The app is the salesman's right hand: every screen says where you are in
the sale, what to collect, what's legally required, what's next. **The app is the tool; teaching how to sell lives
outside it** (FilthE, 2026-09-27: Practice Door + lessons with Claude). No coaching text in the app; a pro needs eyes,
memory, back office, follow-up, proof and legal armor (docs/research/2026-09-27-round-54.md). Theme "Ledger", layout B, EN/ES everywhere.

## Live system
- HMP App https://claude.ai/artifact/9N97Uzv8J9EAueSKhCNSPT (`pages/hmp-app.html`, own db). No hub content in it.
- AI hub https://claude.ai/artifact/Qkc52bt2JL5gW7ZKWBJDHU (`pages/crew-hq.html`): `board/current` = task source of truth.
- HMP HQ https://claude.ai/artifact/HhK5UGhHG3VpNR7HuaqEpj · Practice Door https://claude.ai/artifact/PFKkgWCMshKnE2nWFssM7B
- Command center (Cowork's, read-only for us) https://claude.ai/artifact/6cCATKJSoyWA7kbH4Em8VX: never write its
  turfs/targets/calls. Storm Watch (Cowork's) runs 6:54 AM.
- King trigger `trig_01MNxMWzvD3ZgRqWxfjtJLEU`: fresh session 7:52 AM / 12:52 PM / 5:52 PM Central + hub instant wake.
  Old triggers are paused, never deleted. Never bind a recurring trigger to a long session.
- Work branch: `claude/funny-hawking-2rytou`. Merges to main need FilthE's OK.

## Hard rules (legal)
- Neb. 44-8604: never offer/imply covering, waiving or rebating a deductible; never pay homeowners for claims.
- Never promise insurance pays; never negotiate claims (public-adjuster license). We document damage and meet the adjuster.
- 69-1602: at the door say name + HMP + what we sell FIRST. 69-1601/1604(3): 3-day cancel form every sale, EN + ES.
- 69-1606(5): no work before the cancel window ends on a non-insurance sale. 44-8606: itemized description to homeowner
  AND insurer before insurance work. No assignment of benefits (44-8605).
- "Registered/registrado", never "licensed/licenciado". Business phone lines only; no cold texts, bought lists or
  mailers; no owner names for homes. Statute text lives in `docs/legal/`.

## How we work (save usage - FilthE, 2026-09-27)
- **1 helper at a time (2 max).** Cheapest model that can do it: scouts/chores = haiku, research/QA = sonnet, main model
  only for real app/design/engine work. Tight prompts, short reports.
- **Commit work in progress to the repo every ~30 min** (a container restart wiped an unsaved v25 draft).
  Commit only your own files (`git add <paths>`, never `-A`).
- Grep big files, never read the 8,400-line app whole. Screenshots only for the final pre-publish review.
- New chat per job; don't grow one endless session.
- Every page publish follows `docs/release-checklist.md` (checks green, light/dark screenshots vs
  `docs/design/v25-polish/`, legal boxes, CHANGELOG line).
- The HMP App is a page plus module files (T169): `pages/hmp-app.files.json` maps published path -> repo file. Edit a
  module in its own file and publish with that map as `files`; never paste code back into the page.
- When FilthE says something important, add it here (short) or to `docs/memory/full-context.md` (detail).
