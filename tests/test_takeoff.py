"""Offline tests for O7 phase D material takeoff (`hh.py takeoff`): every formula checked against a hand-computed
example, the rules export for the HMP App, and the JavaScript twin (docs/app/takeoff.js) matching Python (fuzzed)."""
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
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

import hh  # noqa: E402
from hailhunter import config, estimate, takeoff  # noqa: E402

NODE = shutil.which("node")
CHECK_JS = os.path.join(HERE, "js", "takeoff_check.js")
APP_JS = os.path.join(ROOT, "docs", "app", "takeoff.js")      # not in the cloud bundle: the check skips there
BANNED = ("deductible", "deducible", "waive", "rebate", "insurance", "seguro", "$")


def qty(result):
    return {ln["item"]: ln["qty"] for ln in result["lines"]}


def roof(**r):
    return takeoff.takeoff({"kind": "roof", "roof": r})


def siding(**s):
    return takeoff.takeoff({"kind": "siding", "siding": s})


def gutters(**g):
    return takeoff.takeoff({"kind": "gutters", "gutters": g})


class RoofFormulas(unittest.TestCase):
    def test_gable_example_by_hand(self):
        # 20 sq, eave 80, rake 60, ridge 40, 3 pipes, 6/12, gable (10% waste)
        q = qty(roof(squares=20, eave_ft=80, rake_ft=60, ridge_ft=40, penetrations=3, roof_type="gable", pitch="6/12"))
        self.assertEqual(q["shingles"], 66)          # 20 x 1.10 x 3 = 66
        self.assertEqual(q["starter"], 2)            # 140 / 100 = 1.4 -> 2
        self.assertEqual(q["ridge_cap"], 2)          # 40 / 33 = 1.2 -> 2
        self.assertEqual(q["drip_edge"], 16)         # 140 x 1.10 / 10 = 15.4 -> 16
        self.assertEqual(q["underlayment"], 2)       # 20 / 10
        self.assertEqual(q["ice_water"], 3)          # (12+24) in x 1.118 = 40.2 in -> 2 rows; 80 x 2 / 66 = 2.4 -> 3
        self.assertEqual(q["roof_nails"], 2)         # 20 x 1.10 x 480 / 7200 = 1.47 -> 2
        self.assertEqual(q["pipe_boots"], 3)
        self.assertNotIn("ridge_vent", q)

    def test_waste_by_roof_shape(self):
        self.assertEqual(qty(roof(squares=30, roof_type="hip"))["shingles"], 102)     # 30 x 1.13 x 3 = 101.7
        self.assertEqual(qty(roof(squares=10, roof_type="cut-up"))["shingles"], 36)   # 10 x 1.18 x 3 = 35.4
        self.assertEqual(qty(roof(squares=10, roof_type="Cut Up"))["shingles"], 36)
        self.assertEqual(qty(roof(squares=30, hip_ft=50))["shingles"], 102)          # hips given -> hip assumed
        self.assertEqual(qty(roof(squares=30))["shingles"], 99)                      # gable default

    def test_float_noise_does_not_round_up(self):
        self.assertEqual(qty(roof(squares=30))["shingles"], 99)         # 30 x 1.1 x 3 = 99.00000000000001
        self.assertEqual(qty(roof(eave_ft=100))["drip_edge"], 11)       # 100 x 1.1 / 10 = 11.000000000000002
        self.assertEqual(takeoff.up(2.00001), 3)
        self.assertEqual(takeoff.up(4.0), 4)

    def test_ridge_cap_counts_hips(self):
        self.assertEqual(qty(roof(ridge_ft=30, hip_ft=88))["ridge_cap"], 4)          # 118 / 33 = 3.6 -> 4

    def test_ice_and_water_rows_follow_pitch_and_overhang(self):
        # 0/12, 12 in overhang: exactly 36 in -> 1 row; 100 ft / 66 = 1.5 -> 2 rolls
        self.assertEqual(qty(roof(eave_ft=100, pitch=0))["ice_water"], 2)
        r = roof(eave_ft=100, pitch=0)
        self.assertIn("x 1 row(s)", [ln for ln in r["lines"] if ln["item"] == "ice_water"][0]["how"]["en"])
        # 12/12, 36 in overhang: 60 x 1.414 = 84.9 in -> 1 + ceil(48.9 / 33) = 3 rows; 66 x 3 / 66 = 3 rolls
        self.assertEqual(qty(roof(eave_ft=66, pitch="12/12", overhang_in=36))["ice_water"], 3)
        # valleys get one run: 190 x 2 + 24 = 404 / 66 = 6.1 -> 7
        self.assertEqual(qty(roof(eave_ft=190, valley_ft=24, pitch="9/12"))["ice_water"], 7)
        self.assertEqual(qty(roof(valley_ft=30))["ice_water"], 1)

    def test_pitch_forms(self):
        for p in ("steep", "9", 9, "9:12", " 9 / 12 "):
            self.assertEqual(takeoff.rise_of(p, takeoff.build_rules(config.DEFAULTS)), 9.0, p)
        with self.assertRaises(ValueError):
            roof(squares=10, pitch="flat")

    def test_ridge_vent_and_boots(self):
        q = qty(roof(ridge_ft=30.2, ridge_vent=True, penetrations=2.5))
        self.assertEqual(q["ridge_vent"], 31)
        self.assertEqual(q["pipe_boots"], 3)

    def test_no_squares_accessories_only(self):
        r = roof(eave_ft=45, rake_ft=30)
        self.assertEqual(qty(r), {"starter": 1, "drip_edge": 9, "ice_water": 2})
        self.assertTrue(any("No roof squares" in a["en"] for a in r["assumptions"]))

    def test_config_overrides_waste(self):
        cfg = copy.deepcopy(config.DEFAULTS)
        cfg["takeoff"]["waste"]["gable"] = 0.15
        self.assertEqual(qty(takeoff.takeoff({"kind": "roof", "roof": {"squares": 20}}, cfg))["shingles"], 69)


