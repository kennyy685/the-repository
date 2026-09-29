"""`hh.py season`: this season's REAL hail in eastern Nebraska for the open map (Path step 4) -> data/storms-<year>.json.

Public sources only, each report keeps where it came from:
  lsr   NWS Local Storm Reports (Iowa Environmental Mesonet API): spotters, police, public, near real time
  spc   NOAA Storm Prediction Center daily hail reports (the checked list the news uses)
  ncei  NOAA NCEI Storm Events database (the official record, months behind)
  radar NOAA NCEI SWDI NEXRAD hail signatures (per radar scan, max size estimate)
  mrms  NOAA MRMS MESH, 1 km radar hail size grid, 24 h max per storm day (AWS open data)
Likely-insured signals come from the US Census ACS 5-year tables per block group / town: owner-lived share (B25003),
mortgage share (B25081), owners who moved in recently (B25038, a recent-sale proxy), year built (B25034/B25035, a
roof-age hint). No owner names, no houses: the file holds reports, zones and area numbers only. We never say a home is
"insured": the fields are "likely insured" signals.

Its own network step, never part of `refresh`: hud.json and the 6:54 AM Storm Watch run don't change. A source that
fails is listed in `errors` and the rest still ship. Field list: docs/design/open-map/DATA-2026.md.
"""
import csv
import gzip
import io
import json
import math
import os
import re
import time
import zipfile
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from .config import DEFAULTS
from .geo import haversine_mi
from .models import iso
from . import stacking
from .sources import lsr, stormevents, swdi

KM_PER_MI = 1.609344
SPC_URL = "https://www.spc.noaa.gov/climo/reports/{d:%y%m%d}_rpts_hail.csv"
ACS_DIR = "https://www2.census.gov/programs-surveys/acs/summary_file/{y}/table-based-SF/data/5YRData/acsdt5y{y}-{t}.dat"
TIGER_BG = "https://www2.census.gov/geo/tiger/TIGER{y}/BG/tl_{y}_31_bg.zip"
GAZ_PLACE = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/{y}_Gazetteer/{y}_gaz_place_31.txt"
# B25038 owner lines 003 + 004 = owners who moved in since this year (labels checked per vintage on api.census.gov)
RECENT_SINCE = {"2024": 2020, "2023": 2018}
YEAR_COLS = [f"B25034_E{k:03d}" for k in range(2, 12)]           # built 2020+ ... 1939 or earlier
BEFORE_2000 = YEAR_COLS[3:]                                        # 1990s and older
TABLES = {"b25001": {"B25001_E001": "homes"},
          "b25003": {"B25003_E001": "occupied", "B25003_E002": "owner"},
          "b25081": {"B25081_E001": "mort_total", "B25081_E002": "mort_with"},
          "b25035": {"B25035_E001": "med_year"},
          "b25034": {"B25034_E001": "built_total", **{c: c for c in YEAR_COLS}},
          "b25038": {"B25038_E002": "own_total", "B25038_E003": "own_recent1", "B25038_E004": "own_recent2"}}
SOURCES = {
    "lsr": ("NWS Local Storm Reports", "https://mesonet.agron.iastate.edu/request/gis/lsrs.phtml"),
    "spc": ("NOAA Storm Prediction Center reports", "https://www.spc.noaa.gov/climo/reports/"),
    "ncei": ("NOAA NCEI Storm Events database", "https://www.ncdc.noaa.gov/stormevents/"),
    "radar": ("NOAA NCEI NEXRAD hail signatures (SWDI)", "https://www.ncei.noaa.gov/swdiws/"),
    "mrms": ("NOAA MRMS MESH radar hail size", "https://registry.opendata.aws/noaa-mrms-pds/"),
    "census": ("US Census ACS 5-year + TIGER", "https://www.census.gov/programs-surveys/acs"),
}
SIZE_NAMES = [(4.5, "softball", "pelota de softbol"), (4.0, "grapefruit", "toronja"), (3.0, "teacup", "taza"),
              (2.75, "baseball", "pelota de béisbol"), (2.5, "tennis ball", "pelota de tenis"),
              (2.0, "hen egg", "huevo"), (1.75, "golf ball", "pelota de golf"), (1.5, "ping pong ball",
              "pelota de ping pong"), (1.25, "half dollar", "moneda de medio dólar"), (1.0, "quarter",
              "moneda de 25 centavos"), (0.88, "nickel", "moneda de 5 centavos"), (0.75, "penny", "moneda de 1 centavo")]


def scfg(cfg):
    return {**DEFAULTS["season"], **((cfg or {}).get("season") or {})}


def in_area(lat, lon, sc):
    w, s, e, n = sc["bbox"]
    return w <= lon <= e and s <= lat <= n


def km(lat1, lon1, lat2, lon2):
    return haversine_mi(lat1, lon1, lat2, lon2) * KM_PER_MI


def size_name(size):
    for v, en, es in SIZE_NAMES:
        if size >= v - 0.005:
            return en, es
    return "pea", "chícharo"


def _curve(x, pts):
    if x <= pts[0][0]:
        return pts[0][1] * max(0.0, x / pts[0][0]) if pts[0][0] else pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]


def _town(city):
    """'2 NNE Fremont' -> 'Fremont' (LSR/SPC locations are 'distance direction town')."""
    t = re.sub(r"^\s*\d+(\.\d+)?\s+[NSEW]{1,3}\s+", "", str(city or "")).strip()
    return t.title() if t.isupper() else t


