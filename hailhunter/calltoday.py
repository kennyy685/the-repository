"""Today's business call list (`hh.py calltoday`): apartment and commercial buildings in the freshest,
strongest hail that have a known BUSINESS line (data/scout_contacts.json, carried in hud.json `targets[].contact`).

JSON for the HMP App's future `calls/today` doc (and an optional CSV). Reads hud.json only, no database.

Rules built in (Nebraska / HMP): business lines only (leasing offices, property managers, company lines, never
homes); the opener offers a free roof and siding inspection after the hail date and says nothing about
insurance, claims, deductibles or who pays.
"""
import csv
import json
import os
import re
from datetime import date, datetime, timezone

from .config import DEFAULTS
from .geo import interp

KIND_ES = {"Apartments / multi-family": "apartamentos", "Commercial": "edificio comercial", "Industrial": "industrial"}
KIND_EN = {"Apartments / multi-family": "apartments", "Commercial": "commercial building", "Industrial": "industrial"}
NOT_BUSINESS = {"cell", "mobile", "personal", "home"}      # a contact's phone_type that is never called
MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
             "noviembre", "diciembre"]
RULES = {"en": "Business lines only. Offer the free inspection; never promise insurance will pay, never talk "
               "deductibles, never negotiate a claim.",
         "es": "Solo líneas de negocio. Ofrezcan la inspección gratis; nunca prometan que el seguro va a pagar, nunca "
               "hablen de deducibles, nunca negocien un reclamo."}
CSV_COLS = ["rank", "kind", "name", "phone", "ask_for", "address", "city", "hail_in", "day", "days_ago", "confidence",
            "why_en", "why_es", "opener_en", "opener_es"]


def _digits(phone):
    d = re.sub(r"\D", "", phone or "")
    return d[1:] if len(d) == 11 and d.startswith("1") else d


def business_phone(contact):
    """The contact's phone if it is a usable business line, else None."""
    if not contact or contact.get("personal") or str(contact.get("phone_type") or "").lower() in NOT_BUSINESS:
        return None
    phone = (contact.get("phone") or "").strip()
    return phone if len(_digits(phone)) == 10 else None


def _short_day(day, lang):
    d = date.fromisoformat(day)
    return f"{d.day} de {MONTHS_ES[d.month - 1]}" if lang == "es" else f"{d:%B} {d.day}"


def _company(cfg):
    c = (cfg or {}).get("company") or {}
    name = re.sub(r",?\s+LLC\.?$", "", c.get("name") or "HMP Siding & Roofing LLC")
    town = c.get("home_town") or ""
    callers = {lang: ((c.get("phones") or {}).get(lang) or {}).get("name", "").split(" ")[0] for lang in ("en", "es")}
    return name, town, callers


def opener(prop, day, cfg, peril="hail"):
    """{en, es}: one sentence offering a free roof and siding inspection after the hail (or wind storm) date.
    No insurance talk."""
    name, town, who = _company(cfg)
    en_me = f"this is {who['en']} with {name}" if who["en"] else f"this is {name}"
    es_me = f"habla {who['es']} de {name}" if who["es"] else f"le llamamos de {name}"
    en_town, es_town = (f" in {town}", f" en {town}") if town else ("", "")
    en_storm = f"{_short_day(day, 'en')} wind storm" if peril == "wind" else f"{_short_day(day, 'en')} hail"
    es_storm = (f"de la tormenta de viento del {_short_day(day, 'es')}" if peril == "wind"
                else f"del granizo del {_short_day(day, 'es')}")
    return {"en": f"Hi, {en_me}{en_town}: we're offering a free roof and siding inspection for {prop} after the "
                  f"{en_storm}, so who would be the right person to set that up with?",
            "es": f"Hola, {es_me}{es_town}: ofrecemos una inspección gratis del techo y el revestimiento (siding) de "
                  f"{prop} después {es_storm}; ¿con quién la puedo coordinar?"}


def _why(t, hail, days, n_more):
    d = date.fromisoformat(t["day"])
    kind = t.get("type") or ""
    more_en = f"; {n_more} more of their buildings in hail" if n_more else ""
    more_es = f"; {n_more} edificio(s) más suyos con granizo" if n_more else ""
    return {"en": f'{hail:.2f}" hail at the building on {d:%b} {d.day}, {d.year} ({days} days ago), '
                  f'{KIND_EN.get(kind, kind.lower() or "building")}{more_en}.',
            "es": f'Granizo de {hail:.2f}" en el edificio el {d.day} de {MONTHS_ES[d.month - 1]} de {d.year} '
                  f'(hace {days} días), {KIND_ES.get(kind, kind.lower() or "edificio")}{more_es}.'}


