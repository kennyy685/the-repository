"""Offline tests for `hh.py tune` (T35 learning loop): weekly results vs heat -> small, bounded weight changes.
Fixtures: tests/fixtures/tune_weekly_small.json (30 doors: under the 50-door threshold) and tune_weekly_big.json
(125 doors: storm 60 doors at heat 50 with 5 leads per 100, everyday 60 doors at heat 40 with 20 per 100, 5 doors
with no heat that are left out)."""
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
from hailhunter import config, everyday, tune  # noqa: E402

FIX = os.path.join(HERE, "fixtures")
SMALL, BIG = (os.path.join(FIX, n) for n in ("tune_weekly_small.json", "tune_weekly_big.json"))


def load(p):
    with open(p) as f:
        return json.load(f)


def cfg():
    return copy.deepcopy(config.DEFAULTS)


def week(storm, every, key="2026-40"):
    """A minimal weekly doc: storm/every = [(heat, doors, interested, booked, why)] walks."""
    def lst(lid, kind, walks):
        return {"list_id": lid, "kind": kind, "heat": walks[0][0], "why": walks[0][4],
                "walks": [{"walk_id": f"{lid}~t{i}", "heat": h, "why": why, "doors": d, "interested": n, "booked": b}
                          for i, (h, d, n, b, why) in enumerate(walks, 1)]}
    return {"week": key, "as_of": "2026-10-03", "totals": {"doors": sum(w[1] for w in storm + every)},
            "learning": {"lists": [lst("2026-09-10_Fremont", "storm", storm), lst("everyday_X_1", "everyday", every)]}}


class Threshold(unittest.TestCase):
    def test_under_min_doors_says_how_many_more(self):
        doc = tune.propose(load(SMALL), cfg())
        self.assertEqual((doc["status"], doc["doors_used"], doc["need_doors"]), ("need_more_doors", 30, 20))
        self.assertEqual(doc["changes"], [])
        self.assertIn("Need 20 more doors", doc["summary"]["en"])
        self.assertIn("Faltan 20 puertas", doc["summary"]["es"])
        self.assertEqual(doc["tuned_weights"]["everyday"]["weight"], 1.0)   # unchanged current values

    def test_min_doors_override_and_left_out_doors(self):
        self.assertEqual(tune.propose(load(SMALL), cfg(), min_doors=20)["status"], "no_change")  # groups too small
        big = tune.propose(load(BIG), cfg())
        self.assertEqual((big["doors_used"], big["doors_left_out"]), (120, 5))    # no-heat list doesn't count
        self.assertEqual(tune.propose(load(BIG), cfg(), min_doors=121)["need_doors"], 1)


