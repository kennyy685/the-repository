"""Offline tests for everyday leads (T50): old-house neighborhoods and door lists, no storm needed."""
import contextlib
import csv
import io
import json
import os
import shutil
import sys
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone
from unittest import mock

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import commercial, db, doors, everyday, hud, ingest, mrms, nbhd, parcels, wind  # noqa: E402
from hailhunter import config as C  # noqa: E402
from hailhunter.models import iso  # noqa: E402
from hailhunter.sources import places  # noqa: E402

QUIET = lambda *a, **k: None  # noqa: E731
OLD_HUD_KEYS = {"generated_utc", "home", "radius_mi", "counts", "storms", "lists", "targets", "neighborhoods",
                "wind_events", "watch_hits", "agents"}
LIST_KEYS = {"id", "day", "area", "doors", "turfs", "stops", "created_utc"}
BG = "310539640003"
# An L-shaped neighborhood: the top-right corner (lon > -96.54, lat > 41.46) is outside it.
RING = [[-96.60, 41.40], [-96.50, 41.40], [-96.50, 41.46], [-96.54, 41.46], [-96.54, 41.50], [-96.60, 41.50],
        [-96.60, 41.40]]


def bins(total, before_1980, since_2010):
    """A B25034 row: `before_1980` homes spread over 1970s..1939-or-earlier, `since_2010` in the 2010s, rest 1990s."""
    old = [before_1980 // 5] * 4 + [before_1980 - 4 * (before_1980 // 5)]
    return [total, 0, since_2010, 0, total - before_1980 - since_2010, 0] + old


def add_bg(conn, geoid, label, lat, lon, hu, owner_share, med_year, med_value, yb=None, ring=None):
    d = 0.01
    ring = ring or [[lon - d, lat - d], [lon + d, lat - d], [lon + d, lat + d], [lon - d, lat + d], [lon - d, lat - d]]
    xs, ys = [p[0] for p in ring], [p[1] for p in ring]
    conn.execute("INSERT INTO bgs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                 (geoid, "NE", "053", "964000", "3", lat, lon, 1.0, 3.0, min(xs), min(ys), max(xs), max(ys),
                  json.dumps([ring]), "p", label))
    occ = round(hu * 0.95)
    conn.execute("INSERT INTO acs VALUES (?,?,?,?,?,?,?,?,?)",
                 (geoid, "bg", hu, occ, round(occ * owner_share), occ - round(occ * owner_share), med_year, med_value,
                  "2024"))
    if yb:
        conn.execute("INSERT INTO acs_year_built VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'2024')", (geoid, *yb))
    conn.commit()


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.cfg = C.load(os.path.join(self.tmp, "none.json"))
        self.cfg["paths"] = {k: os.path.join(self.tmp, k) for k in ("db", "cache", "export")}
        os.makedirs(self.cfg["paths"]["export"])
        self.conn = db.connect(self.cfg["paths"]["db"])

    def tearDown(self):
        self.conn.close()
        shutil.rmtree(self.tmp)


