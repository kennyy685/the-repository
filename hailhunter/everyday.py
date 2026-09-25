"""Everyday leads (T50): door lists for OLD-house neighborhoods near Fremont, no storm needed.

HMP also sells regular siding and roof replacement to older homes. This ranks Census block groups
("neighborhoods", 250-1,500 homes) by how likely their homes are to need that work, then makes door lists for
the best ones the same way storm lists are made (walkable turfs, csv / xlsx / map), each walk with a heat score.

heat 0-100 = 100 x old x owners x value x distance x settled x newbuild      (weights: config "everyday")
  old       share of homes built before `old_before`: per house from the parcels when most years are known,
            else the Census decade counts (B25034), else estimated from the Census median year (B25035)
  owners    owner-occupied share (Census B25003): owners pay for their own siding and roof
  value     typical home value: enough to reinvest in, not luxury
  distance  miles from home base
  settled   small cut for homes bought in the last few years
  newbuild  small cut for homes built since `new_since`
Door knocking only. Parcels carry no owner names, and none are added here (homes: never).
"""
import json
import os
import re
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import numpy as np

from . import doors, parcels
from .geo import haversine_mi, interp
from .models import iso
from .nbhd import YEAR_BINS, year_shares

COLS = [("Value ($)" if c == "Hail at house (in)" else c) for c in doors.COLS]
NOTES = [
    "HOW TO USE",
    "This is an EVERYDAY list: older homes, no storm. Offer a free siding and roof check and a regular replacement estimate.",
    "Each 'Turf' sheet is one walk (about 1-2 hours), already in walking order: up one side of the street, back down the other.",
    "Fill in only the yellow columns: Result (pick from the list), Name, Phone, Notes, Follow-up. The Summary counts update by themselves.",
    "Score = how promising the house is (home age, owner-occupied area, home value, distance from home base).",
    "Flag 'New owner': bought in the last few years. They may be planning updates, or the seller may have just redone the roof.",
    "RULES: carry this town's solicitor permit (each town needs its own); skip 'No Soliciting' homes; door knocking only.",
    "Built and value: county assessor records (Nebraska Statewide Parcels). Owner share and ages by area: US Census ACS 5-year.",
]


def _home_town(cfg):
    return cfg["home"]["name"].split(",")[0].strip()


def _center(conn, cfg, near):
    if not near:
        return cfg["home"]["lat"], cfg["home"]["lon"]
    p = conn.execute("SELECT lat, lon FROM places WHERE lower(name)=lower(?) ORDER BY COALESCE(hu,0) DESC",
                     (near,)).fetchone()
    if not p:
        raise SystemExit(f"Town '{near}' not found")
    return p["lat"], p["lon"]


# ------------------------------------------------------------------ the score
def heat(f, cfg):
    """Everyday heat for one walk or neighborhood from its facts:
    share_old / share_new / basis / med_year / owners / med_value / dist_mi / share_sold / n_sold (any may be None).
    Returns {"heat", "why" (2-4 plain reasons), "parts"}."""
    ev = cfg["everyday"]
    cut = ev["old_before"]
    share, basis, med = f.get("share_old"), f.get("basis"), f.get("med_year")
    if share is None and med:                     # no age breakdown: half the homes are older than the median
        share, basis = min(1.0, max(0.0, 0.5 - (med - cut) / (2 * ev["median_spread_years"]))), "median"
    old = ev["old_unknown"] if share is None else ev["old_floor"] + (1 - ev["old_floor"]) * share
    own = f.get("owners")
    owners = ev["owner_unknown"] if own is None else ev["owner_floor"] + (1 - ev["owner_floor"]) * own
    mv = f.get("med_value")
    value = interp(ev["value_curve"], mv) if mv else ev["value_unknown"]
    dist = f.get("dist_mi")
    distance = interp(ev["distance_curve"], dist or 0)
    settled = 1 - ev["sold_penalty"] * (f.get("share_sold") or 0.0)
    new = f.get("share_new") or 0.0
    newbuild = 1 - ev["new_penalty"] * new
    h = round(100 * old * owners * value * distance * settled * newbuild, 1)
    why = []
    if share is not None and basis != "median":
        why.append(f"{round(share * 100)}% of homes built before {cut}")
    elif med:
        why.append(f"median home built {med}")
    if own is not None:
        if own >= 0.7:
            why.append("mostly owner-occupied")
        elif own >= 0.5:
            why.append(f"{round(own * 100)}% owner-occupied")
        elif own < 0.4:
            why.append("mostly renters")
    n_sold = f.get("n_sold") or 0
    if n_sold >= 3:
        why.append(f"{n_sold} bought in the last {ev['recent_sale_years']} yrs")
    if new >= 0.2:
        why.append(f"{round(new * 100)}% built since {ev['new_since']}")
    if mv:
        top = max(y for _, y in ev["value_curve"])
        peak_hi = max(x for x, y in ev["value_curve"] if y == top)
        k = f"${round(mv / 1000)}k"
        why.append(f"homes ~{k}" if value >= 0.95 * top else
                   (f"high-end homes (~{k})" if mv > peak_hi else f"lower home values (~{k})"))
    if dist is not None and dist <= 15:
        why.append(f"{round(dist)} mi from {_home_town(cfg)}")
    parts = {"old": round(old, 3), "owners": round(owners, 3), "value": round(value, 3),
             "distance": round(distance, 3), "settled": round(settled, 3), "newbuild": round(newbuild, 3),
             "share_old": None if share is None else round(share, 3), "basis": basis, "median_built": med,
             "owner_share": None if own is None else round(own, 3), "median_value": mv,
             "dist_mi": None if dist is None else round(dist, 1), "share_new": round(new, 3), "sold_recent": n_sold}
    return {"heat": h, "why": why[:4], "parts": parts}