def _local(dt, tz):
    t = dt.astimezone(ZoneInfo(tz))
    return t.strftime("%I:%M %p").lstrip("0"), t.date().isoformat()


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-") or "area"


# ------------------------------------------------------------------ reports
def report_from_obs(o, src, tz):
    tl, dl = _local(o.valid_utc, tz)
    x = o.extra or {}
    return {"date": o.conv_day, "date_local": dl, "time_local": tl, "utc": iso(o.valid_utc),
            "lat": round(o.lat, 4), "lon": round(o.lon, 4), "size_in": round(float(o.size_in), 2),
            "place": _town(o.city), "location": (o.city or "").strip(), "county": (o.county or "").strip().title(),
            "state": o.state, "by": (x.get("report_source") or "").strip(), "sources": [src]}


def parse_spc(text, day, sc, tz):
    """SPC's daily hail CSV (storm day `day` = 12Z to 12Z; Time = HHMM UTC, Size = hundredths of an inch) ->
    report dicts in the area. Comments are dropped (free text)."""
    out = []
    d0 = day if isinstance(day, date) else date.fromisoformat(day)
    for r in csv.DictReader(io.StringIO(text)):
        try:
            if (r.get("State") or "").strip() not in sc["states"]:
                continue
            hhmm = int(r["Time"])
            lat, lon, size = float(r["Lat"]), float(r["Lon"]), int(r["Size"]) / 100.0
        except (KeyError, TypeError, ValueError):
            continue
        if not in_area(lat, lon, sc) or size < sc["min_size_in"]:
            continue
        d = d0 + timedelta(days=0 if hhmm >= 1200 else 1)
        utc = datetime(d.year, d.month, d.day, hhmm // 100, hhmm % 100, tzinfo=timezone.utc)
        tl, dl = _local(utc, tz)
        loc = (r.get("Location") or "").strip()
        out.append({"date": d0.isoformat(), "date_local": dl, "time_local": tl, "utc": iso(utc),
                    "lat": round(lat, 4), "lon": round(lon, 4), "size_in": round(size, 2), "place": _town(loc),
                    "location": loc, "county": (r.get("County") or "").strip().title(),
                    "state": r["State"].strip(), "by": "", "sources": ["spc"]})
    return out


def merge_reports(base, extra, sc):
    """Adds `extra` reports (SPC, NCEI) to `base` (LSR): a report on the same storm day within `match_km` and
    `match_min` minutes of a base report is the same hail, so that report just gains the source (and the bigger
    size); the rest are added as their own reports. Returns the merged list (base is changed in place)."""
    def t(r):
        return datetime.fromisoformat(r["utc"].replace("Z", "+00:00"))
    for x in extra:
        best, bd = None, None
        for b in base:
            if b["date"] != x["date"] or abs((t(b) - t(x)).total_seconds()) > sc["match_min"] * 60:
                continue
            d = km(b["lat"], b["lon"], x["lat"], x["lon"])
            if d <= sc["match_km"] and (bd is None or d < bd):
                best, bd = b, d
        if best is None:
            base.append(dict(x, sources=list(x["sources"])))
            continue
        for s in x["sources"]:
            if s not in best["sources"]:
                best["sources"].append(s)
        best["size_in"] = max(best["size_in"], x["size_in"])
        best["by"] = best["by"] or x["by"]
    base.sort(key=lambda r: (r["utc"], r["lat"]))
    for i, r in enumerate(base, 1):
        r["id"] = f"r{i}"
    return base


# ------------------------------------------------------------------ zones
def cluster(reports, sc):
    """Per storm day: the biggest report not yet used seeds a zone and takes every free report within cluster_km
    of it (no chaining, so one long swath becomes several walkable zones). -> [[report, ...], ...]"""
    groups = []
    by_day = {}
    for r in reports:
        by_day.setdefault(r["date"], []).append(r)
    for day in sorted(by_day):
        free = sorted(by_day[day], key=lambda r: (-r["size_in"], r["utc"]))
        while free:
            seed = free[0]
            grp = [r for r in free if km(seed["lat"], seed["lon"], r["lat"], r["lon"]) <= sc["cluster_km"]]
            free = [r for r in free if r not in grp]
            groups.append(grp)
    return groups


def combine(rows):
    """Adds up Census rows (block groups or a town) -> the signal numbers, None where unknown."""
    tot = {}
    for r in rows:
        for k, v in r.items():
            if isinstance(v, (int, float)) and k not in ("lat", "lon", "med_year", "sqmi"):
                tot[k] = tot.get(k, 0) + v
    w = [(r["med_year"], r.get("homes") or 0) for r in rows if r.get("med_year")]
    med = round(sum(y * n for y, n in w) / sum(n for _, n in w)) if w and sum(n for _, n in w) else None
    return tot, med


def signals(rows, vintage, sc, level="block groups"):
    """Likely-insured signals for an area from its Census rows. Every share is None when the Census has no number
    (data or nothing: never a made-up default). likely_insured.score = owner share x (1 - m + m x mortgage share),
    m = likely.mortgage_weight: owners carry homeowners coverage far more than renters' landlords' single homes,
    and a mortgage lender requires it."""
    tot, med = combine(rows)
    def share(a, b):
        return round(min(1.0, tot[a] / tot[b]), 3) if tot.get(b) and a in tot else None
    owner = share("owner", "occupied")
    mort = share("mort_with", "mort_total")
    recent = (round(min(1.0, (tot.get("own_recent1", 0) + tot.get("own_recent2", 0)) / tot["own_total"]), 3)
              if tot.get("own_total") else None)
    before = (round(min(1.0, sum(tot.get(c, 0) for c in BEFORE_2000) / tot["built_total"]), 3)
              if tot.get("built_total") else None)
    lk = sc["likely"]
    score = None
    if owner is not None:
        m = lk["mortgage_weight"]
        score = round(100 * owner * ((1 - m) + m * (mort if mort is not None else 0)))
    level_en = "high" if score is not None and score >= lk["high"] else \
        "medium" if score is not None and score >= lk["medium"] else "low" if score is not None else None
    return {"homes": tot.get("homes"), "owner_homes": tot.get("owner"), "owner_share": owner,
            "mortgage_share": mort, "recent_buyer_share": recent, "recent_buyer_since": RECENT_SINCE.get(vintage),
            "median_year_built": med, "built_before_2000_share": before,
            "likely_insured": None if score is None else {
                "score": score, "level": level_en,
                "label": {"en": f"Likely insured: {level_en}",
                          "es": "Probablemente asegurado: " + {"high": "alto", "medium": "medio", "low": "bajo"}[level_en]},
                "parts": {"owner_share": owner, "mortgage_share": mort, "mortgage_weight": lk["mortgage_weight"]}},
            "source": f"US Census ACS {int(vintage) - 4}-{vintage} 5-year, {level}" if vintage else None}


def rows_near(census_rows, lat, lon, radius_km):
    return [r for r in census_rows if km(lat, lon, r["lat"], r["lon"]) <= radius_km]


def mesh_max(grid, lat, lon, radius_km):
    """Biggest MRMS MESH (inches) within radius_km of a point; None without a grid."""
    if not grid:
        return None
    import numpy as np
    arr, meta = grid
    dlat = radius_km / 110.574
    dlon = radius_km / (111.32 * math.cos(math.radians(lat)))
    i0 = max(0, int((meta["lat0"] - (lat + dlat)) / meta["dlat"]))
    i1 = min(arr.shape[0], int((meta["lat0"] - (lat - dlat)) / meta["dlat"]) + 1)
    j0 = max(0, int((lon - dlon - meta["lon0"]) / meta["dlon"]))
    j1 = min(arr.shape[1], int((lon + dlon - meta["lon0"]) / meta["dlon"]) + 1)
    if i0 >= i1 or j0 >= j1:
        return None
    sub = arr[i0:i1, j0:j1]
    la = meta["lat0"] - np.arange(i0, i1) * meta["dlat"]
    lo = meta["lon0"] + np.arange(j0, j1) * meta["dlon"]
    dy = (la[:, None] - lat) * 110.574
    dx = (lo[None, :] - lon) * 111.32 * math.cos(math.radians(lat))
    inside = sub[(dx * dx + dy * dy) <= radius_km * radius_km]
    return round(float(inside.max()), 2) if inside.size else None


def days_ago(storm, today, tz="America/Chicago"):
    """Whole days from a storm to `today` (a date or "YYYY-MM-DD"), counted on the storm's local calendar date:
    "2026-08-08" or a timestamp like "2026-08-09T04:00:00Z" (11 PM Aug 8 in Nebraska) both count from Aug 8."""
    s = str(storm)
    if "T" in s:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        d = (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).astimezone(ZoneInfo(tz)).date()
    else:
        d = date.fromisoformat(s[:10])
    return (date.fromisoformat(str(today)[:10]) - d).days


def age_line(age):
    """The zone why-line for the storm's age + where the time limit lives: the customer's policy (FilthE 2026-09-29; King
    + QA: no legal claim, no countdown, no "Deadline" badge at any age). Code-only fact, never on screen: a policy can't
    cut the time to sue below 5 years (Neb. 44-357 + 25-205); notice limits are the policy's own. The open map
    (docs/design/open-map/index.html ageLine) writes the same text, re-dated to the day it is opened."""
    age = max(0, age)   # a storm dated after "today" (clock skew, a late-night CT report) never reads "-1 days ago"
    return [1 if age <= 60 else (0 if age <= 150 else -1),
            {"en": f"{age} days ago. Time limits to file are in the customer's policy; ask them to check it.",
             "es": f"Hace {age} días. Los plazos para reportar están en la póliza del cliente; que la revise."}]


def _why(z, sig, age, sc):
    en_s, es_s = size_name(z["hail_in"])
    n, srcs = len(z["report_ids"]), list(z["sources"])
    if not n:
        why = [[-1, {"en": f"Radar estimate only: about {z['hail_in']:g} in ({en_s}), nobody reported it on the ground.",
                     "es": f"Solo estimado de radar: unas {z['hail_in']:g} pulg. ({es_s}), nadie lo reportó en tierra."}]]
    else:
        why = [[1 if z["hail_in"] >= 1.0 else -1,
                {"en": f"Biggest report: {z['hail_in']:g} in ({en_s}).",
                 "es": f"Reporte más grande: {z['hail_in']:g} pulg. ({es_s})."}]]
    if not n:
        pass
    elif n >= 2 or len(srcs) >= 2:
        why.append([1, {"en": f"{n} report{'s' if n != 1 else ''} from {len(srcs)} source{'s' if len(srcs) != 1 else ''} agree.",
                        "es": f"{n} reporte{'s' if n != 1 else ''} de {len(srcs)} fuente{'s' if len(srcs) != 1 else ''} coinciden."}])
    else:
        why.append([-1, {"en": "Only one report, one source.", "es": "Solo un reporte, de una fuente."}])
    if z.get("mesh_in") and n:
        why.append([1 if z["mesh_in"] >= 1.0 else 0,
                    {"en": f"Radar estimate up to {z['mesh_in']:g} in (MRMS).",
                     "es": f"El radar estima hasta {z['mesh_in']:g} pulg. (MRMS)."}])
    why.append(age_line(age))
    if sig.get("owner_homes") is not None:
        why.append([1 if sig["owner_homes"] >= 1000 else -1,
                    {"en": f"About {sig['owner_homes']:,} owner-lived homes in the zone (Census).",
                     "es": f"Unas {sig['owner_homes']:,} casas habitadas por su dueño en la zona (Censo)."}])
    else:
        why.append([-1, {"en": "No Census home count here yet.", "es": "Aún sin conteo de casas del Censo aquí."}])
    if sig.get("mortgage_share") is not None:
        why.append([1 if sig["mortgage_share"] >= 0.6 else 0,
                    {"en": f"{round(100 * sig['mortgage_share'])}% of owners have a mortgage (Census).",
                     "es": f"{round(100 * sig['mortgage_share'])}% de los dueños tienen hipoteca (Censo)."}])
    return why


def _near_town(places, lat, lon, rad, sc):
    """Name of the biggest town (>= place_min_homes homes) whose middle is within the zone (+3 km), else the closest
    place of any size within it, else None."""
    cand = [(km(lat, lon, p["lat"], p["lon"]), p) for p in places or []]
    cand = [(d, p) for d, p in cand if d <= rad + 3]
    big = [(d, p) for d, p in cand if (p.get("homes") or 0) >= sc["place_min_homes"]]
    if big:
        return max(big, key=lambda c: c[1]["homes"])[1]["name"]
    return min(cand, key=lambda c: c[0])[1]["name"] if cand else None


def _nearest_place(places, lat, lon, sc):
    """(name, km) of the closest place of any size within nearest_town_km, else (None, None)."""
    cand = [(km(lat, lon, p["lat"], p["lon"]), p) for p in places or []]
    cand = [c for c in cand if c[0] <= sc.get("nearest_town_km", 40)]
    if not cand:
        return None, None
    d, p = min(cand, key=lambda c: c[0])
    return p["name"], round(d, 1)


def zone_rows(bgs, lat, lon, rad, grp, sc):
    """Census block groups for a zone. Ground zones: block groups whose middle is within the outline (outline_buffer_m
    of a report), else the single closest one inside the circle, so a zone at a city's edge doesn't take in half the
    city. Radar zones (no reports): the circle."""
    if not grp:
        return rows_near(bgs, lat, lon, rad)
    buf = sc["outline_buffer_m"] / 1000
    near = [b for b in rows_near(bgs, lat, lon, rad + buf)
            if any(km(r["lat"], r["lon"], b["lat"], b["lon"]) <= buf for r in grp)]
    if near:
        return near
    ring = rows_near(bgs, lat, lon, rad)
    return [min(ring, key=lambda b: km(lat, lon, b["lat"], b["lon"]))] if ring else []


def mesh_zones(meshes, ground, sc):
    """Radar-only zones: per storm day, MRMS cells >= mesh_zone_min_in that no ground-report zone covers. The
    biggest free cell seeds a zone and takes the free cells within cluster_km; kept with >= mesh_zone_min_cells
    cells (about 1 km2 each), at most mesh_zones_per_day per day (most cells first).
    -> [{date, lat, lon, far_km, mesh_in, cells}]"""
    import numpy as np
    out = []
    for day, g in meshes.items():
        if g is None:
            continue
        arr, meta = g
        ii, jj = np.nonzero(arr >= sc["mesh_zone_min_in"])
        if not len(ii):
            continue
        la = meta["lat0"] - ii * meta["dlat"]
        lo = meta["lon0"] + jj * meta["dlon"]
        v = arr[ii, jj]
        free = np.ones(len(v), dtype=bool)
        for z in ground:
            if z["date"] != day:
                continue
            c = z["center"]
            d = _km_np(c["lat"], c["lon"], la, lo)
            free &= d > z["radius_km"]
        found = []
        while free.any():
            k = int(np.argmax(np.where(free, v, -1)))
            d = _km_np(float(la[k]), float(lo[k]), la, lo)
            take = free & (d <= sc["cluster_km"])
            free &= ~take
            n = int(take.sum())
            if n < sc["mesh_zone_min_cells"]:
                continue
            w = v[take]
            lat, lon = float((la[take] * w).sum() / w.sum()), float((lo[take] * w).sum() / w.sum())
            found.append({"date": day, "lat": lat, "lon": lon, "cells": n, "mesh_in": round(float(w.max()), 2),
                          "far_km": float(_km_np(lat, lon, la[take], lo[take]).max())})
        found.sort(key=lambda f: -f["cells"])
        out += found[:sc["mesh_zones_per_day"]]
    return out


def _km_np(lat, lon, lats, lons):
    from .geo import haversine_np
    return haversine_np(lat, lon, lats, lons) * KM_PER_MI


def add_stack(zones, pts, today, sc, cfg):
    """Storm stacking + roof-age sweet spot per zone (stacking.py): `stack` {count, days, since, km, line} = distinct
    hail days with a public report within stacking.hit_km of the zone's middle over the last 3 seasons (its own day
    always counted); score x the capped factor (1.0 / 1.15 / 1.3, max 100, `score_parts.stack`), plus one plain `why`
    line when hit 2+ times. No roof band per zone: the Census typical home age is not a roof age."""
    for z in zones:
        st = stacking.stack(z["center"]["lat"], z["center"]["lon"], pts, today, cfg, include=[z["date"]])
        z["stack"] = {k: st[k] for k in ("count", "days", "since", "km", "line")}
        z["score_parts"]["stack"] = st["factor"]
        z["score"] = min(100, round(z["score"] * st["factor"]))
        if st["count"] >= 2:
            z["why"].append([1, {"en": f"{st['line']['en']} (public reports within {st['km']:g} km).",
                                 "es": f"{st['line']['es']} (reportes públicos a {st['km']:g} km)."}])


def build_zones(reports, radar, meshes, census, today, sc, places=None, history=None, cfg=None):
    """reports -> ranked hot zones: one per ground-report cluster (kind "ground") plus radar-only zones (kind
    "radar", MRMS hail where nobody reported, see mesh_zones). radar = {day: [(lat, lon, size)]}, meshes = {day:
    (arr, meta) | None}, census = {"vintage", "bgs": [row]} (rows with lat/lon + counts) or None."""
    from .zones import buffered_hull
    bgs = (census or {}).get("bgs") or []
    vintage = (census or {}).get("vintage")
    zones = []

    def make(kind, day, lat, lon, rad, grp, mesh):
        cells = [c for c in (radar.get(day) or []) if km(lat, lon, c[0], c[1]) <= rad + 2]
        srcs = []
        for r in grp:
            for s in r["sources"]:
                if s not in srcs:
                    srcs.append(s)
        if cells:
            srcs.append("radar")
        if mesh is not None and mesh >= sc["radar_min_in"]:
            srcs.append("mrms")
        towns = []
        for r in sorted(grp, key=lambda r: -r["size_in"]):
            if r["place"] and r["place"] not in towns:
                towns.append(r["place"])
        near = _near_town(places, lat, lon, rad, sc)
        nearest, nearest_km = (None, None) if (towns or near) else _nearest_place(places, lat, lon, sc)
        if kind == "radar" and places and not (near or nearest):
            return   # radar hail with no Nebraska place within nearest_town_km: out of state (the area is NE only)
        sig = signals(zone_rows(bgs, lat, lon, rad, grp, sc), vintage, sc)
        age = days_ago(day, today)
        n = len(grp)
        hail = max(r["size_in"] for r in grp) if grp else \
            round(min(mesh * sc["mesh_trust"], sc.get("radar_hail_cap_in", 99)), 2)
        basis = hail
        li = sig["likely_insured"]
        parts = {
            "size": round(_curve(basis, sc["size_curve"]), 3),
            "agree": round(0.5 * min(1.0, max(0, n - 1) / 4) + 0.5 * min(1.0, max(0, len(srcs) - 1) / 3), 3),
            "recent": round(0.5 ** (max(0, age) / sc["recent_half_life_days"]), 3),
            "homes": round(min(1.0, (sig["owner_homes"] or 0) / sc["homes_full"])
                           * ((li["score"] / 100) ** 0.5 if li else 0), 3)}
        tl = sorted(r["utc"] for r in grp)
        z = {"id": None, "kind": kind, "date": day, "days_ago": age,
             "name": towns[0] if towns else (near or (f"Rural area near {nearest}" if nearest else "Rural area")),
             "name_es": towns[0] if towns else (near or (f"Zona rural cerca de {nearest}" if nearest else "Zona rural")),
             "near_town": near, "nearest_town": nearest, "nearest_km": nearest_km, "towns": towns[:6],
             "center": {"lat": round(lat, 4), "lon": round(lon, 4)}, "radius_km": rad,
             "outline": buffered_hull([(r["lon"], r["lat"]) for r in grp], sc["outline_buffer_m"], 24) if grp else None,
             "hail_in": hail, "hail_basis": "ground" if grp else "radar", "mesh_in": mesh, "reports": n,
             "report_ids": [r["id"] for r in grp], "sources": srcs, "radar_cells": len(cells),
             "radar_max_in": round(max(c[2] for c in cells), 2) if cells else None,
             "time_local": [min(grp, key=lambda r: r["utc"])["time_local"],
                            max(grp, key=lambda r: r["utc"])["time_local"]] if grp else None,
             "first_utc": tl[0] if tl else None, "last_utc": tl[-1] if tl else None,
             "score": round(100 * sum(sc["weights"][k] * parts[k] for k in sc["weights"])), "score_parts": parts,
             "agree_pct": round(100 * parts["agree"]), "signals": sig}
        z["why"] = _why(z, sig, age, sc)
        zones.append(z)

    for grp in cluster(reports, sc):
        tw = sum(r["size_in"] for r in grp)
        lat = sum(r["lat"] * r["size_in"] for r in grp) / tw
        lon = sum(r["lon"] * r["size_in"] for r in grp) / tw
        far = max(km(lat, lon, r["lat"], r["lon"]) for r in grp)
        rad = round(min(sc["zone_max_km"], max(sc["zone_min_km"], far + 2)), 1)
        make("ground", grp[0]["date"], lat, lon, rad, grp, mesh_max(meshes.get(grp[0]["date"]), lat, lon, rad))
    for m in mesh_zones(meshes, list(zones), sc):
        rad = round(min(sc["zone_max_km"], max(sc["zone_min_km"], m["far_km"] + 1)), 1)
        make("radar", m["date"], m["lat"], m["lon"], rad, [], m["mesh_in"])
    if history is not None:                        # storm stacking: past seasons + this season's own reports
        add_stack(zones, list(history) + stacking.points_from_reports(reports), today, sc, cfg)
    zones.sort(key=lambda z: (-z["score"], z["date"]))
    seen = {}
    for i, z in enumerate(zones, 1):
        base = f"{z['date']}~{slug(z['name'])}"
        seen[base] = seen.get(base, 0) + 1
        z["id"] = base if seen[base] == 1 else f"{base}-{seen[base]}"
        z["rank"] = i
    return zones


def build_areas(places, reports, census, sc):
    """Towns (Census places with >= place_min_homes homes) in the area: their own Census signals + this season's
    hail within place_hail_km of the town's middle (+ its size)."""
    vintage = (census or {}).get("vintage")
    out = []
    for p in places or []:
        if (p.get("homes") or 0) < sc["place_min_homes"]:
            continue
        reach = sc["place_hail_km"] + math.sqrt(max(p.get("sqmi") or 0, 0) * 2.59) / 2
        hits = [r for r in reports if km(p["lat"], p["lon"], r["lat"], r["lon"]) <= reach]
        days = sorted({r["date"] for r in hits})
        out.append({"id": slug(p["name"]), "name": p["name"], "geoid": p["geoid"],
                    "center": {"lat": round(p["lat"], 4), "lon": round(p["lon"], 4)}, "reach_km": round(reach, 1),
                    "hail": {"storm_days": days, "reports": len(hits),
                             "max_in": max((r["size_in"] for r in hits), default=None),
                             "last_date": days[-1] if days else None,
                             "last_max_in": max((r["size_in"] for r in hits if r["date"] == days[-1]), default=None)
                             if days else None},
                    "signals": signals([p], vintage, sc, level="town")})
    out.sort(key=lambda a: -(a["signals"]["homes"] or 0))
    return out


def storm_days(reports, zones, radar, meshes, sc):
    out = []
    for day in sorted({r["date"] for r in reports}, reverse=True):
        rs = [r for r in reports if r["date"] == day]
        towns = []
        for r in sorted(rs, key=lambda r: -r["size_in"]):
            if r["place"] and r["place"] not in towns:
                towns.append(r["place"])
        g = meshes.get(day)
        out.append({"date": day, "reports": len(rs), "max_in": max(r["size_in"] for r in rs),
                    "first_local": min(rs, key=lambda r: r["utc"])["time_local"],
                    "last_local": max(rs, key=lambda r: r["utc"])["time_local"], "towns": towns[:8],
                    "radar_cells": len(radar.get(day) or []),
                    "mesh_max_in": round(float(g[0].max()), 2) if g is not None else None,
                    "zones": [z["id"] for z in zones if z["date"] == day]})
    return out


def build_doc(reports, radar, meshes, census, places, today, sc, now=None, errors=None, counts=None, year=None,
              history=None, cfg=None):
    zones = build_zones(reports, radar, meshes, census, today, sc, places=places, history=history, cfg=cfg)
    areas = build_areas(places, reports, census, sc)
    used = {"census"} if census else set()
    for r in reports:
        used.update(r["sources"])
    if any(radar.values()):
        used.add("radar")
    if any(v is not None for v in meshes.values()):
        used.add("mrms")
    return {
        "v": 1, "season": year or today.year, "as_of": iso(now or datetime.now(timezone.utc)), "today": today.isoformat(),
        "area": {"name": "Eastern Nebraska", "bbox": sc["bbox"], "states": sc["states"], "min_size_in": sc["min_size_in"]},
        "real": True,
        "note": {"en": "Real public storm reports and Census numbers. Homes on the map are samples until knocking "
                       "starts. 'Likely insured' is an estimate from Census numbers, never a fact about one home.",
                 "es": "Reportes de tormenta públicos y reales y números del Censo. Las casas del mapa son de muestra "
                       "hasta empezar a tocar puertas. 'Probablemente asegurado' es un estimado del Censo, nunca un "
                       "dato de una casa."},
        "sources": [{"id": k, "name": SOURCES[k][0], "url": SOURCES[k][1], "count": (counts or {}).get(k)}
                    for k in SOURCES if k in used or (counts or {}).get(k)],
        "census_vintage": (census or {}).get("vintage"),
        "storm_days": storm_days(reports, zones, radar, meshes, sc),
        "zones": zones, "areas": areas, "reports": reports, "errors": errors or []}


# ------------------------------------------------------------------ network (fetcher = http.Fetcher)
def fetch_lsr(fetcher, cfg, sc, year, today):
    end = datetime(today.year, today.month, today.day, tzinfo=timezone.utc) + timedelta(days=1)
    start = datetime(year, 1, 1, tzinfo=timezone.utc)
    url = f"{lsr.BASE}?sts={start:%Y-%m-%dT%H:%MZ}&ets={end:%Y-%m-%dT%H:%MZ}&wfos={','.join(sc['wfos'])}"
    obs = lsr.parse(fetcher.get(url, ttl=1800), cfg)
    return [o for o in obs if o.state in sc["states"] and in_area(o.lat, o.lon, sc) and o.size_in >= sc["min_size_in"]
            and o.valid_utc.year == year]


def fetch_ncei(fetcher, sc, year):
    files = stormevents.list_files(fetcher)
    if year not in files:
        return []
    obs = stormevents.parse(fetcher.get(files[year][1], ttl=None), {"states": sc["states"]})
    return [o for o in obs if in_area(o.lat, o.lon, sc) and o.size_in >= sc["min_size_in"]]


def _ttl(day, today):
    return None if (today - day).days > 3 else 1800


def fetch_spc(fetcher, sc, day, today, tz):
    return parse_spc(fetcher.get(SPC_URL.format(d=day), ttl=_ttl(day, today)).decode("utf-8", "replace"), day, sc, tz)


def fetch_radar(fetcher, sc, day, today):
    w, s, e, n = sc["bbox"]
    url = f"{swdi.BASE}/{day:%Y%m%d}:{day + timedelta(days=2):%Y%m%d}?bbox={w},{s},{e},{n}"
    obs = swdi.parse(fetcher.get(url, ttl=_ttl(day, today)), {"thresholds": {"radar_min_in": sc["radar_min_in"]}})
    return [(round(o.lat, 3), round(o.lon, 3), o.size_in) for o in obs
            if o.conv_day == day.isoformat() and o.size_in >= sc["radar_min_in"]]


def mesh_path(cfg, day):
    d = os.path.join(os.path.dirname(cfg["paths"]["db"]), "mrms")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, f"season_{day}.npz")


