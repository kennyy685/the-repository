"""Offline tests for the cloud path (T61): `hh.py bundle` -> Cowork unpacks it into an EMPTY folder -> Storm Watch runs
it in a sandbox that has numpy/pandas/matplotlib/PIL but NOT openpyxl or flask.
- the bundle carries every engine module, config, contacts, and the offline tests + fixtures (so `selftest` runs there)
- `hh.py unbundle` works in a folder holding only hh.py + the bundle
- bundle/unbundle don't depend on the machine's locale (the code carries Spanish text)
- without openpyxl/flask every app command finishes (`commercial` writes CSV only), and `serve` says what's missing
  instead of a traceback
- one failed parcel/owner download (site down) doesn't stop `refresh` from writing hud.json; --offline stays offline"""
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from datetime import date, timedelta
from unittest import mock

import numpy as np
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

import hh  # noqa: E402
from hailhunter import commercial, db, doors, ingest, mrms  # noqa: E402
from hailhunter import config as C  # noqa: E402
from hailhunter.http import Fetcher  # noqa: E402

# Makes `import openpyxl` / `import flask` fail exactly like a missing package (find_spec -> None too).
NO_PKGS = ("import sys\n"
           "for _n in ('openpyxl', 'flask', 'markupsafe'):\n"
           "    sys.modules[_n] = None\n")


def run(cwd, *args, env=None, py=()):
    e = dict(os.environ, **(env or {}))
    return subprocess.run([sys.executable, *py, os.path.join(cwd, "hh.py"), *args], cwd=cwd, env=e,
                          capture_output=True, text=True, timeout=300)


