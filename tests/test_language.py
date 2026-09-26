"""Offline tests for T37: Spanish-speaking neighborhoods (Census ACS language spoken at home), so HMP knows
where Alex (Spanish) should knock and which walks get the Spanish-first hanger side."""
import json
import os
import sys
import unittest
from datetime import date, datetime, timedelta, timezone

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from hailhunter import db, doors, everyday, hud, mrms, nbhd, todaywalk  # noqa: E402
from hailhunter.models import iso  # noqa: E402
from unittest import mock  # noqa: E402
from tests import test_everyday as te  # noqa: E402  (module import: its test classes don't run twice)

ACS, BG, QUIET, FakeFetcher = te.ACS, te.BG, te.QUIET, te.FakeFetcher

NOTE = "Many Spanish-speaking households: send Alex / Muchos hogares hispanohablantes: que vaya Alex"
TRACT = BG[:11]
C16002 = ("GEO_ID|C16002_E001|C16002_E002|C16002_E003\n"
          f"1500000US{BG}|380|200|171\n"                     # 45% of households speak Spanish
          f"1400000US{TRACT}|1000|900|50\n"                   # the tract: 5%
          f"8600000US{BG}|100|0|100\n")                       # another geography level: ignored
C16001 = ("GEO_ID|C16001_E001|C16001_E002|C16001_E003\n"
          f"1500000US{BG}|1000|880|120\n")                   # people 5+: 12%


def add_bg_row(conn, geoid, lat=41.45, lon=-96.55, d=0.01):
    ring = [[lon - d, lat - d], [lon + d, lat - d], [lon + d, lat + d], [lon - d, lat + d], [lon - d, lat - d]]
    conn.execute("INSERT INTO bgs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                 (geoid, "NE", "053", geoid[5:11], geoid[11:], lat, lon, 1.0, 3.0, lon - d, lat - d, lon + d, lat + d,
                  json.dumps([ring]), "p", "Testville"))


class Loader(te.Base):
    def test_households_table_bg_and_tract_fill_in(self):
        add_bg_row(self.conn, BG)
        add_bg_row(self.conn, TRACT + "9", lon=-96.40)        # same tract, no row of its own
        n = nbhd.load_language(self.conn, FakeFetcher({"c16002": C16002}), ["NE"], "2024", log=QUIET)
        self.assertEqual(n, 2)
        sh = nbhd.spanish_shares(self.conn)
        self.assertAlmostEqual(sh[BG], 0.45)
        self.assertAlmostEqual(sh[TRACT + "9"], 0.05)          # took its tract's share
        self.assertEqual(db.get_meta(self.conn, "acs_language")["source"], "C16002")

    def test_falls_back_to_people_table_then_blank(self):
        add_bg_row(self.conn, BG)
        nbhd.load_language(self.conn, FakeFetcher({"c16001": C16001}), ["NE"], "2024", log=QUIET)
        self.assertAlmostEqual(nbhd.spanish_shares(self.conn)[BG], 0.12)
        self.conn.execute("DELETE FROM acs_language")
        self.assertEqual(nbhd.load_language(self.conn, FakeFetcher({}), ["NE"], "2024", log=QUIET), 0)
        self.assertEqual(nbhd.spanish_shares(self.conn), {})

    def test_load_acs_still_works_without_language_and_retry_waits(self):
        add_bg_row(self.conn, BG)
        self.assertEqual(nbhd.load_acs(self.conn, FakeFetcher(ACS), self.cfg, log=QUIET), (1, "2024"))
        self.assertIsNone(self.conn.execute("SELECT 1 FROM acs_language").fetchone())
        full = FakeFetcher(dict(ACS, c16002=C16002))
        self.assertEqual(nbhd.ensure_language(self.conn, full, self.cfg, log=QUIET), 0)       # tried just now
        self.assertEqual(nbhd.ensure_language(self.conn, FakeFetcher(ACS, offline=True), self.cfg, log=QUIET), 0)
        db.set_meta(self.conn, "acs_language", {"tried_utc": iso(datetime.now(timezone.utc) - timedelta(days=8)),
                                                "vintage": "2024", "rows": 0})
        self.assertEqual(nbhd.ensure_language(self.conn, full, self.cfg, log=QUIET), 2)

    def test_points_to_block_groups(self):
        add_bg_row(self.conn, BG)
        got = nbhd.bgs_of_points(self.conn, [(41.45, -96.55), (41.60, -96.55), (None, None)])
        self.assertEqual(got, [BG, None, None])


