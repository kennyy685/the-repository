"""Vector basemap for walk maps (basemap.py): streets + lots + labels from Nebraska state GIS, cached, size-capped.
Fixtures tests/fixtures/basemap_fremont_t1_*.json = the real gis.ne.gov answers (2026-09-26) for the Fremont walk
2026-09-10_Fremont~t1 of today_hud.json (one railroad right-of-way parcel removed to keep the file small)."""
import contextlib
import io
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import basemap, config as C, daily, zones  # noqa: E402

FIX = os.path.join(HERE, "fixtures")
HUD = os.path.join(HERE, "fixtures", "today_hud.json")
DAY = "2026-09-25"
WALK = "walks/2026-09-10_Fremont~t1"


def _load(name):
    with open(os.path.join(FIX, f"basemap_fremont_t1_{name}.json"), encoding="utf-8") as f:
        return json.load(f)


class _Resp:
    def __init__(self, d):
        self.d = d

    def raise_for_status(self):
        pass

    def json(self):
        return self.d


class FakeSession:
    """Answers the two gis.ne.gov layers from the recorded fixtures; counts calls."""

    def __init__(self, fail=False):
        self.calls, self.fail = [], fail

    def get(self, url, params=None, timeout=None):
        self.calls.append((url, dict(params or {})))
        if self.fail:
            raise ConnectionError("server down")
        return _Resp(_load("streets") if "Street_Centerlines" in url else _load("lots"))


class Base(unittest.TestCase):
    def setUp(self):
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))
        with open(HUD, encoding="utf-8") as f:
            self.hud = json.load(f)
        z = zones.zones(self.hud, DAY, cfg=self.cfg)
        self.walks = zones.walks(self.hud, z, DAY, cfg=self.cfg)
        self.walk = self.walks[WALK]
        self.bbox = basemap.walk_bbox(self.walk["stops"], self.cfg)


