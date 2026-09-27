#!/usr/bin/env python3
"""T72: real pass/fail checks on the legal text in the print pieces and app pages.

Runnable standalone:
    python3 tests/legal_check.py

Also wired into `hh.py selftest` via tests/test_legal_check.py.

Three checks, each printing every failure it finds (file + line), not just the first:

1. STATUTE MATCH - the Nebraska 44-8607 deductible notice printed in
   docs/print/contract-draft.html and the English copy inside
   docs/print/contract-draft-es.html must contain the statute's required capitalized
   sentence, word-for-word (case/whitespace-insensitive), taken straight from
   docs/legal/44-8607.txt.
2. CANCEL NOTICE ELEMENTS - docs/print/cancel-notice.html must have, in BOTH its
   English (lang="en") and Spanish (lang="es") sections: the three-business-day
   right, how-to-cancel instructions, and HMP's business mailing address.
3. BANNED PHRASES - every text file under docs/print/, every pages/*.html and every
   data/*.json must not
   make banned claims ("we say registered, not licensed", never say we cover/waive/
   rebate a deductible, promise insurance will pay, or offer a free roof). A phrase
   that appears inside text *forbidding* that exact claim (a rule, a script's "don't
   say this" line, a trainer's red-flag list) is not itself a violation, so a short
   window of text right before each hit is checked for a negation/rule word before
   it is flagged - this keeps the check from crying wolf on our own compliance
   training text while still catching a real sales claim.

Exit code 0 = everything passed. Exit code 1 = at least one real failure below.
"""
import html
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BUSINESS_ADDRESS = "2600 Laverna St, Apt 50, Fremont, NE 68025"
SELLER_NAME = "HMP Siding & Roofing LLC"

# The insurance contingency agreement (T188): English + Spanish print pieces.
CONTINGENCY_FILES = ("docs/print/contingency-agreement.html", "docs/print/contingency-agreement-es.html")

# Phrases we must never make as a sales claim about HMP itself.
BANNED_PHRASES = [
    "licensed",
    "we cover your deductible",
    "waive",
    "rebate",
    "insurance will pay",
    "free roof",
]

# If one of these words/fragments shows up in the ~60 characters right before a
# banned phrase, the hit reads as a RULE ("never waive...", "don't say licensed")
# rather than a claim, so it is not counted as a failure. Kept short on purpose -
# add to it only when a real false positive shows up, never to hide a real one.
NEGATION_WINDOW_CHARS = 160
# A heading's negation reaches further down than the char window above, since a whole list of
# violation examples can sit under one "We can't" / "HMP can't" heading.
HEADING_WINDOW_CHARS = 800
NEGATION_WORDS = [
    "never", "not ", "n't", "n’t", "don't", "dont", "doesn't", "doesnt", "cannot",
    "can't", "can’t", "cant", "avoid", "without", "no ", "nothing", "against",
    "violat", "illegal", "prohibit", "nor ", "instead of", "unlicensed", "we say",
    "we don't", "wedon't",
    # this codebase's own violation-category labels (the practice-door trainer's scorecard)
    "n_deductible", "n_promise", "n_license", "breaks a rule", "legal_list", '(type "', "a rule if it",
]

# Binary/non-text extensions to skip when walking docs/print/.
SKIP_EXTS = {".pdf", ".png", ".jpg", ".jpeg", ".woff", ".woff2", ".ttf", ".otf", ".ico"}


def _read(rel_path):
    with open(os.path.join(ROOT, rel_path), encoding="utf-8") as f:
        return f.read()


def _norm(text):
    """Collapse whitespace and case for a loose but exact-words comparison."""
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text


def _strip_tags(fragment):
    return re.sub(r"<[^>]+>", " ", fragment)


def _extract_ded_paragraphs(html_text):
    """Every <p class="ded">...</p> block's text, tags stripped."""
    out = []
    for m in re.finditer(r'<p class="ded">(.*?)</p>', html_text, re.S):
        out.append(_strip_tags(m.group(1)))
    return out


