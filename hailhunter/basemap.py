"""A real-looking vector basemap for each walk (the HMP App's walk map), from Nebraska state GIS.

Map tiles are blocked in the app page, so the map is drawn from vectors the engine ships in the walk doc:
  basemap = {bbox: [w, s, e, n], streets: [{name, cls, path: [[lon, lat], ...]}], lots: [[[lon, lat], ...]],
             labels: [{text, at: [lon, lat], angle}], source, kb}
  route   = [[lon, lat], ...] through the stops in walking order (straight lines door to door).
  route_segments = [{from, to, path: [[lon, lat], ...], m, gap}] one per hop stop i -> i+1 (from/to = stop indexes):
            the walk along the streets, from the street point in front of one house to the next (shortest path on the
            basemap's streets). gap true = no street path in the data (or a detour over `route_max_detour_m`):
            path is a straight line then, drawn as a light dashed hop.
  stop_side = [{street, at: [lon, lat], side, m} | null] one per stop: the street the house is on (its address street
            when it is in the data, else the nearest), the point on that street in front of the house (`at`, where
            route_segments start and end), which side of the street the house sits on (compass N/NE/E/SE/S/SW/W/NW,
            from the street toward the house) and how far back (m). null = no street near enough.
All are ADDITIVE fields on walks/<zone id> and today/walk. No data (offline with nothing cached, a server down, the
time guard used) -> basemap, route_segments and stop_side null; the page falls back to its plain map. route needs no
network.

Sources (checked 2026-09-26 from the cloud session's network, `curl -sS -m 20`):
- streets: gis.ne.gov Street_Centerlines FeatureServer/0 (statewide NG911 road centerlines: every county, with
  PRE_DIR/ST_NAME/ST_TYPE and ST_CLASS; ST_CLASS is spotty by county, so the class also reads the name/speed).
- lots: gis.ne.gov StatewideParcelsExternal FeatureServer/0 (the parcel layer parcels.py already uses); only the
  outline is requested (no owner, no address: nothing personal lands in the doc).
Also responding (not used; the statewide layer already covers them): dcgis.org vector/Street_Centerlines (Douglas),
geodata.sarpy.gov PublicWorks/PublicWorksSarpy layer 3 "Street", gis.ne.gov Highways. Census TIGERweb and
arcgis.com are blocked by the network proxy.

Boxes: lots cover `bbox` (stops + `margin_m`, the box the page fits); streets cover the wider `street_bbox` (stops +
`street_margin_m`) so the corners a route turns at are there (a street piece the lots box cut off used to make the
route jump). Street labels sit inside `bbox`.
Size: lines are clipped to their box, simplified (Douglas-Peucker, `simplify_m`), rounded to `decimals`, same-name
street pieces are joined, and the whole thing is kept under `max_kb` (coarser lots, then the farthest lots dropped).
Cache: table basemap_cache (key = the rounded box) in the engine database, `max_age_days`; streets rarely change.
angle = degrees to rotate the label on a north-up screen (SVG rotate(), clockwise, y down), kept in -90..90.
"""
import heapq
import json
import math
import re
import sqlite3
import string
import sys
import time
from datetime import datetime, timedelta, timezone

from .config import DEFAULTS
from .runbudget import RunBudget

STREETS_URL = "https://gis.ne.gov/Enterprise/rest/services/Street_Centerlines/FeatureServer/0/query"
LOTS_URL = "https://gis.ne.gov/Enterprise/rest/services/StatewideParcelsExternal/FeatureServer/0/query"
STREET_FIELDS = "PRE_DIR,ST_NAME,ST_TYPE,POS_DIR,ST_CLASS,SP_LIMIT"
SOURCE = "Nebraska state GIS (NG911 street centerlines, statewide parcels)"
VERSION = 2                                     # bump to rebuild every cached basemap (2: street_bbox)
M_LAT = 110574.0                                # meters per degree of latitude

DIRS = {"NORTH": "N", "SOUTH": "S", "EAST": "E", "WEST": "W", "NORTHEAST": "NE", "NORTHWEST": "NW",
        "SOUTHEAST": "SE", "SOUTHWEST": "SW"}
