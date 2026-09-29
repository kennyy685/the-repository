"""T211 (research round 62): Census ACS B25081 mortgage share of owner-lived homes, per block group, carried as an
OPTIONAL additive field to hud.json (walks, lists, neighborhoods), zones/current and walks/<zone> / today/walk, with
one plain EN/ES line. An area fact, never the word "insured", never about one house. Offline."""
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
QUIET = lambda *a, **k: None  # noqa: E731
NEVER = re.compile(r"insur|asegur|seguro|deduct|deduc|guarant", re.I)       # same rule as tests/test_zones.py
# The real ACS 5-year B25081 file layout (2023 and 2024 are the same; checked 2026-09-28 against the file header and
# api.census.gov .../groups/B25081.json): E001 = owner-occupied homes, E002 = with a mortgage, contract to purchase or
# similar debt (its sub-lines are E003-E008), E009 = without a mortgage. M = margins of error.
HEAD = "GEO_ID|" + "|".join(f"B25081_E{k:03d}|B25081_M{k:03d}" for k in range(1, 10))


def row(geo, total, with_mortgage):
    est = [total, with_mortgage, with_mortgage, 0, 0, 0, 0, 0, total - with_mortgage]
    return geo + "|" + "|".join(f"{v}|{max(10, v // 5)}" for v in est)


class Fetch:
    def __init__(self, txt):
        self.txt = txt

    def get(self, url, ttl=None, cache=True):
        if url.endswith("acsdt5y2024-b25081.dat"):
            return self.txt.encode()
        raise RuntimeError("404 " + url)


class Loader(th.Base):
    def test_real_file_columns_and_per_block_group_share(self):
        txt = "\n".join([HEAD,
                         row("1500000US310539640003", 300, 210),
                         row("1500000US310539640004", 0, 0),                    # no owner-lived homes: no share
                         "1500000US310539640005|-666666666|-222222222" + "|0" * 16,   # Census "no estimate"
                         row("1600000US3117670", 6000, 3500),                   # Fremont city (place level)
                         row("1500000US080010078011", 500, 400)]) + "\n"        # Colorado: not one of our states
        want = tuple(f"{lvl}US{nbhd.FIPS[s]}" for s in self.cfg["states"] for lvl in ("1500000", "1600000"))
        self.assertEqual(nbhd.load_mortgages(self.conn, Fetch(txt), want, "2024", log=QUIET), 3)
        shares = nbhd.mortgage_shares(self.conn)
        self.assertEqual(set(shares), {BG, "3117670"})                          # zero denominator -> left out (None)
        self.assertAlmostEqual(shares[BG], 0.7)
        self.assertAlmostEqual(shares["3117670"], 3500 / 6000)
        self.conn.execute("INSERT INTO acs_mortgage VALUES ('310539640009', 100, 130, '2024')")   # never above 100%
        self.assertEqual(nbhd.mortgage_shares(self.conn)["310539640009"], 1.0)

    def test_missing_table_never_stops_anything(self):
        self.assertEqual(nbhd.load_mortgages(self.conn, Fetch(""), ("1500000US31",), "2023", log=QUIET), 0)
        self.assertEqual(nbhd.mortgage_shares(self.conn), {})


