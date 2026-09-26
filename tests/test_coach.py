"""T83 "Before the next door" coaching card (research round 14, spec 2): every stop in `todaywalk` gets a short,
rule-based `coach {en, es, tags}`. Uses tests/fixtures/today_hud.json (Fremont storm Sep 10 2026 + an everyday list)."""
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
BANNED = re.compile(r"deductib|deducib|insurance|seguro|aseguradora|waive|rebate|pay|pag[ao]|free roof|licens", re.I)


class Coach(unittest.TestCase):
    def setUp(self):
        with open(FIX) as f:
            self.hud = json.load(f)
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))

    def pick(self, day="2026-09-25", **kw):
        return todaywalk.pick(self.hud, day, cfg=self.cfg, **kw)

    def assertClean(self, d):
        for s in d["stops"]:
            c = s["coach"]
            self.assertEqual(set(c), {"en", "es", "tags"})
            self.assertTrue(c["en"] and c["es"] and 1 <= len(c["tags"]) <= 2, c)
            self.assertLess(len(c["en"]), 240)
            self.assertIsNone(BANNED.search(c["en"] + " " + c["es"]), c)

    def test_first_door_of_the_day_gets_the_69_1602_opener_only_once(self):
        d = self.pick()
        self.assertClean(d)
        first = d["stops"][0]["coach"]
        self.assertEqual(first["tags"][0], "first_door")
        self.assertIn("say your name, HMP Siding & Roofing, and what you sell", first["en"])
        self.assertIn("di tu nombre, HMP Siding & Roofing y qué vendes", first["es"])
        self.assertFalse(any("first_door" in s["coach"]["tags"] for s in d["stops"][1:]))

    def test_storm_walk_gives_the_hail_at_that_house(self):
        s = self.pick()["stops"][1]
        self.assertEqual(s["coach"]["tags"], ["hail"])
        self.assertTrue(s["coach"]["en"].startswith("1.6-inch hail here on Sep 10: check the gutters and soft metals"),
                        s["coach"]["en"])
        self.assertTrue(s["coach"]["es"].startswith("Aquí cayó granizo de 1.6 pulg. el 10 de sep"))

    def test_hail_evidence_from_hud_wins(self):
        d0 = self.pick()
        s = d0["stops"][2]
        self.hud["hail_evidence"] = {f"{s['address']}|{s['city']}": {"day": "2026-09-12", "hail_in": 1.44,
                                                                    "nearest_report": None, "radar_max_in": 1.2}}
        c = next(x for x in self.pick()["stops"] if x["pid"] == s["pid"])["coach"]
        self.assertTrue(c["en"].startswith("1.4-inch hail here on Sep 12"), c["en"])

    def test_three_nos_in_a_row_today_gets_a_reset_line(self):
        raw = {"doors/2026-09-25_DODGE-1001": {"result": "no", "at": "2026-09-25T18:01:00Z"},
               "doors/2026-09-25_DODGE-1002": {"result": "no", "at": "2026-09-25T18:05:00Z"},
               "doors/2026-09-25_DODGE-1003": {"result": "not_home", "at": "2026-09-25T18:09:00Z"},
               "doors/2026-09-25_DODGE-1004": {"result": "no", "at": "2026-09-25T18:12:00Z"},
               "doors/2026-09-24_DODGE-1005": {"result": "interested", "at": "2026-09-24T23:00:00Z"}}
        taps = todaywalk.today_taps(raw, "2026-09-25")
        self.assertEqual(taps, ["no", "no", "not_home", "no"])        # yesterday's tap left out
        self.assertEqual(todaywalk.no_streak(taps), 3)
        d = self.pick(results=todaywalk.load_results(raw), taps=taps)
        self.assertClean(d)
        c = d["stops"][0]["coach"]
        self.assertEqual(c["tags"][0], "reset")                          # not the first door any more
        self.assertIn("Reset, smile, next door.", c["en"])
        # two no's then an Interested: no reset
        raw["doors/2026-09-25_DODGE-1006"] = {"result": "interested", "at": "2026-09-25T18:20:00Z"}
        self.assertEqual(todaywalk.no_streak(todaywalk.today_taps(raw, "2026-09-25")), 0)
        d = self.pick(results=todaywalk.load_results(raw), taps=todaywalk.today_taps(raw, "2026-09-25"))
        self.assertNotIn("reset", d["stops"][0]["coach"]["tags"])
        self.assertNotIn("first_door", d["stops"][0]["coach"]["tags"])

    def test_history_counts_every_tap(self):
        raw = [{"id": "doors/2026-09-25_X", "data": {"result": "no", "history": [
            {"result": "not_home", "at": "2026-09-25T15:00:00Z"}, {"result": "no", "at": "2026-09-25T19:00:00Z"}]}},
            {"id": "doors/2026-09-25_Y", "result": "No", "at": "2026-09-25T16:00:00Z"}]
        self.assertEqual(todaywalk.today_taps(raw, "2026-09-25"), ["not_home", "no", "no"])
        self.assertEqual(todaywalk.today_taps(None, "2026-09-25"), [])

    def test_everyday_retry_and_old_house(self):
        res = {"doors/2027-04-14_DODGE-E3": {"result": "not_home", "pass": 1}}
        d = self.pick("2027-04-15", goal=30, results=todaywalk.load_results(res))   # a Thursday
        self.assertClean(d)
        by = {s["pid"]: s["coach"] for s in d["stops"]}
        self.assertEqual(by["DODGE-E3"]["tags"], ["retry", "old_house"])
        self.assertIn("Not home last time. People are most often home", by["DODGE-E3"]["en"])
        other = next(s for s in d["stops"][1:] if s["pid"] != "DODGE-E3")
        self.assertEqual(other["coach"]["tags"], ["old_house"])
        self.assertIn(f"Built {other['year_built']}", other["coach"]["en"])

    def test_come_back_promise(self):
        res = {"doors/2026-09-24_DODGE-1007": {"result": "not_home", "pass": 1,
                                               "come_back": {"date": "2026-09-25", "time": "17:30"}}}
        d = self.pick(results=todaywalk.load_results(res), taps=[])
        self.assertClean(d)
        c = d["stops"][0]["coach"]
        self.assertEqual(d["stops"][0]["pid"], "DODGE-1007")
        self.assertEqual(c["tags"], ["first_door", "come_back"])
        self.assertIn("come back at 5:30 PM", c["en"])
        self.assertIn("a las 5:30 p. m.", c["es"])

    def test_cli_passes_todays_taps(self):
        raw = {f"doors/2026-09-25_DODGE-10{n:02d}": {"result": "no", "at": f"2026-09-25T18:{n:02d}:00Z"}
               for n in (1, 2, 3)}
        with tempfile.TemporaryDirectory() as t:
            p = os.path.join(t, "doors.json")
            with open(p, "w") as f:
                json.dump(raw, f)
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                rc = hh.main(["todaywalk", "--hud", FIX, "--date", "2026-09-25", "--results", p])
        self.assertEqual(rc, 0)
        self.assertEqual(json.loads(buf.getvalue())["stops"][0]["coach"]["tags"][0], "reset")


if __name__ == "__main__":
    unittest.main()
