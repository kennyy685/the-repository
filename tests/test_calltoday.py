"""Offline tests for today's business call list (`hh.py calltoday`)."""
import contextlib
import csv
import io
import json
import os
import shutil
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import calltoday  # noqa: E402
from hailhunter import config as C  # noqa: E402

TODAY = "2026-09-26"
SPRING = {"name": "Springhill Ridge Apartments", "phone": "(402) 891-0742", "ask_for": "Community manager",
          "confidence": "high"}


def target(addr, city, day, hail, contact, kind="Apartments / multi-family", score=10.0):
    return {"address": addr, "city": city, "day": day, "hail": hail, "type": kind, "score": score,
            "key": f"{addr}|{city}", "owner": "SOME OWNER LLC", "contact": contact}


HUD = {"generated_utc": "2026-09-26T11:00:00Z", "targets": [
    target("15735 Rosewood St", "Omaha", "2026-09-12", 1.75, SPRING, score=40),
    target("15859 Rosewood St", "Omaha", "2026-09-12", 1.5, SPRING, score=30),           # same line: one call
    target("840 Fallbrook Blvd", "Lincoln", "2026-03-01", 2.0,                           # older, bigger
           {"name": "Super Saver (Fallbrook)", "phone": "(402) 464-6297", "ask_for": "Facilities manager"},
           kind="Commercial"),
    target("1 Fresh Small Ave", "Blair", "2026-09-20", 0.75,                              # under 1 inch
           {"name": "Small Hail Apts", "phone": "(402) 111-2222", "ask_for": "Manager"}),
    target("2 Old Storm Rd", "Wahoo", "2025-06-01", 2.5,                                 # over a year old
           {"name": "Old Storm Apts", "phone": "(402) 333-4444", "ask_for": "Manager"}),
    target("3 No Phone St", "Omaha", "2026-09-12", 2.0,
           {"name": "Big-box store", "phone": "", "ask_for": "Owner"}, kind="Commercial"),
    target("4 Cell Ln", "Omaha", "2026-09-12", 2.0,                                      # a cell: never called
           {"name": "Cell Apts", "phone": "(402) 555-1212", "phone_type": "cell", "ask_for": "Owner"}),
    target("5 House Rd", "Omaha", "2026-09-12", 2.0,                                     # a home: never called
           {"name": "Somebody", "phone": "(402) 555-3434", "ask_for": "Owner"}, kind="Single-family"),
    target("6 Unknown Ct", "Omaha", "2026-09-12", 2.0, None),                            # no contact known
]}


class CallToday(unittest.TestCase):
    def setUp(self):
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-hh-config.json"))

    def test_ranked_business_lines_in_fresh_strong_hail(self):
        doc = calltoday.today_doc(HUD, TODAY, self.cfg)
        self.assertEqual([c["name"] for c in doc["calls"]], ["Springhill Ridge Apartments", "Super Saver (Fallbrook)"])
        self.assertEqual(doc["count"], 2)
        first = doc["calls"][0]
        for k in ("name", "phone", "ask_for", "address", "city", "hail_in", "day", "why", "opener"):
            self.assertIn(k, first)
        self.assertEqual((first["address"], first["hail_in"], first["day"], first["rank"]),
                         ("15735 Rosewood St", 1.75, "2026-09-12", 1))
        self.assertEqual([a["address"] for a in first["also"]], ["15859 Rosewood St"])      # one call per line
        self.assertIn("14 days ago", first["why"]["en"])
        self.assertIn("hace 14 días", first["why"]["es"])
        self.assertNotIn("OWNER", json.dumps(doc))                                          # not needed on a call

    def test_opener_offers_free_inspection_and_never_insurance(self):
        doc = calltoday.today_doc(HUD, TODAY, self.cfg)
        op = doc["calls"][0]["opener"]
        self.assertIn("free roof and siding inspection for Springhill Ridge Apartments after the September 12 hail",
                      op["en"])
        self.assertIn("inspección gratis", op["es"])
        self.assertIn("12 de septiembre", op["es"])
        self.assertIn("HMP Siding & Roofing", op["en"])
        for c in doc["calls"]:
            for lang in ("en", "es"):
                low = c["opener"][lang].lower() + " " + c["why"][lang].lower()
                for bad in ("insurance", "claim", "deductible", "covered", "will pay", "seguro", "reclamo",
                            "deducible", "cubr", "pagar"):
                    self.assertNotIn(bad, low, f"{bad!r} in {lang}: {low}")
                self.assertEqual(c["opener"][lang].count("?"), 1)                          # one sentence

    def test_business_line_guard(self):
        self.assertIsNone(calltoday.business_phone({"phone": "(402) 555-1212", "phone_type": "mobile"}))
        self.assertIsNone(calltoday.business_phone({"phone": "402-555", "ask_for": "x"}))
        self.assertIsNone(calltoday.business_phone({"phone": "(402) 555-1212", "personal": True}))
        self.assertEqual(calltoday.business_phone({"phone": "1-402-555-1212"}), "1-402-555-1212")

    def test_nothing_to_call_says_why(self):
        doc = calltoday.today_doc({"targets": []}, TODAY, self.cfg)
        self.assertEqual(doc["calls"], [])
        self.assertIn("en", doc["none_reason"])
        self.assertIn("es", doc["none_reason"])

    def test_command_writes_json_and_csv(self):
        tmp = tempfile.mkdtemp()
        try:
            hud_p, out_p, csv_p = (os.path.join(tmp, n) for n in ("hud.json", "calls.json", "calls.csv"))
            with open(hud_p, "w") as f:
                json.dump(HUD, f)
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                rc = hh.main(["calltoday", "--hud", hud_p, "--date", TODAY, "--out", out_p, "--csv", csv_p])
            self.assertEqual(rc, 0)
            self.assertEqual(json.loads(buf.getvalue())["count"], 2)
            with open(out_p) as f:
                self.assertEqual(json.load(f)["calls"][1]["phone"], "(402) 464-6297")
            with open(csv_p, newline="") as f:
                rows = list(csv.DictReader(f))
            self.assertEqual([r["name"] for r in rows], ["Springhill Ridge Apartments", "Super Saver (Fallbrook)"])
            self.assertTrue(rows[0]["opener_es"].startswith("Hola"))
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(hh.main(["calltoday", "--hud", os.path.join(tmp, "missing.json"), "--date", TODAY]), 0)
        finally:
            shutil.rmtree(tmp)


if __name__ == "__main__":
    unittest.main()
