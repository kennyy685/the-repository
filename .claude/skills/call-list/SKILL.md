---
name: call-list
description: Today's business call list (apartments/commercial with a known business line in fresh 1"+ hail). Usage "/call-list 10". Use for "who do I call today".
---
# Call list

Argument: N (how many calls, default 10).
1. `python3 hh.py calltoday --out /tmp/calls.json`.
2. Show the top N storm calls (`kind: "building"`): building, city, hail size, business phone, the EN opener (and ES if asked).
3. Then, under "Landlord/HOA associations", any `kind: "association"` calls (up to 2 a week, Tuesdays by default:
   `call_today.association_days` / `association_per_week`; contacts in `data/association_contacts.json`): name, city,
   business phone, the opener. The ask is vendor membership or a seat at a member meeting, never insurance. A contact
   with `phone: null` ("look up") is skipped until someone fills in its published office line.
Rules: business lines only (leasing offices, property managers, company lines), never personal cells; free inspection only, no insurance talk, no cold texts.
