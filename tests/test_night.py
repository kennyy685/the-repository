"""Night shift (`hh.py night`, hailhunter/night.py): the 7 AM "Since last night" brief.
Fixture tests/fixtures/today_hud.json (fresh Fremont storm list with 2 walks, an everyday list) plus made-up storm rows
(real towns, fake numbers); never owner names."""
import contextlib
import copy
import io
import json
import os
import re
import tempfile
import unittest
from datetime import datetime, timezone

import hh
from hailhunter import config as C
from hailhunter import night, zones

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, "fixtures", "today_hud.json")
SAMPLE = os.path.join(HERE, "..", "docs", "design", "open-map", "data", "night.js")
DAY = "2026-09-25"
NOW = datetime(2026, 9, 25, 10, 0, tzinfo=timezone.utc)
KEYS = {"v", "kind", "date", "made_at", "since", "first_run", "quiet", "headline", "new_hail", "zones_up", "zones_down",
        "zones_new", "zones_gone", "walks_changed", "pick", "backup", "zones", "storm_keys"}
CARD = {"zone_id", "name", "kind", "score", "hail_in", "storm_day", "dist_mi", "doors", "start", "best_time", "why",
        "plan"}
NEVER = re.compile(r"insur|asegur|seguro|deduct|deduc|guarant|owner name", re.I)


def storm(day, place, hail, dist=5.0, state="NE"):
    return {"day": day, "place": place, "state": state, "hail": hail, "dist_mi": dist}


