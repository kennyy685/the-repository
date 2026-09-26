"""Offline tests for price rules v2 (O7 phase B, research round 7 section 1): new Hardie market reference, the
optional add-ons (ice & water, ridge vent, gutter guards, downspouts, window wrap, chimney + skylight flashing,
insulated vinyl) priced from NATIONAL guides with a warning, and old jobs giving exactly the v1 results."""
import copy
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

from hailhunter import config, estimate  # noqa: E402
from tests.test_estimate import hmp_prices  # noqa: E402

GOLDEN = os.path.join(HERE, "fixtures", "estimate_v1_golden.json")
APP_JS = os.path.join(ROOT, "docs", "app", "estimate.js")
NEW_ITEMS = {"ice_water_sq": (100, 125), "ridge_vent_ft": (7, 15), "gutter_guards_ft": (6, 13),
             "downspouts_ft": (8, 15), "window_wrap_ea": (100, 180), "chimney_flashing_job": (450, 1500),
             "skylight_flashing_ft": (5, 12), "insulated_vinyl_siding_sq": (800, 1200)}


def slim(r):
    return {"low": r["low"], "high": r["high"], "minimum": (r["minimum_applied"] or {}).get("key"),
            "lines": [[ln["key"], ln["qty"], ln["low"], ln["high"]] for ln in r["lines"]],
            "summary": r["summary"], "warnings": r["warnings"]}


class ReferenceTable(unittest.TestCase):
    def test_hardie_new_and_roof_vinyl_kept(self):
        ref = config.DEFAULTS["prices_reference"]
        self.assertEqual(ref["hardie_siding_sq"], {"low": 1000, "high": 1500})
        self.assertEqual(ref["shingle_roof_sq"], {"low": 450, "high": 550})
        self.assertEqual(ref["vinyl_siding_sq"], {"low": 700, "high": 900})

    def test_new_items_national_with_hmp_slot(self):
        ref, own = config.DEFAULTS["prices_reference"], config.load()["prices"]
        for key, (lo, hi) in NEW_ITEMS.items():
            self.assertEqual((ref[key]["low"], ref[key]["high"], ref[key]["scope"]), (lo, hi, "national"), key)
            self.assertEqual(own[key], {"low": None, "high": None}, key)      # boss's sheet slot, empty
        for key in ("hardie_siding_sq", "shingle_roof_sq", "vinyl_siding_sq", "permit"):
            self.assertNotIn("scope", ref[key])                                 # the Nebraska ranges stay local


class OldJobsUnchanged(unittest.TestCase):
    def test_v1_jobs_identical_with_old_hardie(self):
        """Every v1 job gives the exact v1 numbers, lines, text and warnings (Hardie at its old 900-1200)."""
        with open(GOLDEN, encoding="utf-8") as f:
            cases = json.load(f)["cases"]
        self.assertGreater(len(cases), 100)
        market = copy.deepcopy(config.DEFAULTS)
        market["prices_reference"]["hardie_siding_sq"] = {"low": 900, "high": 1200}
        hmp = hmp_prices()
        for i, t in enumerate(cases):
            self.assertEqual(slim(estimate.estimate(t["job"], market)), t["market"], f"case {i} market {t['job']}")
            self.assertEqual(slim(estimate.estimate(t["job"], hmp)), t["hmp"], f"case {i} hmp {t['job']}")

    def test_hardie_sample_moves(self):
        r = estimate.estimate({"type": "siding", "siding_squares": 20, "material": "hardie", "permit": False,
                               "house_wrap": False}, copy.deepcopy(config.DEFAULTS))
        self.assertEqual((r["low"], r["high"]), (20000, 30000))
        self.assertNotIn("National", json.dumps(r["warnings"]))               # Hardie is a local number


