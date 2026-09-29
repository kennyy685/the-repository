"""Night shift (`hh.py night`): while FilthE sleeps, Aldaba prepares his morning. One small JSON brief that the 7 AM
map shows as "Since last night": new hail by town and size, zones that moved up or down, walks that changed, and
Aldaba's pick + today's plan (zone, where to start the walk, door count, one line why, a backup zone).

Pure functions over hud.json + the `zones/current` doc + its `walks/<zone id>` docs (the same ones `hh.py zones`
makes), plus the previous brief. No database, no network: `hh.py night` runs `refresh` first, then calls `brief()`.

Brief (v1), every sentence EN + ES, never an owner name, never an insurance promise:
{v: 1, kind: "night_brief", date (the morning it is for), made_at (UTC ISO), since (the previous brief's made_at or
 null), first_run (no previous brief), quiet (no new hail since the previous brief), headline {en, es},
 new_hail: [{town, state, day, hail_in, dist_mi, zone_id}]  one row per town + day (its biggest report), biggest
   first, at most `night.max_new` (8); zone_id = the walk zone for that storm day in that town, else null,
 zones_up / zones_down: [{id, name, rank, was, score}]  zones still in the top whose rank changed, biggest move first,
   at most `night.max_moves` (5) each,
 zones_new: [{id, name, rank, score}], zones_gone: [{id, name, was}]  (same cap),
 walks_changed: [{id, name, homes, was}]  zones in both briefs whose houses-left count changed (doors knocked,
   do-not-knock, or a rebuilt list),
 pick: {zone_id, name, kind, score, hail_in, storm_day, dist_mi, doors, start {address, lat, lon} | null,
   best_time {en, es} | null, why {en, es}, plan {en, es}} | null,
 backup: same shape as pick | null  (the next zone from a different list, else the next zone),
 none_reason {en, es} (only when there is no pick),
 zones: [{id, name, rank, score, homes}]  the ranked walk zones (for the next night's diff),
 storm_keys: ["day|place|state", ...]  the hud.json storms already seen (for the next night's diff)}
"""
from datetime import datetime, timezone

from .config import DEFAULTS

NIGHT_DEFAULTS = {"min_hail": 0.75, "max_mi": 150, "max_new": 8, "max_moves": 5}


def _ncfg(cfg):
    return {**NIGHT_DEFAULTS, **(DEFAULTS.get("night") or {}), **((cfg or {}).get("night") or {})}


def _key(s):
    return f"{s.get('day')}|{s.get('place')}|{s.get('state')}"


def _inch(v):
    return f"{v:g}″"


def _storms(hud, nc):
    """hud.json storms that count for the brief: within max_mi, hail >= min_hail."""
    out = []
    for s in hud.get("storms") or []:
        try:
            hail, dist = float(s.get("hail") or 0), float(s.get("dist_mi") or 0)
        except (TypeError, ValueError):
            continue
        if hail >= nc["min_hail"] and dist <= nc["max_mi"] and s.get("day"):
            out.append(s)
    return out


def _town(z):
    return (z.get("name") or "").split(":")[0].strip().lower()


def new_hail(hud, prev, zdoc, nc):
    """Storms not in the previous brief's storm_keys, one row per town + day (its biggest report)."""
    if prev is None:
        return []
    seen = set(prev.get("storm_keys") or [])
    best = {}
    for s in _storms(hud, nc):
        if _key(s) in seen:
            continue
        k = (s["day"], s.get("place"), s.get("state"))
        if k not in best or float(s["hail"]) > float(best[k]["hail"]):
            best[k] = s
    walk = [z for z in zdoc.get("zones") or [] if z.get("kind") == "storm"]
    rows = []
    for (day, place, state), s in best.items():
        zid = next((z["id"] for z in walk if z.get("storm_day") == day and _town(z) == str(place or "").lower()), None)
        rows.append({"town": place, "state": state, "day": day, "hail_in": round(float(s["hail"]), 2),
                     "dist_mi": round(float(s.get("dist_mi") or 0), 1), "zone_id": zid})
    rows.sort(key=lambda r: (-r["hail_in"], r["dist_mi"], r["day"], str(r["town"])))
    return rows[:nc["max_new"]]