class Build(Base):
    def test_real_fremont_walk(self):
        doc = basemap.build(_load("streets")["features"], _load("lots")["features"], self.bbox, self.cfg)
        self.assertEqual(set(doc), {"bbox", "streets", "lots", "labels", "source", "kb"})
        names = {s["name"] for s in doc["streets"]}
        self.assertTrue({"N Broad St", "W 12th St", "W Linden Ave", "N H St"} <= names, names)
        self.assertEqual({s["cls"] for s in doc["streets"] if s["name"] == "N Broad St"}, {"major"})   # SECONDARY
        self.assertGreater(len(doc["lots"]), 100)
        self.assertLess(doc["kb"], 60)
        self.assertLess(len(json.dumps(doc, separators=(",", ":"))), 60 * 1024)
        w, s, e, n = self.bbox
        for st in doc["streets"]:                                     # clipped to the box, rounded to 5 decimals
            self.assertGreaterEqual(len(st["path"]), 2)
            for x, y in st["path"]:
                self.assertTrue(w - 1e-5 <= x <= e + 1e-5 and s - 1e-5 <= y <= n + 1e-5)
                self.assertEqual(round(x, 5), x)
        for ring in doc["lots"]:
            self.assertEqual(ring[0], ring[-1])
            self.assertGreaterEqual(len(ring), 4)
        texts = [lab["text"] for lab in doc["labels"]]
        self.assertEqual(len(texts), len(set(texts)))                 # one label per street
        self.assertIn("N Broad St", texts)
        for lab in doc["labels"]:
            self.assertTrue(-90 < lab["angle"] <= 90)
        broad = next(lab for lab in doc["labels"] if lab["text"] == "N Broad St")
        self.assertGreater(abs(broad["angle"]), 80)                   # a north-south street reads up the page
        w12 = next(lab for lab in doc["labels"] if lab["text"] == "W 12th St")
        self.assertLess(abs(w12["angle"]), 10)

    def test_same_street_pieces_are_joined(self):
        doc = basemap.build(_load("streets")["features"], [], self.bbox, self.cfg)
        raw = sum(1 for f in _load("streets")["features"] for _ in f["geometry"]["paths"])
        self.assertLess(len(doc["streets"]), raw)

    def test_right_of_way_strip_is_not_a_lot(self):
        w, s, e, n = self.bbox
        strip = {"geometry": {"rings": [[[w - 0.3, s], [e + 0.3, s], [e + 0.3, s + 0.0002], [w - 0.3, s + 0.0002],
                                         [w - 0.3, s]]]}}
        a = basemap.build([], _load("lots")["features"], self.bbox, self.cfg)
        b = basemap.build([], _load("lots")["features"] + [strip], self.bbox, self.cfg)
        self.assertEqual(a["lots"], b["lots"])

    def test_size_cap(self):
        cfg = dict(self.cfg, basemap=dict(self.cfg["basemap"], max_kb=12))
        full = basemap.build(_load("streets")["features"], _load("lots")["features"], self.bbox, self.cfg)
        small = basemap.build(_load("streets")["features"], _load("lots")["features"], self.bbox, cfg)
        self.assertLessEqual(small["kb"], 12)
        self.assertLess(len(small["lots"]), len(full["lots"]))
        self.assertTrue(small["streets"])                              # streets are kept before lots

    def test_names_and_classes(self):
        self.assertEqual(basemap.street_name({"PRE_DIR": "North", "ST_NAME": "NYE", "ST_TYPE": "Avenue"}), "N Nye Ave")
        self.assertEqual(basemap.street_name({"PRE_DIR": "West", "ST_NAME": "23RD", "ST_TYPE": "DRIVE"}), "W 23rd Dr")
        self.assertEqual(basemap.street_name({"PRE_DIR": "North", "ST_NAME": "M", "ST_TYPE": "Street"}), "N M St")
        self.assertEqual(basemap.street_name({"PRE_DIR": " ", "ST_NAME": "RANDOLPH", "ST_TYPE": "ST",
                                              "POS_DIR": " "}), "Randolph St")
        self.assertEqual(basemap.street_class({"ST_CLASS": "Minor Arterial"}, "N 84th St"), "minor")
        self.assertEqual(basemap.street_class({"ST_CLASS": "ALLEY"}, ""), "service")
        self.assertEqual(basemap.street_class({}, "US Hwy 30"), "hwy")
        self.assertEqual(basemap.street_class({"SP_LIMIT": 45}, "Military Ave"), "major")
        self.assertIsNone(basemap.street_class({"ST_CLASS": "NOT CONSTRUCTED"}, "Future Rd"))
        self.assertEqual(basemap.street_class({"ST_CLASS": None}, "Dale St"), "local")

    def test_geometry_helpers(self):
        line = [(-96.5, 41.44), (-96.4995, 41.44000001), (-96.499, 41.44)]
        self.assertEqual(basemap.simplify(line, 1.5, 41.44), [line[0], line[2]])
        pieces = basemap.clip_path([(0.0, 0.5), (2.0, 0.5)], (0.5, 0.0, 1.5, 1.0))
        self.assertEqual(pieces, [[(0.5, 0.5), (1.5, 0.5)]])
        self.assertEqual(basemap.clip_path([(0.0, 5.0), (1.0, 5.0)], (0.0, 0.0, 1.0, 1.0)), [])
        self.assertEqual(basemap.join_paths([[[0, 0], [1, 0]], [[2, 0], [1, 0]]]), [[[0, 0], [1, 0], [2, 0]]])


