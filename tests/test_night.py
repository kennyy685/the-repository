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
SAMPLE = os.path.join(HERE, "..", "docs", "design", "open-map", "data", "night-sample.js")
REAL_JS = os.path.join(HERE, "..", "docs", "design", "open-map", "data", "night.js")
DAY = "2026-09-25"
NOW = datetime(2026, 9, 25, 10, 0, tzinfo=timezone.utc)
KEYS = {"v", "kind", "date", "made_at", "since", "first_run", "quiet", "headline", "new_hail", "zones_up", "zones_down",
        "zones_new", "zones_gone", "walks_changed", "pick", "backup", "zones", "storm_keys"}
CARD = {"zone_id", "name", "kind", "score", "hail_in", "storm_day", "dist_mi", "doors", "start", "best_time", "why",
        "plan", "center", "area_id"}
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
        kinds = [z["kind"] for z in d["zones"]]
        self.assertEqual(kinds, sorted(kinds, key=lambda k: k != "storm"))     # storm zones first (King, 2026-09-29)
        for k in set(kinds):
            scores = [z["score"] for z in d["zones"] if z["kind"] == k]
            self.assertEqual(scores, sorted(scores, reverse=True))
        p, b = d["pick"], d["backup"]
        self.assertEqual(set(p), CARD)
        self.assertEqual(p["zone_id"], d["zones"][0]["id"])     # Aldaba's #1 = the top-ranked zone
        self.assertTrue(0 < p["doors"] <= 25)
        self.assertTrue(p["start"]["address"])
        self.assertIn(p["start"]["address"], p["plan"]["en"])
        self.assertIn(f"{p['doors']} doors", p["plan"]["en"])
        self.assertIn(f"{p['doors']} puertas", p["plan"]["es"])
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
        self.assertEqual(set(d["new_hail"][0]), {"town", "state", "day", "hail_in", "dist_mi", "zone_id", "area_id"})
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


    # ---- King, 2026-09-29: Aldaba's pick is a storm zone only; old-house (everyday) zones are only the backup ----
    def test_pick_is_a_storm_zone_even_when_an_old_house_zone_scores_higher(self):
        zd = zones.zones(self.hud, DAY, cfg=self.cfg)
        top = max((z for z in zd["zones"] if z["kind"] != "wind"), key=lambda z: z["score"])
        self.assertEqual(top["kind"], "everyday")               # the fixture's highest heat is an old-house zone...
        d = self.run_brief(self.hud)
        self.assertEqual(d["pick"]["kind"], "storm")            # ...but the pick is the best storm walk
        self.assertEqual(d["backup"]["kind"], "everyday")       # one storm list only: the backup is the old-house zone
        self.assertEqual(d["zones"][0]["id"], d["pick"]["zone_id"])

    def test_no_storm_walk_means_no_pick_and_an_everyday_backup(self):
        hud = copy.deepcopy(self.hud)
        hud["lists"] = []
        d = self.run_brief(hud)
        self.assertIsNone(d["pick"])
        self.assertEqual(d["backup"]["kind"], "everyday")
        self.assertIn("No storm walk with doors left nearby; backup: " + d["backup"]["name"], d["headline"]["en"])
        self.assertIn("respaldo: " + d["backup"]["name"], d["headline"]["es"])
        self.assertIn("older-homes", d["none_reason"]["en"])
        self.check_text(d)

    def test_trim_never_cuts_a_storm_walk_for_old_house_heat(self):
        zd = {"zones": [{"id": f"E~t{i}", "list_id": "E", "kind": "everyday", "score": 90 - i} for i in range(5)] +
                       [{"id": "S~t1", "list_id": "S", "kind": "storm", "score": 20},
                        {"id": "wind~x", "kind": "wind", "score": 0}]}
        kept = night.trim(zd, 2)["zones"]
        self.assertEqual([z["id"] for z in kept], ["E~t0", "S~t1", "wind~x"])   # storm + best everyday; wind layer stays
        self.assertEqual([z["id"] for z in night.ranked(night.trim(zd, 2))], ["S~t1", "E~t0"])
        many = {"zones": [{"id": f"S~t{i}", "list_id": "S", "kind": "storm", "score": 60 - i, "homes": 9}
                          for i in range(4)] + [{"id": "E~t0", "list_id": "E", "kind": "everyday", "score": 90, "homes": 9}]}
        t = night.trim(many, 3)                                   # one storm fills the top: the old-house zone stays in
        self.assertEqual([z["id"] for z in night.ranked(t)], ["S~t0", "S~t1", "E~t0"])
        self.assertEqual(night.choose(t, {})[1]["zone_id"], "E~t0")

    def test_storm_zones_link_to_the_open_maps_areas(self):
        areas = night.map_areas({"zones": [
            {"id": "2026-09-10~fremont", "center": {"lat": 41.44, "lon": -96.49}},
            {"id": "2026-09-10~far-away", "center": {"lat": 42.9, "lon": -96.49}},
            {"id": "2026-06-13~fremont", "center": {"lat": 41.44, "lon": -96.49}}, {"id": "junk"}]})
        self.assertEqual([a["id"] for a in areas], ["z0910-fremont", "z0910-far-away", "z0613-fremont"])
        self.assertEqual(night.link_area("2026-09-10", 41.43, -96.5, areas, 15), "z0910-fremont")
        self.assertIsNone(night.link_area("2026-09-11", 41.43, -96.5, areas, 15))     # another storm day
        self.assertIsNone(night.link_area("2026-09-10", 40.0, -96.5, areas, 15))      # too far from any area
        storm_day = next(z["storm_day"] for z in zones.zones(self.hud, DAY, cfg=self.cfg)["zones"] if z["kind"] == "storm")
        near = [{"id": "zX-fremont", "date": storm_day, "lat": 41.43, "lon": -96.49}]
        prev = self.run_brief({**self.hud, "storms": []})      # last night: no hail reports yet
        hud = copy.deepcopy(self.hud)
        hud["storms"] = [storm(storm_day, "Fremont", 1.5)]
        zd = zones.zones(hud, DAY, cfg=self.cfg)
        d = night.brief(hud, zd, zones.walks(hud, zd, DAY, cfg=self.cfg), DAY, prev, self.cfg, now=NOW, areas=near)
        self.assertEqual(d["pick"]["area_id"], "zX-fremont")
        self.assertEqual(d["zones"][0]["area_id"], "zX-fremont")
        self.assertEqual(d["new_hail"][0]["area_id"], "zX-fremont")
        self.assertIsNone(d["backup"]["area_id"])               # old-house zones have no storm area

    def test_page_copy_names_the_street_never_the_house(self):
        d = self.run_brief(self.hud)
        full = d["pick"]["start"]["address"]
        self.assertRegex(full, r"^\d")
        js = night.to_js(d)
        self.assertTrue(js.startswith(night.JS_HEAD))
        back = night.from_js(js)
        st = back["pick"]["start"]["address"]
        self.assertEqual(st, re.sub(r"^\d+\s+", "", full))
        self.assertNotIn(full, js)
        self.assertIn(st, back["pick"]["plan"]["en"])
        self.assertEqual(back["storm_keys"], d["storm_keys"])   # the next night diffs against the published copy
        self.assertEqual(d["pick"]["start"]["address"], full)   # the brief itself is untouched
        self.assertIsNone(night.from_js("window.NIGHT_REAL={\"kind\":\"other\"};"))
        self.assertIsNone(night.from_js("not js"))


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


    def test_cli_fresh_session_diffs_against_the_published_copy(self):
        """The nightly cloud run (docs/orders/night-shift-runbook.md) starts with an empty folder: --prev = last
        night's published night.js, --js-out = the file it republishes."""
        with tempfile.TemporaryDirectory() as t:
            js = os.path.join(t, "page", "night.js")
            base = ["night", "--no-refresh", "--hud", FIX, "--date", DAY, "--near", "41.43,-96.49"]
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(hh.main(base + ["--out-dir", os.path.join(t, "a"), "--js-out", js]), 0)
            first = night.from_js(open(js, encoding="utf-8").read())
            self.assertTrue(first["first_run"])
            with contextlib.redirect_stdout(io.StringIO()) as out:   # a new, empty folder: only the published copy
                self.assertEqual(hh.main(base + ["--out-dir", os.path.join(t, "b"), "--prev", js, "--js-out", js]), 0)
            second = night.from_js(open(js, encoding="utf-8").read())
            self.assertFalse(second["first_run"])
            self.assertEqual(second["since"], first["made_at"])
            self.assertIn("best zone is still", out.getvalue())
            self.assertIsNone(re.search(r"\b\d+ [NSEW]? ?\w", second["pick"]["start"]["address"] or ""))


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

    @unittest.skipUnless(os.path.exists(REAL_JS), "design files are not in the cloud bundle")
    def test_published_real_brief_is_a_real_night_brief(self):
        with open(REAL_JS, encoding="utf-8") as f:
            text = f.read()
        self.assertTrue(text.startswith(night.JS_HEAD))
        d = night.from_js(text)
        self.assertEqual(set(d) - {"refresh_error", "none_reason"}, KEYS)
        self.assertNotIn("sample", d)                            # the real brief never carries the SAMPLE note
        for k in ("pick", "backup"):
            if d[k]:
                self.assertEqual(set(d[k]), CARD)
                st = d[k]["start"] or {}
                for f in ("lat", "lon"):                       # ~100 m, never a house's spot
                    self.assertEqual(st.get(f), round(st.get(f), 3) if st.get(f) is not None else None)
        if d["pick"]:
            self.assertEqual(d["pick"]["kind"], "storm")
        self.assertIsNone(NEVER.search(json.dumps({k: v for k, v in d.items() if k != "storm_keys"}, ensure_ascii=False)))


if __name__ == "__main__":
    unittest.main()
