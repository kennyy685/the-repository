"""Follow-up schedule (`hh.py followups`, research round 9 #2): touches 2/5/10 days after the first Interested,
plus next steps, grouped today/tomorrow/later, EN/ES; docs/app/followups.js must match it exactly."""
import contextlib
import copy
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

import hh  # noqa: E402
from hailhunter import config, followups as F, weekly  # noqa: E402

NODE = shutil.which("node")
CHECK_JS = os.path.join(HERE, "js", "followups_check.js")
APP_JS = os.path.join(ROOT, "docs", "app", "followups.js")      # not in the cloud bundle: the check skips there
LEADS = os.path.join(HERE, "fixtures", "weekly_leads.json")
BANNED = re.compile(r"deductib|deducib|waive|rebate|insurance will|will pay|pagará|\$", re.I)


def lead(**kw):
    return {"id": kw.get("address", "x").lower().replace(" ", "-"), "address": "12 Oak St", "stage": "contacted",
            "doors_visits": [{"date": "2026-09-24", "result": "interested"}], **kw}


class Followups(unittest.TestCase):
    def run_f(self, leads, today):
        return F.followups(leads, today)

    def test_touch_at_48h_5d_10d(self):
        L = [lead()]
        self.assertEqual(self.run_f(L, "2026-09-25")["tomorrow"][0]["due"], "2026-09-26")
        t = self.run_f(L, "2026-09-26")["today"][0]
        self.assertEqual((t["kind"], t["touch"], t["overdue"]), ("touch", 1, False))
        self.assertIn("2-day follow-up", t["reason"]["en"])
        self.assertIn("Seguimiento de 2 días", t["reason"]["es"])
        # a visit on day 2 counts; the next one shows at day 5, then day 10 is the last
        L[0]["last_contact"] = "2026-09-26T21:00:00Z"
        d = self.run_f(L, "2026-09-27")
        self.assertEqual(d["later"][0]["touch"], 2)
        self.assertEqual(d["later"][0]["due"], "2026-09-29")
        L[0]["last_contact"] = "2026-09-29"
        t = self.run_f(L, "2026-10-04")["today"][0]
        self.assertEqual((t["touch"], t["due"]), (3, "2026-10-04"))
        self.assertIn("Last planned touch", t["reason"]["en"])
        L[0]["last_contact"] = "2026-10-04"
        self.assertEqual(self.run_f(L, "2026-10-05")["counts"], {"today": 0, "tomorrow": 0, "later": 0, "overdue": 0})

    def test_late_touches_collapse_into_one_line(self):
        d = self.run_f([lead()], "2026-10-01")
        self.assertEqual(len(d["today"]), 1)
        t = d["today"][0]
        self.assertEqual((t["touch"], t["days_late"], t["overdue"]), (2, 2, True))
        self.assertTrue(t["reason"]["en"].startswith("2 days late. Interested on Sep 24 (7 days ago)."), t["reason"])
        self.assertEqual(d["counts"]["overdue"], 1)
        self.assertEqual(d["summary"]["en"], "1 follow-up today (1 late), 0 tomorrow.")

    def test_next_steps_and_closed_leads(self):
        with open(LEADS, encoding="utf-8") as f:
            d = F.followups(weekly.load_leads(json.load(f)), "2026-09-28")
        for g in ("today", "tomorrow", "later"):
            for r in d[g]:
                self.assertNotIn(r["stage"], ("done", "lost"))
                self.assertIsNone(BANNED.search(r["reason"]["en"] + r["reason"]["es"]), r)
        step = next(r for r in d["today"] if r["id"] == "103-e-4th-st")
        self.assertEqual(step["kind"], "next_step")
        self.assertEqual(step["reason"]["en"], "Call back about an inspection (due Sep 25, 3 days late)")
        self.assertEqual(step["reason"]["es"], "Llamar para agendar inspección (vencía el 25 de sep, 3 días de atraso)")

    def test_booked_touches_stop_at_the_appointment_and_cash_says_estimate(self):
        b = lead(stage="inspection_set", next_step={"en": "Inspection", "due": "2026-09-27"},
                 doors_visits=[{"date": "2026-09-24", "result": "booked"}])
        self.assertIn("Booked on Sep 24", self.run_f([b], "2026-09-26")["today"][0]["reason"]["en"])
        d = self.run_f([b], "2026-09-28")                      # visit day passed: only the (late) step
        self.assertEqual([r["kind"] for r in d["today"]], ["next_step"])
        c = lead(type="cash", source="everyday")
        self.assertIn("free estimate", self.run_f([c], "2026-09-26")["today"][0]["reason"]["en"])
        self.assertIn("un estimado gratis", self.run_f([c], "2026-09-26")["today"][0]["reason"]["es"])

    def test_bad_input(self):
        with self.assertRaises(ValueError):
            F.followups([], "2026-02-30")
        d = F.followups([None, {"id": "z", "stage": "contacted", "created_at": "junk"}], "2026-09-26")
        self.assertEqual(d["counts"]["today"] + d["counts"]["later"], 0)

    def test_cli(self):
        with tempfile.TemporaryDirectory() as t:
            out = os.path.join(t, "f.json")
            buf, err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(err):
                rc = hh.main(["followups", "--leads", LEADS, "--date", "2026-09-28", "--out", out])
            self.assertEqual(rc, 0)
            self.assertEqual(json.load(open(out))["as_of"], "2026-09-28")
            self.assertIn("follow-up", err.getvalue())
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(hh.main(["followups"]), 2)

    def test_export_rules_cases_are_real_results(self):
        doc = F.export_rules(config.load())
        self.assertEqual(doc["version"], F.RULES_VERSION)
        self.assertEqual(doc["touch_days"], [2, 5, 10])
        for c in doc["test_cases"]:
            self.assertEqual(c["result"], F.followups(c["leads"], c["today"]))


@unittest.skipUnless(NODE and os.path.exists(CHECK_JS) and os.path.exists(APP_JS),
                     "node or the app's followups.js not here (cloud bundle): JS parity check skipped")
class JsMatchesPython(unittest.TestCase):
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
        self.assertEqual(self.run_node(F.export_rules(config.load())), len(F.RULE_TEST_CASES))

    def test_changed_rules(self):
        cfg = copy.deepcopy(config.DEFAULTS)
        cfg["followups"] = {**cfg["followups"], "touch_days": [1, 3, 7, 14], "early_ok_days": 0}
        self.assertEqual(self.run_node(F.export_rules(cfg)), len(F.RULE_TEST_CASES))


if __name__ == "__main__":
    unittest.main()
