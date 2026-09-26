# HMP App roadmap: the parts, the loose ends, the clutter (2026-09-26)

What counts: leads, inspections, claims, jobs. A part matters if it gets FilthE to more doors, more follow-ups or a smoother claim.

## The 8 parts (in order of what matters)
| # | Part | Why it matters | Next concrete step | Board |
|---|---|---|---|---|
| 1 | **App layout (Option B)** | Today is 12 screens long; the Sale Guide is 3+ taps deep | Rebuild to Now / Knock / + / Leads / Money once the current pass ships | T75 |
| 2 | **Industry benchmarks** | FilthE isn't knocking yet, so internet data stands in for his own | data/benchmarks.json (round 15) drives goals, coaching and the weekly report | round 15 |
| 3 | **Follow-up engine** | Most sales need 5+ touches; most reps stop at 1-2 | 48 h / 5 day / 10 day reminders + one "Due" list (Today / Tomorrow / Later) | round 9 |
| 4 | **Daily coaching** | 35-43% of new reps quit in 90 days | End-of-day review (5 questions), before-the-next-door card, rookie framing | T83 |
| 5 | **Voice** | Typing at a door doesn't happen | First test that the mic works in the Claude app on iPhone, then hold-to-talk logging with a confirm card | T79, T82 |
| 6 | **Spanish edge** | 63% of roofers are Latino; no competitor does Spanish well | Fixed glossary, "help me say it", read-aloud of fixed legal notices | T73, T80, T81 |
| 7 | **Claims + money** | Where the money is made or lost | One home for claims (see loose end), checks to chase, referral ask at completion | round 9 |
| 8 | **Product later** | FilthE may sell the app | Move HMP's name, phones and prices into one settings object | T77 |

Behind the scenes (how we work): QA pass/fail checks (T72), splitting CLAUDE.md (T78), and the storm engine staying fresh (Cowork re-bundle, T61).

## Loose ends (things started but not closed)
- **Boss answers:** registration # (T64), Class 4 shingles (D14), workmanship warranty years (D15). They block the contract, the homeowner screen and the completion certificate.
- **Claims live in two places:** the old Claim Tracker page and the app's `claims`. Pick one (the app) and retire the other.
- **Old pages still linked from the app:** command center, HMP HQ, Practice Door. Decide what stays reachable (under More) and what is office-only.
- **Instant wake:** the hub is built but not tested live. The app side is still being built.
- **Cowork re-bundle (T61):** not confirmed. Storm Watch may still run older engine code.
- **Fremont permit records request (T71):** it would give real roof ages. It needs FilthE's email.
- **Lawyer review of the contract:** deferred on purpose. Do it before the first signed job.
- **Right Hand prompt (Mac project chat):** still mentions 8:12 / 6:12 runs, which are now paused.

## Clutter in the app now (from the audit, docs/design/app-layout/audit.md)
**Cut:**
- "Your tasks / Open the AI hub" (breaks the no-mixing rule).
- The "Go knock" links out to the command center and HMP HQ.

**Merge:**
- "Your next moves" and "Follow-ups" become one "Due" list. They show the same leads twice.
- The two door counts, which disagree (tally 6 vs This week 0).

**Hide or collapse:**
- The full 25-house list and map go behind a List/Map toggle. Show only the next 3 doors.
- The RCV/ACV glossary box on Money moves into "How a claim works".
- Print buttons and pricing fine print go into menus.

**Move:**
- Tabs move from the top to a bottom bar.
- "Vista del jefe", Practice Door and Prices move under More.
- The chat moves from 3 separate boxes to one button on every screen.

**Missing:**
- An "Add lead" button.
- A "What to say" button on the door card.
- Any Spanish help.
