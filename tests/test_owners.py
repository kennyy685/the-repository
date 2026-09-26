"""T23: per-house owner-occupied from county owner mailing addresses (hailhunter/owners.py). Offline: a recorded,
trimmed Sarpy County response (tests/fixtures/owners_sarpy.json) served by a fake session."""
import json
import os
import shutil
import sys
import tempfile
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from hailhunter import db, doorscore, hud, owners  # noqa: E402

FIX = os.path.join(HERE, "fixtures", "owners_sarpy.json")
BBOX = (-95.962, 41.104, -95.951, 41.113)          # a few Bellevue blocks (Sarpy County), one parcel tile


class _Resp:
    def __init__(self, d):
        self.d = d

    def raise_for_status(self):
        pass

    def json(self):
        return self.d


class FakeSession:
    """Serves the recorded pages by resultOffset, counts requests, remembers the params asked for."""
    def __init__(self):
        with open(FIX) as f:
            self.pages = json.load(f)["pages"]
        self.calls = []

    def get(self, url, params=None, timeout=None):
        self.calls.append((url, dict(params or {})))
        off = int(params["resultOffset"])
        for p in self.pages:
            if off == 0:
                return _Resp(p)
            off -= len(p["features"])
        return _Resp({"features": []})


class Occupied(unittest.TestCase):
    def test_rules(self):
        s = "2909 BLACKHAWK DR  BELLEVUE NE 68123"
        self.assertIs(owners.occupied(s, "2909 BLACKHAWK DR ", "68123", "68123"), True)
        self.assertIs(owners.occupied(s, "2909 Blackhawk Drive", "68123", "68123-1234"), True)   # suffix spelled out
        self.assertIs(owners.occupied(s, "100 SAMPLE RD", "68123", "51534"), False)             # landlord elsewhere
        self.assertIs(owners.occupied(s, "2909 BLACKHAWK DR", "68123", "68046"), False)         # same street, other town
        self.assertIsNone(owners.occupied(s, "PO BOX 123"))                                     # can't tell
        self.assertIsNone(owners.occupied(s, ""))
        self.assertIsNone(owners.occupied("", "2909 BLACKHAWK DR"))
        self.assertEqual(owners.addr_key("13706 S 28th Cir, Bellevue"), (13706, "S 28TH CIR"))
        self.assertEqual(owners.addr_key("101 N Main Street Apt 4"), (101, "N MAIN ST"))

    def test_never_asks_for_owner_names(self):
        for src in owners.SOURCES.values():
            self.assertNotIn("NAME", src["fields"].upper())


