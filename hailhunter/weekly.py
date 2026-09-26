"""Week results report from the HMP App's data (`hh.py weekly`): feeds the King's week wrap and, later, the
T35 learning loop (does the engine's heat predict real results at the door?).

Inputs (exported JSON, a dict {"<collection>/<id>": doc} or a list of docs with `id`/`doc_id`, fields inline or
under `data`):
- door taps `doors/<date>_<pid>` {date, pid, address, city, result: not_home|no|interested|booked, pass, at, ...}
  One doc = one door that day (the app keeps one doc per house per day; its latest tap is the result), the same
  count as the app's live tally. A door's walk comes from its own `list_id`/`kind`/`turf` if it has them, else
  from hud.json (the pid's list); with neither it counts as kind "unknown".
- leads `leads/<address-slug>` {address, city, source, type, stage, next_step{en,es,due}, created_at, ...}
- optional hud.json: the lists' heat and why, joined per list in `learning`.

Output: {week, from, to, as_of, totals, by_kind, by_list, by_walk, areas{best, worst, en, es}, follow_ups,
funnel, learning, summary{en, es}}. Rates: not_home_rate = share of doors not home (0-1); per_100 numbers are
per 100 doors; "inspection" = a Booked tap (for everyday/cash walks that is the estimate visit). A walk id is
"<list_id>~t<turf>", the same key the command center uses for its turfs.
"""
import re
import unicodedata
from collections import Counter
from datetime import date, timedelta

from .config import DEFAULTS
from .todaywalk import NOT_HOME, _split

TALK = ("no", "interested", "booked")
STAGES = [("not_contacted", "Not contacted", "Sin contactar"), ("contacted", "Contacted", "Contactado"),
          ("inspection_set", "Inspection set", "Inspección agendada"), ("damage_found", "Damage found", "Daño encontrado"),
          ("claim_filed", "Claim filed", "Reclamo presentado"), ("adjuster_meeting", "Adjuster meeting", "Cita con ajustador"),
          ("approved", "Approved", "Aprobado"), ("job_scheduled", "Job scheduled", "Trabajo agendado"),
          ("done", "Done", "Terminado"), ("lost", "Lost", "Perdido")]
STAGE_KEYS = [k for k, _, _ in STAGES]
CLOSED = ("done", "lost")


# ------------------------------------------------------------------ loading the app's docs
def _items(obj):
    """(doc_id, data) pairs from a dict {"coll/id": doc} or a list of docs; unwraps {"docs": [...]}-style exports."""
    if isinstance(obj, dict) and obj and not any(isinstance(v, dict) for v in obj.values()):
        lists = [v for v in obj.values() if isinstance(v, list)]
        obj = lists[0] if lists else {}
    if isinstance(obj, dict):
        pairs = obj.items()
    elif isinstance(obj, list):
        pairs = [((d.get("id") or d.get("doc_id") or "") if isinstance(d, dict) else "", d) for d in obj]
    else:
        return []
    out = []
    for key, doc in pairs:
        if not isinstance(doc, dict):
            continue
        data = doc.get("data") if isinstance(doc.get("data"), dict) else doc
        out.append((str(key or "").split("/")[-1], data))
    return out


def _result(v):
    r = re.sub(r"\s+", " ", str(v or "").strip().lower())
    return "not_home" if r in NOT_HOME else r.replace(" ", "_")


def load_doors(obj):
    """Door taps -> [{date, pid, address, city, result, pass, list_id, kind, turf}] (docs without pid/result skipped)."""
    out = []
    for key, d in _items(obj):
        m = re.match(r"^(\d{4}-\d{2}-\d{2})_(.+)$", key)
        pid = d.get("pid") or (m.group(2) if m else None)
        res = _result(d.get("result"))
        day = str(d.get("date") or (m.group(1) if m else "") or str(d.get("at") or "")[:10])[:10]
        try:
            date.fromisoformat(day)
        except ValueError:
            day = None
        if not pid or not res:
            continue
        out.append({"date": day, "pid": str(pid), "address": d.get("address") or "", "city": d.get("city") or "",
                    "result": res, "pass": d.get("pass"), "list_id": d.get("list_id"), "kind": d.get("kind"),
                    "turf": d.get("turf")})
    return out