class SidingFormulas(unittest.TestCase):
    def test_vinyl_example_by_hand(self):
        r = siding(material="vinyl", wall_sqft=1850, openings=14, wall_height_ft=18, outside_corners=4,
                   inside_corners=2, bottom_ft=170, rake_ft=64)
        q = qty(r)
        self.assertEqual(q["vinyl_siding"], 21)      # 1850 x 1.12 / 100 = 20.72 -> 21
        self.assertEqual(q["house_wrap"], 2)         # 1850 x 1.05 / 1350 = 1.44 -> 2
        self.assertEqual(q["j_channel"], 26)         # (14 x 16 + 64) x 1.10 / 12.5 = 25.3 -> 26
        self.assertEqual(q["outside_corners"], 8)    # 4 x ceil(18 / 10)
        self.assertEqual(q["inside_corners"], 4)     # 2 x 2
        self.assertEqual(q["starter_strip"], 15)     # 170 / 12 = 14.2 -> 15
        self.assertEqual([a["item"] for a in r["ask_supplier"]], ["vinyl_nails"])
        self.assertIn("21 squares", r["ask_supplier"][0]["why"]["en"])
        self.assertTrue(any("14 openings x 16 ft" in a["en"] for a in r["assumptions"]))

    def test_hardie_example_by_hand(self):
        r = siding(material="James Hardie", squares=22, opening_perimeter_ft=230, wall_height_ft=9,
                   outside_corners=6, inside_corners=2, bottom_ft=180, exposure_in=6.25)
        q = qty(r)
        self.assertEqual(q["hardie_planks"], 395)    # 2200 x 1.12 / 6.25 = 394.2 -> 395
        self.assertEqual(q["hardie_nails"], 3950)    # 10 per plank
        self.assertEqual(q["hardie_trim"], 22)       # 230 x 1.10 / 12 = 21.1 -> 22
        self.assertEqual(q["hardie_outside_corners"], 12)   # 6 corners x 2 boards x 1
        self.assertEqual(q["hardie_inside_corners"], 2)
        self.assertEqual(q["starter_strip"], 15)
        self.assertEqual(r["material"], "hardie")
        self.assertEqual([a["item"] for a in r["ask_supplier"]], ["hardie_caulk", "hardie_paint"])

    def test_hardie_default_7in_exposure(self):
        # 2100 x 1.12 / 7 = 336 exactly (float noise must not make it 337); about 15 planks per square
        self.assertEqual(qty(siding(material="hardie", wall_sqft=2100))["hardie_planks"], 336)
        self.assertEqual(qty(siding(material="hardie", wall_sqft=100))["hardie_planks"], 16)   # 112 / 7 = 16 exactly

    def test_insulated_and_defaults(self):
        r = siding(material="insulated_vinyl", wall_sqft=1200, outside_corners=4)
        self.assertEqual(qty(r)["insulated_vinyl_siding"], 14)       # 1344 / 100 -> 14
        self.assertEqual(qty(r)["outside_corners"], 4)               # 10 ft wall assumed -> 1 post each
        self.assertTrue(any("Wall height not given" in a["en"] for a in r["assumptions"]))

    def test_rake_from_roof_in_mixed(self):
        r = takeoff.takeoff({"kind": "mixed", "roof": {"rake_ft": 50}, "siding": {"wall_sqft": 500, "openings": 0}})
        self.assertEqual(qty(r)["j_channel"], 5)     # 50 x 1.10 / 12.5 = 4.4 -> 5

    def test_bad_siding(self):
        for s in ({"material": "brick", "wall_sqft": 100}, {"material": "hardie", "wall_sqft": 100, "exposure_in": 0},
                  {"wall_sqft": -5}):
            with self.assertRaises(ValueError):
                siding(**s)


