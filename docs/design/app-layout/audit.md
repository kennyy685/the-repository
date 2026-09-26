# HMP App layout audit (T75, 2026-09-26)

Rendered the current `pages/hmp-app.html` (read-only copy) at 390x844 with sample data: a 25-house storm walk, 4 open
leads, 2 claims, 6 doors tapped. Screens in `shots/current-*.png`.

## The 5 big problems
1. **Today is 12 phone screens long.** The 25-house list sits in the middle, so everything under it (Quick estimate,
   Your next moves, the Right Hand chat, Follow-ups, This week) starts **~8,000 px down** (about 10 thumb-flicks).
2. **The Sale Guide starts too late.** The "At the door" script (say / ask / collect) only exists after a lead exists:
   tap Interested, go to Leads, find the card, open it. You need it *before* you knock.
3. **No quick way to add a lead or ask "what do I say in Spanish?".** The Right Hand chat is the only way, and it is
   buried on Today and at the bottom of Leads/Money. No translation help anywhere.
4. **Same things shown twice, numbers that disagree.** "Your next moves" and "Follow-ups" list the same leads
   (103 E 4th in both; 105 E 4th twice, as lead and claim). The bottom tally says 6 doors, "This week" says 0.
5. **AI-hub content inside the app** (breaks the no-mixing rule): "Your tasks · Copied from the AI hub · Open the AI hub",
   plus "Go knock" links out to the command center and HMP HQ.

Also: tabs sit at the top (hard to reach one-handed, round 11 says bottom); header carries 4 controls
(Vista del jefe, live dot, EN, ES); the RCV/ACV glossary box shows every time on Money.

## Tap count for the core jobs (from opening the app)
| Job | Now | Target |
|---|---|---|
| Log a door | **1** (Next door card) - good | 1 |
| Start the Sale Guide at a door | **3+ and only after "Interested"** (Leads, find card, open) | 1, before knocking |
| Add a lead (referral, drive-by) | 2 + ~10 screens of scrolling + typing in chat | 2 |
| Give a quick price | 1 tap, but ~9 screens down (or 1 from a done door) | 1-2 |
| Find tomorrow's follow-ups | 1 + ~10 screens down; no "Tomorrow" group | 1 |
| Switch EN/ES | **1** (top right) - good | 1 |

## Every screen, every item
**Header**
| Item | Verdict |
|---|---|
| HMP App logo + eyebrow | Keep, shrink to one line |
| EN / ES switch | Keep (1 tap), make it one toggle |
| Live dot / sync chip | Keep, small, only speaks up when offline |
| "Vista del jefe" button | **Move** to More (used by the boss, not mid-knock) |
| Tabs at the top | **Move** to a bottom bar (thumb reach) |

**Today**
| Item | Verdict |
|---|---|
| Date + "1 lead waiting too long · 2 follow-ups due" | Keep, make it tappable (goes to the due list) |
| Today's knock: area, why, goal, pass, progress bar | Keep, one compact card |
| Print today's walk | **Move** into the walk's ⋯ menu |
| Hail-marks-fade warning | Keep as 1 line on the walk card |
| Next door card + 4 buttons | **Keep, it is the best thing in the app**; add a "What to say" button (Sale Guide step 1) |
| Map + full 25-house list | **Move** behind a "List / Map" toggle (collapsed); only next 3 doors shown |
| Done doors with Undo | Keep, inside the list |
| Pricing fine print under the list | **Reword** to 1 line, show inside the price sheet |
| Quick estimate button | **Move** to the always-there action (+ or bottom bar) |
| Your next moves | **Merge** with Follow-ups into one "Due" list |
| Talk to your Right Hand (chat box) | **Move** to a button on every screen (round 11 rule 5) |
| Follow-ups due (Now / Coming up) | **Merge** with Next moves; group Today / Tomorrow / Later |
| Your tasks (from the AI hub) + Open the AI hub | **Cut** (no-mixing rule) |
| This week (streak, 5 counts) | **Merge** with the tally; one number source; move to Leads or evening review |
| Go knock: Door lists / Practice Door / HMP HQ | **Cut** from Today; Practice Door goes to More |
| Bottom tally bar + Next door + Done for today | Keep; "Done for today" opens the end-of-day review |

**Leads**
| Item | Verdict |
|---|---|
| Active / Won / Lost + source filters | Keep; add "Due" as the first filter |
| Lead cards (step x of 8, next step, due chip) | Keep; the card opens straight to its Next-step card |
| Chat box at the bottom | **Move** (global Right Hand button) |
| No "Add lead" button | **Add**: + New lead (address, name, source: 3 fields, rest via taps) |

**Money**
| Item | Verdict |
|---|---|
| 4 totals tiles + bar | Keep |
| Open claims / Cash jobs cards | Keep |
| RCV/ACV/Depreciation glossary box | **Move** into "How a claim works" (collapsed) |
| Chat box + rules line | Move chat; keep the rules line (legal, 1 line) |

**Sheets and other screens**
| Item | Verdict |
|---|---|
| Lead sheet: Next-step card (say/ask/collect) | Keep; this *is* the Sale Guide. Make it reachable from the door card |
| Claim sheet: money ledger, steps, timeline | Keep (office work, deeper is fine) |
| Quick estimate sheet | Keep; open from + / bottom bar |
| Homeowner screen ("Daylight report") | Keep; open from the Sale Guide's "Show the homeowner" step |
| Boss view (Spanish summary) | **Move** to More, stays one tap |
| Material order list, adjuster prep | Keep inside the lead (step 6) |

## Where translation help goes (all options)
Live EN<->ES help is for **talking**: "How do I say ...", read the script in the other language, repeat the homeowner's
answer. It uses a fixed glossary (deductible = deducible, adjuster = ajustador, depreciation = depreciación,
"registered" = "registrado", never "licensed"). **Legal text is never live-translated**: the contract, 3-day cancel notice
and deductible notice show their fixed, checked English + Spanish text only.