class Proposal(unittest.TestCase):
    def setUp(self):
        self.doc = tune.propose(load(BIG), cfg())
        self.ch = {c["knob"]: c for c in self.doc["changes"]}

    def test_every_knob_moves_the_right_way(self):
        self.assertEqual(self.doc["status"], "proposal")
        self.assertTrue(self.doc["dry_run"])
        self.assertGreater(self.ch["everyday.weight"]["new"], 1.0)          # everyday beat its heat
        self.assertLess(self.ch["hot_zones.inspect_rate"]["new"], 0.03)     # 1 booked vs 1.8 expected
        self.assertGreater(self.ch["everyday.inspect_rate"]["new"], 0.01)   # 5 booked vs 0.48 expected
        self.assertLess(self.ch["hot_zones.compete_factor"]["new"], 0.85)   # contested walks did worse than heat said

    def test_clamp_max_15_percent_per_knob(self):
        for c in self.doc["changes"]:
            self.assertLessEqual(abs(c["pct"]), 15.0, c["knob"])
            self.assertTrue(c["clamped"], c["knob"])                       # the doors asked for more than 15%
        self.assertEqual(self.ch["everyday.weight"]["new"], 1.15)
        self.assertEqual(self.ch["hot_zones.inspect_rate"]["new"], 0.0255)
        self.assertEqual(self.doc["tuned_weights"]["everyday"]["weight"], 1.15)

    def test_plain_english_and_spanish_reasons(self):
        why = self.ch["everyday.weight"]["why"]
        self.assertIn("Old-house streets are booking 4x storm streets", why["en"])
        self.assertIn("raising the everyday weight 15%", why["en"])
        self.assertIn("subimos el peso de las casas viejas 15%", why["es"])
        self.assertIn("Storm walks booked 1 inspection where", self.ch["hot_zones.inspect_rate"]["why"]["en"])
        self.assertIn(why["en"], self.doc["summary"]["en"])

    def test_lists_and_reason_signals(self):
        lists = {L["list_id"]: L for L in self.doc["lists"]}
        self.assertEqual(lists["2026-09-10_Fremont"]["leads_per_100"], 5.0)
        self.assertLess(lists["2026-09-10_Fremont"]["vs_expected"], 1)
        self.assertGreater(lists["everyday_Fremont_310539640003"]["vs_expected"], 1)
        sig = {(s["kind"], s["reason"]): s for s in self.doc["signals"]}
        self.assertEqual(sig[("storm", "compete")]["doors_with"], 30)
        self.assertEqual(tune.reason_key("roofs ~1992"), "old_roofs")
        self.assertEqual(tune.reason_key("81% of homes built before 1980"), "old_homes")

    def test_small_gap_moves_under_the_clamp(self):
        # everyday 12 vs storm 10 leads per 100 at the same heat: ratio 1.2, half way = +10%
        doc = tune.propose(week([(50, 60, 6, 0, ['1.5" hail'])], [(50, 50, 6, 0, ["mostly owner-occupied"])]), cfg())
        c = {c["knob"]: c for c in doc["changes"]}["everyday.weight"]
        self.assertEqual((c["new"], c["pct"], c["clamped"]), (1.1, 10.0, False))
        self.assertIn("raising the everyday weight 10%", c["why"]["en"])

    def test_results_that_match_heat_change_nothing(self):
        doc = tune.propose(week([(50, 60, 6, 0, ['1.5" hail'])], [(25, 60, 3, 0, ["mostly owner-occupied"])]), cfg())
        self.assertNotIn("everyday.weight", {c["knob"] for c in doc["changes"]})
        self.assertIn("everyday.weight", {s["knob"] for s in doc["skipped"]})

    def test_one_sided_results_wait_for_the_other_side(self):
        doc = tune.propose(week([(50, 60, 6, 1, ['1.5" hail'])], [(40, 5, 1, 0, [])]), cfg())
        skip = {s["knob"]: s for s in doc["skipped"]}
        self.assertIn("waiting for 20 doors on each side (have 5)", skip["everyday.weight"]["why"]["en"])
        self.assertIn("everyday.inspect_rate", skip)


