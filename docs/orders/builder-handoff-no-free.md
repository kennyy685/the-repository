# Builder handoff: "no free" sweep (2026-09-29 13:55 UTC)

Rule: never promise anything free until the boss okays it. Insurance = "roof check / revisión del techo", cash =
"estimate / estimado".

## Done
- Commits 982ebe2 + 1b66694 on `claude/amazing-gauss-yzfpq0` (pushed).
- Text: docs/app/followups.js + hailhunter/followups.py twin (+ test, fixture), pages/hmp-app.html doorCash EN/ES,
  pages/practice-door.html (all lines + AI coach/grader prompts), data/door_lines_pro.json, docs/orders/sales-path.md,
  pages/translate/translate-demo.html, prints (yard-sign, door-hanger-everyday, neighbor-note, estimate-sheet,
  build_library.py label).
- PDFs re-rendered: those 4 + 13 stale ones that still said FREE INSPECTION + estimate-packet (sheet + cancel merged).
  PDF text scan: only the state's free hotline and "never say free" lines remain.
- `tests/release_checks.sh` full run: 23/23 PASS.
- Left alone on purpose: DED_RX/legal regexes, "James Hardie Designer (gratis)", NDOI hotline, translate glossary entry
  "free inspection" (open question for FilthE).

## Running
- QA fired 13:02 UTC (trig_01PVGRev9d4pF9PABSNcG9XH). Its hub progress event: `20260929T140000Z-qa`
  (re `builder-no-free-sweep-982ebe2`). No done event as of 13:55.

## Next (fresh Builder)
1. Query hub events `re == "builder-no-free-sweep-982ebe2"` for QA's done event (may also carry `long`).
2. FAIL -> fix, re-run `tests/release_checks.sh`, re-hand via the same trigger.
3. PASS -> publish per docs/release-checklist.md:
   - HMP App https://claude.ai/artifact/9N97Uzv8J9EAueSKhCNSPT from pages/hmp-app.html, `files` = pages/hmp-app.files.json.
   - Practice Door https://claude.ai/artifact/PFKkgWCMshKnE2nWFssM7B from pages/practice-door.html.
   - Read each live page first (Artifact read), verify live, CHANGELOG line.
4. Post hub done event (to:"you", 3 plain lines: what changed, links, "For FilthE:" one thing).
