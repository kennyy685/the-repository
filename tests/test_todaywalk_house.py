"""Offline tests for Today's knock house facts: per stop `year_built`, `sqft`, `stories`, `rough` (a ROUGH vinyl
siding price from estimate.estimate) and `house_line {en, es}`, all left out when the county data doesn't have them;
the walk's `rough_note`, the everyday "built before 1970" line, and the storm `evidence_note` (round 5 #8).
Fixture: tests/fixtures/today_hud.json (stops carry the assessor's `built` and `sqft`, no stories)."""
import contextlib
import copy
import io
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import config as C  # noqa: E402
from hailhunter import estimate as E  # noqa: E402
from hailhunter import todaywalk  # noqa: E402

FIX = os.path.join(HERE, "fixtures", "today_hud.json")
FACTS = {"year_built", "sqft", "stories", "rough", "house_line"}


class HouseFacts(unittest.TestCase):
    def setUp(self):
        with open(FIX) as f:
            self.hud = json.load(f)
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))

    def pick(self, day="2026-09-25", hud=None, cfg=None, **kw):
        return todaywalk.pick(hud or self.hud, day, cfg=cfg or self.cfg, **kw)

    def stops(self, hud=None):
        return [s for L in (hud or self.hud)["lists"] + (hud or self.hud)["everyday_lists"] for s in L["stops"]]

    def test_storm_stop_has_year_size_and_rough_siding_price(self):
        d = self.pick()
        s = d["stops"][0]
        self.assertEqual((s["year_built"], s["sqft"]), (1978, 1400))
        self.assertNotIn("stories", s)                         # the county data has no stories: never guessed
        one = E.estimate({"type": "siding", "footprint_sqft": 1400, "stories": 1, "material": "vinyl"}, self.cfg)
        two = E.estimate({"type": "siding", "footprint_sqft": 700, "stories": 2, "material": "vinyl"}, self.cfg)
        self.assertEqual(s["rough"], {"low": one["low"], "high": two["high"], "kind": "siding", "rough": True,
                                      "material": "vinyl", "stories": [1, 2], "using_reference": True})
        self.assertLess(s["rough"]["low"], s["rough"]["high"])
        lo, hi = f"${s['rough']['low']:,}", f"${s['rough']['high']:,}"
        self.assertEqual(s["house_line"], {"en": f"Built 1978 · ~1,400 sq ft · vinyl siding about {lo}-{hi}",
                                           "es": f"Construida en 1978 · ~1,400 pies² · siding de vinil aprox. {lo}-{hi}"})
        for st in d["stops"]:
            self.assertTrue(FACTS - {"stories"} <= set(st))

    def test_rough_note_says_rough_market_and_insurer_scope_on_storm_walks(self):
        note = self.pick()["rough_note"]
        self.assertIn("Estimate range, not final", note["en"])
        self.assertIn("Rango estimado, no final", note["es"])
        self.assertIn("market prices", note["en"])
        self.assertIn("1 to 2 stories", note["en"])
        self.assertIn(E.INSURANCE_NOTE["en"], note["en"])       # storm walk: the insurer's scope sets the price
        self.assertIn(E.INSURANCE_NOTE["es"], note["es"])
        every = self.pick("2027-04-15")                         # everyday (cash) walk: no insurance line
        self.assertEqual(every["kind"], "everyday")
        self.assertNotIn(E.INSURANCE_NOTE["en"], every["rough_note"]["en"])
        for d in (self.pick(), every):                          # Nebraska 44-8604 + no promises, in both languages
            text = json.dumps({k: d.get(k) for k in ("rough_note", "evidence_note")} |
                              {"lines": [s.get("house_line") for s in d["stops"]]}, ensure_ascii=False).lower()
            for bad in ("deductible", "deducible", "insurance will pay", "free roof", "covered"):
                self.assertNotIn(bad, text)

    def test_missing_data_leaves_the_fields_out(self):
        hud = copy.deepcopy(self.hud)
        for s in self.stops(hud):
            s.pop("built", None)
            s["sqft"] = None
        d = self.pick(hud=hud)
        self.assertEqual(len(d["stops"]), 25)                  # the walk itself doesn't change
        for s in d["stops"]:
            self.assertFalse(FACTS & set(s), s)
        self.assertNotIn("rough_note", d)
        # year built only: the line says just that, no size, no price
        hud = copy.deepcopy(self.hud)
        for s in self.stops(hud):
            s["sqft"] = None
        s = self.pick(hud=hud)["stops"][0]
        self.assertEqual((s["year_built"], s["house_line"]), (1978, {"en": "Built 1978", "es": "Construida en 1978"}))
        self.assertFalse({"sqft", "rough"} & set(s))

    def test_implausible_county_values_are_not_shown(self):
        f = todaywalk.house_facts
        self.assertEqual(f({"built": 0, "sqft": 100}, self.cfg), {})           # placeholder year, shed-sized
        self.assertEqual(f({"built": 1700, "sqft": 74843}, self.cfg), {})      # impossible year, a whole complex
        self.assertEqual(set(f({"built": "1962", "sqft": "1400.0"}, self.cfg)), {"year_built", "sqft", "rough",
                                                                                 "house_line"})
        self.assertEqual(f({"built": None, "sqft": "n/a", "stories": 9}, self.cfg), {})

    def test_known_stories_give_one_estimate(self):
        hud = copy.deepcopy(self.hud)
        for s in self.stops(hud):
            s["stories"] = 2
        d = self.pick(hud=hud)
        s = d["stops"][0]
        two = E.estimate({"type": "siding", "footprint_sqft": 700, "stories": 2, "material": "vinyl"}, self.cfg)
        self.assertEqual(s["stories"], 2)
        self.assertEqual((s["rough"]["low"], s["rough"]["high"], s["rough"]["stories"]), (two["low"], two["high"], 2))
        self.assertIn("· 2 stories ·", s["house_line"]["en"])
        self.assertNotIn("stories unknown", d["rough_note"]["en"])

    def test_hmp_prices_drop_the_market_label(self):
        cfg = copy.deepcopy(self.cfg)
        for k in ("vinyl_siding_sq", "house_wrap_sq", "permit", "min_job"):
            cfg["prices"][k] = {"low": 1, "high": 2} if k != "permit" else {"low": 100, "high": 100}
        d = self.pick(cfg=cfg)
        self.assertFalse(d["stops"][0]["rough"]["using_reference"])
        self.assertNotIn("market", d["rough_note"]["en"])

    def test_everyday_why_says_1970_only_when_true(self):
        self.assertIn("built before 1970", self.pick("2027-04-15")["why"]["en"])   # fixture: 1962-1969 houses
        hud = copy.deepcopy(self.hud)
        for s in hud["everyday_lists"][0]["stops"]:
            s["built"] = 1975                                    # older than 1980, not than 1970
        why = self.pick("2027-04-15", hud=hud)["why"]
        self.assertEqual(why["en"], "Most homes here were built before 1980 and are owner-lived.")
        for s in hud["everyday_lists"][0]["stops"]:
            s["built"] = None                                    # no per-house years: the Census line as before
        self.assertEqual(self.pick("2027-04-15", hud=hud)["why"]["en"],
                         "Most homes here were built before 1980 and are owner-lived.")


