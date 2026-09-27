"""Offline tests for the rental hot list (`hh.py rentals`, research rounds 34/38): likely-rental single-family
(owner mails elsewhere, T23) and small 2-4 unit multi-family properties in the current hot zones + everyday zones,
grouped by zone with counts, for pitching landlord associations/property managers by business line - never mailing.
"""
import contextlib
import copy
import io
import json
import os
import re
import shutil
import sys
import tempfile
import unittest
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import config as C  # noqa: E402
from hailhunter import daily, doors, hud, rentals  # noqa: E402
from tests import test_hot_zones as th  # noqa: E402

TODAY = "2026-09-26"
NEVER = re.compile(r"insur|asegur|seguro|deduct|deduc|guarant|owner_mail|OwnerAddress|OWNER_ZIP|PSTLADDRESS", re.I)


def house(pid, address, lat, lon, kind="single", owner_occ=None, sqft=1400, built=1968, hail=1.6, city="Fremont"):
    return {"pid": pid, "turf": 1, "address": address, "city": city, "kind": kind, "owner_occ": owner_occ,
            "sqft": sqft, "built": built, "hail": hail, "lat": lat, "lon": lon, "value": 150000}


# Fresh storm list near Fremont: a rental house, an owner-occupied house, an unknown house, a small (3-unit) and a
# too-big (7-unit-estimate) multi building, and a duplex with no square footage on record.
STORM = {
    "id": "2026-09-10_Fremont", "day": "2026-09-10", "area": "Fremont, NE", "heat": 80,
    "turfs": [{"turf": 1, "heat": 80}],
    "stops": [
        house("P1", "100 Oak St", 41.44, -96.49, owner_occ=False),                       # rental: single-family
        house("P2", "102 Oak St", 41.4401, -96.49, owner_occ=True),                      # owner lives here: no
        house("P3", "104 Oak St", 41.4402, -96.49, owner_occ=None),                      # unknown: no
        house("P4", "200 Elm St", 41.4403, -96.4905, kind="multi", sqft=2700, hail=1.5),  # duplex/fourplex: ~3 units
        house("P5", "202 Elm St", 41.4404, -96.4906, kind="multi", sqft=6000, hail=1.5),  # too big: apartment track
        house("P6", "204 Elm St", 41.4405, -96.4907, kind="multi", sqft=None, hail=1.4),  # no sqft: default 2 units
    ],
}
# A storm far too old to be a current hot zone (T23/todaywalk.storm_max_days): must never appear.
OLD_STORM = {
    "id": "2025-01-01_OldTown", "day": "2025-01-01", "area": "Oldtown, NE", "heat": 90,
    "turfs": [{"turf": 1, "heat": 90}],
    "stops": [house("P7", "1 Ancient Ave", 41.45, -96.50, owner_occ=False, city="Oldtown")],
}
# A fresh storm zone far from Fremont (outside the default radius), for the near/radius test.
FAR_STORM = {
    "id": "2026-09-11_Faraway", "day": "2026-09-11", "area": "Faraway, NE", "heat": 95,
    "turfs": [{"turf": 1, "heat": 95}],
    "stops": [house("P8", "1 Distant Rd", 40.0, -100.0, owner_occ=False, city="Faraway")],
}
# The old-house everyday zone: no storm, no hail - a rental house and a 3-unit building, judged by house age instead.
EVERYDAY = {
    "id": "everyday_Fremont_310539640003", "area": "Fremont, NE", "heat": 40,
    "turfs": [{"turf": 1, "heat": 40}],
    "stops": [
        house("PE1", "400 Pine St", 41.43, -96.49, owner_occ=False, hail=None, built=1958),
        house("PE2", "402 Pine St", 41.4301, -96.4901, kind="multi", sqft=2600, hail=None, built=1955),
    ],
}
HUD = {"generated_utc": "2026-09-26T11:00:00Z", "lists": [STORM, OLD_STORM, FAR_STORM], "everyday_lists": [EVERYDAY]}