class MakerTests(Base):
    def test_fetch_then_cache_then_offline(self):
        conn = basemap.open_cache(None)
        sess = FakeSession()
        m = basemap.Maker(self.cfg, conn, sess, log=lambda *_: None)
        doc = m.add(dict(self.walk))
        self.assertEqual(len(sess.calls), 2)
        self.assertEqual(sess.calls[0][1]["outFields"], basemap.STREET_FIELDS)
        self.assertEqual(sess.calls[1][1]["outFields"], "OBJECTID")    # lots: outline only, nothing personal
        self.assertEqual(doc["route"][0], [self.walk["stops"][0]["lon"], self.walk["stops"][0]["lat"]])
        self.assertEqual(len(doc["route"]), len(self.walk["stops"]))
        self.assertTrue(doc["basemap"]["streets"])
        self.assertEqual(m.stats["fetched"], 1)
        again = basemap.Maker(self.cfg, conn, None, offline=True, log=lambda *_: None).add(dict(self.walk))
        self.assertEqual(again["basemap"], doc["basemap"])              # cached: no network needed
        sess2 = FakeSession()
        basemap.Maker(self.cfg, conn, sess2, log=lambda *_: None).add(dict(self.walk))
        self.assertEqual(sess2.calls, [])                               # fresh cache row: not downloaded again

    def test_missing_data_means_null_never_an_error(self):
        off = basemap.Maker(self.cfg, basemap.open_cache(None), None, offline=True, log=lambda *_: None)
        doc = off.add(dict(self.walk))
        self.assertIsNone(doc["basemap"])
        self.assertIsNotNone(doc["route"])
        down = basemap.Maker(self.cfg, basemap.open_cache(None), FakeSession(fail=True), log=lambda *_: None)
        self.assertIsNone(down.add(dict(self.walk))["basemap"])
        self.assertEqual(down.stats["errors"], 1)
        empty = basemap.Maker(self.cfg, None, FakeSession(), log=lambda *_: None).add({"stops": []})
        self.assertEqual((empty["route"], empty["basemap"]), (None, None))

    def test_time_guard_stops_downloads(self):
        t = [0.0]
        sess = FakeSession()
        m = basemap.Maker(self.cfg, basemap.open_cache(None), sess, log=lambda *_: None, clock=lambda: t[0])
        t[0] = self.cfg["basemap"]["budget_s"] + 1
        self.assertIsNone(m.add(dict(self.walk))["basemap"])
        self.assertEqual(sess.calls, [])
        self.assertIn("basemap", m.rb.skipped)

    def test_disabled_in_config(self):
        cfg = dict(self.cfg, basemap=dict(self.cfg["basemap"], enabled=False))
        sess = FakeSession()
        doc = basemap.Maker(cfg, None, sess, log=lambda *_: None).add(dict(self.walk))
        self.assertIsNone(doc["basemap"])
        self.assertEqual(sess.calls, [])

    def test_daily_adds_maps_to_every_walk_doc(self):
        m = basemap.Maker(self.cfg, basemap.open_cache(None), FakeSession(), log=lambda *_: None)
        with tempfile.TemporaryDirectory() as out:
            man = daily.run(self.cfg, out, DAY, self.hud, maker=m)
            self.assertEqual(man["errors"], [])
            self.assertEqual(man["basemap"]["walks"],
                             sum(1 for p in man["files"] if p.startswith(("walks/", "today/walk"))))
            for path, name in man["files"].items():
                if path.startswith("walks/") or path == "today/walk":
                    with open(os.path.join(out, name), encoding="utf-8") as f:
                        d = json.load(f)
                    self.assertIn("basemap", d)
                    self.assertIn("route", d)
                    self.assertIn("streets", d["basemap"])             # (the fake answers every box the same)
            man0 = daily.run(self.cfg, out, DAY, self.hud)             # no maker: docs exactly as before
            self.assertNotIn("basemap", man0)
            with open(os.path.join(out, "today__walk.json"), encoding="utf-8") as f:
                self.assertNotIn("basemap", json.load(f))

    def test_cli_offline_zones_gets_route_and_null_map(self):
        with tempfile.TemporaryDirectory() as t:
            cp, wp = os.path.join(t, "config.json"), os.path.join(t, "w.json")
            with open(cp, "w") as f:
                json.dump({"paths": {"db": os.path.join(t, "hh.db"), "cache": os.path.join(t, "cache"),
                                     "export": os.path.join(t, "export")}}, f)
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                rc = hh.main(["--config", cp, "--offline", "zones", "--hud", HUD, "--date", DAY, "--near",
                              "41.43,-96.49", "--top", "2", "--walks-out", wp])
            self.assertEqual(rc, 0)
            with open(wp, encoding="utf-8") as f:
                w = json.load(f)
            self.assertTrue(w)
            for d in w.values():
                self.assertIsNone(d["basemap"])
                self.assertEqual(len(d["route"]), len(d["stops"]))


if __name__ == "__main__":
    unittest.main()