TYPES = {"STREET": "St", "ST": "St", "AVENUE": "Ave", "AVE": "Ave", "AV": "Ave", "DRIVE": "Dr", "DR": "Dr",
         "ROAD": "Rd", "RD": "Rd", "LANE": "Ln", "LN": "Ln", "COURT": "Ct", "CT": "Ct", "CIRCLE": "Cir", "CIR": "Cir",
         "PLACE": "Pl", "PL": "Pl", "BOULEVARD": "Blvd", "BLVD": "Blvd", "PARKWAY": "Pkwy", "PKWY": "Pkwy",
         "TERRACE": "Ter", "TER": "Ter", "TRAIL": "Trl", "TRL": "Trl", "HIGHWAY": "Hwy", "HWY": "Hwy",
         "PLAZA": "Plz", "WAY": "Way", "LOOP": "Loop"}
# ST_CLASS (varies by county) -> the map's classes: hwy (widest) > major > minor > local > service
CLASSES = {"interstate": "hwy", "freeway": "hwy", "expressway": "hwy", "federal": "hwy", "primary": "hwy",
           "major arterial": "major", "principal arterial": "major", "other arterial": "major", "secondary": "major",
           "minor arterial": "minor", "collector": "minor", "major collector": "minor", "minor collector": "minor",
           "alley": "service", "access": "service", "driveway": "service", "private": "service", "ramp": "service",
           "service": "service", "service drive": "service", "vehicular trail": "service", "dirt": "service",
           "not constructed": None}


def _bcfg(cfg):
    return {**DEFAULTS["basemap"], **((cfg or {}).get("basemap") or {})}


# ---------- names and classes ----------

def street_name(a):
    """'North NYE Avenue' parts -> 'N Nye Ave'; '21ST' -> '21st'; single letters stay capital ('N M St')."""
    def word(w):
        return w.upper() if len(w) == 1 else string.capwords(w.lower())
    pre = (a.get("PRE_DIR") or "").strip().upper()
    name = " ".join(word(w) for w in (a.get("ST_NAME") or "").split())
    typ = (a.get("ST_TYPE") or "").strip().upper()
    post = (a.get("POS_DIR") or "").strip().upper()
    parts = [DIRS.get(pre, pre), name, TYPES.get(typ, string.capwords(typ.lower())), DIRS.get(post, post)]
    return " ".join(p for p in parts if p)


def street_class(a, name):
    """The drawing class; None = don't draw (roads not built yet)."""
    raw = (a.get("ST_CLASS") or "").strip().lower()
    n = name.upper()
    if raw in CLASSES and CLASSES[raw] is None:
        return None
    if any(k in n.split() for k in ("HWY", "HIGHWAY", "INTERSTATE", "US")) or n.startswith(("I-", "I ", "US ")):
        return "hwy"
    if raw in CLASSES:
        return CLASSES[raw]
    if "RAMP" in n.split():
        return "service"
    if (a.get("SP_LIMIT") or 0) >= 45:
        return "major"
    if (a.get("SP_LIMIT") or 0) >= 35:
        return "minor"
    return "local"


# ---------- geometry ----------

def _proj(lat0):
    kx = M_LAT * math.cos(math.radians(lat0))
    return kx, M_LAT


def simplify(pts, tol_m, lat0, closed=False):
    """Douglas-Peucker in meters (iterative). Closed rings keep their first/last point."""
    if len(pts) <= 2:
        return list(pts)
    kx, ky = _proj(lat0)
    xy = [(p[0] * kx, p[1] * ky) for p in pts]
    if closed and pts[0] == pts[-1] and len(pts) > 4:        # split the ring at its farthest point from the start
        far = max(range(1, len(pts) - 1), key=lambda i: (xy[i][0] - xy[0][0]) ** 2 + (xy[i][1] - xy[0][1]) ** 2)
        a = simplify(pts[:far + 1], tol_m, lat0)
        b = simplify(pts[far:], tol_m, lat0)
        return a[:-1] + b
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    tol2 = tol_m * tol_m
    while stack:
        i, j = stack.pop()
        (x1, y1), (x2, y2) = xy[i], xy[j]
        dx, dy = x2 - x1, y2 - y1
        L2 = dx * dx + dy * dy
        best, bi = -1.0, -1
        for k in range(i + 1, j):
            px, py = xy[k]
            if L2 == 0:
                d2 = (px - x1) ** 2 + (py - y1) ** 2
            else:
                t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / L2))
                d2 = (px - x1 - t * dx) ** 2 + (py - y1 - t * dy) ** 2
            if d2 > best:
                best, bi = d2, k
        if bi > 0 and best > tol2:
            keep[bi] = True
            stack += [(i, bi), (bi, j)]
    return [p for p, k in zip(pts, keep) if k]


