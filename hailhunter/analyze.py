"""Raw observations -> storm events -> ranked 'hits' (one storm x one town).

  1. dedupe   : the official NCEI record of a hail report is linked to the original report
  2. cluster  : reports + radar hail within cluster_link_mi on the same storm day = one event
  3. hits     : each event is split by nearest town; sizes, counts and confidence per town
  4. score    : size x recency x distance x confidence x houses-to-knock, 0-100
"""
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

import numpy as np

from .geo import bearing_deg, compass, haversine_mi, haversine_np, interp
from .models import iso, parse_utc

CITY_PREFIX = re.compile(r"^\s*\d+(\.\d+)?\s+[NSEW]{1,3}\s+", re.I)
CELL = 0.05  # degrees; place lookups are done per ~3-mile cell


# ---------------------------------------------------------------- 1. dedupe
def dedupe_day(conn, day):
    conn.execute("UPDATE hail_obs SET dup_of=NULL WHERE conv_day=? AND kind IN ('ground','official')", (day,))
    rows = conn.execute("""SELECT uid, source, valid_utc, lat, lon, size_in FROM hail_obs
                           WHERE conv_day=? AND kind IN ('ground','official')""", (day,)).fetchall()
    lsr = [(r, parse_utc(r["valid_utc"])) for r in rows if r["source"] == "lsr"]
    n = 0
    for s in rows:
        if s["source"] != "stormevents":
            continue
        ts, best = parse_utc(s["valid_utc"]), None
        for l, tl in lsr:
            dt = abs((tl - ts).total_seconds()) / 60.0
            if dt > 45:
                continue
            d = haversine_mi(s["lat"], s["lon"], l["lat"], l["lon"])
            if d > 5 or abs((l["size_in"] or 0) - (s["size_in"] or 0)) > 0.5:
                continue
            key = d + dt / 15.0
            if best is None or key < best[0]:
                best = (key, l["uid"])
        if best:
            conn.execute("UPDATE hail_obs SET dup_of=? WHERE uid=?", (best[1], s["uid"]))
            n += 1
    return n


