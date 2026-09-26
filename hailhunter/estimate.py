"""T52 quick estimate (`hh.py estimate --json job.json`): a price RANGE for a siding / roof / gutter job, in
English and Spanish, ready for the boss's price sheet (T51).

HMP's own prices live in config `prices` ({low, high} per item, null until the boss sets them). Any item still
null falls back to config `prices_reference` (MARKET REFERENCE, NOT HMP's prices, from
docs/research/2026-09-26-market-prices.md) and the result says so: `using_reference: true` + a warning.

job = {type: siding|roof|gutters|mixed, siding_squares, roof_squares, gutter_ft, soffit_ft,
       material: vinyl|hardie (siding; roofs are architectural shingle), pitch: low|std|steep or a number
       (rise per 12, e.g. 7 or "7/12"), stories: 1-3, layers: old layers to tear off (1 = normal),
       house_wrap: true (siding default), permit: true (default),
       footprint_sqft: optional, fills missing squares with the ROUGH helper below}
- type picks the main item: siding uses siding_squares (+ house wrap), roof uses roof_squares, gutters uses
  gutter_ft; mixed uses everything given. soffit_ft / gutter_ft are added to any type when given.
- layers: extra old layers (layers - 1) are torn off the roof; on a siding-only job, off the walls.
- Adders: steep pitch +15-25% on roof items; 2 / 3 stories +15 / +35% on every installed item (not the permit).
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
          "hardie": ("hardie_siding_sq", "James Hardie siding", "Siding James Hardie")}
ITEM_NAMES = {
    "shingle_roof_sq": ("Architectural shingle roof (1-layer tear-off)", "Techo de teja arquitectónica (quitar 1 capa)"),
    "extra_layer_sq": ("Extra old layer tear-off", "Quitar capa vieja extra"),
    "soffit_fascia_ft": ("Soffit + fascia", "Sofito + fascia"),
    "gutters_ft": ("Seamless gutters", "Canaletas sin costura"),
    "house_wrap_sq": ("House wrap", "Envoltura de casa (house wrap)"),
    "permit": ("Permit", "Permiso"),
}
UNITS = {"sq": ("squares", "cuadros"), "ft": ("ft", "pies"), "job": ("job", "trabajo")}
INSURANCE_NOTE = {"en": "For insurance jobs: the insurer's approved scope sets the price.",
                  "es": "Para trabajos de seguro: el alcance aprobado por la aseguradora fija el precio."}
ROUGH_NOTE = {"en": "ROUGH squares from the footprint and stories. Measure the house before quoting.",
              "es": "Cuadros APROXIMADOS por el tamaño de la casa y los pisos. Midan la casa antes de dar precio."}


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
    elif material in ("shingle", "architectural", "architectural shingle"):
        material = "vinyl"                       # a roof material names no siding: siding (if any) stays vinyl
    if material not in SIDING:
        raise ValueError(f"material must be vinyl or hardie (roofs are architectural shingle), got {job.get('material')!r}")
    pc, n = pitch_class(job.get("pitch"), c), _stories(job.get("stories"))
    layers = int(round(_num(job.get("layers"), "layers", 1))) or 1
    siding = _num(job.get("siding_squares"), "siding_squares")
    roof = _num(job.get("roof_squares"), "roof_squares")
    gutter = _num(job.get("gutter_ft"), "gutter_ft")
    soffit = _num(job.get("soffit_ft"), "soffit_ft")
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
        warnings.append({"en": "Siding job: roof squares left out (use type mixed for both).",
                         "es": "Trabajo de siding: no se contó el techo (usen tipo mixed para los dos)."})
    if jtype == "roof" and siding:
        siding = 0.0
        warnings.append({"en": "Roof job: siding squares left out (use type mixed for both).",
                         "es": "Trabajo de techo: no se contó el siding (usen tipo mixed para los dos)."})
    if jtype == "gutters" and (siding or roof):
        siding = roof = 0.0
        warnings.append({"en": "Gutter job: siding and roof left out (use type mixed).",
                         "es": "Trabajo de canaletas: no se contó siding ni techo (usen tipo mixed)."})
    need = {"siding": siding, "roof": roof, "gutters": gutter, "mixed": siding or roof or gutter or soffit}[jtype]
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

    extra = max(0, layers - 1)
    if siding:
        key, en, es = SIDING[material]
        add(key, siding, "sq", en, es)
        if job.get("house_wrap", True):
            add("house_wrap_sq", siding, "sq", *ITEM_NAMES["house_wrap_sq"])
        if extra and not roof:
            add("extra_layer_sq", siding * extra, "sq", f"{ITEM_NAMES['extra_layer_sq'][0]} (walls, x{extra})",
                f"{ITEM_NAMES['extra_layer_sq'][1]} (paredes, x{extra})")
    if roof:
        add("shingle_roof_sq", roof, "sq", *ITEM_NAMES["shingle_roof_sq"], roof_item=True)
        if extra:
            add("extra_layer_sq", roof * extra, "sq", f"{ITEM_NAMES['extra_layer_sq'][0]} (roof, x{extra})",
                f"{ITEM_NAMES['extra_layer_sq'][1]} (techo, x{extra})", roof_item=True)
    if soffit:
        add("soffit_fascia_ft", soffit, "ft", *ITEM_NAMES["soffit_fascia_ft"])
    if gutter:
        add("gutters_ft", gutter, "ft", *ITEM_NAMES["gutters_ft"])
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
    low = int(math.floor(low / 50.0) * 50)
    high = int(math.ceil(high / 50.0) * 50)

    ref_items = sorted(set(ref_items))
    using_ref = bool(ref_items)
    if using_ref:
        all_ref = all(ln["reference"] for ln in lines)
        warnings.insert(0, {
            "en": ("Using MARKET REFERENCE prices, not HMP's prices" + ("" if all_ref else f" for: {', '.join(ref_items)}")
                   + ". The boss hasn't set HMP's price sheet yet (T51). Don't give this number to a customer."),
            "es": ("Usando precios de REFERENCIA del mercado, no los precios de HMP" + ("" if all_ref else f" para: {', '.join(ref_items)}")
                   + ". El jefe todavía no pone la lista de precios de HMP (T51). No le den este número a un cliente.")})

    parts_en, parts_es = [], []
    if siding:
        parts_en.append(f"{'James Hardie' if material == 'hardie' else 'vinyl'} siding ({siding:g} squares)")
        parts_es.append(f"siding {'James Hardie' if material == 'hardie' else 'de vinil'} ({siding:g} cuadros)")
    if roof:
        parts_en.append(f"shingle roof ({roof:g} squares)")
        parts_es.append(f"techo de teja ({roof:g} cuadros)")
    if soffit:
        parts_en.append(f"soffit + fascia ({soffit:g} ft)")
        parts_es.append(f"sofito + fascia ({soffit:g} pies)")
    if gutter:
        parts_en.append(f"gutters ({gutter:g} ft)")
        parts_es.append(f"canaletas ({gutter:g} pies)")
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
            "quantities": {"siding_squares": siding, "roof_squares": roof, "gutter_ft": gutter, "soffit_ft": soffit,
                           "material": material},
            "rough_squares": rough, "summary": summary, "insurance_note": dict(INSURANCE_NOTE)}