def fetch_mesh(fetcher, cfg, sc, day):
    """MRMS MESH 24 h max for storm day `day`, cropped to the season bbox -> (inches array, meta). Cached as
    data/mrms/season_<day>.npz once the storm day is complete (a separate file from the engine's own grids)."""
    import numpy as np
    from . import mrms
    p = mesh_path(cfg, day)
    if os.path.exists(p):
        z = np.load(p)
        return z["mesh"].astype(np.float32) / 100.0, json.loads(str(z["meta"]))
    if getattr(fetcher, "offline", False):
        return None
    key, valid, complete = mrms.pick_file(fetcher, day)
    raw = fetcher.get(f"{mrms.BUCKET}/{key}", cache=False)
    Y, grid = mrms.decode_grib2(gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw)
    sub, meta = mrms.crop(Y, grid, sc["bbox"])
    inch = np.clip(np.nan_to_num(sub, nan=0.0), 0, None) / mrms.MM_PER_IN
    meta.update({"key": key, "valid_utc": iso(valid), "complete": complete})
    if complete:
        with open(p, "wb") as f:
            np.savez_compressed(f, mesh=np.round(inch * 100).astype(np.uint16), meta=json.dumps(meta))
    return inch.astype(np.float32), meta


def _dat(fetcher, vintage, table, cols, prefixes):
    txt = fetcher.get(ACS_DIR.format(y=vintage, t=table), ttl=None, cache=False).decode("utf-8", "replace")
    lines = txt.splitlines()
    head = lines[0].split("|")
    ix = {c: head.index(c) for c in cols}
    out = {}
    for ln in lines[1:]:
        if not ln.startswith(prefixes):
            continue
        f = ln.split("|")
        rec = {}
        for c, name in cols.items():
            try:
                v = int(float(f[ix[c]]))
                rec[name] = v if v >= 0 else None
            except (ValueError, IndexError):
                rec[name] = None
        out[f[0].split("US", 1)[1]] = rec
    return out


