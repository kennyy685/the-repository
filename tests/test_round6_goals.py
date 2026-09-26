"""Offline tests for research round 6 item 5 (docs/research/2026-09-26-round-6.md): honest app goals.
- `hh.py todaywalk`: Dec-Feb shrinks the door goal to ~65% (config today_walk.goal_factor_by_month, never below 10)
  and every walk carries goal_note {en, es} ("25 doors is a starting session, not a full day").
- `hh.py weekly`: contact_rate (No + Interested + Booked over all doors tapped) in totals and per walk, plus
  `benchmarks` (rookie ranges + an honest "first weeks are near the low end" note).
Fixtures: tests/fixtures/today_hud.json, weekly_doors.json, weekly_leads.json."""
import json
import os
import sys
import tempfile
import unittest
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from hailhunter import config as C  # noqa: E402
from hailhunter import todaywalk, weekly  # noqa: E402

FIX = os.path.join(HERE, "fixtures")


def load(name):
    with open(os.path.join(FIX, name)) as f:
        return json.load(f)


class WinterGoal(unittest.TestCase):
    def setUp(self):
        self.hud = load("today_hud.json")
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))

    def test_goal_by_month(self):
        g = lambda d, goal=None: todaywalk.goal_for(date.fromisoformat(d), goal, self.cfg)  # noqa: E731
        self.assertEqual(g("2026-09-25"), 25)                   # in season: unchanged
        self.assertEqual(g("2026-11-20"), 25)                   # November: shorter hours, same goal
        for d in ("2026-12-10", "2027-01-15", "2027-02-10"):
            self.assertEqual(g(d), 16)                          # 25 x 0.65 = 16.25
        self.assertEqual(g("2027-01-15", 12), 10)               # 7.8 -> floor of 10 doors
        self.assertEqual(g("2027-01-15", 8), 8)                 # never raises a goal that's already small
        self.assertEqual(g("2027-03-05", 40), 40)

    def test_winter_walk_is_smaller_with_note(self):
        d = todaywalk.today_doc(self.hud, "2026-12-15", cfg=self.cfg)
        self.assertEqual((d["kind"], d["goal_doors"], len(d["stops"])), ("storm", 16, 16))
        self.assertIn("Short cold day: a smaller goal is normal", d["goal_note"]["en"])
        self.assertIn("16 doors is a starting session, not a full day", d["goal_note"]["en"])
        self.assertIn("Día corto y frío", d["goal_note"]["es"])

    def test_summer_walk_keeps_goal_with_note(self):
        d = todaywalk.today_doc(self.hud, "2026-09-25", cfg=self.cfg)
        self.assertEqual(d["goal_doors"], 25)
        self.assertEqual(d["goal_note"]["en"], "25 doors is a starting session, not a full day.")
        self.assertIn("sesión para empezar", d["goal_note"]["es"])

    def test_config_override(self):
        cfg = {**self.cfg, "today_walk": {**self.cfg["today_walk"], "goal_factor_by_month": {"9": 0.5}}}
        self.assertEqual(todaywalk.goal_for(date(2026, 9, 25), None, cfg), 12)   # 12.5 -> 12
        self.assertEqual(todaywalk.goal_for(date(2027, 1, 15), None, cfg), 25)   # winter not listed -> 1.0


class ContactRate(unittest.TestCase):
    def setUp(self):
        self.doc = weekly.report(weekly.load_doors(load("weekly_doors.json")),
                                 weekly.load_leads(load("weekly_leads.json")),
                                 week="2026-39", hud=load("today_hud.json"), today="2026-09-26")

    def test_totals_and_walks(self):
        t = self.doc["totals"]
        self.assertEqual(t["contact_rate"], round(10 / 21, 3))  # 10 answered (No + Interested + Booked) of 21
        walks = {w["walk_id"]: w for w in self.doc["by_walk"]}
        w = walks["2026-09-10_Fremont~t1"]
        self.assertEqual(w["contact_rate"], round(w["answered"] / w["doors"], 3))
        self.assertEqual(w["contact_rate"], 0.4)               # 10 doors, 60% not home
        for w in self.doc["by_walk"]:
            self.assertEqual(w["contact_rate"], round((w["no"] + w["interested"] + w["booked"]) / w["doors"], 3))
        self.assertEqual(weekly.tally([])["contact_rate"], 0.0)

    def test_benchmarks_are_honest(self):
        b = self.doc["benchmarks"]
        self.assertEqual(b["contact_rate"], [0.2, 0.4])
        self.assertEqual(b["inspection_per_door"], [0.01, 0.04])
        self.assertEqual(b["sign_per_inspection"], [0.3, 0.6])
        self.assertIn("first weeks are usually near the low end; that's normal", b["note"]["en"].lower())
        self.assertTrue(b["note"]["es"])
        b["contact_rate"][0] = 9                                # the report's copy can't change the constants
        self.assertEqual(weekly.BENCHMARKS["contact_rate"], [0.2, 0.4])


if __name__ == "__main__":
    unittest.main()
