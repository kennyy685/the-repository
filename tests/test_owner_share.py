"""T211 follow-up (2026-09-28): a walk's owner-occupied share is real data or null, never the Hot Zones 'unknown'
default (0.65). Before this, a storm walk with no Census owner data carried owner_share 0.65 in hud.json, and door
score v2 turned it into "likely owner-occupied (area 65% owners)" on every door. Same approach as T211's mortgage
share (tests/test_mortgage_share.py): the engine keeps scoring with the default, hud.json shows null, lists gain an
additive `owner_share`, and hud.json from older engines never shows a default. Offline."""
import copy
import json
import os
import re
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from hailhunter import config as C, db, doors, hud, nbhd, todaywalk, zones  # noqa: E402
from tests import test_hot_zones as th  # noqa: E402

FIX = os.path.join(HERE, "fixtures", "today_hud.json")
DAY = "2026-09-25"
BG = "310539640003"
CENSUS = round(300 / 380, 3)                      # th.Pipeline's block group: 300 owner-lived of 380 occupied homes
QUIET = lambda *a, **k: None  # noqa: E731
OWNER_PCT = re.compile(r"\d+% (owners|dueños)")   # the door line's area owner percent, EN or ES


class HotZone(th.Base):
    def test_parts_keep_the_scoring_default_but_owner_share_is_null(self):
        z = doors.hot_zone([th.stop(own=None) for _ in range(5)], self.cfg, "2026-09-12", "Fremont, NE", None, th.TODAY)
        self.assertEqual(z["parts"]["owners"], 0.65)                    # the heat still scores with the default ...
        self.assertIsNone(z["parts"]["owner_share"])                    # ... but it is not the walk's owner share
        z = doors.hot_zone([th.stop(own=0.8), th.stop(own=0.6), th.stop(own=None)], self.cfg, "2026-09-12",
                           "Fremont, NE", None, th.TODAY)
        self.assertEqual((z["parts"]["owners"], z["parts"]["owner_share"]), (0.7, 0.7))   # known houses only


