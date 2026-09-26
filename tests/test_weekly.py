"""Offline tests for `hh.py weekly`: the week's results from the HMP App's door taps (doors/<date>_<pid>) and
leads (leads/<slug>), joined with hud.json heat/why for the T35 learning loop.
Fixtures: tests/fixtures/weekly_doors.json, weekly_leads.json (week 2026-39) and today_hud.json (the lists)."""
import contextlib
import io
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import weekly  # noqa: E402

FIX = os.path.join(HERE, "fixtures")
DOORS, LEADS, HUD = (os.path.join(FIX, n) for n in ("weekly_doors.json", "weekly_leads.json", "today_hud.json"))
STORM_WALK, EVERY_WALK = "2026-09-10_Fremont~t1", "everyday_Fremont_310539640003~t1"


def load(p):
    with open(p) as f:
        return json.load(f)


class WeeklyReport(unittest.TestCase):
    def setUp(self):
        self.doors = weekly.load_doors(load(DOORS))
        self.leads = weekly.load_leads(load(LEADS))
        self.hud = load(HUD)
        self.doc = weekly.report(self.doors, self.leads, week="2026-39", hud=self.hud, today="2026-09-26")

    def test_totals_for_the_week_only(self):
        t = self.doc["totals"]
        self.assertEqual((self.doc["from"], self.doc["to"]), ("2026-09-21", "2026-09-27"))
        self.assertEqual(t["doors"], 21)                       # the 2026-09-18 door is last week
        self.assertEqual((t["answered"], t["interested"], t["booked"], t["not_home"]), (10, 2, 3, 11))
        self.assertAlmostEqual(t["not_home_rate"], round(11 / 21, 3))
        self.assertEqual(weekly.report(self.doors, self.leads, week="all", hud=self.hud,
                                       today="2026-09-26")["totals"]["doors"], 22)

    def test_by_kind_list_and_walk(self):
        k = self.doc["by_kind"]
        self.assertEqual((k["storm"]["doors"], k["everyday"]["doors"], k["unknown"]["doors"]), (12, 8, 1))
        walks = {w["walk_id"]: w for w in self.doc["by_walk"]}
        self.assertEqual(walks[STORM_WALK]["doors"], 10)
        self.assertEqual(walks[STORM_WALK]["inspection_rate_per_100"], 10.0)
        self.assertEqual(walks[EVERY_WALK]["inspection_rate_per_100"], 25.0)
        self.assertEqual(walks[EVERY_WALK]["leads_per_100"], 37.5)
        self.assertEqual(walks[EVERY_WALK]["kind"], "everyday")
        lists = {L["list_id"]: L for L in self.doc["by_list"]}
        self.assertEqual(lists["2026-03-01_Blair"]["doors"], 2)
        self.assertEqual(lists["unknown"]["kind"], "unknown")

    def test_best_and_worst_area_with_sentences(self):
        a = self.doc["areas"]
        self.assertEqual(a["best"]["walk_id"], EVERY_WALK)
        self.assertEqual(a["worst"]["walk_id"], STORM_WALK)     # Blair (2 doors) is too small to be named
        self.assertIn("Pine St, Fremont", a["en"])
        self.assertIn("La mejor zona", a["es"])
        self.assertIn("60% not home", a["en"])
        few = weekly.report(self.doors[:3], [], week="2026-39", hud=self.hud, today="2026-09-26")["areas"]
        self.assertIsNone(few["best"])
        self.assertIn("Not enough doors", few["en"])

    def test_follow_ups_open_only_soonest_first(self):
        f = self.doc["follow_ups"]
        self.assertEqual([r["id"] for r in f["open"]], ["103-e-4th-st", "400-pine-st", "105-e-4th-st", "401-pine-st"])
        self.assertEqual((f["overdue"], f["due_today"], f["open_without_next_step"]), (1, 1, 1))
        self.assertTrue(f["open"][0]["overdue"])
        self.assertEqual(f["open"][0]["next"]["es"], "Llamar para agendar inspección")

    def test_funnel_by_stage(self):
        fn = self.doc["funnel"]
        c = {s["key"]: s["count"] for s in fn["stages"]}
        self.assertEqual(len(fn["stages"]), 10)                # the app's 9 stages + Lost
        self.assertEqual((c["contacted"], c["inspection_set"], c["approved"], c["done"], c["lost"]), (2, 2, 1, 1, 1))
        self.assertEqual((fn["total"], fn["open"], fn["new_this_week"]), (7, 5, 5))

    def test_learning_joins_heat_and_why(self):
        L = {x["list_id"]: x for x in self.doc["learning"]["lists"]}
        self.assertTrue(self.doc["learning"]["hud"])
        storm = L["2026-09-10_Fremont"]
        self.assertEqual(storm["heat"], 40.2)                  # the list's hottest walk
        self.assertEqual(storm["walks"][0]["why"][0], '1.6" hail')
        self.assertEqual(storm["inspection_or_later"], 1)       # 105 E 4th: inspection set; 103 E 4th: contacted
        ev = L["everyday_Fremont_310539640003"]
        self.assertEqual(ev["heat"], 55.0)
        self.assertIn("mostly owner-occupied", ev["why"])
        self.assertEqual(ev["leads_now"], {"inspection_set": 1, "approved": 1, "contacted": 1})
        self.assertEqual(ev["inspection_or_later"], 2)
        self.assertFalse(L["unknown"]["in_hud"])

    def test_without_hud_everything_is_unknown_but_counted(self):
        doc = weekly.report(self.doors, self.leads, week="2026-39", today="2026-09-26")
        self.assertEqual(doc["totals"]["doors"], 21)
        self.assertEqual(list(doc["by_kind"]), ["unknown"])
        self.assertFalse(doc["learning"]["hud"])

    def test_door_doc_list_id_wins_and_list_exports_load(self):
        rows = weekly.load_doors([
            {"id": "2026-09-22_DODGE-1001", "data": {"result": "Not home", "list_id": "my_list", "kind": "storm"}},
            {"doc_id": "doors/2026-09-22_DODGE-E0", "result": "interested"},
            {"id": "junk"}])
        self.assertEqual([(r["pid"], r["date"], r["result"]) for r in rows],
                         [("DODGE-1001", "2026-09-22", "not_home"), ("DODGE-E0", "2026-09-22", "interested")])
        doc = weekly.report(rows, [], week="2026-W39", hud=self.hud, today="2026-09-26")
        self.assertEqual({L["list_id"] for L in doc["by_list"]}, {"my_list", "everyday_Fremont_310539640003"})
        self.assertEqual(weekly.load_doors({"docs": [{"id": "2026-09-22_P1", "result": "no"}]})[0]["pid"], "P1")

    def test_kind_not_borrowed_from_a_different_list_sharing_the_pid(self):
        # a door doc's own list_id ("my_list", unknown to hud) must win over a same-pid hud entry on
        # another list; that other list's kind/turf must not leak onto this door.
        hud = {"lists": [{"id": "2026-09-10_Fremont", "day": "2026-09-10", "area": "Fremont, NE",
                          "stops": [{"pid": "P1", "turf": 1}]}]}
        doors = weekly.load_doors([{"id": "2026-09-20_P1", "data": {"result": "no", "list_id": "my_list",
                                    "address": "1 Elm St", "city": "Fremont"}}])
        doc = weekly.report(doors, [], week="all", hud=hud, today="2026-09-26")
        row = doc["by_list"][0]
        self.assertEqual(row["list_id"], "my_list")
        self.assertEqual(row["kind"], "unknown")       # not "storm" borrowed from the other list
        walk = doc["by_walk"][0]
        self.assertIsNone(walk["turf"])

    def test_estimates_counted_by_estimate_date_any_stage(self):
        # fixture: 400 Pine (stage inspection_set + estimate 2026-09-26, market prices), 402 Pine (contacted,
        # estimate 2026-09-23, HMP prices) are in week 39; 401 Pine's estimate (2026-09-19) is last week.
        t = self.doc["totals"]
        self.assertEqual(t["estimates"], 2)
        self.assertEqual(t["estimates_value"], {"low": 12550 + 9800, "high": 16850 + 13200, "using_reference": True})
        self.assertEqual(t["booked"], 3)                       # door-tap counts untouched
        last = weekly.report(self.doors, self.leads, week="2026-38", hud=self.hud, today="2026-09-26")["totals"]
        self.assertEqual((last["estimates"], last["estimates_value"]),
                         (1, {"low": 22150, "high": 30050, "using_reference": True}))
        every = weekly.report(self.doors, self.leads, week="all", hud=self.hud, today="2026-09-26")["totals"]
        self.assertEqual(every["estimates"], 3)

    def test_estimate_lead_counts_once_and_flags_only_market_prices(self):
        leads = weekly.load_leads({
            # a lead with a stage AND an estimate, repeated in the export: one estimate, not two
            "leads/5-elm-st": {"address": "5 Elm St", "stage": "inspection_set",
                               "estimate": {"low": 1000, "high": 2000, "at": "2026-09-22", "using_reference": False}},
            "leads/5-elm-st-dupe": {"address": "5 Elm St", "stage": "approved",
                                    "estimate": {"low": 1000, "high": 2000, "at": "2026-09-22"}},
            "leads/6-elm-st": {"address": "6 Elm St", "stage": "contacted",
                               "estimate": {"low": "bad", "high": None, "at": "2026-09-24"}},   # counted, $ skipped
            "leads/7-elm-st": {"address": "7 Elm St", "stage": "approved", "estimate": {"low": 5, "high": 9}},
            "leads/8-elm-st": {"address": "8 Elm St", "stage": "approved"}})
        leads[1]["id"] = leads[0]["id"]                        # same lead exported twice
        t = weekly.report([], leads, week="2026-39", today="2026-09-26")["totals"]
        self.assertEqual(t["estimates"], 2)                    # 7 Elm has no date: not in any week
        self.assertEqual(t["estimates_value"], {"low": 1000, "high": 2000, "using_reference": False})
        none = weekly.report([], [], week="2026-39", today="2026-09-26")["totals"]
        self.assertEqual((none["estimates"], none["estimates_value"]),
                         (0, {"low": 0, "high": 0, "using_reference": False}))

    def test_week_parsing_and_slug(self):
        s, e = weekly.week_range("2026-W39")
        self.assertEqual((s.isoformat(), e.isoformat()), ("2026-09-21", "2026-09-27"))
        self.assertEqual(weekly.week_id("2026-01-01"), "2026-01")
        with self.assertRaises(ValueError):
            weekly.week_range("September")
        self.assertEqual(weekly.slug("1418 Irving St."), "1418-irving-st")
        self.assertEqual(weekly.slug("12 Cañón Ave"), "12-canon-ave")

    def test_cli_writes_json(self):
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "weekly.json")
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                rc = hh.main(["weekly", "--doors", DOORS, "--leads", LEADS, "--week", "2026-39", "--hud", HUD,
                              "--date", "2026-09-26", "--out", out])
            self.assertEqual(rc, 0)
            doc = load(out)
            self.assertEqual(json.loads(buf.getvalue())["totals"], doc["totals"])
            self.assertEqual(doc["week"], "2026-39")
            self.assertIn("summary", doc)
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(hh.main(["weekly", "--doors", DOORS, "--week", "bad", "--hud", HUD]), 2)


if __name__ == "__main__":
    unittest.main()
