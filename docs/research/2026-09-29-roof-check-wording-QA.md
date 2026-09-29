<!-- Saved from hub event events/20260929T103500Z-qa (agent qa-tester, 2026-09-29T10:35:00Z) by the Builder on 2026-09-29: the QA session's push was blocked. -->

# QA: roof-check-wording (2026-09-29)

Only the summary reached the hub (the full report stayed in the QA session).

PASS (1 medium, 3 low). Legal check, Practice Door check (379/379) and design gate all pass, and no new legal problem was added. The scorecard doesn't reward 'free' or penalize 'roof check'. Fix: 3 taught lines were changed in only one language and still say free/gratis (practice-door.html lines 1087, 1130, 1191). Also: one clumsy line ('a roof check at the roof'), the cash scorecard still says 'free estimate', and the 37 PDFs still say free until re-printed. Other places still say 'free inspection': the commercial call script, the door opener in the app layout, the translate glossary and four data files. Report: docs/research/2026-09-29-roof-check-wording-QA.md, committed here but the push is blocked (repo not in this session's sources). 1) Should the Builder fix the 3 lines and sweep the leftovers now? My pick: yes, one small job. 2) Add kennyy685/the-repository to QA sessions' sources so reports can push? My pick: yes, four earlier QA reports are stuck the same way.
