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
Do-not-knock (`load_dnk`, `pick(dnk=...)`): houses in the app's `dnk/<slug>` docs (same slug rule) never appear.
Seasons (config today_walk): `storm_max_days_by_month` lets Oct-Mar walks re-knock storms up to ~330 days old that
aren't fully worked (else 60 days); `best_time_by_month` shortens weekday hours in short-day months (+ "End by dusk").
Winter goal: `goal_factor_by_month` (Dec-Feb 0.65) shrinks the door goal (never below `goal_min_doors`, 10); every
walk carries `goal_note {en, es}` ("25 doors is a starting session, not a full day"; winter: a smaller goal is normal).
Come back at (`come_back` on a not-home result, ISO or {date, time}): due today -> the stop gets
`come_back {date, time}` and goes to the front (earliest time first); due later -> the door waits until that date.
House facts (additive, per stop, each left out when the county data doesn't have it; see `house_facts`):
`year_built`, `sqft` (assessor living sq ft), `stories` (only if hud.json ever carries it), `rough {low, high,
kind: "siding", rough: true, material, stories, using_reference}` = estimate.estimate() for a vinyl siding job from
footprint = sqft / stories (stories unknown: low = 1-story, high = 2-story), and `house_line {en, es}`
("Built 1962 · ~1,400 sq ft · vinyl siding about $10,200-$21,850"). With any rough price the doc gets
`rough_note {en, es}` (estimate range, not final). Storm walk under evidence_fade_days old: `evidence_note {en, es}`.
"""
import json
import re
from collections import Counter
from datetime import date, datetime, timezone

from . import estimate as est
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
    tries, cb = {}, {}
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
        elif r:                                    # not home: the latest visit's come_back (or none) wins
            k = str(key).split("/")[-1]
            order = (_int(data.get("pass")), str(data.get("at") or ""), k[:10] if re.match(r"^\d{4}-", k) else "")
            if pid not in cb or order >= cb[pid][0]:
                cb[pid] = (order, parse_come_back(data.get("come_back")))
    out = {p: {"visits": max(t["visits"], t["max_pass"]), "done": t["done"]} for p, t in tries.items()}
    for p, (_, when) in cb.items():
        if when and not out[str(p)]["done"]:
            out[str(p)]["come_back"] = when
    return out


def _int(v):
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        return 0


def parse_come_back(v, tz=None):
    """"2026-09-26T17:30", "2026-09-26T22:30:00Z" (converted to Central), "2026-09-26" or {date, time}
    -> {"date": "YYYY-MM-DD", "time": "HH:MM" or None}; anything else -> None."""
    try:
        if isinstance(v, dict):
            d = date.fromisoformat(str(v.get("date") or "")[:10]).isoformat()
            t = v.get("time")
            if t:
                m = re.match(r"^\s*(\d{1,2}):(\d{2})", str(t))
                t = f"{int(m.group(1)):02d}:{m.group(2)}" if m and int(m.group(1)) < 24 else None
            return {"date": d, "time": t or None}
        v = str(v or "").strip()
        if re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            return {"date": date.fromisoformat(v).isoformat(), "time": None}
        dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
        if dt.tzinfo is not None:
            from zoneinfo import ZoneInfo
            dt = dt.astimezone(ZoneInfo(tz or DEFAULTS["timezone"]))
        return {"date": dt.date().isoformat(), "time": dt.strftime("%H:%M")}
    except (TypeError, ValueError, AttributeError, KeyError):
        return None


def load_dnk(obj):
    """Do-not-knock docs -> set of slugs (SLUG_RULE). Accepts {"dnk/<slug>": {address, city}} or a list of docs,
    each with `slug`, or `address` (+ `city`), inline or under `data`; the key/id "dnk/<slug>" also counts."""
    if not obj:
        return set()
    items = obj.items() if isinstance(obj, dict) else \
        [((d.get("id") or d.get("doc_id") or "") if isinstance(d, dict) else d, d) for d in obj]
    out = set()
    for key, doc in items:
        doc = doc if isinstance(doc, dict) else {}
        data = doc.get("data") if isinstance(doc.get("data"), dict) else doc
        for v in (data.get("slug"), doc.get("slug")):
            if v:
                out.add(slug(v))
        if data.get("address"):
            out.add(slug(data["address"], data.get("city")))
        out.add(slug(str(key or "").split("/")[-1]))   # the doc id itself is the slug
    out.discard("")
    return out


def is_dnk(stop, dnk, city=""):
    """True when the house's slug (its own city, else the list's town) or its address alone is on the list."""
    if not dnk:
        return False
    a = stop.get("address")
    return slug(a, stop.get("city") or city) in dnk or slug(a) in dnk


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


def why_sentence(kind, why, stops, day=None, old_before=1980, strong_before=None):
    """One plain sentence {en, es} from the list's reasons and today's houses. No scores, no ids.
    Everyday: with year built known for most of today's houses and most of them built before `strong_before`
    (config today_walk.old_strong_before, 1970), it says so ("built before 1970") instead of `old_before`."""
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
        strong = sum(y < strong_before for y in years) / len(years) if strong_before else 0
        if strong >= 0.5:                              # "Most homes here were built before 1970": true per house
            old_before, share = strong_before, strong
        else:
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


def _due(r, today):
    """A not-home door's come_back date vs today: None (none/past), "today" or "later"."""
    cb = (r or {}).get("come_back")
    if not cb or not today:
        return None
    d = date.fromisoformat(cb["date"])
    return "today" if d == today else ("later" if d > today else None)