# ------------------------------------------------------------------ neighborhoods
def areas(conn, cfg, near=None, radius_mi=None):
    """Nebraska block groups within radius_mi of `near` (default: home base), best everyday heat first.
    Census facts only (no parcels needed): this picks where to make lists."""
    ev, home = cfg["everyday"], cfg["home"]
    lat0, lon0 = _center(conn, cfg, near)
    radius = radius_mi or ev["radius_mi"]
    out = []
    for r in conn.execute(f"""SELECT b.geoid, b.label, b.lat, b.lon, b.min_lon, b.min_lat, b.max_lon, b.max_lat,
            b.rings, a.hu, a.occupied, a.owner, a.med_year, a.med_value, y.total AS y_total,
            {', '.join('y.' + c for c in YEAR_BINS)}
            FROM bgs b LEFT JOIN acs a ON a.geoid = b.geoid AND a.level = 'bg'
            LEFT JOIN acs_year_built y ON y.geoid = b.geoid WHERE b.state = 'NE'"""):
        if haversine_mi(lat0, lon0, r["lat"], r["lon"]) > radius or (r["hu"] or 0) < ev["min_homes"]:
            continue
        label = r["label"] or r["geoid"]
        if ev["skip_rural"] and label.startswith("Rural"):
            continue
        yb = {"total": r["y_total"], **{c: r[c] for c in YEAR_BINS}} if r["y_total"] else None
        share = year_shares(yb, before=ev["old_before"])
        f = {"geoid": r["geoid"], "label": label, "town": label.split(",")[0].strip(), "homes": r["hu"],
             "lat": r["lat"], "lon": r["lon"], "rings": r["rings"],
             "bbox": (r["min_lon"], r["min_lat"], r["max_lon"], r["max_lat"]),
             "owners": (r["owner"] / r["occupied"]) if r["occupied"] else None,
             "med_year": r["med_year"], "med_value": r["med_value"], "share_old": share,
             "share_new": year_shares(yb, since=ev["new_since"]), "basis": "census" if share is not None else None,
             "dist_mi": round(haversine_mi(home["lat"], home["lon"], r["lat"], r["lon"]), 1)}
        f.update(heat(f, cfg))
        out.append(f)
    out.sort(key=lambda a: -a["heat"])
    return out


# ------------------------------------------------------------------ houses and walks
def _inside(area, rows):
    from matplotlib.path import Path
    if not rows:
        return []
    verts, codes = [], []
    for ring in json.loads(area["rings"]):
        verts += ring
        codes += [Path.MOVETO] + [Path.LINETO] * (len(ring) - 2) + [Path.CLOSEPOLY]
    mask = Path(verts, codes).contains_points([(p["lon"], p["lat"]) for p in rows])
    return [p for p, m in zip(rows, mask) if m]


