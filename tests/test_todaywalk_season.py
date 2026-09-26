"""Offline tests for the seasonal `hh.py todaywalk` (off-season plan, docs/research/2026-09-26-off-season-plan.md):
Oct-Mar re-knocks storms up to ~330 days old that aren't fully worked; Apr-Sep keeps 60 days. Short-day months
get shorter weekday knock hours (Nov-Feb 3:30-5:30 PM + "End by dusk"; Oct and Mar 4-6:30 PM).
Fixture: tests/fixtures/today_hud.json (storms 2026-09-10 Fremont heat 40.2, 2026-03-01 Blair heat 80)."""
import json
import os
import sys
import tempfile
import unittest
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from hailhunter import config as C  # noqa: E402
from hailhunter import todaywalk  # noqa: E402

FIX = os.path.join(HERE, "fixtures", "today_hud.json")


def load(p):
    with open(p) as f:
        return json.load(f)


class SeasonalStormAge(unittest.TestCase):
    def setUp(self):
        self.hud = load(FIX)
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))

    def test_limit_by_month(self):
        self.assertEqual(todaywalk.storm_max_days(date(2026, 9, 25), self.cfg), 60)
        self.assertEqual(todaywalk.storm_max_days(date(2027, 4, 15), self.cfg), 60)
        for m in (10, 11, 12, 1, 2, 3):
            self.assertEqual(todaywalk.storm_max_days(date(2027 if m < 4 else 2026, m, 5), self.cfg), 330)

    def test_in_season_old_storm_is_skipped(self):
        d = todaywalk.pick(self.hud, "2026-09-25", cfg=self.cfg)       # Blair is 208 days old: too old in September
        self.assertEqual(d["list_id"], "2026-09-10_Fremont")

    def test_off_season_old_storm_comes_back(self):
        d = todaywalk.pick(self.hud, "2026-10-15", cfg=self.cfg)       # 228 days old: OK in October
        self.assertEqual((d["kind"], d["list_id"]), ("storm", "2026-03-01_Blair"))
        d = todaywalk.pick(self.hud, "2027-01-20", cfg=self.cfg)       # 325 days: still OK
        self.assertEqual(d["list_id"], "2026-03-01_Blair")
        d = todaywalk.pick(self.hud, "2027-01-26", cfg=self.cfg)       # 331 days: too old -> the fresher storm
        self.assertEqual(d["list_id"], "2026-09-10_Fremont")

    def test_off_season_fully_worked_storms_fall_back_to_everyday(self):
        res = {f"doors/2026-10-01_{s['pid']}": {"result": "no", "pass": 1}
               for L in self.hud["lists"] for s in L["stops"]}
        d = todaywalk.pick(self.hud, "2026-11-16", results=todaywalk.load_results(res), cfg=self.cfg)
        self.assertEqual(d["kind"], "everyday")

    def test_config_json_can_change_a_month(self):
        cfg = dict(self.cfg, today_walk={**self.cfg["today_walk"], "storm_max_days_by_month": {"10": 60}})
        d = todaywalk.pick(self.hud, "2026-10-15", cfg=cfg)
        self.assertEqual(d["list_id"], "2026-09-10_Fremont")


class SeasonalBestTime(unittest.TestCase):
    def setUp(self):
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))

    def test_short_days_end_by_dusk(self):
        b = todaywalk.best_time("2026-11-16", self.cfg)                 # a Monday in November
        self.assertEqual((b["start"], b["end"]), ("15:30", "17:30"))
        self.assertEqual(b["en"], "Best time to knock today: 3:30-5:30 PM. End by dusk.")
        self.assertEqual(b["es"], "Mejor hora para tocar puertas hoy: de 3:30 a 5:30 p. m. "
                                  "Terminen antes de que oscurezca.")
        self.assertEqual(todaywalk.best_time("2027-02-10", self.cfg)["start"], "15:30")

    def test_october_and_march(self):
        for d in ("2026-10-14", "2027-03-03"):
            b = todaywalk.best_time(d, self.cfg)
            self.assertEqual((b["start"], b["end"]), ("16:00", "18:30"))
            self.assertEqual(b["en"], "Best time to knock today: 4-6:30 PM.")

    def test_summer_unchanged_and_sunday_points_to_short_monday(self):
        b = todaywalk.best_time("2026-09-24", self.cfg)
        self.assertEqual((b["start"], b["end"]), ("16:00", "19:30"))
        self.assertEqual(todaywalk.best_time("2026-07-11", self.cfg)["start"], "10:00")   # Saturday unchanged
        sun = todaywalk.best_time("2026-12-27", self.cfg)
        self.assertIsNone(sun["start"])
        self.assertIn("Monday 3:30-5:30 PM", sun["en"])

    def test_today_doc_carries_the_seasonal_time(self):
        doc = todaywalk.today_doc(load(FIX), "2026-11-16", cfg=self.cfg)
        self.assertEqual(doc["best_time"]["start"], "15:30")


if __name__ == "__main__":
    unittest.main()