def _clip_seg(p, q, box):
    """Liang-Barsky: the part of segment p-q inside box, or None."""
    x0, y0, x1, y1 = box
    t0, t1 = 0.0, 1.0
    dx, dy = q[0] - p[0], q[1] - p[1]
    for pp, qq in ((-dx, p[0] - x0), (dx, x1 - p[0]), (-dy, p[1] - y0), (dy, y1 - p[1])):
        if pp == 0:
            if qq < 0:
                return None
            continue
        r = qq / pp
        if pp < 0:
            t0 = max(t0, r)
        else:
            t1 = min(t1, r)
        if t0 > t1:
            return None
    return (p[0] + t0 * dx, p[1] + t0 * dy), (p[0] + t1 * dx, p[1] + t1 * dy), t0 > 0, t1 < 1


def clip_path(path, box):
    """A polyline cut to the box: a list of pieces (each 2+ points)."""
    out, cur = [], []
    for p, q in zip(path, path[1:]):
        c = _clip_seg(p, q, box)
        if c is None:
            if len(cur) >= 2:
                out.append(cur)
            cur = []
            continue
        a, b, cut_a, cut_b = c
        if not cur or cut_a:
            if len(cur) >= 2:
                out.append(cur)
            cur = [a]
        cur.append(b)
        if cut_b:
            out.append(cur)
            cur = []
    if len(cur) >= 2:
        out.append(cur)
    return out


def _q(pts, dec):
    out = []
    for x, y in pts:
        p = [round(x, dec), round(y, dec)]
        if not out or out[-1] != p:
            out.append(p)
    return out


def _len_m(path, lat0):
    kx, ky = _proj(lat0)
    return sum(math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * ky) for a, b in zip(path, path[1:]))


def join_paths(paths):
    """Join pieces that share an end point (same street) into longer lines: fewer, smoother strokes."""
    paths = [list(p) for p in paths]
    changed = True
    while changed:
        changed = False
        for i in range(len(paths)):
            for j in range(len(paths)):
                if i == j or not paths[i] or not paths[j]:
                    continue
                a, b = paths[i], paths[j]
                if a[-1] == b[0]:
                    paths[i] = a + b[1:]
                elif a[-1] == b[-1]:
                    paths[i] = a + b[::-1][1:]
                elif a[0] == b[-1]:
                    paths[i] = b + a[1:]
                elif a[0] == b[0]:
                    paths[i] = b[::-1] + a[1:]
                else:
                    continue
                paths[j] = None
                changed = True
        paths = [p for p in paths if p]
    return paths


def label_for(text, path, lat0, dec):
    """{text, at, angle} at the middle (by length) of a path, turned along it and kept upright."""
    kx, ky = _proj(lat0)
    segs = [(a, b, math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * ky)) for a, b in zip(path, path[1:])]
    half = sum(s[2] for s in segs) / 2
    for a, b, L in segs:
        if L > 0 and half <= L:
            t = half / L
            at = [round(a[0] + t * (b[0] - a[0]), dec), round(a[1] + t * (b[1] - a[1]), dec)]
            ang = math.degrees(math.atan2(-(b[1] - a[1]) * ky, (b[0] - a[0]) * kx))   # screen y points down
            if ang > 90:
                ang -= 180
            elif ang <= -90:
                ang += 180
            return {"text": text, "at": at, "angle": round(ang, 1)}
        half -= L
    return None


# ---------- boxes, fetching, building ----------

def walk_bbox(stops, cfg=None, margin_m=None):
    """[w, s, e, n] around the stops + margin (`margin_m`, default basemap.margin_m; at least min_span_m across),
    rounded out to 4 decimals (~10 m) so the same walk hits the same cache row. None without stops."""
    pts = [(float(s["lon"]), float(s["lat"])) for s in stops or [] if s.get("lat") is not None and s.get("lon") is not None]
    if not pts:
        return None
    b = _bcfg(cfg)
    w, e = min(p[0] for p in pts), max(p[0] for p in pts)
    s_, n = min(p[1] for p in pts), max(p[1] for p in pts)
    lat0 = (s_ + n) / 2
    kx, ky = _proj(lat0)
    m = b["margin_m"] if margin_m is None else margin_m
    half_x = max((e - w) * kx / 2 + m, b["min_span_m"] / 2) / kx
    half_y = max((n - s_) * ky / 2 + m, b["min_span_m"] / 2) / ky
    cx, cy = (w + e) / 2, lat0
    return [math.floor((cx - half_x) * 1e4) / 1e4, math.floor((cy - half_y) * 1e4) / 1e4,
            math.ceil((cx + half_x) * 1e4) / 1e4, math.ceil((cy + half_y) * 1e4) / 1e4]


