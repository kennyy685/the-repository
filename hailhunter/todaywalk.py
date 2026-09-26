"""O0 "Today's knock": pick ONE walk for today for the HMP App's `today/walk` doc.

Reads the command center's hud.json (no database needed) and, optionally, the door results so far
(the app's `doors/<date>_<pid>` docs). Picks a fresh, strong storm walk when there is one (Hot Zones heat),
else the best everyday (old-house) walk; houses only, about 25 doors, in walking order street by street.

Output: {date, area, why{en,es}, goal_doors, kind: storm|everyday, list_id,
         stops:[{pid, address, city, lat, lon, pass}], spanish_share, who: Kenny|Alex|either}
`spanish_share` (T37) = Census share of Spanish-speaking households on today's houses (null when unknown);
`who` = who should knock: Alex (Spanish) when the share is high, Kenny when low, either in between or unknown.
`why` is one plain sentence in English and Spanish: no scores, no ids.
"""
import json
import re
from collections import Counter
from datetime import date

from .geo import haversine_mi

NOT_HOME = {"not_home", "nothome", "not home", "not-home", "no_home", "no esta", "no está"}
MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
             "November", "December"]
MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
             "noviembre", "diciembre"]


# ------------------------------------------------------------------ door results so far
def load_results(obj):
    """Door results -> {pid: {"visits": n, "done": bool}}. Accepts the app's docs as a dict
    {"doors/2026-09-25_<pid>": {result, at, pass}} (or keys without "doors/"), or a list of docs, each with
    `pid` or an id/doc_id "<date>_<pid>", and the fields either inline or under `data`."""
    if obj is None:
        return {}
    items = obj.items() if isinstance(obj, dict) else [(d.get("id") or d.get("doc_id") or "", d) for d in obj]
    tries = {}
    for key, doc in items:
        if not isinstance(doc, dict):
            continue
        data = doc.get("data") if isinstance(doc.get("data"), dict) else doc
        pid = data.get("pid") or doc.get("pid")
        if not pid:
            k = str(key).split("/")[-1]
            m = re.match(r"^\d{4}-\d{2}-\d{2}_(.+)$", k)
            pid = m.group(1) if m else None
        if not pid:
            continue
        r = str(data.get("result") or "").strip().lower()
        t = tries.setdefault(str(pid), {"visits": 0, "max_pass": 0, "done": False})
        t["visits"] += 1
        try:
            t["max_pass"] = max(t["max_pass"], int(data.get("pass") or 0))
        except (TypeError, ValueError):
            pass
        if r and r not in NOT_HOME:
            t["done"] = True                       # No / Interested / Booked: talked to them, don't knock again
    return {p: {"visits": max(t["visits"], t["max_pass"]), "done": t["done"]} for p, t in tries.items()}


# ------------------------------------------------------------------ walking order
def _split(address):
    m = re.match(r"^\s*(\d+)\S*\s+(.+?)\s*$", address or "")
    if m:
        return int(m.group(1)), m.group(2)
    return None, (address or "").strip()


def walking_order(stops):
    """Street by street: each street sorted by house number (odd and even sides alternate naturally), walked from
    the end nearest to where you are; the next street is the nearest one. Starts at the first stop given."""
    if not stops:
        return []
    streets, first = {}, None
    for s in stops:
        n, st = _split(s["address"])
        key = re.sub(r"\s+", " ", st.upper())
        streets.setdefault(key, []).append((n, s))
        first = first or key
    for key in streets:                            # no number: keep them at the end of their street
        streets[key].sort(key=lambda x: (x[0] is None, x[0] or 0))
    order = [s for _, s in streets.pop(first)]
    s0 = stops[0]
    if len(order) > 1 and haversine_mi(s0["lat"], s0["lon"], order[-1]["lat"], order[-1]["lon"]) < \
            haversine_mi(s0["lat"], s0["lon"], order[0]["lat"], order[0]["lon"]):
        order.reverse()                            # start from the end of the street nearest the walk's start
    while streets:
        here = order[-1]
        best = None
        for key, rows in streets.items():
            for end, s in ((0, rows[0][1]), (1, rows[-1][1])):
                d = haversine_mi(here["lat"], here["lon"], s["lat"], s["lon"])
                if best is None or d < best[0]:
                    best = (d, key, end)
        rows = [s for _, s in streets.pop(best[1])]
        order += rows[::-1] if best[2] else rows
    return order