def call_list(hud, today, cfg=None):
    """The day's calls, best first: [{name, phone, ask_for, address, city, hail_in, day, why{en,es},
    opener{en,es}, ...}]. One call per business line: its best building leads; the rest go in `also`."""
    cfg = cfg or {}
    ct = cfg.get("call_today", {})
    sc = cfg.get("scoring", {})
    size_curve = sc.get("size_curve", [[0.5, 0.0], [1.0, 0.4], [2.0, 0.93], [2.5, 1.0]])
    recency_curve = sc.get("recency_curve", [[0, 1.0], [45, 1.0], [365, 0.4], [730, 0.1]])
    min_hail, max_days = ct.get("min_hail", 1.0), ct.get("max_days", 365)
    kinds = set(ct.get("kinds", list(KIND_EN)))
    today_d = date.fromisoformat(today)
    by_line = {}
    for t in (hud or {}).get("targets") or []:
        c, phone = t.get("contact"), business_phone(t.get("contact"))
        if not phone or t.get("type") not in kinds or not t.get("day"):
            continue
        try:
            days = (today_d - date.fromisoformat(t["day"])).days
        except ValueError:
            continue
        hail = float(t.get("hail") or 0)
        if hail < min_hail or not 0 <= days <= max_days:
            continue
        score = round(100 * interp(size_curve, hail) * interp(recency_curve, days), 1)
        by_line.setdefault(_digits(phone), []).append((score, float(t.get("score") or 0), t, c, phone, hail, days))
    calls = []
    for rows in by_line.values():
        rows.sort(key=lambda r: (-r[0], -r[1], r[2].get("address", "")))
        score, _, t, c, phone, hail, days = rows[0]
        name = (c.get("name") or "").strip()
        prop = name if name and len(name) <= 40 and not re.search(r"[:(]", name) else f"the property at {t['address']}"
        prop_es = prop if prop == name else f"la propiedad en {t['address']}"
        op = opener(prop, t["day"], cfg)
        if prop != name:
            op["es"] = opener(prop_es, t["day"], cfg)["es"]
        calls.append({
            "name": name or t["address"], "phone": phone, "ask_for": c.get("ask_for") or "",
            "address": t["address"], "city": t.get("city") or "", "hail_in": round(hail, 2), "day": t["day"],
            "why": _why(t, hail, days, len(rows) - 1), "opener": op,
            "days_ago": days, "score": score, "key": t.get("key") or f"{t['address']}|{t.get('city') or ''}",
            "type": t.get("type"), "confidence": c.get("confidence"),
            "also": [{"address": r[2]["address"], "city": r[2].get("city") or "", "hail_in": round(r[5], 2),
                      "day": r[2]["day"], "key": r[2].get("key")} for r in rows[1:]]})
    calls.sort(key=lambda x: (-x["score"], -x["hail_in"], x["name"]))
    return calls[:ct.get("max_calls", 15)]


WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def load_associations(cfg=None):
    """data/association_contacts.json `contacts` (T149); a missing or broken file = no association calls."""
    path = ((cfg or {}).get("paths") or {}).get("association_contacts") or os.path.join("data",
                                                                                         "association_contacts.json")
    try:
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
    except (OSError, ValueError):
        return []
    return [c for c in (doc.get("contacts") if isinstance(doc, dict) else doc) or [] if isinstance(c, dict)]


def association_calls(today, cfg=None, contacts=None):
    """T149: landlord/HOA association calls for `today` (kind "association"): only on call_today.association_days,
    up to call_today.association_per_week a week spread over those days, rotating through the callable contacts
    week by week. Business lines only: a contact without a usable business phone is skipped. The ask is vendor
    membership or a seat at a member meeting, no insurance talk."""
    cfg = cfg or {}
    ct = cfg.get("call_today", {})
    days = [d for d in (str(x).strip().lower()[:3] for x in ct.get("association_days", ["Tue"])) if d in WEEKDAYS]
    per_week = int(ct.get("association_per_week", 2) or 0)
    today_d = date.fromisoformat(today)
    wd = WEEKDAYS[today_d.weekday()]
    contacts = load_associations(cfg) if contacts is None else contacts
    usable = [(c, business_phone(c)) for c in contacts if str(c.get("kind") or "association") == "association"]
    usable = [(c, p) for c, p in usable if p]
    if not usable or per_week <= 0 or wd not in days:
        return []
    days = sorted(set(days), key=WEEKDAYS.index)
    i = days.index(wd)
    n_today = per_week // len(days) + (1 if i < per_week % len(days) else 0)
    n_today = min(n_today, len(usable))
    start = today_d.isocalendar()[1] * per_week + sum(per_week // len(days) + (1 if j < per_week % len(days) else 0)
                                                      for j in range(i))
    name, town, who = _company(cfg)
    out = []
    for k in range(n_today):
        c, phone = usable[(start + k) % len(usable)]
        fill = {"en": {"caller": who["en"] or "[name]", "company": name, "town": f" in {town}" if town else ""},
                "es": {"caller": who["es"] or "[nombre]", "company": name, "town": f" en {town}" if town else ""}}
        op = {lang: (c.get(f"opener_{lang}") or "").replace("{caller}", fill[lang]["caller"])
              .replace("{company}", fill[lang]["company"]).replace("{town}", fill[lang]["town"]) for lang in ("en", "es")}
        out.append({"kind": "association", "name": c.get("name") or "", "phone": phone,
                    "ask_for": c.get("ask_for") or "", "address": "", "city": c.get("city") or "",
                    "hail_in": None, "day": None, "days_ago": None, "score": None,
                    "why": {"en": c.get("why_en") or "", "es": c.get("why_es") or ""}, "opener": op,
                    "key": f"association|{c.get('name') or ''}", "type": "Landlord/HOA association",
                    "confidence": c.get("confidence"), "also": []})
    return out


