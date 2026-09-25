"""Offline tests for Hot Zones (T23): chance-of-a-sale heat per walk, mortgages, more walks, close storms."""
import json
import os
import shutil
import sys
import tempfile
import unittest
from datetime import date, timedelta

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import db, doors, hud, mrms, nbhd  # noqa: E402
from hailhunter import config as C  # noqa: E402

TODAY = date(2026, 9, 25)


def stop(hail=1.5, own=0.8, built=1994, value=200000, sale=None, bg="310539640003"):
    return {"hail_in": hail, "owner_share": own, "year_built": built, "total_value": value, "sale_date": sale, "bg": bg}


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.cfg = C.load(os.path.join(self.tmp, "none.json"))
        self.cfg["paths"] = {k: os.path.join(self.tmp, k) for k in ("db", "cache", "export")}
        os.makedirs(self.cfg["paths"]["export"])
        self.conn = db.connect(self.cfg["paths"]["db"])

    def tearDown(self):
        self.conn.close()
        shutil.rmtree(self.tmp)


class Heat(Base):
    def test_formula_and_reasons(self):
        stops = [stop() for _ in range(60)]
        z = doors.hot_zone(stops, self.cfg, "2026-09-12", "Beatrice, NE", {"310539640003": 0.7}, TODAY)
        damage = 0.4 + 0.6 * 0.5                                  # 1.5" on the 1.0 -> 2.0 line
        insured = 0.5 + 0.5 * 0.8 * (0.6 + 0.4 * 0.7)
        size = 0.8 + 0.2 * 200000 / 250000
        expected = round(100 * damage * insured * 1.0 * size * 1.0, 1)    # 32-year roofs, 13 days old, no competition
        self.assertEqual(z["heat"], expected)
        self.assertEqual(z["why"], ['1.5" hail', "80% owners", "roofs ~1994", "fresh storm (13 days)"])
        self.assertEqual(z["exp_inspections"], round(60 * 0.03 * expected / 50, 1))

    def test_young_roofs_competition_and_old_storm_score_lower(self):
        base = doors.hot_zone([stop() for _ in range(10)], self.cfg, "2026-09-12", "Beatrice, NE", {}, TODAY)
        young = doors.hot_zone([stop(built=2021) for _ in range(10)], self.cfg, "2026-09-12", "Beatrice, NE", {}, TODAY)
        self.assertAlmostEqual(young["heat"], round(base["heat"] * 0.5, 1), delta=0.1)          # roof < 8 years
        omaha = doors.hot_zone([stop() for _ in range(10)], self.cfg, "2026-09-12", "Omaha, NE", {}, TODAY)
        self.assertAlmostEqual(omaha["heat"], round(base["heat"] * 0.85, 1), delta=0.1)
        self.assertIn("other roofers likely here", omaha["why"])
        old = doors.hot_zone([stop() for _ in range(10)], self.cfg, "2025-09-12", "Omaha, NE", {}, TODAY)
        self.assertEqual(old["parts"]["compete"], 1.0)                                        # competition gone
        self.assertLess(old["heat"], base["heat"])                                            # a year old

    def test_unknowns_use_defaults_and_sold_counts(self):
        stops = [stop(own=None, built=None, value=None, sale="2026-09-20") for _ in range(5)]
        z = doors.hot_zone(stops, self.cfg, "2026-09-12", "Fremont, NE", None, TODAY)
        p = z["parts"]
        self.assertEqual((p["owners"], p["mortgage"], p["roof"], p["size"]), (0.65, 0.6, 0.9, 0.9))
        self.assertIn("5 sold since storm", z["why"])
        self.assertNotIn("65% owners", z["why"])                   # a default is not a reason