# ------------------------------------------------------------------ the plain-words reason
def _pct(why, pattern):
    for w in why or []:
        m = re.search(pattern, w)
        if m:
            return m
    return None


def _owners(why):
    """Owner-lived from the engine's reasons: 'mostly owner-occupied', '62% owner-occupied', '72% owners'."""
    if any("mostly owner" in w for w in why or []):
        return True
    m = _pct(why, r"(\d+)% owner")
    return bool(m and int(m.group(1)) >= 50)


def _join(parts, word):
    if len(parts) <= 1:
        return "".join(parts)
    return ", ".join(parts[:-1]) + f" {word} " + parts[-1]


def why_sentence(kind, why, stops, day=None, old_before=1980):
    """One plain sentence {en, es} from the list's reasons and today's houses. No scores, no ids."""
    owners = _owners(why)
    if kind == "storm":
        hails = [s["hail"] for s in stops if s.get("hail") is not None]
        h = round(sum(hails) / len(hails), 1) if hails else None
        m = _pct(why, r'([\d.]+)" hail')
        h = h if h is not None else (float(m.group(1)) if m else None)
        d = date.fromisoformat(day) if day else None
        en = (f"{h:g}-inch hail" if h else "Hail") + " hit here" + (f" on {MONTHS_EN[d.month - 1]} {d.day}" if d else "")
        es = "Aquí cayó granizo" + (f" de {h:g} pulgadas" if h else "") + \
             (f" el {d.day} de {MONTHS_ES[d.month - 1]}" if d else "")
        en_more, es_more = [], []
        if _pct(why, r"roofs ~(\d{4})"):
            en_more.append("the roofs are older")
            es_more.append("los techos ya tienen años")
        if owners:
            en_more.append("most homes are owner-lived")
            es_more.append("en la mayoría de las casas viven sus dueños")
        if any("other roofers" in w for w in why or []):
            en_more.append("other roofers may already be knocking")
            es_more.append("puede que otros techadores ya estén tocando puertas")
        return {"en": _join([en] + en_more, "and") + ".", "es": _join([es] + es_more, "y") + "."}
    years = [int(s["built"]) for s in stops if s.get("built")]
    share = None
    if years and len(years) >= 0.5 * len(stops):
        share = sum(y < old_before for y in years) / len(years)
    else:
        m = _pct(why, r"(\d+)% of homes built before")
        share = int(m.group(1)) / 100 if m else None
    med = _pct(why, r"median home built (\d{4})")
    if share is not None and share >= 0.5:
        en, es = f"Most homes here were built before {old_before}", \
            f"La mayoría de las casas aquí se construyeron antes de {old_before}"
    elif share is not None and share >= 0.25:
        en, es = f"Many homes here were built before {old_before}", \
            f"Muchas casas aquí se construyeron antes de {old_before}"
    elif med:
        en, es = f"Most homes here were built around {med.group(1)}", \
            f"La mayoría de las casas aquí se construyeron alrededor de {med.group(1)}"
    else:
        en, es = "An established neighborhood near home", "Un barrio establecido cerca de casa"
        return {"en": en + (", and most homes are owner-lived." if owners else "."),
                "es": es + (", y en la mayoría de las casas viven sus dueños." if owners else ".")}
    return {"en": en + (" and are owner-lived." if owners else "."), "es": es + (" y viven sus dueños." if owners else ".")}


# ------------------------------------------------------------------ who knocks (T37)
def spanish_for(chosen, L, turf_share):
    """House-weighted Spanish-speaking share of today's stops from their walks' shares (list's share as fallback)."""
    by_turf = {t.get("turf"): t.get("spanish_share") for t in L.get("turfs") or []}
    v = [by_turf.get(s.get("turf"), turf_share) for s in chosen]
    v = [x if x is not None else L.get("spanish_share") for x in v]
    v = [float(x) for x in v if x is not None]
    return round(sum(v) / len(v), 3) if v else None


def who_knocks(share, cfg=None):
    lang = {"spanish_high": 0.30, "spanish_low": 0.10, **((cfg or {}).get("language") or {})}
    if share is None:
        return "either"
    return "Alex" if share >= lang["spanish_high"] else ("Kenny" if share < lang["spanish_low"] else "either")


# ------------------------------------------------------------------ the pick
def _houses(stops, kinds):
    return [s for s in stops if s.get("kind") in kinds and s.get("lat") is not None and s.get("lon") is not None
            and s.get("pid") and s.get("address")]


