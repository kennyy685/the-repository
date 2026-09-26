"""T23 more counties: Douglas (dcgis.org Parcels_public, server centroids) and Lancaster (gis.lincoln.ne.gov
TaxParcels MapServer, polygons averaged, zip read off SITEADDRESS). Offline: real records pulled 2026-09-26, trimmed,
landlord mailing addresses replaced (tests/fixtures/owners_douglas_lancaster.json)."""
import json
import os
import shutil
import sys
import tempfile
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from hailhunter import db, owners  # noqa: E402

FIX = os.path.join(HERE, "fixtures", "owners_douglas_lancaster.json")
OMAHA = (-96.19, 41.20, -96.16, 41.23)            # Millard/Elkhorn edge, Douglas County
LINCOLN = (-96.61, 40.74, -96.59, 40.76)          # SE Lincoln, Lancaster County


class _Resp:
    def __init__(self, d):
        self.d = d

    def raise_for_status(self):
        pass

    def json(self):
        return self.d


class FakeSession:
    """Serves the recorded records for whichever county server is asked, one page, first tile only."""
    def __init__(self):
        with open(FIX) as f:
            self.fix = json.load(f)
        self.calls = []

    def get(self, url, params=None, timeout=None):
        self.calls.append((url, dict(params or {})))
        name = "douglas" if "dcgis.org" in url else "lancaster" if "lincoln.ne.gov" in url else None
        first = len([c for c in self.calls if c[0] == url]) == 1
        return _Resp({"features": self.fix[name] if name and first else []})


class Counties(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.conn = db.connect(os.path.join(self.tmp, "t.db"))     # brand-new database, like the cloud run

    def tearDown(self):
        self.conn.close()
        shutil.rmtree(self.tmp)

    def _fill(self, bbox):
        sess = FakeSession()
        with mock.patch.object(owners, "PAUSE_S", 0):
            owners.ensure_area(self.conn, sess, bbox, log=lambda *a: None)
        return sess

    def _vals(self, source):
        return {(r["house_num"], r["street"]): r["owner_occupied"] for r in self.conn.execute(
            "SELECT house_num, street, owner_occupied FROM owner_occ WHERE source=?", (source,))}

    def test_sources_never_ask_for_names(self):
        for name in ("douglas", "lancaster"):
            f = owners.SOURCES[name]["fields"].upper()
            self.assertNotIn("NAME", f)
            self.assertNotIn("NME", f)

    def test_douglas(self):
        sess = self._fill(OMAHA)
        urls = {c[0] for c in sess.calls}
        self.assertTrue(any("dcgis.org" in u for u in urls), urls)            # Douglas asked (Sarpy too: border)
        self.assertFalse(any("lincoln" in u for u in urls), urls)
        p = next(c[1] for c in sess.calls if "dcgis.org" in c[0])
        self.assertEqual((p["returnCentroid"], p["returnGeometry"]), ("true", "false"))
        v = self._vals("douglas")
        self.assertEqual(v[(4505, "S 168 ST")], 1)                          # mails to the house
        self.assertEqual(v[(15050, "Q ST")], 0)                             # mails elsewhere
        self.assertIsNone(v[(4125, "S 156 ST")])                            # PO box: unknown
        self.assertEqual(v[(16631, "WRIGHT CIR")], 0)                       # "CR" = CIR; mails to Wright St
        lat, lon = self.conn.execute("SELECT lat, lon FROM owner_occ WHERE spid='0116400006'").fetchone()
        self.assertAlmostEqual(lat, 41.214458, 5)
        self.assertAlmostEqual(lon, -96.176623, 5)
        blob = json.dumps([list(r) for r in self.conn.execute("SELECT * FROM owner_occ")])
        self.assertNotIn("SAMPLE RD", blob)
        self.assertNotIn("PO BOX", blob)

    def test_lancaster(self):
        sess = self._fill(LINCOLN)
        self.assertTrue(all("lincoln.ne.gov" in c[0] for c in sess.calls))
        self.assertNotIn("returnCentroid", sess.calls[0][1])                 # MapServer: no centroids
        v = self._vals("lancaster")
        self.assertEqual(v[(6141, "LAROCHE RD")], 1)
        self.assertEqual(v[(6147, "LAROCHE RD")], 0)
        self.assertIsNone(v[(6167, "LAROCHE RD")])
        lat, lon = self.conn.execute("SELECT lat, lon FROM owner_occ WHERE spid='1614121017000'").fetchone()
        self.assertTrue(40.74 < lat < 40.76 and -96.61 < lon < -96.59, (lat, lon))   # polygon corners averaged

    def test_lookup_matches_ordinals_both_ways(self):
        self._fill(OMAHA)
        stops = [{"address": "4505 S 168th St", "lat": 41.21446, "lon": -96.17662}]   # statewide layer spelling
        self.assertEqual(owners.lookup(self.conn, stops), 1)
        self.assertEqual((stops[0]["owner_occ"], stops[0]["owner_source"]), (True, "douglas"))
        # a cache written before 2026-09-26 keeps '28TH': still found
        self.conn.execute("INSERT INTO owner_occ VALUES ('sarpy','X',13706,'S 28TH CIR',41.10712,-95.95279,1,NULL,"
                          "'t','2026-09-01T00:00:00Z')")
        s2 = [{"address": "13706 S 28th Cir", "lat": 41.10712, "lon": -95.95279}]
        self.assertEqual(owners.lookup(self.conn, s2), 1)

    def test_street_spellings(self):
        self.assertEqual(owners.addr_key("18110 TAMMY TL"), owners.addr_key("18110 TAMMY TRAIL"))
        self.assertEqual(owners.addr_key("16248 BANCROFT CR"), owners.addr_key("16248 BANCROFT CIR"))
        self.assertEqual(owners.addr_key("633 S 44 ST, LINCOLN, NE"), owners.addr_key("633 S 44th Street"))
        self.assertIs(owners.occupied("4240 RANDOLPH ST, LINCOLN, NE, 68510", "4240 RANDOLPH ST", None, "68510"), True)
        s = owners._row("lancaster", owners.SOURCES["lancaster"], {
            "attributes": {"PARCELID": "1", "SITEADDRESS": "4240 RANDOLPH ST, LINCOLN, NE, 68510",
                           "PSTLADDRESS": "4240 RANDOLPH ST", "PSTLZIP5": "68046"},
            "geometry": {"rings": [[[-96.6, 40.8], [-96.6, 40.81], [-96.59, 40.81], [-96.6, 40.8]]]}}, "t", "n")
        self.assertEqual(s[6], 0)                                   # same street in another town (zip off SITEADDRESS)


if __name__ == "__main__":
    unittest.main()