def _clean(rec):
    return {k: v for k, v in rec.items() if v is not None}


def fetch_census(fetcher, sc, log=print):
    """Block groups (TIGER internal point) + towns (Gazetteer) in the bbox with their ACS counts ->
    {vintage, fetched_utc, bgs: [row], places: [row]}. Row = {geoid, lat, lon, homes, occupied, owner, mort_total,
    mort_with, med_year, built_total, B25034_E002.., own_total, own_recent1, own_recent2} (+ name, sqmi for towns)."""
    import sys
    v = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "vendor")
    if v not in sys.path:
        sys.path.insert(0, v)
    import shapefile
    pts, gy = {}, None
    for y in (2024, 2023):
        try:
            z = zipfile.ZipFile(io.BytesIO(fetcher.get(TIGER_BG.format(y=y), ttl=None, cache=False)))
            dbf = next(n for n in z.namelist() if n.endswith(".dbf"))
            r = shapefile.Reader(dbf=io.BytesIO(z.read(dbf)))
            names = [f[0] for f in r.fields[1:]]
            for rec in r.iterRecords():
                a = dict(zip(names, rec))
                lat, lon = float(a["INTPTLAT"]), float(a["INTPTLON"])
                if in_area(lat, lon, sc):
                    pts[a["GEOID"]] = (lat, lon)
            gy = y
            break
        except Exception as e:
            log(f"  season: TIGER block groups {y} failed ({type(e).__name__})")
    places = {}
    for y in (2024, 2023):
        try:
            txt = fetcher.get(GAZ_PLACE.format(y=y), ttl=None).decode("utf-8", "replace")
            rows = list(csv.reader(io.StringIO(txt), delimiter="\t"))
            head = [h.strip() for h in rows[0]]
            for row in rows[1:]:
                a = dict(zip(head, (c.strip() for c in row)))
                lat, lon = float(a["INTPTLAT"]), float(a["INTPTLONG"])
                if in_area(lat, lon, sc):
                    nm = re.sub(r"\s+(city|village|CDP|town)$", "", a["NAME"])
                    places[a["GEOID"]] = {"name": nm, "lat": lat, "lon": lon, "sqmi": float(a.get("ALAND_SQMI") or 0)}
            break
        except Exception as e:
            log(f"  season: Gazetteer places {y} failed ({type(e).__name__})")
    if not pts and not places:
        raise RuntimeError("no Census geography")
    for vintage in ("2024", "2023"):
        try:
            recs = {}
            for t, cols in TABLES.items():
                for g, rec in _dat(fetcher, vintage, t, cols, ("1500000US31", "1600000US31")).items():
                    if g in pts or g in places:
                        recs.setdefault(g, {}).update(rec)
                log(f"  season: ACS {vintage} {t.upper()} ok")
            bgs = [dict(_clean(recs.get(g, {})), geoid=g, lat=round(la, 5), lon=round(lo, 5))
                   for g, (la, lo) in pts.items()]
            pls = [dict(_clean(recs.get(g, {})), geoid=g, name=p["name"], lat=round(p["lat"], 5),
                        lon=round(p["lon"], 5), sqmi=p["sqmi"]) for g, p in places.items()]
            return {"vintage": vintage, "tiger": gy, "fetched_utc": iso(datetime.now(timezone.utc)),
                    "bgs": bgs, "places": pls}
        except Exception as e:
            log(f"  season: ACS {vintage} not available ({type(e).__name__}: {e}); trying older")
    raise RuntimeError("ACS tables not available")


