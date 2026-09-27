"""Industry benchmark ranges (T84) from data/benchmarks.json: stand-in numbers until HMP has its own.

Every figure here is labeled "industry estimate, not your numbers". The file is optional: when it is missing or
unreadable (e.g. an older cloud bundle), load() returns None and every caller skips the comparison quietly.
"""
import json
import os

from .config import ROOT

LABEL = {"en": "industry estimate, not your numbers", "es": "estimado de la industria, no son tus números"}

# weekly funnel rate -> (benchmarks.json key, scale from the file's % to the weekly field's unit, weekly unit)
RATES = {
    "contact_rate": ("doors_to_conversation", 0.01, "share of doors where someone answered (0-1)"),
    "inspection_rate_per_100": ("doors_to_qualified_inspection_new_rep", 1.0,
                                "inspections booked per 100 doors (new rep, first 30 days)"),
    "inspection_rate_per_100_experienced": ("doors_to_qualified_inspection_experienced", 1.0,
                                            "inspections booked per 100 doors (experienced rep)"),
    "appointment_to_inspection": ("appointment_to_inspection", 0.01,
                                  "share of booked appointments that happen (0-1)"),
    "inspection_to_signed": ("inspection_to_signed_contract", 0.01, "share of inspections that sign (0-1)"),
    "avg_dollar_per_signed_job": ("avg_siding_replacement_job_cost", 1.0,
                                 "USD, average value of a signed job (cash-sale siding reference; "
                                 "insurance-restoration payouts run higher - see avg_hail_wind_insurance_payout)"),
}


def default_path(cfg=None):
    p = ((cfg or {}).get("paths") or {}).get("benchmarks") or os.path.join("data", "benchmarks.json")
    return p if os.path.isabs(p) else os.path.join(ROOT, p)


def load(path=None, cfg=None):
    """The benchmarks doc, or None when the file is missing or not valid JSON (never raises)."""
    try:
        with open(path or default_path(cfg), encoding="utf-8") as f:
            doc = json.load(f)
        return doc if isinstance(doc, dict) else None
    except (OSError, ValueError):
        return None


def _num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _range(bench, key, scale):
    e = (bench or {}).get(key)
    if not isinstance(e, dict):
        return None
    lo, ty, hi = (_num(e.get(k)) for k in ("low", "typical", "high"))
    if ty is None:
        return None
    sc = lambda x: None if x is None else round(x * scale, 4)  # noqa: E731
    return {"low": sc(lo), "typical": sc(ty), "high": sc(hi), "source_note": e.get("source") or ""}


def compare(yours, r):
    """"below" / "in range" / "above" the industry range, or None when there's nothing to compare."""
    if yours is None or r is None or r.get("low") is None or r.get("high") is None:
        return None
    return "below" if yours < r["low"] else ("above" if yours > r["high"] else "in range")


def industry_ranges(bench, yours):
    """{label, as_of, confidence, rates{name: {yours, low, typical, high, unit, source_note, vs}}} for the weekly
    funnel rates, `yours` = {rate name: your number or None}. None when there is no benchmarks doc."""
    if not bench:
        return None
    rates = {}
    for name, (key, scale, unit) in RATES.items():
        r = _range(bench, key, scale)
        if r is None:
            continue
        y = yours.get(name)
        rates[name] = {"yours": y, **r, "unit": unit, "label": LABEL["en"], "vs": compare(y, r)}
    if not rates:
        return None
    meta = bench.get("_meta") or {}
    return {"label": dict(LABEL), "as_of": meta.get("as_of"), "confidence": meta.get("confidence"),
            "note": {"en": "Industry estimates from other companies, not your numbers. Your own numbers replace "
                           "them after about 200 doors.",
                     "es": "Estimados de la industria de otras compañías, no son tus números. Tus propios números "
                           "los reemplazan después de unas 200 puertas."},
            "rates": rates}


def doors_per_hour(bench):
    """{low, typical, high, source_note} doors knocked per hour, or None."""
    return _range(bench, "doors_per_hour", 1.0)
