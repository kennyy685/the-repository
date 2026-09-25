"""Offline tests for storm alerts on watched places and contacted buildings (T31)."""
import json
import os
import shutil
import sys
import tempfile
import unittest
from datetime import date

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import db, mrms, watch  # noqa: E402
from hailhunter import config as C  # noqa: E402


class Watch(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.cfg = C.load(os.path.join(self.tmp, "none.json"))
        self.cfg["paths"] = {k: os.path.join(self.tmp, k) for k in ("db", "cache", "export")}
        self.conn = db.connect(self.cfg["paths"]["db"])

    def tearDown(self):
        self.conn.close()
        shutil.rmtree(self.tmp)

    def _swath(self, day, inches):
        meta = {"lat0": 41.6, "lon0": -96.7, "dlat": 0.01, "dlon": 0.01, "shape": [60, 60], "complete": True}
        with open(mrms.grid_path(self.cfg, day), "wb") as f:
            np.savez_compressed(f, mesh=np.round(inches * 25.4 * 10).astype(np.uint16), meta=json.dumps(meta))
        self.conn.execute("INSERT INTO swaths VALUES (?,?,?,1,?,0,0,0,0,?)", (day, "k", "t", float(inches.max()), "t"))
        self.conn.commit()

    def test_watch_list_file_is_forgiving(self):
        self.assertEqual(watch.load_watch_list(self.cfg), [])                        # no file: nothing watched
        with open(os.path.join(os.path.dirname(self.cfg["paths"]["db"]), "watch_list.json"), "w") as f:
            json.dump({"places": [{"name": "The Edge", "address": "x", "lat": 41.5, "lon": -96.6},
                                  {"name": "No location"}]}, f)
        places = watch.load_watch_list(self.cfg)
        self.assertEqual([p["name"] for p in places], ["The Edge"])                 # bad entry skipped

    def test_hits_only_where_hail_reached_the_place(self):
        grid = np.zeros((60, 60))
        grid[5:15, 5:15] = 1.4                                  # hail around 41.50, -96.60
        self._swath("2026-09-12", grid)
        self._swath("2026-09-19", np.full((60, 60), 0.5))       # small hail everywhere: no alert
        places = [{"name": "The Edge", "address": "a", "note": "", "lat": 41.50, "lon": -96.60},
                  {"name": "Far building", "address": "b", "note": "", "lat": 41.20, "lon": -96.30}]
        hits = watch.watch_hits(self.conn, self.cfg, places, today=date(2026, 9, 25))
        self.assertEqual([(h["name"], h["day"]) for h in hits], [("The Edge", "2026-09-12")])
        self.assertAlmostEqual(hits[0]["hail"], 1.4, places=1)
        self.assertEqual(watch.watch_hits(self.conn, self.cfg, places, days_back=5, today=date(2026, 9, 25)), [])

    def test_new_hits_for_the_morning_brief(self):
        contact = {"name": "Springhill Ridge Apartments", "phone": "(402) 204-4528", "ask_for": "Community manager"}
        old = {"watch_hits": [{"name": "The Edge", "day": "2026-09-12"}],
               "targets": [{"key": "15859 Rosewood St|Omaha", "day": "2026-06-10"}]}
        new = {"watch_hits": [{"name": "The Edge", "day": "2026-09-12"}, {"name": "The Edge", "day": "2026-09-24"}],
               "targets": [{"key": "15859 Rosewood St|Omaha", "address": "15859 Rosewood St", "city": "Omaha",
                            "day": "2026-09-24", "hail": 1.3, "contact": contact},
                           {"key": "1 Main St|Omaha", "address": "1 Main St", "city": "Omaha", "day": "2026-09-24",
                            "hail": 1.5, "contact": None}]}                     # no contact: not a call alert
        got = watch.new_hits(old, new)
        self.assertEqual([w["day"] for w in got["watch"]], ["2026-09-24"])
        self.assertEqual([(c["name"], c["phone"]) for c in got["contacts"]],
                         [("Springhill Ridge Apartments", "(402) 204-4528")])

    def test_diff_command_reports_contact_hits(self):
        old = {"storms": [], "targets": [], "watch_hits": []}
        new = {"storms": [], "watch_hits": [], "targets": [{"key": "1 A St|Omaha", "address": "1 A St", "city": "Omaha",
               "day": "2026-09-24", "hail": 1.2, "contact": {"name": "Acme Apts", "phone": "(402) 555-0100"}}]}
        paths = []
        for name, d in (("old.json", old), ("new.json", new)):
            paths.append(os.path.join(self.tmp, name))
            with open(paths[-1], "w") as f:
                json.dump(d, f)
        cfgp = os.path.join(self.tmp, "cfg.json")
        with open(cfgp, "w") as f:
            json.dump({"paths": self.cfg["paths"]}, f)
        import contextlib
        import io
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            hh.main(["--config", cfgp, "--offline", "diff", "--old", paths[0], "--new", paths[1]])
        out = json.loads(buf.getvalue())
        self.assertEqual(out["count"], 0)
        self.assertEqual([c["name"] for c in out["new_contact_hits"]], ["Acme Apts"])
        self.assertEqual(out["new_watch_hits"], [])


if __name__ == "__main__":
    unittest.main()