def street_bbox(stops, cfg=None):
    """The wider box streets are fetched and drawn in (stops + basemap.street_margin_m; never smaller than
    walk_bbox)."""
    b = _bcfg(cfg)
    return walk_bbox(stops, cfg, max(b["street_margin_m"], b["margin_m"]))


def route(stops, cfg=None):
    """[[lon, lat], ...] through the stops in walking order (the doc's order); None with fewer than 2."""
    dec = _bcfg(cfg)["decimals"] + 1
    pts = [[round(float(s["lon"]), dec), round(float(s["lat"]), dec)] for s in stops or []
           if s.get("lat") is not None and s.get("lon") is not None]
    return pts if len(pts) >= 2 else None


def fetch_layer(session, url, bbox, fields, cfg=None, timeout=None):
    """Every feature of an ArcGIS layer touching bbox (lon/lat, lightly generalized by the server), paged."""
    b = _bcfg(cfg)
    out, offset = [], 0
    for _ in range(int(b["max_pages"])):
        params = {"where": "1=1", "geometry": ",".join(str(v) for v in bbox), "geometryType": "esriGeometryEnvelope",
                  "inSR": 4326, "spatialRel": "esriSpatialRelIntersects", "outFields": fields, "returnGeometry": "true",
                  "outSR": 4326, "geometryPrecision": 6, "maxAllowableOffset": 0.00001, "f": "json",
                  "resultOffset": offset, "resultRecordCount": 2000}
        r = session.get(url, params=params, timeout=timeout or b["timeout_s"])
        r.raise_for_status()
        d = r.json()
        if "error" in d:
            raise RuntimeError(str(d["error"])[:200])
        feats = d.get("features") or []
        out += feats
        if not d.get("exceededTransferLimit") or not feats:
            break
        offset += len(feats)
    return out


def build(street_feats, lot_feats, bbox, cfg=None, street_box=None):
    """The basemap dict from raw ArcGIS features (pure: no network). Lots are cut to bbox, streets to street_box
    (default bbox), street labels are placed inside bbox."""
    b = _bcfg(cfg)
    dec, tol = int(b["decimals"]), float(b["simplify_m"])
    lat0 = (bbox[1] + bbox[3]) / 2
    box = tuple(bbox)
    sbox = tuple(street_box or bbox)
    by_key = {}
    for f in street_feats:
        a = f.get("attributes") or {}
        name = street_name(a)
        cls = street_class(a, name)
        if cls is None:
            continue
        for path in (f.get("geometry") or {}).get("paths") or []:
            for piece in clip_path([tuple(p[:2]) for p in path], sbox):
                q = _q(simplify(piece, tol, lat0), dec)
                if len(q) >= 2:
                    by_key.setdefault((name, cls), []).append(q)
    streets, labels = [], []
    rank = {"hwy": 0, "major": 1, "minor": 2, "local": 3, "service": 4}
    for (name, cls), paths in sorted(by_key.items(), key=lambda kv: (rank.get(kv[0][1], 9), kv[0][0])):
        joined = join_paths(paths)
        for p in joined:
            streets.append({"name": name, "cls": cls, "path": p})
        inside = [pc for p in joined for pc in clip_path([tuple(x) for x in p], box)]   # labels: in the page's box
        if name and cls != "service" and inside:
            longest = max(inside, key=lambda p: _len_m(p, lat0))
            if _len_m(longest, lat0) >= b["label_min_m"]:
                lab = label_for(name, longest, lat0, dec)
                if lab:
                    labels.append(lab)
    rings = []
    bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    for f in lot_feats:
        rs = (f.get("geometry") or {}).get("rings") or []
        if not rs:
            continue
        xs = [p[0] for r in rs for p in r]
        ys = [p[1] for r in rs for p in r]
        if max(xs) - min(xs) > 2 * bw or max(ys) - min(ys) > 2 * bh:
            continue                                 # railroad / road right-of-way strips miles long: not a lot
        rings.append(max(rs, key=len))
    doc = {"bbox": list(bbox), "street_bbox": list(sbox), "streets": streets, "lots": [], "labels": labels,
           "source": SOURCE}
    cx, cy = (bbox[0] + bbox[2]) / 2, lat0
    kx, ky = _proj(lat0)

    def lots_at(t):
        seen, out = set(), []
        for r in rings:
            q = _q(simplify([tuple(p[:2]) for p in r], t, lat0, closed=True), dec)
            if len(q) >= 4 and q[0] == q[-1]:
                key = tuple(map(tuple, q))
                if key not in seen:                      # condo stacks repeat one outline
                    seen.add(key)
                    out.append(q)
        out.sort(key=lambda q: math.hypot((q[0][0] - cx) * kx, (q[0][1] - cy) * ky))   # nearest the middle first
        return out

    cap = b["max_kb"] * 1024
    for t in (tol, tol * 2, tol * 4):                    # coarser lots first ...
        doc["lots"] = lots_at(t)
        if _size(doc) <= cap:
            break
    while doc["lots"] and _size(doc) > cap:              # ... then drop the lots farthest from the walk's middle
        doc["lots"] = doc["lots"][:int(len(doc["lots"]) * 0.9)]
    if _size(doc) > cap:                                 # still too big: service roads (alleys, drives) go
        doc["streets"] = [s for s in doc["streets"] if s["cls"] != "service"]
    doc["kb"] = round(_size(doc) / 1024, 1)
    return doc


