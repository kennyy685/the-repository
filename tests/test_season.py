"""Path step 4 (`hh.py season`, season.py): this season's real hail + Census likely-insured signals for the open map.
Offline: fixtures are small hand-made copies of the real sources' formats."""
import copy
import io
import json
import os
import re
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import date, datetime, timezone

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from hailhunter import season  # noqa: E402
from hailhunter.config import DEFAULTS  # noqa: E402

TZ = "America/Chicago"
SC = season.scfg({})

LSR = {"type": "FeatureCollection", "features": [
    # Fremont storm, storm day 2026-09-14 (evening, CDT)
    {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-96.50, 41.46]},
     "properties": {"typetext": "HAIL", "magnitude": "1.75", "valid": "2026-09-14T23:12:00Z", "city": "2 N Fremont",
                    "county": "Dodge", "st": "NE", "source": "Trained Spotter", "remark": "John Smith's roof"}},
    {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-96.47, 41.44]},
     "properties": {"typetext": "HAIL", "magnitude": "1.25", "valid": "2026-09-14T23:18:00Z", "city": "Fremont",
                    "county": "Dodge", "st": "NE", "source": "Law Enforcement"}},
    # far away (Lincoln), same day -> own zone
    {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-96.70, 40.81]},
     "properties": {"typetext": "HAIL", "magnitude": "1.00", "valid": "2026-09-15T01:00:00Z", "city": "Lincoln",
                    "county": "Lancaster", "st": "NE", "source": "Public"}},
    # Iowa side, too small, and not hail: all dropped
    {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-95.85, 41.25]},
     "properties": {"typetext": "HAIL", "magnitude": "1.5", "valid": "2026-09-14T23:30:00Z", "city": "Council Bluffs",
                    "county": "Pottawattamie", "st": "IA", "source": "Public"}},
    {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-96.49, 41.45]},
     "properties": {"typetext": "HAIL", "magnitude": "0.50", "valid": "2026-09-14T23:20:00Z", "city": "Fremont",
                    "county": "Dodge", "st": "NE", "source": "Public"}},
    {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-96.49, 41.45]},
     "properties": {"typetext": "TSTM WND DMG", "magnitude": "60", "valid": "2026-09-14T23:20:00Z", "city": "Fremont",
                    "county": "Dodge", "st": "NE", "source": "Public"}},
]}

# SPC: 2312 UTC = the first Fremont report (same hail); 0130 UTC next day = a new report (Valley); Iowa + tiny dropped
SPC = ("Time,Size,Location,County,State,Lat,Lon,Comments\n"
       "2312,175,2 N Fremont,Dodge,NE,41.46,-96.50,golf ball hail. (OAX)\n"
       "0130,150,Valley,Douglas,NE,41.31,-96.35,Bob Jones called it in. (OAX)\n"
       "2330,150,Council Bluffs,Pottawattamie,IA,41.25,-95.85,(OAX)\n"
       "2340,50,Fremont,Dodge,NE,41.45,-96.49,(OAX)\n")


