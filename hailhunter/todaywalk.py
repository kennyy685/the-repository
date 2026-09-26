"""O0 "Today's knock": pick ONE walk for today for the HMP App's `today/walk` doc.

Reads the command center's hud.json (no database needed) and, optionally, the door results so far
(the app's `doors/<date>_<pid>` docs). Picks a fresh, strong storm walk when there is one (Hot Zones heat),
else the best everyday (old-house) walk; houses only, about 25 doors, in walking order street by street.

Output: {date, area, why{en,es}, goal_doors, kind: storm|everyday, list_id,
         stops:[{pid, address, city, lat, lon, pass}], spanish_share, who: Kenny|Alex|either}
`spanish_share` (T37) = Census share of Spanish-speaking households on today's houses (null when unknown);
`who` = who should knock: Alex (Spanish) when the share is high, Kenny when low, either in between or unknown.
`why` is one plain sentence in English and Spanish: no scores, no ids.
Added (additive): `est_minutes` (min_per_door x doors + the walk between stops at walk_mph), `walk_mi`,
`drive_from_home_mi` (straight line, company home -> first stop), `best_time {en, es, start, end}` (config
today_walk.best_time, by day of week), `stale` + `stale_note {en, es}` (hud.json generated_utc older than
stale_hours; note is null when fresh), `data_age_hours`. When no walk qualifies, `today_doc` returns
{date, stops: [], goal_doors: 0, none_reason {en, es}, best_time, stale...} instead of failing.
Evidence docs (`evidence_docs`): `evidence/<slug>` per house from hud.json hail_evidence; see SLUG_RULE.
"""
import json
import re
from collections import Counter
from datetime import date, datetime, timezone

from .config import DEFAULTS
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


def _tw(cfg):
    return {**DEFAULTS["today_walk"], **((cfg or {}).get("today_walk") or {})}


# ------------------------------------------------------------------ time, best hours, freshness
def estimate(stops, cfg=None):
    """(est_minutes, walk_mi): minutes at each door plus the straight-line walk between stops in order."""
    tw = _tw(cfg)
    walk = sum(haversine_mi(a["lat"], a["lon"], b["lat"], b["lon"]) for a, b in zip(stops, stops[1:]))
    minutes = len(stops) * tw["min_per_door"] + (walk / tw["walk_mph"] * 60 if tw["walk_mph"] else 0)
    return int(round(minutes)), round(walk, 2)


def drive_from_home(stops, cfg=None):
    """Straight-line miles from the company home to the walk's first stop (null with no stops)."""
    home = (cfg or {}).get("home") or DEFAULTS["home"]
    if not stops:
        return None
    return round(haversine_mi(home["lat"], home["lon"], stops[0]["lat"], stops[0]["lon"]), 1)


def _clock(hhmm):
    h, m = (int(x) for x in hhmm.split(":"))
    return h % 12 or 12, m, h < 12


def _span(win, lang):
    (h1, m1, am1), (h2, m2, am2) = _clock(win[0]), _clock(win[1])
    t1, t2 = f"{h1}" + (f":{m1:02d}" if m1 else ""), f"{h2}" + (f":{m2:02d}" if m2 else "")
    if lang == "en":
        return f"{t1}-{t2} {'AM' if am2 else 'PM'}" if am1 == am2 else f"{t1} AM-{t2} PM"
    ap = lambda am: "a. m." if am else "p. m."  # noqa: E731
    return f"de {t1} a {t2} {ap(am2)}" if am1 == am2 else f"de {t1} {ap(am1)} a {t2} {ap(am2)}"


def best_time(day, cfg=None):
    """Best hours to knock on `day`: {en, es, start, end} (start/end 24h local, null on a no-knock day)."""
    day = date.fromisoformat(day) if isinstance(day, str) else day
    bt = _tw(cfg).get("best_time") or {}
    wd = day.weekday()
    key = "saturday" if wd == 5 else ("sunday" if wd == 6 else "weekday")
    win = bt.get(key)
    if win:
        when_en = {"weekday": "today", "saturday": "this Saturday", "sunday": "this Sunday"}[key]
        when_es = {"weekday": "hoy", "saturday": "este sábado", "sunday": "este domingo"}[key]
        return {"en": f"Best time to knock {when_en}: {_span(win, 'en')}.",
                "es": f"Mejor hora para tocar puertas {when_es}: {_span(win, 'es')}",
                "start": win[0], "end": win[1]}
    nxt = bt.get("weekday")
    en, es = "No knocking planned today.", "Hoy no toca salir a tocar puertas."
    if nxt:
        en += f" Next: Monday {_span(nxt, 'en')}."
        es += f" Siguiente: lunes {_span(nxt, 'es')}"
    return {"en": en, "es": es, "start": None, "end": None}