def _size(doc):
    return len(json.dumps(doc, separators=(",", ":")))


# ---------- walking route along the streets ----------

_ORD = re.compile(r"^(\d+)(ST|ND|RD|TH)$")
_DIR_WORDS = set(DIRS) | set(DIRS.values())
_TYPE_WORDS = {**{k: v.upper() for k, v in TYPES.items()}, **{v.upper(): v.upper() for v in TYPES.values()}}
_SIDES = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def street_key(name):
    """(core, type, dir) for matching an address's street to a map street: '22 St' and '22nd St' -> ('22', 'ST', ''),
    'N Broad St' -> ('BROAD', 'ST', 'N'), 'N St' -> ('N', 'ST', '') (a lone letter is the name, not a direction)."""
    ws = [_ORD.sub(r"\1", w) for w in re.sub(r"[^A-Z0-9 ]", " ", (name or "").upper()).split()]
    d = ""
    if (len(ws) >= 3 and ws[0] in _DIR_WORDS) or (len(ws) == 2 and ws[0] in _DIR_WORDS and ws[1] not in _TYPE_WORDS):
        d, ws = DIRS.get(ws[0], ws[0]), ws[1:]
    if len(ws) >= 3 and ws[-1] in _DIR_WORDS:                 # 'Main St NW'
        d, ws = d or DIRS.get(ws[-1], ws[-1]), ws[:-1]
    t = ""
    if len(ws) >= 2 and ws[-1] in _TYPE_WORDS:
        t, ws = _TYPE_WORDS[ws[-1]], ws[:-1]
    return " ".join(ws), t, d


def same_street(a, b):
    """True when two street_key()s name the same street (a missing type or direction on one side still matches)."""
    return bool(a[0]) and a[0] == b[0] and (not a[1] or not b[1] or a[1] == b[1]) and \
        (not a[2] or not b[2] or a[2] == b[2])


def _addr_street(address):
    m = re.match(r"^\s*\d+\S*\s+(.+?)\s*$", address or "")
    return m.group(1) if m else (address or "").strip()


def _near(p, a, c, kx, ky):
    """(t 0-1 along a->c, the nearest point on a-c to p, meters from p)."""
    dx, dy = (c[0] - a[0]) * kx, (c[1] - a[1]) * ky
    px, py = (p[0] - a[0]) * kx, (p[1] - a[1]) * ky
    L2 = dx * dx + dy * dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, (px * dx + py * dy) / L2))
    return t, (a[0] + t * (c[0] - a[0]), a[1] + t * (c[1] - a[1])), math.hypot(px - t * dx, py - t * dy)


def _dist(a, c, kx, ky):
    return math.hypot((c[0] - a[0]) * kx, (c[1] - a[1]) * ky)


