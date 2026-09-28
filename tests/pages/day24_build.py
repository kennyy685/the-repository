#!/usr/bin/env python3
"""Mock morning data for the 24-hour fake-clock check (tests/pages/day24_check.js).

FilthE, 2026-09-27 ("No knocking yet"): prove the app end to end on mock data before he knocks. This writes
tests/fixtures/day24_hud.json = a MOCK Storm Watch hud.json for Tue 2026-09-29 6:54 AM Central: an overnight storm
(3:40 AM) over the practice houses' Fremont streets (pages/v25/practice-houses.js: real streets, made-up house
numbers, no owners). The storm itself is the real SPC 2026-06-13 Fremont 1.00" report replayed on 2026-09-29 so the
day has fresh hail; it is marked "mock": true and never goes near the real database.

  python3 tests/pages/day24_build.py            -> tests/fixtures/day24_hud.json
  python3 tests/pages/day24_build.py --daily OUT --date D [--results F] [--leads F] [--accounts F]
        -> runs `hh.py daily ... --no-basemap` on that hud into OUT (what the King's 7:52 AM / 12:52 PM runs write)
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HUD = os.path.join(ROOT, "tests", "fixtures", "day24_hud.json")
DAY = "2026-09-29"
PH = os.path.join(ROOT, "pages", "v25", "practice-houses.js")


def practice_houses():
    src = open(PH, encoding="utf-8").read()
    m = re.search(r"root\.HMPPracticeHouses\s*=\s*(\{.*\});\s*\}\)\(", src, re.S)
    return json.loads(m.group(1))


def pid_of(address):
    return "MOCK-" + re.sub(r"[^a-z0-9]+", "-", address.lower()).strip("-")


def build():
    H = practice_houses()
    hail = [1.25, 1.0, 1.5]          # the three practice zones: what the mock storm dropped on each
    lists, ev = [], {}
    for zi, (zid, w) in enumerate(H["walks"].items()):
        stops = []
        for i, s in enumerate(w["stops"]):
            h = round(hail[zi] + (0.25 if i % 5 == 0 else 0), 2)
            stops.append({"turf": 1, "stop": i + 1, "pid": pid_of(s["address"]), "address": s["address"], "city": "Fremont",
                          "hail": h, "kind": "single", "lat": s["lat"], "lon": s["lon"], "year_built": s.get("year_built"),
                          "score": 60 - i})
            ev[f'{s["address"]}|Fremont'] = {"day": DAY, "hail_in": h, "radar_max_in": round(h + 0.25, 2),
                                            "nearest_report": {"dist_mi": 0.4, "size_in": 1.0, "source": "lsr"}}
        lists.append({"id": f"{DAY}_Fremont_{zi + 1}", "day": DAY, "area": w["area"].replace("Practice: ", ""),
                      "doors": len(stops), "turfs": [{"turf": 1, "doors": len(stops), "avg_hail": hail[zi], "value": 900,
                                                       "heat": 40.0 - zi * 5, "why": [f'{hail[zi]}" hail', "fresh storm (0 days)"]}],
                      "stops": stops})
    hud = {"mock": True, "source": "MOCK for tests/pages/day24_check.js: the real SPC 2026-06-13 Fremont 1.00\" hail "
                                    "report replayed as an overnight storm on 2026-09-29; practice houses (real streets, "
                                    "made-up numbers, no owners). Never the real database.",
           "generated_utc": "2026-09-29T11:54:00Z", "lists": lists, "everyday_lists": [], "hail_evidence": ev,
           "targets": [], "wind_events": [],
           "storms": [{"day": DAY, "place": "Fremont", "state": "NE", "lat": 41.44, "lon": -96.49, "dist_mi": 1.0,
                       "hail": 1.5, "basis": "ground", "reports": 2, "score": 60.0, "time_local": "03:40"}]}
    with open(HUD, "w", encoding="utf-8") as f:
        json.dump(hud, f, indent=1)
        f.write("\n")
    return HUD


def daily(out, day, results=None, leads=None, accounts=None):
    cmd = [sys.executable, os.path.join(ROOT, "hh.py"), "daily", "--out-dir", out, "--date", day, "--hud", HUD, "--no-basemap"]
    for flag, v in (("--results", results), ("--leads", leads), ("--accounts", accounts)):
        if v:
            cmd += [flag, v]
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=120)
    if r.returncode:
        sys.stderr.write(r.stdout + r.stderr)
        sys.exit(r.returncode)
    return json.load(open(os.path.join(out, "manifest.json"), encoding="utf-8"))


if __name__ == "__main__":
    a = sys.argv[1:]
    if "--daily" in a:
        g = lambda k: a[a.index(k) + 1] if k in a else None  # noqa: E731
        if not os.path.exists(HUD):
            build()
        print(json.dumps(daily(g("--daily"), g("--date") or DAY, g("--results"), g("--leads"), g("--accounts"))))
    else:
        print(build())
