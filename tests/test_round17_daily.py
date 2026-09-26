"""Offline tests for T97 (everyday lists in Schuyler / Columbus / Lexington), T84 (industry benchmark ranges in
`hh.py weekly` and the todaywalk goal note) and `hh.py daily` (the 7:40 AM app job, one JSON file per app doc).
Fixtures: tests/fixtures/today_hud.json, weekly_doors.json, weekly_leads.json + test_everyday's small town."""
import contextlib
import copy
import io
import json
import os
import shutil
import sys
import tempfile
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

import hh  # noqa: E402
import test_everyday as TE  # noqa: E402
from hailhunter import benchmarks, daily, everyday, hud, todaywalk, weekly  # noqa: E402
from hailhunter import config as C  # noqa: E402

FIX = os.path.join(HERE, "fixtures")
QUIET = lambda *a, **k: None  # noqa: E731


def load(name):
    with open(os.path.join(FIX, name)) as f:
        return json.load(f)


# ------------------------------------------------------------------ T97
class EverydayTowns(TE.Base):
    def setUp(self):
        super().setUp()
        self.today = datetime.now(ZoneInfo(self.cfg["timezone"])).date()
        self.conn.execute("INSERT INTO places (geoid,name,state,lat,lon,pop,aland_sqmi,dist_mi,hu) VALUES "
                          "('3104000','Testville','NE',41.45,-96.55,900,1.0,5,400)")
        # a bigger same-name town in another state: "Testville, NE" must not land there
        self.conn.execute("INSERT INTO places (geoid,name,state,lat,lon,pop,aland_sqmi,dist_mi,hu) VALUES "
                          "('2904000','Testville','MO',39.0,-94.0,9000,5.0,200,4000)")
        TE.add_bg(self.conn, TE.BG, "Testville, NE center [9640-3]", 41.45, -96.55, 400, 300 / 380, 1958, 150000,
                  TE.bins(400, 268, 12), ring=TE.RING)
        TE.town_parcels(self.conn, self.today)
        self.conn.execute("INSERT INTO acs_language VALUES (?,?,?,?,?,?)", (TE.BG, "bg", 380, 190, "C16002", "2024"))
        self.conn.commit()

    def test_defaults_name_the_three_towns_and_keep_the_radius(self):
        d = C.load(os.path.join(self.tmp, "none.json"))
        self.assertEqual(d["everyday_towns"], ["Schuyler, NE", "Columbus, NE", "Lexington, NE"])
        self.assertEqual(d["everyday"]["radius_mi"], 40)                  # normal everyday radius untouched
        self.assertEqual(C.load()["everyday_towns"], ["Schuyler, NE", "Columbus, NE", "Lexington, NE"])  # config.json

    def test_state_picks_the_right_town(self):
        self.assertEqual(everyday._center(self.conn, self.cfg, "Testville, NE"), (41.45, -96.55))
        self.assertEqual(everyday._center(self.conn, self.cfg, "Testville"), (39.0, -94.0))   # biggest, any state

    def test_build_towns_makes_one_list_per_found_town_and_hud_marks_it(self):
        log = []
        made = everyday.build_towns(self.conn, self.cfg, None, ["Testville, NE", "Nowhere, NE"], log=log.append)
        self.assertEqual([(r["town"], r["list_id"]) for r in made], [("Testville, NE", f"everyday_Testville_{TE.BG}")])
        self.assertTrue(any("Nowhere, NE" in x for x in log))             # missing town: skipped, not an error
        _, d = hud.write(self.conn, self.cfg)
        E = d["everyday_lists"][0]
        self.assertEqual((E["town_pick"], E["spanish_share"], E["good_for_spanish"]), ("Testville, NE", 0.5, True))

    def test_top_list_is_not_a_town_pick(self):
        everyday.make_list(self.conn, self.cfg, everyday.areas(self.conn, self.cfg, "Testville, NE", 5)[0], log=QUIET)
        self.conn.execute("DELETE FROM acs_language")
        self.conn.commit()
        _, d = hud.write(self.conn, self.cfg)
        E = d["everyday_lists"][0]
        self.assertEqual((E["town_pick"], E["spanish_share"], E["good_for_spanish"]), (None, None, False))

    def test_refresh_builds_town_lists_on_a_fresh_database(self):
        fresh = TE.Base()                                                 # brand-new database, like the cloud
        fresh.setUp()
        try:
            fresh.cfg["everyday_towns"] = ["Testville, NE", "Lexington, NE"]
            fresh.cfg["everyday"]["refresh_lists"] = 0                    # only the town lists
            summary = TE.FreshDatabase._refresh(fresh, TE.FakeFetcher(TE.ACS))
            self.assertEqual(len(summary["everyday_lists"]), 1)
            self.assertIn("town pick Testville, NE", summary["everyday_lists"][0])
            with open(summary["hud"]) as f:
                self.assertEqual(json.load(f)["everyday_lists"][0]["town_pick"], "Testville, NE")
        finally:
            fresh.tearDown()