class GutterFormulas(unittest.TestCase):
    def test_snow_example_by_hand(self):
        q = qty(gutters(feet=142, runs=4, corners=2, height_ft=10))
        self.assertEqual(q, {"gutter": 142, "downspouts": 5,       # ceil(142 / 35) = 5 >= 4 runs
                             "downspout_pipe": 50, "elbows": 15, "outlets": 5,
                             "hangers": 99,                        # 142 x 12 / 18 = 94.7 -> 95, + 4 run ends
                             "end_caps": 8, "miters": 2})

    def test_no_snow_and_min_one_downspout_per_run(self):
        q = qty(gutters(feet=60, snow=False))
        self.assertEqual(q["hangers"], 31)           # 720 / 24 = 30, + 1
        self.assertEqual(q["downspouts"], 2)
        self.assertEqual(qty(gutters(feet=40, runs=3))["downspouts"], 3)
        self.assertNotIn("downspout_pipe", q)
        self.assertTrue(any("downspout pipe length not counted" in a["en"] for a in gutters(feet=60)["assumptions"]))

    def test_snow_default_true(self):
        r = gutters(feet=36)
        self.assertEqual(qty(r)["hangers"], 25)      # 36 x 12 / 18 = 24, + 1
        self.assertTrue(any("every 18 in" in a["en"] for a in r["assumptions"]))


