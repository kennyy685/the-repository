"""Offline tests for T166 (round 44): the `scorecard` section of `hh.py weekly` and the standalone
`hh.py scorecard` command - the 5 pilot numbers (doors knocked, contact rate, inspections booked per 100 doors,
signed jobs, average $ per signed job) next to industry ranges from data/benchmarks.json.
Fixtures: tests/fixtures/scorecard_doors.json, scorecard_leads.json, scorecard_claims.json.
"""
import contextlib
import io
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import benchmarks, scorecard, weekly  # noqa: E402

FIX = os.path.join(HERE, "fixtures")
DOORS, LEADS, CLAIMS = (os.path.join(FIX, n) for n in
                        ("scorecard_doors.json", "scorecard_leads.json", "scorecard_claims.json"))


def load(p):
    with open(p) as f:
        return json.load(f)


class ScorecardMetrics(unittest.TestCase):
    def setUp(self):
        self.doors = weekly.load_doors(load(DOORS))
        self.leads = weekly.load_leads(load(LEADS))
        self.claims = scorecard.load_claims(load(CLAIMS))

    def test_leads_only_five_numbers(self):
        doc = scorecard.report(self.doors, self.leads, today="2026-09-27")
        self.assertEqual(doc["company"], "hmp")
        m = doc["metrics"]
        self.assertEqual(m["doors_knocked"], 11)
        self.assertEqual(m["contact_rate"], round(7 / 11, 3))
        self.assertEqual(m["inspections_per_100_doors"], round(100 * 2 / 11, 1))
        # signed = 200 Ash St (job_scheduled, $14800) + 201 Ash St (done, $9200) + 300 Birch St (job_scheduled, no
        # price) - NOT 104 Elm St (only "approved", a price doesn't make it signed) or 301 Birch St ("lost").
        self.assertEqual(m["signed_jobs"], 3)
        self.assertEqual(doc["signed_jobs_priced"], 2)
        self.assertEqual(m["avg_dollar_per_signed_job"], 12000.0)         # (14800 + 9200) / 2, unpriced one skipped
        self.assertIsNone(doc["industry"])                                 # no bench passed

    def test_claims_add_to_signed_jobs_and_the_average(self):
        doc = scorecard.report(self.doors, self.leads, self.claims, today="2026-09-27")
        m = doc["metrics"]
        # + 202 Ash St (signed, $19040), 1418 Irving St (paid, $9800), 9 Oak Ave (materials_ordered, no price);
        # NOT 103 Elm St ("scope_in", before "signed") or 5 Cedar Ct ("lost").
        self.assertEqual(m["signed_jobs"], 6)
        self.assertEqual(doc["signed_jobs_priced"], 4)
        self.assertEqual(m["avg_dollar_per_signed_job"], 13210.0)         # (14800+9200+19040+9800) / 4
        self.assertEqual(m["doors_knocked"], 11)                          # claims never touch the door count

    def test_no_priced_signed_jobs_is_null_not_zero(self):
        leads = [{"id": "a", "stage": "job_scheduled"}, {"id": "b", "stage": "done"}]
        doc = scorecard.report([], leads, today="2026-09-27")
        self.assertEqual(doc["metrics"]["signed_jobs"], 2)
        self.assertIsNone(doc["metrics"]["avg_dollar_per_signed_job"])
        self.assertEqual(doc["signed_jobs_priced"], 0)

    def test_no_signed_jobs_at_all(self):
        doc = scorecard.report([], [{"id": "a", "stage": "not_contacted"}], today="2026-09-27")
        self.assertEqual(doc["metrics"]["signed_jobs"], 0)
        self.assertIsNone(doc["metrics"]["avg_dollar_per_signed_job"])

    def test_window_filters_doors_but_never_leads_or_claims(self):
        # --from/--to narrows which door taps count, but a signed lead/claim counts whatever week it closed in
        # (no reliable signed-date field yet) - so signed_jobs/avg stay the same as the unwindowed report.
        doc = scorecard.report(self.doors, self.leads, self.claims, start="2026-09-24", end="2026-09-26",
                               today="2026-09-27")
        m = doc["metrics"]
        self.assertEqual((doc["from"], doc["to"]), ("2026-09-24", "2026-09-26"))
        self.assertEqual(m["doors_knocked"], 10)                          # the 2026-09-10 door drops out
        self.assertEqual(m["contact_rate"], 0.7)
        self.assertEqual(m["inspections_per_100_doors"], 20.0)
        self.assertEqual(m["signed_jobs"], 6)
        self.assertEqual(m["avg_dollar_per_signed_job"], 13210.0)

    def test_industry_ranges_from_the_real_benchmarks_file(self):
        bench = benchmarks.load()
        doc = scorecard.report(self.doors, self.leads, self.claims, start="2026-09-24", end="2026-09-26",
                               today="2026-09-27", bench=bench)
        rates = doc["industry"]["rates"]
        self.assertEqual(doc["industry"]["label"]["en"], "industry estimate, not your numbers")
        c = rates["contact_rate"]
        self.assertEqual((c["low"], c["typical"], c["high"], c["yours"], c["vs"]), (0.2, 0.3, 0.4, 0.7, "above"))
        i = rates["inspection_rate_per_100"]
        self.assertEqual((i["low"], i["typical"], i["high"], i["yours"], i["vs"]), (0.5, 1.0, 2.0, 20.0, "above"))
        s = rates["inspection_to_signed"]
        self.assertEqual((s["low"], s["typical"], s["high"]), (0.4, 0.58, 0.74))
        self.assertEqual(s["yours"], round(6 / 2, 3))                    # 6 signed / 2 booked in the window
        a = rates["avg_dollar_per_signed_job"]
        self.assertEqual((a["low"], a["typical"], a["high"]), (5554, 11587, 17717))
        self.assertEqual(a["yours"], 13210.0)
        self.assertEqual(a["vs"], "in range")
        self.assertIn("angi.com", a["source_note"])

    def test_company_id_defaults_to_hmp_but_can_be_set(self):
        self.assertEqual(scorecard.report([], [], today="2026-09-27")["company"], "hmp")
        self.assertEqual(scorecard.report([], [], today="2026-09-27", company="acme")["company"], "acme")