def bg(lat, lon, homes=1000, owner=700, occ=950, mt=700, mw=500):
    return {"geoid": f"31{lat}{lon}", "lat": lat, "lon": lon, "homes": homes, "occupied": occ, "owner": owner,
            "mort_total": mt, "mort_with": mw, "med_year": 1975, "built_total": homes,
            **{c: homes // 10 for c in season.YEAR_COLS}, "own_total": owner, "own_recent1": 70, "own_recent2": 70}


CENSUS = {"vintage": "2024", "bgs": [bg(41.45, -96.49), bg(41.44, -96.47), bg(40.81, -96.70, owner=400, occ=900)],
          "places": [dict(bg(41.44, -96.49, homes=11000, owner=6500, occ=10500), geoid="3117670", name="Fremont",
                          sqmi=12.0),
                     dict(bg(41.31, -96.35, homes=1200, owner=900, occ=1150), geoid="3150020", name="Valley", sqmi=3.0),
                     dict(bg(42.5, -97.0, homes=100, owner=80, occ=90), geoid="3199999", name="Tiny", sqmi=0.3)]}


def mesh_grid(hot=None):
    """A fake MRMS grid over part of the bbox: 0.01 deg cells, inches. `hot` = [(lat, lon, inches)] 3x3 blobs."""
    meta = {"lat0": 41.8, "lon0": -97.0, "dlat": 0.01, "dlon": 0.01}
    arr = np.zeros((120, 120), dtype=np.float32)
    for lat, lon, v in hot or []:
        i, j = int(round((meta["lat0"] - lat) / 0.01)), int(round((lon - meta["lon0"]) / 0.01))
        arr[i - 1:i + 2, j - 1:j + 2] = v
    return arr, meta


def cfg_for(tmp):
    cfg = copy.deepcopy(DEFAULTS)
    cfg["paths"] = {k: os.path.join(tmp, os.path.basename(v)) for k, v in cfg["paths"].items()}
    cfg["season"] = {"mesh": False}
    return cfg


def lsr_reports():
    from hailhunter.sources import lsr
    obs = lsr.parse(json.dumps(LSR).encode(), DEFAULTS)
    keep = [o for o in obs if o.state in SC["states"] and season.in_area(o.lat, o.lon, SC)
            and o.size_in >= SC["min_size_in"]]
    return [season.report_from_obs(o, "lsr", TZ) for o in keep]


class Reports(unittest.TestCase):
    def test_spc_parse(self):
        rs = season.parse_spc(SPC, date(2026, 9, 14), SC, TZ)
        self.assertEqual(len(rs), 2)                              # Iowa + 0.5 in dropped
        a, b = rs
        self.assertEqual((a["utc"], a["size_in"], a["place"], a["date"]), ("2026-09-14T23:12:00Z", 1.75, "Fremont",
                                                                           "2026-09-14"))
        self.assertEqual(b["utc"], "2026-09-15T01:30:00Z")        # before 12Z = the next UTC day, same storm day
        self.assertEqual((b["date"], b["date_local"], b["time_local"]), ("2026-09-14", "2026-09-14", "8:30 PM"))
        self.assertNotIn("Bob Jones", json.dumps(rs))              # free-text comments never kept

    def test_lsr_filters_and_no_remarks(self):
        rs = lsr_reports()
        self.assertEqual(len(rs), 3)
        self.assertEqual({r["state"] for r in rs}, {"NE"})
        self.assertNotIn("John Smith", json.dumps(rs))
        self.assertEqual(rs[0]["place"], "Fremont")               # "2 N Fremont" -> Fremont
        self.assertEqual(rs[0]["time_local"], "6:12 PM")

    def test_merge_adds_source_not_duplicate(self):
        rs = season.merge_reports(lsr_reports(), season.parse_spc(SPC, date(2026, 9, 14), SC, TZ), SC)
        self.assertEqual(len(rs), 4)                               # 3 LSR + Valley
        fr = next(r for r in rs if r["size_in"] == 1.75)
        self.assertEqual(fr["sources"], ["lsr", "spc"])
        self.assertEqual([r["id"] for r in rs], ["r1", "r2", "r3", "r4"])
        self.assertEqual(next(r for r in rs if r["place"] == "Valley")["sources"], ["spc"])

    def test_cluster_does_not_chain(self):
        mk = lambda lat, s: {"date": "2026-06-01", "lat": lat, "lon": -96.5, "size_in": s, "utc": "2026-06-01T20:00:00Z"}
        # 0.08 deg ~ 8.9 km steps: each within 10 km of its neighbour (chaining would make 1 zone), ends 26 km apart
        groups = season.cluster([mk(41.0, 2.0), mk(41.08, 1.0), mk(41.16, 1.0), mk(41.24, 1.0)], SC)
        self.assertEqual([[r["lat"] for r in g] for g in groups], [[41.0, 41.08], [41.16, 41.24]])


class Signals(unittest.TestCase):
    def test_shares_and_likely_insured(self):
        s = season.signals([bg(41.0, -96.0), bg(41.01, -96.0)], "2024", SC)
        self.assertEqual(s["owner_homes"], 1400)
        self.assertAlmostEqual(s["owner_share"], round(700 / 950, 3))
        self.assertAlmostEqual(s["mortgage_share"], round(500 / 700, 3))
        self.assertAlmostEqual(s["recent_buyer_share"], 0.2)
        self.assertEqual(s["recent_buyer_since"], 2020)
        self.assertAlmostEqual(s["built_before_2000_share"], 0.7)
        li = s["likely_insured"]
        self.assertEqual(li["score"], round(100 * (700 / 950) * (0.75 + 0.25 * (500 / 700))))
        self.assertEqual(li["level"], "high")                         # 68 >= 60
        self.assertEqual(li["label"], {"en": "Likely insured: high", "es": "Probablemente asegurado: alto"})
        self.assertIn("ACS 2020-2024", s["source"])

    def test_no_data_no_numbers(self):
        s = season.signals([{"lat": 41, "lon": -96, "homes": 10}], "2024", SC)   # no tenure/mortgage columns
        for k in ("owner_share", "mortgage_share", "recent_buyer_share", "built_before_2000_share", "likely_insured"):
            self.assertIsNone(s[k], k)
        self.assertIsNone(season.signals([], None, SC)["source"])


class Doc(unittest.TestCase):
    def build(self, meshes=None):
        rs = season.merge_reports(lsr_reports(), season.parse_spc(SPC, date(2026, 9, 14), SC, TZ), SC)
        radar = {"2026-09-14": [(41.455, -96.49, 1.5), (40.0, -99.0, 2.0)]}
        return season.build_doc(rs, radar, meshes or {"2026-09-14": None}, CENSUS, CENSUS["places"],
                                date(2026, 9, 28), SC, now=datetime(2026, 9, 28, 12, tzinfo=timezone.utc))

    def test_zones_ranked_and_explained(self):
        d = self.build()
        zs = d["zones"]
        self.assertEqual([z["rank"] for z in zs], list(range(1, len(zs) + 1)))
        self.assertEqual([z["score"] for z in zs], sorted((z["score"] for z in zs), reverse=True))
        top = zs[0]
        self.assertEqual(top["id"], "2026-09-14~fremont")
        self.assertEqual((top["kind"], top["hail_in"], top["reports"], top["days_ago"]), ("ground", 1.75, 2, 14))
        self.assertEqual(top["sources"], ["lsr", "spc", "radar"])
        self.assertEqual(top["radar_cells"], 1)
        self.assertEqual(top["near_town"], "Fremont")
        self.assertEqual(top["signals"]["owner_homes"], 1400)       # the 2 Fremont block groups, not Lincoln's
        self.assertEqual(set(top["score_parts"]), {"size", "agree", "recent", "homes"})
        self.assertTrue(top["outline"] and top["outline"][0] == top["outline"][-1])
        for z in zs:
            self.assertTrue(z["why"] and all(set(w[1]) == {"en", "es"} for w in z["why"]))
        self.assertEqual(d["storm_days"][0]["zones"], [z["id"] for z in zs if z["date"] == "2026-09-14"])

    def test_areas(self):
        d = self.build()
        names = [a["name"] for a in d["areas"]]
        self.assertEqual(names, ["Fremont", "Valley"])               # Tiny (100 homes) left out
        fr = d["areas"][0]
        self.assertEqual(fr["hail"]["last_date"], "2026-09-14")
        self.assertEqual(fr["hail"]["max_in"], 1.75)
        self.assertEqual(fr["signals"]["likely_insured"]["level"], "medium")

    def test_radar_only_zone(self):
        grid = mesh_grid([(41.45, -96.49, 1.6),                     # under the Fremont ground zone: not a new zone
                          (41.70, -96.90, 2.2)])                    # nobody reported here
        d = self.build({"2026-09-14": grid})
        radar = [z for z in d["zones"] if z["kind"] == "radar"]
        self.assertEqual(len(radar), 1)
        z = radar[0]
        self.assertEqual((z["hail_in"], z["hail_basis"], z["reports"], z["mesh_in"]), (2.2, "radar", 0, 2.2))
        self.assertEqual(z["sources"], ["mrms"])
        self.assertIn("Radar only", z["why"][0][1]["en"])
        fr = next(x for x in d["zones"] if x["id"] == "2026-09-14~fremont")
        self.assertEqual(fr["mesh_in"], 1.6)
        self.assertIn("mrms", fr["sources"])
        self.assertEqual(d["storm_days"][0]["mesh_max_in"], 2.2)

    def test_legal_words_and_no_names(self):
        d = self.build()
        text = json.dumps(d, ensure_ascii=False)
        # "insured"/"asegurado" only ever as "likely insured"/"probablemente asegurado" (Path step 4 rule)
        self.assertFalse(re.search(r"(?<!likely )(?<!Likely )insured", text.replace("likely_insured", "")))
        self.assertFalse(re.search(r"(?<![Pp]robablemente )asegurado", text))
        for bad in ("owner_name", "John Smith", "Bob Jones", "remark"):
            self.assertNotIn(bad, text)
        self.assertTrue(d["real"])
        self.assertEqual(d["season"], 2026)


class FakeFetcher:
    offline = False

    def __init__(self, routes):
        self.routes = routes
        self.urls = []

    def get(self, url, ttl=None, cache=True):
        self.urls.append(url)
        for k, v in self.routes.items():
            if k in url:
                return v
        raise ConnectionError(url)


class Run(unittest.TestCase):
    def test_run_survives_missing_sources(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = FakeFetcher({"lsr.geojson": json.dumps(LSR).encode(), "260914_rpts_hail": SPC.encode()})
            d = season.run(f, cfg_for(tmp), year=2026, today=date(2026, 9, 28), log=lambda *a: None)
            self.assertEqual(len(d["reports"]), 4)
            parts = {e["part"].split()[0] for e in d["errors"]}
            self.assertEqual(parts, {"ncei", "radar", "census"})       # each failed alone; the rest shipped
            self.assertTrue(d["zones"])
            self.assertIn("ets=2026-09-29T00:00Z", f.urls[0])            # stable URL per day (cache works offline)
            p = os.path.join(tmp, "storms.json")
            self.assertGreater(season.write(d, p), 100)
            with open(p, encoding="utf-8") as fh:
                self.assertEqual(json.load(fh)["season"], 2026)

    def test_census_cache_reused(self):
        with tempfile.TemporaryDirectory() as tmp:
            cfg = cfg_for(tmp)
            os.makedirs(cfg["paths"]["cache"])
            doc = dict(CENSUS, fetched_utc=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
            with open(os.path.join(cfg["paths"]["cache"], "season_census.json"), "w") as fh:
                json.dump(doc, fh)
            f = FakeFetcher({})
            self.assertEqual(season.census_cached(f, cfg, SC)["vintage"], "2024")
            self.assertEqual(f.urls, [])                                  # fresh copy: no download

    def test_cli_has_season(self):
        import hh
        with tempfile.TemporaryDirectory() as tmp, redirect_stdout(io.StringIO()):
            try:
                hh.main(["season", "--help"])
            except SystemExit as e:
                self.assertEqual(e.code, 0)


if __name__ == "__main__":
    unittest.main()
