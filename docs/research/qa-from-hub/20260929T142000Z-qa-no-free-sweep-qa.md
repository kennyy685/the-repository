# QA report from hub event 20260929T142000Z-qa

To: builder · re: builder-no-free-sweep-982ebe2 · at: 2026-09-29T14:20:00Z

**Summary:** PASS (0 high, 1 medium, 1 low). Full release checks 23/23. EN/ES wording is clean in the app, Practice Door, followups twin and prints; all 37 PDFs scanned, only the state hotline and never-say-free lines remain. Medium: the contingency agreement (EN+ES html and PDFs) still says HMP charges nothing for the inspection and signing costs nothing, which is the same promise. Push blocked (403), full report in long. 1) Reword the contingency agreement or wait for the boss? My pick: reword to no payment due at signing and re-render. 2) Add a no-free regex to legal_check.py? My pick: yes.

# QA: "no free" sweep (2026-09-29)
Order: Builder -> QA, commits 982ebe2 + 1b66694 on claude/amazing-gauss-yzfpq0.

PASS: 0 high, 1 medium, 1 low

## Ran
- `bash tests/release_checks.sh` (full): 23/23 PASS (incl. e2e_day, practice_check, desk_check, design_gate 1288s, shots).
- Diff read (all non-PDF files): app doorCash EN/ES, followups.js + followups.py twin, Practice Door lines/prompts/regex-adjacent text, door_lines_pro.json, sales-path.md, prints html, translate-demo.
- Repo-wide grep (pages, docs/app, docs/print, docs/orders, hailhunter, data) for free|gratis|no cost|sin costo|no charge|cuesta nada|sin cargo|complimentary.
- Text scan of all 37 PDFs under docs/print (pypdf) for the same words.

## Result
- All customer-facing "free/gratis/no cost/no charge to look" lines in scope now say roof check / revisión del techo (insurance) or estimate / estimado (cash), with "sin compromiso / no obligation" where a softener was wanted. EN and ES twins match; followups.js and followups.py agree.
- Leftovers are all intended: NDOI free hotline (EN + ES, 7 PDFs), "James Hardie Designer (free/gratis)", DED_RX / Practice Door legal regexes, trap scenarios where the homeowner asks for free gutters, "never call it free" coach lines, pre-winter-inspection.pdf crew line "Say roof check. Never hint at a free roof."
- Legal: no deductible cover/waive wording introduced; no "licensed"; 3 business days lines untouched.

## Findings
1. medium, docs/print/contingency-agreement.html:121 (+ contingency-agreement-es.html, both PDFs): "Nothing to pay today... HMP charges nothing for the inspection, the photos, the damage report or meeting the adjuster" and "Signing costs you nothing" / ES "HMP no cobra nada por la inspección..." / "Firmar no le cuesta nada". This is the same promise as "free inspection", written into a signed contract, and the sweep missed it (rule: never promise free until the boss okays it). Not in the builder's change set. Fix: boss okays it as is, or reword to "No payment is due at signing. What HMP will charge for is set out in the written estimate/contract" (ES: "No se paga nada al firmar. Lo que cobra HMP consta en el estimado/contrato por escrito."). Then re-render both PDFs. Catch next time: grep -riE "charges? nothing|costs? you nothing|no cobra nada|cuesta nada|pay nothing|no paga nada" docs/print.
2. low, tests: nothing enforces the rule. Add to legal_check.py a scan of pages/, docs/print/*.html, docs/app for `\bfree (estimate|inspection|roof)|(estimado|inspecci[oó]n|revisi[oó]n)( del techo)? gratis|no charge to look|revisar no cuesta` (allow-list the NDOI hotline and the never-say-free lines).

Not run: visual check of the 17 re-rendered PDFs (text scan only, layout not inspected); Spanish visual pass of prints.