class OutputShape(unittest.TestCase):
    def test_line_shape_groups_and_text(self):
        job = takeoff.RULE_TEST_JOBS[8]["job"]                   # mixed
        r = takeoff.takeoff(job)
        for ln in r["lines"]:
            self.assertEqual(set(ln), {"group", "item", "en", "es", "qty", "unit", "unit_en", "unit_es", "how"})
            self.assertIsInstance(ln["qty"], int)
            self.assertGreater(ln["qty"], 0)
            self.assertTrue(ln["how"]["en"] and ln["how"]["es"])
        self.assertEqual([g["key"] for g in r["groups"]], ["roof", "siding", "gutters"])
        self.assertEqual(r["groups"][1]["en"], "SIDING (Hardie)")
        order = [ln["group"] for ln in r["lines"]]
        self.assertEqual(order, sorted(order, key=["roof", "siding", "gutters"].index))
        en, es = r["text"]["en"], r["text"]["es"]
        self.assertTrue(en.startswith("Material order - HMP Siding & Roofing LLC\nJob: The Edge bldg 3"))
        self.assertIn("\n- 80 bundles Shingles (architectural)\n", en)
        self.assertIn("\n- 80 paquetes Tejas (arquitectónicas)\n", es)
        self.assertIn("Please quote / confirm: Caulk for Hardie", en)
        self.assertIn("Favor de cotizar", es)
        self.assertEqual(r["assumptions"][0]["en"], "Every quantity is rounded up to a whole unit.")
        self.assertTrue(any("IRC R905.1.2" in a["en"] for a in r["assumptions"]))
        self.assertTrue(any("6 per shingle" in a["en"] for a in r["assumptions"]))
        self.assertTrue(any("every 18 in" in a["en"] for a in r["assumptions"]))

    def test_singular_units(self):
        r = gutters(feet=10, runs=1)
        self.assertIn("- 1 pc Downspouts", r["text"]["en"])
        self.assertIn("- 1 pza Downspouts".replace("Downspouts", "Bajantes"), r["text"]["es"])

    def test_bad_jobs(self):
        for job in ({"kind": "deck"}, {"kind": "roof"}, {"kind": "mixed"}, {"kind": "roof", "roof": []},
                    {"kind": "roof", "roof": {}}, {"kind": "gutters", "gutters": {}},
                    {"kind": "roof", "roof": {"squares": "abc"}}, {"kind": "roof", "roof": {"squares": float("inf")}},
                    {"kind": "roof", "roof": {"squares": 10, "roof_type": "dome"}}, "roof"):
            with self.assertRaises(ValueError, msg=repr(job)):
                takeoff.takeoff(job)

    def test_kind_scopes_sections(self):
        r = takeoff.takeoff({"kind": "roof", "roof": {"squares": 10}, "gutters": {"feet": 100}})
        self.assertEqual({ln["group"] for ln in r["lines"]}, {"roof"})
        r = takeoff.takeoff({"type": "Gutters", "gutters": {"feet": 100}})       # `type` works as `kind`
        self.assertEqual(r["kind"], "gutters")

    def test_no_money_or_insurance_words(self):
        for t in takeoff.RULE_TEST_JOBS:
            text = json.dumps(takeoff.takeoff(t["job"]), ensure_ascii=False).lower()
            for w in BANNED:
                self.assertNotIn(w, text, t["name"])

    def test_estimate_unchanged(self):
        cfg = copy.deepcopy(config.DEFAULTS)
        del cfg["takeoff"]
        for t in estimate.RULE_TEST_JOBS:
            self.assertEqual(estimate.estimate(t["job"], cfg), estimate.estimate(t["job"], config.DEFAULTS))