class Hud(th.Pipeline):
    """make_list -> hud.json: a walk's owner_share is the engine's real share, the Census share, or null."""
    test_list_heat_reaches_hud = None                                   # run once, in test_hot_zones
    test_hud_shrinks_walks_when_too_big = None

    def build(self):
        doors.make_list(self.conn, self.cfg, self.day, "Testville", None, log=QUIET)
        return hud.write(self.conn, self.cfg)[1]

    def test_known_share_is_unchanged_and_the_list_carries_it(self):
        d = self.build()
        L = d["lists"][0]
        self.assertEqual((L["turfs"][0]["owner_share"], L["owner_share"]), (CENSUS, CENSUS))

    def test_unknown_share_is_null_never_the_hot_zones_default(self):
        self.conn.execute("DELETE FROM acs")                            # no Census owner data for the walk
        self.conn.commit()
        d = self.build()
        parts = json.loads(self.conn.execute("SELECT parts FROM door_list_turfs").fetchone()[0])
        self.assertEqual(parts["owners"], 0.65)                         # Hot Zones still scores with the default ...
        L = d["lists"][0]
        self.assertIsNone(L["turfs"][0]["owner_share"])                 # ... but hud.json never shows it as data
        self.assertIsNone(L["owner_share"])

    def test_walks_scored_before_the_fix_take_the_census_share_not_parts(self):
        doors.make_list(self.conn, self.cfg, self.day, "Testville", None, log=QUIET)
        for lid, turf, raw in self.conn.execute("SELECT list_id, turf, parts FROM door_list_turfs").fetchall():
            p = json.loads(raw)
            p.pop("owner_share", None)                                  # a row written by an engine before the fix,
            p["owners"] = 0.65                                          # with the default it scored an unknown walk with
            self.conn.execute("UPDATE door_list_turfs SET parts=? WHERE list_id=? AND turf=?", (json.dumps(p), lid, turf))
        self.conn.commit()
        _, d = hud.write(self.conn, self.cfg)
        self.assertEqual(d["lists"][0]["turfs"][0]["owner_share"], CENSUS)
        self.conn.execute("DELETE FROM acs")
        self.conn.commit()
        _, d = hud.write(self.conn, self.cfg)
        self.assertIsNone(d["lists"][0]["turfs"][0]["owner_share"])

    def test_everyday_list_falls_back_to_its_neighborhood(self):
        self.conn.execute("""INSERT INTO everyday_lists (list_id, conv_day, area, created_utc, params, n_doors, n_turfs,
                             geoid, heat, why, parts) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                          (f"everyday_Testville_{BG}", self.day, "Testville, NE", "2026-09-25T12:00:00Z", "{}", 0, 0,
                           BG, 40.0, "[]", "{}"))
        self.conn.commit()
        _, d = hud.write(self.conn, self.cfg)
        self.assertEqual(d["everyday_lists"][0]["owner_share"], CENSUS)

    def test_fresh_database(self):
        cfg = copy.deepcopy(self.cfg)
        cfg["paths"] = {k: os.path.join(self.tmp, "fresh", k) for k in ("db", "cache", "export")}
        os.makedirs(cfg["paths"]["export"])
        conn = db.connect(cfg["paths"]["db"])
        try:
            self.assertEqual(nbhd.owner_shares(conn), {})
            _, d = hud.write(conn, cfg)
            self.assertEqual((d["lists"], d["everyday_lists"]), ([], []))
        finally:
            conn.close()


class DoorLines(unittest.TestCase):
    """hh.py zones / todaywalk read owner_share from hud.json and only trust it from an engine that writes it honestly."""

    def setUp(self):
        with open(FIX) as f:
            self.hud = json.load(f)
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))
        self.storm = next(L for L in self.hud["lists"] if L["id"] == "2026-09-10_Fremont")

    def stops(self):
        """Every stop of today's walk and of every zone walk."""
        d = zones.zones(self.hud, DAY, cfg=self.cfg)
        self.assertTrue(d["zones"])
        docs = [todaywalk.pick(self.hud, DAY, goal=25, cfg=self.cfg)] + \
            list(zones.walks(self.hud, d, DAY, doors=8, cfg=self.cfg).values())
        out = [s for doc in docs for s in doc["stops"]]
        self.assertTrue(out)
        return out

    def test_older_hud_json_never_shows_the_default(self):
        for t in self.storm["turfs"]:
            t["owner_share"] = 0.65          # engines before the fix: the Hot Zones 'unknown' default, no list share
        self.assertNotIn("owner_share", self.storm)
        for s in self.stops():
            self.assertIsNone(OWNER_PCT.search(s["why"]["en"] + " " + s["why"]["es"]), s["why"])
            self.assertNotEqual(s["door"]["parts"]["owner_basis"], "area")

    def test_honest_hud_json_keeps_the_real_share_and_says_nothing_when_unknown(self):
        self.storm["owner_share"] = 0.7                                 # what a fixed engine writes
        self.storm["turfs"][0]["owner_share"] = 0.72
        self.storm["turfs"][1]["owner_share"] = None
        turf_of = {s["pid"]: s["turf"] for s in self.storm["stops"]}
        seen = set()
        for s in self.stops():
            t = turf_of.get(s["pid"])
            if t == 1:
                self.assertIn("likely owner-occupied (area 72% owners, Census)", s["why"]["en"])
                self.assertIn("(72% dueños en la zona, Censo)", s["why"]["es"])
            elif t == 2:
                self.assertIsNone(OWNER_PCT.search(s["why"]["en"] + " " + s["why"]["es"]), s["why"])
                self.assertEqual(s["door"]["parts"]["owner_basis"], "unknown")
            seen.add(t)
        self.assertTrue({1, 2} <= seen)

    def test_walk_owner_reads_only_honest_hud_json(self):
        t = {"turf": 1, "owner_share": 0.65}
        self.assertIsNone(todaywalk.walk_owner(t, {"turfs": [t]}))                      # older engine: can't tell
        self.assertEqual(todaywalk.walk_owner(t, {"turfs": [t], "owner_share": None}), 0.65)
        self.assertIsNone(todaywalk.walk_owner({"turf": 1}, {"owner_share": 0.5}))
        self.assertIsNone(todaywalk.walk_owner(None, None))


if __name__ == "__main__":
    unittest.main()