def _candidates(L, kind, tw, results, dnk=None, today=None):
    """One entry per walk (turf) of a list that still has doors to knock."""
    kinds = set(tw["house_kinds"])
    town = (L.get("area") or "").split(",")[0].strip()
    by_turf = {}
    for s in _houses(L.get("stops") or [], kinds):
        if is_dnk(s, dnk, town):
            continue                               # do-not-knock: never in a walk
        r = results.get(str(s["pid"]))
        due = _due(r, today)
        if due == "later":
            continue                               # they said come back on a later day
        if r and (r["done"] or (r["visits"] >= tw["max_passes"] and due != "today")):
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


def _by_month(table, day):
    """The entry for `day`'s month in a {"1".."12": value} config table (int keys work too), else None."""
    table = table or {}
    return table.get(str(day.month), table.get(day.month))


def storm_max_days(day, cfg=None):
    """How old a storm can be for a storm walk on `day`: config storm_max_days_by_month for the month
    (off-season Oct-Mar: ~330 days, re-knock storms not fully worked yet), else storm_max_days (60)."""
    tw = _tw(cfg)
    v = _by_month(tw.get("storm_max_days_by_month"), day)
    return tw["storm_max_days"] if v is None else v


def goal_for(day, goal=None, cfg=None):
    """Door goal for `day`: `goal` (else config goal_doors) x goal_factor_by_month (Dec-Feb 0.65, else 1.0),
    rounded, never below goal_min_doors (10) unless the asked goal is already smaller."""
    day = date.fromisoformat(day) if isinstance(day, str) else day
    tw = _tw(cfg)
    base = int(goal or tw["goal_doors"])
    f = _by_month(tw.get("goal_factor_by_month"), day)
    f = 1.0 if f is None else float(f)
    return min(base, max(int(tw.get("goal_min_doors") or 10), int(round(base * f))))


def goal_note(day, n, cfg=None):
    """Plain goal note {en, es}: the goal is a starting session, and a smaller winter goal is normal."""
    day = date.fromisoformat(day) if isinstance(day, str) else day
    f = _by_month(_tw(cfg).get("goal_factor_by_month"), day)
    if f is not None and float(f) < 1.0:
        return {"en": f"Short cold day: a smaller goal is normal. {n} doors is a starting session, not a full day.",
                "es": f"Día corto y frío: una meta más pequeña es normal. {n} puertas son una sesión para empezar, "
                      f"no un día completo."}
    return {"en": f"{n} doors is a starting session, not a full day.",
            "es": f"{n} puertas son una sesión para empezar, no un día completo."}


