"""Offline tests for T52 quick estimate (`hh.py estimate`): price ranges from config `prices` (HMP's, null until
the boss's sheet, T51), falling back to `prices_reference` (market reference, not HMP) with a loud flag."""
import contextlib
import copy
import io
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import config, estimate  # noqa: E402


def hmp_prices(**over):
    """A config with every HMP price set (round numbers, so the math is easy to check)."""
    cfg = copy.deepcopy(config.DEFAULTS)
    p = {"vinyl_siding_sq": (500, 600), "hardie_siding_sq": (800, 1000), "shingle_roof_sq": (400, 500),
         "extra_layer_sq": (100, 100), "soffit_fascia_ft": (10, 10), "gutters_ft": (10, 12),
         "house_wrap_sq": (100, 100), "permit": (200, 200), "min_job": (1000, 1000), "min_job_roof": (3000, 3000)}
    p.update(over)
    cfg["prices"] = {k: ({"low": v[0], "high": v[1]} if v else {"low": None, "high": None}) for k, v in p.items()}
    return cfg


def all_text(doc):
    return json.dumps(doc, ensure_ascii=False).lower()


class Defaults(unittest.TestCase):
    def test_hmp_prices_default_null_and_reference_is_labeled(self):
        for k, v in config.DEFAULTS["prices"].items():
            self.assertEqual((v["low"], v["high"]), (None, None), k)
        self.assertIn("not HMP", config.DEFAULTS["prices_reference"]["_label"])
        self.assertEqual(config.DEFAULTS["prices_reference"]["vinyl_siding_sq"], {"low": 700, "high": 900})
        self.assertEqual(set(config.load()["prices"]) - {"_note"}, set(config.DEFAULTS["prices"]))

    def test_null_prices_fall_back_to_reference_with_warning(self):
        r = estimate.estimate({"type": "siding", "siding_squares": 20, "permit": False, "house_wrap": False},
                              copy.deepcopy(config.DEFAULTS))
        self.assertTrue(r["using_reference"])
        self.assertEqual((r["low"], r["high"]), (14000, 18000))          # 20 sq x $700-900 market reference
        self.assertIn("MARKET REFERENCE", r["warnings"][0]["en"])
        self.assertIn("REFERENCIA", r["warnings"][0]["es"])
        self.assertIn("not HMP", r["summary"]["en"])


class Math(unittest.TestCase):
    def test_siding_with_hmp_prices_no_reference(self):
        r = estimate.estimate({"type": "siding", "siding_squares": 20, "material": "vinyl"}, hmp_prices())
        self.assertFalse(r["using_reference"])
        self.assertEqual(r["warnings"], [])
        # siding 20 x 500-600 + wrap 20 x 100 + permit 200
        self.assertEqual((r["low"], r["high"]), (12200, 14200))
        self.assertEqual([ln["key"] for ln in r["lines"]], ["vinyl_siding_sq", "house_wrap_sq", "permit"])

    def test_steep_pitch_two_stories_and_extra_layer(self):
        r = estimate.estimate({"type": "roof", "roof_squares": 10, "pitch": "8/12", "stories": 2, "layers": 2,
                               "permit": False}, hmp_prices())
        self.assertEqual(r["adders"]["pitch"], "steep")
        roof, layer = r["lines"]
        self.assertEqual((roof["low"], roof["high"]), (5200, 7000))      # 10 x 400 x 1.30, 10 x 500 x 1.40
        self.assertEqual((layer["low"], layer["high"]), (1300, 1400))    # one extra layer x 10 sq x $100
        self.assertEqual((r["low"], r["high"]), (6500, 8400))

    def test_story_adders_and_pitch_words(self):
        base = {"type": "siding", "siding_squares": 10, "house_wrap": False, "permit": False}
        lows = [estimate.estimate(dict(base, stories=n), hmp_prices())["low"] for n in (1, 2, 3)]
        self.assertEqual(lows, [5000, 5750, 6750])                        # +0 / +15 / +35%
        self.assertEqual(estimate.pitch_class(4), "std")
        self.assertEqual(estimate.pitch_class("3:12"), "low")
        self.assertEqual(estimate.pitch_class("7"), "steep")

    def test_minimum_job_and_roof_minimum(self):
        g = estimate.estimate({"type": "gutters", "gutter_ft": 20, "permit": False}, hmp_prices())
        self.assertEqual((g["low"], g["high"]), (1000, 1000))
        self.assertEqual(g["minimum_applied"]["key"], "min_job")
        r = estimate.estimate({"type": "roof", "roof_squares": 3, "permit": False}, hmp_prices())
        self.assertEqual((r["low"], r["high"]), (3000, 3000))
        self.assertEqual(r["minimum_applied"]["key"], "min_job_roof")
        # HMP set a general minimum but no roof one: HMP's number wins over the market roof minimum
        r2 = estimate.estimate({"type": "roof", "roof_squares": 2, "permit": False}, hmp_prices(min_job_roof=None))
        self.assertFalse(r2["using_reference"])
        self.assertEqual(r2["minimum_applied"]["key"], "min_job")

    def test_partial_prices_flag_only_missing_items(self):
        r = estimate.estimate({"type": "mixed", "siding_squares": 10, "gutter_ft": 100}, hmp_prices(gutters_ft=None))
        self.assertTrue(r["using_reference"])
        self.assertEqual(r["reference_items"], ["gutters_ft"])
        self.assertIn("gutters_ft", r["warnings"][0]["en"])

    def test_type_filters_and_bad_input(self):
        r = estimate.estimate({"type": "siding", "siding_squares": 10, "roof_squares": 20}, hmp_prices())
        self.assertNotIn("shingle_roof_sq", [ln["key"] for ln in r["lines"]])
        for bad in ({"type": "deck", "siding_squares": 5}, {"type": "roof"}, {"type": "siding", "siding_squares": -2},
                    {"type": "siding", "siding_squares": 5, "stories": 4},
                    {"type": "siding", "siding_squares": 5, "material": "brick"}):
            with self.assertRaises(ValueError):
                estimate.estimate(bad, hmp_prices())


