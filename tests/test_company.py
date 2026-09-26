"""Offline tests for the `company` config block (round-4 "cheap now, costly later"): HMP's behavior stays
identical, a second company's config moves home base, and hud.json only gains fields (company_id, credits)."""
import json
import os
import shutil
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from hailhunter import db, hailreport, hud  # noqa: E402
from hailhunter import config as C  # noqa: E402

FREMONT = {"name": "Fremont, NE", "lat": 41.4333, "lon": -96.4981}
OLD_HUD_KEYS = {"generated_utc", "home", "radius_mi", "counts", "storms", "lists", "targets", "neighborhoods",
                "wind_events", "watch_hits", "agents", "everyday_lists", "hail_evidence"}
CENSUS = "This product uses the Census Bureau Data API but is not endorsed or certified by the Census Bureau."
ACME = {"company": {"id": "acme", "name": "Acme Roofing Co", "short_name": "Acme", "home_town": "Grand Island",
                    "state": "NE", "lat": 40.925, "lon": -98.342, "radius_mi": {"hunt": 200, "everyday": 30},
                    "phones": {"main": "308-555-0100"}}}


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def load(self, over=None):
        path = os.path.join(self.tmp, "config.json")
        if over is not None:
            with open(path, "w") as f:
                json.dump(over, f)
        cfg = C.load(path)
        cfg["paths"] = {k: os.path.join(self.tmp, k) for k in ("db", "cache", "export")}
        os.makedirs(cfg["paths"]["export"], exist_ok=True)
        return cfg


class Defaults(Base):
    def test_hmp_defaults_unchanged(self):
        for cfg in (self.load(), C.load()):              # built-in defaults and the repo's config.json
            self.assertEqual(cfg["home"], FREMONT)
            self.assertEqual(cfg["hunt_radius_mi"], 250)
            self.assertEqual(cfg["everyday"]["radius_mi"], 40)
            self.assertEqual(cfg["company"]["id"], "hmp")
            self.assertEqual(C.company_label(cfg), "HMP Siding & Roofing LLC · Fremont, NE")

    def test_old_style_home_key_still_wins(self):
        cfg = self.load({"home": {"name": "Omaha, NE", "lat": 41.26, "lon": -95.94}, "hunt_radius_mi": 150})
        self.assertEqual(cfg["home"]["name"], "Omaha, NE")
        self.assertEqual(cfg["hunt_radius_mi"], 150)


class SecondCompany(Base):
    def test_company_block_moves_home_base(self):
        cfg = self.load(ACME)
        self.assertEqual(cfg["home"], {"name": "Grand Island, NE", "lat": 40.925, "lon": -98.342})
        self.assertEqual(cfg["hunt_radius_mi"], 200)
        self.assertEqual(cfg["everyday"]["radius_mi"], 30)
        self.assertEqual(C.company_label(cfg), "Acme Roofing Co · Grand Island, NE")

    def test_hud_and_report_carry_the_company(self):
        cfg = self.load(ACME)
        conn = db.connect(cfg["paths"]["db"])
        try:
            _, d = hud.write(conn, cfg)
        finally:
            conn.close()
        self.assertEqual(d["company_id"], "acme")
        self.assertEqual(d["home"]["name"], "Grand Island, NE")
        self.assertEqual(d["radius_mi"], 200)
        path = hailreport.write(os.path.join(self.tmp, "r.html"), "1 Main St", {"day": "2026-06-13", "hail": None, "reports": []}, [],
                                langs=("en",), company=C.company_label(cfg))
        with open(path) as f:
            page = f.read()
        self.assertIn("Acme Roofing Co · Grand Island, NE", page)
        self.assertNotIn("Fremont", page)


class HudContract(Base):
    def test_old_keys_intact_plus_company_and_credits(self):
        cfg = self.load()
        conn = db.connect(cfg["paths"]["db"])
        try:
            _, d = hud.write(conn, cfg)
        finally:
            conn.close()
        self.assertTrue(OLD_HUD_KEYS <= set(d))
        self.assertEqual(d["home"], FREMONT)
        self.assertEqual(d["radius_mi"], 250)
        self.assertEqual(d["company_id"], "hmp")
        texts = [c["text"] for c in d["credits"]]
        self.assertIn(CENSUS, texts)
        self.assertTrue(any("NOAA" in t and "public domain" in t and "endorsement" in t for t in texts))
        self.assertTrue(any("Nebraska" in c["source"] and "parcel" in c["text"] for c in d["credits"]))


if __name__ == "__main__":
    unittest.main()
