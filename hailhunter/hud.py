"""Snapshot for the Command Center page: data/export/hud.json.
Engine facts only (storms, lists, targets, counts). Field results live in the page's own database."""
import csv
import glob
import json
import os
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from .geo import haversine_mi, interp
from .models import iso

AGENTS = [
    {"id": "storm_watch", "name": "Storm Watch", "role": "Pulls NWS hail reports, NEXRAD hail signatures and NOAA records every morning."},
    {"id": "swath_mapper", "name": "Swath Mapper", "role": "Downloads NOAA MRMS radar hail maps, corrects them with ground reports, scores 7,572 neighborhoods."},
    {"id": "door_planner", "name": "Door Planner", "role": "Finds every home in the hail zone and packs them into ~60-door walks."},
    {"id": "commercial_scout", "name": "Commercial Scout", "role": "Finds apartments and commercial buildings in hail, owners and management contacts."},
    {"id": "marketing", "name": "Marketing", "role": "Google Business Profile, Local Services Ads and Facebook ads aimed at hail zones."},
    {"id": "pipeline_clerk", "name": "Pipeline Clerk", "role": "Tracks every door, lead, inspection, claim and job logged in the field."},
]


def _neighborhoods(conn, cfg, since, limit=60):
    """Top block groups, each with the door-list turfs that fall inside it (nearest-stop match: a
    stop counts as inside a neighborhood if it's within ~0.6 mi of the block group's hit center -
    an approximation, not a polygon join; good enough to point a crew at the right turfs). T16."""
    rows = [dict(r) for r in conn.execute(
        """SELECT * FROM nbhd_hits WHERE state='NE' AND hail_in >= 1.0 AND conv_day >= ?
           ORDER BY score DESC LIMIT ?""", (since, limit))]
    lists_by_day = {}
    for L in conn.execute("SELECT * FROM door_lists").fetchall():
        lists_by_day.setdefault(L["conv_day"], []).append(L)
    out = []
    for h in rows:
        cand = [L for L in lists_by_day.get(h["conv_day"], [])
                if L["area"].split(",")[0].strip().lower() == (h["place_name"] or "").strip().lower()]
        list_id, turfs, first_stop = None, [], None
        if cand:
            list_id = cand[0]["list_id"]
            stops = conn.execute(
                """SELECT s.turf, s.stop, s.address, p.lat, p.lon FROM door_list_stops s
                   LEFT JOIN parcels p ON p.pid = s.pid WHERE s.list_id=?""", (list_id,)).fetchall()
            near = [s for s in stops if s["lat"] and s["lon"]
                    and haversine_mi(h["lat"], h["lon"], s["lat"], s["lon"]) <= 0.6]
            if near:
                counts = {}
                for s in near:
                    counts[s["turf"]] = counts.get(s["turf"], 0) + 1
                # top 3 by overlap, not every turf that brushes the block group - turfs are wide
                # street-walks that can span several neighborhoods, so a raw radius match over-collects.
                turfs = [t for t, _ in sorted(counts.items(), key=lambda x: -x[1])[:3]]
                best = min((s for s in near if s["turf"] == turfs[0]), key=lambda s: s["stop"])
                first_stop = {"address": best["address"], "lat": best["lat"], "lon": best["lon"]}
        hu = h["hu"] or 0
        out.append({
            "id": h["geoid"], "label": h["label"] or h["geoid"], "town": h["place_name"], "state": h["state"],
            "day": h["conv_day"], "hail": h["hail_in"],
            "hail_avg": h["mesh_p75_in"] if h["mesh_p75_in"] else h["hail_in"],
            "homes": hu, "homes_hit": round(hu * (h["frac_ge_1"] or 0)),
            "owner_occ": h["owner_share"], "median_built": h["med_year"], "score": h["score"],
            "lat": h["lat"], "lon": h["lon"], "list_id": list_id, "turfs": turfs, "first_stop": first_stop,
        })
    return out


