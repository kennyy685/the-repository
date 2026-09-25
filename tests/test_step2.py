"""Offline tests for Step 2: GRIB2 decoding, radar+ground fusion, neighborhood cells, scoring."""
import io
import json
import os
import shutil
import struct
import sys
import tempfile
import unittest
from datetime import date

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from hailhunter import config as C  # noqa: E402
from hailhunter import db, mrms, nbhd  # noqa: E402
from hailhunter.models import Obs, parse_utc  # noqa: E402


def make_grib2(Y, la1, lo1, d, R=-30.0, D=1):
    """Build a GRIB2 message (grid 3.0, PNG packing 5.41) like MRMS does."""
    Nj, Ni = Y.shape
    X = np.round(Y * 10 ** D - R).astype(np.uint16)
    buf = io.BytesIO()
    Image.fromarray(X).save(buf, format="PNG")
    png = buf.getvalue()
    s3 = bytearray(72)
    s3[0:4], s3[4] = struct.pack(">I", 72), 3
    s3[6:10] = struct.pack(">I", Ni * Nj)
    s3[30:38] = struct.pack(">II", Ni, Nj)
    s3[46:50] = struct.pack(">I", int(la1 * 1e6))
    s3[50:54] = struct.pack(">I", int((lo1 + 360) * 1e6))
    s3[63:67] = struct.pack(">I", int(d * 1e6))
    s3[67:71] = struct.pack(">I", int(d * 1e6))
    s5 = bytearray(21)
    s5[0:4], s5[4] = struct.pack(">I", 21), 5
    s5[5:9] = struct.pack(">I", Ni * Nj)
    s5[9:11] = struct.pack(">H", 41)
    s5[11:15] = struct.pack(">f", R)
    s5[17:19] = struct.pack(">H", D)
    s5[19] = 16
    s1 = struct.pack(">IB", 21, 1) + bytes(16)
    s4 = struct.pack(">IB", 34, 4) + bytes(29)
    s6 = struct.pack(">IBB", 6, 6, 255)
    s7 = struct.pack(">IB", 5 + len(png), 7) + png
    body = s1 + bytes(s3) + s4 + bytes(s5) + s6 + s7 + b"7777"
    return b"GRIB" + bytes([0, 0, 0, 2]) + struct.pack(">Q", 16 + len(body)) + body


class Step2(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.cfg = C.load(os.path.join(self.tmp, "none.json"))
        self.cfg["paths"] = {k: os.path.join(self.tmp, k) for k in ("db", "cache", "export")}
        self.conn = db.connect(self.cfg["paths"]["db"])

    def tearDown(self):
        self.conn.close()
        shutil.rmtree(self.tmp)

    def _write_grid(self, day, inches, lat0=41.6, lon0=-96.7, d=0.01):
        arr = np.round(inches * 25.4 * 10).astype(np.uint16)
        meta = {"lat0": lat0, "lon0": lon0, "dlat": d, "dlon": d, "shape": list(arr.shape), "complete": True}
        with open(mrms.grid_path(self.cfg, day), "wb") as f:
            np.savez_compressed(f, mesh=arr, meta=json.dumps(meta))

    def test_grib2_png_roundtrip_and_crop(self):
        Y = np.zeros((40, 60), np.float32)
        Y[10:20, 30:45] = 38.1                                   # 1.5" in mm
        Y[0, 0] = -3.0                                           # 'missing' flag value
        Yd, grid = mrms.decode_grib2(make_grib2(Y, 42.0, -97.0, 0.01))
        self.assertEqual(Yd.shape, (40, 60))
        self.assertAlmostEqual(float(Yd[15, 40]), 38.1, places=3)
        self.assertAlmostEqual(float(Yd[0, 0]), -3.0, places=3)
        self.assertAlmostEqual(grid["lo1"], -97.0, places=5)
        sub, meta = mrms.crop(Yd, grid, (-96.75, 41.75, -96.5, 41.9))
        self.assertAlmostEqual(meta["lat0"], 41.9, places=5)
        self.assertAlmostEqual(meta["lon0"], -96.75, places=5)
        self.assertAlmostEqual(float(sub[5, 10]), float(Yd[10, 35]), places=4)

    def test_fusion_lifts_radar_near_reports_only(self):
        day = "2025-09-22"
        self._write_grid(day, np.full((60, 60), 1.0))           # radar says 1" everywhere
        valid = parse_utc("2025-09-23T01:47:00Z")
        obs = [Obs("lsr:test1", "lsr", "ground", valid, 41.35, -96.40, 2.0, weight=1.0),
               Obs("lsr:test2", "lsr", "ground", valid, 41.36, -96.41, 2.0, weight=1.0),
               Obs("lsr:mping", "lsr", "ground", valid, 41.10, -96.60, 3.0, weight=0.75)]   # untrusted: ignored
        db.upsert_obs(self.conn, obs, self.cfg)
        g, meta, used = nbhd.fused_grid(self.conn, self.cfg, day)
        self.assertEqual(len(used), 2)
        i, j = int(round((41.6 - 41.35) / 0.01)), int(round((-96.40 + 96.7) / 0.01))
        self.assertGreater(g[i, j], 1.7)                          # pulled toward the 2" reports
        self.assertLessEqual(g[i, j], 2.0)
        self.assertAlmostEqual(float(g[59, 0]), 1.0, places=2)    # ~15 mi away: radar unchanged

    def test_cell_index_and_measure(self):
        day = "2025-09-22"
        grid = np.zeros((60, 60))
        grid[10:30, 10:30] = 1.6
        self._write_grid(day, grid)
        ring = [[-96.60, 41.50], [-96.50, 41.50], [-96.50, 41.40], [-96.60, 41.40], [-96.60, 41.50]]
        self.conn.execute("INSERT INTO bgs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                          ("310539640003", "NE", "053", "964000", "3", 41.45, -96.55, 2.0, 3.0,
                           -96.60, 41.40, -96.50, 41.50, json.dumps([ring]), "T01", "Testville, NE center [9640-3]"))
        self.conn.execute("INSERT INTO acs VALUES ('310539640003','bg',400,380,338,42,1950,180000,'2024')")
        self.conn.commit()
        _, meta = mrms.load_grid(self.cfg, day)
        geoids, offsets, cells = nbhd.cell_index(self.conn, self.cfg, meta)
        self.assertEqual(geoids, ["310539640003"])
        self.assertTrue(80 <= offsets[1] <= 121)                   # ~10x10 cells of 1 km
        n = nbhd.measure_day(self.conn, self.cfg, day, (geoids, offsets, cells))
        self.assertEqual(n, 1)
        nbhd.rescore(self.conn, self.cfg, today=date(2025, 10, 1))
        h = dict(self.conn.execute("SELECT * FROM nbhd_hits").fetchone())
        self.assertAlmostEqual(h["frac_ge_1"], 1.0)
        self.assertAlmostEqual(h["owner_share"], round(338 / 380, 3))
        self.assertGreater(h["score"], 40)


if __name__ == "__main__":
    unittest.main()
