"""Neighborhood layer: Census block groups (250-1,500 homes each) + ACS housing data,
measured against each storm day's MRMS hail grid.

Score (0-100) = 100 x size x coverage x recency x distance x owners x homes x age
  size      calibrated radar hail size (75th percentile inside the neighborhood)
  coverage  share of the neighborhood that got >= 1" hail
  owners    share of homes that are owner-occupied (owners file claims)
  homes     number of homes (doors to knock)
  age       median year built (older roofs/siding take more damage)
"""
import io
import json
import os
import time
import zipfile
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

import numpy as np
from matplotlib.path import Path

from . import mrms
from .geo import bearing_deg, compass, haversine_mi, interp
from .models import iso
from .sources.places import FIPS

TIGER = [f"https://www2.census.gov/geo/tiger/TIGER{y}/BG/tl_{y}_{{fips}}_bg.zip" for y in (2024, 2023)]
ACS_DIR = "https://www2.census.gov/programs-surveys/acs/summary_file/{y}/table-based-SF/data/5YRData/acsdt5y{y}-{t}.dat"
ACS_TABLES = {"b25001": {"B25001_E001": "hu"},
              "b25003": {"B25003_E001": "occupied", "B25003_E002": "owner", "B25003_E003": "renter"},
              "b25035": {"B25035_E001": "med_year"},
              "b25077": {"B25077_E001": "med_value"}}


def _vendor():
    import sys
    v = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "vendor")
    if v not in sys.path:
        sys.path.insert(0, v)


# ------------------------------------------------------------------ Census housing (ACS)
def load_acs(conn, fetcher, cfg, log=print):
    want = tuple(f"{lvl}US{FIPS[s]}" for s in cfg["states"] for lvl in ("1500000", "1600000"))
    rows, vintage = {}, None
    for y in (2024, 2023):
        try:
            for t, cols in ACS_TABLES.items():
                txt = fetcher.get(ACS_DIR.format(y=y, t=t), ttl=None, cache=False).decode("utf-8", "replace")
                lines = txt.splitlines()
                head = lines[0].split("|")
                ix = {c: head.index(c) for c in cols}
                for ln in lines[1:]:
                    if not ln.startswith(want):
                        continue
                    f = ln.split("|")
                    g = f[0]
                    rec = rows.setdefault(g, {})
                    for c, name in cols.items():
                        try:
                            v = int(float(f[ix[c]]))
                            rec[name] = v if v >= 0 else None
                        except (ValueError, IndexError):
                            rec[name] = None
                log(f"  ACS {y} {t.upper()}: {len(rows):,} areas so far")
            vintage = str(y)
            break
        except Exception as e:
            log(f"  ACS {y} not available ({type(e).__name__}); trying older")
            rows = {}
    if not vintage:
        raise RuntimeError("Could not load ACS housing tables")
    out = []
    for g, r in rows.items():
        level = "bg" if g.startswith("1500000") else "place"
        out.append((g.split("US", 1)[1], level, r.get("hu"), r.get("occupied"), r.get("owner"), r.get("renter"),
                    r.get("med_year"), r.get("med_value"), vintage))
    conn.execute("DELETE FROM acs")
    conn.executemany("INSERT INTO acs VALUES (?,?,?,?,?,?,?,?,?)", out)
    conn.execute("UPDATE places SET hu = (SELECT hu FROM acs WHERE acs.geoid = places.geoid AND acs.level='place')")
    conn.commit()
    return len(out), vintage


