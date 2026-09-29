"""Wires tests/legal_check.py (T72's legal/compliance text check) into `hh.py selftest`."""
import os
import unittest

from tests import legal_check

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HAS_DOCS = os.path.isdir(os.path.join(ROOT, "docs", "print")) and os.path.isdir(os.path.join(ROOT, "docs", "legal"))


@unittest.skipUnless(HAS_DOCS, "docs/ not in this copy (cloud bundle)")
class TestLegalCheck(unittest.TestCase):
    def test_statute_match(self):
        failures = legal_check.check_statute_match()
        self.assertEqual(failures, [], "\n".join(failures))

    def test_cancel_notice_elements(self):
        failures = legal_check.check_cancel_notice_elements()
        self.assertEqual(failures, [], "\n".join(failures))

    def test_contingency_elements(self):
        failures = legal_check.check_contingency_elements()
        self.assertEqual(failures, [], "\n".join(failures))

    def test_print_type(self):
        """Cooling-off type: 10pt bold right-to-cancel statement + Notice of Cancellation forms (16 CFR 429.1, 69-1604)."""
        try:
            failures = legal_check.check_print_type()
        except legal_check.PrintTypeUnavailable as why:
            self.skipTest(f"no browser to measure the print pieces with: {why}")
        self.assertEqual(failures, [], "\n".join(failures))

    def test_door_openers(self):
        """The app's Sale Guide door openers say name + HMP + what we sell before the storm/old-house hook (69-1602, T174)."""
        failures = legal_check.check_door_openers()
        self.assertEqual(failures, [], "\n".join(failures))

    def test_door_openers_catch_the_t174_bug(self):
        """The pre-T174 opener (no name, what we sell only after the hook) must fail."""
        bad = ("      doorIns: r => `Hi, I'm with ${SETTINGS.company.name}, a registered contractor. ${r || 'storm'} "
               "Can I take a quick look at your roof and siding?`,\n")
        real = legal_check._read
        legal_check._read = lambda path: bad
        try:
            failures = legal_check.check_door_openers()
        finally:
            legal_check._read = real
        self.assertEqual(len(failures), 2, "\n".join(failures))

    def test_no_free(self):
        """No "free" / "costs you nothing" offer until the boss okays it (King, 2026-09-29)."""
        failures = legal_check.check_no_free()
        self.assertEqual(failures, [], "\n".join(failures))

    def test_no_free_catches_offers_and_allows_rules(self):
        bad = ("<p>Signing costs you nothing. HMP charges nothing for the inspection.</p>\n"
               "<p>Firmar no le cuesta nada. HMP no cobra nada. Call for a free roof check.</p>\n"
               "<p>Never call the roof check free. NDOI consumer line is free: 1-877-564-7323.</p>\n")
        real_read, real_iter = legal_check._read, legal_check._iter_no_free_files
        legal_check._read = lambda path: bad
        legal_check._iter_no_free_files = lambda: iter(["docs/print/sample.html"])
        try:
            failures = legal_check.check_no_free()
        finally:
            legal_check._read, legal_check._iter_no_free_files = real_read, real_iter
        self.assertEqual(len(failures), 5, "\n".join(failures))

    def test_no_free_rule_words_stay_in_their_sentence(self):
        """QA 2026-09-29: a rule word in an earlier sentence, or a stray regex token, must not excuse a real offer."""
        bad = ("<p>Never say licensed. We offer a free roof check.</p>\n"
               "<p>Don't worry, the free inspection covers everything.</p>\n"
               "<p>Ask your husband; the inspection is free.</p>\n"
               "<p>El estimado es gratis \\b today.</p>\n"
               "<p>Get a FREE look and a complimentary quote.</p>\n")
        real_read, real_iter = legal_check._read, legal_check._iter_no_free_files
        legal_check._read = lambda path: bad
        legal_check._iter_no_free_files = lambda: iter(["pages/sample.html"])
        try:
            failures = legal_check.check_no_free()
        finally:
            legal_check._read, legal_check._iter_no_free_files = real_read, real_iter
        self.assertEqual(len(failures), 6, "\n".join(failures))

    def test_banned_phrases(self):
        failures = legal_check.check_banned_phrases()
        if failures:
            self.fail(
                f"{len(failures)} banned-phrase hit(s) in docs/print/ or pages/*.html "
                "(real sales/marketing text, not a rule describing the rule itself) - "
                "these are content problems to bring to FilthE, not bugs to fix here:\n"
                + "\n".join(failures)
            )


if __name__ == "__main__":
    unittest.main()
