"""Storm stacking + roof-age sweet spot (research 2026-09-29, picks #1 and #2 of docs/research/2026-09-29-insured-homes-data.md).

Storm stacking: a house hit by hail again and again is worth more than one hit once (IBHS lab: weathered roofs plus
repeat sub-severe hail are far more likely to fail). Per house or area we count distinct hail DAYS with a public
ground report >= `min_in` within `hit_km` over the last `seasons` seasons (this year + the ones before), and turn the
count into a small, capped multiplier: 1 day = 1.0, 2 = 1.15, 3+ = 1.3 (config `stacking.factor`). Size and recency
stay the big parts of every score. One plain line for the screens: "Hail here 3 times since 2024".

Roof-age sweet spot: roof age from the re-roof year when known, else year built (a proxy, so always labeled an
estimate): < prime[0] yrs = "young", prime[0]-prime[1] = "prime", older = "check" (check the policy first:
Nebraska carriers increasingly pay older roofs on depreciated or scheduled terms). A flag only, no score change: the
door score's age curve already weighs roof age. A house built more than `built_max` years ago has had new roofs
since, so its line says "roof age unknown" (still "check"). Area home age (Census) is not a roof age: not banded.

Past seasons come from `hh.py stack-history` -> data/hail-history.json (NWS Local Storm Reports via IEM + NOAA NCEI
Storm Events, eastern Nebraska box, no owner names, no report text). This season comes from data/storms-<year>.json.
Nothing here says "insured", damage, or what insurance pays: counts of public hail reports only.
"""
import json
import math
import os
from datetime import date, datetime

from .config import DEFAULTS

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(HERE, "data")
HISTORY = os.path.join(DATA, "hail-history.json")


def scfg(cfg):
    return {**DEFAULTS["stacking"], **((cfg or {}).get("stacking") or {})}


def _km(lat1, lon1, lat2, lon2):
    dy = (lat2 - lat1) * 110.574
    dx = (lon2 - lon1) * 111.32 * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(dx, dy)


def _day(v):
    return v if isinstance(v, date) else date.fromisoformat(str(v)[:10])


# ------------------------------------------------------------------ storm stacking
def since_year(today, sc):
    """First season counted: 3 seasons in 2026 = 2024, 2025, 2026."""
    return _day(today).year - int(sc["seasons"]) + 1


def hail_days(lat, lon, pts, today, sc, radius_km=None, include=()):
    """Sorted distinct storm days (ISO) with a report >= min_in within radius_km of (lat, lon), from since_year(today)
    through today. pts = [[date, lat, lon, size_in], ...]. `include` = days always counted (the walk's own storm)."""
    r = sc["hit_km"] if radius_km is None else radius_km
    first = f"{since_year(today, sc)}-01-01"
    last = _day(today).isoformat()
    days = {d for d in include if d and first <= d <= last}
    for d, la, lo, s in pts:
        if s >= sc["min_in"] and first <= d <= last and d not in days and _km(lat, lon, la, lo) <= r:
            days.add(d)
    return sorted(days)


def factor(count, sc):
    """Capped multiplier for a hail-day count: factor[min(count, len-1)]; 0 or 1 day = 1.0."""
    f = sc["factor"]
    return float(f[max(0, min(int(count), len(f) - 1))])


def stack_line(count, since):
    if count >= 2:
        return {"en": f"Hail here {count} times since {since}", "es": f"Granizo aquí {count} veces desde {since}"}
    if count == 1:
        return {"en": f"First hail here since {since}", "es": f"Primer granizo aquí desde {since}"}
    return {"en": f"No hail reported here since {since}", "es": f"Sin granizo reportado aquí desde {since}"}


def stack(lat, lon, pts, today, cfg=None, radius_km=None, include=()):
    """{count, days[], since, factor, km, line{en, es}} for one house or area."""
    sc = scfg(cfg)
    days = hail_days(lat, lon, pts, today, sc, radius_km, include)
    since = since_year(today, sc)
    return {"count": len(days), "days": days, "since": since, "factor": factor(len(days), sc),
            "km": sc["hit_km"] if radius_km is None else radius_km, "line": stack_line(len(days), since)}


# ------------------------------------------------------------------ roof-age sweet spot
def _year(v):
    try:
        y = int(str(v)[:4])
    except (TypeError, ValueError):
        return None
    return y if 1800 <= y <= 2100 else None