def _wind_events(conn, cfg, since, limit=40):
    """Convective-day x town wind events for hud.json's `wind_events` (T6 v2 - Cowork's spec,
    cowork-to-code.md 2026-09-25 (8)). Grouped by the report's own city field, not a full place-match
    like hail gets - good enough for an informational feed, not exact town boundaries.
    Kept out of storms[]/door scoring on purpose - see the same note, additive-only contract."""
    import re
    from datetime import date

    rows = conn.execute(
        """SELECT conv_day, city, state, lat, lon, dist_mi, speed_mph, report_kind, remark
           FROM wind_obs WHERE conv_day >= ? AND (speed_mph >= 58 OR report_kind = 'damage')
           ORDER BY conv_day DESC""", (since,)).fetchall()
    groups = {}
    for r in rows:
        key = (r["conv_day"], (r["city"] or "?").strip(), r["state"])
        g = groups.setdefault(key, {"gust": [], "damage": [], "lat": [], "lon": [], "dist": []})
        if r["speed_mph"]:
            g["gust"].append(r["speed_mph"])
        if r["report_kind"] == "damage":
            g["damage"].append(r["remark"] or "")
        g["lat"].append(r["lat"])
        g["lon"].append(r["lon"])
        g["dist"].append(r["dist_mi"])
    roof_re = re.compile(r"roof|shingle|siding|\bshed\b|\bbarn\b|tree.{0,15}(house|roof|home)", re.I)

    def gust_factor(mph):
        if mph is None:
            return 0.0
        if mph >= 80:
            return 1.0
        if mph >= 70:
            return 0.7
        if mph >= 58:
            return 0.4
        return 0.2

    today = datetime.now(ZoneInfo(cfg["timezone"])).date()
    sc = cfg["scoring"]
    out = []
    for (day, city, state), g in groups.items():
        max_mph = max(g["gust"]) if g["gust"] else None
        sample = next((d for d in g["damage"] if d), "")
        roof = bool(roof_re.search(" ".join(g["damage"])))
        days_ago = (today - date.fromisoformat(day)).days
        min_dist = min(g["dist"]) if g["dist"] else None
        score = 100 * gust_factor(max_mph)
        if roof:
            score = min(100, score * 1.3) if score else 35.0  # damage-only report, no measured gust
        score *= interp(sc["recency_curve"], days_ago) * interp(sc["distance_curve"], min_dist or 0) * 0.6
        out.append({
            "day": day, "place": city, "state": state,
            "lat": round(sum(g["lat"]) / len(g["lat"]), 4), "lon": round(sum(g["lon"]) / len(g["lon"]), 4),
            "dist_mi": round(min_dist, 1) if min_dist is not None else None,
            "max_mph": max_mph, "gust_reports": len(g["gust"]), "damage_reports": len(g["damage"]),
            "roof_siding_damage": roof, "sample": sample[:120], "score": round(score, 1),
        })
    out.sort(key=lambda e: -e["score"])
    return out[:limit]