class Heat(Base):
    def test_formula_and_reasons(self):
        f = {"share_old": 0.62, "basis": "census", "owners": 0.82, "med_value": 150000, "dist_mi": 5.2,
             "share_new": 0.05}
        z = everyday.heat(f, self.cfg)
        expected = round(100 * (0.2 + 0.8 * 0.62) * (0.3 + 0.7 * 0.82) * 1.0 * 1.0 * 1.0 * (1 - 0.5 * 0.05), 1)
        self.assertEqual(z["heat"], expected)
        self.assertEqual(z["why"], ["62% of homes built before 1980", "mostly owner-occupied", "homes ~$150k",
                                    "5 mi from Fremont"])

    def test_cautions_lower_the_heat_and_show_as_reasons(self):
        base = {"share_old": 0.62, "basis": "census", "owners": 0.82, "med_value": 150000, "dist_mi": 5}
        good = everyday.heat(base, self.cfg)["heat"]
        z = everyday.heat({**base, "owners": 0.3, "share_new": 0.4, "share_sold": 0.1, "n_sold": 6,
                           "med_value": 700000}, self.cfg)
        self.assertLess(z["heat"], good)
        self.assertEqual(z["why"], ["62% of homes built before 1980", "mostly renters", "6 bought in the last 2 yrs",
                                    "40% built since 2010"])
        far = everyday.heat({**base, "dist_mi": 40}, self.cfg)
        self.assertAlmostEqual(far["heat"], good * 0.8, delta=0.15)             # both sides rounded to 0.1
        self.assertNotIn("40 mi from Fremont", far["why"])

    def test_census_decades_to_shares(self):
        row = dict(zip(["total"] + list(nbhd.YEAR_BINS), [100, 2, 8, 10, 10, 10, 20, 20, 10, 5, 5]))
        self.assertAlmostEqual(nbhd.year_shares(row, before=1980), 0.60)
        self.assertAlmostEqual(nbhd.year_shares(row, before=1985), 0.65)      # half of the 1980s
        self.assertAlmostEqual(nbhd.year_shares(row, since=2010), 0.10)
        self.assertAlmostEqual(nbhd.year_shares(row, since=2015), 0.06)
        self.assertIsNone(nbhd.year_shares(dict(row, total=0), before=1980))


class Ranking(Base):
    def setUp(self):
        super().setUp()
        c = self.conn
        add_bg(c, "A", "Fremont, NE center [1-1]", 41.44, -96.50, 600, 0.83, 1958, 140000, bins(600, 372, 18))
        add_bg(c, "B", "Fremont, NE NE [1-2]", 41.46, -96.47, 500, 0.85, 2012, 260000, bins(500, 25, 350))
        add_bg(c, "C", "Fremont, NE SW [1-3]", 41.42, -96.52, 500, 0.35, 1965, 120000, bins(500, 275, 10))
        add_bg(c, "D", "Schuyler, NE center [2-1]", 41.45, -97.40, 500, 0.85, 1950, 140000, bins(500, 400, 5))
        add_bg(c, "E", "Rural near Ames, NE [3-1]", 41.40, -96.45, 400, 0.90, 1950, 150000, bins(400, 350, 5))
        add_bg(c, "F", "Fremont, NE E [1-4]", 41.43, -96.49, 80, 0.90, 1950, 150000, bins(80, 70, 0))

    def test_old_owner_areas_rank_first(self):
        got = everyday.areas(self.conn, self.cfg)
        self.assertEqual([a["geoid"] for a in got], ["A", "C", "B"])     # D too far, E rural, F too few homes
        self.assertEqual(got[0]["why"][:2], ["62% of homes built before 1980", "mostly owner-occupied"])
        self.assertIn("mostly renters", got[1]["why"])
        self.assertIn("70% built since 2010", got[2]["why"])
        wide = [a["geoid"] for a in everyday.areas(self.conn, self.cfg, radius_mi=60)]
        self.assertIn("D", wide)


class FakeFetcher:
    """Census summary files by table name; anything else is a 404. `offline`/`s` like the real Fetcher."""

    def __init__(self, tables, offline=False):
        self.tables, self.offline, self.s = tables, offline, object()

    def get(self, url, ttl=None, cache=True):
        for t, txt in self.tables.items():
            if url.endswith(f"-{t}.dat") and "2024" in url:
                return txt.encode()
        raise RuntimeError("404 " + url)


ACS = {"b25001": f"GEO_ID|B25001_E001\n1500000US{BG}|400\n",
       "b25003": f"GEO_ID|B25003_E001|B25003_E002|B25003_E003\n1500000US{BG}|380|300|80\n",
       "b25035": f"GEO_ID|B25035_E001\n1500000US{BG}|1958\n",
       "b25077": f"GEO_ID|B25077_E001\n1500000US{BG}|150000\n"}
B25034 = ("GEO_ID|" + "|".join(f"B25034_E{k:03d}" for k in range(1, 12)) + "\n"
          f"1500000US{BG}|400|0|12|20|40|60|90|90|48|20|20\n"
          f"8600000US{BG}|1|1|1|1|1|1|1|1|1|1|1\n")          # another geography level: ignored


