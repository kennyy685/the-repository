"""Storm alert on your own accounts (`hh.py accounts`, research round 54 item 3, board T193).

New hail (or damaging wind) over an address HMP already has -> the top of today's call list (`calls/today`
`accounts_hit`, see calltoday.account_rows), with the hail report attached.

Accounts (`load_accounts`): a list of {kind: lead|claim|door|commercial, key, address, city, lat?, lon?, since?}
(or {"accounts": [...]}), and/or the HMP App's own exports in one file {"leads": ..., "claims": ..., "doors": ...}
(each a dict {doc id: doc} or a list of docs). From the app's exports: leads and claims except the stages in
accounts.skip_stages ("lost"; done/paid = past customers, kept), doors whose tap result is in accounts.door_results
(Interested, Booked). `since` (YYYY-MM-DD): only hail AFTER that day is new for the account; from the app's exports
it is the lead's created_at, the claim's date_of_loss (else created_at), the door tap's date. Plus the businesses in
data/scout_contacts.json (`scout_accounts`, kind commercial, business lines only). One account per address:
claim > lead > door > commercial.

Where the number comes from (`source`), best first:
  radar          engine database with the NOAA MRMS radar maps: radar corrected by ground reports AT the address
                 (watch.hail_at, as on the printed hail report). Only where the database is (not the cloud run).
  hail_evidence  hud.json hail_evidence for that exact address (storm door-list houses)
  door_list      hud.json storm door lists: that exact house
  commercial     hud.json targets: that exact building
  near_house     no reading at the address that day: the closest storm door-list house within accounts.near_mi
  storm_report   no reading at the address that day: a town's hail reports (hud.json storms) centered within
                 accounts.report_mi
  wind_report    damaging wind (hud.json wind_events with a wind-score band: 58+ mph gusts or a damage report)
                 centered within accounts.report_mi
match "at" = the first four (distance_mi 0); "near" = the others (distance_mi = how far the evidence is).
Hail bar = call_today.min_hail; window = the last accounts.max_days days (config.json), else
today_walk.storm_max_days (60).

Rules built in: a commercial contact's phone only when it is a business line (calltoday.business_phone); homes
(lead, claim, door) never carry a name, owner or phone here (the app has its own record, found by `key`). No
insurance, claim or deductible words in anything said to the customer (calltoday.account_rows).
"""
import json
import os
import re
import sqlite3
from datetime import date, timedelta

import numpy as np

from .config import DEFAULTS
from .followups import _day
from .geo import haversine_mi, haversine_np
from .watch import hail_at
from .weekly import _items

KINDS = ("claim", "lead", "door", "commercial")          # also the priority when two accounts share an address
AT = ("radar", "hail_evidence", "door_list", "commercial")
SOURCE_TEXT = {
    "radar": ("radar + ground reports at the address", "radar + reportes en tierra en la dirección"),
    "hail_evidence": ("radar + ground reports at the address", "radar + reportes en tierra en la dirección"),
    "door_list": ("radar estimate at the house", "estimado de radar en la casa"),
    "commercial": ("radar estimate at the building", "estimado de radar en el edificio"),
    "near_house": ("radar estimate at a house nearby", "estimado de radar en una casa cercana"),
    "storm_report": ("storm reports nearby", "reportes de tormenta cercanos"),
    "wind_report": ("NWS wind reports nearby", "reportes de viento del NWS cercanos"),
}
MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
             "noviembre", "diciembre"]


def settings(cfg=None):
    """(accounts settings, min hail inches, window days) from config (see the module doc)."""
    cfg = cfg or {}
    a = {**DEFAULTS["accounts"], **(cfg.get("accounts") or {})}
    min_hail = float((cfg.get("call_today") or DEFAULTS["call_today"]).get("min_hail", 1.0))
    days = a.get("max_days") or (cfg.get("today_walk") or DEFAULTS["today_walk"]).get("storm_max_days", 60)
    return a, min_hail, int(days)


