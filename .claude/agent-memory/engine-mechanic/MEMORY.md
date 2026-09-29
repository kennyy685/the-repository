# Engine Mechanic lessons (newest last; one line each: date, what went wrong, the rule)
- 2026-09-28 T211: a walk showed "area 65% owners" from a 0.65 fallback. Rule: data or nothing; name the source ("(Census)").
- 2026-09-28 Path 4: models.Obs.conv_day is a property, not a method (crashed the first live run). Rule: run the new command live once before writing tests.
- 2026-09-29: hub events stamped 12:45/13:15 while the real clock said 12:22/12:29 (guessed times sort wrong on the hub). Rule: every hub doc id and `at` = real `date -u +%Y%m%dT%H%M%SZ`, never a guess.
