"""The open map's walk + street tile for every pick, wherever it lands (Engine Mechanic, 2026-09-29, task map-west).

The open map's own street data (data/streets.json, data/areas.json) only covers the Omaha-Lincoln box, so a pick in
Columbus, Schuyler or David City had no walk drawn on it (the walk was in the Knock app only). The night shift now
adds, for the pick, the backup and the top 3 cards, to its brief's `map`:
  zwalks = {zone id: {zone_id, park, pn, s, c, r}}  every card's own walk (walks/<zone id>, the Knock app's order) in
          the page's AREAX shape (data/build/areas.py): s = one row per street run in walking order
          {n: street, b: hail band, h: doors, m: meters, f/t: cross streets, p: [[lon, lat], ...]}, c[i] = the
          walk from street i-1 to street i, r[i] = street i back to the car, park = where the walk starts.
  walks = {area id: same}  the first card per open-map area only (what pages before 2026-09-29 read; kept).
  tiles = [{o, s, t, box}]  real street lines around each walk that sits outside `openmap.streets_box` (the box
          data/streets.json holds), in streets.json's exact encoding, so the page draws them the same way.
Street lines come from the walk's `basemap` (hailhunter/basemap.py: gis.ne.gov Street_Centerlines, cached in the
engine database), the same public source data/streets.json was built from.

Privacy (no knocking yet): nothing here is a house. A street run is drawn corner to corner (each end is pushed out
along its street to the next cross street, at most `ext_max_m`), connectors and returns follow street vertices, and
the names are street names only (the stop's address street with the house number cut off).
"""
import heapq
import re
import json
import math
import sqlite3
from datetime import datetime, timezone

from . import basemap
from .config import DEFAULTS

CLS = {"hwy": 0, "major": 1, "minor": 2, "local": 3, "service": 3}   # basemap class -> streets.json class
TILE_VERSION = 1


def _ocfg(cfg):
    return {**DEFAULTS["openmap"], **((cfg or {}).get("openmap") or {})}


def band(hail):
    """The page's hail band for a street (areas.py): 2 / 1.5 / 1 / 0 (no hail: an everyday walk)."""
    h = hail if isinstance(hail, (int, float)) else 0
    return 2 if h >= 2 else 1.5 if h >= 1.5 else 1 if h >= 1 else 0


def _addr_name(address):
    """"3920 22 St" -> "22 St" (the Knock app's street name, no house number); None without a street."""
    from .night import _street
    s = _street(address)
    m = re.match(r"^\d+[A-Za-z]?\s+(\S+)$", s or "")
    if m and m.group(1).upper().strip(".") not in basemap._TYPE_WORDS:   # "3601 Broadway" (not "22 St"): the map's
        return None                                                      # own street name instead, never the number
    return s


# ---------- the walk ----------

def _graph(bm, cfg):
    segs, adj = basemap.street_graph(bm, cfg)
    names = {}                                   # node -> street names meeting there
    for a, c, name, cls, _ in segs:
        if name:
            names.setdefault(a, set()).add(name)
            names.setdefault(c, set()).add(name)
    for a, c, name, cls, _ in segs:              # a link (a T corner the data didn't split) joins both streets
        if cls == "link":
            both = names.get(a, set()) | names.get(c, set())
            names[a] = names[c] = set(both)
    nb = {}
    for a, c, name, cls, m in segs:
        if cls != "link":
            nb.setdefault(a, []).append((c, name, m))
            nb.setdefault(c, []).append((a, name, m))
    return segs, adj, names, nb


def _corner(u, own, names, nb):
    return bool((names.get(u) or set()) - {own}) or len(nb.get(u) or ()) != 2


def _extend(path, own, names, nb, max_m, kx, ky):
    """Push the end of `path` along street `own` to the next corner (cross street or dead end), at most max_m."""
    if len(path) < 2:
        return path
    u, prev, walked = path[-1], path[-2], 0.0
    out = list(path)
    seen = set(out)
    while not _corner(u, own, names, nb) and walked < max_m:
        nxt = [(v, m) for v, n, m in nb.get(u) or () if v != prev and n == own and v not in seen]
        if not nxt:
            break
        hx, hy = (u[0] - prev[0]) * kx, (u[1] - prev[1]) * ky          # the straightest way on
        v, m = max(nxt, key=lambda e: ((e[0][0] - u[0]) * kx * hx + (e[0][1] - u[1]) * ky * hy) /
                   (math.hypot((e[0][0] - u[0]) * kx, (e[0][1] - u[1]) * ky) or 1))
        out.append(v)
        seen.add(v)
        walked += m
        prev, u = u, v
    return out


