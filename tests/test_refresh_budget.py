"""One overall time guard for `refresh` (Storm Watch's cloud run has a time limit). A fake clock: the core hail step
"takes" 11 minutes, so every optional network step must skip (or use stored data only) with a log line, and
hud.json must still be written. Offline: every network piece is stubbed."""
import json
import os
import sys
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import commercial, doors, everyday, ingest, mrms, nbhd, wind  # noqa: E402
from hailhunter.http import Fetcher  # noqa: E402
from hailhunter.runbudget import RunBudget  # noqa: E402
from tests.test_bundle import RefreshSurvives  # noqa: E402


class FakeClock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


class Budget(unittest.TestCase):
    def test_cap_left_and_skip(self):
        clk, log = FakeClock(), []
        rb = RunBudget(600, clk, log.append)
        self.assertEqual((rb.left(), rb.cap(150), rb.cap(None)), (600, 150, 600))
        with rb.step("slow"):
            clk.t += 550
        self.assertEqual((rb.cap(150), rb.steps["slow"], rb.skip("wind")), (50, 550.0, False))
        clk.t += 60
        self.assertTrue(rb.over())
        self.assertEqual((rb.left(), rb.cap(150)), (0.0, 0.0))
        self.assertTrue(rb.skip("wind"))
        self.assertIn("wind skipped: refresh time budget used (10.2 of 10 min)", log[0])
        unlimited = RunBudget(0, clk, log.append)
        clk.t += 10 ** 6
        self.assertEqual((unlimited.over(), unlimited.cap(90), unlimited.skip("x")), (False, 90, False))


class RefreshGuard(RefreshSurvives):
    def run_refresh(self, core_s):
        self.fetcher = Fetcher(self.cfg["paths"]["cache"], offline=False)       # a live session to withhold
        clk, log = FakeClock(), []

        def slow_ingest(*a, **k):
            clk.t += core_s
            return set(), {}

        m = {"wind": mock.Mock(), "make_list": mock.Mock(return_value=None),
             "build": mock.Mock(return_value=([], 0, 0)), "top": mock.Mock(return_value=([], [])),
             "towns": mock.Mock(return_value=[]), "year": mock.Mock(return_value=0), "lang": mock.Mock(return_value=0)}
        with mock.patch.object(ingest, "run", slow_ingest), \
                mock.patch.object(mrms, "run", lambda *a, **k: ([self.day], 0, [])), \
                mock.patch.object(wind, "ingest", m["wind"]), mock.patch.object(doors, "make_list", m["make_list"]), \
                mock.patch.object(commercial, "build", m["build"]), \
                mock.patch.object(everyday, "build_top", m["top"]), mock.patch.object(everyday, "build_towns", m["towns"]), \
                mock.patch.object(nbhd, "ensure_year_built", m["year"]), \
                mock.patch.object(nbhd, "ensure_language", m["lang"]):
            summary = hh.refresh(self.conn, self.fetcher, self.cfg, log=log.append, clock=clk)
        return summary, m, log

    def test_over_budget_skips_optional_network_steps_and_still_writes_hud(self):
        summary, m, log = self.run_refresh(core_s=660)                # 11 min of hail reports: over the 10 min
        self.assertFalse(m["wind"].called or m["year"].called or m["lang"].called)
        self.assertTrue(m["make_list"].called)                         # door lists still built, stored parcels only
        self.assertTrue(all(c.args[4] is None for c in m["make_list"].call_args_list))
        self.assertIsNone(m["top"].call_args.args[2])
        self.assertIsNone(m["towns"].call_args.args[2])
        self.assertIsNone(m["build"].call_args.args[2])
        self.assertIn("wind reports", summary["budget"]["skipped"])
        self.assertTrue(any("wind reports skipped: refresh time budget used" in str(x) for x in log))
        self.assertEqual(summary["budget"]["step_s"]["hail_reports"], 660.0)
        with open(os.path.join(self.cfg["paths"]["export"], "hud.json")) as f:
            self.assertIn("Testville", json.dumps(json.load(f)["neighborhoods"]))

    def test_under_budget_runs_everything_with_capped_step_budgets(self):
        summary, m, _ = self.run_refresh(core_s=500)                  # 100 s left of 600
        self.assertTrue(m["wind"].called and m["year"].called and m["lang"].called)
        self.assertEqual(m["wind"].call_args.kwargs["budget_s"], 100)
        self.assertIsNotNone(m["build"].call_args.args[2])
        self.assertEqual(m["build"].call_args.kwargs["budget_s"], 100)          # min(150, what is left)
        self.assertEqual(m["top"].call_args.kwargs["budget_s"], 100)            # min(parcel_budget_s 120, left)
        self.assertEqual(m["towns"].call_args.kwargs["budget_s"], 90)
        self.assertEqual(summary["budget"]["skipped"], [])

    def test_budget_comes_from_config(self):
        self.cfg["refresh"] = {"budget_s": 0}                          # 0 = no limit
        summary, m, _ = self.run_refresh(core_s=5000)
        self.assertTrue(m["wind"].called)
        self.assertEqual(summary["budget"]["skipped"], [])


del RefreshSurvives                                                   # its own tests run from test_bundle

if __name__ == "__main__":
    unittest.main()