def score_houses(conn, cfg, area, session=None, budget_s=None, today=None, log=print):
    """Every home inside the neighborhood, scored 0-100 = 100 x age x owners x value x distance x type x settled.
    Year built and value per house when the assessor has them, else the neighborhood's Census value."""
    ev, home = cfg["everyday"], cfg["home"]
    if session is not None:
        try:
            parcels.ensure_area(conn, session, area["bbox"], budget_s=budget_s, log=log)
        except Exception as e:                       # a failed download never stops a run: use what is stored
            log(f"    parcels download failed ({type(e).__name__}); using stored buildings")
    x0, y0, x1, y1 = area["bbox"]
    kinds = ev["kinds"]
    rows = _inside(area, conn.execute(f"""SELECT * FROM parcels WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?
                                          AND kind IN ({','.join('?' * len(kinds))})""",
                                      (y0, y1, x0, x1, *kinds)).fetchall())
    today = today or datetime.now(ZoneInfo(cfg["timezone"])).date()
    sold_since = (today - timedelta(days=round(365.25 * ev["recent_sale_years"]))).isoformat()
    own = area.get("owners")
    O = ev["owner_unknown"] if own is None else ev["owner_floor"] + (1 - ev["owner_floor"]) * own
    out = []
    for p in rows:
        year = p["year_built"] or area.get("med_year")
        A = interp(ev["age_curve"], year) if year else ev["old_unknown"]
        mv = p["total_value"] or area.get("med_value")
        V = interp(ev["value_curve"], mv) if mv else ev["value_unknown"]
        dist = haversine_mi(home["lat"], home["lon"], p["lat"], p["lon"])
        bought = bool(p["sale_date"] and p["sale_date"] >= sold_since)
        flags = []
        if bought:
            flags.append(f"New owner (bought {p['sale_date']})")
        if not p["year_built"]:
            flags.append("Year unknown")
        elif p["year_built"] >= ev["new_since"]:
            flags.append("Newer home")
        if p["kind_inferred"]:
            flags.append("Type from zoning")
        if p["kind"] == "multi":
            flags.append("Ask for owner/landlord")
        score = 100 * A * O * V * interp(ev["distance_curve"], dist) * doors.KIND_FACTOR.get(p["kind"], 0.5) * \
            ((1 - ev["sold_penalty"]) if bought else 1.0)
        out.append({**dict(p), "bg": area["geoid"], "hail_in": None, "owner_share": own, "score": round(score, 1),
                    "dist_mi": round(dist, 1), "flags": "; ".join(flags), "bought_recently": bought})
    return out


def turf_heat(stops, area, cfg):
    """Everyday heat for one walk: its own houses' years/values/sales, the neighborhood's Census facts otherwise."""
    ev, home = cfg["everyday"], cfg["home"]
    n = len(stops)
    f = {k: area.get(k) for k in ("owners", "med_value", "share_old", "share_new", "basis", "med_year")}
    years = [int(s["year_built"]) for s in stops if s.get("year_built")]
    if years and len(years) >= 0.5 * n:
        f.update(share_old=sum(y < ev["old_before"] for y in years) / len(years),
                 share_new=sum(y >= ev["new_since"] for y in years) / len(years),
                 med_year=int(np.median(years)), basis="parcels")
    vals = [float(s["total_value"]) for s in stops if s.get("total_value")]
    if vals:
        f["med_value"] = float(np.median(vals))
    f["n_sold"] = sum(1 for s in stops if s.get("bought_recently"))
    f["share_sold"] = f["n_sold"] / n if n else 0.0
    f["dist_mi"] = haversine_mi(home["lat"], home["lon"], float(np.mean([s["lat"] for s in stops])),
                                float(np.mean([s["lon"] for s in stops])))
    z = heat(f, cfg)
    z["exp_inspections"] = round(n * ev["inspect_rate"] * z["heat"] / 50, 1)
    return z


# ------------------------------------------------------------------ outputs
def _row(t, k, h):
    return [t, k, h["address"], h["city"], h["zip"], doors.KIND_LABEL.get(h["kind"], h["kind"]), h["year_built"] or "",
            int(h["sqft"]) if h["sqft"] else "", int(h["total_value"]) if h.get("total_value") else "", h["flags"],
            h["score"], "", "", "", "", "", h["lat"], h["lon"]]


def _year_dots():
    from .maps import RAMP
    return {"key": "year_built", "bins": [0, 1940, 1960, 1980, 1990, 2000, 2010, 9999], "ramp": RAMP[::-1],
            "labels": ["pre-1940", "1940-59", "1960-79", "1980s", "1990s", "2000s", "2010+"],
            "caption": "Each dot = one home, colored by year built (darker = older, gray = unknown). "
                       "Outlines = turfs (walks)."}


def list_id(area):
    return f"everyday_{re.sub(r'[^A-Za-z]+', '_', area['town']).strip('_')}_{area['geoid']}"


