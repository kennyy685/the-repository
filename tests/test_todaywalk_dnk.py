"""Offline tests for two HMP App features in `hh.py todaywalk`: do-not-knock houses (`--dnk`, the app's
dnk/<slug> docs) and "come back at..." times on not-home door results. Fixture: tests/fixtures/today_hud.json."""
import contextlib
import io
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import config as C  # noqa: E402
from hailhunter import todaywalk  # noqa: E402

FIX = os.path.join(HERE, "fixtures", "today_hud.json")
DAY = "2026-09-25"


class DoNotKnock(unittest.TestCase):
    def setUp(self):
        with open(FIX) as f:
            self.hud = json.load(f)
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))

    def test_load_dnk_accepts_dict_list_slug_and_address(self):
        got = todaywalk.load_dnk({"dnk/105-e-4th-st-fremont": {"address": "105 E 4th St", "city": "Fremont"}})
        self.assertEqual(got, {"105-e-4th-st-fremont"})
        got = todaywalk.load_dnk([{"slug": "103-e-4th-st-fremont"},
                                  {"id": "dnk/x", "data": {"address": "111 Linden St", "city": "FREMONT"}},
                                  {"address": "9 Oak Ave"}])
        self.assertTrue({"103-e-4th-st-fremont", "111-linden-st-fremont", "9-oak-ave"} <= got)
        self.assertEqual(todaywalk.load_dnk(None), set())

    def test_dnk_houses_never_in_the_walk(self):
        base = todaywalk.pick(self.hud, DAY, cfg=self.cfg)
        gone = base["stops"][:3]
        dnk = todaywalk.load_dnk({f"dnk/{todaywalk.slug(s['address'], s['city'])}":
                                  {"address": s["address"], "city": s["city"]} for s in gone})
        d = todaywalk.pick(self.hud, DAY, cfg=self.cfg, dnk=dnk)
        addrs = {s["address"] for s in d["stops"]}
        for s in gone:
            self.assertNotIn(s["address"], addrs)
        self.assertEqual(len(d["stops"]), 25)                  # topped up from other doors
        # an address-only entry (no city) also blocks the house
        d = todaywalk.pick(self.hud, DAY, cfg=self.cfg, dnk=todaywalk.load_dnk([{"address": gone[0]["address"]}]))
        self.assertNotIn(gone[0]["address"], {s["address"] for s in d["stops"]})

    def test_cli_dnk_flag(self):
        base = todaywalk.pick(self.hud, DAY, cfg=self.cfg)
        s0 = base["stops"][0]
        with tempfile.TemporaryDirectory() as tmp:
            p = os.path.join(tmp, "dnk.json")
            with open(p, "w") as f:
                json.dump([{"slug": todaywalk.slug(s0["address"], s0["city"])}], f)
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                rc = hh.main(["todaywalk", "--hud", FIX, "--date", DAY, "--dnk", p])
            self.assertEqual(rc, 0)
            self.assertNotIn(s0["pid"], {s["pid"] for s in json.loads(buf.getvalue())["stops"]})


