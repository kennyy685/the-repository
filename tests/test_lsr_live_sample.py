"""T117/T118 live check: real NWS Local Storm Reports (Iowa Mesonet lsr.geojson, pulled 2026-09-26, trimmed to 12
features in tests/fixtures/lsr_wind_real_sample.geojson). Fallen-tree and wind-direction parsing on real text."""
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from hailhunter import config as C  # noqa: E402
from hailhunter import wind  # noqa: E402

FIX = os.path.join(HERE, "fixtures", "lsr_wind_real_sample.geojson")


class RealLSR(unittest.TestCase):
    def setUp(self):
        with open(FIX, "rb") as f:
            self.obs = wind.parse(f.read(), C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json")))

    def get(self, start):
        return next(o for o in self.obs if o["remark"].startswith(start))

    def test_all_wind_reports_parse(self):
        self.assertEqual(len(self.obs), 12)
        self.assertEqual(self.get("Personal weather station measured 63")["speed_mph"], 63.0)

    def test_fallen_trees(self):
        for start in ("Downed tree and wires", "Multiple reports of trees", "Large oak tree limb snapped",
                      "Report from mPING: 1-inch tree limbs", "Gust front from parent storm",
                      "Large pine uprooted"):                       # no word "tree": uprooted still counts
            self.assertTrue(self.get(start)["extra"]["trees"], start)
        for start in ("Wind gusts estimated to be at least 50 MPH. Trees moving",   # "no downed branches"
                      "65-70 mph winds. Trees are bending",                         # standing trees
                      "Downed power lines near Elm Park Road",                      # a street name, not a tree
                      "Roof decking removed", "Personal weather station"):
            self.assertFalse(self.get(start)["extra"]["trees"], start)

    def test_wind_direction_only_when_said(self):
        self.assertEqual(self.get("Northeast wind behind")["extra"]["wind_dir"], "NE")
        self.assertEqual(self.get("Gust front from parent storm incoming from the west")["extra"]["wind_dir"], "W")
        # places ("north and west side of Liberty", "just northwest of Corning", "tossed ... to the southeast")
        # are where the report is, not where the wind came from
        for start in ("Multiple reports of trees", "Personal weather station", "Roof decking removed",
                      "Large oak tree limb snapped on the west side"):
            self.assertIsNone(self.get(start)["extra"]["wind_dir"], start)


if __name__ == "__main__":
    unittest.main()