def census_cached(fetcher, cfg, sc, log=print):
    """The Census part changes once a year: keep it in data/cache/season_census.json, refetch after
    census_max_age_days (never offline). A failed refetch keeps the old copy."""
    p = os.path.join(cfg["paths"]["cache"], "season_census.json")
    old = None
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            old = json.load(f)
        age = datetime.now(timezone.utc) - datetime.fromisoformat(old["fetched_utc"].replace("Z", "+00:00"))
        if age < timedelta(days=sc["census_max_age_days"]) or getattr(fetcher, "offline", False):
            return old
    if getattr(fetcher, "offline", False):
        return None
    try:
        doc = fetch_census(fetcher, sc, log)
    except Exception:
        if old:
            return old
        raise
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(doc, f, separators=(",", ":"))
    return doc


def run(fetcher, cfg, year=None, today=None, log=print, now=None, mesh=None):
    """Pulls every source and returns the storms-<year>.json doc. One failing source never stops the others."""
    sc = scfg(cfg)
    tz = cfg.get("timezone", "America/Chicago")
    today = today or datetime.now(ZoneInfo(tz)).date()
    year = year or today.year
    errors, counts = [], {}

    def guard(part, fn, default):
        try:
            return fn()
        except Exception as e:
            errors.append({"part": part, "error": f"{type(e).__name__}: {e}"[:200]})
            log(f"  season: {part} skipped ({type(e).__name__})")
            return default

    obs = guard("lsr", lambda: fetch_lsr(fetcher, cfg, sc, year, today), [])
    counts["lsr"] = len(obs)
    reports = [report_from_obs(o, "lsr", tz) for o in obs]
    ncei = guard("ncei", lambda: fetch_ncei(fetcher, sc, year), [])
    counts["ncei"] = len(ncei)
    merge_reports(reports, [report_from_obs(o, "ncei", tz) for o in ncei], sc)
    days = sorted({date.fromisoformat(r["date"]) for r in reports})
    spc = []
    for d in days:
        spc += guard(f"spc {d}", lambda d=d: fetch_spc(fetcher, sc, d, today, tz), [])
    counts["spc"] = len(spc)
    merge_reports(reports, spc, sc)
    days = sorted({date.fromisoformat(r["date"]) for r in reports})
    radar = {}
    for d in days:
        radar[d.isoformat()] = guard(f"radar {d}", lambda d=d: fetch_radar(fetcher, sc, d, today), [])
    counts["radar"] = sum(len(v) for v in radar.values())
    meshes = {}
    use_mesh = sc["mesh"] if mesh is None else mesh
    t0 = time.monotonic()
    for d in sorted(days, reverse=True):                       # newest first: the budget keeps the storms that matter
        if not use_mesh or time.monotonic() - t0 > sc["mesh_budget_s"]:
            meshes[d.isoformat()] = None
            continue
        meshes[d.isoformat()] = guard(f"mrms {d}", lambda d=d: fetch_mesh(fetcher, cfg, sc, d), None)
    counts["mrms"] = sum(1 for v in meshes.values() if v is not None)
    census = guard("census", lambda: census_cached(fetcher, cfg, sc, log), None)
    places = (census or {}).get("places") or []
    counts["census"] = len((census or {}).get("bgs") or [])
    log(f"  season {year}: {len(reports)} reports on {len(days)} storm days; radar cells {counts['radar']}, "
        f"MRMS days {counts['mrms']}, block groups {counts['census']}")
    history = None                                 # storm stacking: past seasons from `hh.py stack-history`
    try:
        with open(stacking.HISTORY, encoding="utf-8") as f:
            history = [p for p in json.load(f).get("pts") or [] if int(p[0][:4]) < year]
    except (OSError, ValueError, TypeError):
        log("  season: no data/hail-history.json (run `hh.py stack-history`): stacking counts this season only")
        history = []
    doc = build_doc(reports, radar, meshes, census, places, today, sc, now=now, errors=errors, counts=counts,
                    year=year, history=history, cfg=cfg)
    doc["stacking"] = {"since": stacking.since_year(today, stacking.scfg(cfg)), "km": stacking.scfg(cfg)["hit_km"],
                       "min_in": stacking.scfg(cfg)["min_in"], "history_reports": len(history)}
    return doc


def write(doc, path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    os.replace(tmp, path)
    return os.path.getsize(path)