class Bundle(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.path = os.path.join(cls.tmp, "engine.json")
        cls.files = hh.bundle(cls.path)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def test_bundle_has_everything_the_cloud_run_needs(self):
        need = ["hh.py", "config.json", "data/scout_contacts.json", "vendor/shapefile.py", "tests/__init__.py"]
        need += [os.path.relpath(p, ROOT).replace(os.sep, "/") for p in
                 glob.glob(os.path.join(ROOT, "hailhunter", "**", "*.py"), recursive=True) +
                 glob.glob(os.path.join(ROOT, "tests", "test_*.py")) +
                 glob.glob(os.path.join(ROOT, "tests", "fixtures", "*"))]
        for m in ("tune", "estimate", "todaywalk", "calltoday", "weekly", "everyday", "hud", "doors", "commercial"):
            self.assertIn(f"hailhunter/{m}.py", need)
        missing = [p for p in need if p not in self.files]
        self.assertEqual(missing, [])
        self.assertEqual("data/tuned.json" in self.files, os.path.exists(os.path.join(ROOT, "data", "tuned.json")))
        junk = [p for p in self.files if "__pycache__" in p or p.endswith((".db", ".db-journal", ".pyc"))
                or p.startswith(("data/export", "data/cache", "docs/"))]
        self.assertEqual(junk, [])

    def test_unbundle_in_empty_folder_then_app_commands_without_openpyxl_or_flask(self):
        eng = os.path.join(self.tmp, "empty", "engine")
        os.makedirs(eng)
        shutil.copy(os.path.join(ROOT, "hh.py"), eng)          # the only file there: hailhunter/ isn't yet
        p = run(eng, "unbundle", "--src", self.path)
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertTrue(os.path.exists(os.path.join(eng, "hailhunter", "tune.py")))
        with open(os.path.join(eng, "sitecustomize.py"), "w") as f:
            f.write(NO_PKGS)
        env = {"PYTHONPATH": eng}
        fx = os.path.join(eng, "tests", "fixtures")
        out = os.path.join(self.tmp, "out")
        os.makedirs(out, exist_ok=True)
        cmds = [("estimate", "--export-rules", "--out", os.path.join(out, "rules.json")),
                ("todaywalk", "--doors", "25", "--hud", os.path.join(fx, "today_hud.json"), "--date", "2026-09-25",
                 "--out", os.path.join(out, "walk.json"), "--evidence-out", os.path.join(out, "ev.json")),
                ("todaywalk", "--doors", "25"),                       # no hud.json yet: a clean "none" walk
                ("calltoday", "--hud", os.path.join(fx, "today_hud.json"), "--date", "2026-09-25"),
                ("weekly", "--doors", os.path.join(fx, "weekly_doors.json"), "--leads",
                 os.path.join(fx, "weekly_leads.json"), "--week", "all"),
                ("tune", "--weekly", os.path.join(fx, "tune_weekly_big.json")),
                ("--offline", "commercial")]                           # empty database: CSV only, no crash
        for c in cmds:
            p = run(eng, *c, env=env)
            self.assertEqual(p.returncode, 0, f"{c[0]}: {p.stderr[-800:]}")
            self.assertNotIn("Traceback", p.stderr, c[0])
        with open(os.path.join(out, "walk.json"), encoding="utf-8") as f:
            self.assertTrue(json.load(f)["stops"])
        self.assertFalse(os.path.exists(os.path.join(eng, "data", "tuned.json")))    # tune is a dry run
        p = run(eng, "serve", env=env)
        self.assertEqual(p.returncode, 1)
        self.assertIn("flask", p.stderr)
        self.assertNotIn("Traceback", p.stderr)

    def test_bundle_and_unbundle_ignore_the_locale(self):
        env = {"LC_ALL": "C", "LANG": "C", "PYTHONUTF8": "0"}       # ASCII locale: open() would default to ascii
        src = os.path.join(self.tmp, "ascii.json")
        p = run(ROOT, "bundle", "--out", src, env=env, py=("-X", "utf8=0"))
        self.assertEqual(p.returncode, 0, p.stderr[-800:])
        eng = os.path.join(self.tmp, "ascii", "engine")
        os.makedirs(eng)
        shutil.copy(os.path.join(ROOT, "hh.py"), eng)
        p = run(eng, "unbundle", "--src", src, env=env, py=("-X", "utf8=0"))
        self.assertEqual(p.returncode, 0, p.stderr[-800:])
        with open(os.path.join(eng, "hailhunter", "todaywalk.py"), encoding="utf-8") as a, \
                open(os.path.join(ROOT, "hailhunter", "todaywalk.py"), encoding="utf-8") as b:
            self.assertEqual(a.read(), b.read())

    def test_unbundle_refuses_paths_outside_the_folder(self):
        eng = os.path.join(self.tmp, "evil", "engine")
        os.makedirs(eng)
        shutil.copy(os.path.join(ROOT, "hh.py"), eng)
        src = os.path.join(self.tmp, "evil.json")
        with open(src, "w") as f:
            json.dump({"version": 1, "files": {"../escaped.py": "x = 1\n"}}, f)
        p = run(eng, "unbundle", "--src", src)
        self.assertNotEqual(p.returncode, 0)
        self.assertIn("refusing path outside this folder", p.stderr)
        self.assertFalse(os.path.exists(os.path.join(self.tmp, "evil", "escaped.py")))


class NoOpenpyxl(unittest.TestCase):
    def test_commercial_write_falls_back_to_csv(self):
        tmp = tempfile.mkdtemp()
        try:
            cfg = C.load(os.path.join(tmp, "none.json"))
            cfg["paths"] = dict(cfg["paths"], export=tmp)
            with mock.patch.dict(sys.modules, {"openpyxl": None}):
                xlsx, csvp = commercial.write([], cfg, "t", "s")
            self.assertIsNone(xlsx)
            self.assertTrue(os.path.exists(csvp))
        finally:
            shutil.rmtree(tmp)


class RefreshSurvives(unittest.TestCase):
    """The real hh.refresh() on a tiny seeded town, network stubbed out."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.cfg = C.load(os.path.join(self.tmp, "none.json"))
        self.cfg["paths"] = dict(self.cfg["paths"], **{k: os.path.join(self.tmp, k) for k in ("db", "cache", "export")})
        os.makedirs(self.cfg["paths"]["export"])
        self.conn = db.connect(self.cfg["paths"]["db"])
        c = self.conn
        c.execute("INSERT INTO places (geoid,name,state,lat,lon,pop,aland_sqmi,dist_mi,hu) VALUES "
                  "('3104000','Testville','NE',41.45,-96.55,900,1.0,5,400)")
        ring = [[-96.60, 41.50], [-96.50, 41.50], [-96.50, 41.40], [-96.60, 41.40], [-96.60, 41.50]]
        c.execute("INSERT INTO bgs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                  ("310539640003", "NE", "053", "964000", "3", 41.45, -96.55, 2.0, 3.0, -96.60, 41.40, -96.50,
                   41.50, json.dumps([ring]), "3104000", "Testville, NE center [9640-3]"))
        c.execute("INSERT INTO acs VALUES ('310539640003','bg',400,380,300,80,1980,180000,'2024')")
        c.commit()
        self.day = (date.today() - timedelta(days=10)).isoformat()
        arr = np.full((60, 60), round(1.6 * 25.4 * 10), np.uint16)
        meta = {"lat0": 41.6, "lon0": -96.7, "dlat": 0.01, "dlon": 0.01, "shape": [60, 60], "complete": True}
        with open(mrms.grid_path(self.cfg, self.day), "wb") as f:
            np.savez_compressed(f, mesh=arr, meta=json.dumps(meta))
        self.fetcher = Fetcher(self.cfg["paths"]["cache"], offline=True)

    def tearDown(self):
        self.conn.close()
        shutil.rmtree(self.tmp)

    def refresh(self, make_list, build):
        with mock.patch.object(ingest, "run", lambda *a, **k: (set(), {})), \
                mock.patch.object(mrms, "run", lambda *a, **k: ([self.day], 0, [])), \
                mock.patch.object(doors, "make_list", make_list), mock.patch.object(commercial, "build", build):
            return hh.refresh(self.conn, self.fetcher, self.cfg, log=lambda *a: None)

    def test_download_errors_skip_that_part_and_hud_json_is_still_written(self):
        down = mock.Mock(side_effect=requests.ConnectionError("gis.ne.gov unreachable"))
        summary = self.refresh(down, mock.Mock(side_effect=requests.ConnectionError("owner site down")))
        self.assertTrue(down.called)                                   # a door list was attempted, and failed
        self.assertEqual((summary["door_lists"], summary["targets"]), ([], 0))
        with open(os.path.join(self.cfg["paths"]["export"], "hud.json")) as f:
            self.assertIn("Testville", json.dumps(json.load(f)["neighborhoods"]))    # the storm still shows

    def test_offline_refresh_never_hands_out_a_live_session(self):
        make_list = mock.Mock(return_value=None)
        build = mock.Mock(return_value=([], 0, 0))
        self.refresh(make_list, build)
        self.assertTrue(make_list.called)
        self.assertTrue(all(call.args[4] is None for call in make_list.call_args_list))
        self.assertIsNone(build.call_args.args[2])


if __name__ == "__main__":
    unittest.main()
