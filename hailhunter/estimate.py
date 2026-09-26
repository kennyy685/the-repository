"""T52 quick estimate (`hh.py estimate --json job.json`): a price RANGE for a siding / roof / gutter job, in
English and Spanish, ready for the boss's price sheet (T51).

HMP's own prices live in config `prices` ({low, high} per item, null until the boss sets them). Any item still
null falls back to config `prices_reference` (MARKET REFERENCE, NOT HMP's prices, from
docs/research/2026-09-26-market-prices.md) and the result says so: `using_reference: true` + a warning.

job = {type: siding|roof|gutters|mixed, siding_squares, roof_squares, gutter_ft, soffit_ft,
       material: vinyl|hardie (siding; roofs are architectural shingle), pitch: low|std|steep or a number
       (rise per 12, e.g. 7 or "7/12"), stories: 1-3, layers: old layers to tear off (1 = normal),
       house_wrap: true (siding default), permit: true (default),
       footprint_sqft: optional, fills missing squares with the ROUGH helper below,
       O7 add-ons, each priced only when given (any job type): ice_water_sq (squares of ice & water shield, e.g.
       the eave coverage), ridge_vent_ft, chimney (true or a count), skylight_ft (flashing), windows (window wrap
       count), gutter_guards_ft, downspouts_ft; material insulated_vinyl for insulated vinyl siding}
- type picks the main item: siding uses siding_squares (+ house wrap), roof uses roof_squares, gutters uses
  gutter_ft; mixed uses everything given. soffit_ft / gutter_ft are added to any type when given.
- layers: extra old layers (layers - 1) are torn off the roof; on a siding-only job, off the walls.
- Add-on prices come from NATIONAL guides until HMP sets them (reference "scope": "national"): the result
  then carries a "national price guide" warning naming those items.
- Adders: steep pitch +15-25% on roof items (shingles, roof layer tear-off, ice & water, ridge vent, chimney and
  skylight flashing); 2 / 3 stories +15 / +35% on every installed item (not the permit).
- Minimum job: the total never goes below min_job (roof jobs: min_job_roof when set).

Result: {low, high, currency, using_reference, reference_items, warnings[{en,es}], lines[], adders, quantities,
rough_squares, summary{en,es}, insurance_note{en,es}}. The price text never mentions deductibles (Nebraska
44-8604) and never says insurance will pay; for insurance jobs the insurer's approved scope sets the price.
"""
import math
import re

from .config import DEFAULTS

TYPES = ("siding", "roof", "gutters", "mixed")
SIDING = {"vinyl": ("vinyl_siding_sq", "Vinyl siding", "Siding de vinil"),
          "hardie": ("hardie_siding_sq", "James Hardie siding", "Siding James Hardie"),
          "insulated_vinyl": ("insulated_vinyl_siding_sq", "Insulated vinyl siding", "Siding de vinil aislado")}
SIDING_WORDS = {"vinyl": ("vinyl", "de vinil"), "hardie": ("James Hardie", "James Hardie"),   # summary text
                "insulated_vinyl": ("insulated vinyl", "de vinil aislado")}