# ---------------------------------------------------------------- 2. cluster
def _groups(lats, lons, link_mi):
    n = len(lats)
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    cy = link_mi / 69.0
    cx = link_mi / (69.17 * np.cos(np.radians(min(89.0, float(np.max(np.abs(lats)))))))
    grid = defaultdict(list)
    for i in range(n):
        grid[(int(lats[i] // cy), int(lons[i] // cx))].append(i)
    for (gy, gx), members in grid.items():
        cand = np.array([j for dy in (-1, 0, 1) for dx in (-1, 0, 1) for j in grid.get((gy + dy, gx + dx), ())])
        for i in members:
            d = haversine_np(lats[i], lons[i], lats[cand], lons[cand])
            for j in cand[d <= link_mi]:
                ri, rj = find(i), find(int(j))
                if ri != rj:
                    parent[ri] = rj
    out = defaultdict(list)
    for i in range(n):
        out[find(i)].append(i)
    return list(out.values())


def cluster_day(conn, cfg, day):
    th = cfg["thresholds"]
    rows = conn.execute("""SELECT uid, kind, lat, lon, size_in, event_id FROM hail_obs
        WHERE conv_day=? AND dup_of IS NULL
          AND ((kind IN ('ground','official') AND size_in >= ?) OR (kind='radar' AND size_in >= ?))""",
                        (day, th["ground_min_in"], th["radar_min_in"])).fetchall()
    before = {r[0] for r in conn.execute("SELECT event_id FROM hail_events WHERE conv_day=?", (day,))}
    conn.execute("UPDATE hail_obs SET event_id=NULL, place_key=NULL WHERE conv_day=?", (day,))
    kept = []
    if rows:
        lats = np.array([r["lat"] for r in rows])
        lons = np.array([r["lon"] for r in rows])
        taken = set()
        for g in sorted(_groups(lats, lons, th["cluster_link_mi"]), key=len, reverse=True):
            kinds = Counter(rows[i]["kind"] for i in g)
            if kinds["ground"] + kinds["official"] == 0 and kinds["radar"] < th["radar_min_points"]:
                continue                                  # lone radar blip
            prev = Counter(rows[i]["event_id"] for i in g if rows[i]["event_id"])
            eid = next((c for c, _ in prev.most_common() if c not in taken), None)   # keep IDs stable
            if eid is None:
                eid = f"{day}-" + hashlib.sha1("|".join(sorted(rows[i]["uid"] for i in g)).encode()).hexdigest()[:6]
                while eid in taken:
                    eid += "x"
            taken.add(eid)
            conn.executemany("UPDATE hail_obs SET event_id=? WHERE uid=?", [(eid, rows[i]["uid"]) for i in g])
            kept.append(eid)
    gone = list(before - set(kept))
    if gone:
        q = ",".join("?" * len(gone))
        conn.execute(f"DELETE FROM hail_events WHERE event_id IN ({q})", gone)
        conn.execute(f"DELETE FROM hail_hits WHERE event_id IN ({q})", gone)
    return kept


# ---------------------------------------------------------------- 3. hits
class PlaceIndex:
    def __init__(self, conn):
        self.rows = conn.execute("SELECT geoid, name, state, lat, lon, pop, aland_sqmi, hu FROM places").fetchall()
        if self.rows:
            self.lat = np.array([r["lat"] for r in self.rows])
            self.lon = np.array([r["lon"] for r in self.rows])
            self.reff = np.sqrt(np.array([max(r["aland_sqmi"] or 0, 0) for r in self.rows]) / np.pi)
            self.pop = np.array([r["hu"] or r["pop"] or 0 for r in self.rows])   # size for tie-breaks

    def snap(self, lat, lon):
        """Nearest town, measured to the town's edge (approx. as a circle of its land area)."""
        adj = np.maximum(haversine_np(lat, lon, self.lat, self.lon) - self.reff, 0)
        near = np.where(adj <= adj.min() + 0.25)[0]
        i = int(near[np.argmax(self.pop[near])])          # tie -> bigger town
        return self.rows[i], float(adj[i])


def _place_for(pidx, lat, lon, r, snap_mi):
    if pidx.rows:
        p, adj = pidx.snap(lat, lon)
        if adj <= snap_mi:
            return {"key": p["geoid"], "name": p["name"], "state": p["state"], "pop": p["pop"], "hu": p["hu"],
                    "rural": 0}
        return {"key": f"rural-{p['geoid']}", "name": f"Rural area near {p['name']}", "state": p["state"],
                "pop": None, "hu": None, "rural": 1}
    city = CITY_PREFIX.sub("", r["city"] or "").strip().title()      # no town list: use report text
    if city:
        return {"key": f"city-{city}-{r['state']}", "name": city, "state": r["state"] or "", "pop": None, "hu": None,
                "rural": 0}
    return {"key": f"cell-{lat:.1f}-{lon:.1f}", "name": f"Area near {lat:.2f}, {lon:.2f}", "state": "",
            "pop": None, "hu": None, "rural": 1}


def _mx(vals):
    return max(vals) if vals else None


def build_day(conn, cfg, day, pidx):
    th, home, tz = cfg["thresholds"], cfg["home"], ZoneInfo(cfg["timezone"])
    now = iso(datetime.now(timezone.utc))
    rows = conn.execute("SELECT * FROM hail_obs WHERE conv_day=? AND event_id IS NOT NULL", (day,)).fetchall()
    dups = conn.execute("""SELECT s.size_in AS size_in, s.uid AS uid, p.uid AS puid FROM hail_obs s
                           JOIN hail_obs p ON s.dup_of = p.uid WHERE s.conv_day=?""", (day,)).fetchall()
    cells, buckets, where, events = {}, defaultdict(list), {}, defaultdict(list)
    for r in rows:
        ck = (round(r["lat"] / CELL), round(r["lon"] / CELL))
        if ck not in cells:
            cells[ck] = _place_for(pidx, ck[0] * CELL, ck[1] * CELL, r, th["place_snap_mi"])
        pl = cells[ck]
        buckets[(r["event_id"], pl["key"])].append(r)
        where[r["uid"]] = (r["event_id"], pl)
        events[r["event_id"]].append(r)
    conn.executemany("UPDATE hail_obs SET place_key=? WHERE uid=?", [(where[r["uid"]][1]["key"], r["uid"]) for r in rows])
    official_dups = defaultdict(list)
    for d in dups:
        if d["puid"] in where:
            ev, pl = where[d["puid"]]
            official_dups[(ev, pl["key"])].append(d["size_in"])

    keep_ids = set()
    for (eid, pkey), b in buckets.items():
        pl = where[b[0]["uid"]][1]
        ground = [r for r in b if r["kind"] == "ground"]
        offic = [r["size_in"] for r in b if r["kind"] == "official"] + official_dups.get((eid, pkey), [])
        radar = [r["size_in"] for r in b if r["kind"] == "radar"]
        gsizes = [r["size_in"] for r in ground] + offic
        radar_est = round(cfg["radar_size_factor"] * float(np.percentile(radar, 90)), 2) if radar else None
        if gsizes:
            best, basis = max(gsizes), "ground"
            if radar_est and radar_est > best:            # radar may lift a sparse ground report, max +0.5"
                best, basis = round(min(radar_est, best + 0.5), 2), "ground+radar"
        else:
            best, basis = radar_est, "radar est."
        w = np.array([1.0 if r["kind"] != "radar" else 0.5 for r in b]) * np.array([r["size_in"] for r in b])
        lat = float(np.average([r["lat"] for r in b], weights=w))
        lon = float(np.average([r["lon"] for r in b], weights=w))
        times = sorted(r["valid_utc"] for r in b)
        hit_id = f"{eid}|{pkey}"
        keep_ids.add(hit_id)
        conn.execute("""INSERT INTO hail_hits (hit_id, event_id, conv_day, place_key, place_name, state, place_pop,
                is_rural, lat, lon, dist_mi, bearing, max_ground_in, max_official_in, max_radar_in, best_size_in,
                size_basis, strong_ground, n_ground, n_official, n_radar, first_utc, last_utc, local_time,
                score, score_parts, first_seen, updated_at, place_hu)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,'{}',?,?,?)
            ON CONFLICT(hit_id) DO UPDATE SET place_name=excluded.place_name, state=excluded.state,
                place_pop=excluded.place_pop, is_rural=excluded.is_rural, lat=excluded.lat, lon=excluded.lon,
                dist_mi=excluded.dist_mi, bearing=excluded.bearing, max_ground_in=excluded.max_ground_in,
                max_official_in=excluded.max_official_in, max_radar_in=excluded.max_radar_in,
                best_size_in=excluded.best_size_in, size_basis=excluded.size_basis,
                strong_ground=excluded.strong_ground, n_ground=excluded.n_ground, n_official=excluded.n_official,
                n_radar=excluded.n_radar, first_utc=excluded.first_utc, last_utc=excluded.last_utc,
                local_time=excluded.local_time, updated_at=excluded.updated_at, place_hu=excluded.place_hu""",
                     (hit_id, eid, day, pkey, pl["name"], pl["state"], pl["pop"], pl["rural"], round(lat, 4),
                      round(lon, 4), round(haversine_mi(home["lat"], home["lon"], lat, lon), 1),
                      compass(bearing_deg(home["lat"], home["lon"], lat, lon)),
                      _mx([r["size_in"] for r in ground]), _mx(offic), _mx(radar), best, basis,
                      int(any(r["weight"] >= 0.85 for r in ground) or bool(offic)),
                      len(ground), len(offic), len(radar), times[0], times[-1],
                      parse_utc(times[0]).astimezone(tz).strftime("%a %b %d %Y %I:%M %p %Z"), now, now, pl["hu"]))
    old = [r[0] for r in conn.execute("SELECT hit_id FROM hail_hits WHERE conv_day=?", (day,))]
    stale = [h for h in old if h not in keep_ids]
    if stale:
        conn.executemany("DELETE FROM hail_hits WHERE hit_id=?", [(h,) for h in stale])

    for eid, ev in events.items():
        lat_all = [r["lat"] for r in ev]
        lon_all = [r["lon"] for r in ev]
        ground_ev = [r for r in ev if r["kind"] != "radar"] or ev
        clat = float(np.mean([r["lat"] for r in ground_ev]))
        clon = float(np.mean([r["lon"] for r in ground_ev]))
        dists = haversine_np(home["lat"], home["lon"], lat_all, lon_all)
        off = [r["size_in"] for r in ev if r["kind"] == "official"] + \
              [d["size_in"] for d in dups if d["puid"] in where and where[d["puid"]][0] == eid]
        times = sorted(r["valid_utc"] for r in ev)
        conn.execute("""INSERT OR REPLACE INTO hail_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                     (eid, day, times[0], times[-1], round(clat, 4), round(clon, 4), min(lat_all), max(lat_all),
                      min(lon_all), max(lon_all), _mx([r["size_in"] for r in ev if r["kind"] == "ground"]),
                      _mx(off), _mx([r["size_in"] for r in ev if r["kind"] == "radar"]),
                      sum(r["kind"] == "ground" for r in ev), len(off), sum(r["kind"] == "radar" for r in ev),
                      None, round(float(dists.min()), 1), compass(bearing_deg(home["lat"], home["lon"], clat, clon)),
                      None, now))


# ---------------------------------------------------------------- 4. score
def exposure(sc, homes, rural, pop=None):
    """Houses to knock. Uses Census housing units; falls back to population."""
    if rural:
        return sc["exposure_rural"]
    table, x = ("exposure_by_homes", homes) if homes is not None else ("exposure_by_pop", pop)
    if x is None:
        return sc["exposure_unknown"]
    e = sc[table][0][1]
    for th, v in sc[table]:
        if x >= th:
            e = v
    return e


def score_hit(h, cfg, today):
    sc = cfg["scoring"]
    conf = sc["confidence"]
    days = (today - date.fromisoformat(h["conv_day"])).days
    S = interp(sc["size_curve"], h["best_size_in"])
    R = interp(sc["recency_curve"], max(days, 0))
    D = interp(sc["distance_curve"], h["dist_mi"])
    if h["strong_ground"]:
        C = conf["ground_strong"]
    elif h["n_ground"] or h["n_official"]:
        C = conf["ground_weak"]
    else:
        C = conf["radar_only"]
    if sum(1 for k in ("n_ground", "n_official", "n_radar") if h[k]) >= 2:
        C = min(1.0, C + conf["multi_source_bonus"])
    E = exposure(sc, h["place_hu"], h["is_rural"], h["place_pop"])
    parts = {"size": round(S, 3), "recency": round(R, 3), "distance": round(D, 3), "confidence": round(C, 3),
             "houses": round(E, 3), "days_ago": days}
    return round(100 * S * R * D * C * E, 1), parts


def rescore_all(conn, cfg, today=None):
    today = today or datetime.now(ZoneInfo(cfg["timezone"])).date()
    ups = []
    for h in conn.execute("SELECT * FROM hail_hits").fetchall():
        s, parts = score_hit(h, cfg, today)
        ups.append((s, json.dumps(parts), h["hit_id"]))
    conn.executemany("UPDATE hail_hits SET score=?, score_parts=? WHERE hit_id=?", ups)
    for (eid,) in conn.execute("SELECT event_id FROM hail_events").fetchall():
        hs = conn.execute("""SELECT place_name, state, score FROM hail_hits WHERE event_id=?
                             ORDER BY is_rural, score DESC""", (eid,)).fetchall()
        if not hs:
            continue
        label = f"{hs[0]['place_name']}, {hs[0]['state']}" + (f" +{len(hs) - 1} more" if len(hs) > 1 else "")
        conn.execute("UPDATE hail_events SET area_label=?, top_score=? WHERE event_id=?",
                     (label, max(h["score"] for h in hs), eid))
    conn.commit()
    if conn.execute("SELECT 1 FROM nbhd_hits LIMIT 1").fetchone():
        from . import nbhd
        nbhd.rescore(conn, cfg, today)


def analyze(conn, cfg, days=None, today=None, log=None):
    """days=None -> every storm day in the database."""
    if days is None:
        days = [r[0] for r in conn.execute("SELECT DISTINCT conv_day FROM hail_obs ORDER BY conv_day")]
    pidx = PlaceIndex(conn)
    for i, day in enumerate(days, 1):
        dedupe_day(conn, day)
        cluster_day(conn, cfg, day)
        build_day(conn, cfg, day, pidx)
        if log and i % 50 == 0:
            log(f"    analyzed {i}/{len(days)} storm days")
    conn.commit()
    rescore_all(conn, cfg, today)
    return len(days)