class ComeBack(unittest.TestCase):
    def setUp(self):
        with open(FIX) as f:
            self.hud = json.load(f)
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))

    def pick(self, res, day=DAY):
        return todaywalk.pick(self.hud, day, results=todaywalk.load_results(res), cfg=self.cfg)

    def test_parse_come_back_forms(self):
        P = todaywalk.parse_come_back
        self.assertEqual(P("2026-09-25T17:30"), {"date": "2026-09-25", "time": "17:30"})
        self.assertEqual(P("2026-09-25T22:30:00Z"), {"date": "2026-09-25", "time": "17:30"})   # UTC -> Central
        self.assertEqual(P("2026-09-27"), {"date": "2026-09-27", "time": None})
        self.assertEqual(P({"date": "2026-09-25", "time": "9:05"}), {"date": "2026-09-25", "time": "09:05"})
        self.assertIsNone(P("tomorrow"))
        self.assertIsNone(P(None))

    def test_due_today_goes_first_with_come_back_field(self):
        res = {"doors/2026-09-24_DODGE-1003": {"result": "not_home", "pass": 1, "come_back": "2026-09-25T17:30"},
               "doors/2026-09-24_DODGE-1001": {"result": "not_home", "pass": 1,
                                               "come_back": {"date": "2026-09-25", "time": "16:00"}}}
        d = self.pick(res)
        self.assertEqual([s["pid"] for s in d["stops"][:2]], ["DODGE-1001", "DODGE-1003"])   # earliest first
        self.assertEqual(d["stops"][0]["come_back"], {"date": "2026-09-25", "time": "16:00"})
        self.assertEqual(d["stops"][1]["come_back"], {"date": "2026-09-25", "time": "17:30"})
        self.assertEqual(d["stops"][0]["pass"], 2)
        self.assertEqual(len(d["stops"]), 25)
        self.assertTrue(all("come_back" not in s for s in d["stops"][2:]))

    def test_later_date_skipped_until_that_day(self):
        res = {"doors/2026-09-24_DODGE-1001": {"result": "not_home", "pass": 1, "come_back": "2026-09-27"}}
        self.assertNotIn("DODGE-1001", {s["pid"] for s in self.pick(res)["stops"]})
        d = self.pick(res, "2026-09-27")
        self.assertEqual(d["stops"][0]["pid"], "DODGE-1001")
        self.assertEqual(d["stops"][0]["come_back"], {"date": "2026-09-27", "time": None})

    def test_latest_visit_wins_and_talked_to_clears_it(self):
        res = {"doors/2026-09-23_DODGE-1001": {"result": "not_home", "pass": 1, "come_back": "2026-09-25T17:00"},
               "doors/2026-09-24_DODGE-1001": {"result": "not_home", "pass": 2}}
        self.assertNotIn("come_back", todaywalk.load_results(res)["DODGE-1001"])
        res["doors/2026-09-24_DODGE-1001"] = {"result": "booked", "pass": 2}
        self.assertNotIn("DODGE-1001", {s["pid"] for s in self.pick(res)["stops"]})

    def test_come_back_on_another_list_still_goes_first(self):
        # the storm list wins today, but an everyday house was promised a come-back at 4:30 PM today
        res = {"doors/2026-09-24_DODGE-E3": {"result": "not_home", "pass": 1, "come_back": "2026-09-25T16:30"},
               "doors/2026-09-24_DODGE-1001": {"result": "not_home", "pass": 1, "come_back": "2026-09-25T18:00"}}
        d = self.pick(res)
        self.assertEqual(d["list_id"], "2026-09-10_Fremont")
        self.assertEqual([s["pid"] for s in d["stops"][:2]], ["DODGE-E3", "DODGE-1001"])      # earliest first
        self.assertEqual(d["stops"][0]["come_back"], {"date": "2026-09-25", "time": "16:30"})
        self.assertEqual(d["stops"][0]["address"], "403 Pine St")
        self.assertEqual(d["stops"][0]["pass"], 2)
        self.assertEqual(len(d["stops"]), 25)                  # counts toward goal_doors
        self.assertEqual(d["goal_doors"], 25)
        self.assertEqual(sum("come_back" in s for s in d["stops"]), 2)
        self.assertEqual(len({s["pid"] for s in d["stops"]}), 25)

    def test_come_back_kept_even_when_no_walk_qualifies(self):
        hud = {"lists": [], "everyday_lists": [{"id": "everyday_X", "area": "Fremont, NE", "why": [],
               "turfs": [{"turf": 1}], "stops": [
                   {"pid": "P1", "address": "1 Elm St", "lat": 41.43, "lon": -96.49, "kind": "single", "turf": 1},
                   {"pid": "P2", "address": "3 Elm St", "lat": 41.431, "lon": -96.49, "kind": "single", "turf": 1}]}]}
        res = todaywalk.load_results({"doors/2026-09-24_P2": {"result": "not_home", "come_back": "2026-09-25T17:00"}})
        self.assertIsNone(todaywalk.pick(hud, DAY, cfg=self.cfg))       # 2 doors: too few for a walk
        d = todaywalk.pick(hud, DAY, results=res, cfg=self.cfg)
        self.assertEqual(d["stops"][0]["pid"], "P2")
        self.assertEqual(d["stops"][0]["come_back"]["time"], "17:00")
        self.assertEqual(d["stops"][0]["city"], "Fremont")


if __name__ == "__main__":
    unittest.main()
