"""The open map's walk + street tile for every pick (hailhunter/mapwalk.py, task map-west, 2026-09-29).
Fixture tests/fixtures/columbus_streets.json: REAL Columbus street centerlines (gis.ne.gov) + MOCK doors (made-up
house numbers on 22 St and 21 St, no owner names). Offline: the network is a fake session."""
import contextlib
import io
import json
import math
import os
import tempfile
import unittest
from unittest import mock

import hh
from hailhunter import basemap, mapwalk, night
from hailhunter import config as C

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, "fixtures", "columbus_streets.json")
HUD = os.path.join(HERE, "fixtures", "today_hud.json")
OPEN_MAP = os.path.join(HERE, "..", "docs", "design", "open-map")


def columbus():
    with open(FIX, encoding="utf-8") as f:
        d = json.load(f)
    stops = d["stops"]
    bm = basemap.build(d["feats"], [], basemap.walk_bbox(stops), None, basemap.street_bbox(stops))
    w = {"zone_id": "2026-08-08_Columbus~t3", "stops": stops, "basemap": bm}
    w["route_segments"], w["stop_side"] = basemap.walk_route(stops, bm)
    return d, w


class FakeResp:
    def __init__(self, d):
        self.d = d

    def raise_for_status(self):
        pass

    def json(self):
        return self.d


class FakeSession:
    """gis.ne.gov Street_Centerlines: the fixture's streets moved to wherever the query box is (a grid town anywhere);
    lots: none."""
    def __init__(self, feats, to=None):
        self.feats, self.calls = feats, []
        self.to = to            # (lon, lat) the fixture's middle moves to; None = the query box's middle

    def get(self, url, params=None, timeout=None):
        self.calls.append((url, params["geometry"]))
        if url != basemap.STREETS_URL:
            return FakeResp({"features": []})
        w, s, e, n = map(float, params["geometry"].split(","))
        # the fixture's middle -> the box's middle
        cx, cy = self.to or ((w + e) / 2, (s + n) / 2)
        dx, dy = cx - (-97.377), cy - 41.4372
        out = [{"attributes": f["attributes"], "geometry": {"paths": [[[x + dx, y + dy] for x, y in p]
                                                                     for p in f["geometry"]["paths"]]}}
               for f in self.feats]
        return FakeResp({"features": out})


class PageWalk(unittest.TestCase):
    def test_columbus_pick_walk_in_order_from_the_start_street(self):
        d, w = columbus()
        pw = mapwalk.page_walk(w, 1.64)
        self.assertIsNotNone(pw)
        self.assertEqual([s["n"] for s in pw["s"]], ["22 St", "21 St"])        # the Knock app's order, its names
        self.assertEqual([s["h"] for s in pw["s"]], [13, 12])                   # every door counted once
        self.assertEqual(pw["pn"][0], "22 St")                                   # the walk starts on the start street
        self.assertEqual({s["b"] for s in pw["s"]}, {1.5})                       # 1.64 in = the 1.5 band
        self.assertEqual(len(pw["c"]), 2)
        self.assertEqual(pw["c"][0], [])
        self.assertEqual(len(pw["r"]), 2)
        self.assertEqual(pw["park"], pw["s"][0]["p"][0])
        for s in pw["s"]:
            self.assertGreater(len(s["p"]), 1)
            self.assertTrue(s["f"] and s["t"], s)                                # corner to corner: named cross streets
            self.assertGreater(s["m"], 500)
        # the run follows its own street (every point is on a mapped street vertex)
        verts = {(round(x, 5), round(y, 5)) for st in w["basemap"]["streets"] for x, y in st["path"]}
        for s in pw["s"]:
            on = sum((x, y) in verts for x, y in s["p"]) / len(s["p"])
            self.assertGreater(on, 0.9, s["n"])

    def test_no_door_points_on_the_map(self):
        d, w = columbus()
        pw = mapwalk.page_walk(w, 1.64)
        kx, ky = basemap._proj(41.44)
        pts = [p for s in pw["s"] for p in s["p"]] + [p for c in pw["c"] + pw["r"] for p in c] + [pw["park"]]
        doors = [(float(s["lon"]), float(s["lat"])) for s in d["stops"]]
        snaps = [tuple(x["at"]) for x in w["stop_side"] if x]
        for p in pts:
            self.assertGreater(min(math.hypot((p[0] - q[0]) * kx, (p[1] - q[1]) * ky) for q in doors), 8, p)
            self.assertGreater(min(math.hypot((p[0] - q[0]) * kx, (p[1] - q[1]) * ky) for q in snaps), 0.5, p)
        text = json.dumps(pw)
        for s in d["stops"]:
            self.assertNotIn(s["address"].split()[0] + " ", text.replace('"', " "))   # no house numbers

    def test_no_basemap_no_walk(self):
        _, w = columbus()
        self.assertIsNone(mapwalk.page_walk({**w, "basemap": None}))
        self.assertIsNone(mapwalk.page_walk({**w, "stops": []}))