def _run_path(snaps, segs, adj, fac, kx, ky):
    """Node path along the street through the run's first and last door (their segment ends, never the door points)."""
    first, last = snaps[0], snaps[-1]
    a0, a1 = segs[first["i"]][:2]
    if first["i"] == last["i"]:
        return [a0, a1] if first["t"] <= last["t"] else [a1, a0]
    b0, b1 = segs[last["i"]][:2]
    sp = basemap._shortest(first, last, segs, adj, fac)
    if not sp or len(sp) < 3:                                   # no street path in the data: the two segments
        fa = max((a0, a1), key=lambda p: basemap._dist(p, last["at"], kx, ky))
        nb_ = min((b0, b1), key=lambda p: basemap._dist(p, first["at"], kx, ky))
        return [fa, a1 if fa == a0 else a0, nb_, b1 if nb_ == b0 else b0]
    chain = sp[1:-1]
    oa = a1 if chain[0] == a0 else a0
    ob = b1 if chain[-1] == b0 else b0
    path = [oa] + chain + [ob]
    out = []
    for p in path:
        if not out or out[-1] != p:
            out.append(p)
    return out


def _dijkstra(src, adj, max_m=8000):
    dist, prev, h = {src: 0.0}, {src: None}, [(0.0, src)]
    while h:
        d, u = heapq.heappop(h)
        if d > dist[u]:
            continue
        if d > max_m:
            break
        for v, w, _ in adj.get(u, ()):
            if d + w < dist.get(v, math.inf):
                dist[v], prev[v] = d + w, u
                heapq.heappush(h, (d + w, v))
    return dist, prev


def _chain(prev, t):
    p = [t]
    while prev.get(p[-1]) is not None:
        p.append(prev[p[-1]])
    return p[::-1]


def _len(pts, kx, ky):
    return sum(basemap._dist(a, b, kx, ky) for a, b in zip(pts, pts[1:]))


def page_walk(walk, hail=None, cfg=None):
    """The open map's AREAX entry (module doc) for one walks/<zone id> doc that carries `basemap` + `stop_side`
    (basemap.Maker.add); None when there is no basemap or no door sits on a mapped street. Pure: no network."""
    stops = (walk or {}).get("stops") or []
    bm = (walk or {}).get("basemap")
    if not stops or not bm or not bm.get("streets"):
        return None
    oc, bc = _ocfg(cfg), {**DEFAULTS["basemap"], **((cfg or {}).get("basemap") or {})}
    lat0 = (bm["bbox"][1] + bm["bbox"][3]) / 2
    kx, ky = basemap._proj(lat0)
    segs, adj, names, nb = _graph(bm, cfg)
    keys = {}
    snaps = [basemap.snap_stop(s, segs, cfg, lat0, keys) for s in stops]
    # consecutive doors on the same street = one run (the Knock app's order)
    runs = []
    for s, sn in zip(stops, snaps):
        nm = _addr_name(s.get("address")) or (sn and sn["street"]) or ""
        k = basemap.street_key(nm)
        if runs and (basemap.same_street(k, runs[-1]["key"]) or not nm):
            runs[-1]["h"] += 1
            if sn:
                runs[-1]["snaps"].append(sn)
            continue
        runs.append({"n": nm, "key": k, "h": 1, "snaps": [sn] if sn else []})
    kept, pending = [], 0
    for r in runs:                                   # a run with no door on a mapped street: its doors join a neighbour
        if r["snaps"]:
            r["h"] += pending
            pending = 0
            kept.append(r)
        elif kept:
            kept[-1]["h"] += r["h"]
        else:
            pending += r["h"]
    if not kept:
        return None
    fac = float(bc["route_service_factor"])
    out, prev_end = [], None
    for r in kept:
        own = r["snaps"][0]["street"]
        p = _run_path(r["snaps"], segs, adj, fac, kx, ky)
        if prev_end is not None and len(r["snaps"]) == 1 and \
                basemap._dist(prev_end, p[-1], kx, ky) < basemap._dist(prev_end, p[0], kx, ky):
            p = p[::-1]                               # one door: face the way we came from
        p = _extend(p, own, names, nb, oc["ext_max_m"], kx, ky)
        p = _extend(p[::-1], own, names, nb, oc["ext_max_m"], kx, ky)[::-1]
        prev_end = p[-1]
        cross = lambda u: sorted((names.get(u) or set()) - {own})   # noqa: E731
        f, t = cross(p[0]), cross(p[-1])
        out.append({"n": r["n"] or own, "b": band(hail), "h": r["h"], "m": round(_len(p, kx, ky)),
                    "f": f[0] if f else "", "t": t[0] if t else "", "p": p})
    park = out[0]["p"][0]
    conns = [[]]
    for i in range(1, len(out)):
        a, b = out[i - 1]["p"][-1], out[i]["p"][0]
        dist, prv = _dijkstra(a, adj)
        conns.append(_chain(prv, b) if b in dist else [a, b])
    dist, prv = _dijkstra(park, adj)
    rets = [(_chain(prv, s["p"][-1])[::-1] if s["p"][-1] in dist else [s["p"][-1], park]) for s in out]
    dec = int(oc["decimals"])
    q = lambda pts: [[round(x, dec), round(y, dec)] for x, y in pts]   # noqa: E731
    for s in out:
        s["p"] = q(s["p"])
    return {"zone_id": walk.get("zone_id") or walk.get("id"), "park": q([park])[0], "pn": [out[0]["n"], out[0]["f"]],
            "s": out, "c": [q(c) for c in conns], "r": [q(r) for r in rets]}


