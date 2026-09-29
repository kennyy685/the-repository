"""Rental hot list (`hh.py rentals`, research rounds 34/38): likely-rental single-family and small (2-4 unit)
multi-family properties inside the current hail hot zones, and separately the old-house everyday zones - for
pitching landlord associations / property managers by business line, and for knocking (ask for the landlord or
property manager). NOT for mailing (CLAUDE.md D1: no mailers).

Reads hud.json only (the storm `lists` and old-house `everyday_lists`), same as `hh.py calltoday`/`zones`: no
database needed except to resolve a --near town name. Two kinds of likely rental are in scope; bigger apartment/
commercial buildings stay the commercial.py / calltoday.py track:
- single-family (`kind` "single") whose county mailing address (owners.py, T23) is somewhere else (`owner_occ` is
  False): a rental house. Owner-occupied (True) or unknown (None - most counties; Dodge/Fremont's own county isn't
  wired yet, see owners.py) never counts, since "elsewhere" is the only evidence there is.
- small multi-family (`kind` "multi", duplex to fourplex): the statewide parcel layer has no unit count, so
  `units_est` is only ever a rough guess from the building's square footage (`rentals.avg_unit_sqft`); a building
  that estimates above `rentals.max_units` is left out (too big for this list).

PRIVACY (CLAUDE.md / owners.py): owner NAMES and MAILING ADDRESSES are never read, stored or exported here - only
the True/False/None `owner_occ` flag already computed by owners.py/hud.py from data compared in memory and dropped.
This module never touches the owner_occ cache table or owner mailing fields directly.

Grouped the same way `hh.py zones` groups a hot zone: one walk/turf = one "zone" (id "<list_id>~t<turf>"), named the
same way (`zones._name`), ranked by the turf's own Hot Zones heat, nearest `top` first within `near`. Storm zones
only count while the storm is fresh (`todaywalk.storm_max_days`); everyday zones have no age limit.

Output:
- `rental_hotlist(lists, everyday_lists, today, cfg)`: hud.json's additive field - a flat list, every likely-rental
  property on hud.json's own lists/everyday_lists (no near/radius/top filter; the app/CLI apply that):
  [{address, city, zone_id, hail_in, storm_day, units_est, year_built, why{en,es}}]
- `hotlist(hud, today, near, top, cfg, conn)`: the richer `rentals/current` app doc (also `hh.py rentals`'s JSON):
  {date, generated_utc, hud_generated_utc, near, radius_mi, count, zones:[{zone_id,name,kind,count}], rentals:[...],
  rules{en,es}, none_reason?}. Each rental here also carries `zone_name`, `zone_kind` (storm|everyday) and `kind`
  (single|multi) beyond the hud.json field's minimum shape.
"""
import csv
from datetime import date, datetime, timezone

from .config import DEFAULTS
from .geo import haversine_mi
from .todaywalk import storm_max_days
from .zones import _name as _zone_name
from .zones import resolve_near

MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
             "November", "December"]
MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
             "noviembre", "diciembre"]
UNIT_WORD_EN = {2: "duplex", 3: "triplex", 4: "fourplex"}
UNIT_WORD_ES = {2: "dúplex", 3: "tríplex", 4: "cuádruplex"}
FIELD_KEYS = ("address", "city", "zone_id", "hail_in", "storm_day", "units_est", "year_built", "why")
RULES = {"en": "Landlord/property manager pitch only, by business line or in person - never a mailer. No owner "
               "names or mailing addresses here; ask for the landlord or the property manager at the door or "
               "when you call.",
         "es": "Solo para hablar con el dueño o el administrador de la propiedad, por teléfono de negocio o en "
               "persona - nunca por correo. Aquí no hay nombres del dueño ni direcciones de correo; pregunten por "
               "el dueño o el administrador en la puerta o al llamar."}


def _rc(cfg):
    return {**DEFAULTS["rentals"], **((cfg or {}).get("rentals") or {})}