ITEM_NAMES = {
    "shingle_roof_sq": ("Architectural shingle roof (1-layer tear-off)", "Techo de teja arquitectónica (quitar 1 capa)"),
    "extra_layer_sq": ("Extra old layer tear-off", "Quitar capa vieja extra"),
    "soffit_fascia_ft": ("Soffit + fascia", "Sofito + fascia"),
    "gutters_ft": ("Seamless gutters", "Canaletas sin costura"),
    "house_wrap_sq": ("House wrap", "Envoltura de casa (house wrap)"),
    "permit": ("Permit", "Permiso"),
    "ice_water_sq": ("Ice & water shield", "Barrera de hielo y agua (ice & water)"),
    "ridge_vent_ft": ("Ridge vent", "Ventila de cumbrera"),
    "chimney_flashing_job": ("Chimney flashing (per chimney)", "Tapajuntas de chimenea (por chimenea)"),
    "skylight_flashing_ft": ("Skylight flashing", "Tapajuntas de tragaluz"),
    "window_wrap_ea": ("Window wrap (aluminum)", "Forro de ventana (aluminio)"),
    "gutter_guards_ft": ("Gutter guards", "Protectores de canaleta"),
    "downspouts_ft": ("Downspouts", "Bajantes"),
}
# O7 optional add-ons: job field -> (price key, unit, roof item?, where the line goes). Order = line order.
ADDONS = [
    ("windows", "window_wrap_ea", "ea", False, "siding"),
    ("ice_water_sq", "ice_water_sq", "sq", True, "roof"),
    ("ridge_vent_ft", "ridge_vent_ft", "ft", True, "roof"),
    ("chimney", "chimney_flashing_job", "job", True, "roof"),
    ("skylight_ft", "skylight_flashing_ft", "ft", True, "roof"),
    ("gutter_guards_ft", "gutter_guards_ft", "ft", False, "gutters"),
    ("downspouts_ft", "downspouts_ft", "ft", False, "gutters"),
]
UNITS = {"sq": ("squares", "cuadros"), "ft": ("ft", "pies"), "job": ("job", "trabajo"), "ea": ("each", "c/u")}
ADDON_WORDS = {   # summary text per add-on field ({q} = amount, {s} = plural s)
    "windows": ("window wrap ({q} window{s})", "forro de ventanas ({q} ventana{s})"),
    "ice_water_sq": ("ice & water shield ({q} squares)", "barrera de hielo y agua ({q} cuadros)"),
    "ridge_vent_ft": ("ridge vent ({q} ft)", "ventila de cumbrera ({q} pies)"),
    "chimney": ("chimney flashing ({q} chimney{s})", "tapajuntas de chimenea ({q} chimenea{s})"),
    "skylight_ft": ("skylight flashing ({q} ft)", "tapajuntas de tragaluz ({q} pies)"),
    "gutter_guards_ft": ("gutter guards ({q} ft)", "protectores de canaleta ({q} pies)"),
    "downspouts_ft": ("downspouts ({q} ft)", "bajantes ({q} pies)"),
}
NATIONAL_WARNING = {"en": "National price guide (not Nebraska) for: {items}. Check with a local supplier.",
                    "es": "Guía de precios nacional (no de Nebraska) para: {items}. Confirmen con un proveedor local."}
INSURANCE_NOTE = {"en": "For insurance jobs: the insurer's approved scope sets the price.",
                  "es": "Para trabajos de seguro: el alcance aprobado por la aseguradora fija el precio."}
ROUGH_NOTE = {"en": "ROUGH squares from the footprint and stories. Measure the house before quoting.",
              "es": "Cuadros APROXIMADOS por el tamaño de la casa y los pisos. Midan la casa antes de dar precio."}
TYPE_NOTES = {   # a job type that ignores some quantities it was given says so
    "siding": {"en": "Siding job: roof squares left out (use type mixed for both).",
               "es": "Trabajo de siding: no se contó el techo (usen tipo mixed para los dos)."},
    "roof": {"en": "Roof job: siding squares left out (use type mixed for both).",
             "es": "Trabajo de techo: no se contó el siding (usen tipo mixed para los dos)."},
    "gutters": {"en": "Gutter job: siding and roof left out (use type mixed).",
                "es": "Trabajo de canaletas: no se contó siding ni techo (usen tipo mixed)."}}
# {for_items} is "" when every priced item is market reference, else REF_FOR_ITEMS with the item keys.
REF_WARNING = {"en": ("Using MARKET REFERENCE prices, not HMP's prices{for_items}. The boss hasn't set HMP's price "
                      "sheet yet (T51). OK to share as an estimate range, never as a final price."),
               "es": ("Usando precios de REFERENCIA del mercado, no los precios de HMP{for_items}. El jefe todavía no "
                      "pone la lista de precios de HMP (T51). Se puede dar como rango estimado, nunca como precio final.")}
REF_FOR_ITEMS = {"en": " for: {items}", "es": " para: {items}"}
MIN_NAMES = {"min_job": ("Minimum job", "Trabajo mínimo"), "min_job_roof": ("Minimum roof job", "Trabajo mínimo de techo")}
ROUND_TO = 50           # totals round out to the nearest $50 (low down, high up)
RULES_VERSION = 2       # 2 = O7 add-ons + insulated vinyl; bump when export_rules() changes shape (the HMP App's estimate.js checks it)


