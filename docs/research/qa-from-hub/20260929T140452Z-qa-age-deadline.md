# QA report from hub event 20260929T140452Z-qa

To: engine · re: 24dd7b7 · at: 2026-09-29T14:04:52Z

**Summary:** PASS with 1 medium: code and tests are sound, but the 'Nebraska sets no cutoff in days' line is claim advice and only half backed by law. Reword before publish. Push blocked (no add_repo tool, proxy 403). Questions: 1) Use my reworded line (no legal claim, points to the customer's policy)? My pick: yes. 2) Add the bad-phrase regex test? My pick: yes.

QA 24dd7b7 (open map age line): PASS: 0 high, 1 medium, 2 low.
Ran: pytest 521 pass; legal_check PASS; open_map_night_check PASS (ageWhy vs Chicago date, ES, non-age line untouched); design_gate --page open-map PASS 1440 light+dark. Not run: phone widths, full release shots.
Code: ageWhy/ageLine/ctToday (index.html ~1893-1901), season.age_line, openmap.AGE_EN are sound: idempotent, negative n keeps file line, en-CA gives YYYY-MM-DD, same EN/ES text JS and Python, no countdown.
MEDIUM 1. index.html:1897-1898 + season.py:277-279 'Nebraska sets no cutoff in days; policies ask for prompt notice' is a legal statement a salesman may repeat at the door. 44-357 (docs/research/2026-09-26-round-28.md:70) only stops a policy shortening the SUIT deadline; it says nothing on notice/proof-of-loss terms, which policies do set, often in days. 'No cutoff in days' can be read as 'no notice deadline' = false for some policies = claim advice. 'Deadline:' also reads as a countdown label. FIX (matches maps.py:169 tone): EN 'N days ago. Time limits to file are in the customer's policy; ask them to check it.' ES 'Hace N días. Los plazos para reportar están en la póliza del cliente; que la revise.' Drop 'Nebraska sets no cutoff' and 'prompt notice'; keep the 5-year fact in the code comment only.
LOW 2. No test guards the wording. Add over age_line EN+ES: assert not re.search(r'(?i)expires?|running out|last day|hurry|only \d+ days left|no (cutoff|deadline)', text).
LOW 3. Add tests for a future storm date (n<0) and Chicago midnight (23:30 CT vs UTC next day); the check only compares to node's own clock.
For FilthE: the boss or a lawyer should OK any on-screen sentence about what the law allows; 'check the customer's policy' needs no OK.
Report: docs/research/2026-09-29-age-deadline-QA.md (local commit only, unpushed).
