"""The map learns from your knocks: hailhunter/learning.py (counts + smoothed inspection-yes rate per signal band,
never a rate under min_doors), the `hh.py learn` command, and the pages' JS twins using the same constants."""
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest

from hailhunter import learning
from hailhunter.config import DEFAULTS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def knock(door, o, hail=1.75, own=True, mort=True, sale=2019, stack=3, rb="prime", zone="z1", st="N Main St",
          at="2026-09-28T21:00:00Z"):
    return {"door": door, "o": o, "zone": zone, "st": st, "at": at,
            "sig": {"hail": hail, "own": own, "mort": mort, "sale": sale, "roof": 10, "stack": stack, "rb": rb}}


class Bands(unittest.TestCase):
    def test_bands(self):
        self.assertEqual([learning.hail_band(x) for x in (0.75, 1.0, 1.5, 1.99, 2.0, 2.75)],
                         ["h0", "h1", "h2", "h2", "h3", "h3"])
        self.assertIsNone(learning.hail_band(None))
        self.assertEqual([learning.stack_band(n) for n in (0, 1, 2, 3, 7)], ["s1", "s1", "s2", "s3", "s3"])
        self.assertEqual(learning.ins_count({"own": 1, "mort": 1, "sale": 2016}, 2026), 3)
        self.assertEqual(learning.ins_count({"own": 1, "mort": 0, "sale": 2015}, 2026), 1)
        self.assertEqual(learning.ins_count({"sale": "bad"}, 2026), 0)

    def test_keys_back_off_most_specific_first(self):
        sig = {"hail": 1.75, "own": True, "mort": True, "sale": 2019, "stack": 3, "rb": "prime"}
        self.assertEqual(learning.door_keys(sig, 2026), ["h:h2|i:i3|r:prime", "h:h2|i:i3", "h:h2"])
        self.assertEqual(learning.door_keys({**sig, "rb": None}, 2026), ["h:h2|i:i3", "h:h2"])
        self.assertEqual(learning.zone_keys(2.1, 2, "z9"), ["z:z9", "h:h3|s:s2", "h:h3"])


class Doors(unittest.TestCase):
    def test_one_door_per_house_yes_wins_sign_skipped_bad_rows_ignored(self):
        ks = [knock("a", "na", at="2026-09-27T21:00:00Z"), knock("a", "yes", at="2026-09-28T21:00:00Z"),
              knock("b", "yes", at="2026-09-27T21:00:00Z"), knock("b", "back", at="2026-09-28T21:00:00Z"),
              knock("c", "sign"), {"o": "yes"}, "junk", None, knock("d", "bogus")]
        rows = {r["door"]: r for r in learning.doors(ks)}
        self.assertEqual(sorted(rows), ["a", "b"])
        self.assertTrue(rows["a"]["yes"] and rows["b"]["yes"])
        self.assertEqual(rows["b"]["o"], "back")

    def test_table_counts(self):
        ks = [knock(f"d{i}", "yes" if i < 3 else "no") for i in range(10)] + [knock("x", "na", hail=0.8, zone="z2")]
        t = learning.table(ks)
        self.assertEqual(t["all"], [11, 3])
        self.assertEqual(t["z:z1"], [10, 3])
        self.assertEqual(t["h:h2|s:s3"], [10, 3])
        self.assertEqual(t["h:h2|i:i3|r:prime"], [10, 3])
        self.assertEqual(t["h:h0"], [1, 0])


