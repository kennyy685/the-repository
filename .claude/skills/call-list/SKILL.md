---
name: call-list
description: Today's business call list (apartments/commercial with a known business line in fresh 1"+ hail). Usage "/call-list 10". Use for "who do I call today".
---
# Call list

Argument: N (how many calls, default 10).
1. `python3 hh.py calltoday --out /tmp/calls.json`.
2. Show the top N: building, city, hail size, business phone, the EN opener (and ES if asked).
Rules: business lines only (leasing offices, property managers, company lines), never personal cells; free inspection only, no insurance talk, no cold texts.
