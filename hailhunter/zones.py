"""Hot zones near a town (`hh.py zones`): FilthE's core flow, "map of hot zones near me -> drive there -> knock the
best doors". Reads hud.json (no database needed; the database only adds block-group outlines when it is there).

A zone = one walk (turf) of a door list: storm lists whose storm is recent enough (todaywalk.storm_max_days, by
month) and everyday (old-house) lists. Ranked by the engine's Hot Zones heat for that walk, within `radius_mi` of
the town, top `top`. Output = the HMP App's `zones/current` doc:
{as_of, near {name, lat, lon}, radius_mi, zones: [{id, name, center {lat, lon}, polygon, polygon_kind, score, heat,
 hail_in, storm_day, homes, why {en, es}, walk_id, kind, dist_mi, list_id, turf}], none_reason?}
- kind "wind" zones (T116/T117, `wind_zones`) come after the walk zones: one per wind event, own map layer, no walk
  (walk_id/list_id/turf/homes/polygon null), plus max_mph, trees_down, wind_dir. none_reason is about walks only.
- id = walk_id = "<list_id>~t<turf>" (the same walk key the command center and `weekly` use).
- score = the walk's heat 0-100 (chance of a sale); heat = score / the top zone's score (0-1, for map color).
- polygon = [[lon, lat], ...] closed ring: the neighborhood's Census block-group outline (simplified) when the
  database has it (everyday lists), else the outline around the walk's houses (polygon_kind "block_group" | "walk"),
  null with fewer than 3 houses.
- homes = houses left to knock in the walk (houses only, minus done / do-not-knock doors).
`walks(...)` builds each zone's walk in the exact `today/walk` shape (todaywalk.pick(only=...)): houses only, best
doors by door score v2, walking order, coach lines, door score + why per house = the app docs `walks/<zone id>`.
"""
import json
import math
from datetime import date

from . import todaywalk as tw
from .config import DEFAULTS
from .geo import haversine_mi


def _zcfg(cfg):
    return {**DEFAULTS["zones"], **((cfg or {}).get("zones") or {})}


def _hull(pts):
    """Convex hull of (lon, lat) points, counter-clockwise, closed."""
    pts = sorted(set(pts))
    if len(pts) < 3:
        return None

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    ring = lower[:-1] + upper[:-1]
    if len(ring) < 3:
        return None
    return [[round(x, 5), round(y, 5)] for x, y in ring + [ring[0]]]


def simplify(ring, max_points=40):
    """Keep at most `max_points` vertices of a closed ring (even stride, the first point repeated at the end)."""
    if not ring:
        return None
    pts = ring[:-1] if ring[0] == ring[-1] else ring
    if len(pts) > max_points - 1:
        step = len(pts) / (max_points - 1)
        pts = [pts[int(i * step)] for i in range(max_points - 1)]
    pts = [[round(float(x), 5), round(float(y), 5)] for x, y in pts]
    return pts + [pts[0]] if len(pts) >= 3 else None


def bg_rings(conn, geoids, max_points=40):
    """{geoid: simplified outer ring} for block groups the database has (largest ring of each)."""
    out = {}
    if conn is None or not geoids:
        return out
    try:
        q = ",".join("?" * len(geoids))
        for g, rings in conn.execute(f"SELECT geoid, rings FROM bgs WHERE geoid IN ({q})", list(geoids)):
            rs = json.loads(rings or "[]")
            if rs:
                out[g] = simplify(max(rs, key=len), max_points)
    except Exception:                               # no bgs table / bad rows: outlines around the houses instead
        return {}
    return out


def _name(stops, L):
    from collections import Counter
    city = Counter(s.get("city") or "" for s in stops).most_common(1)[0][0] or (L.get("area") or "").split(",")[0].strip()
    streets = Counter(tw._split(s["address"])[1] for s in stops)
    top = " & ".join(k for k, _ in streets.most_common(2))
    return f"{city}: {top}" if city else top