def freshness(hud, now=None, cfg=None):
    """{stale, stale_note {en, es} or None, data_age_hours} from hud.json's generated_utc."""
    now = now or datetime.now(timezone.utc)
    limit = _tw(cfg)["stale_hours"]
    try:
        gen = datetime.fromisoformat(str(hud["generated_utc"]).replace("Z", "+00:00"))
        if gen.tzinfo is None:
            gen = gen.replace(tzinfo=timezone.utc)
        age = (now - gen).total_seconds() / 3600
    except (KeyError, TypeError, ValueError):
        return {"stale": True, "data_age_hours": None,
                "stale_note": {"en": "Can't tell how old the storm data is. Check that Storm Watch ran.",
                               "es": "No se sabe qué tan viejos son los datos de tormentas. Revisa que Storm Watch "
                                     "haya corrido."}}
    if age <= limit:
        return {"stale": False, "stale_note": None, "data_age_hours": round(age, 1)}
    days = age / 24
    en_age = f"{round(days)} days" if days >= 2 else f"{round(age)} hours"
    es_age = f"{round(days)} días" if days >= 2 else f"{round(age)} horas"
    return {"stale": True, "data_age_hours": round(age, 1),
            "stale_note": {"en": f"Storm data is {en_age} old: the daily update may have failed. "
                                 f"Today's walk may miss new storms.",
                           "es": f"Los datos de tormentas tienen {es_age}: puede que la actualización diaria "
                                 f"haya fallado. La ruta de hoy puede no incluir tormentas nuevas."}}


# ------------------------------------------------------------------ evidence docs for the app's db
SLUG_RULE = ('evidence/<slug>: slug = "<address> <city>" lowercased, every run of characters that are not a-z or '
             '0-9 replaced by one "-", leading/trailing "-" removed (e.g. "105 E 4th St" + "Fremont" -> '
             '"105-e-4th-st-fremont")')


def slug(address, city=""):
    return re.sub(r"[^a-z0-9]+", "-", f"{address or ''} {city or ''}".lower()).strip("-")


def evidence_docs(hud, stops):
    """{"slug_rule", "docs": {"evidence/<slug>": {address, city, pid, day, hail_in, nearest_report,
    radar_max_in}}} for the walk's houses that have hud.json hail_evidence (keyed "address|city")."""
    ev = hud.get("hail_evidence") or {}
    docs = {}
    for s in stops or []:
        e = ev.get(f"{s['address']}|{s.get('city') or ''}") or ev.get(f"{s['address']}|")
        if e:
            docs[f"evidence/{slug(s['address'], s.get('city'))}"] = {
                "address": s["address"], "city": s.get("city") or "", "pid": s.get("pid"), **e}
    return {"slug_rule": SLUG_RULE, "docs": docs}


def pick(hud, today, goal=None, results=None, cfg=None, now=None):
    """The `today/walk` doc, or None when no list has houses left to knock."""
    tw = _tw(cfg)
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
    doc = {
        "date": today.isoformat(), "area": area,
        "why": why_sentence(best["kind"], best["why"], chosen, L.get("day") if best["kind"] == "storm" else None,
                            old_before),
        "goal_doors": len(chosen), "kind": best["kind"], "list_id": L["id"],
        "stops": [{"pid": str(s["pid"]), "address": s["address"], "city": s.get("city") or city,
                   "lat": round(float(s["lat"]), 6), "lon": round(float(s["lon"]), 6),
                   "pass": results.get(str(s["pid"]), {}).get("visits", 0) + 1} for s in chosen],
        "spanish_share": spanish, "who": who_knocks(spanish, cfg),
    }
    doc["est_minutes"], doc["walk_mi"] = estimate(doc["stops"], cfg)
    doc["drive_from_home_mi"] = drive_from_home(doc["stops"], cfg)
    doc["best_time"] = best_time(today, cfg)
    doc.update(freshness(hud, now, cfg))
    return doc


def today_doc(hud, today, goal=None, results=None, cfg=None, now=None):
    """Like `pick`, but never None: with no walk to knock, a doc with empty stops and a plain `none_reason`."""
    doc = pick(hud, today, goal, results, cfg, now)
    if doc is not None:
        return doc
    today = date.fromisoformat(today) if isinstance(today, str) else today
    has_lists = any(L.get("stops") for L in (hud.get("lists") or []) + (hud.get("everyday_lists") or []))
    if has_lists:
        reason = {"en": "Every walk on the current lists is done (or has too few doors left). "
                        "New lists come with the next storm update.",
                  "es": "Ya se trabajaron todas las rutas de las listas actuales (o les quedan muy pocas puertas). "
                        "Llegan listas nuevas con la próxima actualización de tormentas."}
    else:
        reason = {"en": "No door lists yet: the storm update hasn't made any. Check that Storm Watch ran.",
                  "es": "Todavía no hay listas de puertas: la actualización de tormentas no ha hecho ninguna. "
                        "Revisa que Storm Watch haya corrido."}
    doc = {"date": today.isoformat(), "area": None, "why": None, "goal_doors": 0, "kind": None, "list_id": None,
           "stops": [], "spanish_share": None, "who": "either", "est_minutes": 0, "walk_mi": 0.0,
           "drive_from_home_mi": None, "best_time": best_time(today, cfg), "none_reason": reason}
    doc.update(freshness(hud, now, cfg))
    return doc


def load_json(path):
    with open(path) as f:
        return json.load(f)