def load_leads(obj):
    """Lead docs -> [{id, ...fields}] (id = the doc id, the address slug)."""
    return [{**d, "id": key or slug(d.get("address"))} for key, d in _items(obj)]


def slug(address):
    """The app's lead id rule (slugOf): lowercase, accents dropped, non a-z0-9 runs -> "-", max 80 chars."""
    s = unicodedata.normalize("NFD", str(address or "").lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:80]


# ------------------------------------------------------------------ weeks
def week_id(d):
    y, w, _ = (date.fromisoformat(d) if isinstance(d, str) else d).isocalendar()
    return f"{y}-{w:02d}"


def week_range(week):
    """"2026-39" or "2026-W39" -> (monday, sunday) dates (ISO weeks, like the app's stats/week-<YYYY-WW>)."""
    m = re.match(r"^\s*(\d{4})-?W?(\d{1,2})\s*$", str(week or ""), re.I)
    if not m:
        raise ValueError(f"week must look like 2026-39, got {week!r}")
    mon = date.fromisocalendar(int(m.group(1)), int(m.group(2)), 1)
    return mon, mon + timedelta(days=6)


# ------------------------------------------------------------------ hud.json lookups
def hud_index(hud):
    """(pid -> {list_id, kind, turf}, list_id -> list meta). Storm lists first (newest first), then everyday."""
    pids, meta = {}, {}
    storm = sorted(hud.get("lists") or [], key=lambda L: str(L.get("day") or ""), reverse=True) if hud else []
    every = (hud.get("everyday_lists") or []) if hud else []
    for kind, lists in (("storm", storm), ("everyday", every)):
        for L in lists:
            lid = L.get("id")
            if not lid:
                continue
            turfs = {t.get("turf"): t for t in L.get("turfs") or []}
            heats = [t.get("heat") for t in turfs.values() if t.get("heat") is not None]
            meta[lid] = {"kind": kind, "area": L.get("area"), "day": L.get("day"),
                         "heat": L.get("heat") if L.get("heat") is not None else (max(heats) if heats else None),
                         "why": L.get("why") or [], "turfs": turfs}
            for s in L.get("stops") or []:
                if s.get("pid") is not None:
                    pids.setdefault(str(s["pid"]), {"list_id": lid, "kind": kind, "turf": s.get("turf")})
    return pids, meta


# ------------------------------------------------------------------ counting
def tally(rows):
    n = len(rows)
    c = Counter(r["result"] for r in rows)
    answered = sum(c[k] for k in TALK)
    leads = c["interested"] + c["booked"]
    per = (lambda x: round(100.0 * x / n, 1)) if n else (lambda x: 0.0)
    return {"doors": n, "answered": answered, "no": c["no"], "interested": c["interested"], "booked": c["booked"],
            "not_home": c["not_home"], "not_home_rate": round(c["not_home"] / n, 3) if n else 0.0,
            "leads_per_100": per(leads), "inspection_rate_per_100": per(c["booked"])}


def _area(rows, fallback=None):
    """"Pine St & Oak St, Fremont" from the doors' own addresses (top 2 streets, most common city)."""
    streets = Counter(_split(r["address"])[1] for r in rows if r["address"])
    city = Counter(r["city"] for r in rows if r["city"]).most_common(1)
    name = " & ".join(k for k, _ in streets.most_common(2))
    if city:
        name = f"{name}, {city[0][0]}" if name else city[0][0]
    return name or fallback or "?"


def _pl(n, one, many):
    return f"{n} {one if n == 1 else many}"


