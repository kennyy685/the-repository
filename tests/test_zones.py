"""Hot zones (`hh.py zones`) + door score v2 (research round 16): zones/current and walks/<zone id> for the HMP App.
Fixture tests/fixtures/today_hud.json: a fresh Fremont storm list (2 walks), a stale Blair storm, an everyday list."""
import contextlib
import copy
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
from hailhunter import config as C, doorscore, hud, todaywalk, zones  # noqa: E402
from tests import test_hot_zones as th  # noqa: E402
from tests.test_todaywalk import KEYS, NEW_KEYS  # noqa: E402

FIX = os.path.join(HERE, "fixtures", "today_hud.json")
DAY = "2026-09-25"
ZONE_KEYS = {"id", "name", "center", "polygon", "polygon_kind", "score", "heat", "hail_in", "storm_day", "homes", "why",
             "walk_id", "kind", "dist_mi", "list_id", "turf"}
NEVER = re.compile(r"insur|asegur|seguro|deduct|deduc|guarant", re.I)


class DoorScore(unittest.TestCase):
    def setUp(self):
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))

    def s(self, stop, kind="storm", own=None, **kw):
        return doorscore.score(stop, kind, own, "2026-09-10", DAY, kw.get("cfg", self.cfg))

    def test_owner_fit_follows_round_16(self):
        house = {"hail": 2.0, "built": 1990, "value": 200000, "kind": "single"}
        self.assertEqual(self.s({**house, "sale_date": "2021-04-02"}, own=1.0)["parts"]["owner_fit"], 1.0)
        self.assertEqual(self.s({**house, "sale_date": "2001-04-02"}, own=1.0)["parts"]["owner_fit"], 0.7)
        self.assertEqual(self.s(house, own=0.0)["parts"]["owner_fit"], 0.4)
        self.assertEqual(self.s({**house, "owner_occ": True, "sale_date": "2020-01-01"}, own=0.1)["parts"]["owner_fit"], 1.0)
        self.assertEqual(self.s(house)["parts"]["owner_basis"], "unknown")

    def test_score_is_the_product_and_why_is_plain(self):
        d = self.s({"hail": 1.6, "built": 1978, "value": 160000, "kind": "single", "sale_date": "2021-05-01"}, own=0.72)
        p = d["parts"]
        want = 100 * p["hail"] * p["owner_fit"] * p["kind"] * p["roof_age"] * p["value"] * p["sold_after_storm"]
        self.assertAlmostEqual(d["score"], round(want, 1))
        self.assertEqual(d["why"]["en"], '1.6" hail, built 1978, likely owner-occupied (area 72% owners), bought 2021')
        self.assertEqual(d["why"]["es"], "Granizo de 1.6 pulg., construida en 1978, probablemente vive el dueño "
                                         "(72% dueños en la zona), comprada en 2021")
        self.assertIsNone(NEVER.search(d["why"]["en"] + d["why"]["es"]))

    def test_sold_after_storm_and_rentals_score_lower(self):
        base = {"hail": 1.6, "built": 1978, "value": 160000, "kind": "single"}
        good = self.s(base, own=0.8)["score"]
        sold = self.s({**base, "sold_after_storm": True, "sale_date": "2026-09-20"}, own=0.8)
        self.assertLess(sold["score"], good)
        self.assertIn("sold after the storm (2026)", sold["why"]["en"])
        self.assertLess(self.s(base, own=0.2)["score"], good)
        self.assertIn("many renters here", self.s(base, own=0.2)["why"]["en"])
        self.assertLess(self.s({**base, "kind": "multi"}, own=0.8)["score"], good)

    def test_weights_come_from_config(self):
        cfg = copy.deepcopy(self.cfg)
        cfg["door_score"]["renter_base"] = 0.1
        stop = {"hail": 1.6, "built": 1978, "value": 160000}
        self.assertLess(self.s(stop, own=0.0, cfg=cfg)["score"], self.s(stop, own=0.0)["score"])
        with open(os.path.join(os.path.dirname(HERE), "config.json")) as f:
            self.assertIn("door_score", json.load(f))                   # FilthE/Claude edit the weights there


