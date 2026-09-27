#!/usr/bin/env python3
"""T72: real pass/fail checks on the legal text in the print pieces and app pages.

Runnable standalone:
    python3 tests/legal_check.py

Also wired into `hh.py selftest` via tests/test_legal_check.py.

Five checks, each printing every failure it finds (file + line), not just the first:

1. STATUTE MATCH - the Nebraska 44-8607 deductible notice printed in
   docs/print/contract-draft.html, docs/print/contingency-agreement.html and the English
   copy inside docs/print/contract-draft-es.html / contingency-agreement-es.html must
   contain the statute's required capitalized sentence, word-for-word
   (case/whitespace-insensitive), taken straight from docs/legal/44-8607.txt.
2. CANCEL NOTICE ELEMENTS - docs/print/cancel-notice.html must have, in BOTH its
   English (lang="en") and Spanish (lang="es") sections: the three-business-day
   right, how-to-cancel instructions, and HMP's business mailing address.
2b. CONTINGENCY AGREEMENT ELEMENTS (T188) - docs/print/contingency-agreement.html (EN)
   and -es.html (ES): contingent on approval / nothing owed on denial, the 69-1604(1)
   notice word for word from docs/legal/69-1604.txt, the 44-8603 insurance cancel right,
   2 Notice of Cancellation copies per language (the ES file adds 2 English copies for
   69-1604(3)), no assignment / not on the check (44-8605), the 44-8606 itemized-
   description promise, address + phone, the registration line, the draft note, and
   never "licensed/licenciado".
3. BANNED PHRASES - every text file under docs/print/, every pages/*.html and every
   data/*.json must not
   make banned claims ("we say registered, not licensed", never say we cover/waive/
   rebate a deductible, promise insurance will pay, or offer a free roof). A phrase
   that appears inside text *forbidding* that exact claim (a rule, a script's "don't
   say this" line, a trainer's red-flag list) is not itself a violation, so a short
   window of text right before each hit is checked for a negation/rule word before
   it is flagged - this keeps the check from crying wolf on our own compliance
   training text while still catching a real sales claim.
4. COOLING-OFF TYPE - FTC 16 CFR 429.1 + Neb. 69-1604(1): the
   buyer's-right-to-cancel statement and every Notice of Cancellation copy in the contract
   drafts, cancel-notice.html and the contingency agreements must render at >= 10pt bold
   (statement in capital and lowercase), no copy clipped off its page. Measured in headless
   Chromium by tests/print_type_check.js; skipped (not failed) where no browser exists.

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


# Required wording in the contingency agreement, per language (compared after tags are stripped and
# case/whitespace are normalized). Each entry = (what it proves, the exact phrase that must be there).
_CONTINGENCY_REQUIRED = {
    "en": [
        ("header note: draft, pending attorney review", "draft, pending attorney review"),
        ("contingent on the insurer approving the claim", "this agreement is contingent on your insurer approving your claim"),
        ("denied claim: homeowner owes nothing, agreement ends", "if your insurer denies the claim, you owe hmp nothing and this agreement ends"),
        ("no promise the insurer approves or pays", "hmp makes no promise that your insurer will approve or pay"),
        ("HMP never negotiates the claim", "negotiate or settle your claim, or speak for you with your insurer"),
        ("not a public adjuster", "act as your public adjuster"),
        ("44-8605: no assignment, HMP not on the check",
         "this agreement does not assign any of them to hmp, and hmp is not named as a payee or co-payee on any insurance check"),
        ("44-8606: itemized description to the insured AND the insurer before work",
         "before any repair or replacement work starts, hmp will give you and your insurer an itemized description"),
        ("44-8603: cancel after the insurer's written not-covered notice",
         "you may also cancel until midnight of the third business day after you receive written notice from your insurer that all or part of the claim"),
        ("FTC / 69-1604 caption", "buyer's right to cancel"),
        ("FTC right-to-cancel sentence",
         "you, the buyer, may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction"),
        ("cancel form: three business days", "within three business days"),
        ("cancel form: how to cancel", "to cancel this transaction, mail or deliver"),
        ("registration line (registered, number left blank)", "registered nebraska contractor #"),
        ("company phone", "402-889-3385"),
    ],
    "es": [
        ("header note: borrador, pendiente de revisión", "borrador, pendiente de revisión por un abogado"),
        ("contingent on the insurer approving the claim", "este acuerdo depende de que su aseguradora apruebe su reclamo"),
        ("denied claim: homeowner owes nothing, agreement ends",
         "si su aseguradora niega el reclamo, usted no le debe nada a hmp y este acuerdo termina"),
        ("no promise the insurer approves or pays", "hmp no promete que su aseguradora vaya a aprobar o pagar"),
        ("HMP never negotiates the claim", "negociar su reclamo ni el pago del seguro, ni hablar por usted con su aseguradora"),
        ("not a public adjuster", "actuar como su ajustador público"),
        ("44-8605: no assignment, HMP not on the check",
         "este acuerdo no le cede ninguno a hmp, y hmp no aparece como beneficiario ni cobeneficiario en ningún cheque del seguro"),
        ("44-8606: itemized description to the insured AND the insurer before work",
         "antes de empezar cualquier trabajo de reparación o reemplazo, hmp les entregará a usted y a su aseguradora una descripción detallada"),
        ("44-8603: cancel after the insurer's written not-covered notice",
         "también puede cancelar hasta la medianoche del tercer día hábil después de recibir un aviso por escrito de su aseguradora de que todo o parte del reclamo"),
        ("caption (Spanish)", "derecho del comprador a cancelar"),
        ("FTC right-to-cancel sentence (Spanish)",
         "usted, el comprador, puede cancelar esta transacción en cualquier momento antes de la medianoche del tercer día hábil"),
        ("cancel form: three business days (Spanish)", "dentro de tres días hábiles"),
        ("cancel form: how to cancel (Spanish)", "para cancelar esta transacción, envíe por correo"),
        # 69-1604(3): HMP sells in Spanish, so the cancel notice is also given in English.
        ("69-1604(3): caption also in English", "buyer's right to cancel"),
        ("69-1604(3): FTC sentence also in English",
         "you, the buyer, may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction"),
        ("69-1604(3): English cancel form, three business days", "within three business days"),
        ("69-1604(3): English cancel form, how to cancel", "to cancel this transaction, mail or deliver"),
        ("registration line (registrado, number left blank)", "contratista registrado en nebraska #"),
        ("company phone", "402-889-3385"),
    ],
}

# Tear-off Notice of Cancellation copies: the FTC rule wants the buyer handed two, per language given.
_FORM_END = {"en": "i hereby cancel this transaction", "es": "por medio de la presente cancelo esta transacción"}
_CONTINGENCY_FORM_COPIES = {
    "docs/print/contingency-agreement.html": {"en": 2},
    "docs/print/contingency-agreement-es.html": {"es": 2, "en": 2},
}

# Words that must never describe HMP (it is "registered", never "licensed") - checked in the visible text.
_NEVER_WORDS = ("licensed", "licenciado", "licencia")


def _extract_1604_notice(statute_text):
    """69-1604(1)'s required notice, with HMP's name and mailing address put where the statute says to."""
    m = re.search(r"You may cancel this agreement by mailing a written notice to \(Insert name and mailing address of "
                  r"seller\) before midnight.*?adding your name and address\.", statute_text, re.S)
    if not m:
        raise AssertionError("Could not find the 69-1604(1) notice in docs/legal/69-1604.txt "
                             "(the statute file may have changed shape)")
    return m.group(0).replace("(Insert name and mailing address of seller)", f"{SELLER_NAME}, {BUSINESS_ADDRESS}")


def check_contingency_elements():
    """Check 4: the contingency agreement (T188) has every required element, in English and Spanish.

    The 44-8607 deductible notice in these files is checked word for word by check 1; this check covers
    the rest: contingent on approval / nothing owed on denial, the 69-1604(1) notice word for word, the
    44-8603 insurance cancel right, both cancel forms, no assignment (44-8605), the 44-8606 promise, HMP's
    address and phone, the registration line, the draft note, and never "licensed/licenciado".
    """
    failures = []
    notice_1604 = _norm(_extract_1604_notice(_read("docs/legal/69-1604.txt")))
    for rel_path, lang in zip(CONTINGENCY_FILES, ("en", "es")):
        try:
            raw = _read(rel_path)
        except OSError:
            failures.append(f"{rel_path}: file not found")
            continue
        visible = re.sub(r"<!--.*?-->", " ", raw, flags=re.S)
        visible = re.sub(r"<(style|script)\b.*?</\1>", " ", visible, flags=re.S)
        body = _norm(_strip_tags(visible))

        for label, phrase in _CONTINGENCY_REQUIRED[lang]:
            if _norm(phrase) not in body:
                failures.append(f"{rel_path}: missing {label} (\"{phrase}\")")

        # 69-1604(1) notice, word for word, in English in both files (the Spanish file also gives it in English).
        if notice_1604 not in body:
            failures.append(f"{rel_path}: the 69-1604(1) BUYER'S RIGHT TO CANCEL notice does not match "
                            f"docs/legal/69-1604.txt word for word (with HMP's name and address inserted)")

        if _norm(BUSINESS_ADDRESS) not in body:
            failures.append(f"{rel_path}: HMP business address ({BUSINESS_ADDRESS}) not printed")
        if _norm(SELLER_NAME) not in body:
            failures.append(f"{rel_path}: seller name ({SELLER_NAME}) not printed")

        for form_lang, want in _CONTINGENCY_FORM_COPIES[rel_path].items():
            got = body.count(_FORM_END[form_lang])
            if got < want:
                failures.append(f"{rel_path}: {got} {form_lang.upper()} Notice of Cancellation cop(ies), need {want}")

        for word in _NEVER_WORDS:
            if re.search(r"\b" + word + r"\b", body):
                failures.append(f"{rel_path}: says \"{word}\" (HMP is registered, never licensed)")
    return failures


class PrintTypeUnavailable(Exception):
    """No Node/Playwright/Chromium here (e.g. the cloud bundle): check 5 can't measure, so it is skipped."""