class RoughSquares(unittest.TestCase):
    def test_footprint_helper(self):
        s = estimate.squares_from_footprint(1600, 2, "std")
        # perimeter = 4 x 40 x 1.1 = 176 ft; wall = 176 x 9 x 2 x 0.85 = 2693 sf; roof = 1600 x 1.12
        self.assertEqual((s["perimeter_ft"], s["siding_squares"], s["roof_squares"]), (176, 26.9, 17.9))
        self.assertTrue(s["rough"])
        self.assertIn("ROUGH", s["note"]["en"])

    def test_estimate_uses_footprint_when_no_squares(self):
        r = estimate.estimate({"type": "roof", "footprint_sqft": 1600, "pitch": "steep"}, hmp_prices())
        self.assertEqual(r["quantities"]["roof_squares"], 20.0)         # 1600 x 1.25 / 100
        self.assertTrue(r["rough_squares"]["rough"])
        self.assertTrue(any("ROUGH" in w["en"] for w in r["warnings"]))


class LegalText(unittest.TestCase):
    def test_insurance_line_and_no_deductible(self):
        for cfg in (copy.deepcopy(config.DEFAULTS), hmp_prices()):
            r = estimate.estimate({"type": "mixed", "siding_squares": 20, "roof_squares": 25, "gutter_ft": 120,
                                   "soffit_ft": 150, "pitch": 9, "stories": 2, "layers": 2}, cfg)
            self.assertIn("insurance jobs: the insurer's approved scope sets the price", r["summary"]["en"])
            self.assertIn("alcance aprobado por la aseguradora", r["summary"]["es"])
            text = all_text(r)
            for word in ("deductible", "deducible", "waive", "rebate", "insurance will pay", "free roof"):
                self.assertNotIn(word, text)


class Cli(unittest.TestCase):
    def test_estimate_command(self):
        with tempfile.TemporaryDirectory() as d:
            job, out = os.path.join(d, "job.json"), os.path.join(d, "est.json")
            with open(job, "w") as f:
                json.dump({"type": "roof", "roof_squares": 22, "pitch": "std", "stories": 1, "layers": 1}, f)
            buf, err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(err):
                self.assertEqual(hh.main(["estimate", "--json", job, "--out", out]), 0)
            doc = json.loads(buf.getvalue())
            self.assertTrue(doc["using_reference"])                     # config.json prices are still null
            self.assertIn("MARKET REFERENCE", err.getvalue())
            with open(out) as f:
                self.assertEqual(json.load(f)["low"], doc["low"])
            with open(job, "w") as f:
                json.dump({"type": "roof"}, f)
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(err):
                self.assertEqual(hh.main(["estimate", "--json", job]), 2)


if __name__ == "__main__":
    unittest.main()