class MissingYearBuilt(Base):
    def setUp(self):
        super().setUp()
        self.conn.execute("INSERT INTO bgs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                          (BG, "NE", "053", "964000", "3", 41.45, -96.55, 2.0, 3.0, -96.60, 41.40, -96.50, 41.50,
                           json.dumps([RING]), "p", "Testville, NE center [9640-3]"))
        self.conn.commit()

    def test_missing_table_falls_back_to_median_year(self):
        n, v = nbhd.load_acs(self.conn, FakeFetcher(ACS), self.cfg, log=QUIET)
        self.assertEqual((n, v), (1, "2024"))                             # housing still loads without B25034
        self.assertIsNone(self.conn.execute("SELECT 1 FROM acs_year_built").fetchone())
        self.assertEqual(db.get_meta(self.conn, "acs_year_built")["rows"], 0)
        a = everyday.areas(self.conn, self.cfg)[0]
        self.assertEqual((a["basis"], a["parts"]["basis"]), (None, "median"))
        self.assertEqual(a["why"][0], "median home built 1958")
        self.assertGreater(a["heat"], 0)

    def test_table_loads_and_retry_waits(self):
        nbhd.load_acs(self.conn, FakeFetcher(ACS), self.cfg, log=QUIET)
        full = FakeFetcher(dict(ACS, b25034=B25034))
        self.assertEqual(nbhd.ensure_year_built(self.conn, full, self.cfg, log=QUIET), 0)   # tried just now
        self.assertEqual(nbhd.ensure_year_built(self.conn, FakeFetcher(ACS, offline=True), self.cfg, log=QUIET), 0)
        db.set_meta(self.conn, "acs_year_built", {"tried_utc": iso(datetime.now(timezone.utc) - timedelta(days=8)),
                                                  "vintage": "2024", "rows": 0})
        self.assertEqual(nbhd.ensure_year_built(self.conn, full, self.cfg, log=QUIET), 1)
        a = everyday.areas(self.conn, self.cfg)[0]
        self.assertEqual(a["basis"], "census")
        self.assertEqual(a["why"][0], "67% of homes built before 1980")
        self.assertAlmostEqual(a["share_old"], (90 + 90 + 48 + 20 + 20) / 400)


def town_parcels(conn, today):
    """30 homes inside the L-shaped neighborhood (20 old, 5 new, 5 unknown year; 5 bought recently) + 1 outside."""
    rows = []
    sold = (today - timedelta(days=100)).isoformat()
    for k in range(31):
        year = 1950 + k if k < 20 else (2012 if k < 25 else None)
        lat, lon = (41.45 + k * 0.0004, -96.55) if k < 30 else (41.48, -96.52)
        rows.append((f"P{k}", "053", f"{k}", 100 * (k + 1), "OAK ST", "", f"{100 * (k + 1)} Oak St", "Testville", "68025",
                     lat, lon, "single", 0, year, 1400, 110000, 150000, "", "", sold if k < 5 else "2001-05-01", "", "",
                     0.2, "t", "2026-09-01T00:00:00Z"))
    conn.executemany("INSERT INTO parcels VALUES (" + ",".join("?" * 25) + ")", rows)
    conn.commit()