class Candidate(unittest.TestCase):
    def setUp(self):
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-hh-config.json"))

    def test_units_estimate_from_sqft_and_default(self):
        self.assertEqual(rentals.units_estimate("multi", 2700, self.cfg), 3)      # 2700 / 900
        self.assertEqual(rentals.units_estimate("multi", None, self.cfg), 2)      # unknown sqft: the minimum
        self.assertEqual(rentals.units_estimate("multi", 400, self.cfg), 2)       # never below min_units
        self.assertEqual(rentals.units_estimate("single", 6000, self.cfg), 1)     # single is always 1

    def test_candidate_rules(self):
        self.assertEqual(rentals.candidate({"kind": "single", "owner_occ": False}, self.cfg), 1)
        self.assertIsNone(rentals.candidate({"kind": "single", "owner_occ": True}, self.cfg))
        self.assertIsNone(rentals.candidate({"kind": "single", "owner_occ": None}, self.cfg))   # most counties (T23)
        self.assertEqual(rentals.candidate({"kind": "multi", "sqft": 2700}, self.cfg), 3)
        self.assertIsNone(rentals.candidate({"kind": "multi", "sqft": 6000}, self.cfg))          # apartment track
        self.assertIsNone(rentals.candidate({"kind": "mobile", "owner_occ": False}, self.cfg))
        self.assertIsNone(rentals.candidate({"kind": "commercial"}, self.cfg))

    def test_why_never_leaks_owner_data_and_tells_who_to_ask_for(self):
        why = rentals._why("multi", 3, 1.6, "2026-09-10", 1975)
        self.assertIn("triplex", why["en"] + why["es"])
        for lang in ("en", "es"):
            self.assertIn("landlord" if lang == "en" else "dueño", why[lang].lower())
        why2 = rentals._why("single", 1, None, None, 1958)
        self.assertIn("1958", why2["en"])
        self.assertIsNone(NEVER.search(why["en"] + why["es"] + why2["en"] + why2["es"]))


class HotList(unittest.TestCase):
    def setUp(self):
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-hh-config.json"))

    def test_groups_by_zone_with_counts_storm_and_everyday(self):
        doc = rentals.hotlist(HUD, TODAY, cfg=self.cfg)
        ids = {z["zone_id"] for z in doc["zones"]}
        self.assertIn("2026-09-10_Fremont~t1", ids)
        self.assertIn("everyday_Fremont_310539640003~t1", ids)
        self.assertNotIn("2025-01-01_OldTown~t1", ids)                     # too old: not a current hot zone
        self.assertNotIn("2026-09-11_Faraway~t1", ids)                     # outside the default radius
        storm_zone = next(z for z in doc["zones"] if z["zone_id"] == "2026-09-10_Fremont~t1")
        self.assertEqual(storm_zone["count"], 3)                           # P1, P4, P6 (not P2/P3/P5)
        addrs = {r["address"] for r in doc["rentals"] if r["zone_id"] == "2026-09-10_Fremont~t1"}
        self.assertEqual(addrs, {"100 Oak St", "200 Elm St", "204 Elm St"})
        self.assertEqual(doc["count"], len(doc["rentals"]))
        self.assertNotIn("none_reason", doc)

    def test_units_est_and_hail_fields(self):
        doc = rentals.hotlist(HUD, TODAY, cfg=self.cfg)
        by_addr = {r["address"]: r for r in doc["rentals"]}
        self.assertEqual(by_addr["200 Elm St"]["units_est"], 3)
        self.assertEqual(by_addr["100 Oak St"]["units_est"], 1)
        self.assertEqual(by_addr["100 Oak St"]["hail_in"], 1.6)
        self.assertEqual(by_addr["100 Oak St"]["storm_day"], "2026-09-10")
        everyday = by_addr["400 Pine St"]
        self.assertIsNone(everyday["hail_in"])
        self.assertIsNone(everyday["storm_day"])
        self.assertEqual(everyday["year_built"], 1958)

    def test_far_zone_included_with_a_wider_radius(self):
        cfg = copy.deepcopy(self.cfg)
        cfg["rentals"]["radius_mi"] = 300
        doc = rentals.hotlist(HUD, TODAY, cfg=cfg)
        self.assertIn("2026-09-11_Faraway~t1", {z["zone_id"] for z in doc["zones"]})

    def test_top_keeps_the_hottest_zones_first(self):
        doc = rentals.hotlist(HUD, TODAY, top=1, cfg=self.cfg)
        self.assertEqual(len(doc["zones"]), 1)
        self.assertEqual(doc["zones"][0]["zone_id"], "2026-09-10_Fremont~t1")   # heat 80 > everyday's 40

    def test_no_candidates_says_why(self):
        doc = rentals.hotlist({"lists": [], "everyday_lists": []}, TODAY, cfg=self.cfg)
        self.assertEqual(doc["rentals"], [])
        self.assertIn("en", doc["none_reason"])
        self.assertIn("es", doc["none_reason"])

    def test_rules_and_no_owner_data_anywhere(self):
        doc = rentals.hotlist(HUD, TODAY, cfg=self.cfg)
        blob = json.dumps(doc)
        self.assertIsNone(NEVER.search(blob))
        self.assertIn("landlord", doc["rules"]["en"].lower())
        self.assertIn("nunca por correo", doc["rules"]["es"].lower())

    def test_hud_field_is_flat_and_matches_the_given_shape(self):
        field = rentals.rental_hotlist(HUD["lists"], HUD["everyday_lists"], TODAY, self.cfg)
        self.assertTrue(field)
        for r in field:
            self.assertEqual(set(r), set(rentals.FIELD_KEYS))
        self.assertNotIn("1 Ancient Ave", [r["address"] for r in field])   # old storm still excluded
        self.assertIn("1 Distant Rd", [r["address"] for r in field])       # no near/radius filter on the hud field


