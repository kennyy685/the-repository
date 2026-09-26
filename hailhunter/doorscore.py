"""Door score v2 (research round 16): how good one house is to knock, 0-100, with one plain line why {en, es}.

door = 100 x hail x owner_fit x kind x roof_age x value x sold_after_storm   (weights: config `door_score`)
- hail: storm walks only, the hail at the house through `hail_curve` (everyday walks: 1.0).
- owner_fit ("likely insured" in round 16, NEVER shown with that word): renter_base + (1 - renter_base) x owner x
  (no_sale + (1 - no_sale) x recent), where owner = the house's own owner-occupied flag when the data has one
  (hud stop `owner_occ` True/False + `owner_source`, T23: set by owners.py where a county publishes the owner's
  mailing address - Sarpy so far), else the walk's neighborhood owner share, else `owner_unknown`; recent = 1 when the
  last sale (parcel Sales_Date) is within `recent_sale_years` (a recent buyer most likely has a mortgage, and the
  lender requires coverage), else 0. Owner + recent buy = 1.0, owner + old sale = 0.7, renter = 0.4 (defaults).
  Vacant lots never reach a walk (parcels.classify keeps improved parcels only).
- kind: single-family 1.0; others from `kind_factor`.
- roof_age: years since built (roof_year when known) through `age_curve`; unknown = `age_unknown`.
- value: assessed value band through `value_curve`; unknown = `value_unknown`.
- sold_after_storm: storm walks, the house changed hands after the storm day (the new owner may not have a claim).
Returns {score, parts{...}, why{en, es}}. The why line is an estimate in plain words ("likely owner-occupied,
bought 2021"): no insurance claims, no promises.
T23: per-house owner-occupied comes from owners.py (county owner mailing address vs the house address); parts
`owner_basis` says which was used (house | area | unknown) and `owner_source` names the county source.
"""
from datetime import date

from .config import DEFAULTS
from .geo import interp


def _cfg(cfg):
    return {**DEFAULTS["door_score"], **((cfg or {}).get("door_score") or {})}


def _year(v):
    try:
        y = int(str(v)[:4])
    except (TypeError, ValueError):
        return None
    return y if 1800 <= y <= 2100 else None


def score(s, kind, owner_share=None, storm_day=None, today=None, cfg=None):
    """Door score v2 for one hud.json stop `s` on a `kind` (storm|everyday) walk; `owner_share` = the walk's
    neighborhood owner-occupied share (0-1) or None."""
    ds = _cfg(cfg)
    today = today or date.today()
    today = date.fromisoformat(today) if isinstance(today, str) else today
    parts, en, es = {}, [], []
    # hail at the house
    h = s.get("hail")
    if kind == "storm":
        parts["hail"] = round(interp(ds["hail_curve"], float(h)), 3) if h is not None else ds["hail_unknown"]
        if h is not None:
            en.append(f'{float(h):.1f}" hail')
            es.append(f"granizo de {float(h):.1f} pulg.")
    else:
        parts["hail"] = 1.0
    # roof age
    built = _year(s.get("built", s.get("year_built")))
    roof = _year(s.get("roof_year")) or built
    if roof:
        parts["roof_age"] = round(interp(ds["age_curve"], max(today.year - roof, 0)), 3)
        en.append(f"built {built}" if built and roof == built else f"roof {roof}")
        es.append(f"construida en {built}" if built and roof == built else f"techo de {roof}")
    else:
        parts["roof_age"] = ds["age_unknown"]
    # owner fit (round 16's "likely insured", never called that on screen)
    occ = s.get("owner_occ")
    if occ is None:
        occ = s.get("owner_occupied")
    if occ is True or occ is False:
        owner, basis = (1.0 if occ else 0.0), "house"
    elif owner_share is not None:
        owner, basis = float(owner_share), "area"
    else:
        owner, basis = ds["owner_unknown"], "unknown"
    sale = str(s.get("sale_date") or "")[:10] or None
    sale_y = _year(sale)
    recent = bool(sale_y and (today.year - sale_y) < ds["recent_sale_years"] and sale <= today.isoformat())
    rb, ns = ds["renter_base"], ds["no_sale"]
    fit = rb + (1 - rb) * owner * (ns + (1 - ns) * (1.0 if recent else 0.0))
    parts.update({"owner_fit": round(fit, 3), "owner": round(owner, 3), "owner_basis": basis, "recent_sale": recent})
    if basis == "house" and s.get("owner_source"):
        parts["owner_source"] = s["owner_source"]
    if basis == "house":
        en.append("owner lives here" if occ else "likely a rental")
        es.append("vive el dueño" if occ else "probablemente rentada")
    elif basis == "area" and owner >= 0.5:
        en.append(f"likely owner-occupied (area {round(owner * 100)}% owners)")
        es.append(f"probablemente vive el dueño ({round(owner * 100)}% dueños en la zona)")
    elif basis == "area":
        en.append(f"many renters here (area {round(owner * 100)}% owners)")
        es.append(f"muchos inquilinos ({round(owner * 100)}% dueños en la zona)")
    sold_after = bool(kind == "storm" and s.get("sold_after_storm"))
    if sale_y and not sold_after and (recent or kind == "everyday"):
        en.append(f"bought {sale_y}")
        es.append(f"comprada en {sale_y}")
    # kind, value, sold after the storm
    k = s.get("kind") or "single"
    parts["kind"] = ds["kind_factor"].get(k, ds["kind_factor"].get("other", 0.5))
    if k != "single":
        en.append({"multi": "multi-family", "mobile": "mobile home"}.get(k, k))
        es.append({"multi": "multifamiliar", "mobile": "casa móvil"}.get(k, k))
    try:
        v = float(s.get("value") or s.get("total_value") or 0)
    except (TypeError, ValueError):
        v = 0
    parts["value"] = round(interp(ds["value_curve"], v), 3) if v > 0 else ds["value_unknown"]
    parts["sold_after_storm"] = ds["sold_after_storm"] if sold_after else 1.0
    if sold_after:
        en.append(f"sold after the storm ({sale_y})" if sale_y else "sold after the storm")
        es.append(f"vendida después de la tormenta ({sale_y})" if sale_y else "vendida después de la tormenta")
    total = 100.0
    for key in ("hail", "owner_fit", "kind", "roof_age", "value", "sold_after_storm"):
        total *= parts[key]
    return {"score": round(total, 1), "parts": parts,
            "why": {"en": _cap(", ".join(en)) if en else "No house details on file",
                    "es": _cap(", ".join(es)) if es else "Sin datos de la casa"}}


def _cap(t):
    return t[:1].upper() + t[1:]