class Town(Base):
    def setUp(self):
        super().setUp()
        self.today = datetime.now(__import__("zoneinfo").ZoneInfo(self.cfg["timezone"])).date()
        self.conn.execute("INSERT INTO places (geoid,name,state,lat,lon,pop,aland_sqmi,dist_mi,hu) VALUES "
                          "('3104000','Testville','NE',41.45,-96.55,900,1.0,5,400)")
        add_bg(self.conn, BG, "Testville, NE center [9640-3]", 41.45, -96.55, 400, 300 / 380, 1958, 150000,
               bins(400, 268, 12), ring=RING)
        town_parcels(self.conn, self.today)

    def area(self):
        return everyday.areas(self.conn, self.cfg, "Testville", 5)[0]

    def test_list_uses_each_house_year_and_flags_new_owners(self):
        res = everyday.make_list(self.conn, self.cfg, self.area(), log=QUIET)
        self.assertEqual(len(res["houses"]), 30)                        # the house outside the L is left out
        self.assertEqual(res["list_id"], f"everyday_Testville_{BG}")
        z = self.conn.execute("SELECT * FROM door_list_turfs WHERE list_id=?", (res["list_id"],)).fetchall()
        self.assertEqual(len(z), len(res["turfs"]))
        parts = json.loads(z[0]["parts"])
        self.assertEqual((parts["basis"], parts["share_old"], parts["share_new"], parts["sold_recent"]),
                         ("parcels", 0.8, 0.2, 5))                     # 20 of 25 known years before 1980
        own = 0.3 + 0.7 * round(round(400 * 0.95) * 300 / 380) / round(400 * 0.95)
        expected = round(100 * (0.2 + 0.8 * 0.8) * own * 1.0 * 1.0 * (1 - 0.3 * 5 / 30) * (1 - 0.5 * 0.2), 1)
        self.assertEqual(z[0]["heat"], expected)
        self.assertEqual(json.loads(z[0]["why"]), ["80% of homes built before 1980", "mostly owner-occupied",
                                                   "5 bought in the last 2 yrs", "20% built since 2010"])
        flags = {h["pid"]: h["flags"] for h in res["houses"]}
        self.assertTrue(flags["P0"].startswith("New owner (bought "))
        self.assertEqual((flags["P20"], flags["P25"]), ("Newer home", "Year unknown"))
        scores = {h["pid"]: h["score"] for h in res["houses"]}
        self.assertGreater(scores["P10"], scores["P20"])               # 1960 house beats a 2012 house
        self.assertGreater(scores["P10"], scores["P0"])                # ...and a just-bought one
        with open(res["paths"]["csv"]) as f:
            head = next(csv.reader(f))
        self.assertIn("Value ($)", head)
        self.assertNotIn("Hail at house (in)", head)
        self.assertTrue(os.path.exists(res["paths"]["png"]))
        self.assertIsNone(self.conn.execute("SELECT 1 FROM door_lists").fetchone())    # storm lists untouched

    def test_hud_adds_everyday_lists_and_keeps_every_old_key(self):
        day = (date.today() - timedelta(days=10)).isoformat()          # a storm list alongside
        arr = np.full((60, 60), round(1.6 * 25.4 * 10), np.uint16)
        meta = {"lat0": 41.6, "lon0": -96.7, "dlat": 0.01, "dlon": 0.01, "shape": [60, 60], "complete": True}
        with open(mrms.grid_path(self.cfg, day), "wb") as f:
            np.savez_compressed(f, mesh=arr, meta=json.dumps(meta))
        _, d0 = hud.write(self.conn, self.cfg)
        self.assertEqual(d0["everyday_lists"], [])
        storm = doors.make_list(self.conn, self.cfg, day, "Testville", None, log=QUIET)
        ev = everyday.make_list(self.conn, self.cfg, self.area(), log=QUIET)
        path, d = hud.write(self.conn, self.cfg)
        with open(path) as f:
            on_disk = json.load(f)
        self.assertTrue(OLD_HUD_KEYS <= set(on_disk))
        self.assertEqual([L["id"] for L in on_disk["lists"]], [storm["list_id"]])       # no everyday list in `lists`
        self.assertEqual(set(on_disk["lists"][0]), LIST_KEYS)                          # storm lists unchanged
        E = on_disk["everyday_lists"][0]
        self.assertTrue(LIST_KEYS <= set(E))
        self.assertEqual((E["id"], E["kind"], E["geoid"], E["day"]), (ev["list_id"], "everyday", BG,
                                                                       self.today.isoformat()))
        self.assertEqual((E["heat"], E["why"]), (ev["heat"], ev["why"]))
        t = E["turfs"][0]
        self.assertTrue({"turf", "doors", "avg_hail", "value", "heat", "why", "exp_inspections"} <= set(t))
        self.assertIsNone(t["avg_hail"])
        self.assertEqual(set(E["stops"][0]), set(on_disk["lists"][0]["stops"][0]))     # same stop shape
        self.assertEqual({(s["hail"], s["sold_after_storm"]) for s in E["stops"]}, {(None, False)})
        self.assertIsNotNone(on_disk["lists"][0]["turfs"][0]["avg_hail"])              # storm walks still have hail

    def test_cli_command(self):
        cfgp = os.path.join(self.tmp, "config.json")
        with open(cfgp, "w") as f:
            json.dump({"paths": self.cfg["paths"]}, f)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            rc = hh.main(["--config", cfgp, "--offline", "everyday", "--near", "Testville", "--radius", "5",
                          "--lists", "1"])
        self.assertEqual(rc, 0)
        self.assertIn("Old-house neighborhoods", out.getvalue())
        self.assertIn("67% of homes built before 1980", out.getvalue())    # the neighborhood (Census)
        self.assertIn("80% of homes built before 1980", out.getvalue())    # the list (each house's year)
        n = self.conn.execute("SELECT n_doors FROM everyday_lists").fetchone()[0]
        self.assertEqual(n, 30)


