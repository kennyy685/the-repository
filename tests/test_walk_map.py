"""Map polish for the HMP App's walk map (designer's v25 notes, 2026-09-27):
(1) zones/current: `walk_polygon` (outline of the walk's own stops, +25 m) next to `polygon` (the whole turf), plus
    `walk_center`, `homes_total` vs `walk_homes` (the Now map outlined 60 homes while the walk shows 25);
(2) `route_segments`: the walk along the streets from door to door (shortest street path; a straight hop with
    gap:true only when the data has no street path), streets fetched in a wider box than the lots;
(3) `stop_side`: the street each house is on, the point in front of it, and which side of the street it sits on.
Fixture tests/fixtures/basemap_columbus_t3.json = the real gis.ne.gov street centerlines (2026-09-27) around the
Columbus walk "22 St & 21 St" (2026-08-08_Columbus~t3) + its 25 stops in walking order. 39th Ave has no piece
between 22nd and 21st St there (one long block), so the hop 2252 39 Ave -> 3820 21 St has to go around by
Gruenther Dr instead of jumping across the backyards."""
import contextlib
import io
import json
import math
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import basemap, config as C, daily, zones  # noqa: E402
from tests.test_basemap import DAY, HUD, FakeSession  # noqa: E402

COL = os.path.join(HERE, "fixtures", "basemap_columbus_t3.json")
K = 110574.0                                                  # meters per degree of latitude


def _cfg(**basemap_kw):
    cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))
    if basemap_kw:
        cfg = dict(cfg, basemap=dict(cfg["basemap"], **basemap_kw))
    return cfg


def _m(a, b, lat0=41.4):
    return math.hypot((b[0] - a[0]) * K * math.cos(math.radians(lat0)), (b[1] - a[1]) * K)


def _to_line(p, a, b, lat0=41.4):
    """Meters from point p to segment a-b."""
    kx = K * math.cos(math.radians(lat0))
    dx, dy = (b[0] - a[0]) * kx, (b[1] - a[1]) * K
    px, py = (p[0] - a[0]) * kx, (p[1] - a[1]) * K
    L2 = dx * dx + dy * dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, (px * dx + py * dy) / L2))
    return math.hypot(px - t * dx, py - t * dy)


def _to_streets(p, bm):
    return min(_to_line(p, a, b) for s in bm["streets"] for a, b in zip(s["path"], s["path"][1:]))


def _inside(p, ring):
    x, y, inside = p[0], p[1], False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            inside = not inside
    return inside


def _street(name, path):
    """One ArcGIS street feature (the gis.ne.gov shape) for synthetic maps."""
    words = name.split()
    return {"attributes": {"PRE_DIR": None, "ST_NAME": " ".join(words[:-1]), "ST_TYPE": words[-1], "POS_DIR": None,
                           "ST_CLASS": "LOCAL", "SP_LIMIT": 25},
            "geometry": {"paths": [path]}}