def check_print_type():
    """Check 4: the cooling-off type rules, measured on the rendered pages.

    FTC 16 CFR 429.1(a)/(b) and Neb. 69-1604(1): the buyer's-right-to-cancel statement and every Notice of
    Cancellation copy in at least 10-point BOLD (the statement also in capital and lowercase letters), and no
    copy clipped off its page. Runs tests/print_type_check.js (headless Chromium, print media) over the
    contract drafts, cancel-notice.html and the contingency agreements. Raises PrintTypeUnavailable when
    there is no browser to measure with.
    """
    import json
    import shutil
    import subprocess

    script = os.path.join(ROOT, "tests", "print_type_check.js")
    node = shutil.which("node")
    if not node or not os.path.exists(script):
        raise PrintTypeUnavailable("node or tests/print_type_check.js not found")
    try:
        proc = subprocess.run([node, script, "--json"], cwd=ROOT, capture_output=True, text=True, timeout=180)
    except subprocess.TimeoutExpired:
        return ["tests/print_type_check.js timed out after 180 s"]
    lines = [ln for ln in proc.stdout.splitlines() if ln.startswith("{")]
    if not lines:
        if proc.returncode == 2:
            raise PrintTypeUnavailable((proc.stderr or "could not start the browser").strip().splitlines()[-1][:200])
        return [f"tests/print_type_check.js gave no result (exit {proc.returncode}): {proc.stderr.strip()[:300]}"]
    result = json.loads(lines[-1])
    if result.get("ok") is None:
        raise PrintTypeUnavailable(result.get("unavailable") or "browser unavailable")
    return list(result.get("failures") or [])


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