def build(conn, cfg, max_turfs=20, max_targets=80):
    tz = ZoneInfo(cfg["timezone"])
    today = datetime.now(tz).date()

    def one(sql, *a):
        r = conn.execute(sql, a).fetchone()
        return r[0] if r else None

    cal = one("SELECT value FROM meta WHERE key='mesh_calibration'")
    counts = {
        "storm_days": one("SELECT COUNT(DISTINCT conv_day) FROM hail_events"),
        "ground_reports": one("SELECT COUNT(*) FROM hail_obs WHERE kind!='radar' AND dup_of IS NULL"),
        "radar_points": one("SELECT COUNT(*) FROM hail_obs WHERE kind='radar'"),
        "radar_grids": one("SELECT COUNT(*) FROM swaths"),
        "neighborhoods": one("SELECT COUNT(*) FROM bgs"),
        "buildings": one("SELECT COUNT(*) FROM parcels"),
        "towns": one("SELECT COUNT(*) FROM places"),
        "calibration": json.loads(cal)["factor"] if cal else None,
        "calibration_pairs": json.loads(cal)["pairs"] if cal else None,
        "last_ingest_utc": one("SELECT MAX(finished_utc) FROM ingest_runs"),
        "last_swath_utc": one("SELECT MAX(processed_utc) FROM swaths"),
        "latest_storm_day": one("SELECT MAX(conv_day) FROM hail_events"),
    }
    since = (today - timedelta(days=365)).isoformat()
    storms = [dict(r) for r in conn.execute(
        """SELECT conv_day AS day, place_name AS place, state, lat, lon, dist_mi, best_size_in AS hail,
                  size_basis AS basis, n_ground + n_official AS reports, n_radar AS radar, score, is_rural AS rural,
                  place_hu AS homes, local_time
           FROM hail_hits WHERE conv_day >= ? AND score >= 5 ORDER BY score DESC LIMIT 160""", (since,))]
    lists = []
    for L in conn.execute("SELECT * FROM door_lists ORDER BY created_utc DESC").fetchall():
        turfs = []
        for t in conn.execute("""SELECT turf, COUNT(*) n, AVG(hail_in) h, SUM(score) v FROM door_list_stops
                                 WHERE list_id=? GROUP BY turf ORDER BY turf""", (L["list_id"],)):
            turfs.append({"turf": t["turf"], "doors": t["n"], "avg_hail": round(t["h"], 2), "value": round(t["v"])})
        stops = [dict(r) for r in conn.execute(
            """SELECT s.turf, s.stop, s.pid, s.address, s.hail_in AS hail, s.score, s.flags, p.city, p.zip, p.kind,
                      p.year_built AS built, p.lat, p.lon
               FROM door_list_stops s LEFT JOIN parcels p ON p.pid = s.pid
               WHERE s.list_id=? AND s.turf <= ? ORDER BY s.turf, s.stop""", (L["list_id"], max_turfs))]
        streets = {}
        for s in stops:
            streets.setdefault(s["turf"], {})
            st = " ".join(s["address"].split()[1:])
            streets[s["turf"]][st] = streets[s["turf"]].get(st, 0) + 1
        for t in turfs:
            if t["turf"] in streets:
                t["streets"] = ", ".join(k for k, _ in sorted(streets[t["turf"]].items(), key=lambda x: -x[1])[:3])
        lists.append({"id": L["list_id"], "day": L["conv_day"], "area": L["area"], "doors": L["n_doors"],
                      "turfs": turfs, "stops": stops, "created_utc": L["created_utc"]})
    targets = []
    files = sorted(glob.glob(os.path.join(cfg["paths"]["export"], "lists", "apartments_commercial_*.csv")))
    scout = {}
    sp = os.path.join(os.path.dirname(cfg["paths"]["db"]), "scout_contacts.json")
    if os.path.exists(sp):
        for c in json.load(open(sp))["contacts"]:
            for m in c["match"]:
                scout[m.lower()] = {k: v for k, v in c.items() if k != "match"}
    if files:
        with open(files[-1]) as f:
            allrows = list(csv.DictReader(f))
        apts = [r for r in allrows if r["Type"].startswith("Apart")][:40]
        pick = {id(r) for r in allrows[:max_targets]} | {id(r) for r in apts} | \
               {id(r) for r in allrows if r["Property address"].lower() in scout}
        for r in allrows:
            if id(r) in pick:
                targets.append({"rank": int(r["Rank"]), "address": r["Property address"], "city": r["City"],
                                "type": r["Type"], "building": r["Building"],
                                "value": float(r["Assessed building value ($)"] or 0),
                                "built": r["Year built"], "day": r["Storm date"],
                                "hail": float(r["Hail at building (in)"] or 0), "days_ago": int(r["Days ago"] or 0),
                                "owner": r["Owner (public record)"], "owner_mail": r["Owner mailing address"],
                                "score": float(r["Score"] or 0), "key": f"{r['Property address']}|{r['City']}",
                                "contact": scout.get(r["Property address"].lower())})
    neighborhoods = _neighborhoods(conn, cfg, since)
    wind_events = _wind_events(conn, cfg, since) if \
        conn.execute("SELECT 1 FROM wind_obs LIMIT 1").fetchone() else []
    agents = []
    for a in AGENTS:
        last = {"storm_watch": counts["last_ingest_utc"], "swath_mapper": counts["last_swath_utc"],
                "door_planner": lists[0]["created_utc"] if lists else None,
                "commercial_scout": datetime.fromtimestamp(os.path.getmtime(files[-1]), timezone.utc).strftime(
                    "%Y-%m-%dT%H:%M:%SZ") if files else None}.get(a["id"])
        extra = cfg.get("agent_schedule", {}).get(a["id"])
        agents.append({**a, "last_run_utc": last, **({"schedule": extra} if extra else {})})
    return {"generated_utc": iso(datetime.now(timezone.utc)), "home": cfg["home"], "radius_mi": cfg["hunt_radius_mi"],
            "counts": counts, "storms": storms, "lists": lists, "targets": targets,
            "neighborhoods": neighborhoods, "wind_events": wind_events, "agents": agents}


def write(conn, cfg, path=None):
    path = path or os.path.join(cfg["paths"]["export"], "hud.json")
    data = build(conn, cfg)
    with open(path + ".tmp", "w") as f:
        json.dump(data, f, separators=(",", ":"))
    os.replace(path + ".tmp", path)
    return path, data