def _cfg(cfg):
    return cfg if cfg is not None else DEFAULTS


def _num(v, name, default=0.0):
    if v is None or v == "":
        return default
    try:
        x = float(v)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a number, got {v!r}")
    if x < 0 or math.isnan(x):
        raise ValueError(f"{name} can't be negative")
    return x


def pitch_class(pitch, cfg=None):
    """'low' | 'std' | 'steep' from a word or a rise-per-12 number ('7', 7, '7/12', '7:12')."""
    e = _cfg(cfg)["estimate"]
    if pitch is None or pitch == "":
        return "std"
    s = str(pitch).strip().lower()
    if s in ("low", "std", "standard", "normal", "steep"):
        return {"standard": "std", "normal": "std"}.get(s, s)
    m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*(?:[/:]\s*12)?", s)
    if not m:
        raise ValueError(f"pitch must be low, std, steep or a rise per 12 like 7/12, got {pitch!r}")
    rise = float(m.group(1))
    return "steep" if rise > e["steep_over"] else "low" if rise < e["low_under"] else "std"


def _stories(v):
    n = int(round(_num(v, "stories", 1)))
    if n < 1 or n > 3:
        raise ValueError("stories must be 1, 2 or 3")
    return n


def squares_from_footprint(footprint_sqft, stories=1, pitch="std", cfg=None):
    """ROUGH squares from a house's ground footprint (sq ft) and stories, for a first number before measuring:
    wall area = perimeter x height, minus ~15% openings (gables and dormers not counted);
    roof squares = footprint x pitch factor / 100 (overhangs not counted). A square = 100 sq ft."""
    e = _cfg(cfg)["estimate"]
    area = _num(footprint_sqft, "footprint_sqft")
    if area <= 0:
        raise ValueError("footprint_sqft must be more than 0")
    n, pc = _stories(stories), pitch_class(pitch, cfg)
    perimeter = 4 * math.sqrt(area) * e["perimeter_factor"]
    wall = perimeter * e["story_height_ft"] * n * (1 - e["openings"])
    return {"siding_squares": round(wall / 100, 1), "roof_squares": round(area * e["pitch_factor"][pc] / 100, 1),
            "perimeter_ft": round(perimeter), "wall_sqft": round(wall), "footprint_sqft": area, "stories": n,
            "pitch": pc, "rough": True, "note": dict(ROUGH_NOTE)}


def _rate(key, cfg):
    """(low, high, from_reference) for one price item; HMP's price first, market reference if null."""
    c = _cfg(cfg)
    own = (c.get("prices") or {}).get(key) or {}
    lo, hi = own.get("low"), own.get("high")
    if lo is not None or hi is not None:
        lo = hi if lo is None else lo
        hi = lo if hi is None else hi
        return float(min(lo, hi)), float(max(lo, hi)), False
    ref_table = c.get("prices_reference")
    if not ref_table:
        ref_table = DEFAULTS["prices_reference"]
    ref = ref_table.get(key) or {}
    lo, hi = ref.get("low"), ref.get("high")
    if lo is None and hi is None:
        return None, None, True
    lo = hi if lo is None else lo
    hi = lo if hi is None else hi
    return float(lo), float(hi), True


def _scope(key, cfg):
    """'national' when this item's price is the market reference AND that reference is a national guide."""
    c = _cfg(cfg)
    if not _rate(key, c)[2]:
        return None
    ref_table = c.get("prices_reference") or DEFAULTS["prices_reference"]
    return (ref_table.get(key) or {}).get("scope")


def _money(x):
    return f"${x:,.0f}"


