"""Offline tests for the per-address hail report (T32)."""
import json
import os
import shutil
import sys
import tempfile
import unittest
from datetime import date

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import db, hailreport, mrms  # noqa: E402
from hailhunter import config as C  # noqa: E402
from hailhunter.models import Obs, parse_utc  # noqa: E402

HOUSE = (41.50, -96.60)


class Report(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.cfg = C.load(os.path.join(self.tmp, "none.json"))
        self.cfg["paths"] = {k: os.path.join(self.tmp, k) for k in ("db", "cache", "export")}
        self.conn = db.connect(self.cfg["paths"]["db"])
        for day, inches in (("2026-09-12", 1.5), ("2025-06-01", 1.0), ("2026-08-01", 0.5)):
            meta = {"lat0": 41.6, "lon0": -96.7, "dlat": 0.01, "dlon": 0.01, "shape": [60, 60], "complete": True}
            with open(mrms.grid_path(self.cfg, day), "wb") as f:
                np.savez_compressed(f, mesh=np.full((60, 60), round(inches * 25.4 * 10), np.uint16), meta=json.dumps(meta))
            self.conn.execute("INSERT INTO swaths VALUES (?,?,?,1,?,0,0,0,0,?)", (day, "k", "t", inches, "t"))
        valid = parse_utc("2026-09-13T01:40:00Z")                      # 8:40 PM CDT on Sep 12
        db.upsert_obs(self.conn, [
            Obs("lsr:a", "lsr", "ground", valid, 41.51, -96.60, 1.75, city="Testville", weight=1.0,
                extra={"report_source": "Trained Spotter"}),
            Obs("lsr:b", "lsr", "ground", valid, 41.90, -96.60, 2.5, weight=1.0,                 # 28 mi away
                extra={"report_source": "Public"})], self.cfg)
        self.conn.execute("INSERT INTO parcels (pid, address, city, lat, lon, kind) VALUES "
                          "('P1', '200 Oak St', 'Testville', 41.50, -96.60, 'single')")
        self.conn.commit()

    def tearDown(self):
        self.conn.close()
        shutil.rmtree(self.tmp)

    def test_evidence_and_history(self):
        ev = hailreport.evidence(self.conn, self.cfg, "2026-09-12", *HOUSE)
        self.assertGreater(ev["hail"], 1.5)                             # radar lifted by the 1.75" spotter report
        self.assertEqual([(r["size_in"], r["who"]) for r in ev["reports"]], [(1.75, "Trained Spotter")])  # 28 mi one out
        self.assertEqual(ev["reports"][0]["dist_mi"], 0.7)
        hist = hailreport.history(self.conn, self.cfg, *HOUSE, today=date(2026, 9, 25))
        self.assertEqual([h["day"] for h in hist], ["2026-09-12", "2025-06-01"])   # 0.5" day left out

    def test_page_in_both_languages_without_promises(self):
        p = hailreport.find_parcel(self.conn, "200 oak st", "testville")
        ev = hailreport.evidence(self.conn, self.cfg, "2026-09-12", p["lat"], p["lon"])
        hist = hailreport.history(self.conn, self.cfg, p["lat"], p["lon"], today=date(2026, 9, 25))
        path = hailreport.write(os.path.join(self.tmp, "r.html"), "200 Oak St, Testville", ev, hist)
        with open(path) as f:
            page = f.read()
        for s in ("Hail report", "September 12, 2026", "Trained Spotter", "June 1, 2025",
                  "Reporte de granizo", "12 de septiembre de 2026", "observador entrenado", "1 de junio de 2025",
                  "not an inspection", "no una inspección"):
            self.assertIn(s, page)
        low = page.lower()
        self.assertNotIn("deductible", low)                            # never talk deductibles
        self.assertNotIn("will pay", low)                              # never promise coverage
        self.assertNotIn("<script", low)

    def test_address_text_is_escaped(self):
        ev = {"day": "2026-09-12", "hail": None, "reports": []}
        page = hailreport.render("<b>1 Main</b>", ev, [], "en")
        self.assertIn("&lt;b&gt;1 Main&lt;/b&gt;", page)
        self.assertIn("No ground reports within 10 miles", page)

    def test_command_writes_report_for_newest_big_storm(self):
        cfgp = os.path.join(self.tmp, "cfg.json")
        with open(cfgp, "w") as f:
            json.dump({"paths": self.cfg["paths"]}, f)
        self.conn.close()
        import contextlib
        import io
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            rc = hh.main(["--config", cfgp, "--offline", "hailreport", "--address", "200 Oak St", "--city", "Testville"])
        self.conn = db.connect(self.cfg["paths"]["db"])
        self.assertEqual(rc, 0)
        self.assertIn("2026-09-12", buf.getvalue())                     # newest 1"+ storm picked by itself
        path = os.path.join(self.cfg["paths"]["export"], "reports", "hail_200_oak_st_testville.html")
        self.assertTrue(os.path.exists(path))
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(hh.main(["--config", cfgp, "--offline", "hailreport", "--address", "9 Nowhere Rd"]), 1)


if __name__ == "__main__":
    unittest.main()
