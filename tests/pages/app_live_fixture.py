#!/usr/bin/env python3
"""Build tests/fixtures/app_live.json for app_live_check.js: the HMP App's database on a realistic Tuesday morning.

Nothing here is a real home or a real person (CLAUDE.md "No knocking yet": mock data from public sources, never owner
names). Two sources, both already mock:
  - the engine's own 7:52 AM output (zones/current, walks/*, calls/today, evidence/*, today/walk) from
    `day24_build.py --daily` on the MOCK overnight storm (real Fremont streets, made-up house numbers, no owners)
  - the leads / claims / doors / week stats the design gate renders (tests/pages/design_gate_fixture.json), first names
    replaced with "Test" so no name ever rides along

  python3 tests/pages/app_live_fixture.py        -> tests/fixtures/app_live.json   {"docs": {"<coll>/<id>": body}}
"""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "tests", "fixtures", "app_live.json")
DAY = "2026-09-29"
APP_COLLS = ("leads", "claims", "doors", "dnk", "evidence")
APP_DOCS = ("stats/streak", "stats/week-2026-39", "stats/week-2026-38")


def scrub(v):
    if isinstance(v, dict):
        return {k: ("Test" if k in ("first_name", "owner", "owner_name") and isinstance(x, str) else scrub(x)) for k, x in v.items()}
    if isinstance(v, list):
        return [scrub(x) for x in v]
    return v


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    if not os.path.exists(os.path.join(ROOT, "tests", "fixtures", "day24_hud.json")):
        subprocess.run([sys.executable, os.path.join(here, "day24_build.py")], cwd=ROOT, check=True)
    gate = json.load(open(os.path.join(here, "design_gate_fixture.json"), encoding="utf-8"))
    docs = {}
    for c in APP_COLLS:
        for k, v in (gate["collections"].get(c) or {}).items():
            docs[c + "/" + k] = scrub(v)
    for p in APP_DOCS:
        if p in gate["docs"]:
            docs[p] = scrub(gate["docs"][p])
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "out")
        subprocess.run([sys.executable, os.path.join(here, "day24_build.py"), "--daily", out, "--date", DAY],
                       cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
        man = json.load(open(os.path.join(out, "manifest.json"), encoding="utf-8"))
        for p, f in man["files"].items():
            docs[p] = scrub(json.load(open(os.path.join(out, f), encoding="utf-8")))
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"_comment": "Built by tests/pages/app_live_fixture.py (mock homes, no names). Do not hand-edit.",
                   "day": DAY, "docs": docs}, f, indent=0, sort_keys=True)
    print(f"{OUT}: {len(docs)} docs")


if __name__ == "__main__":
    main()