class ExportAndCli(unittest.TestCase):
    def test_export_rules_doc(self):
        doc = takeoff.export_rules(config.DEFAULTS)
        for k in ("version", "company", "config", "items", "units", "assume", "ask", "text", "test_cases",
                  "updated_at"):
            self.assertIn(k, doc)
        self.assertEqual(doc["config"]["waste"], {"gable": 0.10, "hip": 0.13, "cutup": 0.18})
        self.assertEqual(len(doc["test_cases"]), len(takeoff.RULE_TEST_JOBS))
        for t in doc["test_cases"]:
            self.assertEqual(t["expect"], takeoff.takeoff(t["job"]))
        json.dumps(doc)

    def test_cli_json_text_and_export(self):
        with tempfile.TemporaryDirectory() as d:
            job = os.path.join(d, "job.json")
            with open(job, "w") as f:
                json.dump({"kind": "roof", "roof": {"squares": 20}}, f)
            out = os.path.join(d, "order.json")
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                self.assertEqual(hh.main(["takeoff", "--json", job, "--out", out]), 0)
            self.assertEqual(qty(json.loads(buf.getvalue()))["shingles"], 66)
            with open(out) as f:
                self.assertEqual(qty(json.load(f))["shingles"], 66)
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                self.assertEqual(hh.main(["takeoff", "--json", job, "--text"]), 0)
            self.assertIn("- 66 bundles Shingles", buf.getvalue())
            self.assertIn("- 66 paquetes Tejas", buf.getvalue())
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                self.assertEqual(hh.main(["takeoff", "--export-rules"]), 0)
            self.assertRegex(json.loads(buf.getvalue())["updated_at"], r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")
            with open(job, "w") as f:
                json.dump({"kind": "roof"}, f)
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(hh.main(["takeoff", "--json", job]), 2)


def fuzz_jobs(n, seed):
    """Random but valid jobs: every kind, material, roof type, pitch form, optional field and odd number."""
    rnd, jobs = random.Random(seed), []

    def val(hi):
        return rnd.choice([rnd.randint(0, hi), round(rnd.uniform(0, hi), 1), round(rnd.uniform(0, hi), 2),
                           str(rnd.randint(1, hi)), None, ""])

    while len(jobs) < n:
        job = {"kind": rnd.choice(["roof", "siding", "gutters", "mixed", "Mixed", " roof "])}
        if rnd.random() < 0.3:
            job["name"] = rnd.choice(["12 Oak St", " Edge bldg 2 ", "", None])
        if rnd.random() < 0.7:
            r = {}
            for k, hi in (("squares", 60), ("eave_ft", 300), ("rake_ft", 200), ("ridge_ft", 120), ("hip_ft", 150),
                          ("valley_ft", 100), ("penetrations", 8), ("overhang_in", 30)):
                if rnd.random() < 0.6:
                    r[k] = val(hi)
            if rnd.random() < 0.5:
                r["roof_type"] = rnd.choice(["gable", "hip", "cutup", "cut-up", "Cut Up", "HIP", None])
            if rnd.random() < 0.5:
                r["pitch"] = rnd.choice(["low", "std", "steep", "normal", 4, 6.5, 12, "7/12", "10:12", "3", None])
            if rnd.random() < 0.2:
                r["ridge_vent"] = rnd.choice([True, False, 1, 0, "yes"])
            job["roof"] = r
        if rnd.random() < 0.7:
            s = {}
            if rnd.random() < 0.8:
                s["material"] = rnd.choice(["vinyl", "insulated_vinyl", "Insulated Vinyl", "hardie", "James Hardie",
                                            "fiber-cement", None])
            for k, hi in (("wall_sqft", 4000), ("squares", 40), ("openings", 30), ("opening_perimeter_ft", 400),
                          ("wall_height_ft", 30), ("outside_corners", 10), ("inside_corners", 6), ("bottom_ft", 300),
                          ("rake_ft", 120)):
                if rnd.random() < 0.5:
                    s[k] = val(hi)
            if rnd.random() < 0.3:
                s["exposure_in"] = rnd.choice([5, 6.25, 7, 8, "7"])
            job["siding"] = s
        if rnd.random() < 0.7:
            g = {}
            for k, hi in (("feet", 400), ("runs", 8), ("corners", 8), ("height_ft", 30)):
                if rnd.random() < 0.6:
                    g[k] = val(hi)
            if rnd.random() < 0.4:
                g["snow"] = rnd.choice([True, False, None, 0, 1])
            job["gutters"] = g
        try:
            takeoff.takeoff(job)
        except ValueError:
            continue
        jobs.append({"name": f"fuzz {len(jobs)}", "job": job})
    return jobs


@unittest.skipUnless(NODE and os.path.exists(CHECK_JS) and os.path.exists(APP_JS),
                     "node or the app's takeoff.js not here (cloud bundle): JS parity check skipped")
class JsMatchesPython(unittest.TestCase):
    """docs/app/takeoff.js must give exactly the Python result (numbers and text) on every exported test case."""

    def run_node(self, doc):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "rules.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(doc, f, ensure_ascii=False)
            p = subprocess.run([NODE, CHECK_JS, path], capture_output=True, text=True, timeout=120)
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr[-3000:])
        m = re.search(r"(\d+)/(\d+) test cases match", p.stdout)
        self.assertTrue(m and m.group(1) == m.group(2), p.stdout)
        return int(m.group(2))

    def test_default_rules(self):
        self.assertEqual(self.run_node(takeoff.export_rules(config.load())), len(takeoff.RULE_TEST_JOBS))

    def test_fuzz_default_and_changed_config(self):
        odd = copy.deepcopy(config.DEFAULTS)
        odd["takeoff"].update({"waste": {"gable": 0.125, "hip": 0.15, "cutup": 0.2}, "gutter_ft_per_downspout": 30,
                               "ice_water_roll_ft": 65.6, "j_channel_ft": 12.5, "default_pitch": 5})
        n = len(takeoff.RULE_TEST_JOBS)
        for i, cfg in enumerate((copy.deepcopy(config.DEFAULTS), odd)):
            with mock.patch.object(takeoff, "RULE_TEST_JOBS", takeoff.RULE_TEST_JOBS + fuzz_jobs(300, seed=i)):
                self.assertEqual(self.run_node(takeoff.export_rules(cfg)), n + 300)


if __name__ == "__main__":
    unittest.main()