# ------------------------------------------------------------------ round 54: your accounts hit (accounts.py)
ACCOUNTS_TITLE = {"en": "Your accounts hit", "es": "Sus cuentas afectadas"}
ACCOUNT_LABEL = {"lead": ("Your lead", "Su prospecto"), "claim": ("Your customer", "Su cliente"),
                 "door": ("Your door (Interested/Booked)", "Su puerta (Interesado/Agendado)"),
                 "commercial": ("Your business contact", "Su contacto de negocio")}


def _ago(n, lang):
    if lang == "es":
        return "hoy" if n == 0 else "ayer" if n == 1 else f"hace {n} días"
    return "today" if n == 0 else "yesterday" if n == 1 else f"{n} days ago"


def _account_why(al, n_more=0):
    """{en, es}: whose account, what hit it, when, how sure (at the address, or how far away)."""
    lab_en, lab_es = ACCOUNT_LABEL.get(al["kind"], ACCOUNT_LABEL["lead"])
    d = date.fromisoformat(al["event_date"])
    d_en, d_es = f"{d:%b} {d.day}, {d.year}", f"{d.day} de {MONTHS_ES[d.month - 1]} de {d.year}"
    n, dist = al["days_ago"], al["distance_mi"]
    if al["peril"] == "wind":
        mph = al.get("max_wind_mph")
        en = (f"wind gusts to {mph:.0f} mph" if mph else "wind damage") + f" reported {dist:.1f} mi away"
        es = (f"ráfagas de viento de {mph:.0f} mph" if mph else "daños por viento") + \
            f" reportad{'as' if mph else 'os'} a {dist:.1f} mi"
    elif al["match"] == "at":
        en, es = f'{al["max_hail_in"]:.2f}" hail at the address', f'granizo de {al["max_hail_in"]:.2f}" en la dirección'
    else:
        en, es = f'{al["max_hail_in"]:.2f}" hail {dist:.1f} mi away', f'granizo de {al["max_hail_in"]:.2f}" a {dist:.1f} mi'
    en += f" on {d_en} ({_ago(n, 'en')})"
    es += f" el {d_es} ({_ago(n, 'es')})"
    if al["peril"] == "hail" and al["match"] == "near":
        en += "; no reading at the address itself"
        es += "; no hay lectura en la dirección misma"
    if n_more:
        en += f"; {n_more} more of their buildings hit"
        es += f"; {n_more} edificio(s) más suyos afectados"
    return {"en": f"{lab_en}: {en}.", "es": f"{lab_es}: {es}."}


def account_opener(al, cfg=None):
    """{en, es}: one sentence for calling your own account after new hail/wind: a free roof and siding check. Homes:
    to the homeowner who already knows HMP; businesses: the building-call opener. Never insurance, claims,
    deductibles or who pays."""
    if al["kind"] == "commercial":
        name = (al.get("name") or "").strip()
        prop = name if name and len(name) <= 40 and not re.search(r"[:(]", name) else f"the property at {al['address']}"
        op = opener(prop, al["event_date"], cfg, al["peril"])
        if prop != name:
            op["es"] = opener(f"la propiedad en {al['address']}", al["event_date"], cfg, al["peril"])["es"]
        return op
    name, _, who = _company(cfg)
    en_me = f"this is {who['en']} with {name}" if who["en"] else f"this is {name}"
    es_me = f"habla {who['es']} de {name}" if who["es"] else f"le llamamos de {name}"
    day = al["event_date"]
    en_what = "strong wind" if al["peril"] == "wind" else "hail"
    es_what = "hubo vientos fuertes" if al["peril"] == "wind" else "cayó granizo"
    return {"en": f"Hi, {en_me}: {en_what} hit your area on {_short_day(day, 'en')}, so can I come by this week "
                  f"for a free roof and siding check?",
            "es": f"Hola, {es_me}: el {_short_day(day, 'es')} {es_what} en su zona; ¿puedo pasar esta semana a "
                  f"revisar gratis su techo y revestimiento (siding)?"}


