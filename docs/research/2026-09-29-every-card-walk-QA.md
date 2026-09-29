<!-- Saved from hub event events/20260929T123500Z-qa-done (agent qa-tester, 2026-09-29T12:35:00Z) by the Builder on 2026-09-29: the QA session's push was blocked. -->

# QA report (2026-09-29)

QA every-card-walk (f396e82, afa45f8, c260ec9; checked at c260ec9+982ebe2)
PASS: 0 high, 1 medium, 1 low.
Ran: unittest discover 519 OK; node tests/pages/open_map_night_check.js PASS (7d Columbus own walk); release_checks --fast 11/12 PASS (needed pip install numpy pandas in fresh container). NOT run: design_gate/shots (Chromium) - run full gate before publish.
FINDINGS
1 MEDIUM docs/orders/sales-path.md:108-112 vs pages/practice-door.html:1960: practice_door_rx_check FAIL 'TOP15 differs from sales-path.md: 6 notint' (release_checks red). 982ebe2 changed page answer 6 to 'roof check' but sales-path.md still says 'no charge to look' / 'revisar no cuesta nada' (a free promise the boss has not approved). Fix EN: "No problem at all. If anything comes up down the road, or after the next storm, here's my card — call anytime for a roof check." ES: "No hay problema. Si algo surge después, o tras la próxima tormenta, aquí tiene mi tarjeta — llame cuando quiera para una revisión del techo." Catch next time: grep -E 'no charge|no cuesta|sin costo|gratis|\bfree\b' over docs/orders + pages in legal_check.py.
2 LOW docs/design/open-map/index.html NIGHT_X: walks capped .slice(0,12); fine for 5 cards, would silently drop walks if top list grows. Add test zwalks <= 12.
LEGAL: new strings only followups.py 'an estimate'/'un estimado' (free removed, OK); no names, no door points, no deductible/insured wording.
Report file (unpushed, local container only): docs/research/2026-09-29-every-card-walk-QA.md
