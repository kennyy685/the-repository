"""Storm stacking + roof-age sweet spot (research 2026-09-29 picks 1-2): hailhunter/stacking.py, door score part
`stack`, today's walk fields `stack` + `roof_band`, season zones `stack` + `roof_band`."""
import json
import os
import tempfile
import unittest
from datetime import date

from hailhunter import doorscore, season, stacking, todaywalk
from hailhunter.config import DEFAULTS

FREMONT = (41.45, -96.49)
PTS = [["2023-05-01", 41.45, -96.49, 2.0],     # before the 3-season window
       ["2024-06-01", 41.45, -96.49, 1.0],
       ["2025-05-01", 41.46, -96.50, 0.75],
       ["2025-05-01", 41.44, -96.50, 1.5],     # same day twice = one hail day
       ["2026-06-01", 41.45, -96.49, 0.5],     # too small
       ["2026-07-01", 41.90, -96.49, 2.0]]     # ~50 km away


class Stack(unittest.TestCase):
    def test_counts_distinct_days_in_window_radius_and_size(self):
        st = stacking.stack(*FREMONT, PTS, "2026-09-28")
        self.assertEqual(st["days"], ["2024-06-01", "2025-05-01"])
        self.assertEqual((st["count"], st["since"], st["factor"]), (2, 2024, 1.15))
        self.assertEqual(st["line"]["en"], "Hail here 2 times since 2024")
        self.assertEqual(st["line"]["es"], "Granizo aquí 2 veces desde 2024")

    def test_walk_storm_always_counted_and_factor_capped(self):
        st = stacking.stack(*FREMONT, PTS, "2026-09-28", include=["2026-09-14"])
        self.assertEqual((st["count"], st["factor"]), (3, 1.3))
        many = [[f"2025-0{m}-01", 41.45, -96.49, 1.0] for m in range(1, 8)]
        self.assertEqual(stacking.stack(*FREMONT, many, "2026-09-28")["factor"], 1.3)
        self.assertEqual(stacking.factor(0, stacking.scfg(None)), 1.0)
        self.assertEqual(stacking.factor(1, stacking.scfg(None)), 1.0)

    def test_future_days_not_counted(self):
        self.assertEqual(stacking.stack(*FREMONT, [["2026-10-01", 41.45, -96.49, 1.0]], "2026-09-28")["count"], 0)


class RoofBand(unittest.TestCase):
    def test_bands_and_estimate_label(self):
        t = date(2026, 9, 28)
        self.assertEqual(stacking.roof_band(2021, None, t)["band"], "young")
        prime = stacking.roof_band(2014, None, t)
        self.assertEqual((prime["age"], prime["band"], prime["estimate"]), (12, "prime", True))
        self.assertIn("estimate", prime["line"]["en"])
        self.assertIn("estimado", prime["line"]["es"])
        check = stacking.roof_band(1970, 2008, t)
        self.assertEqual((check["age"], check["band"], check["basis"], check["estimate"]), (18, "check", "roof", False))
        self.assertIn("check the policy first", check["line"]["en"])
        self.assertIsNone(stacking.roof_band(None, None, t))
        area = stacking.roof_band(age=10, basis="area")
        self.assertTrue(area["line"]["en"].startswith("Typical home"))

    def test_no_insured_or_payout_words(self):
        t = date(2026, 9, 28)
        lines = [stacking.roof_band(y, None, t)["line"] for y in (2022, 2014, 1990)]
        lines += [stacking.stack_line(n, 2024) for n in (0, 1, 3)]
        for ln in lines:
            for txt in ln.values():
                low = txt.lower()
                for bad in ("insured", "asegurad", "insurance will", "deductible", "deducible", "damage", "daño"):
                    self.assertNotIn(bad, low)


class DoorScore(unittest.TestCase):
    def stop(self, **kw):
        return {"hail": 1.75, "year_built": 2012, "owner_occ": True, "kind": "single", **kw}

    def test_stack_part_bumps_storm_score_capped(self):
        base = doorscore.score(self.stop(), "storm", today="2026-09-28")
        two = doorscore.score(self.stop(stack_count=2, stack_since=2024), "storm", today="2026-09-28")
        three = doorscore.score(self.stop(stack_count=5, stack_since=2024), "storm", today="2026-09-28")
        self.assertEqual(base["parts"]["stack"], 1.0)
        self.assertAlmostEqual(two["score"], min(100, round(base["score"] * 1.15, 1)), delta=0.2)
        self.assertEqual(three["parts"]["stack"], 1.3)
        self.assertLessEqual(three["score"], 100)
        self.assertIn("hail here 2 times since 2024", two["why"]["en"])
        self.assertIn("granizo aquí 2 veces desde 2024", two["why"]["es"])

    def test_everyday_walk_ignores_stack(self):
        a = doorscore.score(self.stop(), "everyday", today="2026-09-28")
        b = doorscore.score(self.stop(stack_count=3, stack_since=2024), "everyday", today="2026-09-28")
        self.assertEqual(a["score"], b["score"])

    def test_roof_band_part(self):
        d = doorscore.score(self.stop(), "storm", today="2026-09-28")
        self.assertEqual(d["parts"]["roof_band"], "prime")


class Walk(unittest.TestCase):
    def test_add_stack_sets_fields_and_off_switch(self):
        with tempfile.TemporaryDirectory() as tmp:
            json.dump({"pts": PTS}, open(os.path.join(tmp, "hail-history.json"), "w"))
            cfg = {"stacking": {"data_dir": tmp}}
            pools = {"t1": [{"pid": 1, "lat": 41.45, "lon": -96.49}, {"pid": 2, "lat": None, "lon": None}]}
            todaywalk.add_stack(pools, "2026-09-14", date(2026, 9, 28), cfg)
            s = pools["t1"][0]
            self.assertEqual((s["stack_count"], s["stack_since"]), (3, 2024))
            self.assertNotIn("stack_count", pools["t1"][1])
            off = {"t1": [{"pid": 1, "lat": 41.45, "lon": -96.49}]}
            todaywalk.add_stack(off, "2026-09-14", date(2026, 9, 28), {"stacking": {"data_dir": tmp, "use_history": False}})
            self.assertNotIn("stack_count", off["t1"][0])

    def test_missing_files_mean_no_points(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(stacking.load_points(tmp), [])


class Season(unittest.TestCase):
    def test_zone_stack_and_roof_band(self):
        sc = season.scfg(None)
        rep = {"id": "r1", "date": "2026-09-14", "utc": "2026-09-14T23:12:00Z", "lat": 41.45, "lon": -96.49,
               "size_in": 1.75, "place": "Fremont", "location": "Fremont", "county": "Dodge", "state": "NE", "by": "",
               "sources": ["lsr"], "time_local": "6:12 PM", "date_local": "2026-09-14"}
        z = {"center": {"lat": 41.45, "lon": -96.49}, "radius_km": 6, "date": "2026-09-14", "score": 70,
             "score_parts": {}, "signals": {"median_year_built": 2014}, "why": []}
        season.add_stack([z], stacking.points_from_reports([rep]) + PTS, date(2026, 9, 28), sc, None)
        self.assertEqual((z["stack"]["count"], z["stack"]["since"]), (3, 2024))
        self.assertEqual(z["score_parts"]["stack"], 1.3)
        self.assertEqual(z["score"], 91)
        self.assertEqual(z["roof_band"]["band"], "prime")
        self.assertTrue(any("3 times since 2024" in w[1]["en"] for w in z["why"]))


if __name__ == "__main__":
    unittest.main()
