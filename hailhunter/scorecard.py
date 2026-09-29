"""Scorecard (T166, round 44; T209 added the Aldaba proof numbers, round 58): the pilot numbers at a glance -
doors knocked, contact rate, inspections booked per 100 doors, signed jobs, signed-job rate (signed / inspections),
average $ per signed job, and knock-to-signed time (median days) - each next to an industry range from
data/benchmarks.json (T84, labeled "industry estimate, not your numbers") where one exists. These are HMP's own
pilot case-study numbers (docs/research/2026-09-28-aldaba-business.md): the receipts for selling Aldaba later, not
a promise to anyone. Feeds the `scorecard` section of `hh.py weekly` and the standalone `hh.py scorecard` command.
Same JSON shape for HMP and any future pilot company (`company` id, default "hmp"), so a second company's numbers
sit next to HMP's, apples to apples.

Inputs: `doors` = weekly.load_doors() output; `leads` = weekly.load_leads() output (leads/<slug>); `claims` =
load_claims() output (claims/<slug>, the HMP App's insurance-claim collection, T25/SKILL.md schema) - optional,
weekly.py has no claims of its own yet so its embedded scorecard passes none unless `hh.py weekly --claims` is given.

"Signed" (a won job, whatever it's called in the app) means the contract is signed:
- a lead counts once its stage reaches `job_scheduled` in the 9-stage funnel (a job doesn't go on the calendar
  without a signed contract) - `done` counts too; `lost` never does, whatever its index.
- a claim counts once its stage reaches `signed` (`supplement`, `materials_ordered`, `installed`,
  `depreciation_requested`, `paid` too); `lost` never does.
Average $ per signed job = the mean of those signed leads'/claims' own `contract_price` (whichever have one set);
null when none of them do yet (never counted as $0) - `signed_jobs_priced` says how many fed the average.

Unlike doors (which have a `date` and so can be windowed by `start`/`end`), leads/claims have no reliable
signed-date field yet, so every signed one counts toward `signed_jobs` regardless of the window.

Knock-to-signed time (T209): median days from the first door tap at an address to that job's real signed date.
Leads still have no signed-date field, so only claims (which record one in `job.contract_signed`, the Job
tracker's step 4, YYYY-MM-DD - see docs/app/jobtrack.js) can feed this; a signed row with no matching door tap or
no `job.contract_signed` yet is left out rather than guessed. `knock_to_signed_days` is null with `n: 0` until at
least one signed job has both dates - never invented.
"""
import statistics
from datetime import date

from .benchmarks import industry_ranges
from .weekly import STAGE_KEYS, _items, slug, tally

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


def _knock_dates(doors):
    """address slug -> earliest door-tap date (YYYY-MM-DD), from every door tap (never windowed - a knock can
    predate the reporting window)."""
    out = {}
    for d in doors or []:
        day, addr = d.get("date"), slug(d.get("address"))
        if not day or not addr:
            continue
        if addr not in out or day < out[addr]:
            out[addr] = day
    return out


def _signed_date(row):
    """The real date a signed row's contract was signed, only when the schema actually records one: a claim's
    `job.contract_signed` (YYYY-MM-DD, T199 Job tracker step 4). Leads have no such field yet (T209) - returns
    None rather than guessing one."""
    job = row.get("job")
    d = str((job or {}).get("contract_signed") or "")[:10] if isinstance(job, dict) else ""
    try:
        date.fromisoformat(d)
        return d
    except ValueError:
        return None


def _knock_to_signed_days(signed_rows, knock_dates):
    """(median days, how many signed rows fed it) from first knock to `job.contract_signed`, for the signed rows
    that have both a matching door tap (by address slug) and a recorded signed date; (None, 0) with neither."""
    days = []
    for r in signed_rows:
        signed = _signed_date(r)
        knocked = knock_dates.get(slug(r.get("address") or r.get("id")))
        if not signed or not knocked:
            continue
        gap = (date.fromisoformat(signed) - date.fromisoformat(knocked)).days
        if gap >= 0:                                # a signed date before the first known knock isn't trustworthy
            days.append(gap)
    return (statistics.median(days), len(days)) if days else (None, 0)


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
    knock_to_signed, knock_to_signed_n = _knock_to_signed_days(signed, _knock_dates(doors))
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
            "signed_job_rate": sign_rate,                      # T209: signed / inspections (booked), 0-1, null if no inspections yet
            "avg_dollar_per_signed_job": avg_price,
        },
        "signed_jobs_priced": priced,
        # T209: median days from first door knock to a claim's real job.contract_signed date; leads have no signed
        # date yet so only claims feed this (see module docstring) - null/0 rather than a guess until one does.
        "knock_to_signed_days": {"median": knock_to_signed, "n": knock_to_signed_n},
        "industry": industry_ranges(bench, yours),
    }