class Cache(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.conn = db.connect(os.path.join(self.tmp, "t.db"))     # brand-new database, like the cloud run

    def tearDown(self):
        self.conn.close()
        shutil.rmtree(self.tmp)

    def _fill(self):
        sess = FakeSession()
        with mock.patch.object(owners, "PAUSE_S", 0):
            n = owners.ensure_area(self.conn, sess, BBOX, log=lambda *a: None)
        return sess, n

    def test_download_pages_and_caches(self):
        sess, n = self._fill()
        self.assertEqual(n, 12)
        self.assertEqual(len(sess.calls), 2)                        # two pages, one tile
        self.assertEqual(sess.calls[1][1]["resultOffset"], 7)
        self.assertNotIn("Name", sess.calls[0][1]["outFields"])
        sess2 = FakeSession()
        owners.ensure_area(self.conn, sess2, BBOX, log=lambda *a: None)
        self.assertEqual(sess2.calls, [])                           # cached: no second download
        # the table holds no owner names or mailing addresses
        cols = [r[1] for r in self.conn.execute("PRAGMA table_info(owner_occ)")]
        self.assertFalse([c for c in cols if "name" in c.lower() or "mail" in c.lower() or "owner_addr" in c])
        blob = json.dumps([list(r) for r in self.conn.execute("SELECT * FROM owner_occ")])
        self.assertNotIn("SAMPLE RD", blob)
        self.assertNotIn("PO BOX", blob)
        vals = dict(((r["house_num"], r["street"]), r["owner_occupied"]) for r in self.conn.execute(
            "SELECT house_num, street, owner_occupied FROM owner_occ"))
        self.assertEqual(vals[(2909, "BLACKHAWK DR")], 1)
        self.assertEqual(vals[(3201, "BLACKHAWK DR")], 0)
        self.assertIsNone(vals[(2908, "SCHUEMANN DR")])
        self.assertIsNone(vals[(2904, "HALIFAX DR")])

    def test_outside_every_county_makes_no_request(self):
        sess = FakeSession()
        owners.ensure_area(self.conn, sess, (-96.55, 41.40, -96.45, 41.47), log=lambda *a: None)   # Fremont
        self.assertEqual(sess.calls, [])

    def test_lookup_sets_house_flag(self):
        self._fill()
        stops = [{"address": "2909 Blackhawk Dr", "lat": 41.10959, "lon": -95.95422},
                 {"address": "3201 Blackhawk Dr", "lat": 41.10751, "lon": -95.95915},
                 {"address": "2908 Schuemann Dr", "lat": 41.11175, "lon": -95.95510},   # PO box: unknown
                 {"address": "2909 Blackhawk Dr", "lat": 41.30, "lon": -96.10},         # same address, 13 mi away
                 {"address": "13706 S 28th Cir", "lat": 41.10712, "lon": -95.95279}]
        self.assertEqual(owners.lookup(self.conn, stops), 3)
        self.assertIs(stops[0]["owner_occ"], True)
        self.assertEqual(stops[0]["owner_source"], "sarpy")
        self.assertIs(stops[1]["owner_occ"], False)
        self.assertNotIn("owner_occ", stops[2])
        self.assertNotIn("owner_occ", stops[3])
        self.assertIs(stops[4]["owner_occ"], True)

    def test_hud_stops_carry_house_flag(self):
        self._fill()
        c = self.conn
        c.execute("INSERT INTO door_lists (list_id, conv_day, area, created_utc, n_doors, n_turfs) VALUES "
                  "('2026-06-01_Bellevue', '2026-06-01', 'Bellevue, NE', '2026-06-02T00:00:00Z', 2, 1)")
        for n, (pid, addr, num, st, lat, lon) in enumerate([
                ("P1", "2909 Blackhawk Dr", 2909, "BLACKHAWK DR", 41.10959, -95.95422),
                ("P2", "3201 Blackhawk Dr", 3201, "BLACKHAWK DR", 41.10751, -95.95915),
                ("P3", "9 Nowhere St", 9, "NOWHERE ST", 41.1080, -95.9560)]):
            c.execute("INSERT INTO door_list_stops VALUES ('2026-06-01_Bellevue', 1, ?, ?, ?, 1.5, 50, '')",
                      (n + 1, pid, addr))
            c.execute("INSERT INTO parcels (pid, house_num, street, address, city, lat, lon, kind) "
                      "VALUES (?,?,?,?,'Bellevue',?,?,'single')", (pid, num, st, addr, lat, lon))
        c.commit()
        stops = hud._lists(c, 5)[0]["stops"]
        by = {s["pid"]: s for s in stops}
        self.assertEqual((by["P1"]["owner_occ"], by["P1"]["owner_source"]), (True, "sarpy"))
        self.assertEqual((by["P2"]["owner_occ"], by["P2"]["owner_source"]), (False, "sarpy"))
        self.assertEqual((by["P3"]["owner_occ"], by["P3"]["owner_source"]), (None, None))


class DoorScore(unittest.TestCase):
    def test_house_flag_replaces_area_share(self):
        base = {"hail": 1.75, "built": 1995, "kind": "single", "value": 250000, "sale_date": "2010-05-01"}
        area = doorscore.score(dict(base), "storm", 0.9, today="2026-09-26")
        rental = doorscore.score(dict(base, owner_occ=False, owner_source="sarpy"), "storm", 0.9, today="2026-09-26")
        owner = doorscore.score(dict(base, owner_occ=True, owner_source="sarpy"), "storm", 0.1, today="2026-09-26")
        self.assertEqual(area["parts"]["owner_basis"], "area")
        self.assertEqual(rental["parts"]["owner_basis"], "house")
        self.assertEqual(rental["parts"]["owner_source"], "sarpy")
        self.assertLess(rental["score"], area["score"])
        self.assertEqual(owner["parts"]["owner"], 1.0)
        self.assertIn("likely a rental", rental["why"]["en"])
        self.assertNotIn("owner_source", area["parts"])


if __name__ == "__main__":
    unittest.main()