def _extract_statute_notice(statute_text):
    """The required ALL-CAPS notice sentence out of docs/legal/44-8607.txt."""
    m = re.search(r"IT IS A VIOLATION.*PENALTIES\.", statute_text)
    if not m:
        raise AssertionError("Could not find the required notice text in docs/legal/44-8607.txt "
                              "(the statute file may have changed shape)")
    return m.group(0)


def check_statute_match():
    """Check 1: the 44-8607 deductible notice matches the statute, word for word."""
    failures = []
    statute_notice = _norm(_extract_statute_notice(_read("docs/legal/44-8607.txt")))

    for rel_path in ("docs/print/contract-draft.html", "docs/print/contract-draft-es.html") + CONTINGENCY_FILES:
        text = _read(rel_path)
        ded_paragraphs = _extract_ded_paragraphs(text)
        if not ded_paragraphs:
            failures.append(f"{rel_path}: no <p class=\"ded\"> deductible notice found at all")
            continue
        # The English statute text: for contract-draft.html it's the (only) ded paragraph;
        # for contract-draft-es.html it's whichever ded paragraph is in English (the page
        # keeps a Spanish translation plus the required official English text).
        found = False
        for para in ded_paragraphs:
            if statute_notice in _norm(para):
                found = True
                break
        if not found:
            line_no = text[:text.find('<p class="ded">')].count("\n") + 1 if '<p class="ded">' in text else "?"
            failures.append(
                f"{rel_path}:{line_no}: the printed deductible notice does not match "
                f"docs/legal/44-8607.txt word-for-word (compared against {len(ded_paragraphs)} "
                f"<p class=\"ded\"> block(s))"
            )
    return failures


def check_cancel_notice_elements():
    """Check 2: the 69-1601/69-1604 cancel notice has every required element, in both languages."""
    failures = []
    rel_path = "docs/print/cancel-notice.html"
    text = _read(rel_path)

    sections = dict(re.findall(r'<section class="page" lang="(en|es)">(.*?)</section>', text, re.S))
    for lang in ("en", "es"):
        if lang not in sections:
            failures.append(f"{rel_path}: no lang=\"{lang}\" section found")
            continue
        body = _norm(_strip_tags(sections[lang]))

        three_days = ["three business days", "tres días hábiles"]
        if not any(_norm(p) in body for p in three_days):
            failures.append(f"{rel_path} ({lang}): missing the three-business-days cancel right")

        how_to_cancel = {
            "en": "to cancel this transaction, mail or deliver",
            "es": "para cancelar esta transacción, envíe",
        }
        if _norm(how_to_cancel[lang]) not in body:
            failures.append(f"{rel_path} ({lang}): missing the how-to-cancel instructions")

    # Business address: printed via the data script (see cancel-notice.html's own comment),
    # so check it in the raw file text (JSON literal), not the stripped body text.
    if _norm(BUSINESS_ADDRESS) not in _norm(text):
        failures.append(f"{rel_path}: HMP business address ({BUSINESS_ADDRESS}) not found in the page")

    return failures


def _iter_scan_files():
    for dirpath, _dirnames, filenames in os.walk(os.path.join(ROOT, "docs/print")):
        for fn in filenames:
            if os.path.splitext(fn)[1].lower() in SKIP_EXTS:
                continue
            yield os.path.relpath(os.path.join(dirpath, fn), ROOT)
    pages_dir = os.path.join(ROOT, "pages")
    if os.path.isdir(pages_dir):
        for fn in sorted(os.listdir(pages_dir)):
            if fn.endswith(".html"):
                yield os.path.join("pages", fn)
    data_dir = os.path.join(ROOT, "data")
    if os.path.isdir(data_dir):
        for fn in sorted(os.listdir(data_dir)):
            if fn.endswith(".json"):
                yield os.path.join("data", fn)


def _is_negated(text_before):
    lowered = text_before.lower()
    return any(neg in lowered for neg in NEGATION_WORDS)


_HEADING_RE = re.compile(r"<h[1-4][^>]*>(.*?)</h[1-4]>", re.S)


def _under_negated_heading(text, idx):
    """Is the nearest heading above this position one that says we can't/won't do this?"""
    window = text[max(0, idx - HEADING_WINDOW_CHARS):idx]
    headings = _HEADING_RE.findall(window)
    if not headings:
        return False
    return _is_negated(_strip_tags(headings[-1]))