def street_graph(bm, cfg=None):
    """The basemap's streets as a walkable graph: (segments [(a, c, name, cls, meters)], adjacency
    {node: [(node, cost, meters)]}). Nodes = street vertices (streets meeting at a corner share one). A street end
    within join_m of another street's side is joined to it (data not split at that corner). Alleys and drives cost
    route_service_factor x their length, so a route takes them only when they save a real walk."""
    b = _bcfg(cfg)
    lat0 = (bm["bbox"][1] + bm["bbox"][3]) / 2
    kx, ky = _proj(lat0)
    raw = []
    for st in bm.get("streets") or []:
        pts = [tuple(p[:2]) for p in st.get("path") or []]
        raw += [(a, c, st.get("name") or "", st.get("cls")) for a, c in zip(pts, pts[1:]) if a != c]
    deg = {}
    for a, c, _, _ in raw:
        deg[a] = deg.get(a, 0) + 1
        deg[c] = deg.get(c, 0) + 1
    J = float(b["join_m"])
    jx, jy = J / kx, J / ky
    splits, links = {}, []
    for e in (p for p, n in deg.items() if n == 1):          # dead ends: a T corner the data didn't split?
        best = None
        for i, (a, c, _, _) in enumerate(raw):
            if e == a or e == c or not (min(a[0], c[0]) - jx <= e[0] <= max(a[0], c[0]) + jx) or \
                    not (min(a[1], c[1]) - jy <= e[1] <= max(a[1], c[1]) + jy):
                continue
            t, q, d = _near(e, a, c, kx, ky)
            if d <= J and (best is None or d < best[0]):
                best = (d, i, t, q)
        if best:
            d, i, t, q = best
            a, c = raw[i][:2]
            q = a if _dist(q, a, kx, ky) < 0.5 else c if _dist(q, c, kx, ky) < 0.5 else q
            if q not in (a, c):
                splits.setdefault(i, []).append((t, q))
            links.append((e, q))
    segs = []
    for i, (a, c, name, cls) in enumerate(raw):
        pts = [a] + [q for _, q in sorted(splits.get(i, []))] + [c]
        segs += [(u, v, name, cls, _dist(u, v, kx, ky)) for u, v in zip(pts, pts[1:]) if u != v]
    segs += [(e, q, "", "link", _dist(e, q, kx, ky)) for e, q in links if e != q]
    adj = {}
    fac = float(b["route_service_factor"])
    for a, c, _, cls, m in segs:
        w = m * (fac if cls == "service" else 1.0)
        adj.setdefault(a, []).append((c, w, m))
        adj.setdefault(c, []).append((a, w, m))
    return segs, adj


def snap_stop(stop, segs, cfg=None, lat0=None, keys=None):
    """{i (segment), t, at, street, m} = where the house meets its street, or None. The address's own street within
    snap_max_m wins (a corner house faces its address street); else the nearest street within snap_any_m (alleys and
    drives last)."""
    if stop.get("lat") is None or stop.get("lon") is None:
        return None
    b = _bcfg(cfg)
    p = (float(stop["lon"]), float(stop["lat"]))
    kx, ky = _proj(lat0 if lat0 is not None else p[1])
    keys = keys if keys is not None else {}
    want = street_key(_addr_street(stop.get("address")))
    own = street = alley = None
    for i, (a, c, name, cls, _) in enumerate(segs):
        if cls == "link":
            continue
        t, q, d = _near(p, a, c, kx, ky)
        if name not in keys:
            keys[name] = street_key(name)
        hit = (d, i, t, q, name)
        if same_street(want, keys[name]) and d <= b["snap_max_m"] and (own is None or d < own[0]):
            own = hit
        if cls == "service":
            if d <= b["snap_any_m"] and (alley is None or d < alley[0]):
                alley = hit
        elif d <= b["snap_any_m"] and (street is None or d < street[0]):
            street = hit
    best = own or street or alley
    if best is None:
        return None
    d, i, t, q, name = best
    return {"i": i, "t": t, "at": q, "street": name, "m": d}