def make_list(conn, cfg, area, session=None, turf_size=None, budget_s=None, today=None, log=print):
    """One door list for one neighborhood (an entry from areas()). None when no homes are stored there."""
    ev = cfg["everyday"]
    today = today or datetime.now(ZoneInfo(cfg["timezone"])).date()
    houses = score_houses(conn, cfg, area, session, budget_s, today, log)
    if not houses:
        return None
    turf_size = turf_size or ev["turf_size"]
    turfs = doors.build_turfs(houses, turf_size, cfg.get("door_lists", {}).get("max_hop_mi", 0.4))
    zs = [turf_heat(t["stops"], area, cfg) for t in turfs]
    for t, z in zip(turfs, zs):
        yrs = [s["year_built"] for s in t["stops"] if s.get("year_built")]
        t["med_year"], t["heat"] = (int(np.median(yrs)) if yrs else None), z["heat"]
    whole = turf_heat(houses, area, cfg)                   # the list as a whole, for its card
    lid = list_id(area)
    out = os.path.join(cfg["paths"]["export"], "lists")
    os.makedirs(out, exist_ok=True)
    title = f"Door list - older homes, no storm - {area['label']}"
    subtitle = (f"{len(houses):,} homes in {len(turfs)} turfs. {'; '.join(whole['why'][:2])}. Everyday siding and "
                f"roof replacement leads (no storm, no insurance claim). Made {today:%b %d, %Y}.")
    paths = {k: os.path.join(out, f"{lid}.{k}") for k in ("csv", "xlsx", "png")}
    doors.write_csv(paths["csv"], turfs, cols=COLS, row=_row)
    try:
        doors.write_xlsx(paths["xlsx"], turfs, title, subtitle, cols=COLS, row=_row,
                         metric=("Median year built", "med_year", "0"), notes=NOTES, formats={"Value ($)": "#,##0"},
                         turf_title=lambda t, turf: f"Turf {t}: {turf['streets']}  -  {turf['doors']} doors, "
                                                    f"everyday heat {turf['heat']:.0f}")
    except ImportError:
        log("  openpyxl not installed - skipping .xlsx (csv still written)")
        paths["xlsx"] = None
    try:
        doors.draw_turf_map(paths["png"], turfs, title, subtitle, conn, dots=_year_dots(),
                            turf_line=lambda turf: f"built ~{turf['med_year'] or '?'}  |  heat {turf['heat']:.0f}")
    except ImportError:
        log("  matplotlib not installed - skipping map .png")
        paths["png"] = None
    conn.execute("""INSERT OR REPLACE INTO everyday_lists (list_id, conv_day, area, created_utc, params, n_doors,
                    n_turfs, csv_path, xlsx_path, map_path, geoid, heat, why, parts) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                 (lid, today.isoformat(), area["label"], iso(datetime.now(timezone.utc)),
                  json.dumps({"turf_size": turf_size, "bbox": area["bbox"]}), len(houses), len(turfs),
                  paths["csv"], paths["xlsx"], paths["png"], area["geoid"], whole["heat"], json.dumps(whole["why"]),
                  json.dumps(whole["parts"])))
    conn.execute("DELETE FROM door_list_stops WHERE list_id=?", (lid,))
    conn.execute("DELETE FROM door_list_turfs WHERE list_id=?", (lid,))
    conn.executemany("INSERT INTO door_list_turfs VALUES (?,?,?,?,?,?)",
                     [(lid, t, z["heat"], json.dumps(z["why"]), z["exp_inspections"], json.dumps(z["parts"]))
                      for t, z in enumerate(zs, 1)])
    conn.executemany("INSERT INTO door_list_stops VALUES (?,?,?,?,?,?,?,?)",
                     [(lid, t, k, h["pid"], h["address"], None, h["score"], h["flags"])
                      for t, turf in enumerate(turfs, 1) for k, h in enumerate(turf["stops"], 1)])
    conn.commit()
    return {"list_id": lid, "houses": houses, "turfs": turfs, "paths": paths, "area": area["label"],
            "heat": whole["heat"], "why": whole["why"], "geoid": area["geoid"]}


def build_top(conn, cfg, session=None, near=None, radius_mi=None, n=None, turf_size=None, log=print):
    """Door lists for the n best neighborhoods (skipping ones with no stored homes). Parcel downloads share one
    time budget (everyday.parcel_budget_s); after it, only stored buildings are used. Returns (lists, ranked)."""
    ev = cfg["everyday"]
    n = ev["refresh_lists"] if n is None else n
    ranked = areas(conn, cfg, near, radius_mi)
    budget, t0, made = ev["parcel_budget_s"], time.monotonic(), []
    for a in ranked[:2 * n + 3]:
        if len(made) >= n:
            break
        left = budget - (time.monotonic() - t0) if budget else None
        res = make_list(conn, cfg, a, session if left is None or left > 0 else None, turf_size, left, log=log)
        if res:
            made.append(res)
    return made, ranked