class Tiles(unittest.TestCase):
    def test_tile_matches_streets_json_encoding(self):
        d, w = columbus()
        box = mapwalk.tile_box(w)
        self.assertTrue(mapwalk.outside(box))                                   # Columbus: west of the map box
        t = mapwalk.tile(d["feats"], box)
        self.assertEqual(len(t["t"]), 4)
        self.assertEqual(t["s"], 50000)
        with open(os.path.join(OPEN_MAP, "data", "streets.json"), encoding="utf-8") as f:
            ref = json.load(f)
        self.assertEqual(ref["s"], t["s"])
        self.assertTrue(t["t"][3])                                              # local streets are there
        ox, oy = t["o"]
        for lines in t["t"]:
            for a in lines:
                self.assertEqual(len(a) % 2, 0)
                x, y = a[0], a[1]
                for i in range(2, len(a), 2):
                    x, y = x + a[i], y + a[i + 1]
                lon, lat = ox + x / t["s"], oy + y / t["s"]
                self.assertTrue(box[0] - 1e-4 <= lon <= box[2] + 1e-4 and box[1] - 1e-4 <= lat <= box[3] + 1e-4)

    def test_fremont_walk_needs_no_tile(self):
        self.assertFalse(mapwalk.outside([-96.51, 41.42, -96.47, 41.45]))