def estimate(job, cfg=None):
    """Quick price range for one job (see the module docstring). Raises ValueError on a bad job."""
    c = _cfg(cfg)
    e = c["estimate"]
    if not isinstance(job, dict):
        raise ValueError("job must be a JSON object")
    jtype = str(job.get("type") or "").strip().lower()
    if jtype not in TYPES:
        raise ValueError(f"type must be one of {', '.join(TYPES)}, got {job.get('type')!r}")
    material = str(job.get("material") or "vinyl").strip().lower()
    if material in ("hardie", "james hardie", "fiber cement", "fibercement"):
        material = "hardie"
    elif material in ("insulated vinyl", "insulated-vinyl", "insulated"):
        material = "insulated_vinyl"
    elif material in ("shingle", "architectural", "architectural shingle"):
        material = "vinyl"                       # a roof material names no siding: siding (if any) stays vinyl
    if material not in SIDING:
        raise ValueError(f"material must be vinyl, insulated_vinyl or hardie (roofs are architectural shingle), got {job.get('material')!r}")
    pc, n = pitch_class(job.get("pitch"), c), _stories(job.get("stories"))
    layers = int(round(_num(job.get("layers"), "layers", 1))) or 1
    siding = _num(job.get("siding_squares"), "siding_squares")
    roof = _num(job.get("roof_squares"), "roof_squares")
    gutter = _num(job.get("gutter_ft"), "gutter_ft")
    soffit = _num(job.get("soffit_ft"), "soffit_ft")
    addons = {f: _num(job.get(f), f) for f, *_ in ADDONS}   # chimney: true counts as 1
    warnings, rough = [], None

    if job.get("footprint_sqft") and ((jtype in ("siding", "mixed") and not siding)
                                      or (jtype in ("roof", "mixed") and not roof)):
        rough = squares_from_footprint(job["footprint_sqft"], n, pc, c)
        if jtype in ("siding", "mixed") and not siding:
            siding = rough["siding_squares"]
        if jtype in ("roof", "mixed") and not roof:
            roof = rough["roof_squares"]
        warnings.append(dict(ROUGH_NOTE))
    if jtype == "siding" and roof:
        roof = 0.0
        warnings.append(dict(TYPE_NOTES["siding"]))
    if jtype == "roof" and siding:
        siding = 0.0
        warnings.append(dict(TYPE_NOTES["roof"]))
    if jtype == "gutters" and (siding or roof):
        siding = roof = 0.0
        warnings.append(dict(TYPE_NOTES["gutters"]))
    need = {"siding": siding, "roof": roof, "gutters": gutter, "mixed": siding or roof or gutter or soffit or any(addons.values())}[jtype]
    if not need:
        what = {"siding": "siding_squares (or footprint_sqft)", "roof": "roof_squares (or footprint_sqft)",
                "gutters": "gutter_ft", "mixed": "at least one of siding_squares, roof_squares, gutter_ft, soffit_ft"}
        raise ValueError(f"a {jtype} job needs {what[jtype]}")

    story = e["story_adders"][str(n)]
    steep = e["pitch_adders"][pc]
    lines, ref_items = [], []

    def add(key, qty, unit, en, es, roof_item=False, scale=True):
        lo, hi, ref = _rate(key, c)
        if lo is None:
            raise ValueError(f"no price for {key} in prices or prices_reference")
        if ref:
            ref_items.append(key)
        a_lo = (story["low"] if scale else 0) + (steep["low"] if roof_item else 0)
        a_hi = (story["high"] if scale else 0) + (steep["high"] if roof_item else 0)
        lines.append({"key": key, "en": en, "es": es, "qty": round(qty, 1), "unit": unit,
                      "unit_en": UNITS[unit][0], "unit_es": UNITS[unit][1],
                      "rate": {"low": lo, "high": hi}, "adder": {"low": a_lo, "high": a_hi},
                      "low": round(qty * lo * (1 + a_lo)), "high": round(qty * hi * (1 + a_hi)),
                      "reference": ref})

    def add_ons(where):
        for field, key, unit, roof_item, group in ADDONS:
            if group == where and addons[field]:
                add(key, addons[field], unit, *ITEM_NAMES[key], roof_item=roof_item)

    extra = max(0, layers - 1)
    if siding:
        key, en, es = SIDING[material]
        add(key, siding, "sq", en, es)
        if job.get("house_wrap", True):
            add("house_wrap_sq", siding, "sq", *ITEM_NAMES["house_wrap_sq"])
        if extra and not roof:
            add("extra_layer_sq", siding * extra, "sq", f"{ITEM_NAMES['extra_layer_sq'][0]} (walls, x{extra})",
                f"{ITEM_NAMES['extra_layer_sq'][1]} (paredes, x{extra})")
    add_ons("siding")
    if roof:
        add("shingle_roof_sq", roof, "sq", *ITEM_NAMES["shingle_roof_sq"], roof_item=True)
        if extra:
            add("extra_layer_sq", roof * extra, "sq", f"{ITEM_NAMES['extra_layer_sq'][0]} (roof, x{extra})",
                f"{ITEM_NAMES['extra_layer_sq'][1]} (techo, x{extra})", roof_item=True)
    add_ons("roof")
    if soffit:
        add("soffit_fascia_ft", soffit, "ft", *ITEM_NAMES["soffit_fascia_ft"])
    if gutter:
        add("gutters_ft", gutter, "ft", *ITEM_NAMES["gutters_ft"])
    add_ons("gutters")
    if job.get("permit", True):
        add("permit", 1, "job", *ITEM_NAMES["permit"], scale=False)

    low, high = sum(ln["low"] for ln in lines), sum(ln["high"] for ln in lines)
    # Roof jobs use the roof minimum, unless HMP set a general minimum but no roof one (then HMP's wins).
    roof_min, any_min = _rate("min_job_roof", c), _rate("min_job", c)
    use_roof = roof and roof_min[0] is not None and (not roof_min[2] or any_min[2])
    min_key = "min_job_roof" if use_roof else "min_job"
    m_lo, m_hi, m_ref = roof_min if use_roof else any_min
    minimum = None
    if m_lo is not None and (low < m_lo or high < m_hi):
        minimum = {"key": min_key, "low": m_lo, "high": m_hi, "reference": m_ref}
        low, high = max(low, m_lo), max(high, m_hi)
        if m_ref:
            ref_items.append(min_key)
    low = int(math.floor(low / float(ROUND_TO)) * ROUND_TO)
    high = int(math.ceil(high / float(ROUND_TO)) * ROUND_TO)

    ref_items = sorted(set(ref_items))
    using_ref = bool(ref_items)
    if using_ref:
        all_ref = all(ln["reference"] for ln in lines)
        warnings.insert(0, {lang: REF_WARNING[lang].format(
            for_items="" if all_ref else REF_FOR_ITEMS[lang].format(items=", ".join(ref_items))) for lang in ("en", "es")})
    national = sorted({ln["key"] for ln in lines if ln["reference"] and _scope(ln["key"], c) == "national"})
    if national:
        warnings.insert(1, {lang: NATIONAL_WARNING[lang].format(items=", ".join(national)) for lang in ("en", "es")})

    parts_en, parts_es = [], []
    if siding:
        parts_en.append(f"{SIDING_WORDS[material][0]} siding ({siding:g} squares)")
        parts_es.append(f"siding {SIDING_WORDS[material][1]} ({siding:g} cuadros)")
    if roof:
        parts_en.append(f"shingle roof ({roof:g} squares)")
        parts_es.append(f"techo de teja ({roof:g} cuadros)")
    if soffit:
        parts_en.append(f"soffit + fascia ({soffit:g} ft)")
        parts_es.append(f"sofito + fascia ({soffit:g} pies)")
    if gutter:
        parts_en.append(f"gutters ({gutter:g} ft)")
        parts_es.append(f"canaletas ({gutter:g} pies)")
    for field, *_ in ADDONS:
        q = addons[field]
        if q:
            en, es = ADDON_WORDS[field]
            one = q == 1
            parts_en.append(en.format(q=f"{q:g}", s="" if one else "s"))
            parts_es.append(es.format(q=f"{q:g}", s="" if one else "s"))
    shape_en = [f"{n} stor{'y' if n == 1 else 'ies'}"]
    shape_es = [f"{n} piso{'' if n == 1 else 's'}"]
    if roof:
        shape_en.append({"low": "low pitch", "std": "standard pitch", "steep": "steep pitch"}[pc])
        shape_es.append({"low": "poca pendiente", "std": "pendiente normal", "steep": "pendiente alta"}[pc])
    if extra:
        shape_en.append(f"{layers} old layers")
        shape_es.append(f"{layers} capas viejas")
    lead_en = "Rough estimate with MARKET REFERENCE prices (not HMP's)" if using_ref else "Quick estimate"
    lead_es = "Estimado aproximado con precios de REFERENCIA del mercado (no de HMP)" if using_ref else "Estimado rápido"
    summary = {
        "en": (f"{lead_en}: {_money(low)} - {_money(high)} for {', '.join(parts_en)}; {', '.join(shape_en)}. "
               f"Final price after we measure and inspect. {INSURANCE_NOTE['en']}"),
        "es": (f"{lead_es}: {_money(low)} - {_money(high)} por {', '.join(parts_es)}; {', '.join(shape_es)}. "
               f"El precio final después de medir e inspeccionar. {INSURANCE_NOTE['es']}")}
    if minimum:
        summary["en"] += f" (Minimum job {_money(m_lo)} - {_money(m_hi)} applied.)"
        summary["es"] += f" (Se aplicó el trabajo mínimo {_money(m_lo)} - {_money(m_hi)}.)"

    return {"low": low, "high": high, "currency": "USD", "type": jtype,
            "using_reference": using_ref, "reference_items": ref_items,
            "reference_label": (c.get("prices_reference") or {}).get("_label") if using_ref else None,
            "warnings": warnings, "lines": lines, "minimum_applied": minimum,
            "adders": {"pitch": pc, "pitch_roof": steep, "stories": n, "stories_all": story, "layers": layers},
            "quantities": dict({"siding_squares": siding, "roof_squares": roof, "gutter_ft": gutter,
                                "soffit_ft": soffit, "material": material}, **addons),
            "rough_squares": rough, "summary": summary, "insurance_note": dict(INSURANCE_NOTE)}