# ---------- street tiles (data/streets.json's encoding) ----------

def tile_box(walk, cfg=None):
    """[w, s, e, n] of the street tile around a walk: its doors' box + tile_margin_m, at least tile_half_m from the
    middle each way, rounded out to 3 decimals (~100 m) so nights hit the same cache row."""
    oc = _ocfg(cfg)
    pts = [(float(s["lon"]), float(s["lat"])) for s in (walk or {}).get("stops") or []
           if s.get("lat") is not None and s.get("lon") is not None]
    if not pts:
        return None
    w, e = min(p[0] for p in pts), max(p[0] for p in pts)
    s_, n = min(p[1] for p in pts), max(p[1] for p in pts)
    kx, ky = basemap._proj((s_ + n) / 2)
    hx = max((e - w) * kx / 2 + oc["tile_margin_m"], oc["tile_half_m"]) / kx
    hy = max((n - s_) * ky / 2 + oc["tile_margin_m"], oc["tile_half_m"]) / ky
    cx, cy = (w + e) / 2, (s_ + n) / 2
    return [math.floor((cx - hx) * 1e3) / 1e3, math.floor((cy - hy) * 1e3) / 1e3,
            math.ceil((cx + hx) * 1e3) / 1e3, math.ceil((cy + hy) * 1e3) / 1e3]


def outside(box, cfg=None):
    """True when box is not wholly inside the open map's own street data (openmap.streets_box)."""
    b = _ocfg(cfg)["streets_box"]
    return box[0] < b[0] or box[1] < b[1] or box[2] > b[2] or box[3] > b[3]


def tile(street_feats, box, cfg=None):
    """Raw Street_Centerlines features -> {o, s, t, box, src} like data/streets.json (t = 4 classes of delta-coded
    int lines: highway, arterial, collector, local). Clipped to box, simplified to tile_simplify_m. Pure."""
    oc = _ocfg(cfg)
    S = float(oc["tile_scale"])
    ox, oy = round(box[0], 4), round(box[1], 4)
    lat0 = (box[1] + box[3]) / 2
    t = [[], [], [], []]
    for f in street_feats or []:
        a = f.get("attributes") or {}
        cls = basemap.street_class(a, basemap.street_name(a))
        if cls is None:
            continue
        c = CLS.get(cls, 3)
        for path in (f.get("geometry") or {}).get("paths") or []:
            for piece in basemap.clip_path([tuple(p[:2]) for p in path], tuple(box)):
                q = []
                for x, y in basemap.simplify(piece, float(oc["tile_simplify_m"]), lat0):
                    pt = (round((x - ox) * S), round((y - oy) * S))
                    if not q or q[-1] != pt:
                        q.append(pt)
                if len(q) < 2:
                    continue
                enc = [q[0][0], q[0][1]]
                for u, v in zip(q, q[1:]):
                    enc += [v[0] - u[0], v[1] - u[1]]
                t[c].append(enc)
    return {"o": [ox, oy], "s": S, "t": t, "box": list(box),
            "src": "Nebraska GIS Street_Centerlines (gis.ne.gov), simplified ~%g m" % oc["tile_simplify_m"]}


