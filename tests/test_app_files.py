"""T169: the HMP App is published as a page plus separate files (pages/hmp-app.files.json). Runs
tests/js/app_files_check.js: manifest and page agree, and the module files load side by side without name clashes."""
import os
import shutil
import subprocess
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NODE = shutil.which("node")
CHECK_JS = os.path.join(ROOT, "tests", "js", "app_files_check.js")
MANIFEST = os.path.join(ROOT, "pages", "hmp-app.files.json")   # not in the cloud bundle: the check skips there


@unittest.skipUnless(NODE and os.path.exists(CHECK_JS) and os.path.exists(MANIFEST),
                     "node or the app's pages/ not here (cloud bundle): app files check skipped")
class AppFiles(unittest.TestCase):
    def test_manifest_page_and_modules_agree(self):
        p = subprocess.run([NODE, CHECK_JS], capture_output=True, text=True, timeout=60)
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertIn("app files OK", p.stdout)


if __name__ == "__main__":
    unittest.main()
