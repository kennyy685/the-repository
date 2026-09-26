"""Offline tests for O3.3: per-address hail evidence in hud.json (`hail_evidence`), for the lead detail on the phone."""
import contextlib
import io
import json
import os
import shutil
import sys
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone
from unittest import mock

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from hailhunter import db, doors, everyday, hailreport, hud, mrms, nbhd  # noqa: E402
from hailhunter import config as C  # noqa: E402
from hailhunter.geo import haversine_mi  # noqa: E402
from hailhunter.models import Obs  # noqa: E402

QUIET = lambda *a, **k: None  # noqa: E731
OLD_HUD_KEYS = {"generated_utc", "home", "radius_mi", "counts", "storms", "lists", "targets", "neighborhoods",
                "wind_events", "watch_hits", "agents", "everyday_lists"}
BIG = (date.today() - timedelta(days=10)).isoformat()        # 1.6" radar everywhere, a 1.75" spotter report nearby
SMALL = (date.today() - timedelta(days=40)).isoformat()      # 1.1" radar, no reports
SPOTTER = (41.455, -96.54)


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


class Evidence(Base):
    def setUp(self):
        super().setUp()
        c = self.conn
        c.execute("INSERT INTO places (geoid,name,state,lat,lon,pop,aland_sqmi,dist_mi,hu) VALUES "
                  "('3104000','Testville','NE',41.45,-96.55,900,1.0,5,400)")
        ring = [[-96.60, 41.50], [-96.50, 41.50], [-96.50, 41.40], [-96.60, 41.40], [-96.60, 41.50]]
        c.execute("INSERT INTO bgs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                  ("310539640003", "NE", "053", "964000", "3", 41.45, -96.55, 2.0, 3.0, -96.60, 41.40, -96.50, 41.50,
                   json.dumps([ring]), "3104000", "Testville, NE center [9640-3]"))
        c.execute("INSERT INTO acs VALUES ('310539640003','bg',400,380,300,80,1970,150000,'2024')")
        rows = []
        for k in range(20):                                   # Oak St: inside the storm lists' area
            rows.append((f"P{k}", "053", f"{k}", 100 * (k + 1), "OAK ST", "", f"{100 * (k + 1)} Oak St", "Testville",
                         "68025", 41.45 + k * 0.0004, -96.55, "single", 0, 1970, 1400, 110000, 150000, "", "", None, "",
                         "", 0.2, "t", "2026-09-01T00:00:00Z"))
        for k in range(5):                                    # Elm St: in the neighborhood, outside the storm lists
            rows.append((f"E{k}", "053", f"e{k}", 10 * (k + 1), "ELM ST", "", f"{10 * (k + 1)} Elm St", "Testville",
                         "68025", 41.495, -96.59 + k * 0.0004, "single", 0, 1960, 1400, 110000, 150000, "", "", None,
                         "", "", 0.2, "t", "2026-09-01T00:00:00Z"))
        c.executemany("INSERT INTO parcels VALUES (" + ",".join("?" * 25) + ")", rows)
        c.commit()
        meta = {"lat0": 41.6, "lon0": -96.7, "dlat": 0.01, "dlon": 0.01, "shape": [60, 60], "complete": True}
        for day, inches in ((BIG, 1.6), (SMALL, 1.1)):
            with open(mrms.grid_path(self.cfg, day), "wb") as f:
                np.savez_compressed(f, mesh=np.full((60, 60), round(inches * 25.4 * 10), np.uint16),
                                    meta=json.dumps(meta))
        valid = datetime.fromisoformat(BIG).replace(hour=22, tzinfo=timezone.utc)
        db.upsert_obs(c, [Obs("lsr:a", "lsr", "ground", valid, *SPOTTER, 1.75, city="Testville", weight=1.0,
                              extra={"report_source": "Trained Spotter"}),
                          Obs("lsr:b", "lsr", "ground", valid, 41.90, -96.55, 2.5, weight=1.0,      # 31 mi away
                              extra={"report_source": "Public"})], self.cfg)
        self.big = doors.make_list(c, self.cfg, BIG, "Testville", None, log=QUIET)
        self.small = doors.make_list(c, self.cfg, SMALL, "Testville", None, log=QUIET)

    def test_evidence_per_address_reaches_hud(self):
        path, _ = hud.write(self.conn, self.cfg)
        with open(path) as f:
            d = json.load(f)
        self.assertTrue(OLD_HUD_KEYS | {"hail_evidence"} <= set(d))
        self.assertEqual({len(L["stops"]) for L in d["lists"]}, {20})                   # lists unchanged
        ev = d["hail_evidence"]
        self.assertEqual(len(ev), 20)
        e = ev["100 Oak St|Testville"]
        self.assertEqual(e["day"], BIG)                                   # on both lists: the bigger storm wins
        self.assertEqual(e["radar_max_in"], 1.6)                          # raw radar, before ground correction
        self.assertGreater(e["hail_in"], 1.6)                             # lifted by the 1.75" spotter report
        same = hailreport.evidence(self.conn, self.cfg, BIG, 41.45, -96.55)           # = the printed hail report
        self.assertEqual(e["hail_in"], same["hail"])
        self.assertEqual(e["nearest_report"], {"dist_mi": round(haversine_mi(41.45, -96.55, *SPOTTER), 1),
                                               "size_in": 1.75, "source": "Trained Spotter"})   # the far one is out

    def test_cap_per_list_and_storm_lists_only(self):
        area = everyday.areas(self.conn, self.cfg, "Testville", 5)[0]
        ev_list = everyday.make_list(self.conn, self.cfg, area, log=QUIET)
        self.assertIn("10 Elm St", {h["address"] for h in ev_list["houses"]})
        self.cfg["hail_evidence"]["max_per_list"] = 5
        _, d = hud.write(self.conn, self.cfg)
        first5 = {f"{s['address']}|{s['city']}" for L in d["lists"] for s in L["stops"][:5]}
        self.assertTrue(set(d["hail_evidence"]) <= first5)
        self.assertGreaterEqual(len(d["hail_evidence"]), 5)
        self.assertFalse([k for k in d["hail_evidence"] if "Elm" in k])   # everyday-only houses get none

    def test_small_storm_has_no_report(self):
        os.remove(mrms.grid_path(self.cfg, BIG))                          # its radar map is gone: skipped, no crash
        _, d = hud.write(self.conn, self.cfg)
        e = d["hail_evidence"]["100 Oak St|Testville"]
        self.assertEqual((e["day"], e["radar_max_in"], e["nearest_report"]), (SMALL, 1.1, None))

    def test_size_budget_keeps_evidence_to_listed_houses(self):
        for day in (BIG, SMALL):
            doors.make_list(self.conn, self.cfg, day, "Testville", None, turf_size=1, log=QUIET)
        _, d = hud.write(self.conn, self.cfg)
        full = len(json.dumps(d, separators=(",", ":")))
        _, d = hud.write(self.conn, self.cfg, max_bytes=full - 1)
        listed = {f"{s['address']}|{s['city']}" for L in d["lists"] for s in L["stops"]}
        self.assertEqual(set(d["hail_evidence"]), listed)
        self.assertEqual(len(listed), 10)                                 # fell back to 10 walks of 1 door

    def test_reused_maps_give_the_same_answer(self):
        fused = nbhd.fused_grid(self.conn, self.cfg, BIG)[:2]
        obs = hailreport.day_reports(self.conn, BIG)
        for lat, lon in ((41.45, -96.55), (41.46, -96.60)):
            self.assertEqual(hailreport.evidence(self.conn, self.cfg, BIG, lat, lon, fused=fused, obs=obs),
                             hailreport.evidence(self.conn, self.cfg, BIG, lat, lon))


class FreshDatabase(Base):
    def test_empty_database_and_failure_never_stop_hud(self):
        _, d = hud.write(self.conn, self.cfg)
        self.assertEqual(d["hail_evidence"], {})
        err = io.StringIO()
        with mock.patch.object(hud, "_hail_evidence", side_effect=RuntimeError("bad map")), \
                contextlib.redirect_stderr(err):
            path, d = hud.write(self.conn, self.cfg)
        self.assertEqual(d["hail_evidence"], {})
        self.assertIn("hail_evidence skipped: RuntimeError: bad map", err.getvalue())
        self.assertTrue(os.path.exists(path))


if __name__ == "__main__":
    unittest.main()