def best_time(day, cfg=None):
    """Best hours to knock on `day`: {en, es, start, end} (start/end 24h local, null on a no-knock day).
    best_time_by_month overrides the day types it names for that month (short days) and may add a note."""
    day = date.fromisoformat(day) if isinstance(day, str) else day
    tw = _tw(cfg)
    month = _by_month(tw.get("best_time_by_month"), day) or {}
    bt = {**(tw.get("best_time") or {}), **{k: v for k, v in month.items() if k != "note"}}
    note = month.get("note") or {}
    wd = day.weekday()
    key = "saturday" if wd == 5 else ("sunday" if wd == 6 else "weekday")
    win = bt.get(key)
    if win:
        when_en = {"weekday": "today", "saturday": "this Saturday", "sunday": "this Sunday"}[key]
        when_es = {"weekday": "hoy", "saturday": "este sábado", "sunday": "este domingo"}[key]
        return {"en": f"Best time to knock {when_en}: {_span(win, 'en')}." + (f" {note['en']}" if note.get("en") else ""),
                "es": f"Mejor hora para tocar puertas {when_es}: {_span(win, 'es')}" +
                      (f" {note['es']}" if note.get("es") else ""),
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


# ------------------------------------------------------------------ what you're walking up to (per house)
def _hf(cfg):
    return {**DEFAULTS["today_walk"]["house_facts"], **(_tw(cfg).get("house_facts") or {})}


def _year(v, today=None):
    try:
        y = int(v)
    except (TypeError, ValueError):
        return None
    top = (today or date.today()).year + 1
    return y if 1800 <= y <= top else None     # 0 / placeholder years are "unknown", never shown


def _stories_of(v):
    try:
        n = int(v)
    except (TypeError, ValueError):
        return None
    return n if 1 <= n <= 3 else None


def rough_siding(sqft, stories=None, cfg=None):
    """ROUGH vinyl siding price for a house from its living sq ft: estimate.estimate() with footprint = sqft /
    stories. Stories unknown: one estimate per story count in house_facts.stories_if_unknown (low = the lowest,
    high = the highest). -> {low, high, kind: "siding", rough: true, material, stories, using_reference} or None."""
    hf = _hf(cfg)
    counts = [stories] if stories else [int(n) for n in hf["stories_if_unknown"]]
    # a partial cfg keeps its own prices; missing sections come from the defaults (QA 2026-09-26)
    ecfg = cfg if cfg and cfg.get("estimate") else ({**est.DEFAULTS, **cfg} if cfg else None)
    runs = []
    for n in counts:
        try:
            runs.append(est.estimate({"type": "siding", "footprint_sqft": sqft / n, "stories": n,
                                      "material": hf["material"]}, ecfg))
        except ValueError:
            return None
    if not runs:
        return None
    return {"low": min(r["low"] for r in runs), "high": max(r["high"] for r in runs), "kind": "siding",
            "rough": True, "material": runs[0]["quantities"]["material"],
            "stories": counts[0] if len(counts) == 1 else counts,
            "using_reference": any(r["using_reference"] for r in runs)}


def _money(x):
    return f"${x:,.0f}"


def house_facts(s, cfg=None, today=None):
    """Extra stop fields from the county data on a hud.json stop (`built`, `sqft`, optional `stories`):
    year_built, sqft, stories, rough, house_line {en, es}. Anything missing (or implausible) is left out."""
    hf = _hf(cfg)
    out = {}
    y = _year(s.get("built", s.get("year_built")), today)
    if y:
        out["year_built"] = y
    try:
        sq = float(s.get("sqft") or 0)
    except (TypeError, ValueError):
        sq = 0
    if hf["min_sqft"] <= sq <= hf["max_sqft"]:
        out["sqft"] = int(round(sq))
    n = _stories_of(s.get("stories"))
    if n:
        out["stories"] = n
    if "sqft" in out:
        r = rough_siding(out["sqft"], n, cfg)
        if r:
            out["rough"] = r
    if out:
        en, es = [], []
        if "year_built" in out:
            en.append(f"Built {y}")
            es.append(f"Construida en {y}")
        if "sqft" in out:
            en.append(f"~{out['sqft']:,} sq ft")
            es.append(f"~{out['sqft']:,} pies²")
        if n:
            en.append(f"{n} stor{'y' if n == 1 else 'ies'}")
            es.append(f"{n} piso{'' if n == 1 else 's'}")
        if "rough" in out:
            r = out["rough"]
            mat_en = "vinyl siding" if r["material"] == "vinyl" else "Hardie siding"
            mat_es = "siding de vinil" if r["material"] == "vinyl" else "siding Hardie"
            en.append(f"{mat_en} about {_money(r['low'])}-{_money(r['high'])}")
            es.append(f"{mat_es} aprox. {_money(r['low'])}-{_money(r['high'])}")
        out["house_line"] = {"en": " · ".join(en), "es": " · ".join(es)}
    return out


def rough_note(stops, kind, cfg=None):
    """One walk-level line for the rough prices ({en, es}), or None when no stop has one."""
    rs = [s["rough"] for s in stops if s.get("rough")]
    if not rs:
        return None
    en, es = [], []
    if any(r["using_reference"] for r in rs):
        en.append("market prices, not HMP's yet")
        es.append("precios del mercado, todavía no los de HMP")
    if any(isinstance(r["stories"], list) for r in rs):
        lo, hi = min(_hf(cfg)["stories_if_unknown"]), max(_hf(cfg)["stories_if_unknown"])
        en.append(f"stories unknown, so {lo} to {hi} stories")
        es.append(f"no se sabe cuántos pisos, así que de {lo} a {hi} pisos")
    note = {"en": "Siding prices are rough, from the county's house size" + (f" ({'; '.join(en)})" if en else "") +
                  ". Estimate range, not final: measure before quoting.",
            "es": "Precios de siding aproximados, según el tamaño de la casa en el condado" +
                  (f" ({'; '.join(es)})" if es else "") + ". Rango estimado, no final: midan antes de dar precio."}
    if kind == "storm":
        note = {k: f"{v} {est.INSURANCE_NOTE[k]}" for k, v in note.items()}
    return note


def evidence_note(kind, storm_day, today, cfg=None):
    """Research round 5 #8: on a storm walk whose storm is under evidence_fade_days old, a reminder that hail
    spatter marks on metal fade in weeks. {en, es} or None."""
    if kind != "storm" or not storm_day:
        return None
    try:
        age = (today - date.fromisoformat(str(storm_day))).days
    except (TypeError, ValueError):
        return None
    if not 0 <= age < _tw(cfg)["evidence_fade_days"]:
        return None
    return {"en": "Hail marks on metal (gutters, vents, wraps) fade in a few weeks: inspect and photograph soon.",
            "es": "Las marcas de granizo en el metal (canaletas, ventilas, forros) se borran en unas semanas: "
                  "inspeccionen y tomen fotos pronto."}


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


def pick(hud, today, goal=None, results=None, cfg=None, now=None, dnk=None):
    """The `today/walk` doc, or None when no list has houses left to knock. `dnk` = set of do-not-knock slugs."""
    tw = _tw(cfg)
    results = results or {}
    today = date.fromisoformat(today) if isinstance(today, str) else today
    goal = goal_for(today, goal, cfg)              # winter (Dec-Feb): ~65% of the goal, never below 10
    storm, pools, src = [], {}, {}
    max_age = storm_max_days(today, cfg)           # month-aware: longer off-season (Oct-Mar)
    for L in hud.get("lists") or []:
        try:
            age = (today - date.fromisoformat(L["day"])).days
        except (KeyError, TypeError, ValueError):
            continue
        c, pools[L["id"]] = _candidates(L, "storm", tw, results, dnk, today)
        src[L["id"]] = (L, "storm")
        if 0 <= age <= max_age:
            storm += [x for x in c if x["heat"] >= tw["storm_min_heat"]
                      and (x["avg_hail"] or 0) >= tw["storm_min_hail"]]
    every = []
    for L in hud.get("everyday_lists") or []:
        c, pools[L["id"]] = _candidates(L, "everyday", tw, results, dnk, today)
        src[L["id"]] = (L, "everyday")
        every += c
    # Come back at: doors due today on ANY list (a promise to a homeowner), earliest time first.
    due, due_town = [], {}
    for lid, by_turf in pools.items():
        for ss in by_turf.values():
            for s in ss:
                p = str(s["pid"])
                if p not in due_town and _due(results.get(p), today) == "today":
                    due.append(s)
                    due_town[p] = (src[lid][0].get("area") or "").split(",")[0].strip()
    due.sort(key=lambda s: results[str(s["pid"])]["come_back"]["time"] or "99:99")
    due_ids = set(due_town)
    cands = storm or every
    if not cands and due:                          # no walk qualifies, but a promised come-back is due today
        lid = next(i for i, bt in pools.items() for ss in bt.values() if any(x is due[0] for x in ss))
        DL, kind = src[lid]
        dt = next((t for t in DL.get("turfs") or [] if t.get("turf") == due[0].get("turf")),
                  {"turf": due[0].get("turf")})
        cands = [{"list": DL, "kind": kind, "turf": dt, "left": [due[0]], "heat": 0,
                  "why": dt.get("why") or DL.get("why") or [], "avg_hail": None}]
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
    # Come-back doors due today go first, then the walk in walking order; they count toward goal_doors.
    rest = [s for s in chosen if str(s["pid"]) not in due_ids][:max(goal - len(due), 0)]
    if due and rest:                               # start the walk nearest the last come-back door
        last = due[-1]
        i = min(range(len(rest)), key=lambda j: haversine_mi(last["lat"], last["lon"], rest[j]["lat"], rest[j]["lon"]))
        rest = [rest[i]] + rest[:i] + rest[i + 1:]
    chosen = due + walking_order(rest)
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
                            old_before, tw.get("old_strong_before")),
        "goal_doors": len(chosen), "kind": best["kind"], "list_id": L["id"],
        "stops": [{"pid": str(s["pid"]), "address": s["address"],
                   "city": s.get("city") or due_town.get(str(s["pid"])) or city,
                   "lat": round(float(s["lat"]), 6), "lon": round(float(s["lon"]), 6),
                   "pass": results.get(str(s["pid"]), {}).get("visits", 0) + 1,
                   **({"come_back": results[str(s["pid"])]["come_back"]} if str(s["pid"]) in due_ids else {}),
                   **house_facts(s, cfg, today)}
                  for s in chosen],
        "spanish_share": spanish, "who": who_knocks(spanish, cfg),
    }
    doc["est_minutes"], doc["walk_mi"] = estimate(doc["stops"], cfg)
    doc["drive_from_home_mi"] = drive_from_home(doc["stops"], cfg)
    doc["best_time"] = best_time(today, cfg)
    doc["goal_note"] = goal_note(today, doc["goal_doors"], cfg)
    doc.update(freshness(hud, now, cfg))
    note = rough_note(doc["stops"], best["kind"], cfg)            # additive, only when there is something to say
    if note:
        doc["rough_note"] = note
    note = evidence_note(best["kind"], L.get("day"), today, cfg)
    if note:
        doc["evidence_note"] = note
    return doc


def today_doc(hud, today, goal=None, results=None, cfg=None, now=None, dnk=None):
    """Like `pick`, but never None: with no walk to knock, a doc with empty stops and a plain `none_reason`."""
    doc = pick(hud, today, goal, results, cfg, now, dnk)
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
