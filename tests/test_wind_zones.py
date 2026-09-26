"""T116 wind-zone score, T117 fallen-tree reports, T118 wind direction (research round 23). Offline: synthetic NWS
LSR rows in the Iowa Mesonet geojson shape (same helper as test_fixes) and a small hud dict for zones."""
import copy
import json
import os
import re
import shutil
import sys
import tempfile
import unittest
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from hailhunter import config as C, db, hud, wind, zones  # noqa: E402
from tests.test_fixes import _lsr  # noqa: E402

FIX = os.path.join(HERE, "fixtures", "today_hud.json")
DAY = "2026-09-25"
NEVER = re.compile(r"insur|asegur|seguro|deduct|deduc|guarant", re.I)


class Bands(unittest.TestCase):
    def test_gust_bands(self):
        got = [wind.band_factor(m) for m in (None, 57, 58, 64, 65, 74, 75, 89, 90, 110)]
        self.assertEqual(got, [0.0, 0.0, 0.35, 0.35, 0.65, 0.65, 0.85, 0.85, 1.0, 1.0])

    def test_zone_score_uses_hail_decay_and_config(self):
        self.assertEqual(wind.zone_score(80, 0, 10, 20)[0], 85.0)
        self.assertLess(wind.zone_score(80, 0, 365, 20)[0], 40)            # 0.4 at a year, like hail
        self.assertLess(wind.zone_score(80, 0, 10, 150)[0], 85.0)          # distance decay
        self.assertEqual(wind.zone_score(None, 2, 10, 20)[0], 35.0)        # damage report, no measured gust
        self.assertEqual(wind.zone_score(50, 0, 10, 20)[0], 0.0)
        cfg = {"wind_score": {"bands": [[50, 0.5]], "damage_only": 0.1}}
        self.assertEqual(wind.zone_score(55, 0, 10, 20, cfg)[0], 50.0)


class Parse(unittest.TestCase):
    def setUp(self):
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))

    def test_trees_and_direction_from_the_report_words(self):
        obs = wind.parse(_lsr([
            {"typetext": "TSTM WND DMG", "magnitude": None, "unit": None, "remark": "Large tree down on a house."},
            {"typetext": "TSTM WND GST", "magnitude": 68, "unit": "MPH", "remark": "Measured. Winds from the northwest."},
            {"typetext": "TSTM WND DMG", "magnitude": None, "unit": None, "remark": "Power lines down."},
            {"typetext": "HAIL", "magnitude": 1.0, "unit": "INCH", "remark": "Trees stripped"},
        ]), self.cfg)
        self.assertEqual(len(obs), 3)                                       # hail stays out of wind
        self.assertEqual([o["extra"]["trees"] for o in obs], [True, False, False])
        self.assertEqual([o["extra"]["wind_dir"] for o in obs], [None, "NW", None])
        self.assertEqual(wind.wind_dir("Report from the NWS office"), None)
        self.assertEqual(wind.wind_dir("Strong southwesterly winds"), "SW")