class Pipeline(Base):
    """make_list -> door_list_turfs -> hud.json, offline, on a tiny town."""

    def setUp(self):
        super().setUp()
        self.conn.execute("INSERT INTO places (geoid,name,state,lat,lon,pop,aland_sqmi,dist_mi,hu) VALUES "
                          "('3104000','Testville','NE',41.45,-96.55,900,1.0,5,400)")
        ring = [[-96.60, 41.50], [-96.50, 41.50], [-96.50, 41.40], [-96.60, 41.40], [-96.60, 41.50]]
        self.conn.execute("INSERT INTO bgs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                          ("310539640003", "NE", "053", "964000", "3", 41.45, -96.55, 2.0, 3.0, -96.60, 41.40, -96.50,
                           41.50, json.dumps([ring]), "3104000", "Testville, NE center [9640-3]"))
        self.conn.execute("INSERT INTO acs VALUES ('310539640003','bg',400,380,300,80,1980,180000,'2024')")
        self.conn.execute("INSERT INTO acs_mortgage VALUES ('310539640003', 300, 210, '2024')")
        rows = []
        for k in range(30):
            rows.append((f"P{k}", "053", f"{k}", 100 * (k + 1), "OAK ST", "", f"{100 * (k + 1)} Oak St", "Testville", "68025",
                         41.45 + k * 0.0004, -96.55, "single", 0, 1990, 1400, 150000, 190000, "", "", None, "", "", 0.2,
                         "t", "2026-09-01T00:00:00Z"))
        self.conn.executemany("INSERT INTO parcels VALUES (" + ",".join("?" * 25) + ")", rows)
        self.conn.commit()
        self.day = (date.today() - timedelta(days=10)).isoformat()
        arr = np.full((60, 60), round(1.6 * 25.4 * 10), np.uint16)
        meta = {"lat0": 41.6, "lon0": -96.7, "dlat": 0.01, "dlon": 0.01, "shape": [60, 60], "complete": True}
        with open(mrms.grid_path(self.cfg, self.day), "wb") as f:
            np.savez_compressed(f, mesh=arr, meta=json.dumps(meta))

    def test_list_heat_reaches_hud(self):
        res = doors.make_list(self.conn, self.cfg, self.day, "Testville", None, log=lambda *a: None)
        self.assertEqual(len(res["houses"]), 30)
        z = self.conn.execute("SELECT * FROM door_list_turfs WHERE list_id=?", (res["list_id"],)).fetchall()
        self.assertEqual(len(z), len(res["turfs"]))
        parts = json.loads(z[0]["parts"])
        self.assertAlmostEqual(parts["mortgage"], 0.7)                  # the block group's mortgage share was used
        self.assertAlmostEqual(parts["owners"], round(300 / 380, 3))
        path, d = hud.write(self.conn, self.cfg)
        t = d["lists"][0]["turfs"][0]
        self.assertEqual((t["heat"], t["exp_inspections"]), (z[0]["heat"], z[0]["exp_inspections"]))
        self.assertIn('1.6" hail', t["why"])
        s = d["lists"][0]["stops"][0]
        self.assertEqual((s["value"], s["sqft"], s["sold_after_storm"], s["owner_occ"], s["roof_year"]),
                         (190000, 1400, False, None, None))
        self.assertEqual(json.load(open(path))["lists"][0]["turfs"][0]["heat"], t["heat"])   # what was written

    def test_hud_shrinks_walks_when_too_big(self):
        doors.make_list(self.conn, self.cfg, self.day, "Testville", None, turf_size=1, log=lambda *a: None)
        _, d = hud.write(self.conn, self.cfg)
        self.assertEqual(max(s["turf"] for s in d["lists"][0]["stops"]), 30)   # 30 one-door walks all fit
        full = len(json.dumps(d, separators=(",", ":")))
        _, d = hud.write(self.conn, self.cfg, max_bytes=full - 1)
        self.assertLessEqual(max(s["turf"] for s in d["lists"][0]["stops"]), 20)   # fell back to 20 walks


class Picker(Base):
    def test_close_small_storms_get_lists(self):
        recent = (date.today() - timedelta(days=20)).isoformat()
        rows = [(recent, "g1", "Big Town, NE", "Big Town", 110, 1.4, 5000),     # far, big: the usual auto pick
                (recent, "g2", "Near Town, NE", "Near Town", 30, 1.05, 400),    # close, 1" hail: new in T23
                (recent, "g3", "Far Town, NE", "Far Town", 90, 1.05, 400)]      # 1" but too far: skipped
        self.conn.executemany("""INSERT INTO nbhd_hits (conv_day, geoid, label, place_name, state, dist_mi, hail_in, hu)
                                 VALUES (?,?,?,?,'NE',?,?,?)""", rows)
        self.conn.commit()
        picked = hh.pick_door_lists(self.conn, self.cfg)
        self.assertIn((recent, "Big Town"), picked)
        self.assertIn((recent, "Near Town"), picked)
        self.assertNotIn((recent, "Far Town"), picked)


class Mortgages(Base):
    class F:
        def __init__(self, tables):
            self.tables = tables

        def get(self, url, ttl=None, cache=True):
            for t, txt in self.tables.items():
                if url.endswith(f"-{t}.dat") and "2024" in url:
                    return txt.encode()
            raise RuntimeError("404 " + url)

    BASE = {"b25001": "GEO_ID|B25001_E001\n1500000US310539640003|400\n",
            "b25003": "GEO_ID|B25003_E001|B25003_E002|B25003_E003\n1500000US310539640003|380|300|80\n",
            "b25035": "GEO_ID|B25035_E001\n1500000US310539640003|1980\n",
            "b25077": "GEO_ID|B25077_E001\n1500000US310539640003|180000\n"}

    def test_mortgage_table_is_optional(self):
        n, v = nbhd.load_acs(self.conn, self.F(self.BASE), self.cfg, log=lambda *a: None)
        self.assertEqual((n, v), (1, "2024"))                        # housing still loads without B25081
        self.assertEqual(nbhd.mortgage_shares(self.conn), {})
        tables = dict(self.BASE, b25081="GEO_ID|B25081_E001|B25081_E002|B25081_E003\n1500000US310539640003|300|210|90\n")
        nbhd.load_acs(self.conn, self.F(tables), self.cfg, log=lambda *a: None)
        self.assertEqual(nbhd.mortgage_shares(self.conn), {"310539640003": 0.7})


if __name__ == "__main__":
    unittest.main()