class Zones(unittest.TestCase):
    def setUp(self):
        with open(FIX) as f:
            self.hud = json.load(f)
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))

    def test_zones_doc(self):
        d = zones.zones(self.hud, DAY, cfg=self.cfg)
        self.assertEqual(d["as_of"], DAY)
        ids = [z["id"] for z in d["zones"]]
        self.assertEqual(set(ids), {"2026-09-10_Fremont~t1", "2026-09-10_Fremont~t2", "everyday_Fremont_310539640003~t1"})
        self.assertFalse(any("Blair" in i for i in ids))                # 208-day-old storm in September: not a zone
        scores = [z["score"] for z in d["zones"]]
        self.assertEqual(scores, sorted(scores, reverse=True))
        self.assertEqual(d["zones"][0]["heat"], 1.0)
        for z in d["zones"]:
            self.assertEqual(set(z), ZONE_KEYS)
            self.assertEqual(z["walk_id"], z["id"])
            self.assertTrue(0 <= z["heat"] <= 1)
            if z["polygon"] is None:                                   # houses in one straight line: no outline
                self.assertIsNone(z["polygon_kind"])
            else:
                self.assertEqual(z["polygon_kind"], "walk")
                self.assertEqual(z["polygon"][0], z["polygon"][-1])
                self.assertGreaterEqual(len(z["polygon"]), 4)
            self.assertTrue(z["why"]["en"] and z["why"]["es"])
            if z["kind"] == "storm":
                self.assertEqual(z["storm_day"], "2026-09-10")
                self.assertIsNotNone(z["hail_in"])
            else:
                self.assertIsNone(z["storm_day"])
        t1 = next(z for z in d["zones"] if z["id"] == "2026-09-10_Fremont~t1")
        self.assertEqual(t1["homes"], 20)                               # houses only: no apartment, no commercial

    def test_radius_top_and_done_doors(self):
        d = zones.zones(self.hud, DAY, near={"name": "Far", "lat": 40.0, "lon": -100.0}, radius_mi=10, cfg=self.cfg)
        self.assertEqual(d["zones"], [])
        self.assertIn("10 miles of Far", d["none_reason"]["en"])
        self.assertEqual(len(zones.zones(self.hud, DAY, top=1, cfg=self.cfg)["zones"]), 1)
        storm = next(L for L in self.hud["lists"] if L["id"] == "2026-09-10_Fremont")
        res = todaywalk.load_results({f"doors/2026-09-24_{s['pid']}": {"result": "no"} for s in storm["stops"]
                                      if s["turf"] == 2})
        ids = [z["id"] for z in zones.zones(self.hud, DAY, results=res, cfg=self.cfg)["zones"]]
        self.assertNotIn("2026-09-10_Fremont~t2", ids)                  # fully knocked

    def test_walk_per_zone_in_today_walk_shape(self):
        zd = zones.zones(self.hud, DAY, cfg=self.cfg)
        dnk = todaywalk.load_dnk({"dnk/105-e-4th-st-fremont": {}})
        w = zones.walks(self.hud, zd, DAY, doors=12, cfg=self.cfg, dnk=dnk)
        self.assertEqual(set(w), {f"walks/{z['id']}" for z in zd["zones"]})
        storm = next(L for L in self.hud["lists"] if L["id"] == "2026-09-10_Fremont")
        turf_of = {s["pid"]: s["turf"] for s in storm["stops"]}
        for key, doc in w.items():
            self.assertTrue(KEYS <= set(doc) <= KEYS | NEW_KEYS | {"zone_id"}, set(doc) ^ KEYS)
            self.assertEqual(f"walks/{doc['zone_id']}", key)
            self.assertLessEqual(len(doc["stops"]), 12)
            for s in doc["stops"]:
                self.assertTrue({"coach", "door", "why"} <= set(s))
                self.assertIsNone(NEVER.search(s["why"]["en"] + s["why"]["es"] + s["coach"]["en"] + s["coach"]["es"]))
            self.assertNotIn("105 E 4th St", [s["address"] for s in doc["stops"]])
        t2 = w["walks/2026-09-10_Fremont~t2"]
        self.assertEqual({turf_of[s["pid"]] for s in t2["stops"]}, {2})  # that walk only, no top-up
        t1 = w["walks/2026-09-10_Fremont~t1"]
        self.assertEqual(t1["stops"][0]["coach"]["tags"][0], "first_door")

    def test_zone_walk_picks_the_best_doors(self):
        storm = next(L for L in self.hud["lists"] if L["id"] == "2026-09-10_Fremont")
        for s in storm["stops"]:
            if s["turf"] == 1:
                s["value"] = 30000                                     # low value band ...
        for s in storm["stops"][:6]:
            s["value"] = 200000                                        # ... except six houses
        zd = {"zones": [{"id": "2026-09-10_Fremont~t1", "list_id": "2026-09-10_Fremont", "turf": 1}]}
        doc = zones.walks(self.hud, zd, DAY, doors=6, cfg=self.cfg)["walks/2026-09-10_Fremont~t1"]
        self.assertEqual({s["pid"] for s in doc["stops"]}, {s["pid"] for s in storm["stops"][:6] if s["turf"] == 1})

    def test_cli(self):
        with tempfile.TemporaryDirectory() as t:
            zp, wp = os.path.join(t, "z.json"), os.path.join(t, "w.json")
            with contextlib.redirect_stdout(io.StringIO()):
                rc = hh.main(["zones", "--hud", FIX, "--date", DAY, "--near", "41.43,-96.49", "--radius", "30",
                              "--top", "2", "--doors", "8", "--out", zp, "--walks-out", wp])
            self.assertEqual(rc, 0)
            with open(zp, encoding="utf-8") as f:
                z = json.load(f)
            self.assertEqual(len(z["zones"]), 2)
            with open(wp, encoding="utf-8") as f:
                w = json.load(f)
            self.assertEqual(len(w), 2)
            self.assertTrue(all(len(d["stops"]) <= 8 for d in w.values()))
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(hh.main(["zones", "--hud", FIX, "--near", "Nowhereville Q"]), 2)


class HudFeedsDoorScore(th.Pipeline):
    """hud.json carries what door score v2 needs (additive): stop sale_date, walk owner_share/mortgage_share."""
    test_list_heat_reaches_hud = None                                   # run once, in test_hot_zones
    test_hud_shrinks_walks_when_too_big = None

    def test_hud_fields_and_block_group_outline(self):
        from hailhunter import doors
        self.conn.execute("UPDATE parcels SET sale_date='2021-06-01' WHERE pid='P0'")
        self.conn.commit()
        doors.make_list(self.conn, self.cfg, self.day, "Testville", None, log=lambda *a: None)
        _, d = hud.write(self.conn, self.cfg)
        t = d["lists"][0]["turfs"][0]
        self.assertAlmostEqual(t["owner_share"], round(300 / 380, 3))
        self.assertAlmostEqual(t["mortgage_share"], 0.7)
        sales = {s["address"]: s["sale_date"] for s in d["lists"][0]["stops"]}
        self.assertEqual(sales["100 Oak St"], "2021-06-01")
        rings = zones.bg_rings(self.conn, {"310539640003"}, 4)
        self.assertEqual(len(rings["310539640003"]), 4)                # 3 points + closing point
        self.assertEqual(zones.bg_rings(None, {"x"}), {})


if __name__ == "__main__":
    unittest.main()