# The 8 jobs `export_rules` runs through estimate() so the HMP App's JavaScript (docs/app/estimate.js) can check
# itself against the Python math. Covers every rule: materials, pitch, stories, layers, gutters, soffit, the
# minimum job and the rough footprint helper.
RULE_TEST_JOBS = [
    {"name": "siding vinyl", "job": {"type": "siding", "siding_squares": 22, "material": "vinyl"}},
    {"name": "siding hardie", "job": {"type": "siding", "siding_squares": 25.5, "material": "hardie", "stories": 2,
                                      "layers": 2, "soffit_ft": 90}},
    {"name": "roof std", "job": {"type": "roof", "roof_squares": 24, "pitch": "5/12"}},
    {"name": "roof steep 2-story", "job": {"type": "roof", "roof_squares": 31.3, "pitch": "8/12", "stories": 2,
                                           "layers": 2}},
    {"name": "gutters only", "job": {"type": "gutters", "gutter_ft": 140, "permit": False}},
    {"name": "mixed", "job": {"type": "mixed", "siding_squares": 18, "roof_squares": 20, "gutter_ft": 120,
                              "soffit_ft": 150, "material": "hardie", "pitch": "steep", "stories": 3}},
    {"name": "below minimum", "job": {"type": "gutters", "gutter_ft": 12, "permit": False}},
    {"name": "footprint only (rough)", "job": {"type": "mixed", "footprint_sqft": 1450, "stories": 2, "pitch": "7/12"}},
    # v2 (O7): add-ons + insulated vinyl
    {"name": "insulated vinyl + windows", "job": {"type": "siding", "siding_squares": 20, "material": "insulated_vinyl",
                                                  "windows": 14, "stories": 2}},
    {"name": "roof add-ons steep", "job": {"type": "roof", "roof_squares": 28, "pitch": "9/12", "ice_water_sq": 4.5,
                                           "ridge_vent_ft": 42, "chimney": True, "skylight_ft": 16}},
    {"name": "gutters + guards + downspouts", "job": {"type": "gutters", "gutter_ft": 150, "gutter_guards_ft": 150,
                                                      "downspouts_ft": 60, "permit": False}},
    {"name": "add-ons only (below minimum)", "job": {"type": "mixed", "windows": 1, "permit": False}},
]