class ScorecardCli(unittest.TestCase):
    def _run(self, args):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            rc = hh.main(args)
        return rc, json.loads(out.getvalue())

    def test_cli_matches_the_module(self):
        rc, doc = self._run(["scorecard", "--doors", DOORS, "--leads", LEADS, "--claims", CLAIMS,
                             "--from", "2026-09-24", "--to", "2026-09-26", "--date", "2026-09-27"])
        self.assertEqual(rc, 0)
        self.assertEqual(doc["metrics"]["doors_knocked"], 10)
        self.assertEqual(doc["metrics"]["signed_jobs"], 6)
        self.assertEqual(doc["metrics"]["avg_dollar_per_signed_job"], 13210.0)
        self.assertEqual(doc["company"], "hmp")

    def test_cli_company_flag_and_out_file(self, ):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            out_path = os.path.join(d, "scorecard.json")
            rc, doc = self._run(["scorecard", "--doors", DOORS, "--company", "acme", "--out", out_path])
            self.assertEqual(rc, 0)
            self.assertEqual(doc["company"], "acme")
            with open(out_path) as f:
                self.assertEqual(json.load(f)["company"], "acme")

    def test_cli_without_leads_or_claims(self):
        rc, doc = self._run(["scorecard", "--doors", DOORS])
        self.assertEqual(rc, 0)
        self.assertEqual(doc["metrics"]["doors_knocked"], 11)
        self.assertEqual(doc["metrics"]["signed_jobs"], 0)


class WeeklyScorecardSection(unittest.TestCase):
    """The `scorecard` section embedded in `hh.py weekly`'s own output (leads only - weekly has no claims)."""

    def setUp(self):
        self.doors = weekly.load_doors(load(os.path.join(FIX, "weekly_doors.json")))
        self.leads = weekly.load_leads(load(os.path.join(FIX, "weekly_leads.json")))

    def test_scorecard_section_matches_the_weeks_totals(self):
        doc = weekly.report(self.doors, self.leads, week="2026-39", today="2026-09-26")
        card = doc["scorecard"]
        self.assertEqual(card["company"], "hmp")
        self.assertEqual(card["metrics"]["doors_knocked"], doc["totals"]["doors"])
        self.assertEqual(card["metrics"]["contact_rate"], doc["totals"]["contact_rate"])
        self.assertEqual(card["metrics"]["inspections_per_100_doors"], doc["totals"]["inspection_rate_per_100"])
        # weekly_leads.json has exactly one lead past job_scheduled ("1418 Irving St", stage "done"), no
        # contract_price on it - so 1 signed job and a null (not zero) average.
        self.assertEqual(card["metrics"]["signed_jobs"], 1)
        self.assertIsNone(card["metrics"]["avg_dollar_per_signed_job"])

    def test_scorecard_section_gets_industry_ranges_too(self):
        doc = weekly.report(self.doors, self.leads, week="2026-39", today="2026-09-26", bench=benchmarks.load())
        self.assertIsNotNone(doc["scorecard"]["industry"])
        self.assertIn("avg_dollar_per_signed_job", doc["scorecard"]["industry"]["rates"])


if __name__ == "__main__":
    unittest.main()