def _best_worst(walks, min_doors):
    ok = [w for w in walks if w["doors"] >= min_doors]
    key = lambda w: (w["leads_per_100"], w["inspection_rate_per_100"], -w["not_home_rate"])  # noqa: E731
    best = max(ok, key=key) if ok else None
    worst = min(ok, key=key) if len(ok) >= 2 else None
    if best and worst and key(best) == key(worst):
        worst = None                               # all the same: no "worst" to call out
    out = {"best": None, "worst": None}
    en, es = [], []
    if best:
        lead = best["interested"] + best["booked"]
        out["best"] = {**{k: best[k] for k in ("walk_id", "list_id", "kind", "area")}, **tally_view(best)}
        en.append(f"Best area: {best['area']} ({_pl(best['doors'], 'door', 'doors')}, {lead} interested or booked, "
                  f"{_pl(best['booked'], 'inspection', 'inspections')} booked).")
        es.append(f"La mejor zona: {best['area']} ({_pl(best['doors'], 'puerta', 'puertas')}, {lead} interesados o "
                  f"con cita, {_pl(best['booked'], 'inspección agendada', 'inspecciones agendadas')}).")
    if worst:
        lead = worst["interested"] + worst["booked"]
        nh = round(worst["not_home_rate"] * 100)
        out["worst"] = {**{k: worst[k] for k in ("walk_id", "list_id", "kind", "area")}, **tally_view(worst)}
        en.append(f"Weakest area: {worst['area']} ({_pl(worst['doors'], 'door', 'doors')}, {lead} interested or "
                  f"booked, {nh}% not home).")
        es.append(f"La zona más floja: {worst['area']} ({_pl(worst['doors'], 'puerta', 'puertas')}, {lead} "
                  f"interesados o con cita, {nh}% no estaban en casa).")
    if not best:
        en.append(f"Not enough doors to compare areas yet (a walk needs {min_doors} doors).")
        es.append(f"Todavía no hay suficientes puertas para comparar zonas (cada ruta necesita {min_doors}).")
    out["en"], out["es"] = " ".join(en), " ".join(es)
    return out


def tally_view(row):
    return {k: row[k] for k in ("doors", "answered", "interested", "booked", "not_home_rate", "leads_per_100",
                                "inspection_rate_per_100")}


def follow_ups(leads, today):
    """Open leads (not done/lost) with a next step, soonest first; overdue = due before `today`."""
    today = today.isoformat() if isinstance(today, date) else str(today)
    rows, missing = [], 0
    for L in leads:
        if L.get("stage") in CLOSED:
            continue
        ns = L.get("next_step") if isinstance(L.get("next_step"), dict) else None
        due = str((ns or {}).get("due") or "")[:10] or None
        if not ns:
            missing += 1
            continue
        rows.append({"id": L["id"], "address": L.get("address") or L["id"], "city": L.get("city") or "",
                     "stage": L.get("stage"), "next": {"en": ns.get("en"), "es": ns.get("es"), "due": due},
                     "overdue": bool(due and due < today), "due_today": due == today})
    rows.sort(key=lambda r: (r["next"]["due"] or "9999", r["address"]))
    return {"open": rows, "overdue": sum(r["overdue"] for r in rows), "due_today": sum(r["due_today"] for r in rows),
            "open_without_next_step": missing}


def funnel(leads, start=None, end=None):
    """Every lead by stage (the whole pipeline, not just this week) + how many were created this week."""
    c = Counter(L.get("stage") if L.get("stage") in STAGE_KEYS else "other" for L in leads)
    stages = [{"key": k, "en": en, "es": es, "count": c[k]} for k, en, es in STAGES]
    if c["other"]:
        stages.append({"key": "other", "en": "Other", "es": "Otro", "count": c["other"]})
    new = None
    if start and end:
        new = sum(1 for L in leads if start.isoformat() <= str(L.get("created_at") or "")[:10] <= end.isoformat())
    return {"stages": stages, "total": len(leads), "open": sum(1 for L in leads if L.get("stage") not in CLOSED),
            "new_this_week": new}


