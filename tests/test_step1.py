"""Offline tests for Step 1 (ingest -> dedupe -> cluster -> hits -> score).
Uses real storm data captured from the live APIs, plus clearly marked synthetic rows."""
import csv
import gzip
import os
import shutil
import sys
import tempfile
import unittest
from datetime import date, datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from hailhunter import analyze, db, ingest  # noqa: E402
from hailhunter import config as C  # noqa: E402
from hailhunter.geo import interp  # noqa: E402
from hailhunter.http import Fetcher  # noqa: E402
from hailhunter.sources import lsr, stormevents, swdi  # noqa: E402

FX = os.path.join(HERE, "fixtures")
TODAY = date(2026, 9, 24)
SEPT_START = datetime(2025, 9, 22, 12, tzinfo=timezone.utc)
SEPT_END = datetime(2025, 9, 23, 12, tzinfo=timezone.utc)


def fx(name):
    with open(os.path.join(FX, name), "rb") as f:
        return f.read()


class Step1(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.cfg = C.load(os.path.join(self.tmp, "no-config.json"))
        self.cfg["paths"] = {k: os.path.join(self.tmp, k) for k in ("db", "cache", "export")}
        self.conn = db.connect(self.cfg["paths"]["db"])
        self.f = Fetcher(self.cfg["paths"]["cache"], offline=True)
        with open(os.path.join(FX, "places_test.csv")) as fh:
            rows = [(r["geoid"], r["name"], r["state"], float(r["lat"]), float(r["lon"]), int(r["pop"]),
                     float(r["aland_sqmi"]), 0.0, None) for r in csv.DictReader(fh)]
        self.conn.executemany("INSERT INTO places VALUES (?,?,?,?,?,?,?,?,?)", rows)
        self.conn.commit()

    def tearDown(self):
        self.conn.close()
        shutil.rmtree(self.tmp)

    def _prime_sept22(self):
        for url, _, _ in lsr.urls(self.cfg, SEPT_START, SEPT_END):
            self.f.put(url, fx("lsr_20250922_oax.geojson"))
        name = "StormEvents_details-ftp_v1.0_d2025_c20260819.csv.gz"
        self.f.put(stormevents.DIR, f'<a href="{name}">{name}</a> <a href="x_d2025_c20250101.csv.gz">old</a>'.encode())
        self.f.put(stormevents.DIR + name, gzip.compress(fx("stormevents_test.csv")))

    def _run_sept22(self):
        self._prime_sept22()
        ingest.run(self.conn, self.f, self.cfg, SEPT_START, SEPT_END, ["lsr", "stormevents"], log=lambda *a: None)
        analyze.analyze(self.conn, self.cfg, today=TODAY)

    # --- parsing -------------------------------------------------------
    def test_lsr_parse(self):
        obs = lsr.parse(fx("lsr_20250922_oax.geojson"), self.cfg)
        self.assertEqual(len(obs), 14)                       # wind gust row dropped
        self.assertTrue(all(o.conv_day == "2025-09-22" for o in obs))
        big = max(obs, key=lambda o: o.size_in)
        self.assertEqual((big.size_in, big.city), (2.0, "Fremont"))
        self.assertAlmostEqual(next(o for o in obs if "mPING" in o.remark).weight, 0.75)

    def test_swdi_parse(self):
        obs = swdi.parse(fx("swdi_20250417.csv"), self.cfg)
        self.assertEqual(len(obs), 10)
        self.assertTrue(all(o.kind == "radar" and o.weight == 0.8 for o in obs))
        small = swdi.parse(fx("swdi_202405.csv"), self.cfg)
        self.assertTrue(all(o.size_in >= 0.75 for o in small))

    def test_stormevents_parse_time(self):
        obs = stormevents.parse(gzip.compress(fx("stormevents_test.csv")), self.cfg)
        self.assertEqual(len(obs), 2)                        # wind row dropped
        fre = next(o for o in obs if o.state == "NE")
        self.assertEqual(fre.valid_utc, datetime(2025, 9, 23, 1, 47, tzinfo=timezone.utc))  # CST-6 -> UTC
        self.assertEqual(fre.conv_day, "2025-09-22")

    def test_stormevents_picks_newest_file(self):
        self._prime_sept22()
        files = stormevents.list_files(self.f)
        self.assertEqual(files[2025][0], "20260819")

    # --- pipeline --------------------------------------------------------
    def test_pipeline_sept22(self):
        self._run_sept22()
        n_obs = self.conn.execute("SELECT COUNT(*) FROM hail_obs").fetchone()[0]
        self.assertEqual(n_obs, 15)                          # 14 LSR + 1 official; Kansas row out of radius
        dup = self.conn.execute("SELECT dup_of FROM hail_obs WHERE uid='se:9990001'").fetchone()[0]
        self.assertEqual(dup, "lsr:202509230147:41.440:-96.500")
        events = self.conn.execute("SELECT * FROM hail_events").fetchall()
        self.assertEqual(len(events), 3)                     # Fremont/Saunders line, Creston, Moorhead
        top = self.conn.execute("SELECT * FROM hail_hits ORDER BY score DESC LIMIT 1").fetchone()
        self.assertEqual(top["place_name"], "Fremont")
        self.assertEqual(top["best_size_in"], 2.0)
        self.assertEqual(top["n_official"], 1)
        self.assertEqual(top["strong_ground"], 1)
        self.assertEqual(top["local_time"], "Mon Sep 22 2025 08:45 PM CDT")

    def test_event_ids_stable(self):
        self._run_sept22()
        a = sorted(r[0] for r in self.conn.execute("SELECT event_id FROM hail_events"))
        analyze.analyze(self.conn, self.cfg, today=TODAY)
        b = sorted(r[0] for r in self.conn.execute("SELECT event_id FROM hail_events"))
        self.assertEqual(a, b)
        hits = self.conn.execute("SELECT COUNT(*) FROM hail_hits").fetchone()[0]
        self.assertGreater(hits, 0)

    def test_radar_only_and_ranking(self):
        self._run_sept22()
        db.upsert_obs(self.conn, swdi.parse(fx("swdi_20250417.csv"), self.cfg), self.cfg)
        analyze.analyze(self.conn, self.cfg, today=TODAY)
        r = self.conn.execute("""SELECT * FROM hail_hits WHERE conv_day='2025-04-17'
                                 ORDER BY best_size_in DESC LIMIT 1""").fetchone()
        self.assertEqual(r["size_basis"], "radar est.")
        self.assertAlmostEqual(r["best_size_in"], 3.2)       # 0.8 x 90th pct (4.0")
        best_sep = self.conn.execute("SELECT MAX(score) FROM hail_hits WHERE conv_day='2025-09-22'").fetchone()[0]
        best_apr = self.conn.execute("SELECT MAX(score) FROM hail_hits WHERE conv_day='2025-04-17'").fetchone()[0]
        self.assertGreater(best_sep, best_apr)               # confirmed + newer beats radar-only + older

    def test_offline_resume_and_failures(self):
        # nothing cached for this window -> recorded as failures, no crash
        s = datetime(2025, 6, 1, 12, tzinfo=timezone.utc)
        e = datetime(2025, 6, 10, 12, tzinfo=timezone.utc)
        _, summ = ingest.run(self.conn, self.f, self.cfg, s, e, ["lsr"], log=lambda *a: None)
        self.assertEqual(summ["lsr"]["status"], "failed")
        self.assertGreater(self.conn.execute("SELECT COUNT(*) FROM fetch_failures").fetchone()[0], 0)

    # --- scoring curves --------------------------------------------------
    def test_curves(self):
        sc = self.cfg["scoring"]
        self.assertAlmostEqual(interp(sc["size_curve"], 1.0), 0.40)
        self.assertEqual(interp(sc["recency_curve"], 30), 1.0)
        self.assertEqual(interp(sc["distance_curve"], 300), 0.0)
        self.assertEqual(analyze.exposure(sc, 11000, 0), 1.0)          # homes
        self.assertEqual(analyze.exposure(sc, None, 0, pop=27141), 1.0)  # population fallback
        self.assertEqual(analyze.exposure(sc, None, 1), sc["exposure_rural"])


if __name__ == "__main__":
    unittest.main()