class EvidenceNote(unittest.TestCase):
    def setUp(self):
        with open(FIX) as f:
            self.hud = json.load(f)
        self.cfg = C.load(os.path.join(tempfile.gettempdir(), "no-such-config.json"))

    def pick(self, day):
        return todaywalk.pick(self.hud, day, cfg=self.cfg)

    def test_fresh_storm_walk_gets_the_fade_reminder(self):
        d = self.pick("2026-09-25")                             # Fremont storm 2026-09-10: 15 days old
        self.assertEqual(d["kind"], "storm")
        self.assertEqual(d["evidence_note"]["en"], "Hail marks on metal (gutters, vents, wraps) fade in a few weeks: "
                                                   "inspect and photograph soon.")
        self.assertTrue(d["evidence_note"]["es"].startswith("Las marcas de granizo en el metal"))
        self.assertIn("evidence_note", self.pick("2026-09-30"))  # 20 days
        D = __import__("datetime").date
        self.assertIsNotNone(todaywalk.evidence_note("storm", "2026-09-10", D(2026, 10, 9), self.cfg))   # 29 days
        self.assertIsNone(todaywalk.evidence_note("storm", "2026-09-10", D(2026, 10, 10), self.cfg))     # 30 days
        self.assertIsNone(todaywalk.evidence_note("storm", "2026-09-10", D(2026, 9, 9), self.cfg))       # before it

    def test_no_note_at_30_days_or_on_everyday_walks(self):
        self.hud["lists"] = [L for L in self.hud["lists"] if L["id"] == "2026-09-10_Fremont"]
        d = self.pick("2026-10-10")                             # 30 days: still a storm walk (Oct), no note
        self.assertEqual((d["kind"], d["list_id"]), ("storm", "2026-09-10_Fremont"))
        self.assertNotIn("evidence_note", d)
        self.assertIn("evidence_note", self.pick("2026-10-09"))  # 29 days: the note
        d = self.pick("2027-04-15")
        self.assertEqual(d["kind"], "everyday")
        self.assertNotIn("evidence_note", d)
        self.assertIsNone(todaywalk.evidence_note("storm", "bad-date", __import__("datetime").date(2026, 9, 25)))
        self.assertIsNone(todaywalk.evidence_note("storm", None, __import__("datetime").date(2026, 9, 25)))

    def test_cli_writes_the_new_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, "walk.json")
            with contextlib.redirect_stdout(io.StringIO()):
                rc = hh.main(["todaywalk", "--hud", FIX, "--date", "2026-09-25", "--doors", "5", "--out", out])
            self.assertEqual(rc, 0)
            with open(out, encoding="utf-8") as f:
                d = json.load(f)
        self.assertIn("evidence_note", d)
        self.assertIn("rough_note", d)
        self.assertTrue(all({"year_built", "sqft", "rough", "house_line"} <= set(s) for s in d["stops"]))


if __name__ == "__main__":
    unittest.main()
