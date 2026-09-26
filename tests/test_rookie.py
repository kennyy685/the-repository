"""Offline tests for the rookie plan progress (`hh.py rookie`, and `rookie` in `hh.py weekly`):
day number, block, door target, streak and the EN/ES verdict, from data/rookie_plan.json-shaped blocks."""
import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import rookie, weekly  # noqa: E402

PLAN = [
    {"day_range": "1-8", "focus_en": "Practice", "focus_es": "Práctica", "daily_goal": "Do 3 roleplays.",
     "drill_ids": ["d1"]},
    {"day_range": "9-16", "focus_en": "Low volume", "focus_es": "Poco volumen",
     "daily_goal": "Knock 10 real doors (about 1 hour).", "drill_ids": ["d2", "d3"]},
    {"day_range": "17-24", "focus_en": "Build", "focus_es": "Aumenta", "daily_goal": "Knock 20-25 doors.",
     "drill_ids": []},
    {"day_range": "25-60", "focus_en": "Full", "focus_es": "Completo", "daily_goal": "Knock your full route.",
     "drill_ids": []},
]
START = date(2026, 10, 1)


def taps(per_day):
    """{day_number: doors} -> door-tap docs like the app's doors/<date>_<pid>."""
    out = {}
    for n, k in per_day.items():
        d = (START + timedelta(days=n - 1)).isoformat()
        for i in range(k):
            out[f"doors/{d}_p{n}x{i}"] = {"date": d, "pid": f"p{n}x{i}", "result": "not_home"}
    return weekly.load_doors(out)


def on(n):
    return START + timedelta(days=n - 1)


class Targets(unittest.TestCase):
    def test_parsed_from_goal_when_missing(self):
        self.assertEqual([rookie.door_target(b) for b in PLAN], [0, 10, 20, 25])

    def test_explicit_field_wins(self):
        self.assertEqual(rookie.door_target({"daily_goal": "Knock 10 doors", "door_target": 12}), 12)

    def test_repo_plan_has_door_targets(self):
        plan = rookie.load_plan(os.path.join(os.path.dirname(HERE), "data", "rookie_plan.json"))
        if plan is None:
            self.skipTest("no data/rookie_plan.json")
        for b in plan:
            self.assertIsInstance(b.get("door_target"), int, b.get("day_range"))


class Progress(unittest.TestCase):
    def test_practice_day_then_first_knock_starts_plan(self):
        doors = taps({1: 2})
        r = rookie.progress(doors, PLAN, on(3))
        self.assertEqual((r["day"], r["start_source"], r["status"]), (3, "first_door", "practice"))
        self.assertEqual(r["block"]["drill_ids"], ["d1"])
        self.assertEqual(r["block"]["door_target"], 0)

    def test_config_start_date(self):
        r = rookie.progress(taps({}), PLAN, on(10), {"rookie": {"start_date": START.isoformat()}})
        self.assertEqual((r["day"], r["start_source"]), (10, "config"))
        self.assertIsNone(rookie.progress(taps({}), PLAN, on(10)))   # no taps, no config: not ready

    def test_streak_counts_hit_days_skips_practice_and_unfinished_today(self):
        doors = taps({1: 1, 9: 12, 10: 10, 11: 4, 12: 11, 13: 10, 14: 3})
        r = rookie.progress(doors, PLAN, on(14))       # today (day 14) only 3 so far: doesn't break the streak
        self.assertEqual(r["streak"], {"days": 2, "best": 2})
        self.assertEqual(r["block"]["day_range"], "9-16")
        self.assertEqual((r["block_expected"], r["block_doors"]), (50, 50))   # 5 finished days x 10
        self.assertEqual(r["status"], "on_pace")

    def test_behind_is_kind_and_ahead(self):
        r = rookie.progress(taps({1: 1, 9: 3, 10: 2}), PLAN, on(11))
        self.assertEqual(r["status"], "behind")
        self.assertIn("a bit behind", r["verdict"]["en"])
        self.assertIn("un poco atrás", r["verdict"]["es"])
        for bad in ("fail", "lazy", "bad", "only"):
            self.assertNotIn(bad, r["verdict"]["en"].lower())
        r = rookie.progress(taps({1: 1, 17: 40}), PLAN, on(18))
        self.assertEqual((r["status"], r["block_expected"]), ("ahead", 20))
        self.assertEqual(r["block"]["door_target"], 20)

    def test_full_route_block_and_past_plan(self):
        r = rookie.progress(taps({1: 1, 61: 25}), PLAN, on(61))
        self.assertTrue(r["plan_done"])
        self.assertEqual(r["block"]["door_target"], 25)
        self.assertEqual(r["streak"]["days"], 1)


class Cli(unittest.TestCase):
    def run_cli(self, *args):
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            code = hh.main(list(args))
        return code, json.loads(buf.getvalue())

    def test_rookie_command_and_weekly_section(self):
        with tempfile.TemporaryDirectory() as tmp:
            plan, doors = os.path.join(tmp, "plan.json"), os.path.join(tmp, "doors.json")
            with open(plan, "w") as f:
                json.dump(PLAN, f)
            d9 = on(9).isoformat()
            with open(doors, "w") as f:
                json.dump({f"doors/{on(1).isoformat()}_a": {"result": "no"},
                           **{f"doors/{d9}_b{i}": {"result": "booked"} for i in range(10)}}, f)
            code, doc = self.run_cli("rookie", "--doors", doors, "--date", d9, "--rookie-plan", plan)
            self.assertEqual(code, 0)
            self.assertTrue(doc["ready"])
            self.assertEqual((doc["day"], doc["streak"]["days"]), (9, 1))
            code, wk = self.run_cli("weekly", "--doors", doors, "--date", d9, "--week", "2026-41",
                                    "--rookie-plan", plan, "--hud", os.path.join(tmp, "none.json"))
            self.assertEqual(code, 0)
            self.assertEqual(wk["rookie"]["day"], 9)
            code, wk = self.run_cli("weekly", "--doors", doors, "--date", d9, "--rookie-plan",
                                    os.path.join(tmp, "missing.json"), "--hud", os.path.join(tmp, "none.json"))
            self.assertIsNone(wk["rookie"])             # no plan file: skipped quietly
            code, doc = self.run_cli("rookie", "--doors", doors, "--rookie-plan", os.path.join(tmp, "missing.json"))
            self.assertFalse(doc["ready"])


if __name__ == "__main__":
    unittest.main()