def get_tile(maker, box, cfg=None):
    """The street tile for box: engine-database cache (basemap_cache, key tile<v>:box), else gis.ne.gov through the
    basemap Maker's session and time guard; None offline with nothing cached or on a download error."""
    oc = _ocfg(cfg)
    key = f"tile{TILE_VERSION}:" + ",".join(f"{v:.3f}" for v in box)
    try:
        doc = maker._cached(key, True)
    except Exception:
        doc = None
    if doc is not None:
        return doc
    if maker.session is None or maker.rb.skip("map tile", "uses cached tiles only"):
        return maker._cached(key, False)
    try:
        with maker.rb.step("map tile"):
            feats = basemap.fetch_layer(maker.session, basemap.STREETS_URL, box, basemap.STREET_FIELDS, cfg,
                                        maker.rb.cap(maker.b["timeout_s"]))
        doc = tile(feats, box, cfg)
        if len(json.dumps(doc, separators=(",", ":"))) > oc["tile_max_kb"] * 1024:   # too big for hotel wifi:
            doc["t"][3] = []                                                          # locals go, main streets stay
        if not any(doc["t"]):
            return None
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        maker.conn.execute("INSERT OR REPLACE INTO basemap_cache VALUES (?,?,?)",
                           (key, now, json.dumps(doc, separators=(",", ":"))))
        maker.conn.commit()
        return doc
    except (Exception, sqlite3.Error) as e:                      # a tile is optional: never costs the brief
        maker.log(f"  map tile: {type(e).__name__}: {str(e)[:120]} (using cache if any)")
        return maker._cached(key, False)


# ---------- the brief's part ----------

def extra(doc, walks, maker, cfg=None):
    """{walks, zwalks, tiles} for the brief's pick, backup and top cards (module doc). walks = zones.walks() docs
    ({"walks/<zone id>": doc}); maker = basemap.Maker (None: nothing).
    out["walks"] is keyed by open-map area id, first card per area wins (the pick): what older pages read.
    out["zwalks"] is keyed by zone id, one per card (2026-09-29, task every-card-walk): two cards in one storm area
    (Columbus t3 + t1) each get their own walk, and a card with no area (an everyday backup) gets one too."""
    out = {"walks": {}, "zwalks": {}, "tiles": []}
    if maker is None:
        return out
    boxes, oc = [], _ocfg(cfg)
    for c in [doc.get("pick"), doc.get("backup"), *(doc.get("top") or [])]:
        zid = (c or {}).get("zone_id")
        if not zid or zid in out["zwalks"]:
            continue
        w = (walks or {}).get(f"walks/{zid}")
        if not w or not w.get("stops"):
            continue
        w = maker.add(json.loads(json.dumps(w)))                 # a copy: the brief's walk docs stay as they were
        try:
            pw = page_walk(w, c.get("hail_in"), cfg)
        except Exception as e:                                   # a map walk is optional too
            maker.log(f"  map walk {zid}: {type(e).__name__}: {str(e)[:120]}")
            pw = None
        if pw:
            out["zwalks"][zid] = pw
            aid = c.get("area_id")
            if aid and aid not in out["walks"]:
                out["walks"][aid] = pw
        box = tile_box(w, cfg)
        if box and outside(box, cfg) and len(out["tiles"]) < oc["max_tiles"] and not any(b[0] <= box[0] and b[1] <= box[1] and b[2] >= box[2] and
                                                  b[3] >= box[3] for b in boxes):
            t = get_tile(maker, box, cfg)
            if t:
                out["tiles"].append(t)
                boxes.append(box)
    return out
