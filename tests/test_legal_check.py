"""Wires tests/legal_check.py (T72's legal/compliance text check) into `hh.py selftest`."""
import unittest

from tests import legal_check


class TestLegalCheck(unittest.TestCase):
    def test_statute_match(self):
        failures = legal_check.check_statute_match()
        self.assertEqual(failures, [], "\n".join(failures))

    def test_cancel_notice_elements(self):
        failures = legal_check.check_cancel_notice_elements()
        self.assertEqual(failures, [], "\n".join(failures))

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
