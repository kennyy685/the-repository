"""SAMPLE knock history -> the "map learns" track record for the Knock screen and the open map (engine:
hailhunter/learning.py).

FilthE hasn't knocked yet (CLAUDE.md "No knocking yet"), so the real database stays empty. To show how the learning
layer behaves, this makes a seeded, made-up history of past knocks in the open map's REAL hot zones (zone ids, hail
sizes and repeat-hail counts from data/real.js) with FAKE homes (signals drawn at random, never an address, never an
owner name) and FAKE outcomes. Some zones get many doors, some a few, most none, so both "3 inspection yeses from 41
doors" and "not enough doors yet" show up. The made-up outcomes lean toward bigger hail, repeat hail and more
likely-insured signals: that is an assumption for the demo, NOT something learned.

Writes:
  docs/design/knock/data/knocks-sample.json   the fake knocks, in the Knock screen's log shape (`hh.py learn` reads it)
  docs/design/knock/data/walk.json            + `learn` (the table; the page adds today's taps on top, live)
  docs/design/open-map/data/learn.js          window.LEARN = the same table, for the map's picks
Run from the repo root:  python3 docs/design/knock/data/build/learn.py
"""
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".."))
sys.path.insert(0, ROOT)
from hailhunter import learning, stacking  # noqa: E402

KNOCK = os.path.join(ROOT, "docs", "design", "knock", "data")
MAP = os.path.join(ROOT, "docs", "design", "open-map", "data")

s = open(os.path.join(MAP, "real.js"), encoding="utf-8").read()
REAL = json.loads(s[s.index("{"):s.rstrip().rstrip(";").rindex("}") + 1])
AREAS = {a["id"]: a for a in REAL["AREAS"]}
STORMS = REAL["STORMS"]

# doors knocked per zone (made up): a few zones well worked, some barely, the rest untouched
PLAN = [("z0610-lincoln", 64), ("z0423-malcolm", 52), ("z0613-fremont", 48), ("z0701-fremont", 44),
        ("z0613-elkhorn", 40), ("z0423-millard", 34), ("z0605-plattsmouth", 30), ("z0613-fremont-2", 26),
        ("z0423-elkhorn", 22), ("z0610-raymond", 16), ("z0516-ashland", 12), ("z0515-fremont", 9),
        ("z0306-valparaiso", 6), ("z0703-gretna", 4)]
rnd = random.Random(20260929)
today = REAL["today"]
knocks = []
for zid, n in PLAN:
    a = AREAS[zid]
    day = STORMS[a["st"]].get("date") or f"{a['st'][1:5]}-{a['st'][5:7]}-{a['st'][7:9]}"
    stack_n = (a.get("stack") or {}).get("n") or 1
    for i in range(n):
        hail = max(0.75, round(a["hail"] + rnd.uniform(-0.25, 0.25), 2))
        own = rnd.random() < max(0.35, (a.get("owner") or 65) / 100)
        mort = own and rnd.random() < 0.65
        sale = rnd.randint(1994, 2025)
        roof = rnd.randint(3, 30)
        rb = stacking.roof_band(age=roof, basis="built", today=today)["band"]
        st_n = max(1, stack_n + rnd.choice((-1, 0, 0, 1)))
        ins = learning.ins_count({"own": own, "mort": mort, "sale": sale}, 2026)
        p = 0.015 + 0.03 * (hail >= 1.5) + 0.02 * (st_n >= 3) + 0.015 * ins + 0.01 * (rb == "prime")
        u = rnd.random()
        o = "yes" if u < p else rnd.choices(["na", "no", "back", "roofer"], [55, 25, 10, 10])[0]
        m = rnd.randint(960, 1150)                                   # 4 PM to sunset
        mo, dd = rnd.choice([(8, 4), (8, 18), (9, 2), (9, 16)]), rnd.randint(1, 13)
        at = f"2026-{mo[0]:02d}-{mo[1] + dd - 1:02d}T{(m + 300) // 60 % 24:02d}:{m % 60:02d}:00Z"
        knocks.append({"id": f"k-sample-{zid}-{i}", "at": at, "m": m, "door": f"sample-{zid}-{i}", "zone": zid,
                       "storm": day, "st": None, "o": o,
                       "sig": {"hail": hail, "own": own, "mort": mort, "sale": sale, "roof": roof, "score": None,
                               "stack": st_n, "rb": rb},
                       "by": "sample", "src": "sample"})

json.dump({"v": 1, "src": "SAMPLE: made-up knocks on fake homes in real hot zones (docs/design/knock/data/build/"
                         "learn.py); never real outcomes", "ev": knocks},
          open(os.path.join(KNOCK, "knocks-sample.json"), "w"), separators=(",", ":"))
doc = learning.doc(knocks, year=2026, src="SAMPLE", now=None)
doc["as_of"] = today
doc["zones"] = {z: doc["t"].get(f"z:{z}", [0, 0]) for z, _ in PLAN}

W = json.load(open(os.path.join(KNOCK, "walk.json")))
W["learn"] = doc
W["src"]["learn"] = ("SAMPLE: made-up past knocks on fake homes in real hot zones (build/learn.py) + your taps "
                     "today; the real track record starts when knocking starts")
json.dump(W, open(os.path.join(KNOCK, "walk.json"), "w"), separators=(",", ":"), ensure_ascii=False)
with open(os.path.join(MAP, "learn.js"), "w", encoding="utf-8") as f:
    f.write("/* SAMPLE track record for the open map (made-up knocks on fake homes). Built by "
            "docs/design/knock/data/build/learn.py with hailhunter/learning.py. Do not edit. */\n")
    f.write("window.LEARN=" + json.dumps(doc, separators=(",", ":"), ensure_ascii=False) + ";\n")
ok = {z: v for z, v in doc["zones"].items()}
print("doors", doc["doors"], "yes", doc["yes"], "prior", round(learning.prior_all(doc["t"]), 4), "zones", ok)
for z in ("z0610-lincoln", "z0610-raymond", "z0613-fremont-2", "z0913-colon"):
    a = AREAS[z]
    print(z, learning.like(doc["t"], learning.zone_keys(a["hail"], (a.get("stack") or {}).get("n"), z))["line"]["en"])