def ranked(zdoc):
    """The walk zones (no wind layer) as [{id, name, rank, score, homes}], best first (zones() already sorted them)."""
    walk = [z for z in zdoc.get("zones") or [] if z.get("kind") != "wind"]
    return [{"id": z["id"], "name": z.get("name"), "rank": i, "score": z.get("score"), "homes": z.get("homes")}
            for i, z in enumerate(walk, 1)]


def moves(now, prev, nc):
    """{zones_up, zones_down, zones_new, zones_gone, walks_changed} vs the previous brief's zones."""
    out = {"zones_up": [], "zones_down": [], "zones_new": [], "zones_gone": [], "walks_changed": []}
    if prev is None:
        return out
    was = {z["id"]: z for z in prev.get("zones") or [] if z.get("id")}
    cur = {z["id"] for z in now}
    for z in now:
        p = was.get(z["id"])
        if p is None:
            out["zones_new"].append({"id": z["id"], "name": z["name"], "rank": z["rank"], "score": z["score"]})
            continue
        row = {"id": z["id"], "name": z["name"], "rank": z["rank"], "was": p.get("rank"), "score": z["score"]}
        if p.get("rank") and z["rank"] < p["rank"]:
            out["zones_up"].append(row)
        elif p.get("rank") and z["rank"] > p["rank"]:
            out["zones_down"].append(row)
        if p.get("homes") is not None and z["homes"] is not None and p["homes"] != z["homes"]:
            out["walks_changed"].append({"id": z["id"], "name": z["name"], "homes": z["homes"], "was": p["homes"]})
    out["zones_gone"] = [{"id": p["id"], "name": p.get("name"), "was": p.get("rank")}
                         for p in prev.get("zones") or [] if p.get("id") and p["id"] not in cur]
    out["zones_up"].sort(key=lambda r: (r["rank"] - r["was"], r["rank"]))
    out["zones_down"].sort(key=lambda r: (r["was"] - r["rank"], r["rank"]))
    out["walks_changed"].sort(key=lambda r: (-abs(r["homes"] - r["was"]), r["id"]))
    return {k: v[:nc["max_moves"]] for k, v in out.items()}


def _plan_card(z, walk):
    """pick/backup shape for one zone + its walks/<id> doc."""
    stops = (walk or {}).get("stops") or []
    s0 = stops[0] if stops else None
    start = {"address": s0.get("address"), "lat": s0.get("lat"), "lon": s0.get("lon")} if s0 else None
    doors = len(stops) if stops else (z.get("walk_homes") or z.get("homes") or 0)
    name = z.get("name") or z["id"]
    if start and start["address"]:
        plan = {"en": f"Drive to {name}, start at {start['address']}, {doors} doors.",
                "es": f"Maneja a {name}, empieza en {start['address']}, {doors} puertas."}
    else:
        plan = {"en": f"Drive to {name}, {doors} doors.", "es": f"Maneja a {name}, {doors} puertas."}
    return {"zone_id": z["id"], "name": name, "kind": z.get("kind"), "score": z.get("score"),
            "hail_in": z.get("hail_in"), "storm_day": z.get("storm_day"), "dist_mi": z.get("dist_mi"),
            "doors": doors, "start": start, "best_time": (walk or {}).get("best_time"),
            "why": z.get("why") or {"en": "", "es": ""}, "plan": plan}


def choose(zdoc, walks):
    """(pick, backup): the top walk zone, and the next one from a different list (another storm or area), else the
    next zone. Zones whose walk has no doors left are skipped."""
    walk = [z for z in zdoc.get("zones") or [] if z.get("kind") != "wind"]
    docs = walks or {}
    ok = [z for z in walk if (docs.get(f"walks/{z['id']}") or {}).get("stops") or (not docs and z.get("homes"))]
    if not ok:
        return None, None
    top = ok[0]
    other = next((z for z in ok[1:] if z.get("list_id") != top.get("list_id")), None) or (ok[1] if len(ok) > 1 else None)
    card = lambda z: _plan_card(z, docs.get(f"walks/{z['id']}"))   # noqa: E731
    return card(top), (card(other) if other else None)


