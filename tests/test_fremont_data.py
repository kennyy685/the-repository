"""Next-level mockups' Fremont pick (docs/design/next-level/shared/data-fremont.js, build_fremont.py): runs
check_fremont.js (loads after data.js, keeps the Columbus shapes, every sample home within 60 m of a walk street) and
checks the build is repeatable offline from the cached street pull."""
import os
import shutil
import subprocess
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NODE = shutil.which("node")
SHARED = os.path.join(ROOT, "docs", "design", "next-level", "shared")
CHECK_JS = os.path.join(SHARED, "check_fremont.js")
OUT = os.path.join(SHARED, "data-fremont.js")


@unittest.skipUnless(os.path.exists(OUT), "next-level mockups not here (cloud bundle): Fremont data check skipped")
class FremontData(unittest.TestCase):
    @unittest.skipUnless(NODE, "node not installed")
    def test_loads_and_homes_on_the_walk(self):
        p = subprocess.run([NODE, CHECK_JS], capture_output=True, text=True, timeout=60)
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertIn("ok data-fremont.js", p.stdout)

    @unittest.skipUnless(os.path.exists(os.path.join(SHARED, "_fremont_raw.json")), "street cache missing")
    def test_build_is_repeatable(self):
        before = open(OUT, encoding="utf-8").read()
        try:
            p = subprocess.run([sys.executable, os.path.join(SHARED, "build_fremont.py")], cwd=ROOT,
                               capture_output=True, text=True, timeout=120)
            self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
            self.assertEqual(open(OUT, encoding="utf-8").read(), before, "build_fremont.py output changed")
        finally:
            open(OUT, "w", encoding="utf-8").write(before)


if __name__ == "__main__":
    unittest.main()