# ------------------------------------------------------------------ block group shapes (TIGER)
def load_bgs(conn, fetcher, cfg, log=print):
    _vendor()
    import shapefile
    home, lim = cfg["home"], cfg["hunt_radius_mi"] + 5
    total = 0
    conn.execute("DELETE FROM bgs")
    for st in cfg["states"]:
        raw = None
        for u in TIGER:
            try:
                raw = fetcher.get(u.format(fips=FIPS[st]), ttl=None, cache=False)
                break
            except Exception as e:
                err = f"{type(e).__name__}: {e}"
                continue
        if raw is None:
            log(f"  block groups for {st}: download failed ({err[:120]})")
            continue
        z = zipfile.ZipFile(io.BytesIO(raw))
        base = next(n[:-4] for n in z.namelist() if n.endswith(".shp"))
        r = shapefile.Reader(shp=io.BytesIO(z.read(base + ".shp")), shx=io.BytesIO(z.read(base + ".shx")),
                             dbf=io.BytesIO(z.read(base + ".dbf")))
        names = [f[0] for f in r.fields[1:]]
        rows = []
        for sr in r.iterShapeRecords():
            a = dict(zip(names, sr.record))
            lat, lon = float(a["INTPTLAT"]), float(a["INTPTLON"])
            d = haversine_mi(home["lat"], home["lon"], lat, lon)
            if d > lim or not sr.shape.points:
                continue
            pts, parts = sr.shape.points, list(sr.shape.parts) + [len(sr.shape.points)]
            rings = [[[round(x, 5), round(y, 5)] for x, y in pts[parts[k]:parts[k + 1]]] for k in range(len(parts) - 1)]
            b = sr.shape.bbox
            rows.append((a["GEOID"], st, a["COUNTYFP"], a["TRACTCE"], a["BLKGRPCE"], lat, lon,
                         round(float(a["ALAND"]) / 2589988.11, 3), round(d, 1), b[0], b[1], b[2], b[3],
                         json.dumps(rings), None, None))
        conn.executemany("INSERT OR REPLACE INTO bgs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
        conn.commit()
        total += len(rows)
        log(f"  block groups {st}: {len(rows):,} in range")
    label_bgs(conn, cfg)
    return total


def label_bgs(conn, cfg):
    """Human label: '<town> - NE side' / 'central' / 'rural near <town>'."""
    from .analyze import PlaceIndex
    pidx = PlaceIndex(conn)
    if not pidx.rows:
        return
    ups = []
    for g, lat, lon, tract, bg in conn.execute("SELECT geoid, lat, lon, tract, bg FROM bgs").fetchall():
        code = f"{tract[:4].lstrip('0') or '0'}{'.' + tract[4:] if tract[4:] != '00' else ''}-{bg}"  # e.g. 9643-4
        p, adj = pidx.snap(lat, lon)
        if adj > cfg["thresholds"]["place_snap_mi"]:
            ups.append((f"rural-{p['geoid']}", f"Rural near {p['name']}, {p['state']} [{code}]", g))
            continue
        d = haversine_mi(p["lat"], p["lon"], lat, lon)
        reff = np.sqrt(max(p["aland_sqmi"] or 0, 0.01) / np.pi)
        side = "center" if d < 0.25 * reff + 0.2 else compass(bearing_deg(p["lat"], p["lon"], lat, lon))
        ups.append((p["geoid"], f"{p['name']}, {p['state']} {side} [{code}]", g))
    conn.executemany("UPDATE bgs SET place_key=?, label=? WHERE geoid=?", ups)
    conn.commit()


# ------------------------------------------------------------------ neighborhood -> grid cells
def cell_index(conn, cfg, meta):
    """Which 1-km grid cells fall inside each block group (cached per grid layout)."""
    key = f"{meta['lat0']}_{meta['lon0']}_{meta['shape'][0]}x{meta['shape'][1]}"
    path = os.path.join(os.path.dirname(cfg["paths"]["db"]), "mrms", f"bg_cells_{key}.npz")
    nbg = conn.execute("SELECT COUNT(*) FROM bgs").fetchone()[0]
    if os.path.exists(path):
        z = np.load(path, allow_pickle=False)
        if len(z["geoids"]) == nbg:
            return list(z["geoids"]), z["offsets"], z["cells"]
    H, W = meta["shape"]
    lat0, lon0, dlat, dlon = meta["lat0"], meta["lon0"], meta["dlat"], meta["dlon"]
    geoids, offsets, cells = [], [0], []
    for g, lat, lon, mnx, mny, mxx, mxy, rings in conn.execute(
            "SELECT geoid, lat, lon, min_lon, min_lat, max_lon, max_lat, rings FROM bgs ORDER BY geoid"):
        i0, i1 = max(0, int((lat0 - mxy) / dlat)), min(H - 1, int((lat0 - mny) / dlat) + 1)
        j0, j1 = max(0, int((mnx - lon0) / dlon)), min(W - 1, int((mxx - lon0) / dlon) + 1)
        ii, jj = np.mgrid[i0:i1 + 1, j0:j1 + 1]
        pts = np.column_stack([lon0 + jj.ravel() * dlon, lat0 - ii.ravel() * dlat])
        verts, codes = [], []
        for ring in json.loads(rings):
            verts += ring
            codes += [Path.MOVETO] + [Path.LINETO] * (len(ring) - 2) + [Path.CLOSEPOLY]
        inside = Path(verts, codes).contains_points(pts)
        flat = (ii.ravel()[inside] * W + jj.ravel()[inside]).astype(np.int32)
        if flat.size == 0:                                   # smaller than one cell: use the cell it sits in
            ci, cj = int(round((lat0 - lat) / dlat)), int(round((lon - lon0) / dlon))
            flat = np.array([min(max(ci, 0), H - 1) * W + min(max(cj, 0), W - 1)], np.int32)
        geoids.append(g)
        cells.append(flat)
        offsets.append(offsets[-1] + flat.size)
    cells = np.concatenate(cells) if cells else np.zeros(0, np.int32)
    offsets = np.array(offsets, np.int64)
    with open(path, "wb") as f:
        np.savez_compressed(f, geoids=np.array(geoids), offsets=offsets, cells=cells)
    return geoids, offsets, cells


# ------------------------------------------------------------------ calibration
def calibrate(conn, cfg, log=print):
    """Compare trusted ground reports with the radar grid at the same spot (+-2 km).
    factor = median(reported size / radar size); applied to all radar sizes."""
    ratios, pairs = [], 0
    days = [r[0] for r in conn.execute("SELECT conv_day FROM swaths WHERE complete=1")]
    for d in days:
        grid, meta = mrms.load_grid(cfg, d)
        if grid is None:
            continue
        H, W = grid.shape
        for lat, lon, size in conn.execute("""SELECT lat, lon, size_in FROM hail_obs WHERE conv_day=?
                AND kind IN ('ground','official') AND dup_of IS NULL AND size_in >= 1.0 AND weight >= 0.85""", (d,)):
            i, j = int(round((meta["lat0"] - lat) / meta["dlat"])), int(round((lon - meta["lon0"]) / meta["dlon"]))
            if not (2 <= i < H - 2 and 2 <= j < W - 2):
                continue
            m = float(grid[i - 2:i + 3, j - 2:j + 3].max())
            if m >= 0.5:
                ratios.append(size / m)
                pairs += 1
    if pairs < 30:
        log(f"  calibration: only {pairs} report/radar pairs; keeping factor 1.0")
        return None
    r = np.array(ratios)
    res = {"factor": round(float(np.clip(np.median(r), 0.5, 1.5)), 3), "pairs": pairs,
           "p25": round(float(np.percentile(r, 25)), 3), "p75": round(float(np.percentile(r, 75)), 3),
           "days": len(days), "computed_utc": iso(datetime.now(timezone.utc))}
    from .db import set_meta
    set_meta(conn, "mesh_calibration", res)
    return res


def mesh_factor(conn, cfg):
    fixed = cfg.get("neighborhood", {}).get("mesh_factor")
    if fixed:
        return float(fixed)
    from .db import get_meta
    c = get_meta(conn, "mesh_calibration")
    return c["factor"] if c else 1.0


# ------------------------------------------------------------------ radar + ground fusion
def fused_grid(conn, cfg, day):
    """Radar hail grid corrected by trusted ground reports.

    At each trusted report: ratio = reported size / radar size there. The ratio spreads to nearby
    cells with a Gaussian fall-off (fusion.length_mi) and blends back to the region-wide calibration
    factor far from any report. Returns (inches grid, meta, reports used)."""
    grid, meta = mrms.load_grid(cfg, day)
    if grid is None:
        return None, None, []
    fu = cfg["neighborhood"]["fusion"]
    g0 = mesh_factor(conn, cfg)
    H, W = grid.shape
    num = np.zeros_like(grid)
    den = np.zeros_like(grid)
    L, used = fu["length_mi"], []
    reach = 2.5 * L
    for r in conn.execute("""SELECT lat, lon, size_in, city, local_time FROM hail_obs WHERE conv_day=?
            AND kind IN ('ground','official') AND dup_of IS NULL AND size_in >= 0.75 AND weight >= ?""",
                          (day, fu["min_weight"])):
        i = int(round((meta["lat0"] - r["lat"]) / meta["dlat"]))
        j = int(round((r["lon"] - meta["lon0"]) / meta["dlon"]))
        if not (0 <= i < H and 0 <= j < W):
            continue
        radar = float(grid[max(0, i - 1):i + 2, max(0, j - 1):j + 2].max())
        lo, hi = fu["ratio_range"]
        ratio = float(np.clip(r["size_in"] / max(radar, fu["radar_floor_in"]), lo, hi))
        mi_lat = 69.05 * meta["dlat"]
        mi_lon = 69.17 * np.cos(np.radians(r["lat"])) * meta["dlon"]
        di, dj = int(reach / mi_lat) + 1, int(reach / mi_lon) + 1
        i0, i1, j0, j1 = max(0, i - di), min(H, i + di + 1), max(0, j - dj), min(W, j + dj + 1)
        ii, jj = np.mgrid[i0:i1, j0:j1]
        w = np.exp(-(((ii - i) * mi_lat) ** 2 + ((jj - j) * mi_lon) ** 2) / (L * L)).astype(np.float32)
        num[i0:i1, j0:j1] += w * ratio
        den[i0:i1, j0:j1] += w
        used.append({"lat": r["lat"], "lon": r["lon"], "size_in": r["size_in"], "radar_in": round(radar, 2),
                     "ratio": round(ratio, 2), "city": r["city"], "time": r["local_time"]})
    w0 = fu["prior_weight"]
    return grid * ((num + w0 * g0) / (den + w0)), meta, used


# ------------------------------------------------------------------ measure + score
def measure_day(conn, cfg, day, index=None):
    grid, meta, _ = fused_grid(conn, cfg, day)
    if grid is None:
        return 0
    nb = cfg["neighborhood"]
    geoids, offsets, cells = index or cell_index(conn, cfg, meta)
    vals = grid.ravel()[cells]
    seg_max = np.maximum.reduceat(vals, offsets[:-1]) if len(cells) else np.zeros(0)
    hot = np.where(seg_max >= nb["min_store_in"])[0]
    info = {r["geoid"]: r for r in conn.execute("""SELECT b.geoid, b.label, b.lat, b.lon, b.state, b.place_key,
            a.hu, a.occupied, a.owner, a.med_year, a.med_value FROM bgs b LEFT JOIN acs a
            ON a.geoid = b.geoid AND a.level = 'bg'""")}
    home, now = cfg["home"], iso(datetime.now(timezone.utc))
    keep = []
    for s in hot:
        g = geoids[s]
        v = vals[offsets[s]:offsets[s + 1]]
        r = info.get(g)
        if r is None:
            continue
        own = (r["owner"] / r["occupied"]) if r["occupied"] else None
        place = (r["label"] or "").split(",")[0].replace("Rural near ", "")
        keep.append(g)
        conn.execute("""INSERT INTO nbhd_hits (conv_day, geoid, label, place_name, state, lat, lon, dist_mi, bearing,
                hu, owner_share, med_year, med_value, mesh_max_in, mesh_p75_in, hail_in, frac_ge_1, frac_ge_15, cells,
                score, score_parts, first_seen, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,'{}',?,?)
            ON CONFLICT(conv_day, geoid) DO UPDATE SET label=excluded.label, hu=excluded.hu,
                owner_share=excluded.owner_share, med_year=excluded.med_year, med_value=excluded.med_value,
                mesh_max_in=excluded.mesh_max_in, mesh_p75_in=excluded.mesh_p75_in, hail_in=excluded.hail_in,
                frac_ge_1=excluded.frac_ge_1, frac_ge_15=excluded.frac_ge_15, cells=excluded.cells,
                updated_at=excluded.updated_at""",
                     (day, g, r["label"], place, r["state"], r["lat"], r["lon"],
                      round(haversine_mi(home["lat"], home["lon"], r["lat"], r["lon"]), 1),
                      compass(bearing_deg(home["lat"], home["lon"], r["lat"], r["lon"])),
                      r["hu"], None if own is None else round(own, 3), r["med_year"], r["med_value"],
                      round(float(v.max()), 2), round(float(np.percentile(v, 75)), 2),
                      round(float(np.percentile(v, 75)), 2), round(float((v >= nb["coverage_in"]).mean()), 3),
                      round(float((v >= 1.5).mean()), 3), int(v.size), now, now))
    old = [r[0] for r in conn.execute("SELECT geoid FROM nbhd_hits WHERE conv_day=?", (day,))]
    stale = set(old) - set(keep)
    if stale:
        conn.executemany("DELETE FROM nbhd_hits WHERE conv_day=? AND geoid=?", [(day, g) for g in stale])
    conn.commit()
    return len(keep)


def score_row(h, cfg, today):
    sc, nb = cfg["scoring"], cfg["neighborhood"]
    days = (today - date.fromisoformat(h["conv_day"])).days
    S = interp(sc["size_curve"], h["hail_in"])
    COV = nb["coverage_floor"] + (1 - nb["coverage_floor"]) * (h["frac_ge_1"] or 0)
    R = interp(sc["recency_curve"], max(days, 0))
    D = interp(sc["distance_curve"], h["dist_mi"])
    O = nb["owner_floor"] + (1 - nb["owner_floor"]) * h["owner_share"] if h["owner_share"] is not None else nb["owner_unknown"]
    HU = min(1.0, max(nb["homes_floor"], ((h["hu"] or 0) / nb["homes_full"]) ** 0.5))
    A = interp(nb["age_curve"], h["med_year"]) if h["med_year"] else nb["age_unknown"]
    parts = {"size": round(S, 3), "coverage": round(COV, 3), "recency": round(R, 3), "distance": round(D, 3),
             "owners": round(O, 3), "homes": round(HU, 3), "age": round(A, 3), "days_ago": days}
    return round(100 * S * COV * R * D * O * HU * A, 1), parts


def rescore(conn, cfg, today=None):
    today = today or datetime.now(ZoneInfo(cfg["timezone"])).date()
    ups = []
    for h in conn.execute("SELECT * FROM nbhd_hits").fetchall():
        sc, parts = score_row(h, cfg, today)
        ups.append((sc, json.dumps(parts), h["conv_day"], h["geoid"]))
    conn.executemany("UPDATE nbhd_hits SET score=?, score_parts=? WHERE conv_day=? AND geoid=?", ups)
    conn.commit()
    return len(ups)


def top(conn, limit=25, day=None, since=None, near=None, min_score=0.1):
    q, a = "SELECT * FROM nbhd_hits WHERE score >= ?", [min_score]
    if day:
        q += " AND conv_day = ?"
        a.append(day)
    if since:
        q += " AND conv_day >= ?"
        a.append(since)
    if near:
        q += " AND lower(place_name) LIKE ?"
        a.append(near.lower() + "%")
    q += " ORDER BY score DESC LIMIT ?"
    a.append(limit)
    return [dict(r) for r in conn.execute(q, a)]
