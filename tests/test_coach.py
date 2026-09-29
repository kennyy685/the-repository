"""T83 "Before the next door" card (research round 14, spec 2), trimmed by T195 (2026-09-28): every stop in
`todaywalk` gets `coach`, `{en, es, tags}` or None. Legally required / door-fact lines only: the 69-1602 opener on
the first door of the day, and a bare come-back fact. Mindset lines (reset, general), inspection tips (hail,
old-house wear, retry best-hours) and the come-back script are coaching text and are gone from this output - see
docs/orders/sales-path.md "Moved from the app". Uses tests/fixtures/today_hud.json (Fremont storm Sep 10 2026 +
an everyday list)."""
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
# T195: coaching text that must never come back out of the engine (mindset, technique tips, scripts).
COACHING = re.compile(
    r"reset|smile|sonr[ií]e|step back|paso atr[aá]s|gutters|canaletas|soft metals|metales blandos|"
    r"look at the siding|revisa el desgaste|most often home|suele estar en casa|open with|empieza con",
    re.I)


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
            if c is None:                                    # T195: null, not removed, when no rule fires
                continue
            self.assertEqual(set(c), {"en", "es", "tags"})
            self.assertTrue(c["en"] and c["es"] and 1 <= len(c["tags"]) <= 2, c)
            self.assertLess(len(c["en"]), 240)
            text = c["en"] + " " + c["es"]
            self.assertIsNone(BANNED.search(text), c)
            self.assertIsNone(COACHING.search(text), c)       # T195: no coaching text in app-bound output
            self.assertLessEqual(set(c["tags"]), {"first_door", "come_back"})

    def test_first_door_of_the_day_gets_the_69_1602_opener_only_once(self):
        d = self.pick()
        self.assertClean(d)
        first = d["stops"][0]["coach"]
        self.assertEqual(first["tags"][0], "first_door")
        self.assertIn("say your name, HMP Siding & Roofing, and what you sell", first["en"])
        self.assertIn("di tu nombre, HMP Siding & Roofing y qué vendes", first["es"])
        self.assertFalse(any(s["coach"] and "first_door" in s["coach"]["tags"] for s in d["stops"][1:]))

    def test_storm_walk_carries_no_hail_inspection_tip(self):
        # T195: the hail-at-this-house coaching line is gone; the fact still lives in the door score `why` line.
        d = self.pick()
        self.assertClean(d)
        s = d["stops"][1]
        self.assertIsNone(s["coach"])
        self.assertIn("1.6", s["why"]["en"])                 # the hail fact, via door score, not coach

    def test_three_nos_in_a_row_gets_no_reset_line_any_more(self):
        raw = {"doors/2026-09-25_DODGE-1001": {"result": "no", "at": "2026-09-25T18:01:00Z"},
               "doors/2026-09-25_DODGE-1002": {"result": "no", "at": "2026-09-25T18:05:00Z"},
               "doors/2026-09-25_DODGE-1003": {"result": "not_home", "at": "2026-09-25T18:09:00Z"},
               "doors/2026-09-25_DODGE-1004": {"result": "no", "at": "2026-09-25T18:12:00Z"},
               "doors/2026-09-24_DODGE-1005": {"result": "interested", "at": "2026-09-24T23:00:00Z"}}
        taps = todaywalk.today_taps(raw, "2026-09-25")
        self.assertEqual(taps, ["no", "no", "not_home", "no"])        # yesterday's tap left out
        self.assertEqual(todaywalk.no_streak(taps), 3)                # the counter itself still works...
        d = self.pick(results=todaywalk.load_results(raw), taps=taps)
        self.assertClean(d)
        # ...but coach_for no longer turns a 3+ streak into a "reset" line: taps is non-empty, so not first_door
        # either, so this stop's coach is None.
        self.assertIsNone(d["stops"][0]["coach"])

    def test_history_counts_every_tap(self):
        raw = [{"id": "doors/2026-09-25_X", "data": {"result": "no", "history": [
            {"result": "not_home", "at": "2026-09-25T15:00:00Z"}, {"result": "no", "at": "2026-09-25T19:00:00Z"}]}},
            {"id": "doors/2026-09-25_Y", "result": "No", "at": "2026-09-25T16:00:00Z"}]
        self.assertEqual(todaywalk.today_taps(raw, "2026-09-25"), ["not_home", "no", "no"])
        self.assertEqual(todaywalk.today_taps(None, "2026-09-25"), [])

    def test_everyday_retry_and_old_house_carry_no_coaching(self):
        # T195: neither the retry best-hours tip nor the old-house wear tip exist any more; the year_built fact
        # is still there, just via house_facts/house_line, not coach.
        res = {"doors/2027-04-14_DODGE-E3": {"result": "not_home", "pass": 1}}
        d = self.pick("2027-04-15", goal=30, results=todaywalk.load_results(res))   # a Thursday
        self.assertClean(d)
        by = {s["pid"]: s for s in d["stops"]}
        self.assertIsNone(by["DODGE-E3"]["coach"])
        other = next(s for s in d["stops"][1:] if s["pid"] != "DODGE-E3")
        self.assertIsNone(other["coach"])
        self.assertIn(f"Built {other['year_built']}", other["house_line"]["en"])   # the fact, just not in coach

    def test_come_back_promise_is_a_bare_fact_no_script(self):
        res = {"doors/2026-09-24_DODGE-1007": {"result": "not_home", "pass": 1,
                                               "come_back": {"date": "2026-09-25", "time": "17:30"}}}
        d = self.pick(results=todaywalk.load_results(res), taps=[])
        self.assertClean(d)
        c = d["stops"][0]["coach"]
        self.assertEqual(d["stops"][0]["pid"], "DODGE-1007")
        self.assertEqual(c["tags"], ["first_door", "come_back"])
        self.assertIn("come back at 5:30 PM", c["en"])
        self.assertIn("a las 5:30 p. m.", c["es"])
        self.assertNotIn("Open with", c["en"])                # T195: the suggested opening script is gone

    def test_cli_still_passes_todays_taps(self):
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
        # taps is non-empty (doors already knocked today), so the first stop is neither first_door nor reset:
        # coach is null.
        self.assertIsNone(json.loads(buf.getvalue())["stops"][0]["coach"])


if __name__ == "__main__":
    unittest.main()