def zones(hud, today, near=None, radius_mi=None, top=None, results=None, dnk=None, cfg=None, conn=None):
    """The `zones/current` doc (see the module doc). near = {name, lat, lon} (default: the company home)."""
    zc, tcfg = _zcfg(cfg), tw._tw(cfg)
    today = date.fromisoformat(today) if isinstance(today, str) else today
    home = (cfg or {}).get("home") or DEFAULTS["home"]
    near = near or {"name": home.get("name") or "Home", "lat": home["lat"], "lon": home["lon"]}
    radius = float(radius_mi if radius_mi is not None else zc["radius_mi"])
    top = int(top or zc["top"])
    results = results or {}
    max_age = tw.storm_max_days(today, cfg)
    old_before = ((cfg or {}).get("everyday") or {}).get("old_before", 1980)
    rows = []
    for key, kind in (("lists", "storm"), ("everyday_lists", "everyday")):
        for L in hud.get(key) or []:
            if kind == "storm":
                try:
                    age = (today - date.fromisoformat(L["day"])).days
                except (KeyError, TypeError, ValueError):
                    continue
                if not 0 <= age <= max_age:
                    continue
            cands, _ = tw._candidates(L, kind, tcfg, results, dnk, today)
            for c in cands:
                left = c["left"]
                lat = sum(s["lat"] for s in left) / len(left)
                lon = sum(s["lon"] for s in left) / len(left)
                dist = haversine_mi(near["lat"], near["lon"], lat, lon)
                if dist > radius:
                    continue
                t = c["turf"]
                hails = [s["hail"] for s in left if s.get("hail") is not None]
                rows.append({
                    "id": f"{L['id']}~t{t.get('turf')}", "name": _name(left, L),
                    "center": {"lat": round(lat, 6), "lon": round(lon, 6)},
                    "polygon": _hull([(float(s["lon"]), float(s["lat"])) for s in left]), "polygon_kind": "walk",
                    "score": round(float(c["heat"] or 0), 1),
                    "hail_in": round(sum(hails) / len(hails), 2) if hails else None,
                    "storm_day": L.get("day") if kind == "storm" else None, "homes": len(left),
                    "why": tw.why_sentence(kind, c["why"], left, L.get("day") if kind == "storm" else None,
                                           old_before, tcfg.get("old_strong_before")),
                    "walk_id": f"{L['id']}~t{t.get('turf')}", "kind": kind, "dist_mi": round(dist, 1),
                    "list_id": L["id"], "turf": t.get("turf"), "_geoid": L.get("geoid") if kind == "everyday" else None})
    rows.sort(key=lambda z: (-z["score"], z["dist_mi"], z["id"]))
    rows = rows[:top]
    rings = bg_rings(conn, {z["_geoid"] for z in rows if z["_geoid"]}, zc["polygon_max_points"])
    best = rows[0]["score"] if rows and rows[0]["score"] > 0 else None
    for z in rows:
        g = z.pop("_geoid")
        if g and rings.get(g):
            z["polygon"], z["polygon_kind"] = rings[g], "block_group"
        elif z["polygon"] is None:
            z["polygon_kind"] = None
        z["heat"] = round(z["score"] / best, 3) if best else 0.0
    doc = {"as_of": today.isoformat(), "near": near, "radius_mi": radius,
           "zones": rows + wind_zones(hud, today, near, radius, max_age, zc)}
    if not rows:
        doc["none_reason"] = {
            "en": f"No walks with doors left within {radius:g} miles of {near['name']}. New lists come with the next "
                  f"storm update.",
            "es": f"No hay rutas con puertas pendientes a menos de {radius:g} millas de {near['name']}. Llegan listas "
                  f"nuevas con la próxima actualización de tormentas."}
    return doc