def _shortest(sa, sb, segs, adj, fac):
    """Cheapest street path between two snaps: (list of points from sa.at to sb.at) or None."""
    ia, ib = sa["i"], sb["i"]
    a0, a1, _, ca, La = segs[ia]
    b0, b1, _, cb, Lb = segs[ib]
    fa, fb = (fac if ca == "service" else 1.0), (fac if cb == "service" else 1.0)
    best, end = math.inf, None
    if ia == ib:                                             # same piece of street: straight along it
        best, end = abs(sa["t"] - sb["t"]) * La * fa, "direct"
    dist = {a0: sa["t"] * La * fa, a1: (1 - sa["t"]) * La * fa}
    prev = {n: None for n in dist}
    goal = {b0: sb["t"] * Lb * fb, b1: (1 - sb["t"]) * Lb * fb}
    heap = [(d, n) for n, d in dist.items()]
    heapq.heapify(heap)
    done = set()
    while heap:
        d, u = heapq.heappop(heap)
        if u in done or d > dist.get(u, math.inf):
            continue
        if d >= best:
            break
        done.add(u)
        if u in goal and d + goal[u] < best:
            best, end = d + goal[u], u
        for v, w, _ in adj.get(u, ()):
            nd = d + w
            if nd < dist.get(v, math.inf):
                dist[v], prev[v] = nd, u
                heapq.heappush(heap, (nd, v))
    if end is None:
        return None
    if end == "direct":
        return [sa["at"], sb["at"]]
    chain, n = [], end
    while n is not None:
        chain.append(n)
        n = prev[n]
    return [sa["at"]] + chain[::-1] + [sb["at"]]