def roof_band(year_built=None, roof_year=None, today=None, cfg=None, age=None, basis=None):
    """{age, band young|prime|check, basis roof|built|area, estimate, line{en, es}} or None when nothing is known.
    Pass `age` directly (e.g. a Census typical home age) with basis "area"."""
    rb = scfg(cfg)["roof_band"]
    today = _day(today or date.today())
    if age is None:
        ry, by = _year(roof_year), _year(year_built)
        y = ry or by
        if not y:
            return None
        age, basis = max(0, today.year - y), (basis or ("roof" if ry else "built"))
    age = int(round(age))
    lo, hi = rb["prime"]
    band = "young" if age < lo else ("prime" if age <= hi else "check")
    est = basis != "roof"
    en_age = f"~{age} yrs" + (" (estimate)" if est else "")
    es_age = f"~{age} años" + (" (estimado)" if est else "")
    who_en, who_es = ("Typical home", "Casa típica") if basis == "area" else ("Roof", "Techo")
    if basis == "built" and age > rb["built_max"]:   # an old house has had new roofs since: its roof age is unknown
        return {"age": age, "band": "check", "basis": basis, "estimate": True,
                "line": {"en": f"Built {today.year - age}: roof age unknown, check the policy first",
                         "es": f"Construida en {today.year - age}: edad del techo desconocida, revisar la póliza primero"}}
    line = {"young": ({"en": f"{who_en} {en_age}: young roof", "es": f"{who_es} {es_age}: techo joven"}),
            "prime": ({"en": f"{who_en} {en_age}: prime roof age", "es": f"{who_es} {es_age}: edad ideal del techo"}),
            "check": ({"en": f"{who_en} {en_age}: check the policy first",
                       "es": f"{who_es} {es_age}: revisar la póliza primero"})}[band]
    return {"age": age, "band": band, "basis": basis, "estimate": est, "line": line}


# ------------------------------------------------------------------ history points
def points_from_reports(reports):
    return [[r["date"], float(r["lat"]), float(r["lon"]), float(r["size_in"])] for r in reports or []]


def load_points(data_dir=DATA, year=None):
    """Every stored hail point: data/hail-history.json (past seasons) + data/storms-<year>.json (this season).
    Missing files are skipped (the cloud bundle may have neither): returns [] then, and scores stay unchanged."""
    pts, seen = [], set()
    files = [os.path.join(data_dir, "hail-history.json")]
    ys = [year] if year else sorted(int(f[7:11]) for f in os.listdir(data_dir)
                                     if f.startswith("storms-") and f[7:11].isdigit()) if os.path.isdir(data_dir) else []
    files += [os.path.join(data_dir, f"storms-{y}.json") for y in ys]
    for f in files:
        try:
            with open(f, encoding="utf-8") as fh:
                doc = json.load(fh)
        except (OSError, ValueError):
            continue
        rows = doc.get("pts") or points_from_reports(doc.get("reports"))
        for p in rows:
            k = (p[0], round(p[1], 3), round(p[2], 3))
            if k not in seen:
                seen.add(k)
                pts.append([p[0], float(p[1]), float(p[2]), float(p[3])])
    return pts


def fetch_history(fetcher, cfg, years, log=print):
    """Past seasons' ground reports (LSR + NCEI, merged like `hh.py season`) as compact points. One failing source
    or year never stops the rest; returns (pts, errors, counts)."""
    from . import season
    sc = season.scfg(cfg)
    tz = cfg.get("timezone", "America/Chicago")
    pts, errors, counts = [], [], {}
    for y in years:
        reports = []
        try:
            obs = season.fetch_lsr(fetcher, cfg, sc, y, date(y, 12, 31))
            reports = [season.report_from_obs(o, "lsr", tz) for o in obs]
        except Exception as e:
            errors.append({"part": f"lsr {y}", "error": f"{type(e).__name__}: {e}"[:200]})
        try:
            nc = season.fetch_ncei(fetcher, sc, y)
            season.merge_reports(reports, [season.report_from_obs(o, "ncei", tz) for o in nc], sc)
        except Exception as e:
            errors.append({"part": f"ncei {y}", "error": f"{type(e).__name__}: {e}"[:200]})
        counts[str(y)] = len(reports)
        log(f"  stack-history {y}: {len(reports)} reports on {len({r['date'] for r in reports})} storm days")
        pts += [[r["date"], r["lat"], r["lon"], r["size_in"]] for r in reports]
    pts.sort()
    return pts, errors, counts


def history_doc(pts, years, cfg, errors=None, counts=None, now=None):
    from . import season
    sc = season.scfg(cfg)
    return {"v": 1, "years": list(years), "as_of": (now or datetime.utcnow()).strftime("%Y-%m-%dT%H:%MZ"),
            "area": {"bbox": sc["bbox"], "states": sc["states"], "min_size_in": sc["min_size_in"]},
            "sources": ["NWS Local Storm Reports (IEM)", "NOAA NCEI Storm Events"],
            "note": "Public hail reports only: [storm day, lat, lon, size in]. No owner names, no report text.",
            "counts": counts or {}, "errors": errors or [], "pts": pts}
