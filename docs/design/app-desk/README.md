# HMP App on the MacBook: the desk layout (v26, 2026-09-29)

FilthE's standing order: "design for a MacBook Air screen first" (phone later). Until v25 the app was a 600 px phone
column in the middle of a 1440 px screen. Two quick options, both real renders of the app on the e2e test's mock day
(tests/fixtures/app_live.json: real Fremont streets, fake houses), 1440 x 900, dark:

| | A · Desk (**picked**) | B · Stage |
|---|---|---|
| Nav | left rail (Now, Knock, Leads, Money, Add; Right Hand mic at its foot) | same rail, slimmer |
| Now | big map left, Aldaba's pick under it, today's plan + calls in their own column | map full-screen, pick + plan float on glass over it |
| Knock | the walk ahead \| the current door, big, 4 big taps \| the walk map, full height | map left, door + walk stacked on the right |
| Leads / Money | list + the open lead or job as a right pane | (same) |

`compare.png` = both side by side (top A, bottom B). `a-desk-*.png` = the pick on every screen (light + ES too).

**Why A:** nothing is covered. In B the Today panel hides the map's zone-list button, Calls drop off the screen, and on
Knock the walk ahead falls below the fold. A shows the whole morning at once (where, why, what's due) and at the door
the next 9 houses, the door card and the map sit side by side with the 4 taps in view without scrolling. B looked more
cinematic; its full-bleed walk map idea went into A (the Knock map is a full-height column showing the whole route).

## What the build does (pages/v25/desk.css + small hooks in pages/hmp-app.html)
- Everything is inside `@media (min-width:1100px)`: phones and narrow windows keep the v25 layout exactly.
- Knock's HTML has 3 layout-only groups (`.khead` `.kdoor` `.kside`, `display:contents` on a phone). On the desk the
  "Then" list shows the next 9 doors (2 on a phone). One tap per door is still one tap (desk_check checks it).
- Details (a lead, a claim, the estimate, the zones list, ...) open as a right pane: no dim, the list stays live and
  clicking another lead swaps the pane; the open row stays lit. Short menus (Add, More, the walk menu, rules) open as a
  centered card.
- The toast sits bottom-left, over the list column: never on the door card, the pane or a legal notice. On a phone
  the sheet now gets the toast's height as extra room, so its last line (often the legal one) scrolls clear.
- Money: what's owed + to chase | the open jobs (one column again while a job's pane is open).
- Check: `tests/pages/desk_check.js` (1440, 1512, 1280 and 390 px; light + dark; EN + ES); in tests/release_checks.sh.