def export_rules(cfg=None, now=None):
    """The pricing rules as ONE JSON doc for the HMP App (db path `system/prices`), so the app's JavaScript quick
    estimate matches `hh.py estimate` exactly. Prices are already resolved (HMP's where set, else market reference,
    tagged `source`); `test_cases` are real estimate() results the page checks itself against."""
    from datetime import datetime, timezone
    c = _cfg(cfg)
    e = c["estimate"]
    names = {SIDING[m][0]: SIDING[m][1:] for m in SIDING}
    names.update(ITEM_NAMES)
    names.update(MIN_NAMES)
    units = {k: ("job" if k in ("permit", "min_job", "min_job_roof") or k.endswith("_job") else
                 "ft" if k.endswith("_ft") else "ea" if k.endswith("_ea") else "sq") for k in names}
    prices, ref_items = {}, []
    for key in names:
        lo, hi, ref = _rate(key, c)
        if lo is None:                            # no price anywhere: left out (estimate() can't use it either)
            continue
        if ref:
            ref_items.append(key)
        prices[key] = {"low": lo, "high": hi, "unit": units[key], "en": names[key][0], "es": names[key][1],
                       "source": "market" if ref else "hmp"}
        if _scope(key, c):                        # v2: "national" = a national guide, not a Nebraska number
            prices[key]["scope"] = _scope(key, c)

    def minimum(key):
        p = prices.get(key)
        return {"low": p["low"], "high": p["high"], "source": p["source"]} if p else None

    cases = []
    for t in RULE_TEST_JOBS:
        r = estimate(t["job"], c)
        cases.append({"name": t["name"], "job": t["job"],
                      "expect": {"low": r["low"], "high": r["high"], "using_reference": r["using_reference"],
                                 "line_keys": [ln["key"] for ln in r["lines"]],
                                 "minimum": (r["minimum_applied"] or {}).get("key"),
                                 "summary": r["summary"], "warnings": r["warnings"]}})
    now = now or datetime.now(timezone.utc)
    return {
        "version": RULES_VERSION,
        "updated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "using_reference": bool(ref_items),
        "reference_items": sorted(ref_items),
        "reference_label": (c.get("prices_reference") or {}).get("_label") if ref_items else None,
        "currency": "USD",
        "types": list(TYPES),
        "materials": {m: {"item": SIDING[m][0], "en": SIDING[m][1], "es": SIDING[m][2],
                          "words": {"en": SIDING_WORDS[m][0], "es": SIDING_WORDS[m][1]}} for m in SIDING},
        "addons": [{"field": f, "item": k, "unit": u, "roof_item": ri, "after": g,
                    "words": {"en": ADDON_WORDS[f][0], "es": ADDON_WORDS[f][1]}} for f, k, u, ri, g in ADDONS],
        "prices": prices,
        "units": {u: {"en": UNITS[u][0], "es": UNITS[u][1]} for u in UNITS},
        "adders": {
            "steep_pitch": {"pitch_adders": e["pitch_adders"], "steep_over": e["steep_over"],
                            "low_under": e["low_under"],
                            "applies_to": ("roof items (shingle roof, roof layer tear-off, ice & water, ridge vent, "
                                           "chimney + skylight flashing)")},
            "stories": {"story_adders": e["story_adders"], "applies_to": "every installed item except the permit"},
            "extra_layers": {"item": "extra_layer_sq", "per": "square per old layer beyond the first; roof if any, "
                                                             "else walls; roof layers also get the pitch adder"},
            "house_wrap": {"item": "house_wrap_sq", "default": True, "per": "square of siding"},
            "permit": {"item": "permit", "default": True, "story_adder": False},
            "min_job": minimum("min_job"),
            "min_job_roof": minimum("min_job_roof"),
            "min_rule": ("roof jobs use min_job_roof unless it is market and min_job is HMP's; the minimum applies "
                         "when the low or the high total is under it"),
            "round_to": ROUND_TO,
        },
        "rough_helper": {"perimeter_factor": e["perimeter_factor"], "story_height_ft": e["story_height_ft"],
                         "openings": e["openings"], "pitch_factor": e["pitch_factor"],
                         "formula": ("perimeter = 4 x sqrt(footprint) x perimeter_factor; siding squares = "
                                     "perimeter x story_height_ft x stories x (1 - openings) / 100 (1 decimal); "
                                     "roof squares = footprint x pitch_factor[pitch] / 100 (1 decimal)")},
        "insurance_note": dict(INSURANCE_NOTE),
        "reference_warning": {lang: REF_WARNING[lang].format(for_items="") for lang in ("en", "es")},
        "reference_warning_template": dict(REF_WARNING),
        "reference_for_items": dict(REF_FOR_ITEMS),
        "national_warning_template": dict(NATIONAL_WARNING),
        "rough_note": dict(ROUGH_NOTE),
        "type_notes": {k: dict(v) for k, v in TYPE_NOTES.items()},
        "test_cases": cases,
    }
