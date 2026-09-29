# Engine Mechanic lessons (newest last; one line each: date, what went wrong, the rule)
- 2026-09-28 T211: a walk showed "area 65% owners" from a 0.65 fallback. Rule: data or nothing; name the source ("(Census)").
- 2026-09-28 Path 4: models.Obs.conv_day is a property, not a method (crashed the first live run). Rule: run the new command live once before writing tests.