class HudEvents(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.cfg = C.load(os.path.join(self.tmp, "none.json"))
        self.conn = db.connect(os.path.join(self.tmp, "t.db"))            # fresh database, like the cloud

    def tearDown(self):
        self.conn.close()
        shutil.rmtree(self.tmp)

    def test_wind_events_get_score_trees_and_direction(self):
        day = (date.today() - timedelta(days=3)).isoformat()
        raw = json.loads(_lsr([
            {"typetext": "TSTM WND GST", "magnitude": 76, "unit": "MPH", "remark": "Winds from the west."},
            {"typetext": "TSTM WND DMG", "magnitude": None, "unit": None, "remark": "Trees down across town"},
            {"typetext": "TSTM WND DMG", "magnitude": None, "unit": None, "remark": "Tree limbs on a roof"},
        ]))
        for i, f in enumerate(raw["features"]):
            f["properties"]["valid"] = f"{day}T22:1{i}:00Z"
        n, _, _ = db.upsert_wind(self.conn, wind.parse(json.dumps(raw).encode(), self.cfg), self.cfg)
        self.assertEqual(n, 3)
        ev = hud._wind_events(self.conn, self.cfg, "2000-01-01")
        self.assertEqual(len(ev), 1)
        e = ev[0]
        self.assertIn("score", e)                                            # the old field stays
        self.assertEqual(e["wind_parts"]["band"], 0.85)
        self.assertEqual(e["wind_score"], 85.0)                             # Fremont, 3 days old: no decay
        self.assertEqual(e["trees_down"], 2)
        self.assertEqual(e["tree_sample"], "Trees down across town")
        self.assertEqual(e["wind_dir"], "W")


class Zones(unittest.TestCase):
    def setUp(self):
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))
        with open(FIX) as f:
            self.hud = json.load(f)
        self.plain = zones.zones(copy.deepcopy(self.hud), DAY, cfg=self.cfg)
        self.hud["wind_events"] = [
            {"day": "2026-09-20", "place": "Fremont", "state": "NE", "lat": 41.44, "lon": -96.49, "dist_mi": 1.0,
             "max_mph": 70, "damage_reports": 2, "wind_score": 65.0, "trees_down": 2, "wind_dir": "NW", "score": 30},
            {"day": "2026-09-21", "place": "Blair", "state": "NE", "lat": 41.54, "lon": -96.13, "dist_mi": 20.0,
             "max_mph": None, "damage_reports": 1, "wind_score": 35.0, "trees_down": 0, "wind_dir": None, "score": 20},
            {"day": "2026-09-21", "place": "Calm", "state": "NE", "lat": 41.5, "lon": -96.3, "dist_mi": 10.0,
             "max_mph": 50, "damage_reports": 0, "wind_score": 0.0, "trees_down": 0, "score": 5},
            {"day": "2024-01-01", "place": "Old", "state": "NE", "lat": 41.5, "lon": -96.3, "dist_mi": 10.0,
             "max_mph": 90, "damage_reports": 0, "wind_score": 90.0, "trees_down": 0, "score": 5},
            {"day": "2026-09-21", "place": "Far", "state": "KS", "lat": 38.0, "lon": -98.0, "dist_mi": 250.0,
             "max_mph": 90, "damage_reports": 0, "wind_score": 40.0, "trees_down": 0, "score": 5}]

    def test_wind_zones_are_their_own_layer_after_the_walks(self):
        d = zones.zones(self.hud, DAY, cfg=self.cfg)
        walks = [z for z in d["zones"] if z["kind"] != "wind"]
        wz = [z for z in d["zones"] if z["kind"] == "wind"]
        self.assertEqual(walks, self.plain["zones"])                         # walk zones unchanged
        self.assertEqual([z["id"] for z in wz], ["wind~2026-09-20~fremont", "wind~2026-09-21~blair"])
        self.assertEqual(d["zones"][-len(wz):], wz)                          # listed after the walks
        f = wz[0]
        self.assertEqual((f["score"], f["heat"], f["trees_down"], f["wind_dir"], f["max_mph"]), (65.0, 1.0, 2, "NW", 70))
        self.assertIsNone(f["walk_id"])
        self.assertIn("fallen-tree", f["why"]["en"])
        self.assertIn("árboles caídos", f["why"]["es"])
        self.assertIn("wind damage reported", wz[1]["why"]["en"])
        for z in wz:
            self.assertFalse(NEVER.search(z["why"]["en"] + z["why"]["es"]))
        self.assertEqual(len(zones.zones(self.hud, DAY, top=1, cfg=self.cfg)["zones"]), 1 + len(wz))
        cfg = dict(self.cfg, zones=dict(self.cfg["zones"], wind_top=1))
        self.assertEqual(len([z for z in zones.zones(self.hud, DAY, cfg=cfg)["zones"] if z["kind"] == "wind"]), 1)

    def test_walks_skip_wind_zones(self):
        d = zones.zones(self.hud, DAY, cfg=self.cfg)
        w = zones.walks(self.hud, d, DAY, cfg=self.cfg)
        self.assertFalse([k for k in w if "wind~" in k])
        self.assertEqual(set(w), set(zones.walks(self.hud, self.plain, DAY, cfg=self.cfg)))


if __name__ == "__main__":
    unittest.main()