def account_rows(check_doc, today, cfg=None, calls=None):
    """`accounts_hit` rows for calls/today (the block shown FIRST), from accounts.check(): each alert plus the call
    card fields {rank, name, phone, ask_for, hail_in, day, days_ago, why{en,es}, opener{en,es}, also[]}. Homes
    (lead, claim, door): name = the address (never a person), phone "" (the app has its own lead record, `key`).
    Businesses: one row per business line (its best building leads, the rest in `also`); when that line is already a
    building call in `calls`, the row gets `call_rank` and the call gets `account_hit: true` (additive)."""
    acfg = {**DEFAULTS["accounts"], **((cfg or {}).get("accounts") or {})}
    rows, by_line = [], {}
    for al in (check_doc or {}).get("alerts") or []:
        line = _digits(al.get("phone")) if al["kind"] == "commercial" else ""
        if line and line in by_line:
            by_line[line]["also"].append({"address": al["address"], "city": al["city"], "key": al["key"],
                                          "hail_in": al["max_hail_in"], "day": al["event_date"]})
            continue
        biz = al["kind"] == "commercial"      # homes: never a person's name or phone here
        row = {**al, "name": (al.get("name") or al["address"]) if biz else al["address"],
               "phone": (al.get("phone") or "") if biz else "", "ask_for": (al.get("ask_for") or "") if biz else "",
               "hail_in": al["max_hail_in"], "day": al["event_date"], "opener": account_opener(al, cfg),
               "also": [], "call_rank": None}
        if line:
            by_line[line] = row
        rows.append(row)
    rows = rows[:int(acfg.get("max_rows") or 25)]
    lines = {_digits(r["phone"]): r for r in rows if r["kind"] == "commercial" and r["phone"]}
    for c in calls or []:
        r = lines.get(_digits(c.get("phone"))) if c.get("kind") == "building" else None
        if r is not None:
            c["account_hit"] = True
            r["call_rank"] = r["call_rank"] or c.get("rank")
    for i, r in enumerate(rows, 1):
        r["rank"] = i
        r["why"] = _account_why(r, len(r["also"]))
    return rows


def today_doc(hud, today, cfg=None, associations=None, accounts=None):
    """The `calls/today` doc: {date, accounts_title, accounts_count, accounts_checked, accounts_hit[], count, calls[],
    rules{en,es}, hud_generated_utc, none_reason?}.
    `accounts_hit` (round 54, shown FIRST): your own accounts (leads, claims, Interested/Booked doors, scout
    businesses) under new hail/wind, from `accounts` = accounts.check()'s doc (None = not checked: [] and
    accounts_checked null). Then storm building calls (kind "building"), then any landlord/HOA association calls for
    today (kind "association", T149). `associations` = contact list (None = read paths.association_contacts).
    `none_reason` means no BUILDING in fresh hail today (association calls may still be on the list)."""
    buildings = call_list(hud, today, cfg)
    for c in buildings:
        c["kind"] = "building"
    calls = buildings + association_calls(today, cfg, associations)
    for i, c in enumerate(calls, 1):
        c["rank"] = i
    hit = account_rows(accounts, today, cfg, calls)
    doc = {"date": today, "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "hud_generated_utc": (hud or {}).get("generated_utc"),
           "accounts_title": ACCOUNTS_TITLE, "accounts_count": len(hit),
           "accounts_checked": accounts.get("checked") if accounts else None, "accounts_hit": hit,
           "count": len(calls), "calls": calls, "rules": RULES}
    if not buildings:
        doc["none_reason"] = {
            "en": "No apartment or commercial building with a known business line is in recent 1\"+ hail. "
                  "Knock today's walk instead.",
            "es": "Ningún edificio de apartamentos o comercial con línea de negocio conocida tiene granizo reciente de "
                  "1\" o más. Hoy toquen puertas en la caminata del día."}
    return doc


def write_csv(path, calls):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(CSV_COLS)
        for c in calls:
            w.writerow([c.get("rank"), c.get("kind") or "building", c["name"], c["phone"], c["ask_for"], c["address"],
                        c["city"], "" if c["hail_in"] is None else c["hail_in"], c["day"] or "",
                        "" if c["days_ago"] is None else c["days_ago"], c.get("confidence") or "", c["why"]["en"], c["why"]["es"],
                        c["opener"]["en"], c["opener"]["es"]])
    return path