# ------------------------------------------------------------------ the report
def report(doors, leads, week=None, hud=None, today=None, cfg=None):
    """The week's results doc. `doors`/`leads` = load_doors/load_leads output; `week` = "2026-39",
    "all" or None (= the week of `today`); `today` = date for overdue follow-ups (default: the week's last day)."""
    wcfg = {**DEFAULTS["weekly"], **((cfg or {}).get("weekly") or {})}
    doors = [dict(d) for d in doors or []]         # don't change the caller's rows
    leads = list(leads or [])
    today = date.fromisoformat(today) if isinstance(today, str) else today
    if week is None:
        week = week_id(today or date.today())
    if str(week).lower() == "all":
        start = end = None
        rows = list(doors)
    else:
        start, end = week_range(week)
        rows = [d for d in doors if d["date"] and start.isoformat() <= d["date"] <= end.isoformat()]
    today = today or end or date.today()
    pids, meta = hud_index(hud or {})

    for r in rows:                                 # which list / walk / kind each door belongs to
        h = pids.get(r["pid"]) or {}
        r["list_id"] = r["list_id"] or h.get("list_id")
        r["kind"] = r["kind"] or (meta.get(r["list_id"]) or {}).get("kind") or h.get("kind") or "unknown"
        r["turf"] = r["turf"] if r["turf"] is not None else (h.get("turf") if h.get("list_id") == r["list_id"] else None)

    def group(keyf):
        g = {}
        for r in rows:
            g.setdefault(keyf(r), []).append(r)
        return g

    by_kind = {k: tally(v) for k, v in sorted(group(lambda r: r["kind"]).items())}
    lists, walks = [], []
    for lid, rs in sorted(group(lambda r: r["list_id"] or "unknown").items()):
        m = meta.get(lid) or {}
        lists.append({"list_id": lid, "kind": rs[0]["kind"], "area": m.get("area") or _area(rs), **tally(rs)})
    for (lid, turf), rs in sorted(group(lambda r: (r["list_id"] or "unknown", r["turf"])).items(),
                                  key=lambda x: (x[0][0], str(x[0][1]))):
        wid = f"{lid}~t{turf}" if turf is not None else lid
        walks.append({"walk_id": wid, "list_id": lid, "turf": turf, "kind": rs[0]["kind"], "area": _area(rs),
                      **tally(rs)})

    # learning (T35): each list's heat/why next to what really happened, incl. where its leads are now
    by_slug = {L["id"]: L for L in leads}
    learn = []
    for L in lists:
        m = meta.get(L["list_id"]) or {}
        rs = [r for r in rows if (r["list_id"] or "unknown") == L["list_id"]]
        reached = Counter()
        for s in {slug(r["address"]) for r in rs if r["address"]}:
            if s in by_slug:
                reached[by_slug[s].get("stage") or "other"] += 1
        wl = []
        for w in walks:
            if w["list_id"] != L["list_id"]:
                continue
            t = (m.get("turfs") or {}).get(w["turf"]) or {}
            wl.append({"walk_id": w["walk_id"], "heat": t.get("heat"), "why": t.get("why") or [],
                       **tally_view(w)})
        past = STAGE_KEYS.index("inspection_set")
        learn.append({"list_id": L["list_id"], "kind": L["kind"], "area": L["area"], "day": m.get("day"),
                      "heat": m.get("heat"), "why": m.get("why") or [], "in_hud": bool(m), **tally_view(L),
                      "leads_now": dict(reached),
                      "inspection_or_later": sum(n for k, n in reached.items()
                                                 if k in STAGE_KEYS and k != "lost" and STAGE_KEYS.index(k) >= past),
                      "walks": wl})

    t = tally(rows)
    areas = _best_worst(walks, wcfg["min_doors_area"])
    en = (f"{_pl(t['doors'], 'door', 'doors')} knocked, {t['answered']} answered, {t['interested']} interested, "
          f"{_pl(t['booked'], 'inspection', 'inspections')} booked; {round(t['not_home_rate'] * 100)}% not home.")
    es = (f"{_pl(t['doors'], 'puerta tocada', 'puertas tocadas')}, {t['answered']} abrieron, {t['interested']} "
          f"interesados, {_pl(t['booked'], 'inspección agendada', 'inspecciones agendadas')}; "
          f"{round(t['not_home_rate'] * 100)}% no estaban en casa.")
    return {
        "week": "all" if start is None else week_id(start), "from": start and start.isoformat(),
        "to": end and end.isoformat(), "as_of": today.isoformat(),
        "totals": {**t, "houses": len({r["pid"] for r in rows})},
        "by_kind": by_kind, "by_list": lists, "by_walk": walks, "areas": areas,
        "follow_ups": follow_ups(leads, today),
        "funnel": funnel(leads, start, end),
        "learning": {"hud": bool(meta), "hud_generated_utc": (hud or {}).get("generated_utc"),
                     "note": "heat/why = the engine's guess when the list was made; the rest = real results at "
                             "the door. T35 compares them.",
                     "lists": learn},
        "summary": {"en": en + " " + areas["en"], "es": es + " " + areas["es"]},
    }