class Hud(te.Base):
    area = te.Town.area

    def setUp(self):
        super().setUp()
        self.today = date.today()
        self.conn.execute("INSERT INTO places (geoid,name,state,lat,lon,pop,aland_sqmi,dist_mi,hu) VALUES "
                          "('3104000','Testville','NE',41.45,-96.55,900,1.0,5,400)")
        te.add_bg(self.conn, BG, "Testville, NE center [9640-3]", 41.45, -96.55, 400, 300 / 380, 1958, 150000,
                  te.bins(400, 268, 12), ring=te.RING)
        te.town_parcels(self.conn, self.today)

    def test_lists_neighborhoods_and_reasons(self):
        day = (date.today() - timedelta(days=10)).isoformat()
        arr = np.full((60, 60), round(1.6 * 25.4 * 10), np.uint16)
        meta = {"lat0": 41.6, "lon0": -96.7, "dlat": 0.01, "dlon": 0.01, "shape": [60, 60], "complete": True}
        with open(mrms.grid_path(self.cfg, day), "wb") as f:
            np.savez_compressed(f, mesh=arr, meta=json.dumps(meta))
        doors.make_list(self.conn, self.cfg, day, "Testville", None, log=QUIET)
        everyday.make_list(self.conn, self.cfg, self.area(), log=QUIET)
        self.conn.execute("INSERT INTO nbhd_hits (conv_day, geoid, label, place_name, state, lat, lon, hu, hail_in, "
                          "frac_ge_1, score) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                          (day, BG, "Testville center", "Testville", "NE", 41.45, -96.55, 400, 1.6, 1.0, 50))
        self.conn.commit()
        _, d = hud.write(self.conn, self.cfg)                  # no language data: blank, no reason line
        self.assertIsNone(d["lists"][0]["spanish_share"])
        self.assertIsNone(d["neighborhoods"][0]["spanish_share"])
        self.assertNotIn(NOTE, json.dumps(d))
        nbhd.load_language(self.conn, FakeFetcher({"c16002": C16002}), ["NE"], "2024", log=QUIET)
        path, d = hud.write(self.conn, self.cfg)
        with open(path) as f:
            d = json.load(f)
        self.assertEqual(d["neighborhoods"][0]["spanish_share"], 0.45)
        S, E = d["lists"][0], d["everyday_lists"][0]
        self.assertEqual((S["spanish_share"], E["spanish_share"]), (0.45, 0.45))
        self.assertEqual(S["turfs"][0]["spanish_share"], 0.45)
        self.assertEqual(S["turfs"][0]["why"][-1], NOTE)
        self.assertEqual(E["why"][-1], NOTE)
        self.cfg["language"]["spanish_high"] = 0.5             # below the threshold: share shown, no reason line
        _, d = hud.write(self.conn, self.cfg)
        self.assertEqual(d["lists"][0]["spanish_share"], 0.45)
        self.assertNotIn(NOTE, json.dumps(d))


class Who(unittest.TestCase):
    def setUp(self):
        with open(os.path.join(HERE, "fixtures", "today_hud.json")) as f:
            self.hud = json.load(f)

    def pick(self, share):
        for L in self.hud["lists"]:
            for t in L["turfs"]:
                t["spanish_share"] = share
        return todaywalk.pick(self.hud, "2026-09-25", cfg={})

    def test_who_follows_the_share(self):
        d = self.pick(0.42)
        self.assertEqual((d["spanish_share"], d["who"]), (0.42, "Alex"))
        self.assertEqual(self.pick(0.03)["who"], "Kenny")
        self.assertEqual(self.pick(0.2)["who"], "either")
        with open(os.path.join(HERE, "fixtures", "today_hud.json")) as f:
            d = todaywalk.pick(json.load(f), "2026-09-25", cfg={})
        self.assertEqual((d["spanish_share"], d["who"]), (None, "either"))     # older hud.json: unknown


class FreshDatabase(te.Base):
    _refresh = te.FreshDatabase._refresh

    def test_fresh_database_loads_language(self):
        summary = self._refresh(FakeFetcher(dict(ACS, c16002=C16002)))
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM acs_language").fetchone()[0], 2)
        with open(summary["hud"]) as f:
            self.assertEqual(json.load(f)["everyday_lists"][0]["spanish_share"], 0.45)

    def test_language_failure_never_stops_refresh(self):
        with mock.patch.object(nbhd, "load_language", side_effect=RuntimeError("boom")):
            summary = self._refresh(FakeFetcher(ACS))
        self.assertTrue(os.path.exists(summary["hud"]))
        self.assertEqual(len(summary["everyday_lists"]), 1)


if __name__ == "__main__":
    unittest.main()