def _norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[.,#]", " ", str(s or "").lower())).strip()


def _nk(address, city):
    return f"{_norm(address)}|{_norm(city)}"


def _float(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f else None


# ------------------------------------------------------------------ accounts in
def _account(kind, key, d, since):
    address = str(d.get("address") or "").strip()
    city = str(d.get("city") or "").strip()
    lat, lon = _float(d.get("lat")), _float(d.get("lon"))
    if not address and (lat is None or lon is None):
        return None
    a = {"kind": kind, "key": str(key or f"{address}|{city}"), "address": address, "city": city,
         "lat": lat if lon is not None else None, "lon": lon if lat is not None else None, "since": _day(since)}
    if kind == "commercial":                   # businesses only: name + business line (never a home, never a cell)
        from .calltoday import business_phone
        a.update(name=str(d.get("name") or "")[:80], phone=business_phone(d) or "", ask_for=d.get("ask_for") or "",
                 ask_for_es=d.get("ask_for_es") or "")
    return a


def _explicit(obj):
    out = []
    for doc_id, d in _items(obj):
        kind = str(d.get("kind") or "lead").strip().lower()
        kind = kind if kind in KINDS else "lead"
        a = _account(kind, d.get("key") or None, d, d.get("since") or d.get("date_of_loss") or d.get("created_at"))
        if a:
            out.append(a)
    return out


def _from_app(raw, acfg):
    skip = {str(s).lower() for s in acfg.get("skip_stages") or []}
    ok_doors = {str(s).lower() for s in acfg.get("door_results") or []}
    out = []
    for coll, kind in (("leads", "lead"), ("claims", "claim")):
        for doc_id, d in _items(raw.get(coll)):
            if str(d.get("stage") or "").strip().lower() in skip:
                continue
            since = (d.get("date_of_loss") or d.get("created_at")) if kind == "claim" else d.get("created_at")
            a = _account(kind, f"{coll}/{doc_id}" if doc_id else None, d, since)
            if a:
                out.append(a)
    for doc_id, d in _items(raw.get("doors")):
        res = re.sub(r"\s+", "_", str(d.get("result") or "").strip().lower())
        if res not in ok_doors:
            continue
        m = re.match(r"^(\d{4}-\d{2}-\d{2})_", doc_id or "")
        a = _account("door", f"doors/{doc_id}" if doc_id else None, d,
                     d.get("date") or (m.group(1) if m else None) or d.get("at"))
        if a:
            out.append(a)
    return out


def load_accounts(raw, cfg=None):
    """Accounts from an accounts file's JSON (see the module doc); anything unreadable is skipped, never fatal."""
    if raw is None:
        return []
    acfg = settings(cfg)[0]
    if isinstance(raw, dict) and any(k in raw for k in ("leads", "claims", "doors")):
        return _from_app(raw, acfg) + (_explicit(raw["accounts"]) if raw.get("accounts") else [])
    return _explicit(raw)


def scout_accounts(cfg=None, path=None):
    """The businesses in data/scout_contacts.json that have a business line: one commercial account per building
    address (`match`). City when the contact has one (else matched to hud.json targets by address)."""
    if path is None:
        dbp = ((cfg or {}).get("paths") or {}).get("db") or os.path.join("data", "hailhunter.db")
        path = os.path.join(os.path.dirname(dbp), "scout_contacts.json")
    try:
        with open(path, encoding="utf-8") as f:
            contacts = json.load(f).get("contacts") or []
    except (OSError, ValueError, AttributeError):
        return []
    out = []
    for c in contacts:
        if not isinstance(c, dict):
            continue
        for m in c.get("match") or []:
            a = _account("commercial", None, {**c, "address": m, "city": c.get("city") or ""}, None)
            if a and a["phone"]:
                a["confidence"] = c.get("confidence")
                out.append(a)
    return out


def merge(*groups):
    """One account per address (claim > lead > door > commercial); a missing location is filled from the others."""
    best = {}
    for a in (x for g in groups for x in g or []):
        k = _nk(a["address"], a["city"]) if a["address"] else f"@{a['lat']:.5f},{a['lon']:.5f}"
        old = best.get(k)
        if old is None:
            best[k] = a
            continue
        win, lose = (a, old) if KINDS.index(a["kind"]) < KINDS.index(old["kind"]) else (old, a)
        if win["lat"] is None and lose["lat"] is not None:
            win = {**win, "lat": lose["lat"], "lon": lose["lon"]}
        best[k] = win
    return list(best.values())


def gather(cfg=None, raw=None, leads_raw=None, doors_raw=None, scout=True):
    """Every account for one run, one per address: the accounts file (`raw`, either shape), the app's leads and door
    taps when a run already has them (`hh.py daily --leads/--results`), and the scout_contacts.json businesses."""
    app = {k: v for k, v in (("leads", leads_raw), ("doors", doors_raw)) if v is not None}
    return merge(load_accounts(raw, cfg), _from_app(app, settings(cfg)[0]) if app else [],
                 scout_accounts(cfg) if scout else [])


# ------------------------------------------------------------------ where the hail was
def _geocode(conn, address, city):
    """(lat, lon) of a stored building (engine database parcels), or None (no database, not found, ambiguous)."""
    if conn is None or not address:
        return None
    try:
        if city:
            rows = conn.execute("""SELECT lat, lon FROM parcels WHERE lower(address)=lower(?) AND lower(city)=lower(?)
                                   AND lat IS NOT NULL LIMIT 1""", (address.strip(), city.strip())).fetchall()
        else:                                  # no city: only when the address is unique
            rows = conn.execute("""SELECT DISTINCT lat, lon FROM parcels WHERE lower(address)=lower(?)
                                   AND lat IS NOT NULL LIMIT 2""", (address.strip(),)).fetchall()
            rows = rows if len(rows) == 1 else []
    except sqlite3.Error:
        return None
    return (float(rows[0][0]), float(rows[0][1])) if rows else None


def _radar(conn, cfg, located, start, today, min_hail):
    """({account index: {day: reading}}, radar maps read) from the database's radar maps (fused with ground reports),
    every account and every storm day in the window. A reading under min_hail still counts (it beats nearby
    evidence that day)."""
    out, n = {}, 0
    if conn is None or not located:
        return out, n
    from . import hailreport, mrms, nbhd
    try:
        days = [r[0] for r in conn.execute("SELECT conv_day FROM swaths WHERE conv_day >= ? AND conv_day <= ? "
                                           "ORDER BY conv_day DESC", (start, today))]
    except sqlite3.Error:
        return out, n
    radius = (cfg.get("hail_evidence") or DEFAULTS["hail_evidence"]).get("radius_mi", 10.0)
    for day in days:
        raw, rmeta = mrms.load_grid(cfg, day)
        if raw is None:
            continue
        grid, meta, _ = nbhd.fused_grid(conn, cfg, day)
        n += 1
        obs = None
        for i, a in located:
            if a["since"] and day <= a["since"]:
                continue
            h = hail_at(grid, meta, a["lat"], a["lon"])
            if h is None:
                continue
            rd = {"day": day, "peril": "hail", "hail": round(h, 2), "source": "radar", "dist": 0.0, "report": None}
            if h >= min_hail:                  # the hail report, as hud.json hail_evidence has it
                obs = hailreport.day_reports(conn, day) if obs is None else obs
                ev = hailreport.evidence(conn, cfg, day, a["lat"], a["lon"], radius, fused=(grid, meta), obs=obs)
                near = ev["reports"][0] if ev["reports"] else None
                rm = hail_at(raw, rmeta, a["lat"], a["lon"])
                rd["report"] = {"day": day, "hail_in": ev["hail"],
                                "nearest_report": {"dist_mi": near["dist_mi"], "size_in": near["size_in"],
                                                   "source": near["who"]} if near else None,
                                "radar_max_in": None if rm is None else round(rm, 2)}
            out.setdefault(i, {})[day] = rd
    return out, n


def _band(e, cfg):
    parts = e.get("wind_parts") or {}
    if parts.get("band") is not None:
        return float(parts["band"])
    from . import wind
    b = wind.band_factor(e.get("max_mph"), cfg)
    return b or ((cfg.get("wind_score") or DEFAULTS["wind_score"])["damage_only"] if e.get("damage_reports") else 0.0)


def _short(day, lang):
    d = date.fromisoformat(day)
    return f"{d.day} de {MONTHS_ES[d.month - 1]} de {d.year}" if lang == "es" else f"{d:%b} {d.day}, {d.year}"


def hint(alert):
    """{doc, en, es}: where the hail report is (the app's evidence/<slug> doc, same slug rule as Today's knock) and
    one plain line of what it says."""
    from .todaywalk import slug
    src_en, src_es = SOURCE_TEXT[alert["source"]]
    d_en, d_es, dist = _short(alert["event_date"], "en"), _short(alert["event_date"], "es"), alert["distance_mi"]
    if alert["peril"] == "wind":
        mph = alert.get("max_wind_mph")
        what_en = f"wind gusts to {mph:.0f} mph" if mph else "wind damage reported"
        what_es = f"ráfagas de viento de {mph:.0f} mph" if mph else "daños por viento reportados"
        return {"doc": None, "en": f"{what_en.capitalize()} {dist:.1f} mi away on {d_en} ({src_en}).",
                "es": f"{what_es.capitalize()} a {dist:.1f} mi el {d_es} ({src_es})."}
    h = alert["max_hail_in"]
    if alert["match"] == "at":
        en = f'{h:.2f}" hail at the address on {d_en} ({src_en}).'
        es = f'Granizo de {h:.2f}" en la dirección el {d_es} ({src_es}).'
    else:
        en = f'{h:.2f}" hail {dist:.1f} mi away on {d_en} ({src_en}); no reading at the address itself.'
        es = f'Granizo de {h:.2f}" a {dist:.1f} mi el {d_es} ({src_es}); no hay lectura en la dirección misma.'
    rep = alert.get("hail_report") or {}
    near = rep.get("nearest_report")
    if alert["match"] == "at" and near:
        en += f' Nearest ground report: {near["size_in"]:.2f}" at {near["dist_mi"]:.1f} mi.'
        es += f' Reporte en tierra más cercano: {near["size_in"]:.2f}" a {near["dist_mi"]:.1f} mi.'
    return {"doc": f"evidence/{slug(alert['address'], alert['city'])}" if alert.get("hail_report") else None,
            "en": en, "es": es}


def check(hud, accts, today, cfg=None, conn=None, days=None):
    """Every account with new hail (or damaging wind) in the window -> {date, since, days, min_hail, checked, located,
    radar, alerts[], not_located[]}. Each alert: {key, kind, address, city, event_date, days_ago, peril: hail|wind,
    max_hail_in, max_wind_mph, distance_mi, source, match: at|near, hail_report {day, hail_in, nearest_report,
    radar_max_in} | null, hail_report_hint {doc, en, es}, other_days[] {day, peril, hail_in, wind_mph, source}}
    (+ name, phone, ask_for/ask_for_es for commercial). Best first: at before near, hail before wind, newest, biggest.
    `conn` = the engine database (read-only is fine; None = hud.json only, as in the cloud run)."""
    cfg = cfg or {}
    hud = hud or {}
    acfg, min_hail, window = settings(cfg)
    window = int(days or window)
    today_d = date.fromisoformat(today)
    start = (today_d - timedelta(days=window)).isoformat()

    def fresh(day, a):
        return bool(day) and start <= day <= today and not (a["since"] and day <= a["since"])

    # hud.json indexes (keys normalized: "address|city", lower case, no punctuation)
    ev = {}
    for k, e in (hud.get("hail_evidence") or {}).items():
        addr, _, city = str(k).partition("|")
        if isinstance(e, dict):
            ev[_nk(addr, city)] = e
    stops, loc, cities, near = {}, {}, {}, {}
    for group in ("lists", "everyday_lists"):
        for L in hud.get(group) or []:
            storm = group == "lists" and L.get("kind") != "everyday"
            for s in L.get("stops") or []:
                nk = _nk(s.get("address"), s.get("city"))
                cities.setdefault(_norm(s.get("address")), set()).add(_norm(s.get("city")))
                lat, lon = _float(s.get("lat")), _float(s.get("lon"))
                if lat is not None and lon is not None:
                    loc.setdefault(nk, (lat, lon))
                hail = _float(s.get("hail"))
                if storm and hail is not None and L.get("day"):
                    stops.setdefault(nk, []).append((L["day"], hail))
                    if lat is not None and lon is not None and start <= L["day"] <= today:
                        near.setdefault(L["day"], []).append((lat, lon, hail))
    near = {day: tuple(np.array(col, dtype=float) for col in zip(*pts)) for day, pts in near.items()}
    targets = {}
    for t in hud.get("targets") or []:
        targets.setdefault(_nk(t.get("address"), t.get("city")), []).append(t)
        cities.setdefault(_norm(t.get("address")), set()).add(_norm(t.get("city")))
    storms = [s for s in hud.get("storms") or [] if s.get("day") and start <= s["day"] <= today and
              _float(s.get("hail")) is not None and float(s["hail"]) >= min_hail and
              _float(s.get("lat")) is not None and _float(s.get("lon")) is not None]
    winds = [w for w in hud.get("wind_events") or [] if w.get("day") and start <= w["day"] <= today and
             _float(w.get("lat")) is not None and _float(w.get("lon")) is not None and _band(w, cfg) > 0]

    # resolve each account: its hud key (a city-less address takes the only city hud.json knows it by) + location
    work = []
    for a in accts or []:
        a = dict(a)
        nk = _nk(a["address"], a["city"])
        if a["address"] and not a["city"]:
            cs = cities.get(_norm(a["address"])) or set()
            if len(cs) == 1:
                nk = f"{_norm(a['address'])}|{next(iter(cs))}"
                t = (targets.get(nk) or [{}])[0]
                if t.get("city"):
                    a["city"] = t["city"]
                    if a["kind"] == "commercial":
                        a["key"] = t.get("key") or f"{a['address']}|{a['city']}"
        if a["lat"] is None:
            ll = loc.get(nk) or _geocode(conn, a["address"], a["city"])
            if ll:
                a["lat"], a["lon"] = ll
        work.append((a, nk))
    located = [(i, a) for i, (a, _) in enumerate(work) if a["lat"] is not None]
    radar, radar_days = _radar(conn, cfg, located, start, today, min_hail)

    alerts, not_located = [], []
    for i, (a, nk) in enumerate(work):
        at = dict(radar.get(i, {}))            # day -> best reading AT the address (radar first)
        e = ev.get(nk)
        if e and fresh(e.get("day"), a) and _float(e.get("hail_in")) is not None:
            _put(at, {"day": e["day"], "peril": "hail", "hail": float(e["hail_in"]), "source": "hail_evidence",
                      "dist": 0.0, "report": {k: e.get(k) for k in ("day", "hail_in", "nearest_report",
                                                                     "radar_max_in")}})
        for day, hail in stops.get(nk, []):
            if fresh(day, a):
                _put(at, {"day": day, "peril": "hail", "hail": hail, "source": "door_list", "dist": 0.0})
        for t in targets.get(nk, []):
            h = _float(t.get("hail"))
            if h is not None and fresh(t.get("day"), a):
                _put(at, {"day": t["day"], "peril": "hail", "hail": h, "source": "commercial", "dist": 0.0})
        hits = [rd for rd in at.values() if rd["hail"] >= min_hail]
        if a["lat"] is None:
            if a["kind"] != "commercial":      # the app's own accounts: add lat/lon to check the area around them
                not_located.append(a["key"])
        else:
            nearby = {}
            for day, (lats, lons, hails) in near.items():      # the closest storm door-list house that day
                if day in at or not fresh(day, a):
                    continue
                dists = haversine_np(a["lat"], a["lon"], lats, lons)
                j = int(np.argmin(dists))
                if dists[j] <= acfg["near_mi"]:
                    nearby[day] = {"day": day, "peril": "hail", "hail": float(hails[j]), "source": "near_house",
                                   "dist": float(dists[j])}
            for s in storms:                   # else the closest town hail report that day
                if s["day"] in at or s["day"] in nearby and nearby[s["day"]]["source"] == "near_house" or \
                        not fresh(s["day"], a):
                    continue
                d = haversine_mi(a["lat"], a["lon"], float(s["lat"]), float(s["lon"]))
                old = nearby.get(s["day"])
                if d <= acfg["report_mi"] and (old is None or d < old["dist"]):
                    nearby[s["day"]] = {"day": s["day"], "peril": "hail", "hail": float(s["hail"]),
                                        "source": "storm_report", "dist": d, "basis": s.get("basis")}
            hits += [rd for rd in nearby.values() if rd["hail"] >= min_hail]
            wind_by_day = {}
            for w in winds:
                if not fresh(w["day"], a):
                    continue
                d = haversine_mi(a["lat"], a["lon"], float(w["lat"]), float(w["lon"]))
                old = wind_by_day.get(w["day"])
                if d <= acfg["report_mi"] and (old is None or d < old["dist"]):
                    wind_by_day[w["day"]] = {"day": w["day"], "peril": "wind", "hail": None, "source": "wind_report",
                                             "dist": d, "mph": _float(w.get("max_mph")),
                                             "damage_reports": w.get("damage_reports") or 0,
                                             "trees_down": w.get("trees_down") or 0}
            hits += list(wind_by_day.values())
        if not hits:
            continue
        hits.sort(key=_rank)
        top = hits[0]
        alert = {"key": a["key"], "kind": a["kind"], "address": a["address"], "city": a["city"],
                 "event_date": top["day"], "days_ago": (today_d - date.fromisoformat(top["day"])).days,
                 "peril": top["peril"], "max_hail_in": None if top["hail"] is None else round(top["hail"], 2),
                 "max_wind_mph": top.get("mph"), "distance_mi": round(top["dist"], 1), "source": top["source"],
                 "match": "at" if top["source"] in AT else "near", "hail_report": _report(top, e)}
        if top["peril"] == "wind":
            alert.update(damage_reports=top["damage_reports"], trees_down=top["trees_down"])
        alert["hail_report_hint"] = hint(alert)
        alert["other_days"] = [{"day": h["day"], "peril": h["peril"],
                                "hail_in": None if h["hail"] is None else round(h["hail"], 2),
                                "wind_mph": h.get("mph"), "source": h["source"]} for h in hits[1:]]
        if a["kind"] == "commercial":
            alert.update(name=a.get("name") or "", phone=a.get("phone") or "", ask_for=a.get("ask_for") or "",
                         ask_for_es=a.get("ask_for_es") or "", confidence=a.get("confidence"))
        alerts.append(alert)
    alerts.sort(key=lambda x: _rank({"source": x["source"], "peril": x["peril"], "day": x["event_date"],
                                     "hail": x["max_hail_in"]}) + (x["key"],))
    return {"date": today, "since": start, "days": window, "min_hail": min_hail, "checked": len(work),
            "located": len(located), "radar": radar_days > 0, "alerts": alerts, "not_located": not_located[:50]}


def _put(at, rd):
    """Keep the best reading AT the address for rd's day: radar > hail_evidence > door_list > commercial."""
    old = at.get(rd["day"])
    if old is None or AT.index(rd["source"]) < AT.index(old["source"]) or \
            (rd["source"] == old["source"] and rd["hail"] > old["hail"]):
        at[rd["day"]] = rd


def _rank(rd):
    """Sort key: measured at the address first, then hail before wind, then the newest day, then the biggest hail."""
    return (0 if rd["source"] in AT else 1, 0 if rd["peril"] == "hail" else 1,
            -date.fromisoformat(rd["day"]).toordinal(), -(rd["hail"] or 0))


def _report(top, e):
    """The hail report attached to an alert: hud.json hail_evidence's shape {day, hail_in, nearest_report,
    radar_max_in}. Near matches: hail_in null, nearest_report = the evidence used. Wind: null."""
    if top["peril"] != "hail":
        return None
    if top.get("report"):
        return top["report"]
    if top["source"] in ("door_list", "commercial"):
        same = e if e and e.get("day") == top["day"] else {}
        return {"day": top["day"], "hail_in": round(top["hail"], 2), "nearest_report": same.get("nearest_report"),
                "radar_max_in": same.get("radar_max_in")}
    src = "radar estimate at a house nearby" if top["source"] == "near_house" else \
        f"storm reports ({top.get('basis') or 'ground'})"
    return {"day": top["day"], "hail_in": None,
            "nearest_report": {"dist_mi": round(top["dist"], 1), "size_in": round(top["hail"], 2), "source": src},
            "radar_max_in": None}


def evidence_docs(alerts):
    """{"evidence/<slug>": {address, city, pid, day, hail_in, nearest_report, radar_max_in}} for the alerts with a
    hail report: the app's hail-proof doc, same shape and slug rule as Today's knock (todaywalk.evidence_docs)."""
    out = {}
    for a in alerts or []:
        doc = (a.get("hail_report_hint") or {}).get("doc")
        if doc and a.get("hail_report") and doc not in out:
            out[doc] = {"address": a["address"], "city": a["city"], "pid": None, **a["hail_report"]}
    return out