# Check 6 (T174, 69-1602): the app's door openers say the salesman's name, HMP and what we sell BEFORE the hook.
DOOR_APP = "pages/hmp-app.html"
# `doorIns: r => `...`` style Sale Guide openers; `${r` is the storm/old-house hook slot.
_DOOR_RE = re.compile(r"\b(door[A-Z]\w*):\s*r\s*=>\s*`([^`]*)`")
_NAME_TOKENS = ("${SETTINGS.people.en.first}", "${SETTINGS.people.es.first}",
                "${SETTINGS.people.en.name}", "${SETTINGS.people.es.name}")
_SELL_WORDS = ("roof", "siding", "techo", "gutter", "canaleta")


def check_door_openers():
    """Every app door opener: name, then company, then what we sell, all before the `${r` hook (Neb. 69-1602)."""
    text = _read(DOOR_APP)
    failures, found = [], 0
    for m in _DOOR_RE.finditer(text):
        key, body = m.group(1), m.group(2)
        if "${r" not in body:
            continue
        found += 1
        line = text.count("\n", 0, m.start()) + 1
        head = body[: body.index("${r")]
        where = f"{DOOR_APP}:{line} ({key})"
        if not any(t in head for t in _NAME_TOKENS):
            failures.append(f"{where}: no salesman name before the hook (69-1602: name first)")
        if "${SETTINGS.company.name}" not in head:
            failures.append(f"{where}: company name not before the hook (69-1602)")
        if not any(w in head.lower() for w in _SELL_WORDS):
            failures.append(f"{where}: what we sell (roofs/siding) not said before the hook (69-1602)")
    if not found:
        failures.append(f"{DOOR_APP}: no door openers found (door*: r => `...${{r}}...`); did the Sale Guide move?")
    return failures


def run(verbose=True):
    all_failures = []
    for name, check in (
        ("statute match (44-8607 deductible notice)", check_statute_match),
        ("cancel notice elements (69-1601/69-1604)", check_cancel_notice_elements),
        ("contingency agreement elements (44-8603/05/06, 69-1604)", check_contingency_elements),
        ("banned phrases", check_banned_phrases),
        ("cooling-off type: 10pt bold statement + cancel forms (16 CFR 429.1, 69-1604)", check_print_type),
        ("app door openers: name, HMP, what we sell before the hook (69-1602)", check_door_openers),
    ):
        try:
            failures = check()
        except PrintTypeUnavailable as why:
            if verbose:
                print(f"[SKIP] {name}: {why}")
            continue
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