# ------------------------------------------------------------------ T84
class Industry(unittest.TestCase):
    def setUp(self):
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))
        self.bench = benchmarks.load()
        self.doors, self.leads = weekly.load_doors(load("weekly_doors.json")), weekly.load_leads(load("weekly_leads.json"))

    def test_weekly_rates_get_industry_ranges(self):
        doc = weekly.report(self.doors, self.leads, week="2026-39", hud=load("today_hud.json"), today="2026-09-26",
                            bench=self.bench)
        ind = doc["industry"]
        self.assertEqual(ind["label"]["en"], "industry estimate, not your numbers")
        c = ind["rates"]["contact_rate"]
        self.assertEqual((c["low"], c["typical"], c["high"]), (0.2, 0.3, 0.4))
        self.assertEqual(c["yours"], doc["totals"]["contact_rate"])
        self.assertEqual(c["vs"], "above")                                # 10/21 = 0.476
        self.assertIn("spotio", c["source_note"])
        i = ind["rates"]["inspection_rate_per_100"]
        self.assertEqual((i["low"], i["typical"], i["high"], i["yours"]),
                         (0.5, 1.0, 2.0, doc["totals"]["inspection_rate_per_100"]))
        s = ind["rates"]["inspection_to_signed"]
        self.assertEqual((s["low"], s["typical"], s["high"], s["yours"], s["vs"]), (0.4, 0.58, 0.74, None, None))
        self.assertEqual(doc["benchmarks"]["contact_rate"], [0.2, 0.4])   # the old field stays as it was

    def test_missing_file_is_skipped_quietly(self):
        self.assertIsNone(benchmarks.load(os.path.join(tempfile.gettempdir(), "no-such-benchmarks.json")))
        doc = weekly.report(self.doors, self.leads, week="2026-39", today="2026-09-26")
        self.assertIsNone(doc["industry"])
        self.assertIsNone(benchmarks.industry_ranges({"_meta": {}}, {}))
        self.assertEqual(benchmarks.compare(0.1, {"low": 0.2, "high": 0.4}), "below")

    def test_no_week_doors_means_no_yours(self):
        doc = weekly.report([], [], week="2026-39", today="2026-09-26", bench=self.bench)
        self.assertIsNone(doc["industry"]["rates"]["contact_rate"]["yours"])

    def test_goal_note_uses_industry_pace_only_without_history(self):
        hud_doc = load("today_hud.json")
        pace = benchmarks.doors_per_hour(self.bench)
        self.assertEqual((pace["low"], pace["typical"], pace["high"]), (10, 12, 15))
        d = todaywalk.today_doc(hud_doc, "2026-09-25", cfg=self.cfg, pace=pace)
        g = d["goal_note"]
        self.assertTrue(g["en"].startswith("25 doors is a starting session, not a full day."))
        self.assertIn("Industry estimate, not your numbers: about 10-15 doors an hour, so 25 doors takes roughly "
                      "100-150 min.", g["en"])
        self.assertIn("Estimado de la industria", g["es"])
        self.assertEqual(g["pace"]["minutes"], {"low": 100, "typical": 125, "high": 150})
        results = todaywalk.load_results(load("weekly_doors.json"))      # with door history: no industry pace
        d2 = todaywalk.today_doc(hud_doc, "2026-09-25", results=results, cfg=self.cfg, pace=pace)
        self.assertNotIn("Industry", d2["goal_note"]["en"])
        self.assertNotIn("pace", d2["goal_note"])
        d3 = todaywalk.today_doc(hud_doc, "2026-09-25", cfg=self.cfg)    # no benchmarks: note as before
        self.assertEqual(d3["goal_note"]["en"], "25 doors is a starting session, not a full day.")

    def test_cli_weekly_with_and_without_file(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            rc = hh.main(["weekly", "--doors", os.path.join(FIX, "weekly_doors.json"), "--week", "2026-39",
                          "--benchmarks", os.path.join(tempfile.gettempdir(), "no-such-benchmarks.json")])
        self.assertEqual(rc, 0)
        self.assertIsNone(json.loads(out.getvalue())["industry"])
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            hh.main(["weekly", "--doors", os.path.join(FIX, "weekly_doors.json"), "--week", "2026-39"])
        self.assertIn("contact_rate", json.loads(out.getvalue())["industry"]["rates"])


# ------------------------------------------------------------------ hh.py daily
class Daily(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.cfg = C.load(os.path.join(self.tmp, "none.json"))
        self.hud = load("today_hud.json")
        first = todaywalk.today_doc(self.hud, "2026-09-25", cfg=self.cfg)["stops"][0]
        self.hud["hail_evidence"] = {f"{first['address']}|{first['city']}": {"day": "2026-09-10", "hail_in": 1.5}}
        self.first = first
        self.hud_path = os.path.join(self.tmp, "hud.json")
        with open(self.hud_path, "w") as f:
            json.dump(self.hud, f)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_file_names(self):
        self.assertEqual(daily.file_name("today/walk"), "today__walk.json")
        self.assertEqual(daily.file_name("walks/2026-09-10_Fremont~t3"), "walks__2026-09-10_Fremont~t3.json")
        self.assertEqual(daily.file_name("evidence/105-e-4th-st-fremont"), "evidence__105-e-4th-st-fremont.json")

    def _files(self, out):
        with open(os.path.join(out, "manifest.json")) as f:
            man = json.load(f)
        for path, name in man["files"].items():
            self.assertTrue(os.path.exists(os.path.join(out, name)), name)
        return man

    def test_cli_writes_every_doc_as_its_own_file(self):
        out = os.path.join(self.tmp, "out")
        with contextlib.redirect_stdout(io.StringIO()):
            rc = hh.main(["daily", "--out-dir", out, "--hud", self.hud_path, "--date", "2026-09-25",
                          "--leads", os.path.join(FIX, "weekly_leads.json"), "--no-basemap"])
        self.assertEqual(rc, 0)
        man = self._files(out)
        self.assertEqual(man["errors"], [])
        names = set(man["files"].values())
        self.assertTrue({"today__walk.json", "calls__today.json", "zones__current.json", "followups__today.json"}
                        <= names)
        self.assertTrue(any(n.startswith("walks__") for n in names))
        slug = todaywalk.slug(self.first["address"], self.first["city"])
        self.assertIn(f"evidence__{slug}.json", names)
        with open(os.path.join(out, "today__walk.json")) as f:
            walk = json.load(f)
        self.assertEqual(walk, todaywalk.today_doc(self.hud, "2026-09-25", cfg=self.cfg,
                                                   pace=benchmarks.doors_per_hour(benchmarks.load())))
        with open(os.path.join(out, "zones__current.json")) as f:
            z = json.load(f)
        for zone in z["zones"]:
            self.assertIn(f"walks/{zone['id']}", man["files"])
        with open(os.path.join(out, "followups__today.json")) as f:
            self.assertIn("counts", json.load(f))

    def test_without_leads_or_hud_still_writes_docs(self):
        out = os.path.join(self.tmp, "out2")
        man = daily.run(self.cfg, out, "2026-09-25", {})
        self._files(out)
        self.assertIn("followups (no --leads)", man["skipped"])
        self.assertNotIn("followups/today", man["files"])
        with open(os.path.join(out, "today__walk.json")) as f:
            self.assertTrue(json.load(f)["none_reason"]["en"])

    def test_one_failing_part_never_stops_the_others(self):
        out = os.path.join(self.tmp, "out3")
        broken = copy.deepcopy(self.hud)
        from unittest import mock
        with mock.patch.object(daily.calltoday, "today_doc", side_effect=RuntimeError("boom")):
            man = daily.run(self.cfg, out, "2026-09-25", broken)
        self.assertEqual([e["part"] for e in man["errors"]], ["calltoday"])
        self.assertIn("today/walk", man["files"])
        self.assertIn("zones/current", man["files"])


if __name__ == "__main__":
    unittest.main()