def units_estimate(kind, sqft, cfg=None):
    """Rough unit count for a `kind` "multi" building from its square footage (never exact: the statewide parcel
    layer has no unit count). `kind` "single" is always 1 (and out of scope for `candidate` unless it's a rental)."""
    rc = _rc(cfg)
    if kind != "multi":
        return 1
    if not sqft:
        return rc["default_units"]
    return max(rc["min_units"], round(sqft / rc["avg_unit_sqft"]))


def candidate(stop, cfg=None):
    """The stop's estimated unit count if it is a likely-rental candidate in scope, else None. See the module doc
    for the two kinds; only ever reads `kind`, `owner_occ` (True/False/None) and `sqft` - never an owner name or
    mailing address."""
    rc = _rc(cfg)
    kind = stop.get("kind")
    if kind == "single":
        return 1 if stop.get("owner_occ") is False else None
    if kind == "multi":
        units = units_estimate(kind, stop.get("sqft"), cfg)
        return units if units <= rc["max_units"] else None
    return None


def _why(kind, units, hail, storm_day, built):
    if kind == "multi":
        name_en = UNIT_WORD_EN.get(units, f"{units}-unit building")
        name_es = UNIT_WORD_ES.get(units, f"edificio de {units} unidades")
        type_en, type_es = (f"Likely {name_en} (units estimated by building size)",
                            f"Probable {name_es} (unidades estimadas por el tamaño del edificio)")
    else:
        type_en = "Likely rental single-family home (owner's mail goes to another address)"
        type_es = "Probable casa unifamiliar rentada (el correo del dueño va a otra dirección)"
    if hail is not None and storm_day:
        d = date.fromisoformat(storm_day)
        ev_en = f'{hail:.2f}" hail on {MONTHS_EN[d.month - 1]} {d.day}'
        ev_es = f'granizo de {hail:.2f}" el {d.day} de {MONTHS_ES[d.month - 1]}'
    elif built:
        ev_en, ev_es = f"built {built}, an older-home area", f"construida en {built}, zona de casas antiguas"
    else:
        ev_en, ev_es = "an older-home area", "zona de casas antiguas"
    return {"en": f"{type_en}, {ev_en}. Ask for the landlord or property manager.",
            "es": f"{type_es}, {ev_es}. Pregunten por el dueño o el administrador de la propiedad."}


def _zone_rows(lists, kind, today, cfg):
    """One row per turf that has at least one rental candidate: {zone_id, name, kind, lat, lon, heat, rentals[]}.
    `rentals[]` entries carry zone_name/zone_kind/kind too (trimmed to the hud.json shape by `rental_hotlist`)."""
    out = []
    for L in lists or []:
        if kind == "storm":
            try:
                age = (today - date.fromisoformat(L["day"])).days
            except (KeyError, TypeError, ValueError):
                continue
            if not 0 <= age <= storm_max_days(today, cfg):
                continue
        by_turf = {}
        for s in L.get("stops") or []:
            by_turf.setdefault(s.get("turf"), []).append(s)
        for t in L.get("turfs") or []:
            turf_stops = by_turf.get(t["turf"]) or []
            if not turf_stops:
                continue
            zone_id = f"{L['id']}~t{t['turf']}"
            name = _zone_name(turf_stops, L)
            storm_day = L.get("day") if kind == "storm" else None
            rentals = []
            for s in turf_stops:
                units = candidate(s, cfg)
                if units is None or s.get("lat") is None or s.get("lon") is None:
                    continue
                hail = round(s["hail"], 2) if kind == "storm" and s.get("hail") is not None else None
                rentals.append({
                    "address": s["address"], "city": s.get("city") or "", "zone_id": zone_id, "zone_name": name,
                    "zone_kind": kind, "kind": s.get("kind"), "hail_in": hail, "storm_day": storm_day,
                    "units_est": units, "year_built": s.get("built"),
                    "why": _why(s.get("kind"), units, s.get("hail"), storm_day, s.get("built"))})
            if not rentals:
                continue
            lat = sum(s["lat"] for s in turf_stops if s.get("lat") is not None) / len(turf_stops)
            lon = sum(s["lon"] for s in turf_stops if s.get("lon") is not None) / len(turf_stops)
            heat = t.get("heat") if t.get("heat") is not None else L.get("heat")
            out.append({"zone_id": zone_id, "name": name, "kind": kind, "lat": lat, "lon": lon,
                        "heat": heat or 0, "rentals": rentals})
    return out