class ColumbusRoute(unittest.TestCase):
    def setUp(self):
        with open(COL, encoding="utf-8") as f:
            fix = json.load(f)
        self.cfg = _cfg()
        self.stops = fix["stops"]
        self.bbox = basemap.walk_bbox(self.stops, self.cfg)
        self.sbox = basemap.street_bbox(self.stops, self.cfg)
        self.bm = basemap.build(fix["streets"]["features"], [], self.bbox, self.cfg, self.sbox)
        self.segs, self.sides = basemap.walk_route(self.stops, self.bm, self.cfg)

    def test_39th_ave_hop_walks_around_the_block(self):
        i = next(k for k, s in enumerate(self.stops) if s["address"] == "2252 39 Ave")
        self.assertEqual(self.stops[i + 1]["address"], "3820 21 St")
        hop = self.segs[i]
        self.assertEqual((hop["from"], hop["to"]), (i, i + 1))
        self.assertFalse(hop["gap"])                                   # was a jump across the backyards
        self.assertTrue(200 <= hop["m"] <= 330, hop["m"])              # 39th Ave -> 22nd St -> Gruenther Dr -> 21st
        for corner in ((-97.37470, 41.43765), (-97.37469, 41.43698)):  # Gruenther Dr at 22nd St and at 21st St
            self.assertLess(min(_m(corner, p) for p in hop["path"]), 3, corner)

    def test_every_hop_follows_the_streets(self):
        self.assertEqual(len(self.segs), len(self.stops) - 1)
        for k, hop in enumerate(self.segs):
            self.assertEqual((hop["from"], hop["to"]), (k, k + 1))
            self.assertFalse(hop["gap"], hop)
            self.assertEqual(hop["path"][0], self.sides[k]["at"])           # from the street in front of house k
            self.assertEqual(hop["path"][-1], self.sides[k + 1]["at"])      # ... to the one in front of house k+1
            for p in hop["path"]:
                self.assertLess(_to_streets(p, self.bm), 1.5, (k, p))       # on a street, never through a yard
            walked = sum(_m(a, b) for a, b in zip(hop["path"], hop["path"][1:]))
            self.assertLessEqual(abs(walked - hop["m"]), 2)

    def test_each_house_snaps_to_its_own_street_and_side(self):
        self.assertEqual(len(self.sides), len(self.stops))
        want = {"22 St": "22nd St", "21 St": "21st St", "39 Ave": "39th Ave"}
        for s, sd in zip(self.stops, self.sides):
            num, street = s["address"].split(" ", 1)
            self.assertEqual(sd["street"], want[street], s["address"])
            if street == "39 Ave":
                self.assertEqual(sd["side"], "W")                            # house west of 39th Ave
            else:                                                           # even numbers north, odd south here
                self.assertEqual(sd["side"], "N" if int(num) % 2 == 0 else "S", s["address"])
            self.assertTrue(15 <= sd["m"] <= 30, sd)                        # set back from the centerline
            self.assertLess(abs(_m(sd["at"], (s["lon"], s["lat"])) - sd["m"]), 1.0)
            self.assertLess(_to_streets(sd["at"], self.bm), 1.0)

    def test_streets_reach_past_the_lots_box_and_labels_stay_inside(self):
        w, s, e, n = self.bbox
        sw, ss, se, sn = self.sbox
        self.assertTrue(sw < w and ss < s and se > e and sn > n)
        self.assertEqual(self.bm["street_bbox"], list(self.sbox))
        xs = [p[0] for st in self.bm["streets"] for p in st["path"]]
        self.assertLess(min(xs), w)                                          # streets drawn beyond the lots box
        for lab in self.bm["labels"]:
            self.assertTrue(w - 1e-5 <= lab["at"][0] <= e + 1e-5 and s - 1e-5 <= lab["at"][1] <= n + 1e-5)


