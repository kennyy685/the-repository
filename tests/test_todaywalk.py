"""Offline tests for O0 "Today's knock": `hh.py todaywalk` picks ONE walk for the HMP App's today/walk doc.
Fixture tests/fixtures/today_hud.json: a fresh Fremont storm list (2 walks, plus an apartment and a commercial
building), a stale Blair storm list (hotter, but 208 days old on 2026-09-25) and an everyday old-house list."""
import contextlib
import io
import json
import os
import re
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import config as C  # noqa: E402
from hailhunter import todaywalk  # noqa: E402

FIX = os.path.join(HERE, "fixtures", "today_hud.json")
KEYS = {"date", "area", "why", "goal_doors", "kind", "list_id", "stops", "spanish_share", "who",   # +T37
        "est_minutes", "walk_mi", "drive_from_home_mi", "best_time", "stale", "stale_note", "data_age_hours"}
STOP_KEYS = {"pid", "address", "city", "lat", "lon", "pass"}


def num(s):
    return int(s["address"].split()[0])


def street(s):
    return " ".join(s["address"].split()[1:])


class TodayWalk(unittest.TestCase):
    def setUp(self):
        with open(FIX) as f:
            self.hud = json.load(f)
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))

    def pick(self, day="2026-09-25", **kw):
        return todaywalk.pick(self.hud, day, cfg=self.cfg, **kw)

    def assertWalkingOrder(self, stops):
        seen, prev = [], None
        for s in stops:                            # each street walked once, in one go
            if street(s) != prev:
                self.assertNotIn(street(s), seen, "street visited twice")
                seen.append(street(s))
                prev = street(s)
        for st in seen:                            # house numbers run one way along each street
            ns = [num(s) for s in stops if street(s) == st]
            self.assertTrue(ns == sorted(ns) or ns == sorted(ns, reverse=True), (st, ns))

    def test_fresh_storm_walk_houses_only_in_walking_order(self):
        d = self.pick()
        self.assertEqual(set(d), KEYS)
        self.assertEqual(d["kind"], "storm")
        self.assertEqual(d["list_id"], "2026-09-10_Fremont")    # not the hotter but stale Blair storm
        self.assertEqual(d["date"], "2026-09-25")
        self.assertEqual(len(d["stops"]), 25)                   # 20 houses in walk 1, topped up from walk 2
        self.assertEqual(d["goal_doors"], 25)
        for s in d["stops"]:
            self.assertEqual(set(s), STOP_KEYS)
            self.assertEqual(s["pass"], 1)
        pids = {s["pid"] for s in d["stops"]}
        self.assertNotIn("DODGE-APT1", pids)                    # no apartments
        self.assertNotIn("DODGE-COM1", pids)                    # no commercial
        self.assertEqual(len(pids), 25)
        self.assertWalkingOrder(d["stops"])
        self.assertEqual(d["area"], "Fremont: Linden St & E 4th St")

    def test_storm_why_is_plain_bilingual_no_scores_or_ids(self):
        d = self.pick()
        self.assertEqual(d["why"]["en"], "1.5-inch hail hit here on September 10, the roofs are older and most "
                                         "homes are owner-lived.")
        self.assertEqual(d["why"]["es"], "Aquí cayó granizo de 1.5 pulgadas el 10 de septiembre, los techos ya tienen "
                                         "años y en la mayoría de las casas viven sus dueños.")
        for t in d["why"].values():
            self.assertNotRegex(t, r"heat|score|DODGE|%|\d{5,}")

    def test_stale_storm_falls_back_to_everyday_with_plain_why(self):
        d = self.pick("2027-04-15")                             # in season, storms 217+ days old: no storm walk
        self.assertEqual(d["kind"], "everyday")
        self.assertEqual(d["list_id"], "everyday_Fremont_310539640003")
        self.assertEqual(d["why"], {"en": "Most homes here were built before 1980 and are owner-lived.",
                                    "es": "La mayoría de las casas aquí se construyeron antes de 1980 y viven sus "
                                          "dueños."})
        self.assertNotIn("310539640003", json.dumps(d["why"]) + d["area"])   # no geoid on screen
        self.assertEqual(len(d["stops"]), 25)
        self.assertWalkingOrder(d["stops"])

    def test_worked_turfs_skipped_and_not_home_comes_back(self):
        storm = next(L for L in self.hud["lists"] if L["id"] == "2026-09-10_Fremont")
        res = {}
        for s in storm["stops"]:
            res[f"doors/2026-09-24_{s['pid']}"] = {"result": "no", "at": "2026-09-24T17:00:00Z", "pass": 1}
        d = todaywalk.pick(self.hud, "2026-09-25", results=todaywalk.load_results(res), cfg=self.cfg)
        self.assertEqual(d["kind"], "everyday")                 # the storm walks are fully worked
        # one not-home door on the everyday list comes back as pass 2; a "Booked" one does not come back
        res = {"doors/2026-09-24_DODGE-E3": {"result": "not_home", "pass": 1},
               "doors/2026-09-24_DODGE-E4": {"result": "booked", "pass": 1}}
        d = self.pick("2027-04-15", goal=30, results=todaywalk.load_results(res))   # room for the whole walk
        by = {s["pid"]: s for s in d["stops"]}
        self.assertEqual(by["DODGE-E3"]["pass"], 2)
        self.assertNotIn("DODGE-E4", by)
        # three not-home tries: that door is done
        res = {f"doors/2026-09-2{i}_DODGE-E3": {"result": "not_home", "pass": i} for i in (1, 2, 3)}
        self.assertNotIn("DODGE-E3", {s["pid"] for s in self.pick("2027-04-15", goal=30,
                                                                   results=todaywalk.load_results(res))["stops"]})

    def test_results_as_list_of_docs(self):
        r = todaywalk.load_results([{"id": "2026-09-24_DODGE-E3", "data": {"result": "Not home", "pass": 1}},
                                    {"pid": "DODGE-E5", "result": "Interested"}])
        self.assertEqual(r["DODGE-E3"], {"visits": 1, "done": False})
        self.assertEqual(r["DODGE-E5"], {"visits": 1, "done": True})

    def test_walking_order_sorts_by_number_and_hops_to_nearest_street(self):
        mk = lambda n, st, lat, lon: {"address": f"{n} {st}", "lat": lat, "lon": lon}  # noqa: E731
        stops = [mk(103, "A St", 0, 0.03), mk(100, "A St", 0, 0.0), mk(102, "A St", 0.0001, 0.02),
                 mk(101, "A St", 0.0001, 0.01), mk(5, "Far Rd", 1, 1), mk(201, "B St", 0.002, 0.00),
                 mk(200, "B St", 0.002, 0.03)]
        out = [s["address"] for s in todaywalk.walking_order(stops)]
        # starts at the end of A St nearest the first stop (103), B St is entered at its near end (200)
        self.assertEqual(out, ["103 A St", "102 A St", "101 A St", "100 A St", "201 B St", "200 B St", "5 Far Rd"])

    def test_nothing_left_returns_none(self):
        self.assertIsNone(todaywalk.pick({"lists": [], "everyday_lists": []}, "2026-09-25", cfg=self.cfg))

    def test_cli_prints_and_writes_the_doc(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, "walk.json")
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                rc = hh.main(["todaywalk", "--hud", FIX, "--date", "2026-09-25", "--doors", "12", "--out", out])
            self.assertEqual(rc, 0)
            with open(out) as f:
                d = json.load(f)
            self.assertEqual(json.loads(buf.getvalue()), d)
            self.assertEqual(set(d), KEYS)
            self.assertEqual(len(d["stops"]), 12)
            self.assertEqual(d["goal_doors"], 12)
            self.assertTrue(re.match(r"^\d{4}-\d{2}-\d{2}$", d["date"]))