def rental_hotlist(lists, everyday_lists, today, cfg=None):
    """hud.json's additive `rental_hotlist` field: every likely-rental property already on hud.json's own storm
    (fresh only) and everyday lists, flat, grouped by zone (rows for the same zone stay together), capped at
    `rentals.max_rows`. No near/radius/top filter - `hh.py rentals` / the `rentals/current` app doc do that."""
    today_d = date.fromisoformat(today) if isinstance(today, str) else today
    rows = _zone_rows(lists, "storm", today_d, cfg) + _zone_rows(everyday_lists, "everyday", today_d, cfg)
    out = [{k: r[k] for k in FIELD_KEYS} for z in rows for r in z["rentals"]]
    return out[:_rc(cfg)["max_rows"]]


def hotlist(hud, today, near=None, top=None, cfg=None, conn=None):
    """The `rentals/current` doc (also `hh.py rentals`'s JSON): {date, generated_utc, hud_generated_utc, near,
    radius_mi, count, zones:[{zone_id,name,kind,count}], rentals:[...], rules{en,es}, none_reason?}."""
    hud = hud or {}
    rc = _rc(cfg)
    today_d = date.fromisoformat(today) if isinstance(today, str) else today
    near = near or resolve_near(None, cfg, conn) or DEFAULTS["home"]
    radius = float(rc["radius_mi"])
    top = int(top or rc["top"])
    rows = _zone_rows(hud.get("lists"), "storm", today_d, cfg) + \
        _zone_rows(hud.get("everyday_lists"), "everyday", today_d, cfg)
    kept = []
    for z in rows:
        dist = haversine_mi(near["lat"], near["lon"], z["lat"], z["lon"])
        if dist <= radius:
            z["dist_mi"] = round(dist, 1)
            kept.append(z)
    kept.sort(key=lambda z: (-z["heat"], z["dist_mi"], z["zone_id"]))
    kept = kept[:top]
    rentals = [r for z in kept for r in z["rentals"]]
    doc = {"date": today_d.isoformat(), "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "hud_generated_utc": hud.get("generated_utc"), "near": near, "radius_mi": radius, "count": len(rentals),
           "zones": [{"zone_id": z["zone_id"], "name": z["name"], "kind": z["kind"], "count": len(z["rentals"])}
                    for z in kept],
           "rentals": rentals, "rules": RULES}
    if not rentals:
        doc["none_reason"] = {
            "en": f"No likely-rental single-family or 2-4 unit properties found within {radius:g} miles of "
                  f"{near['name']} yet (needs owner mailing-address data from Sarpy, Douglas or Lancaster county, "
                  f"or a small multi-family parcel, in a current hot zone).",
            "es": f"Todavía no hay propiedades de renta unifamiliares o de 2 a 4 unidades a menos de {radius:g} "
                  f"millas de {near['name']} (se necesitan datos de la dirección de correo del dueño de los "
                  f"condados Sarpy, Douglas o Lancaster, o una propiedad multifamiliar pequeña, en una zona activa)."}
    return doc


CSV_COLS = ["zone_id", "zone_name", "zone_kind", "address", "city", "kind", "units_est", "year_built", "hail_in",
            "storm_day", "why_en", "why_es"]


def write_csv(path, rentals):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(CSV_COLS)
        for r in rentals:
            w.writerow([r.get("zone_id"), r.get("zone_name") or "", r.get("zone_kind") or "", r["address"],
                        r.get("city") or "", r.get("kind") or "", r.get("units_est"), r.get("year_built") or "",
                        "" if r.get("hail_in") is None else r["hail_in"], r.get("storm_day") or "",
                        r["why"]["en"], r["why"]["es"]])
    return path