class CLI(unittest.TestCase):
    def test_writes_json_and_csv(self):
        tmp = tempfile.mkdtemp()
        try:
            hud_p, out_p, csv_p = (os.path.join(tmp, n) for n in ("hud.json", "r.json", "r.csv"))
            with open(hud_p, "w") as f:
                json.dump(HUD, f)
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(io.StringIO()):
                rc = hh.main(["rentals", "--hud", hud_p, "--date", TODAY, "--near", "41.4333,-96.4981",
                              "--out", out_p, "--csv", csv_p])
            self.assertEqual(rc, 0)
            doc = json.loads(buf.getvalue())
            self.assertGreater(doc["count"], 0)
            with open(out_p) as f:
                self.assertEqual(json.load(f)["count"], doc["count"])
            with open(csv_p, newline="", encoding="utf-8") as f:
                import csv as csvmod
                rows = list(csvmod.DictReader(f))
            self.assertEqual(len(rows), doc["count"])
            self.assertIn("100 Oak St", [r["address"] for r in rows])
        finally:
            shutil.rmtree(tmp)

    def test_unknown_town_fails_like_zones(self):
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(hh.main(["rentals", "--near", "Nowhereville Q"]), 2)


class DailyWiring(unittest.TestCase):
    def test_rentals_current_is_written(self):
        tmp = tempfile.mkdtemp()
        try:
            cfg = C.load(os.path.join(tmp, "none.json"))
            man = daily.run(cfg, os.path.join(tmp, "out"), TODAY, HUD)
            self.assertEqual(daily.file_name("rentals/current"), "rentals__current.json")
            self.assertIn("rentals/current", man["files"])
            with open(os.path.join(tmp, "out", man["files"]["rentals/current"])) as f:
                doc = json.load(f)
            self.assertGreater(doc["count"], 0)
        finally:
            shutil.rmtree(tmp)


class HudIntegration(th.Pipeline):
    """Full pipeline (doors.make_list -> hud.write, on a fresh temp database): rental_hotlist reaches hud.json
    without renaming or removing any existing field (the hud.json contract, engine-change skill)."""
    test_list_heat_reaches_hud = None                                     # run once, in test_hot_zones
    test_hud_shrinks_walks_when_too_big = None

    def test_rental_hotlist_reaches_hud_and_stays_additive(self):
        now = "2026-09-01T00:00:00Z"
        # T23 owner cache: the county says P0 (100 Oak St)'s owner mails elsewhere -> a rental house.
        self.conn.execute("INSERT INTO owner_occ VALUES (?,?,?,?,?,?,?,?,?,?)",
                          ("sarpy", "OWN0", 100, "OAK ST", 41.45, -96.55, 0, None, "t", now))
        # A small (3-unit-estimate) multi-family parcel alongside the 30 single-family ones.
        self.conn.execute("INSERT INTO parcels VALUES (" + ",".join("?" * 25) + ")",
                          ("PM0", "053", "M0", 3000, "ELM ST", "", "3000 Elm St", "Testville", "68025",
                           41.4620, -96.55, "multi", 0, 1975, 2700, 200000, 250000, "", "", None, "", "", 0.2,
                           "t", now))
        self.conn.commit()
        res = doors.make_list(self.conn, self.cfg, self.day, "Testville", None, log=lambda *a: None)
        self.assertIn("3000 Elm St", [h["address"] for h in res["houses"]])
        path, d = hud.write(self.conn, self.cfg)
        self.assertTrue({"storms", "lists", "everyday_lists", "targets", "hail_evidence", "counts", "agents"}
                        <= set(d))                                        # every old field stays put (additive)
        self.assertIn("rental_hotlist", d)
        by_addr = {r["address"]: r for r in d["rental_hotlist"]}
        self.assertEqual(by_addr["100 Oak St"]["units_est"], 1)
        self.assertEqual(by_addr["3000 Elm St"]["units_est"], 3)
        for a in ("101 Oak St", "102 Oak St"):                            # no owner cache row: not a candidate
            self.assertNotIn(a, by_addr)
        for r in d["rental_hotlist"]:
            self.assertEqual(set(r), set(rentals.FIELD_KEYS))             # exactly the given hud.json shape
        self.assertEqual(json.load(open(path))["rental_hotlist"], d["rental_hotlist"])   # what was actually written


if __name__ == "__main__":
    unittest.main()