class NightBrief(unittest.TestCase):
    def setUp(self):
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))
        with open(FIX, encoding="utf-8") as f:
            self.hud = json.load(f)
        self.hud["storms"] = [storm("2026-09-10", "Fremont", 1.6), storm("2026-03-01", "Blair", 1.0, 12)]

    def run_brief(self, hud, prev=None, results=None):
        zd = zones.zones(hud, DAY, cfg=self.cfg, results=results)
        w = zones.walks(hud, zd, DAY, cfg=self.cfg, results=results)
        return night.brief(hud, zd, w, DAY, prev, self.cfg, now=NOW)

    def check_text(self, d):
        text = json.dumps({k: v for k, v in d.items() if k != "storm_keys"}, ensure_ascii=False)
        self.assertIsNone(NEVER.search(text), NEVER.search(text))
        self.assertTrue(d["headline"]["en"] and d["headline"]["es"])
        self.assertNotEqual(d["headline"]["en"], d["headline"]["es"])

    def test_first_run_no_previous_brief(self):
        d = self.run_brief(self.hud)
        self.assertEqual(set(d), KEYS)
        self.assertTrue(d["first_run"])
        self.assertFalse(d["quiet"])
        self.assertIsNone(d["since"])
        self.assertEqual(d["new_hail"], [])                    # nothing to diff against: no made-up "new" hail
        self.assertEqual(d["zones_up"] + d["zones_down"] + d["zones_new"] + d["walks_changed"], [])
        self.assertTrue(d["headline"]["en"].startswith("First night brief"))
        self.assertIn("2026-09-10|Fremont|NE", d["storm_keys"])
        self.check_text(d)

    def test_ranking_pick_and_backup(self):
        d = self.run_brief(self.hud)
        self.assertEqual([z["rank"] for z in d["zones"]], list(range(1, len(d["zones"]) + 1)))
        scores = [z["score"] for z in d["zones"]]
        self.assertEqual(scores, sorted(scores, reverse=True))
        p, b = d["pick"], d["backup"]
        self.assertEqual(set(p), CARD)
        self.assertEqual(p["zone_id"], d["zones"][0]["id"])     # Aldaba's #1 = the top-ranked zone
        self.assertEqual(p["doors"], 25)
        self.assertTrue(p["start"]["address"])
        self.assertIn(p["start"]["address"], p["plan"]["en"])
        self.assertIn("25 doors", p["plan"]["en"])
        self.assertIn("25 puertas", p["plan"]["es"])
        self.assertTrue(p["why"]["en"] and p["why"]["es"])
        # backup comes from a different list (another storm/area), not the #1's sister turf
        top_list = next(z for z in zones.zones(self.hud, DAY, cfg=self.cfg)["zones"] if z["id"] == p["zone_id"])["list_id"]
        self.assertNotEqual(b["zone_id"].split("~")[0], top_list)

    def test_backup_prefers_another_list(self):
        zd = {"zones": [{"id": "A~t1", "list_id": "A", "name": "a1", "homes": 5, "kind": "storm"},
                        {"id": "A~t2", "list_id": "A", "name": "a2", "homes": 5, "kind": "storm"},
                        {"id": "B~t1", "list_id": "B", "name": "b1", "homes": 5, "kind": "everyday"},
                        {"id": "wind~x", "kind": "wind", "name": "w"}]}
        p, b = night.choose(zd, {})
        self.assertEqual((p["zone_id"], b["zone_id"]), ("A~t1", "B~t1"))
        zd["zones"].pop(2)
        self.assertEqual(night.choose(zd, {})[1]["zone_id"], "A~t2")   # only one list: the next zone

    def test_quiet_night(self):
        prev = self.run_brief(self.hud)
        d = self.run_brief(copy.deepcopy(self.hud), prev)
        self.assertFalse(d["first_run"])
        self.assertTrue(d["quiet"])
        self.assertEqual(d["since"], prev["made_at"])
        self.assertEqual(d["new_hail"], [])
        self.assertEqual(d["zones_up"] + d["zones_down"] + d["zones_new"] + d["zones_gone"] + d["walks_changed"], [])
        n = d["pick"]["name"]
        self.assertEqual(d["headline"]["en"], f"No new hail since last night; best zone is still {n}.")
        self.assertEqual(d["headline"]["es"], f"Sin granizo nuevo desde anoche; la mejor zona sigue siendo {n}.")
        self.check_text(d)

    def test_diff_new_hail_by_town_and_size(self):
        prev = self.run_brief(self.hud)
        hud = copy.deepcopy(self.hud)
        hud["storms"] += [storm("2026-09-24", "Blair", 1.0, 12), storm("2026-09-24", "Blair", 1.75, 13),  # one row
                          storm("2026-09-24", "Fremont", 1.25, 1), storm("2026-09-24", "Hooper", 0.5, 15),  # too small
                          storm("2026-09-24", "Denver", 2.0, 480, "CO")]                                  # too far
        d = self.run_brief(hud, prev)
        self.assertFalse(d["quiet"])
        self.assertEqual([(r["town"], r["hail_in"]) for r in d["new_hail"]], [("Blair", 1.75), ("Fremont", 1.25)])
        self.assertEqual(set(d["new_hail"][0]), {"town", "state", "day", "hail_in", "dist_mi", "zone_id"})
        self.assertIsNone(d["new_hail"][0]["zone_id"])       # no walk for that storm yet
        self.assertTrue(d["headline"]["en"].startswith("New hail since last night: 1.75″ in Blair, 1.25″ in Fremont."))
        self.assertIn("en Blair", d["headline"]["es"])
        self.assertIn("2026-09-24|Blair|NE", d["storm_keys"])
        again = self.run_brief(hud, d)                         # the next night: already seen, quiet again
        self.assertEqual(again["new_hail"], [])
        self.assertTrue(again["quiet"])
        self.check_text(d)

    def test_diff_zone_moves_and_walks_changed(self):
        prev = self.run_brief(self.hud)
        ids = [z["id"] for z in prev["zones"]]
        prev = copy.deepcopy(prev)                             # pretend last night ranked them the other way round
        for z, r in zip(prev["zones"], reversed(range(1, len(ids) + 1))):
            z["rank"] = r
        prev["zones"][1]["homes"] += 7                         # 7 doors knocked since
        prev["zones"].append({"id": "old~t1", "name": "Blair: Front St", "rank": 9, "score": 5, "homes": 4})
        prev["pick"] = {"zone_id": ids[-1], "name": "Somewhere Else"}
        d = self.run_brief(self.hud, prev)
        self.assertEqual([z["id"] for z in d["zones_up"]], [ids[0]])
        self.assertEqual(d["zones_up"][0]["was"], len(ids))
        self.assertEqual([z["id"] for z in d["zones_down"]], [ids[-1]])
        self.assertEqual(d["zones_gone"], [{"id": "old~t1", "name": "Blair: Front St", "was": 9}])
        wc = d["walks_changed"][0]
        self.assertEqual((wc["id"], wc["was"] - wc["homes"]), (ids[1], 7))
        self.assertIn("(was Somewhere Else)", d["headline"]["en"])
        self.assertIn("antes Somewhere Else", d["headline"]["es"])
        self.assertTrue(d["quiet"])                            # moves alone are not new hail

    def test_one_place_shuffle_is_not_a_move(self):
        prev = self.run_brief(self.hud)
        prev = copy.deepcopy(prev)
        prev["zones"][0]["rank"], prev["zones"][1]["rank"] = 2, 1
        d = self.run_brief(self.hud, prev)
        self.assertEqual(d["zones_up"] + d["zones_down"], [])

    def test_new_zone_and_knocked_doors_from_results(self):
        prev = self.run_brief(self.hud)
        prev["zones"] = prev["zones"][:1]
        d = self.run_brief(self.hud, prev)
        self.assertEqual({z["id"] for z in d["zones_new"]}, {z["id"] for z in self.run_brief(self.hud)["zones"][1:]})

    def test_no_zones_says_so(self):
        d = night.brief({"storms": []}, {"zones": []}, {}, DAY, None, self.cfg, now=NOW)
        self.assertIsNone(d["pick"])
        self.assertIsNone(d["backup"])
        self.assertTrue(d["none_reason"]["en"] and d["none_reason"]["es"])
        q = night.brief({"storms": []}, {"zones": []}, {}, DAY, d, self.cfg, now=NOW)
        self.assertEqual(q["headline"]["en"], "No new hail since last night, and no walks with doors left nearby.")

    def test_foreign_previous_file_counts_as_first_run(self):
        d = self.run_brief(self.hud, {"zones": "junk"})
        self.assertTrue(d["first_run"])

    def test_brief_stays_small(self):
        self.assertLess(len(json.dumps(self.run_brief(self.hud))), 20000)


