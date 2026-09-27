"""Offline tests for T203: storm-age dip/bump in Hot Zones heat (research round 58 (d)). Zone heat uses
hot_zones.age_curve (flat, dip at 45-90 days, bump at 90-150, gentler tail) so winter re-knock walks rank fairly;
scoring.recency_curve (doors, calls, wind, commercial) stays as it was."""
import os
import shutil
import sys
import tempfile
import unittest
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from hailhunter import doors  # noqa: E402
from hailhunter import config as C  # noqa: E402
from hailhunter.geo import interp  # noqa: E402

WINTER = date(2027, 1, 15)


def stops(n=10):
    return [{"hail_in": 1.5, "owner_share": 0.8, "year_built": 1994, "total_value": 200000, "bg": "x"}
            for _ in range(n)]


def zone(cfg, days, area="Beatrice, NE"):
    day = (WINTER - timedelta(days=days)).isoformat()
    return doors.hot_zone(stops(), cfg, day, area, {}, WINTER)


class StormAge(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.cfg = C.load(os.path.join(self.tmp, "none.json"))

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_dip_then_bump(self):
        f = {d: zone(self.cfg, d)["parts"]["fresh"] for d in (30, 90, 150)}
        self.assertEqual(f[30], 1.0)
        self.assertLess(f[90], f[30])                 # dip: chasers still signing
        self.assertGreater(f[150], f[90])             # bump: chasers gone, homeowners still deciding

    def test_winter_walk_scores_above_old_decay(self):
        z = zone(self.cfg, 300)                       # Oct-Mar walks reach back 330 days
        old = interp(self.cfg["scoring"]["recency_curve"], 300)
        self.assertGreater(z["parts"]["fresh"], old)
        self.assertAlmostEqual(z["parts"]["fresh"], interp(self.cfg["hot_zones"]["age_curve"], 300), places=3)

    def test_recency_curve_unchanged_for_doors_and_calls(self):
        self.assertEqual(self.cfg["scoring"]["recency_curve"],
                         [[0, 1.0], [45, 1.0], [180, 0.7], [365, 0.4], [730, 0.1], [1095, 0.05]])

    def test_empty_age_curve_falls_back_to_recency(self):
        self.cfg["hot_zones"]["age_curve"] = []
        z = zone(self.cfg, 300)
        self.assertAlmostEqual(z["parts"]["fresh"], round(interp(self.cfg["scoring"]["recency_curve"], 300), 3))

    def test_second_wave_reason(self):
        self.assertIn("past the chaser rush (120 days)", zone(self.cfg, 120)["why"])
        self.assertFalse(any("chaser rush" in w for w in zone(self.cfg, 30)["why"]))
        self.assertFalse(any("chaser rush" in w for w in zone(self.cfg, 300)["why"]))


if __name__ == "__main__":
    unittest.main()
