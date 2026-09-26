"""Offline tests for `hh.py estimate --export-rules`: the pricing rules as one JSON doc for the HMP App (db path
`system/prices`), and the JavaScript copy of the math (docs/app/estimate.js) giving the same answers as Python."""
import contextlib
import copy
import io
import json
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

import hh  # noqa: E402
from hailhunter import config, estimate  # noqa: E402
from tests.test_estimate import hmp_prices  # noqa: E402

NODE = shutil.which("node")
CHECK_JS = os.path.join(HERE, "js", "estimate_check.js")
APP_JS = os.path.join(ROOT, "docs", "app", "estimate.js")      # not in the cloud bundle: the check skips there
BANNED = ("deductible", "deducible", "waive", "rebate", "insurance will pay", "free roof")


def fuzz_jobs(n, seed):
    """Random but valid jobs (every type, material, pitch form, stories, layers, toggles, footprints)."""
    rnd, jobs = random.Random(seed), []
    while len(jobs) < n:
        job = {"type": rnd.choice(estimate.TYPES)}
        for key, hi in (("siding_squares", 45), ("roof_squares", 45), ("gutter_ft", 300), ("soffit_ft", 300)):
            if rnd.random() < 0.5:
                job[key] = rnd.choice([round(rnd.uniform(0, hi), 1), rnd.randint(1, hi), round(rnd.uniform(0, 4), 2)])
        if rnd.random() < 0.4:
            job["footprint_sqft"] = rnd.choice([rnd.randint(300, 4000), round(rnd.uniform(300, 4000), 1)])
        for key, choices in (("material", ["vinyl", "hardie", "James Hardie", "shingle", None]),
                             ("pitch", ["low", "std", "steep", "normal", 3, 4, 6, 6.5, 7, "7/12", "3:12", " 9 / 12 ", None]),
                             ("stories", [1, 2, 3, "2", 2.4, None]), ("layers", [0, 1, 2, 3, "2", None]),
                             ("house_wrap", [True, False, None]), ("permit", [True, False, None])):
            if rnd.random() < 0.6:
                job[key] = rnd.choice(choices)
        try:
            estimate.estimate(job, config.DEFAULTS)
        except ValueError:
            continue
        jobs.append({"name": f"fuzz {len(jobs)}", "job": job})
    return jobs