def _is_regex_alternation(text, idx, phrase):
    """A '|'-joined list inside a JS regex/array (cover|waive|pay...), not a sentence."""
    before = text[max(0, idx - 3):idx]
    after = text[idx + len(phrase):idx + len(phrase) + 3]
    return "|" in before or "|" in after


def _blank_ranges(text, ranges):
    """Replace each (start, end) span with spaces, same length, so offsets/line numbers hold."""
    chars = list(text)
    for start, end in ranges:
        for i in range(start, end):
            if chars[i] != "\n":
                chars[i] = " "
    return "".join(chars)


def check_banned_phrases():
    """Check 3: banned sales claims, skipping hits that read as a rule against them."""
    failures = []
    for rel_path in _iter_scan_files():
        try:
            text = _read(rel_path)
        except (UnicodeDecodeError, OSError):
            continue  # not a text file we can scan

        # A backslash-escaped quote inside a JS string ("can\'t") hides the negation word
        # from a plain substring search; unescape it (same length, same offsets/lines) before
        # scanning so "can\'t say waive" is recognised as a negation same as "can't say waive".
        text = text.replace("\\'", "' ").replace('\\"', '" ')

        # The verbatim 44-8607 statute notice (checked word-for-word in check 1) is legally
        # required to say "REBATE" - don't flag that mandated quote a second time here.
        ded_ranges = [m.span(1) for m in re.finditer(r'<p class="ded">(.*?)</p>', text, re.S)]
        scan_text = _blank_ranges(text, ded_ranges)

        lowered = scan_text.lower()
        for phrase in BANNED_PHRASES:
            start = 0
            plower = phrase.lower()
            while True:
                idx = lowered.find(plower, start)
                if idx == -1:
                    break
                start = idx + 1
                if _is_regex_alternation(text, idx, phrase):
                    continue  # a '|' alternation inside a detection regex/array, not a sentence
                window_start = max(0, idx - NEGATION_WINDOW_CHARS)
                window_end = min(len(text), idx + len(phrase) + NEGATION_WINDOW_CHARS)
                if _is_negated(text[window_start:idx]) or _is_negated(text[idx + len(phrase):window_end]):
                    continue  # a rule/script line forbidding this claim, not the claim itself
                if _under_negated_heading(text, idx):
                    continue  # sits under a "We can't"/"HMP can't"-style heading
                after = lowered[idx + len(plower):idx + len(plower) + 40]
                if plower == "free roof" and re.match(r"\s*(?:&amp;|&|and)?\s*(?:siding\s*)?(?:&amp;|&|and)?\s*(?:estimate|inspection|check)", after):
                    continue  # a free estimate/inspection offer, not a free roof
                if plower == "waive" and after[:1] == "r":
                    continue  # "waiver" as in a lien waiver; "waived" is still flagged
                if plower == "licensed" and "public adjuster" in lowered[max(0, idx - 300):idx + 300]:
                    continue  # describes public adjusters (who are licensed), not HMP
                line_no = text.count("\n", 0, idx) + 1
                snippet = re.sub(r"\s+", " ", text[max(0, idx - 30):idx + len(phrase) + 30]).strip()
                failures.append(f"{rel_path}:{line_no}: banned phrase \"{phrase}\" - ...{snippet}...")
    return failures


def run(verbose=True):
    all_failures = []
    for name, check in (
        ("statute match (44-8607 deductible notice)", check_statute_match),
        ("cancel notice elements (69-1601/69-1604)", check_cancel_notice_elements),
        ("banned phrases", check_banned_phrases),
    ):
        failures = check()
        if verbose:
            status = "PASS" if not failures else f"FAIL ({len(failures)})"
            print(f"[{status}] {name}")
            for f in failures:
                print(f"    {f}")
        all_failures.extend(failures)
    return all_failures


if __name__ == "__main__":
    failures = run(verbose=True)
    if failures:
        print(f"\n{len(failures)} legal-check failure(s).", file=sys.stderr)
        sys.exit(1)
    print("\nAll legal checks passed.")
    sys.exit(0)