def _candidates(L, kind, tw, results):
    """One entry per walk (turf) of a list that still has doors to knock."""
    kinds = set(tw["house_kinds"])
    by_turf = {}
    for s in _houses(L.get("stops") or [], kinds):
        r = results.get(str(s["pid"]))
        if r and (r["done"] or r["visits"] >= tw["max_passes"]):
            continue
        by_turf.setdefault(s["turf"], []).append(s)
    out = []
    for t in L.get("turfs") or []:
        left = sorted(by_turf.get(t["turf"], []), key=lambda s: s.get("stop") or 0)
        if len(left) < tw["min_doors"]:
            continue                               # fully worked (or too few doors left)
        heat = t.get("heat") if t.get("heat") is not None else L.get("heat")
        hails = [s["hail"] for s in left if s.get("hail") is not None]
        out.append({"list": L, "kind": kind, "turf": t, "left": left, "heat": heat or 0,
                    "why": t.get("why") or L.get("why") or [],
                    "avg_hail": sum(hails) / len(hails) if hails else t.get("avg_hail")})
    return out, by_turf


def pick(hud, today, goal=None, results=None, cfg=None):
    """The `today/walk` doc, or None when no list has houses left to knock."""
    tw = {"goal_doors": 25, "storm_max_days": 60, "storm_min_heat": 15, "storm_min_hail": 1.0, "min_doors": 8,
          "max_passes": 3, "house_kinds": ["single", "mobile", "farm"], **((cfg or {}).get("today_walk") or {})}
    goal = goal or tw["goal_doors"]
    results = results or {}
    today = date.fromisoformat(today) if isinstance(today, str) else today
    storm, pools = [], {}
    for L in hud.get("lists") or []:
        try:
            age = (today - date.fromisoformat(L["day"])).days
        except (KeyError, TypeError, ValueError):
            continue
        c, pools[L["id"]] = _candidates(L, "storm", tw, results)
        if 0 <= age <= tw["storm_max_days"]:
            storm += [x for x in c if x["heat"] >= tw["storm_min_heat"]
                      and (x["avg_hail"] or 0) >= tw["storm_min_hail"]]
    every = []
    for L in hud.get("everyday_lists") or []:
        c, pools[L["id"]] = _candidates(L, "everyday", tw, results)
        every += c
    cands = storm or every
    if not cands:
        return None
    best = max(cands, key=lambda x: x["heat"])
    L = best["list"]
    # Doors not tried yet first (in the walk's own order), then not-home doors coming back for another pass.
    left = best["left"]
    chosen = [s for s in left if str(s["pid"]) not in results] + [s for s in left if str(s["pid"]) in results]
    if len(chosen) < goal:                         # short walk: top up from the list's nearest other walks
        lat0 = sum(s["lat"] for s in left) / len(left)
        lon0 = sum(s["lon"] for s in left) / len(left)
        others = [s for t, ss in pools[L["id"]].items() if t != best["turf"]["turf"] for s in ss]
        others.sort(key=lambda s: haversine_mi(lat0, lon0, s["lat"], s["lon"]))
        chosen += others
    chosen = walking_order(chosen[:goal])
    city = Counter(s.get("city") or "" for s in chosen).most_common(1)[0][0] or \
        (L.get("area") or "").split(",")[0].strip()
    streets = Counter(_split(s["address"])[1] for s in chosen)
    area = f"{city}: " + " & ".join(k for k, _ in streets.most_common(2)) if city else \
        " & ".join(k for k, _ in streets.most_common(2))
    old_before = ((cfg or {}).get("everyday") or {}).get("old_before", 1980)
    spanish = spanish_for(chosen, L, best["turf"].get("spanish_share"))
    return {
        "date": today.isoformat(), "area": area,
        "why": why_sentence(best["kind"], best["why"], chosen, L.get("day") if best["kind"] == "storm" else None,
                            old_before),
        "goal_doors": len(chosen), "kind": best["kind"], "list_id": L["id"],
        "stops": [{"pid": str(s["pid"]), "address": s["address"], "city": s.get("city") or city,
                   "lat": round(float(s["lat"]), 6), "lon": round(float(s["lon"]), 6),
                   "pass": results.get(str(s["pid"]), {}).get("visits", 0) + 1} for s in chosen],
        "spanish_share": spanish, "who": who_knocks(spanish, cfg),
    }


def load_json(path):
    with open(path) as f:
        return json.load(f)