class SyntheticRoute(unittest.TestCase):
    """Small made-up grids (lat 41) for the edge cases."""

    def setUp(self):
        self.cfg = _cfg()

    def _route(self, feats, stops, cfg=None, street_box=True):
        cfg = cfg or self.cfg
        bbox = basemap.walk_bbox(stops, cfg)
        sbox = basemap.street_bbox(stops, cfg) if street_box else None
        bm = basemap.build(feats, [], bbox, cfg, sbox)
        return basemap.walk_route(stops, bm, cfg)

    def _block(self):
        """Two east-west streets 66 m apart, joined only by a street ~184 m east of the two back-to-back houses:
        outside the lots box (min 150 m each way), inside the street box (200 m)."""
        feats = [_street("A St", [[-97.004, 41.0], [-96.996, 41.0]]),
                 _street("B St", [[-97.004, 41.0006], [-96.996, 41.0006]]),
                 _street("C Ave", [[-96.9978, 41.0], [-96.9978, 41.0006]])]
        stops = [{"address": "10 A St", "lat": 41.00015, "lon": -97.0},
                 {"address": "11 B St", "lat": 41.00045, "lon": -97.0}]
        return feats, stops

    def test_wider_street_box_finds_the_corner(self):
        feats, stops = self._block()
        segs, sides = self._route(feats, stops)
        self.assertFalse(segs[0]["gap"])
        self.assertTrue(400 <= segs[0]["m"] <= 460, segs[0]["m"])           # east, north on C Ave, back west
        self.assertEqual([sd["side"] for sd in sides], ["N", "S"])
        old, _ = self._route(feats, stops, street_box=False)                # streets cut to the lots box (before)
        self.assertTrue(old[0]["gap"])

    def test_gap_is_a_straight_hop(self):
        feats, stops = self._block()
        segs, _ = self._route(feats[:2], stops)                             # no connecting street at all
        hop = segs[0]
        self.assertTrue(hop["gap"])
        self.assertEqual(len(hop["path"]), 2)
        self.assertAlmostEqual(hop["m"], _m(hop["path"][0], hop["path"][1], 41.0), delta=1)
        far, _ = self._route(feats, stops, cfg=_cfg(route_max_detour_m=100))   # the walk around is too long
        self.assertTrue(far[0]["gap"])

    def test_house_far_from_any_street(self):
        feats, stops = self._block()
        stops = stops + [{"address": "1 Farm Rd", "lat": 41.006, "lon": -97.0}]   # ~600 m north: no street near
        segs, sides = self._route(feats, stops)
        self.assertIsNone(sides[2])
        self.assertTrue(segs[1]["gap"])
        self.assertEqual(segs[1]["path"][-1], [-97.0, 41.006])              # the straight hop ends at the house

    def test_t_corner_the_data_did_not_split(self):
        feats = [_street("A St", [[-97.002, 41.0], [-96.998, 41.0]]),
                 _street("B Ave", [[-97.0, 41.00002], [-97.0, 41.001]])]      # stops ~2 m short of A St
        stops = [{"address": "5 B Ave", "lat": 41.0009, "lon": -96.9998},
                 {"address": "7 A St", "lat": 41.00015, "lon": -96.9985}]
        segs, _ = self._route(feats, stops)
        self.assertFalse(segs[0]["gap"])
        self.assertTrue(segs[0]["path"][1][0] == -97.0)                     # down B Ave first
        stuck, _ = self._route(feats, stops, cfg=_cfg(join_m=0))
        self.assertTrue(stuck[0]["gap"])

    def test_street_names_match_addresses(self):
        k = basemap.street_key
        self.assertTrue(basemap.same_street(k("22 St"), k("22nd St")))
        self.assertTrue(basemap.same_street(k("39 Ave"), k("39TH Avenue")))
        self.assertFalse(basemap.same_street(k("22 St"), k("22nd Ave")))
        self.assertTrue(basemap.same_street(k("Broad St"), k("N Broad St")))
        self.assertFalse(basemap.same_street(k("N 12th St"), k("S 12th St")))
        self.assertEqual(k("N St"), ("N", "ST", ""))                        # a lone letter is the name
        self.assertEqual(k("N M St"), ("M", "ST", "N"))
        self.assertEqual(k("Main St NW"), ("MAIN", "ST", "NW"))

    def test_no_basemap_no_route(self):
        self.assertEqual(basemap.walk_route([{"lat": 41.0, "lon": -97.0}], None, self.cfg), (None, None))
        _, stops = self._block()                                            # a map with no streets near the doors
        segs, sides = basemap.walk_route(stops, {"bbox": [-97.01, 40.99, -96.99, 41.01], "streets": []}, self.cfg)
        self.assertEqual([h["gap"] for h in segs], [True])
        self.assertEqual(sides, [None, None])


class MakerAndDaily(unittest.TestCase):
    def setUp(self):
        self.cfg = _cfg()
        with open(HUD, encoding="utf-8") as f:
            self.hud = json.load(f)

    def test_streets_are_fetched_in_the_wider_box(self):
        z = zones.zones(self.hud, DAY, cfg=self.cfg)
        walk = zones.walks(self.hud, z, DAY, cfg=self.cfg)["walks/2026-09-10_Fremont~t1"]
        sess = FakeSession()
        doc = basemap.Maker(self.cfg, basemap.open_cache(None), sess, log=lambda *_: None).add(dict(walk))
        streets_box = [float(v) for v in sess.calls[0][1]["geometry"].split(",")]
        lots_box = [float(v) for v in sess.calls[1][1]["geometry"].split(",")]
        self.assertEqual(streets_box, basemap.street_bbox(walk["stops"], self.cfg))
        self.assertEqual(lots_box, basemap.walk_bbox(walk["stops"], self.cfg))
        self.assertTrue(streets_box[0] < lots_box[0] and streets_box[2] > lots_box[2])
        self.assertEqual(len(doc["route_segments"]), len(walk["stops"]) - 1)
        self.assertEqual(len(doc["stop_side"]), len(walk["stops"]))
        off = basemap.Maker(self.cfg, basemap.open_cache(None), None, offline=True, log=lambda *_: None).add(dict(walk))
        self.assertEqual((off["basemap"], off["route_segments"], off["stop_side"]), (None, None, None))
        self.assertIsNotNone(off["route"])                                  # the plain door-to-door line stays

    def test_daily_walk_docs_get_the_street_route(self):
        m = basemap.Maker(self.cfg, basemap.open_cache(None), FakeSession(), log=lambda *_: None)
        with tempfile.TemporaryDirectory() as out:
            man = daily.run(self.cfg, out, DAY, self.hud, maker=m)
            self.assertEqual(man["errors"], [])
            for path, name in man["files"].items():
                if path.startswith("walks/") or path == "today/walk":
                    with open(os.path.join(out, name), encoding="utf-8") as f:
                        d = json.load(f)
                    self.assertEqual(len(d["stop_side"]), len(d["stops"]))
                    self.assertEqual(len(d["route_segments"]), max(len(d["stops"]) - 1, 0))
            daily.run(self.cfg, out, DAY, self.hud)                          # no maker: no map fields at all
            with open(os.path.join(out, "today__walk.json"), encoding="utf-8") as f:
                self.assertFalse({"route_segments", "stop_side"} & set(json.load(f)))


