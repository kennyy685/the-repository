# QA Tester lessons (newest last; one line each: date, what went wrong, the rule)
- 2026-09-28 Practice Door v12: 1 high, 6 medium, 9 low, all with exact fix wording and tested regexes. That format is the bar.
- 2026-09-28 tests/legal_check.py passed lines that broke the law in spirit ("3 days", financing promise, claim advice). Rule: always read new customer/taught lines by eye, and hand back a regex or test case for each miss.
- 2026-09-29 Knock mockup: '3-day cancel' and 'free inspection' passed the designer's own legal box. Rule: grep every new EN/ES string for `3[- ]day` without business, and `free|gratis` before PASS.
