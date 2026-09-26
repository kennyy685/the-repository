"""Today's business call list (`hh.py calltoday`): apartment and commercial buildings in the freshest,
strongest hail that have a known BUSINESS line (data/scout_contacts.json, carried in hud.json `targets[].contact`).

JSON for the HMP App's future `calls/today` doc (and an optional CSV). Reads hud.json only, no database.

Rules built in (Nebraska / HMP): business lines only (leasing offices, property managers, company lines, never
homes); the opener offers a free roof and siding inspection after the hail date and says nothing about
insurance, claims, deductibles or who pays.
"""
import csv
import re
from datetime import date, datetime, timezone

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
CSV_COLS = ["rank", "name", "phone", "ask_for", "address", "city", "hail_in", "day", "days_ago", "confidence",
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


def opener(prop, day, cfg):
    """{en, es}: one sentence offering a free roof and siding inspection after the hail date. No insurance talk."""
    name, town, who = _company(cfg)
    en_me = f"this is {who['en']} with {name}" if who["en"] else f"this is {name}"
    es_me = f"habla {who['es']} de {name}" if who["es"] else f"le llamamos de {name}"
    en_town, es_town = (f" in {town}", f" en {town}") if town else ("", "")
    return {"en": f"Hi, {en_me}{en_town}: we're offering a free roof and siding inspection for {prop} after the "
                  f"{_short_day(day, 'en')} hail, so who would be the right person to set that up with?",
            "es": f"Hola, {es_me}{es_town}: ofrecemos una inspección gratis del techo y el revestimiento (siding) de "
                  f"{prop} después del granizo del {_short_day(day, 'es')}; ¿con quién la puedo coordinar?"}


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


def today_doc(hud, today, cfg=None):
    """The `calls/today` doc: {date, calls[], count, rules{en,es}, hud_generated_utc, none_reason?}."""
    calls = call_list(hud, today, cfg)
    for i, c in enumerate(calls, 1):
        c["rank"] = i
    doc = {"date": today, "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "hud_generated_utc": (hud or {}).get("generated_utc"), "count": len(calls), "calls": calls, "rules": RULES}
    if not calls:
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
            w.writerow([c.get("rank"), c["name"], c["phone"], c["ask_for"], c["address"], c["city"], c["hail_in"],
                        c["day"], c["days_ago"], c.get("confidence") or "", c["why"]["en"], c["why"]["es"],
                        c["opener"]["en"], c["opener"]["es"]])
    return path