class BriefCarriesWalks(unittest.TestCase):
    """mapwalk.extra over a brief: the pick in Schuyler (outside the old box, not Columbus) gets its walk + a tile."""
    def setUp(self):
        with open(FIX, encoding="utf-8") as f:
            self.fix = json.load(f)

    def maker(self, to=(-97.059, 41.447)):
        s = FakeSession(self.fix["feats"], to)
        return basemap.Maker({}, None, s, log=lambda m: None), s

    def schuyler_walk(self):
        dx, dy = -97.059 - (-97.377), 41.447 - 41.4372          # the same street grid, moved to Schuyler
        return {"zone_id": "2026-08-08_Schuyler~t1",
                "stops": [{**s, "lon": s["lon"] + dx, "lat": s["lat"] + dy} for s in self.fix["stops"]]}

    def brief(self):
        card = {"zone_id": "2026-08-08_Schuyler~t1", "area_id": "z0808-schuyler", "hail_in": 1.25, "name": "Schuyler"}
        back = {"zone_id": "everyday_Omaha~t2", "area_id": None, "hail_in": None, "name": "Omaha"}
        return {"pick": card, "backup": back, "top": [card, back]}

    def test_pick_outside_the_old_box_gets_walk_and_tile(self):
        mk, sess = self.maker()
        out = mapwalk.extra(self.brief(), {"walks/2026-08-08_Schuyler~t1": self.schuyler_walk()}, mk)
        self.assertEqual(list(out["walks"]), ["z0808-schuyler"])
        wk = out["walks"]["z0808-schuyler"]
        self.assertEqual(wk["s"][0]["n"], "22 St")
        self.assertEqual({s["b"] for s in wk["s"]}, {1})
        self.assertEqual(len(out["tiles"]), 1)
        b = out["tiles"][0]["box"]
        self.assertTrue(b[0] < -97.059 < b[2] and b[1] < 41.447 < b[3])
        # second night: everything from the engine database, no network
        sess.calls.clear()
        mk.session = None
        again = mapwalk.extra(self.brief(), {"walks/2026-08-08_Schuyler~t1": self.schuyler_walk()}, mk)
        self.assertEqual(len(again["tiles"]), 1)
        self.assertEqual(again["walks"].keys(), out["walks"].keys())

    def test_offline_with_nothing_cached_is_quiet(self):
        mk = basemap.Maker({}, None, None, offline=True, log=lambda m: None)
        out = mapwalk.extra(self.brief(), {"walks/2026-08-08_Schuyler~t1": self.schuyler_walk()}, mk)
        self.assertEqual(out, {"walks": {}, "tiles": []})

    def test_every_pick_town_is_in_range(self):
        # FilthE's towns: every one gets a tile when outside the old box, and the rest are inside it
        towns = {"Columbus": (-97.368, 41.43), "Schuyler": (-97.059, 41.447), "David City": (-97.130, 41.253),
                 "Fremont": (-96.498, 41.433), "Blair": (-96.134, 41.544), "Wahoo": (-96.620, 41.211),
                 "Omaha": (-96.05, 41.26), "Lincoln": (-96.70, 40.81)}
        need = {t for t, (x, y) in towns.items() if mapwalk.outside(mapwalk.tile_box({"stops": [{"lon": x, "lat": y}]}))}
        self.assertEqual(need, {"Columbus", "Schuyler", "David City"})

    def test_night_command_puts_them_in_night_js(self):
        with open(HUD, encoding="utf-8") as f:
            hud = json.load(f)
        st = [s for l in hud["lists"] if str(l.get("id", "")).startswith("2026-09-10") for s in l.get("stops") or []
              if s.get("lat")]
        mk, _ = self.maker((sum(s["lon"] for s in st) / len(st), sum(s["lat"] for s in st) / len(st)))
        fake = lambda cfg, off: mk   # noqa: E731
        real_brief = night.brief

        def brief(*a, **k):          # the fixture's Sep 10 storm has no season area: give the pick one
            doc = real_brief(*a, **k)
            for c in [doc["pick"], *doc["top"]]:
                if c["zone_id"] == doc["pick"]["zone_id"]:
                    c["area_id"] = "z0910-fremont"
            return doc
        with tempfile.TemporaryDirectory() as t, mock.patch.object(hh, "_basemap_maker", fake), \
                mock.patch.object(night, "brief", brief), contextlib.redirect_stdout(io.StringIO()):
            js = os.path.join(t, "night.js")
            rc = hh.main(["night", "--no-refresh", "--hud", HUD, "--date", "2026-09-25", "--near", "41.43,-96.49",
                          "--out-dir", t, "--js-out", js])
            self.assertEqual(rc, 0)
            with open(js, encoding="utf-8") as f:
                text = f.read()
        d = night.from_js(text)
        self.assertTrue(d["map"]["walks"], "the Fremont pick's walk is in the brief")
        pick = d["pick"]
        self.assertEqual(list(d["map"]["walks"]), ["z0910-fremont"])
        self.assertEqual(d["map"]["walks"]["z0910-fremont"]["s"][0]["n"], pick["start"]["address"])   # "E 4th St"
        self.assertEqual(d["map"].get("tiles"), [])                              # Fremont: in the map's own streets
        self.assertLess(len(text), hh.NIGHT_JS_MAX)


class PageWeight(unittest.TestCase):
    """Hotel wifi: what the open map loads stays under budget, and the night file with 3 tiles stays small."""
    def test_page_weight_budget(self):
        with open(os.path.join(OPEN_MAP, "index.files.json"), encoding="utf-8") as f:
            man = json.load(f)
        root = os.path.join(HERE, "..")
        total = os.path.getsize(os.path.join(root, man["page"])) + sum(
            os.path.getsize(os.path.join(root, p)) for p in man["files"].values())
        self.assertLess(total, 3_600_000, f"open map weighs {total:,} bytes")

    def test_three_tiles_stay_light(self):
        d, w = columbus()
        t = mapwalk.tile(d["feats"], mapwalk.tile_box(w))
        pw = mapwalk.page_walk(w, 1.64)
        one = len(json.dumps(t, separators=(",", ":"))) + len(json.dumps(pw, separators=(",", ":")))
        self.assertLess(one, C.DEFAULTS["openmap"]["tile_max_kb"] * 1024)
        self.assertLess(3 * one + 20_000, hh.NIGHT_JS_MAX)


if __name__ == "__main__":
    unittest.main()
