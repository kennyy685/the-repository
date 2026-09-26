"""A real-looking vector basemap for each walk (the HMP App's walk map), from Nebraska state GIS.

Map tiles are blocked in the app page, so the map is drawn from vectors the engine ships in the walk doc:
  basemap = {bbox: [w, s, e, n], streets: [{name, cls, path: [[lon, lat], ...]}], lots: [[[lon, lat], ...]],
             labels: [{text, at: [lon, lat], angle}], source, kb}
  route   = [[lon, lat], ...] through the stops in walking order (straight lines door to door).
Both are ADDITIVE fields on walks/<zone id> and today/walk. No data (offline with nothing cached, a server down, the
time guard used) -> basemap null; the page falls back to its plain map. route needs no network.

Sources (checked 2026-09-26 from the cloud session's network, `curl -sS -m 20`):
- streets: gis.ne.gov Street_Centerlines FeatureServer/0 (statewide NG911 road centerlines: every county, with
  PRE_DIR/ST_NAME/ST_TYPE and ST_CLASS; ST_CLASS is spotty by county, so the class also reads the name/speed).
- lots: gis.ne.gov StatewideParcelsExternal FeatureServer/0 (the parcel layer parcels.py already uses); only the
  outline is requested (no owner, no address: nothing personal lands in the doc).
Also responding (not used; the statewide layer already covers them): dcgis.org vector/Street_Centerlines (Douglas),
geodata.sarpy.gov PublicWorks/PublicWorksSarpy layer 3 "Street", gis.ne.gov Highways. Census TIGERweb and
arcgis.com are blocked by the network proxy.

Size: lines are clipped to the walk's box, simplified (Douglas-Peucker, `simplify_m`), rounded to `decimals`, same-name
street pieces are joined, and the whole thing is kept under `max_kb` (coarser lots, then the farthest lots dropped).
Cache: table basemap_cache (key = the rounded box) in the engine database, `max_age_days`; streets rarely change.
angle = degrees to rotate the label on a north-up screen (SVG rotate(), clockwise, y down), kept in -90..90.
"""
import json
import math
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
VERSION = 1                                     # bump to rebuild every cached basemap
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

def walk_bbox(stops, cfg=None):
    """[w, s, e, n] around the stops + margin (at least min_span_m across), rounded out to 4 decimals (~10 m) so
    the same walk hits the same cache row. None without stops."""
    pts = [(float(s["lon"]), float(s["lat"])) for s in stops or [] if s.get("lat") is not None and s.get("lon") is not None]
    if not pts:
        return None
    b = _bcfg(cfg)
    w, e = min(p[0] for p in pts), max(p[0] for p in pts)
    s_, n = min(p[1] for p in pts), max(p[1] for p in pts)
    lat0 = (s_ + n) / 2
    kx, ky = _proj(lat0)
    half_x = max((e - w) * kx / 2 + b["margin_m"], b["min_span_m"] / 2) / kx
    half_y = max((n - s_) * ky / 2 + b["margin_m"], b["min_span_m"] / 2) / ky
    cx, cy = (w + e) / 2, lat0
    return [math.floor((cx - half_x) * 1e4) / 1e4, math.floor((cy - half_y) * 1e4) / 1e4,
            math.ceil((cx + half_x) * 1e4) / 1e4, math.ceil((cy + half_y) * 1e4) / 1e4]


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


def build(street_feats, lot_feats, bbox, cfg=None):
    """The basemap dict from raw ArcGIS features (pure: no network)."""
    b = _bcfg(cfg)
    dec, tol = int(b["decimals"]), float(b["simplify_m"])
    lat0 = (bbox[1] + bbox[3]) / 2
    box = tuple(bbox)
    by_key = {}
    for f in street_feats:
        a = f.get("attributes") or {}
        name = street_name(a)
        cls = street_class(a, name)
        if cls is None:
            continue
        for path in (f.get("geometry") or {}).get("paths") or []:
            for piece in clip_path([tuple(p[:2]) for p in path], box):
                q = _q(simplify(piece, tol, lat0), dec)
                if len(q) >= 2:
                    by_key.setdefault((name, cls), []).append(q)
    streets, labels = [], []
    rank = {"hwy": 0, "major": 1, "minor": 2, "local": 3, "service": 4}
    for (name, cls), paths in sorted(by_key.items(), key=lambda kv: (rank.get(kv[0][1], 9), kv[0][0])):
        joined = join_paths(paths)
        for p in joined:
            streets.append({"name": name, "cls": cls, "path": p})
        if name and cls != "service":
            longest = max(joined, key=lambda p: _len_m(p, lat0))
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
    doc = {"bbox": list(bbox), "streets": streets, "lots": [], "labels": labels, "source": SOURCE}
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


def cache_key(bbox):
    return f"v{VERSION}:" + ",".join(f"{v:.4f}" for v in bbox)


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
        key = cache_key(bbox)
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
                    streets = fetch_layer(self.session, STREETS_URL, bbox, STREET_FIELDS, self.cfg, t)
                    lots = fetch_layer(self.session, LOTS_URL, bbox, "OBJECTID", self.cfg, self.rb.cap(t))
                doc = build(streets, lots, bbox, self.cfg)
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
        """Adds route + basemap to one walk doc (in place) and returns it. Never raises."""
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
        return doc

    def summary(self):
        return {**self.stats, "budget": self.rb.summary()}
