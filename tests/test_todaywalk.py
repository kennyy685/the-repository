"""Offline tests for O0 "Today's knock": `hh.py todaywalk` picks ONE walk for the HMP App's today/walk doc.
Fixture tests/fixtures/today_hud.json: a fresh Fremont storm list (2 walks, plus an apartment and a commercial
building), a stale Blair storm list (hotter, but 208 days old on 2026-09-25) and an everyday old-house list."""
import contextlib
import io
import json
import os
import re
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import config as C  # noqa: E402
from hailhunter import todaywalk  # noqa: E402

FIX = os.path.join(HERE, "fixtures", "today_hud.json")
KEYS = {"date", "area", "why", "goal_doors", "kind", "list_id", "stops", "spanish_share", "who"}   # +T37
STOP_KEYS = {"pid", "address", "city", "lat", "lon", "pass"}


def num(s):
    return int(s["address"].split()[0])


def street(s):
    return " ".join(s["address"].split()[1:])


class TodayWalk(unittest.TestCase):
    def setUp(self):
        with open(FIX) as f:
            self.hud = json.load(f)
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))

    def pick(self, day="2026-09-25", **kw):
        return todaywalk.pick(self.hud, day, cfg=self.cfg, **kw)

    def assertWalkingOrder(self, stops):
        seen, prev = [], None
        for s in stops:                            # each street walked once, in one go
            if street(s) != prev:
                self.assertNotIn(street(s), seen, "street visited twice")
                seen.append(street(s))
                prev = street(s)
        for st in seen:                            # house numbers run one way along each street
            ns = [num(s) for s in stops if street(s) == st]
            self.assertTrue(ns == sorted(ns) or ns == sorted(ns, reverse=True), (st, ns))

    def test_fresh_storm_walk_houses_only_in_walking_order(self):
        d = self.pick()
        self.assertEqual(set(d), KEYS)
        self.assertEqual(d["kind"], "storm")
        self.assertEqual(d["list_id"], "2026-09-10_Fremont")    # not the hotter but stale Blair storm
        self.assertEqual(d["date"], "2026-09-25")
        self.assertEqual(len(d["stops"]), 25)                   # 20 houses in walk 1, topped up from walk 2
        self.assertEqual(d["goal_doors"], 25)
        for s in d["stops"]:
            self.assertEqual(set(s), STOP_KEYS)
            self.assertEqual(s["pass"], 1)
        pids = {s["pid"] for s in d["stops"]}
        self.assertNotIn("DODGE-APT1", pids)                    # no apartments
        self.assertNotIn("DODGE-COM1", pids)                    # no commercial
        self.assertEqual(len(pids), 25)
        self.assertWalkingOrder(d["stops"])
        self.assertEqual(d["area"], "Fremont: Linden St & E 4th St")

    def test_storm_why_is_plain_bilingual_no_scores_or_ids(self):
        d = self.pick()
        self.assertEqual(d["why"]["en"], "1.5-inch hail hit here on September 10, the roofs are older and most "
                                         "homes are owner-lived.")
        self.assertEqual(d["why"]["es"], "Aquí cayó granizo de 1.5 pulgadas el 10 de septiembre, los techos ya tienen "
                                         "años y en la mayoría de las casas viven sus dueños.")
        for t in d["why"].values():
            self.assertNotRegex(t, r"heat|score|DODGE|%|\d{5,}")

    def test_stale_storm_falls_back_to_everyday_with_plain_why(self):
        d = self.pick("2026-12-25")                             # storm is 106 days old: no storm walk
        self.assertEqual(d["kind"], "everyday")
        self.assertEqual(d["list_id"], "everyday_Fremont_310539640003")
        self.assertEqual(d["why"], {"en": "Most homes here were built before 1980 and are owner-lived.",
                                    "es": "La mayoría de las casas aquí se construyeron antes de 1980 y viven sus "
                                          "dueños."})
        self.assertNotIn("310539640003", json.dumps(d["why"]) + d["area"])   # no geoid on screen
        self.assertEqual(len(d["stops"]), 25)
        self.assertWalkingOrder(d["stops"])

    def test_worked_turfs_skipped_and_not_home_comes_back(self):
        storm = next(L for L in self.hud["lists"] if L["id"] == "2026-09-10_Fremont")
        res = {}
        for s in storm["stops"]:
            res[f"doors/2026-09-24_{s['pid']}"] = {"result": "no", "at": "2026-09-24T17:00:00Z", "pass": 1}
        d = todaywalk.pick(self.hud, "2026-09-25", results=todaywalk.load_results(res), cfg=self.cfg)
        self.assertEqual(d["kind"], "everyday")                 # the storm walks are fully worked
        # one not-home door on the everyday list comes back as pass 2; a "Booked" one does not come back
        res = {"doors/2026-09-24_DODGE-E3": {"result": "not_home", "pass": 1},
               "doors/2026-09-24_DODGE-E4": {"result": "booked", "pass": 1}}
        d = self.pick("2026-12-25", goal=30, results=todaywalk.load_results(res))   # room for the whole walk
        by = {s["pid"]: s for s in d["stops"]}
        self.assertEqual(by["DODGE-E3"]["pass"], 2)
        self.assertNotIn("DODGE-E4", by)
        # three not-home tries: that door is done
        res = {f"doors/2026-09-2{i}_DODGE-E3": {"result": "not_home", "pass": i} for i in (1, 2, 3)}
        self.assertNotIn("DODGE-E3", {s["pid"] for s in self.pick("2026-12-25", goal=30,
                                                                   results=todaywalk.load_results(res))["stops"]})

    def test_results_as_list_of_docs(self):
        r = todaywalk.load_results([{"id": "2026-09-24_DODGE-E3", "data": {"result": "Not home", "pass": 1}},
                                    {"pid": "DODGE-E5", "result": "Interested"}])
        self.assertEqual(r["DODGE-E3"], {"visits": 1, "done": False})
        self.assertEqual(r["DODGE-E5"], {"visits": 1, "done": True})

    def test_walking_order_sorts_by_number_and_hops_to_nearest_street(self):
        mk = lambda n, st, lat, lon: {"address": f"{n} {st}", "lat": lat, "lon": lon}  # noqa: E731
        stops = [mk(103, "A St", 0, 0.03), mk(100, "A St", 0, 0.0), mk(102, "A St", 0.0001, 0.02),
                 mk(101, "A St", 0.0001, 0.01), mk(5, "Far Rd", 1, 1), mk(201, "B St", 0.002, 0.00),
                 mk(200, "B St", 0.002, 0.03)]
        out = [s["address"] for s in todaywalk.walking_order(stops)]
        # starts at the end of A St nearest the first stop (103), B St is entered at its near end (200)
        self.assertEqual(out, ["103 A St", "102 A St", "101 A St", "100 A St", "201 B St", "200 B St", "5 Far Rd"])

    def test_nothing_left_returns_none(self):
        self.assertIsNone(todaywalk.pick({"lists": [], "everyday_lists": []}, "2026-09-25", cfg=self.cfg))

    def test_cli_prints_and_writes_the_doc(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, "walk.json")
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                rc = hh.main(["todaywalk", "--hud", FIX, "--date", "2026-09-25", "--doors", "12", "--out", out])
            self.assertEqual(rc, 0)
            with open(out) as f:
                d = json.load(f)
            self.assertEqual(json.loads(buf.getvalue()), d)
            self.assertEqual(set(d), KEYS)
            self.assertEqual(len(d["stops"]), 12)
            self.assertEqual(d["goal_doors"], 12)
            self.assertTrue(re.match(r"^\d{4}-\d{2}-\d{2}$", d["date"]))


if __name__ == "__main__":
    unittest.main()