class NightCli(unittest.TestCase):
    def test_cli_writes_brief_and_keeps_the_previous(self):
        with tempfile.TemporaryDirectory() as t:
            args = ["night", "--no-refresh", "--hud", FIX, "--date", DAY, "--near", "41.43,-96.49", "--out-dir", t]
            with contextlib.redirect_stdout(io.StringIO()) as out:
                self.assertEqual(hh.main(args), 0)
            self.assertIn("First night brief", out.getvalue())
            self.assertFalse(os.path.exists(os.path.join(t, "brief.prev.json")))
            with open(os.path.join(t, "brief.json"), encoding="utf-8") as f:
                first = json.load(f)
            with contextlib.redirect_stdout(io.StringIO()) as out:
                self.assertEqual(hh.main(args), 0)
            self.assertIn("No new hail since last night; best zone is still", out.getvalue())
            with open(os.path.join(t, "brief.prev.json"), encoding="utf-8") as f:
                self.assertEqual(json.load(f)["made_at"], first["made_at"])
            with open(os.path.join(t, "brief.json"), encoding="utf-8") as f:
                self.assertFalse(json.load(f)["first_run"])

    def test_cli_missing_hud_still_writes_a_brief(self):
        with tempfile.TemporaryDirectory() as t:
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                rc = hh.main(["night", "--no-refresh", "--hud", os.path.join(t, "nope.json"), "--date", DAY,
                              "--out-dir", t])
            self.assertEqual(rc, 0)
            with open(os.path.join(t, "brief.json"), encoding="utf-8") as f:
                self.assertIsNone(json.load(f)["pick"])


class OpenMapSample(unittest.TestCase):
    """docs/design/open-map/data/night.js: the sample briefs the open map shows, in the engine's exact shape."""
    @unittest.skipUnless(os.path.exists(SAMPLE), "design files are not in the cloud bundle")
    def test_sample_matches_the_engine_shape(self):
        with open(SAMPLE, encoding="utf-8") as f:
            text = f.read()
        body = json.loads(text[text.index("{"):text.rindex("}") + 1])
        for key in ("quiet", "storm"):
            d = body[key]
            self.assertEqual(set(d) - {"sample"}, KEYS)
            self.assertEqual(set(d["pick"]), CARD)
            self.assertIsNone(NEVER.search(json.dumps(d, ensure_ascii=False)))
        self.assertTrue(body["quiet"]["quiet"])
        self.assertTrue(body["storm"]["new_hail"])


if __name__ == "__main__":
    unittest.main()
