"""Scorecard (T166, round 44): the 5 pilot numbers at a glance - doors knocked, contact rate, inspections booked
per 100 doors, signed jobs, and average $ per signed job - each next to an industry range from data/benchmarks.json
(T84, labeled "industry estimate, not your numbers"). Feeds the `scorecard` section of `hh.py weekly` and the
standalone `hh.py scorecard` command. Same JSON shape for HMP and any future pilot company (`company` id, default
"hmp"), so a second company's numbers sit next to HMP's, apples to apples.

Inputs: `doors` = weekly.load_doors() output; `leads` = weekly.load_leads() output (leads/<slug>); `claims` =
load_claims() output (claims/<slug>, the HMP App's insurance-claim collection, T25/SKILL.md schema) - optional,
weekly.py has no claims of its own yet so its embedded scorecard passes none.

"Signed" (a won job, whatever it's called in the app) means the contract is signed:
- a lead counts once its stage reaches `job_scheduled` in the 9-stage funnel (a job doesn't go on the calendar
  without a signed contract) - `done` counts too; `lost` never does, whatever its index.
- a claim counts once its stage reaches `signed` (`supplement`, `materials_ordered`, `installed`,
  `depreciation_requested`, `paid` too); `lost` never does.
Average $ per signed job = the mean of those signed leads'/claims' own `contract_price` (whichever have one set);
null when none of them do yet (never counted as $0) - `signed_jobs_priced` says how many fed the average.

Unlike doors (which have a `date` and so can be windowed by `start`/`end`), leads/claims have no reliable
signed-date field yet, so every signed one counts toward `signed_jobs` regardless of the window.
"""
from datetime import date

from .benchmarks import industry_ranges
from .weekly import STAGE_KEYS, _items, tally

LEAD_SIGNED_AT = STAGE_KEYS.index("job_scheduled")     # job_scheduled, done count; lost never does
CLAIM_STAGE_KEYS = ["inspected", "claim_filed", "adjuster_set", "scope_in", "signed", "supplement",
                    "materials_ordered", "installed", "depreciation_requested", "paid", "lost"]
CLAIM_SIGNED_AT = CLAIM_STAGE_KEYS.index("signed")


def load_claims(obj):
    """Claim docs (`claims/<slug>`) -> [{id, ...fields}], the same shape as weekly.load_leads."""
    return [{**d, "id": key or d.get("address") or ""} for key, d in _items(obj)]


def _signed(rows, stage_keys, at):
    """Rows whose stage has reached index `at` in `stage_keys` - `lost` never counts, whatever its own index."""
    out = []
    for r in rows:
        s = r.get("stage")
        if s in stage_keys and s != "lost" and stage_keys.index(s) >= at:
            out.append(r)
    return out


def _money(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if x == x and x not in (float("inf"), float("-inf")) else None


def _avg_contract_price(rows):
    """(average, how many priced) of the rows' own `contract_price`; (None, 0) when none are set - never $0."""
    vals = [v for v in (_money(r.get("contract_price")) for r in rows) if v is not None]
    return (round(sum(vals) / len(vals), 2), len(vals)) if vals else (None, 0)


def _as_date(d):
    return date.fromisoformat(d) if isinstance(d, str) else d


def report(doors, leads=None, claims=None, start=None, end=None, today=None, bench=None, company="hmp"):
    """The 5-number scorecard doc. `doors` = every loaded door tap (filtered here to [start, end] inclusive;
    either None = every door tap, same "all" meaning as weekly.report's `week="all"`). `start`/`end` = date or
    "YYYY-MM-DD". `leads`/`claims` = every loaded doc, never window-filtered (see module docstring). `bench` =
    benchmarks.load() doc (T84); None -> `industry` is null. `company` names whose numbers these are."""
    start, end = _as_date(start), _as_date(end)
    doors = list(doors or [])
    leads = list(leads or [])
    claims = list(claims or [])
    rows = doors if start is None or end is None else \
        [d for d in doors if d["date"] and start.isoformat() <= d["date"] <= end.isoformat()]
    t = tally(rows)
    signed = _signed(leads, STAGE_KEYS, LEAD_SIGNED_AT) + _signed(claims, CLAIM_STAGE_KEYS, CLAIM_SIGNED_AT)
    avg_price, priced = _avg_contract_price(signed)
    sign_rate = round(len(signed) / t["booked"], 3) if t["booked"] else None
    yours = {"contact_rate": t["contact_rate"] if t["doors"] else None,
             "inspection_rate_per_100": t["inspection_rate_per_100"] if t["doors"] else None,
             "inspection_rate_per_100_experienced": t["inspection_rate_per_100"] if t["doors"] else None,
             "inspection_to_signed": sign_rate,
             "avg_dollar_per_signed_job": avg_price}
    today = _as_date(today) or end or date.today()
    return {
        "company": company or "hmp",
        "from": start.isoformat() if start else None, "to": end.isoformat() if end else None,
        "as_of": today.isoformat(),
        "metrics": {
            "doors_knocked": t["doors"],
            "contact_rate": t["contact_rate"],
            "inspections_per_100_doors": t["inspection_rate_per_100"],
            "signed_jobs": len(signed),
            "avg_dollar_per_signed_job": avg_price,
        },
        "signed_jobs_priced": priced,
        "industry": industry_ranges(bench, yours),
    }