class Like(unittest.TestCase):
    def test_not_enough_doors_under_min_never_shows_a_rate(self):
        t = learning.table([knock(f"d{i}", "yes") for i in range(7)])
        r = learning.like(t, learning.zone_keys(1.75, 3, "z1"))
        self.assertFalse(r["enough"])
        self.assertIsNone(r["rate"])
        self.assertEqual(r["factor"], 1.0)
        self.assertEqual(r["line"]["en"], "This zone: not enough doors yet (7 of 20)")
        self.assertEqual(r["line"]["es"], "Esta zona: aún no hay suficientes puertas (7 de 20)")
        self.assertNotIn("%", r["line"]["en"])

    def test_back_off_to_the_first_group_with_enough_doors(self):
        ks = [knock(f"a{i}", "yes" if i < 4 else "no", zone=f"z{i}") for i in range(30)]
        r = learning.like(learning.table(ks), learning.zone_keys(1.75, 3, "z0"))
        self.assertEqual(r["key"], "h:h2|s:s3")            # each zone has 1 door; zones like it have 30
        self.assertEqual(r["line"]["en"][:46], "Zones like this: 4 inspection yeses from 30 do")
        self.assertIn("Zonas como esta: 4 sí a inspección de 30 puertas", r["line"]["es"])

    def test_smoothed_rate_shrinks_toward_prior_and_factor_is_capped(self):
        cfg = {"learning": {"prior_rate": 0.05, "prior_doors": 20, "min_doors": 20}}
        good = [knock(f"g{i}", "yes" if i < 10 else "no", hail=2.2, zone="zg") for i in range(20)]
        bad = [knock(f"b{i}", "no", hail=0.8, zone="zb") for i in range(80)]
        t = learning.table(good + bad)
        p = learning.prior_all(t, cfg)
        self.assertAlmostEqual(p, (10 + 20 * 0.05) / (100 + 20))
        g = learning.like(t, learning.zone_keys(2.2, 3, "zg"), cfg=cfg)
        self.assertAlmostEqual(g["rate"], round((10 + 20 * p) / 40, 4))
        self.assertLess(g["rate"], 0.5)                    # 10 of 20 raw, shrunk toward the prior
        self.assertEqual(g["factor"], 1.15)                # capped
        b = learning.like(t, learning.zone_keys(0.8, 1, "zb"), cfg=cfg)
        self.assertEqual(b["factor"], 0.85)
        self.assertIn("~", b["line"]["en"])

    def test_one_yes_singular_and_all_doors_fallback(self):
        ks = [knock(f"a{i}", "yes" if i == 0 else "no", zone=f"z{i}", hail=0.5 + i * 0.1) for i in range(25)]
        r = learning.like(learning.table(ks), ["z:zz", "h:h9"], kind="door")
        self.assertEqual(r["key"], "all")
        self.assertEqual(r["factor"], 1.0)
        self.assertTrue(r["line"]["en"].startswith("All doors so far: 1 inspection yes from 25 doors"))

    def test_empty_db(self):
        r = learning.like(learning.table([]), learning.door_keys({"hail": 1.2}, 2026), kind="door")
        self.assertEqual(r["line"]["en"], "Doors like this: not enough doors yet (0 of 20)")

    def test_no_insured_wording(self):
        d = learning.doc([knock(f"a{i}", "yes") for i in range(25)])
        for txt in [json.dumps(d)] + [json.dumps(learning.line(k, 5, 1, need=20)) for k in learning.LABEL]:
            self.assertNotRegex(txt.lower(), r"\binsured\b|\basegurad")


class Command(unittest.TestCase):
    def test_hh_learn_writes_doc(self):
        with tempfile.TemporaryDirectory() as d:
            src, out = os.path.join(d, "k.json"), os.path.join(d, "learn.json")
            json.dump({"v": 1, "ev": [knock(f"a{i}", "yes" if i < 2 else "na") for i in range(22)]}, open(src, "w"))
            p = subprocess.run([sys.executable, os.path.join(ROOT, "hh.py"), "learn", "--knocks", src, "--out", out],
                               capture_output=True, text=True, timeout=60)
            self.assertEqual(p.returncode, 0, p.stderr)
            doc = json.load(open(out))
            self.assertEqual((doc["doors"], doc["yes"], doc["min"], doc["src"]), (22, 2, 20, "REAL"))
            self.assertEqual(doc["t"]["all"], [22, 2])


class Pages(unittest.TestCase):
    """The two design pages repeat `like` in JS: their constants come from the shipped doc, and the doc matches
    the engine's config."""
    def test_page_data_matches_engine(self):
        lc = DEFAULTS["learning"]
        walk = json.load(open(os.path.join(ROOT, "docs/design/knock/data/walk.json")))
        self.assertTrue("learn" in walk, "walk.json has no learn table: run docs/design/knock/data/build/learn.py")
        js = open(os.path.join(ROOT, "docs/design/open-map/data/learn.js")).read()
        m = json.loads(re.search(r"window\.LEARN=(\{.*\});?\s*$", js, re.S).group(1))
        for d in (walk["learn"], m):
            self.assertEqual((d["k"], d["min"], d["prior_rate"], d["cap"], d["cuts"]),
                             (lc["prior_doors"], lc["min_doors"], lc["prior_rate"], lc["factor_cap"], lc["hail_cuts"]))
            self.assertEqual(d["src"], "SAMPLE")           # mock knocks only until FilthE knocks
            self.assertEqual(d["t"]["all"][0], d["doors"])


if __name__ == "__main__":
    unittest.main()
