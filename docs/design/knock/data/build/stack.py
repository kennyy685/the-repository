"""Add storm stacking + roof-age sweet spot to docs/design/knock/data/walk.json (engine: hailhunter/stacking.py).

Per home (all homes stay SAMPLE, never owner names):
  stack  {n, since, days[], km}  hail days with a REAL public report >= 0.75 in within 5 km of the home since 2024
         (data/hail-history.json + data/storms-2026.json), plus the zone's sample storm day (the walk exists
         because of it). The mockup's open score (additive, out of 100) gets it as one more part, "repeat hail 10":
         hail 35, owner lives here 20, mortgage 15, roof age 10, recent sale 10, repeat hail 10 (1 day 0, 2 days 5,
         3+ days 10). The engine (doorscore.py) uses the capped multiplier 1.0 / 1.15 / 1.3 on its own score.
  rb     {age, band young|prime|check, est}  from the home's roof age (sample assessor/permit data), an estimate:
         prime = 8-14 yrs, check = 15+ ("check the policy first"), young = under 8. A flag only, no score change.
  score0 the old score (walk.py's formula, before repeat hail), kept for comparison.
Run from the repo root:  python3 docs/design/knock/data/build/stack.py
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..", "..", "..", "..")
sys.path.insert(0, ROOT)
from hailhunter import stacking  # noqa: E402

OUT = os.path.join(HERE, "..", "walk.json")
W = json.load(open(OUT))
pts = stacking.load_points(os.path.join(ROOT, "data"))
today = W["clock"]["today"]
counts = {}
for h in W["homes"]:
    st = stacking.stack(h["ll"][1], h["ll"][0], pts, today, include=[W["zone"]["date"]])
    h["stack"] = {"n": st["count"], "since": st["since"], "days": st["days"], "km": st["km"]}
    h.setdefault("score0", h["score"])
    rep = 0 if st["count"] < 2 else (5 if st["count"] == 2 else 10)
    h["score"] = round(35 * min(1, h["hail"] / 2) + (20 if h["own"] else 0) + (15 if h["mort"] else 0)
                       + 10 * min(1, h["roof"] / 25) + (10 if h["sale"] and h["sale"] >= 2016 else 0) + rep)
    rb = stacking.roof_band(age=h["roof"], basis="built", today=today)
    h["rb"] = {"age": rb["age"], "band": rb["band"], "est": 1}
    counts[st["count"]] = counts.get(st["count"], 0) + 1
W["src"]["stack"] = ("REAL: hail days from public NWS/NCEI/SPC reports within 5 km since 2024 (data/hail-history.json + "
                     "storms-2026.json), plus the zone's sample storm")
W["src"]["roofBand"] = "ESTIMATE: roof age band from the sample roof age (8-14 yrs prime, 15+ check the policy first)"
json.dump(W, open(OUT, "w"), separators=(",", ":"), ensure_ascii=False)
bands = {}
for h in W["homes"]:
    bands[h["rb"]["band"]] = bands.get(h["rb"]["band"], 0) + 1
print("homes", len(W["homes"]), "stack counts", counts, "bands", bands,
      "score 100s", sum(h["score"] == 100 for h in W["homes"]), "bytes", os.path.getsize(OUT))