class Note(unittest.TestCase):
    def setUp(self):
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))

    def test_plain_line_in_both_languages(self):
        n = todaywalk.mortgage_note(0.62, self.cfg)
        self.assertEqual(n["en"], "About 60% of owner-lived homes here have a mortgage (Census). "
                                  "Mortgage companies require home coverage.")
        self.assertEqual(n["es"], "En esta zona, cerca del 60% de las casas donde vive el dueño tienen hipoteca "
                                  "(Censo). Las compañías hipotecarias exigen cobertura para la casa.")
        low = todaywalk.mortgage_note(0.31, self.cfg)                         # below mortgage.low_share (0.40)
        self.assertEqual(low["en"], "About 30% of owner-lived homes here have a mortgage (Census): "
                                    "many are owned outright.")
        self.assertEqual(low["es"], "En esta zona, cerca del 30% de las casas donde vive el dueño tienen hipoteca "
                                    "(Censo): muchas ya están pagadas.")
        self.assertTrue(todaywalk.mortgage_note(0.0, self.cfg)["en"].startswith("Under 5% of owner-lived homes"))
        self.assertTrue(todaywalk.mortgage_note(0.99, self.cfg)["en"].startswith("Over 95% of owner-lived homes"))
        self.assertTrue(todaywalk.mortgage_note(1.0, self.cfg)["es"].startswith("En esta zona, más del 95%"))

    def test_unknown_is_none_and_threshold_comes_from_config(self):
        self.assertIsNone(todaywalk.mortgage_note(None, self.cfg))
        self.assertIsNone(todaywalk.mortgage_note("n/a", self.cfg))
        self.assertEqual(self.cfg["mortgage"]["low_share"], 0.40)
        cfg = copy.deepcopy(self.cfg)
        cfg["mortgage"]["low_share"] = 0.2
        self.assertIn("Mortgage companies require", todaywalk.mortgage_note(0.31, cfg)["en"])
        self.assertIn("Mortgage companies require", todaywalk.mortgage_note(0.62)["en"])   # no cfg: defaults

    def test_never_the_insurance_words(self):
        for s in (0, 0.01, 0.2, 0.39, 0.4, 0.62, 0.97, 1.0):
            n = todaywalk.mortgage_note(s, self.cfg)
            self.assertTrue(n["en"] and n["es"])
            self.assertIsNone(NEVER.search(n["en"] + n["es"]), n)


class Hud(th.Pipeline):
    """make_list -> hud.json: the walk's share is the Census share of its houses' block groups (house-weighted)."""
    test_list_heat_reaches_hud = None                                   # run once, in test_hot_zones
    test_hud_shrinks_walks_when_too_big = None

    def test_walks_lists_and_neighborhoods_carry_the_census_share(self):
        self.conn.execute("""INSERT INTO nbhd_hits (conv_day, geoid, label, place_name, state, lat, lon, dist_mi, hu,
                             owner_share, hail_in, mesh_max_in, frac_ge_1, score) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                          (self.day, BG, "Testville, NE center [9640-3]", "Testville", "NE", 41.45, -96.55, 5.0, 400,
                           0.79, 1.6, 1.8, 1.0, 50.0))
        self.conn.commit()
        doors.make_list(self.conn, self.cfg, self.day, "Testville", None, log=QUIET)
        _, d = hud.write(self.conn, self.cfg)
        L = d["lists"][0]
        t = L["turfs"][0]
        self.assertEqual((t["mortgage_share"], L["mortgage_share"]), (0.7, 0.7))
        self.assertNotIn("mortgage_note", t)                            # walks: the number only (hud.json size cap)
        n = d["neighborhoods"][0]
        self.assertEqual((n["mortgage_share"], n["mortgage_note"]), (0.7, todaywalk.mortgage_note(0.7, self.cfg)))
        self.assertTrue(n["mortgage_note"]["en"].startswith("About 70% of owner-lived homes here have a mortgage"))

    def test_unknown_share_is_null_never_the_hot_zones_default(self):
        self.conn.execute("DELETE FROM acs_mortgage")
        self.conn.commit()
        doors.make_list(self.conn, self.cfg, self.day, "Testville", None, log=QUIET)
        parts = json.loads(self.conn.execute("SELECT parts FROM door_list_turfs").fetchone()[0])
        self.assertEqual(parts["mortgage"], 0.6)                        # Hot Zones still scores with the default ...
        _, d = hud.write(self.conn, self.cfg)
        t = d["lists"][0]["turfs"][0]
        self.assertIsNone(t["mortgage_share"])                          # ... but never shows it as Census data
        self.assertIsNone(d["lists"][0]["mortgage_share"])

    def test_everyday_list_falls_back_to_its_neighborhood(self):
        self.conn.execute("""INSERT INTO everyday_lists (list_id, conv_day, area, created_utc, params, n_doors, n_turfs,
                             geoid, heat, why, parts) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                          (f"everyday_Testville_{BG}", self.day, "Testville, NE", "2026-09-25T12:00:00Z", "{}", 0, 0,
                           BG, 40.0, "[]", "{}"))
        self.conn.commit()
        _, d = hud.write(self.conn, self.cfg)
        self.assertEqual(d["everyday_lists"][0]["mortgage_share"], 0.7)

    def test_fresh_database(self):
        cfg = copy.deepcopy(self.cfg)
        cfg["paths"] = {k: os.path.join(self.tmp, "fresh", k) for k in ("db", "cache", "export")}
        os.makedirs(cfg["paths"]["export"])
        conn = db.connect(cfg["paths"]["db"])
        try:
            self.assertEqual(nbhd.mortgage_shares(conn), {})
            _, d = hud.write(conn, cfg)
            self.assertEqual((d["lists"], d["neighborhoods"], d["everyday_lists"]), ([], [], []))
        finally:
            conn.close()


