"""T81: data/glossary_en_es.json, the fixed EN/ES word pairs (research round 13) every translation uses."""
import json
import os
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "data", "glossary_en_es.json")


@unittest.skipUnless(os.path.exists(PATH), "glossary not in this copy")
class Glossary(unittest.TestCase):
    def setUp(self):
        with open(PATH, encoding="utf-8") as f:
            self.doc = json.load(f)
        self.terms = self.doc["terms"]

    def test_shape_and_no_duplicates(self):
        self.assertGreaterEqual(len(self.terms), 30)
        seen = set()
        for t in self.terms:
            self.assertTrue(isinstance(t.get("en"), str) and t["en"].strip(), t)
            self.assertTrue(isinstance(t.get("es"), str) and t["es"].strip(), t)
            self.assertIsInstance(t.get("note"), str, t)
            self.assertTrue(set(t) <= {"cat", "en", "es", "note", "region"}, t)
            key = t["en"].strip().lower()
            self.assertNotIn(key, seen, f"duplicate en key: {t['en']}")
            seen.add(key)

    def test_required_terms(self):
        by = {t["en"].lower(): t["es"].lower() for t in self.terms}
        want = {"deductible": "deducible", "adjuster": "ajustador", "claim": "reclamo", "depreciation": "depreciación",
                "registered": "registrado"}
        for en, es in want.items():
            self.assertEqual(by.get(en), es, en)
        for en in ("supplement", "flashing", "soffit", "fascia", "drip edge", "ice and water shield", "underlayment",
                   "decking", "ridge cap", "hail bruise", "granule loss", "starter strip", "siding", "j-channel",
                   "house wrap", "harness", "ladder", "watch out!"):
            self.assertIn(en, by)
        self.assertTrue(any(k.startswith("acv") for k in by) and any(k.startswith("rcv") for k in by))

    def test_registered_never_licensed(self):
        for t in self.terms:
            self.assertNotIn("licenciad", t["es"].lower(), t)
            self.assertNotIn("licensed", t["en"].lower(), t)


if __name__ == "__main__":
    unittest.main()