def wind_zones(hud, today, near, radius, max_age, zc):
    """T116/T117: hud.json `wind_events` as zones with kind "wind" (their own map layer; no walk, no houses).
    Listed after the walk zones, best `wind_score` first, at most `zones.wind_top`, not counted in `top`.
    score = wind_score 0-100 (gust band x recency x distance); heat = score / the top wind zone's score.
    trees_down = fallen-tree / limb reports in that town that day (ask "did the storm drop a tree on your roof?")."""
    out = []
    for e in hud.get("wind_events") or []:
        try:
            age = (today - date.fromisoformat(e["day"])).days
            lat, lon = float(e["lat"]), float(e["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        score = float(e.get("wind_score") or 0)
        if not 0 <= age <= max_age or score <= 0:
            continue
        dist = haversine_mi(near["lat"], near["lon"], lat, lon)
        if dist > radius:
            continue
        mph, trees, place = e.get("max_mph"), int(e.get("trees_down") or 0), e.get("place") or "?"
        bits_en, bits_es = [], []
        if mph:
            bits_en.append(f"{mph:g} mph wind gust")
            bits_es.append(f"ráfaga de viento de {mph:g} mph")
        elif e.get("damage_reports"):
            bits_en.append("wind damage reported")
            bits_es.append("daños por viento reportados")
        if trees:
            bits_en.append(f"{trees} fallen-tree report{'s' if trees > 1 else ''}")
            bits_es.append(f"{trees} reporte{'s' if trees > 1 else ''} de árboles caídos")
        if e.get("wind_dir"):
            bits_en.append(f"wind from the {e['wind_dir']}: check that side of the roof first")
            bits_es.append(f"viento del {e['wind_dir']}: revise primero ese lado del techo")
        slug = "".join(ch if ch.isalnum() else "-" for ch in place.lower()).strip("-")
        out.append({"id": f"wind~{e['day']}~{slug}", "name": f"{place}: wind", "kind": "wind",
                    "center": {"lat": round(lat, 6), "lon": round(lon, 6)}, "polygon": None, "polygon_kind": None,
                    "score": round(score, 1), "hail_in": None, "storm_day": e["day"], "homes": None,
                    "max_mph": mph, "trees_down": trees, "wind_dir": e.get("wind_dir"),
                    "why": {"en": f"{place}, {e['day']}: " + ", ".join(bits_en) + ".",
                            "es": f"{place}, {e['day']}: " + ", ".join(bits_es) + "."},
                    "walk_id": None, "dist_mi": round(dist, 1), "list_id": None, "turf": None})
    out.sort(key=lambda z: (-z["score"], z["dist_mi"], z["id"]))
    out = out[:int(zc.get("wind_top", 8))]
    best = out[0]["score"] if out else None
    for z in out:
        z["heat"] = round(z["score"] / best, 3) if best else 0.0
    return out


def walks(hud, zdoc, today, doors=None, results=None, cfg=None, now=None, dnk=None, taps=None):
    """{"walks/<zone id>": today/walk-shaped doc} for every zone in a zones doc."""
    doors = doors or _zcfg(cfg)["doors"]
    out = {}
    for z in zdoc.get("zones") or []:
        if z.get("kind") == "wind":                  # wind zones are a map layer, not a walk
            continue
        doc = tw.pick(hud, today, doors, results, cfg, now, dnk, taps, only=(z["list_id"], z["turf"]))
        if doc:
            doc["zone_id"] = z["id"]
            out[f"walks/{z['id']}"] = doc
    return out


def resolve_near(name, cfg, conn=None):
    """{name, lat, lon} for a town name: "lat,lon" works anywhere; a town name needs the database's places table
    (the company home works without it). None when not found."""
    home = (cfg or {}).get("home") or DEFAULTS["home"]
    if not name:
        return {"name": home.get("name") or "Home", "lat": home["lat"], "lon": home["lon"]}
    parts = [p.strip() for p in str(name).split(",")]
    if len(parts) == 2:
        try:
            lat, lon = float(parts[0]), float(parts[1])
            if not (math.isnan(lat) or math.isnan(lon)):
                return {"name": f"{lat:.4f},{lon:.4f}", "lat": lat, "lon": lon}
        except ValueError:
            pass
    if str(home.get("name") or "").split(",")[0].strip().lower() == parts[0].lower():
        return {"name": parts[0], "lat": home["lat"], "lon": home["lon"]}
    if conn is not None:
        try:
            r = conn.execute("SELECT name, lat, lon FROM places WHERE lower(name)=lower(?) ORDER BY COALESCE(hu,0) DESC",
                             (parts[0],)).fetchone()
            if r:
                return {"name": r[0], "lat": r[1], "lon": r[2]}
        except Exception:
            pass
    return None