def _hail_list(rows, lang):
    parts = []
    for r in rows[:3]:
        parts.append(f"{_inch(r['hail_in'])} in {r['town']}" if lang == "en" else f"{_inch(r['hail_in'])} en {r['town']}")
    more = len(rows) - 3
    if more > 0:
        parts.append(f"{more} more" if lang == "en" else f"{more} más")
    return ", ".join(parts)


def headline(first_run, hail, pick, prev_pick_id, prev_pick_name):
    """One plain sentence (EN/ES) for the top of the 7 AM home."""
    if pick is None:
        if first_run:
            return {"en": "First night brief: no walks with doors left nearby yet.",
                    "es": "Primer resumen de la noche: todavía no hay rutas con puertas pendientes cerca."}
        if hail:
            return {"en": f"New hail since last night: {_hail_list(hail, 'en')}. No walk ready there yet.",
                    "es": f"Granizo nuevo desde anoche: {_hail_list(hail, 'es')}. Todavía no hay ruta lista ahí."}
        return {"en": "No new hail since last night, and no walks with doors left nearby.",
                "es": "Sin granizo nuevo desde anoche, y no hay rutas con puertas pendientes cerca."}
    n = pick["name"]
    if first_run:
        return {"en": f"First night brief. Best zone: {n}.", "es": f"Primer resumen de la noche. Mejor zona: {n}."}
    same = prev_pick_id == pick["zone_id"]
    if same:
        best_en, best_es = f"best zone is still {n}", f"la mejor zona sigue siendo {n}"
    elif prev_pick_name:
        best_en, best_es = f"best zone is now {n} (was {prev_pick_name})", f"la mejor zona ahora es {n} (antes {prev_pick_name})"
    else:
        best_en, best_es = f"best zone is {n}", f"la mejor zona es {n}"
    if hail:
        return {"en": f"New hail since last night: {_hail_list(hail, 'en')}. The {best_en}.",
                "es": f"Granizo nuevo desde anoche: {_hail_list(hail, 'es')}. {best_es[0].upper() + best_es[1:]}."}
    return {"en": f"No new hail since last night; {best_en}.", "es": f"Sin granizo nuevo desde anoche; {best_es}."}


def brief(hud, zdoc, walks, today, prev=None, cfg=None, now=None):
    """The night brief (module doc). hud = hud.json, zdoc/walks = zones.zones()/zones.walks() output, prev = the
    previous brief or None (first run)."""
    nc = _ncfg(cfg)
    now = now or datetime.now(timezone.utc)
    if prev is not None and prev.get("kind") != "night_brief":
        prev = None                                   # a broken/foreign file counts as no previous brief
    first = prev is None
    hail = new_hail(hud, prev, zdoc, nc)
    zs = ranked(zdoc)
    mv = moves(zs, prev, nc)
    pick, backup = choose(zdoc, walks)
    pp = (prev or {}).get("pick") or {}
    doc = {"v": 1, "kind": "night_brief", "date": str(today), "made_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
           "since": (prev or {}).get("made_at"), "first_run": first, "quiet": not first and not hail,
           "headline": headline(first, hail, pick, pp.get("zone_id"), pp.get("name")),
           "new_hail": hail, **mv, "pick": pick, "backup": backup, "zones": zs,
           "storm_keys": sorted({_key(s) for s in _storms(hud, nc)})}
    if pick is None:
        doc["none_reason"] = (zdoc.get("none_reason") or
                              {"en": "No walks with doors left nearby. New lists come with the next storm update.",
                               "es": "No hay rutas con puertas pendientes cerca. Llegan listas nuevas con la próxima "
                                     "actualización de tormentas."})
    return doc