def walk_route(stops, bm, cfg=None):
    """(route_segments, stop_side) for a walk (see the module doc), from its basemap's streets; (None, None) with no
    basemap. A basemap without streets near the doors gives straight gap hops and null sides. Pure: no network."""
    if not bm or not bm.get("bbox") or not stops:
        return None, None
    b = _bcfg(cfg)
    dec = int(b["decimals"]) + 1
    lat0 = (bm["bbox"][1] + bm["bbox"][3]) / 2
    kx, ky = _proj(lat0)
    segs, adj = street_graph(bm, cfg)
    keys = {}
    snaps = [snap_stop(s, segs, cfg, lat0, keys) for s in stops]

    def rp(p):
        return [round(p[0], dec), round(p[1], dec)]

    sides = []
    for s, sn in zip(stops, snaps):
        if sn is None:
            sides.append(None)
            continue
        dx = (float(s["lon"]) - sn["at"][0]) * kx
        dy = (float(s["lat"]) - sn["at"][1]) * ky
        side = _SIDES[int((math.degrees(math.atan2(dx, dy)) % 360 + 22.5) // 45) % 8] if sn["m"] >= 0.5 else None
        sides.append({"street": sn["street"], "at": rp(sn["at"]), "side": side, "m": round(sn["m"], 1)})
    here = [(sn["at"] if sn else (float(s["lon"]), float(s["lat"]))) if s.get("lat") is not None and
            s.get("lon") is not None else None for s, sn in zip(stops, snaps)]
    segments = []
    for i in range(len(stops) - 1):
        p, q = here[i], here[i + 1]
        if p is None or q is None:
            continue
        straight = _dist(p, q, kx, ky)
        path = _shortest(snaps[i], snaps[i + 1], segs, adj, float(b["route_service_factor"])) \
            if snaps[i] and snaps[i + 1] else None
        m = sum(_dist(u, v, kx, ky) for u, v in zip(path, path[1:])) if path else None
        gap = path is None or m > straight + float(b["route_max_detour_m"])
        if gap:
            path, m = [p, q], straight
        pts = []
        for pt in map(rp, path):
            if not pts or pts[-1] != pt:
                pts.append(pt)
        if len(pts) < 2:
            pts = [rp(p), rp(q)]
        segments.append({"from": i, "to": i + 1, "path": pts, "m": round(m), "gap": gap})
    return (segments if len(stops) >= 2 else None), sides


# ---------- cache ----------

def open_cache(db_path):
    """A connection holding table basemap_cache: the engine database when it exists, else in memory (no save)."""
    import os
    try:
        on_disk = bool(db_path and os.path.exists(db_path))
        conn = sqlite3.connect(db_path if on_disk else ":memory:", timeout=30)
        if on_disk:                                      # same as db.connect: synced folders can't delete files
            conn.execute("PRAGMA journal_mode=TRUNCATE")
        conn.execute("CREATE TABLE IF NOT EXISTS basemap_cache (key TEXT PRIMARY KEY, fetched_utc TEXT, doc TEXT)")
        conn.commit()
        return conn
    except sqlite3.Error:
        conn = sqlite3.connect(":memory:")
        conn.execute("CREATE TABLE basemap_cache (key TEXT PRIMARY KEY, fetched_utc TEXT, doc TEXT)")
        return conn


def cache_key(bbox, street_box=None):
    key = f"v{VERSION}:" + ",".join(f"{v:.4f}" for v in bbox)
    return key + ("|" + ",".join(f"{v:.4f}" for v in street_box) if street_box else "")


class Maker:
    """Adds `route` + `basemap` to walk docs. session=None or offline=True -> cache only. One time guard
    (`basemap.budget_s`) covers every walk of the run: once used, the rest use the cache or get null."""

    def __init__(self, cfg, conn=None, session=None, offline=False, log=None, clock=time.monotonic):
        self.cfg, self.b = cfg, _bcfg(cfg)
        self.conn = conn if conn is not None else open_cache(None)
        self.session = None if offline else session
        self.log = log or (lambda m: print(m, file=sys.stderr))
        self.rb = RunBudget(self.b["budget_s"], clock, self.log)
        self.stats = {"walks": 0, "cached": 0, "fetched": 0, "missing": 0, "errors": 0}
        self.mem = {}

    def _cached(self, key, fresh_only):
        try:
            r = self.conn.execute("SELECT fetched_utc, doc FROM basemap_cache WHERE key=?", (key,)).fetchone()
        except sqlite3.Error:
            return None
        if not r:
            return None
        if fresh_only:
            cut = datetime.now(timezone.utc) - timedelta(days=self.b["max_age_days"])
            try:
                if datetime.fromisoformat(r[0].replace("Z", "+00:00")) < cut:
                    return None
            except ValueError:
                return None
        return json.loads(r[1])

    def basemap(self, stops):
        bbox = walk_bbox(stops, self.cfg)
        if bbox is None or not self.b.get("enabled", True):
            return None
        sbox = street_bbox(stops, self.cfg)
        key = cache_key(bbox, sbox)
        if key in self.mem:
            return self.mem[key]
        doc = self._cached(key, True)
        if doc is not None:
            self.stats["cached"] += 1
        elif self.session is None or self.rb.skip("basemap", "uses cached maps only"):
            doc = self._cached(key, False)
            self.stats["cached" if doc else "missing"] += 1
        else:
            try:
                with self.rb.step("basemap"):
                    t = self.rb.cap(self.b["timeout_s"])
                    streets = fetch_layer(self.session, STREETS_URL, sbox, STREET_FIELDS, self.cfg, t)
                    lots = fetch_layer(self.session, LOTS_URL, bbox, "OBJECTID", self.cfg, self.rb.cap(t))
                doc = build(streets, lots, bbox, self.cfg, sbox)
                if not doc["streets"] and not doc["lots"]:
                    doc = None                                  # outside Nebraska / nothing there: page falls back
                else:
                    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                    self.conn.execute("INSERT OR REPLACE INTO basemap_cache VALUES (?,?,?)",
                                      (key, now, json.dumps(doc, separators=(",", ":"))))
                    self.conn.commit()
                self.stats["fetched" if doc else "missing"] += 1
            except Exception as e:                              # a map is optional: never costs the walk
                self.stats["errors"] += 1
                self.log(f"  basemap: {type(e).__name__}: {str(e)[:120]} (using cache if any)")
                doc = self._cached(key, False)
                if doc is None:
                    self.stats["missing"] += 1
        self.mem[key] = doc
        return doc

    def add(self, doc):
        """Adds route + basemap + route_segments + stop_side to one walk doc (in place) and returns it. Never raises."""
        if not isinstance(doc, dict):
            return doc
        stops = doc.get("stops") or []
        self.stats["walks"] += 1
        try:
            doc["route"] = route(stops, self.cfg)
            doc["basemap"] = self.basemap(stops) if stops else None
        except Exception as e:
            self.stats["errors"] += 1
            self.log(f"  basemap: {type(e).__name__}: {str(e)[:120]}")
            doc.setdefault("route", None)
            doc["basemap"] = None
        try:
            doc["route_segments"], doc["stop_side"] = walk_route(stops, doc["basemap"], self.cfg)
        except Exception as e:                                  # the street route is optional too
            self.stats["errors"] += 1
            self.log(f"  route: {type(e).__name__}: {str(e)[:120]}")
            doc["route_segments"], doc["stop_side"] = None, None
        return doc

    def summary(self):
        return {**self.stats, "budget": self.rb.summary()}