class ZonesAndWalks(unittest.TestCase):
    """hh.py zones / todaywalk read the shares from hud.json; older hud.json (no mortgage fields) still works."""

    def setUp(self):
        with open(FIX) as f:
            self.hud = json.load(f)
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))
        self.storm = next(L for L in self.hud["lists"] if L["id"] == "2026-09-10_Fremont")
        self.every = self.hud["everyday_lists"][0]

    @staticmethod
    def mark(L, list_share, *turf_shares):
        """What a T211 engine writes: each walk's Census share (null when unknown) and the list's own share."""
        L["mortgage_share"] = list_share
        for t, s in zip(L["turfs"], turf_shares):
            t["mortgage_share"] = s

    def test_zones_and_walks_carry_the_share_and_line(self):
        self.mark(self.storm, 0.66, 0.72, None)
        self.mark(self.every, 0.31, None)
        d = zones.zones(self.hud, DAY, cfg=self.cfg)
        z = {x["id"]: x for x in d["zones"]}
        t1, t2 = z["2026-09-10_Fremont~t1"], z["2026-09-10_Fremont~t2"]
        ev = z["everyday_Fremont_310539640003~t1"]
        self.assertEqual((t1["mortgage_share"], t1["mortgage_note"]), (0.72, todaywalk.mortgage_note(0.72, self.cfg)))
        self.assertEqual((t2["mortgage_share"], t2["mortgage_note"]["en"][:9]), (0.66, "About 65%"))   # list's share
        self.assertEqual(ev["mortgage_share"], 0.31)
        self.assertTrue(ev["mortgage_note"]["en"].endswith("many are owned outright."))
        w = zones.walks(self.hud, d, DAY, doors=8, cfg=self.cfg)
        self.assertEqual(w["walks/2026-09-10_Fremont~t1"]["mortgage_share"], 0.72)
        self.assertEqual(w["walks/2026-09-10_Fremont~t1"]["mortgage_note"], t1["mortgage_note"])
        self.assertEqual(w["walks/2026-09-10_Fremont~t2"]["mortgage_share"], 0.66)
        for x in list(z.values()) + list(w.values()):
            self.assertIsNone(NEVER.search(json.dumps(x.get("mortgage_note"), ensure_ascii=False)))

    def test_today_walk_share_is_house_weighted(self):
        self.mark(self.storm, 0.6, 0.8, 0.4)
        turf_of = {s["pid"]: s["turf"] for s in self.storm["stops"]}
        doc = todaywalk.pick(self.hud, DAY, goal=25, cfg=self.cfg)
        v = [{1: 0.8, 2: 0.4}[turf_of[s["pid"]]] for s in doc["stops"]]
        self.assertEqual(doc["mortgage_share"], round(sum(v) / len(v), 3))
        self.assertEqual(doc["mortgage_note"], todaywalk.mortgage_note(doc["mortgage_share"], self.cfg))

    def test_older_hud_json_never_shows_a_default(self):
        for t in self.storm["turfs"]:
            t["mortgage_share"] = 0.6        # engines before T211: the Hot Zones 'unknown' default, no list share
        self.assertNotIn("mortgage_share", self.storm)
        d = zones.zones(self.hud, DAY, cfg=self.cfg)
        self.assertTrue(d["zones"])
        for z in d["zones"]:
            self.assertEqual((z["mortgage_share"], z["mortgage_note"]), (None, None))
        for doc in zones.walks(self.hud, d, DAY, doors=8, cfg=self.cfg).values():
            self.assertIsNone(doc["mortgage_share"])
            self.assertNotIn("mortgage_note", doc)
        self.assertIsNone(todaywalk.pick(self.hud, DAY, cfg=self.cfg)["mortgage_share"])
        none = todaywalk.today_doc({"lists": [], "everyday_lists": []}, DAY, cfg=self.cfg)
        self.assertIsNone(none["mortgage_share"])


if __name__ == "__main__":
    unittest.main()
