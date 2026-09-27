"""T163: ACS B19013 median household income per block group, used ONLY as a small "can afford a job" factor
in the everyday (old-house, cash) score. Census is blocked from the sandbox, so the table comes from a fixture in
the ACS table-based summary-file format (pipe-separated, GEO_ID first, -666666666 = no estimate)."""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from hailhunter import everyday, nbhd  # noqa: E402
from tests.test_everyday import ACS, BG, QUIET, Base, add_bg  # noqa: E402

with open(os.path.join(HERE, "fixtures", "acsdt5y2024-b19013_sample.dat"), encoding="utf-8") as fh:
    B19013 = fh.read()


class Fetcher:
    def __init__(self, tables):
        self.tables, self.offline, self.s = tables, False, object()

    def get(self, url, ttl=None, cache=True):
        for t, txt in self.tables.items():
            if url.endswith(f"-{t}.dat") and "2024" in url:
                return txt.encode()
        raise RuntimeError("404 " + url)


class Income(Base):
    def test_load_acs_stores_income_per_block_group(self):
        self.assertEqual(nbhd.load_acs(self.conn, Fetcher(dict(ACS, b19013=B19013)), self.cfg, log=QUIET)[1], "2024")
        got = dict(self.conn.execute("SELECT geoid, med_income FROM acs_income"))
        self.assertEqual(got, {"310539640003": 42500, "310539640004": 88200})   # bg rows only; no-estimate dropped

    def test_missing_income_table_never_stops_the_load(self):
        self.assertEqual(nbhd.load_acs(self.conn, Fetcher(ACS), self.cfg, log=QUIET), (1, "2024"))
        self.assertIsNone(self.conn.execute("SELECT 1 FROM acs_income").fetchone())

    def test_everyday_heat_uses_income_as_a_small_factor(self):
        f = {"share_old": 0.6, "basis": "census", "owners": 0.8, "med_value": 150000, "dist_mi": 30}
        base = everyday.heat(f, self.cfg)
        rich = everyday.heat(dict(f, med_income=90000), self.cfg)
        poor = everyday.heat(dict(f, med_income=25000), self.cfg)
        self.assertEqual(rich["heat"], base["heat"])                 # unknown income = neutral, high income = 1.0
        self.assertEqual(poor["parts"]["afford"], 0.85)
        self.assertLess(poor["heat"], base["heat"])
        self.assertGreaterEqual(poor["heat"], 0.8 * base["heat"])    # small on purpose
        self.assertIn("lower incomes (~$25k/yr)", poor["why"])
        self.assertEqual(poor["parts"]["median_income"], 25000)

    def test_areas_read_income_from_the_database(self):
        add_bg(self.conn, BG, "Lowtown, NE", 41.45, -96.55, 400, 0.8, 1958, 150000)
        add_bg(self.conn, "310539640004", "Hightown, NE", 41.45, -96.45, 400, 0.8, 1958, 150000)
        nbhd.load_income(self.conn, Fetcher({"b19013": B19013}), ("1500000US31",), "2024", log=QUIET)
        a = {x["geoid"]: x for x in everyday.areas(self.conn, self.cfg)}
        self.assertEqual(a[BG]["med_income"], 42500)
        self.assertLess(a[BG]["parts"]["afford"], 1.0)
        self.assertEqual(a["310539640004"]["parts"]["afford"], 1.0)

    def test_storm_and_insurance_scores_never_read_income(self):
        root = os.path.join(os.path.dirname(HERE), "hailhunter")
        for mod in ("doorscore.py", "doors.py", "zones.py", "todaywalk.py", "hud.py", "commercial.py"):
            p = os.path.join(root, mod)
            if os.path.exists(p):
                with open(p, encoding="utf-8") as fh:
                    src = fh.read()
                self.assertNotIn("acs_income", src, mod)
                self.assertNotIn("med_income", src, mod)
        for key in ("scoring", "door_score", "nbhd"):
            self.assertNotIn("income_curve", str(self.cfg.get(key, "")), key)


if __name__ == "__main__":
    unittest.main()