class ApplyAndMerge(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.tuned = os.path.join(self.tmp.name, "tuned.json")
        self.hist = os.path.join(self.tmp.name, "tune_history.json")

    def tearDown(self):
        self.tmp.cleanup()

    def test_apply_writes_override_history_and_config_merges_it(self):
        c = cfg()
        doc = tune.apply(tune.propose(load(BIG), c), c, self.tuned, self.hist)
        self.assertEqual((doc["status"], doc["dry_run"]), ("applied", False))
        self.assertEqual(load(self.tuned)["tuned_weights"]["everyday"]["weight"], 1.15)
        h = load(self.hist)
        self.assertEqual(len(h), 1)
        self.assertEqual(h[0]["key"], doc["key"])
        merged = config.load(os.path.join(self.tmp.name, "no-config.json"), tuned_path=self.tuned)
        self.assertEqual(merged["everyday"]["weight"], 1.15)
        self.assertEqual(merged["hot_zones"]["inspect_rate"], 0.0255)
        self.assertEqual(merged["hot_zones"]["compete_factor"], 0.7225)
        again = tune.apply(tune.propose(load(BIG), merged), merged, self.tuned, self.hist)   # same weekly file
        self.assertEqual(again["status"], "already_applied")
        self.assertEqual(len(load(self.hist)), 1)
        self.assertEqual(load(self.tuned)["tuned_weights"]["everyday"]["weight"], 1.15)

    def test_dry_run_and_need_more_doors_write_nothing(self):
        c = cfg()
        doc = tune.apply(tune.propose(load(SMALL), c), c, self.tuned, self.hist)
        self.assertEqual(doc["status"], "need_more_doors")
        self.assertFalse(os.path.exists(self.tuned) or os.path.exists(self.hist))

    def test_tuned_file_only_touches_tunable_keys_in_bounds(self):
        with open(self.tuned, "w") as f:
            json.dump({"tuned_weights": {"everyday": {"weight": 9.0, "radius_mi": 500, "inspect_rate": "x"},
                                         "hot_zones": {"max_turfs": 1, "compete_factor": 0.9},
                                         "prices": {"permit": {"low": 1}}, "hunt_radius_mi": 5}}, f)
        c = config.load(os.path.join(self.tmp.name, "no-config.json"), tuned_path=self.tuned)
        self.assertEqual(c["everyday"]["weight"], 2.0)                     # clamped to its bounds
        self.assertEqual(c["hot_zones"]["compete_factor"], 0.9)
        self.assertEqual(c["everyday"]["radius_mi"], config.DEFAULTS["everyday"]["radius_mi"])
        self.assertEqual(c["everyday"]["inspect_rate"], 0.01)
        self.assertEqual(c["hot_zones"]["max_turfs"], 40)
        self.assertEqual(c["prices"], config.DEFAULTS["prices"])
        self.assertEqual(c["hunt_radius_mi"], 250)

    def test_broken_tuned_file_is_ignored(self):
        with open(self.tuned, "w") as f:
            f.write("{not json")
        with contextlib.redirect_stderr(io.StringIO()):
            c = config.load(os.path.join(self.tmp.name, "no-config.json"), tuned_path=self.tuned)
        self.assertEqual(c["everyday"]["weight"], 1.0)

    def test_cli_dry_run_then_apply(self):
        conf = os.path.join(self.tmp.name, "config.json")
        with open(conf, "w") as f:
            json.dump({"paths": {"tuned": self.tuned, "tune_history": self.hist}}, f)
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(hh.main(["--config", conf, "tune", "--weekly", BIG]), 0)
        self.assertEqual(json.loads(out.getvalue())["status"], "proposal")
        self.assertFalse(os.path.exists(self.tuned))                       # dry run by default
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(hh.main(["--config", conf, "tune", "--weekly", SMALL, "--min-doors", "50"]), 0)
        self.assertIn("need 20 more doors", json.loads(out.getvalue())["summary"]["en"].lower())
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(hh.main(["--config", conf, "tune", "--weekly", BIG, "--apply"]), 0)
        self.assertEqual(load(self.tuned)["tuned_weights"]["everyday"]["weight"], 1.15)
        self.assertEqual(len(load(self.hist)), 1)


class EverydayWeight(unittest.TestCase):
    FACTS = {"share_old": 0.6, "basis": "parcels", "owners": 0.7, "med_value": 150000, "dist_mi": 10}

    def test_weight_scales_everyday_heat_and_caps_at_100(self):
        c = cfg()
        base = everyday.heat(self.FACTS, c)
        self.assertEqual(base["parts"]["weight"], 1.0)
        c["everyday"]["weight"] = 1.15
        self.assertAlmostEqual(everyday.heat(self.FACTS, c)["heat"], round(base["heat"] * 1.15, 1), delta=0.11)
        c["everyday"]["weight"] = 2.0
        c["everyday"]["old_floor"] = 1.0
        c["everyday"]["owner_floor"] = 1.0
        self.assertEqual(everyday.heat(self.FACTS, c)["heat"], 100.0)


if __name__ == "__main__":
    unittest.main()