class ExportShape(unittest.TestCase):
    def test_doc_fields_and_market_tags(self):
        now = datetime(2026, 9, 26, 14, 5, tzinfo=timezone.utc)
        doc = estimate.export_rules(copy.deepcopy(config.DEFAULTS), now=now)
        for k in ("version", "updated_at", "using_reference", "prices", "adders", "rough_helper", "insurance_note",
                  "reference_warning", "test_cases"):
            self.assertIn(k, doc)
        self.assertEqual(doc["version"], estimate.RULES_VERSION)
        self.assertEqual(doc["updated_at"], "2026-09-26T14:05:00Z")
        self.assertTrue(doc["using_reference"])
        self.assertEqual(set(doc["prices"]), set(config.DEFAULTS["prices"]))
        v = doc["prices"]["vinyl_siding_sq"]
        self.assertEqual((v["low"], v["high"], v["unit"], v["source"]), (700, 900, "sq", "market"))
        self.assertEqual((v["en"], v["es"]), ("Vinyl siding", "Siding de vinil"))
        self.assertEqual(doc["prices"]["gutters_ft"]["unit"], "ft")
        self.assertEqual(doc["prices"]["permit"]["unit"], "job")
        a = doc["adders"]
        self.assertEqual(a["steep_pitch"]["pitch_adders"]["steep"], {"low": 0.15, "high": 0.25})
        self.assertEqual(a["stories"]["story_adders"]["3"], {"low": 0.35, "high": 0.35})
        self.assertEqual(a["min_job_roof"], {"low": 2500, "high": 3000, "source": "market"})
        self.assertEqual(a["round_to"], 50)
        for k in ("extra_layers", "house_wrap", "permit", "min_job"):
            self.assertIn(k, a)
        self.assertEqual(doc["rough_helper"]["pitch_factor"]["steep"], 1.25)
        self.assertIn("MARKET REFERENCE", doc["reference_warning"]["en"])
        self.assertIn("REFERENCIA", doc["reference_warning"]["es"])
        json.dumps(doc)                                                  # plain JSON, ready for ArtifactData

    def test_hmp_prices_tagged_hmp_and_partial_mix(self):
        full = estimate.export_rules(hmp_prices())
        self.assertFalse(full["using_reference"])
        self.assertEqual({p["source"] for p in full["prices"].values()}, {"hmp"})
        self.assertIsNone(full["reference_label"])
        part = estimate.export_rules(hmp_prices(gutters_ft=None, vinyl_siding_sq=(650, 600)))
        self.assertTrue(part["using_reference"])
        self.assertEqual(part["reference_items"], ["gutters_ft"])
        self.assertEqual(part["prices"]["gutters_ft"]["source"], "market")
        self.assertEqual((part["prices"]["vinyl_siding_sq"]["low"], part["prices"]["vinyl_siding_sq"]["high"]),
                         (600, 650))                                   # HMP's reversed pair comes out low <= high

    def test_eight_test_cases_are_real_estimates(self):
        cfg = copy.deepcopy(config.DEFAULTS)
        doc = estimate.export_rules(cfg)
        cases = doc["test_cases"]
        self.assertEqual(len(cases), 8)
        by = {t["name"]: t for t in cases}
        for name in ("siding vinyl", "siding hardie", "roof std", "roof steep 2-story", "gutters only", "mixed",
                     "below minimum", "footprint only (rough)"):
            self.assertIn(name, by)
        for t in cases:
            r = estimate.estimate(t["job"], cfg)
            self.assertEqual((t["expect"]["low"], t["expect"]["high"]), (r["low"], r["high"]), t["name"])
        self.assertEqual(by["below minimum"]["expect"]["minimum"], "min_job")
        self.assertEqual((by["below minimum"]["expect"]["low"], by["below minimum"]["expect"]["high"]), (300, 400))
        self.assertEqual(by["roof steep 2-story"]["job"]["pitch"], "8/12")
        self.assertNotIn("siding_squares", by["footprint only (rough)"]["job"])
        self.assertTrue(any("ROUGH" in w["en"] for w in by["footprint only (rough)"]["expect"]["warnings"]))
        self.assertIn("hardie_siding_sq", by["siding hardie"]["expect"]["line_keys"])

    def test_no_deductible_or_insurance_promise(self):
        for cfg in (copy.deepcopy(config.DEFAULTS), hmp_prices()):
            text = json.dumps(estimate.export_rules(cfg), ensure_ascii=False).lower()
            for word in BANNED:
                self.assertNotIn(word, text)
            self.assertIn("approved scope sets the price", text)

    def test_refactored_warnings_unchanged(self):
        r = estimate.estimate({"type": "mixed", "siding_squares": 10, "gutter_ft": 100}, hmp_prices(gutters_ft=None))
        self.assertEqual(r["warnings"][0]["en"], "Using MARKET REFERENCE prices, not HMP's prices for: gutters_ft. "
                         "The boss hasn't set HMP's price sheet yet (T51). OK to share as an estimate range, never as a final price.")
        r = estimate.estimate({"type": "gutters", "gutter_ft": 50, "roof_squares": 3}, hmp_prices())
        self.assertEqual(r["warnings"], [estimate.TYPE_NOTES["gutters"]])


class ExportCli(unittest.TestCase):
    def test_export_rules_command(self):
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "prices.json")
            buf, err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(err):
                self.assertEqual(hh.main(["estimate", "--export-rules", "--out", out]), 0)
            doc = json.loads(buf.getvalue())
            self.assertRegex(doc["updated_at"], r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")
            self.assertEqual(len(doc["test_cases"]), 8)
            with open(out, encoding="utf-8") as f:
                self.assertEqual(json.load(f)["prices"], doc["prices"])


@unittest.skipUnless(NODE and os.path.exists(CHECK_JS) and os.path.exists(APP_JS),
                     "node or the app's estimate.js not here (cloud bundle): JS parity check skipped")
class JsMatchesPython(unittest.TestCase):
    """docs/app/estimate.js must give exactly the Python numbers (and text) on every exported test case."""

    def run_node(self, doc):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "rules.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(doc, f, ensure_ascii=False)
            p = subprocess.run([NODE, CHECK_JS, path], capture_output=True, text=True, timeout=60)
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        m = re.search(r"(\d+)/(\d+) test cases match", p.stdout)
        self.assertTrue(m and m.group(1) == m.group(2), p.stdout)
        return int(m.group(2))

    def test_default_rules(self):
        self.assertEqual(self.run_node(estimate.export_rules(config.load())), 8)

    def test_fuzz_market_hmp_and_partial_prices(self):
        roof_min_hmp_general = hmp_prices(min_job_roof=None)          # HMP general minimum beats market roof minimum
        odd = hmp_prices(gutters_ft=None, extra_layer_sq=(125, None), vinyl_siding_sq=(640, 575))
        odd["prices_reference"] = dict(odd["prices_reference"], gutters_ft={"low": 15, "high": None})
        for i, cfg in enumerate((copy.deepcopy(config.DEFAULTS), hmp_prices(), roof_min_hmp_general, odd)):
            with mock.patch.object(estimate, "RULE_TEST_JOBS", estimate.RULE_TEST_JOBS + fuzz_jobs(250, seed=i)):
                self.assertEqual(self.run_node(estimate.export_rules(cfg)), 258)


if __name__ == "__main__":
    unittest.main()