class FreshDatabase(Base):
    """refresh() on a brand-new database (the cloud always starts empty), network pieces stubbed out."""

    def _refresh(self, fetcher, everyday_error=None):
        def fake_places(conn, f, cfg, log=print):
            conn.execute("INSERT INTO places (geoid,name,state,lat,lon,pop,aland_sqmi,dist_mi,hu) VALUES "
                         "('3104000','Testville','NE',41.45,-96.55,900,1.0,5,400)")
            conn.commit()

        def fake_bgs(conn, f, cfg, log=print):
            conn.execute("INSERT INTO bgs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                         (BG, "NE", "053", "964000", "3", 41.45, -96.55, 2.0, 3.0, -96.60, 41.40, -96.50, 41.50,
                          json.dumps([RING]), "p", "Testville, NE center [9640-3]"))
            conn.commit()

        def fake_parcels(conn, session, bbox, max_age_days=180, budget_s=None, log=print):    # "downloads" homes
            if not conn.execute("SELECT 1 FROM parcels").fetchone():
                town_parcels(conn, date.today())
            return 1, 31

        patches = [mock.patch.object(places, "load", side_effect=fake_places),
                   mock.patch.object(nbhd, "load_bgs", side_effect=fake_bgs),
                   mock.patch.object(nbhd, "label_bgs"),
                   mock.patch.object(parcels, "ensure_area", side_effect=fake_parcels),
                   mock.patch.object(ingest, "run", return_value=(set(), {})),
                   mock.patch.object(wind, "ingest"),
                   mock.patch.object(mrms, "run", return_value=([], 0, [])),
                   mock.patch.object(hh, "pick_door_lists", return_value=[]),
                   mock.patch.object(commercial, "build", return_value=([], 0, 0)),
                   mock.patch.object(commercial, "write_csv")]
        if everyday_error:
            patches.append(mock.patch.object(everyday, "build_top", side_effect=everyday_error))
        with contextlib.ExitStack() as st:
            for p in patches:
                st.enter_context(p)
            return hh.refresh(self.conn, fetcher, self.cfg, log=QUIET)

    def test_fresh_database_builds_everyday_lists(self):
        summary = self._refresh(FakeFetcher(dict(ACS, b25034=B25034)))
        self.assertEqual(len(summary["everyday_lists"]), 1)
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM acs_year_built").fetchone()[0], 1)
        with open(summary["hud"]) as f:
            d = json.load(f)
        self.assertTrue(OLD_HUD_KEYS <= set(d))
        self.assertEqual(d["everyday_lists"][0]["turfs"][0]["why"][0], "80% of homes built before 1980")

    def test_fresh_database_without_year_built_table(self):
        summary = self._refresh(FakeFetcher(ACS))
        self.assertEqual(len(summary["everyday_lists"]), 1)           # parcels' own years carry the list
        self.assertIsNone(self.conn.execute("SELECT 1 FROM acs_year_built").fetchone())

    def test_everyday_failure_never_stops_refresh(self):
        summary = self._refresh(FakeFetcher(ACS), everyday_error=RuntimeError("boom"))
        self.assertEqual(summary["everyday_lists"], [])
        self.assertTrue(os.path.exists(summary["hud"]))


if __name__ == "__main__":
    unittest.main()