class ZoneWalkShape(unittest.TestCase):
    def setUp(self):
        self.cfg = _cfg()
        with open(HUD, encoding="utf-8") as f:
            self.hud = json.load(f)

    def test_walk_polygon_is_the_walks_own_stops(self):
        zd = zones.zones(self.hud, DAY, cfg=self.cfg, doors=12)
        w = zones.walks(self.hud, zd, DAY, doors=12, cfg=self.cfg)
        short = 0
        for z in zd["zones"]:
            stops = w[f"walks/{z['id']}"]["stops"]
            self.assertEqual(z["walk_homes"], len(stops))
            self.assertEqual(z["homes_total"], z["homes"])
            short += z["walk_homes"] < z["homes_total"]
            lat = sum(s["lat"] for s in stops) / len(stops)
            lon = sum(s["lon"] for s in stops) / len(stops)
            self.assertAlmostEqual(z["walk_center"]["lat"], lat, places=5)
            self.assertAlmostEqual(z["walk_center"]["lon"], lon, places=5)
            ring = z["walk_polygon"]
            self.assertEqual(ring[0], ring[-1])
            self.assertLessEqual(len(ring), self.cfg["zones"]["polygon_max_points"])
            for s in stops:                                                  # every door inside, with room around it
                p = (s["lon"], s["lat"])
                self.assertTrue(_inside(p, ring), s["address"])
                self.assertGreater(min(_to_line(p, a, b) for a, b in zip(ring, ring[1:])), 15)
        self.assertGreater(short, 0)                                          # Fremont t1: 12 of its 20 homes

    def test_walk_homes_follow_the_walk_size(self):
        for z in zones.zones(self.hud, DAY, cfg=self.cfg, doors=5)["zones"]:
            self.assertEqual(z["walk_homes"], min(5, z["homes_total"]))

    def test_buffered_hull(self):
        one = zones.buffered_hull([(-97.0, 41.0)], 25)
        self.assertEqual(one[0], one[-1])
        for p in one:
            self.assertAlmostEqual(_m(p, (-97.0, 41.0), 41.0), 25, delta=1.5)
        line = zones.buffered_hull([(-97.0, 41.0), (-96.999, 41.0)], 25)     # a one-street walk still gets an area
        self.assertTrue(_inside((-96.9995, 41.0), line))
        self.assertIsNone(zones.buffered_hull([], 25))

    def test_wind_zones_have_no_walk_shape(self):
        ev = {"day": DAY, "place": "Blair", "lat": 41.54, "lon": -96.13, "max_mph": 70, "wind_score": 60.0}
        zc = self.cfg["zones"]
        (z,) = zones.wind_zones({"wind_events": [ev]}, zones.date.fromisoformat(DAY),
                                {"name": "Fremont", "lat": 41.43, "lon": -96.49}, 60, 30, zc)
        self.assertEqual((z["walk_polygon"], z["walk_center"], z["homes_total"], z["walk_homes"]), (None,) * 4)

    def test_cli_zones_doors_sets_walk_homes(self):
        with tempfile.TemporaryDirectory() as t:
            cp, zp = os.path.join(t, "config.json"), os.path.join(t, "z.json")
            with open(cp, "w") as f:
                json.dump({"paths": {"db": os.path.join(t, "hh.db"), "cache": os.path.join(t, "cache"),
                                     "export": os.path.join(t, "export")}}, f)
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                rc = hh.main(["--config", cp, "--offline", "zones", "--hud", HUD, "--date", DAY, "--near",
                              "41.43,-96.49", "--doors", "5", "--out", zp])
            self.assertEqual(rc, 0)
            with open(zp, encoding="utf-8") as f:
                zs = json.load(f)["zones"]
            self.assertTrue(zs)
            for z in zs:
                self.assertEqual(z["walk_homes"], min(5, z["homes_total"]))


if __name__ == "__main__":
    unittest.main()