class TodayWalkExtras(unittest.TestCase):
    """Time estimate, best time to knock, evidence docs, stale data and the no-walk reason."""
    NOW = __import__("datetime").datetime(2026, 9, 25, 18, 0, tzinfo=__import__("datetime").timezone.utc)

    def setUp(self):
        with open(FIX) as f:
            self.hud = json.load(f)
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))

    def pick(self, day="2026-09-25", **kw):
        return todaywalk.pick(self.hud, day, cfg=self.cfg, now=kw.pop("now", self.NOW), **kw)

    def test_time_estimate_and_drive(self):
        d = self.pick()
        stops = d["stops"]
        walk = sum(todaywalk.haversine_mi(a["lat"], a["lon"], b["lat"], b["lon"]) for a, b in zip(stops, stops[1:]))
        self.assertEqual(d["est_minutes"], round(25 * 3 + walk / 3 * 60))
        self.assertAlmostEqual(d["walk_mi"], walk, places=2)
        self.assertGreater(d["est_minutes"], 75)                # doors plus some walking
        home = self.cfg["home"]
        self.assertEqual(d["drive_from_home_mi"],
                         round(todaywalk.haversine_mi(home["lat"], home["lon"], stops[0]["lat"], stops[0]["lon"]), 1))
        far = dict(self.cfg, home={"name": "Omaha", "lat": 41.2565, "lon": -95.9345})
        self.assertGreater(todaywalk.pick(self.hud, "2026-09-25", cfg=far, now=self.NOW)["drive_from_home_mi"], 25)
        self.assertEqual(todaywalk.estimate([], self.cfg), (0, 0))

    def test_best_time_by_day_of_week(self):
        wk = todaywalk.best_time("2026-09-24", self.cfg)       # Thursday
        self.assertEqual(wk, {"en": "Best time to knock today: 4-7:30 PM.",
                              "es": "Mejor hora para tocar puertas hoy: de 4 a 7:30 p. m.",
                              "start": "16:00", "end": "19:30"})
        sat = todaywalk.best_time("2026-09-26", self.cfg)
        self.assertEqual((sat["en"], sat["es"]), ("Best time to knock this Saturday: 10 AM-5 PM.",
                                                  "Mejor hora para tocar puertas este sábado: de 10 a. m. a 5 p. m."))
        sun = todaywalk.best_time("2026-09-27", self.cfg)
        self.assertIsNone(sun["start"])
        self.assertIn("Monday 4-7:30 PM", sun["en"])
        self.assertEqual(self.pick()["best_time"]["start"], "16:00")      # 2026-09-25 is a Friday
        cfg = dict(self.cfg, today_walk={**self.cfg["today_walk"], "best_time": {"weekday": ["17:00", "20:00"]}})
        self.assertEqual(todaywalk.best_time("2026-09-24", cfg)["en"], "Best time to knock today: 5-8 PM.")

    def test_stale_hud_is_flagged(self):
        d = self.pick()                                          # generated 2026-09-25 11:30Z, now 18:00Z
        self.assertEqual((d["stale"], d["stale_note"], d["data_age_hours"]), (False, None, 6.5))
        late = self.NOW.replace(day=27)                          # 54.5 hours later
        d = self.pick(now=late)
        self.assertTrue(d["stale"])
        self.assertEqual(d["data_age_hours"], 54.5)
        self.assertIn("2 days old", d["stale_note"]["en"])
        self.assertIn("2 días", d["stale_note"]["es"])
        del self.hud["generated_utc"]                            # no date at all: warn, don't crash
        d = self.pick()
        self.assertTrue(d["stale"])
        self.assertIsNone(d["data_age_hours"])
        self.assertTrue(d["stale_note"]["en"] and d["stale_note"]["es"])

    def test_no_walk_gives_a_reason_not_a_crash(self):
        d = todaywalk.today_doc({"lists": [], "everyday_lists": []}, "2026-09-25", cfg=self.cfg, now=self.NOW)
        self.assertEqual(d["stops"], [])
        self.assertEqual(d["goal_doors"], 0)
        self.assertIn("No door lists yet", d["none_reason"]["en"])
        self.assertTrue(d["none_reason"]["es"])
        self.assertTrue(d["stale"])                              # no generated_utc either
        res = {f"doors/2026-09-24_{s['pid']}": {"result": "no"}
               for L in self.hud["lists"] + self.hud["everyday_lists"] for s in L["stops"]}
        d = todaywalk.today_doc(self.hud, "2026-09-25", results=todaywalk.load_results(res), cfg=self.cfg,
                                now=self.NOW)
        self.assertIn("Every walk on the current lists is done", d["none_reason"]["en"])
        self.assertFalse(d["stale"])
        self.assertNotIn("none_reason", todaywalk.today_doc(self.hud, "2026-09-25", cfg=self.cfg, now=self.NOW))

    def test_cli_no_walk_and_missing_hud_still_write_a_doc(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, "walk.json")
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                rc = hh.main(["todaywalk", "--hud", os.path.join(tmp, "missing.json"), "--date", "2026-09-25",
                              "--out", out])
            self.assertEqual(rc, 0)
            with open(out) as f:
                d = json.load(f)
            self.assertEqual(d["stops"], [])
            self.assertTrue(d["none_reason"]["en"] and d["stale"])

    def test_slug_rule(self):
        self.assertEqual(todaywalk.slug("105 E 4th St", "Fremont"), "105-e-4th-st-fremont")
        self.assertEqual(todaywalk.slug("  1418 N. Irving St., Apt #2 ", "North Bend"),
                         "1418-n-irving-st-apt-2-north-bend")
        self.assertEqual(todaywalk.slug("12 Oak", None), "12-oak")

    def test_evidence_docs_for_the_walk(self):
        storm = next(L for L in self.hud["lists"] if L["id"] == "2026-09-10_Fremont")
        ev = {f"{s['address']}|{s.get('city') or ''}": {"day": "2026-09-10", "hail_in": 1.5,
                                                        "nearest_report": {"dist_mi": 0.8, "size_in": 1.75,
                                                                           "source": "trained spotter"},
                                                        "radar_max_in": 1.6} for s in storm["stops"]}
        ev["999 Nowhere Rd|Fremont"] = {"day": "2026-09-10", "hail_in": 2.0}             # not on today's walk
        self.hud["hail_evidence"] = ev
        with tempfile.TemporaryDirectory() as tmp:
            out, evo = os.path.join(tmp, "walk.json"), os.path.join(tmp, "ev.json")
            with contextlib.redirect_stdout(io.StringIO()):
                hud_path = os.path.join(tmp, "hud.json")
                with open(hud_path, "w") as f:
                    json.dump(self.hud, f)
                hh.main(["todaywalk", "--hud", hud_path, "--date", "2026-09-25", "--doors", "10", "--out", out,
                         "--evidence-out", evo])
            with open(out) as f:
                walk = json.load(f)
            with open(evo) as f:
                e = json.load(f)
        self.assertIn('"<address> <city>" lowercased', e["slug_rule"])
        want = {"evidence/" + todaywalk.slug(s["address"], s["city"]) for s in walk["stops"]}
        self.assertEqual(set(e["docs"]), want)                  # exactly today's 10 houses
        doc = e["docs"]["evidence/" + todaywalk.slug(walk["stops"][0]["address"], walk["stops"][0]["city"])]
        self.assertEqual(doc["address"], walk["stops"][0]["address"])
        self.assertEqual(doc["pid"], walk["stops"][0]["pid"])
        self.assertEqual(doc["nearest_report"]["size_in"], 1.75)
        self.assertEqual(todaywalk.evidence_docs({}, walk["stops"])["docs"], {})        # older hud.json: none


if __name__ == "__main__":
    unittest.main()