class AddOns(unittest.TestCase):
    def test_roof_addons_lines_adders_and_national_warning(self):
        r = estimate.estimate({"type": "roof", "roof_squares": 20, "pitch": "steep", "ice_water_sq": 4,
                               "ridge_vent_ft": 40, "chimney": True, "skylight_ft": 10, "permit": False},
                              copy.deepcopy(config.DEFAULTS))
        by = {ln["key"]: ln for ln in r["lines"]}
        self.assertEqual(list(by), ["shingle_roof_sq", "ice_water_sq", "ridge_vent_ft", "chimney_flashing_job",
                                    "skylight_flashing_ft"])
        self.assertEqual((by["ice_water_sq"]["low"], by["ice_water_sq"]["high"]), (460, 625))   # 4 x 100-125, +15-25%
        self.assertEqual((by["chimney_flashing_job"]["qty"], by["chimney_flashing_job"]["unit"]), (1, "job"))
        self.assertEqual(by["ridge_vent_ft"]["adder"], {"low": 0.15, "high": 0.25})
        self.assertIn("National price guide", r["warnings"][1]["en"])
        self.assertIn("nacional", r["warnings"][1]["es"])
        self.assertIn("chimney_flashing_job, ice_water_sq, ridge_vent_ft, skylight_flashing_ft", r["warnings"][1]["en"])
        self.assertIn("chimney flashing (1 chimney)", r["summary"]["en"])
        self.assertEqual(r["quantities"]["chimney"], 1.0)

    def test_siding_insulated_vinyl_windows_and_gutter_addons(self):
        r = estimate.estimate({"type": "mixed", "siding_squares": 10, "material": "Insulated Vinyl", "windows": 3,
                               "gutter_ft": 100, "gutter_guards_ft": 100, "downspouts_ft": 40, "stories": 2},
                              hmp_prices())
        self.assertEqual([ln["key"] for ln in r["lines"]],
                         ["insulated_vinyl_siding_sq", "house_wrap_sq", "window_wrap_ea", "gutters_ft",
                          "gutter_guards_ft", "downspouts_ft", "permit"])
        ww = r["lines"][2]
        self.assertEqual((ww["unit"], ww["unit_en"], ww["low"], ww["high"]), ("ea", "each", 414, 518))  # 3 x 120-150 +15%
        self.assertFalse(r["using_reference"])                                  # HMP's prices: no warnings
        self.assertEqual(r["warnings"], [])
        self.assertIn("insulated vinyl siding (10 squares)", r["summary"]["en"])
        self.assertIn("siding de vinil aislado", r["summary"]["es"])
        self.assertIn("window wrap (3 windows)", r["summary"]["en"])

    def test_addons_only_mixed_job_and_bad_values(self):
        r = estimate.estimate({"type": "mixed", "downspouts_ft": 30, "permit": False}, copy.deepcopy(config.DEFAULTS))
        self.assertEqual(r["minimum_applied"]["key"], "min_job")
        for bad in ({"type": "roof", "roof_squares": 10, "windows": -1}, {"type": "roof", "roof_squares": 10, "chimney": "yes"},
                    {"type": "mixed"}):
            with self.assertRaises(ValueError):
                estimate.estimate(bad, config.DEFAULTS)

    def test_no_deductible_or_insurance_promise(self):
        r = estimate.estimate({"type": "mixed", "siding_squares": 12, "roof_squares": 20, "ice_water_sq": 3,
                               "ridge_vent_ft": 30, "chimney": 2, "skylight_ft": 8, "windows": 9,
                               "gutter_guards_ft": 80, "downspouts_ft": 30, "material": "insulated_vinyl"},
                              copy.deepcopy(config.DEFAULTS))
        text = json.dumps(r, ensure_ascii=False).lower()
        for word in ("deductible", "deducible", "waive", "rebate", "insurance will pay"):
            self.assertNotIn(word, text)


class RulesV2(unittest.TestCase):
    def test_version_2_export_and_js(self):
        self.assertEqual(estimate.RULES_VERSION, 2)
        doc = estimate.export_rules(copy.deepcopy(config.DEFAULTS))
        self.assertEqual(doc["version"], 2)
        p = doc["prices"]
        self.assertEqual((p["hardie_siding_sq"]["low"], p["hardie_siding_sq"]["high"]), (1000, 1500))
        self.assertEqual((p["window_wrap_ea"]["unit"], p["chimney_flashing_job"]["unit"], p["ridge_vent_ft"]["unit"],
                          p["ice_water_sq"]["unit"]), ("ea", "job", "ft", "sq"))
        self.assertEqual(p["skylight_flashing_ft"]["scope"], "national")
        self.assertNotIn("scope", p["hardie_siding_sq"])
        self.assertNotIn("scope", estimate.export_rules(hmp_prices())["prices"]["ridge_vent_ft"])   # HMP's price
        self.assertIn("insulated_vinyl", doc["materials"])
        self.assertEqual([a["field"] for a in doc["addons"]], ["windows", "ice_water_sq", "ridge_vent_ft", "chimney",
                                                               "skylight_ft", "gutter_guards_ft", "downspouts_ft"])
        self.assertIn("{items}", doc["national_warning_template"]["en"])
        self.assertEqual(doc["units"]["ea"], {"en": "each", "es": "c/u"})
        if os.path.exists(APP_JS):                                              # not in the cloud bundle
            with open(APP_JS, encoding="utf-8") as f:
                self.assertIn("var RULES_VERSION = 2;", f.read())


if __name__ == "__main__":
    unittest.main()
