"""O7 phase D: material takeoff (`hh.py takeoff --json job.json`), a material order list from measurements.

Trade rules of thumb from docs/research/2026-09-26-round-7.md section 3; every number lives in config `takeoff`.
No prices here (that's estimate.py, untouched). Every count is ROUNDED UP to a whole unit.

job = {kind: roof|siding|gutters|mixed, name (optional job label / address),
       roof {squares, eave_ft, rake_ft, ridge_ft, hip_ft, valley_ft, penetrations, roof_type: gable|hip|cutup, pitch,
             overhang_in, ridge_vent},
       siding {material: vinyl|insulated_vinyl|hardie, wall_sqft or squares, openings (count) or opening_perimeter_ft,
               wall_height_ft, outside_corners, inside_corners, bottom_ft, rake_ft, exposure_in (Hardie, default 7)},
       gutters {feet, runs, corners, snow (default true, Nebraska), height_ft}}

Returns {version, kind, name, lines[{group, item, en, es, qty, unit, unit_en, unit_es, how{en,es}}], groups[],
ask_supplier[{item, en, es, why{en,es}}], assumptions[{en,es}], text{en,es}}.

The HMP App runs the same math in JavaScript (docs/app/takeoff.js) from `export_rules()`: all wording and numbers
come from that one rules doc, and compute() below is written step for step like the JS so both give the same
answer (tests/js/takeoff_check.js checks it, fuzzed). If you change compute(), change takeoff.js the same way.
"""
import math
import re

from .config import DEFAULTS

RULES_VERSION = 1
KINDS = ("roof", "siding", "gutters", "mixed")
EPS = 1e-9                   # float noise guard: 30 x 1.1 = 33.000000000000004 must round up to 33, not 34

GROUPS = [
    {"key": "roof", "en": "ROOF", "es": "TECHO"},
    {"key": "siding", "en": "SIDING", "es": "SIDING"},
    {"key": "gutters", "en": "GUTTERS", "es": "CANALETAS"},
]

# unit -> [en one, en many, es one, es many]
UNITS = {
    "bundle": ["bundle", "bundles", "paquete", "paquetes"],
    "roll": ["roll", "rolls", "rollo", "rollos"],
    "stick": ["stick", "sticks", "tramo", "tramos"],
    "box": ["box", "boxes", "caja", "cajas"],
    "piece": ["pc", "pcs", "pza", "pzas"],
    "ft": ["ft", "ft", "pie", "pies"],
    "sq": ["sq", "sq", "cuadro", "cuadros"],
    "nail": ["nail", "nails", "clavo", "clavos"],
}

# item -> {group, unit, en, es, how_en, how_es}; {placeholders} are filled by compute() (same in the JS).
ITEMS = {
    # roof
    "shingles": {"group": "roof", "unit": "bundle", "en": "Shingles (architectural)", "es": "Tejas (arquitectónicas)",
                 "how_en": "{sq} sq + {waste}% waste ({type_en} roof) x {bps} bundles per square",
                 "how_es": "{sq} cuadros + {waste}% de desperdicio (techo {type_es}) x {bps} paquetes por cuadro"},
    "starter": {"group": "roof", "unit": "bundle", "en": "Starter shingles", "es": "Tejas de arranque (starter)",
                "how_en": "(eave {eave} ft + rake {rake} ft) / {per} ft per bundle",
                "how_es": "(alero {eave} pies + borde inclinado {rake} pies) / {per} pies por paquete"},
    "ridge_cap": {"group": "roof", "unit": "bundle", "en": "Ridge cap shingles", "es": "Tejas de cumbrera (ridge cap)",
                  "how_en": "(ridge {ridge} ft + hips {hip} ft) / {per} ft per bundle",
                  "how_es": "(cumbrera {ridge} pies + limatesas {hip} pies) / {per} pies por paquete"},
    "drip_edge": {"group": "roof", "unit": "stick", "en": "Drip edge", "es": "Gotero (drip edge)",
                  "how_en": "(eave {eave} ft + rake {rake} ft) + {extra}% for laps and cuts / {stick} ft sticks",
                  "how_es": "(alero {eave} pies + borde inclinado {rake} pies) + {extra}% por traslapes y cortes / "
                            "tramos de {stick} pies"},
    "underlayment": {"group": "roof", "unit": "roll", "en": "Synthetic underlayment", "es": "Membrana sintética",
                     "how_en": "{sq} sq / {per} sq per roll",
                     "how_es": "{sq} cuadros / {per} cuadros por rollo"},
    "ice_water": {"group": "roof", "unit": "roll", "en": "Ice & water shield", "es": "Membrana ice & water",
                  "how_en": "every eave {eave} ft x {rows} row(s) of {width} in (edge to {inside} in inside the wall: "
                            "{overhang} in overhang at {pitch}/12) + valleys {valley} ft, / {roll} ft per roll",
                  "how_es": "cada alero {eave} pies x {rows} hilera(s) de {width} pulg (del borde hasta {inside} pulg "
                            "dentro de la pared: alero de {overhang} pulg a {pitch}/12) + limahoyas {valley} pies, / "
                            "{roll} pies por rollo"},
    "roof_nails": {"group": "roof", "unit": "box", "en": "Coil roofing nails", "es": "Clavos de techo en rollo",
                   "how_en": "{sq} sq + {waste}% waste x {nps} nails per square (6 per shingle, for wind) / "
                             "{per} per box",
                   "how_es": "{sq} cuadros + {waste}% de desperdicio x {nps} clavos por cuadro (6 por teja, por el "
                             "viento) / {per} por caja"},
    "pipe_boots": {"group": "roof", "unit": "piece", "en": "Pipe boots / vent flashings",
                   "es": "Botas de tubo / tapajuntas de ventilas",
                   "how_en": "counted on the roof: {n}", "how_es": "contadas en el techo: {n}"},
    "ridge_vent": {"group": "roof", "unit": "ft", "en": "Ridge vent", "es": "Ventila de cumbrera",
                   "how_en": "ridge {ridge} ft; piece length varies by brand, confirm with the supplier",
                   "how_es": "cumbrera {ridge} pies; el largo de la pieza cambia por marca, confirmar con el proveedor"},
    # siding
    "vinyl_siding": {"group": "siding", "unit": "sq", "en": "Vinyl siding panels", "es": "Paneles de siding de vinil",
                     "how_en": "wall {area} sq ft + {waste}% waste / 100 sq ft per square",
                     "how_es": "pared {area} pies² + {waste}% de desperdicio / 100 pies² por cuadro"},
    "insulated_vinyl_siding": {"group": "siding", "unit": "sq", "en": "Insulated vinyl siding panels",
                               "es": "Paneles de siding de vinil aislado",
                               "how_en": "wall {area} sq ft + {waste}% waste / 100 sq ft per square",
                               "how_es": "pared {area} pies² + {waste}% de desperdicio / 100 pies² por cuadro"},
    "hardie_planks": {"group": "siding", "unit": "piece", "en": "Hardie lap planks (8.25 in x {len} ft)",
                      "es": "Tablas Hardie de traslape (8.25 pulg x {len} pies)",
                      "how_en": "wall {area} sq ft + {waste}% waste / {cov} sq ft per plank ({exposure} in exposure x "
                                "{len} ft plank)",
                      "how_es": "pared {area} pies² + {waste}% de desperdicio / {cov} pies² por tabla ({exposure} pulg "
                                "expuestas x tabla de {len} pies)"},
    "hardie_nails": {"group": "siding", "unit": "nail", "en": "Siding nails, hot-dip galvanized",
                     "es": "Clavos para siding, galvanizados en caliente",
                     "how_en": "{planks} planks x {per} nails (one per stud, 16 in apart)",
                     "how_es": "{planks} tablas x {per} clavos (uno por montante, cada 16 pulg)"},
    "house_wrap": {"group": "siding", "unit": "roll", "en": "House wrap (9 ft x 150 ft)",
                   "es": "Envoltura de casa (house wrap, 9 x 150 pies)",
                   "how_en": "wall {area} sq ft + {extra}% for laps / {per} sq ft per roll",
                   "how_es": "pared {area} pies² + {extra}% por traslapes / {per} pies² por rollo"},
    "j_channel": {"group": "siding", "unit": "piece", "en": "J-channel ({len} ft)", "es": "Canal J ({len} pies)",
                  "how_en": "around openings {open} ft + gable rakes {rake} ft, + {extra}% / {len} ft pieces",
                  "how_es": "alrededor de aberturas {open} pies + bordes de hastial {rake} pies, + {extra}% / "
                            "piezas de {len} pies"},
    "hardie_trim": {"group": "siding", "unit": "piece", "en": "Hardie trim boards ({len} ft)",
                    "es": "Molduras Hardie (trim, {len} pies)",
                    "how_en": "around openings {open} ft + gable rakes {rake} ft, + {extra}% / {len} ft boards",
                    "how_es": "alrededor de aberturas {open} pies + bordes de hastial {rake} pies, + {extra}% / "
                              "tablas de {len} pies"},
    "outside_corners": {"group": "siding", "unit": "piece", "en": "Outside corner posts ({len} ft)",
                        "es": "Esquineros exteriores ({len} pies)",
                        "how_en": "{n} corners x {per} post(s) each ({h} ft wall / {len} ft posts)",
                        "how_es": "{n} esquinas x {per} esquinero(s) cada una (pared de {h} pies / piezas de {len} pies)"},
    "inside_corners": {"group": "siding", "unit": "piece", "en": "Inside corner posts ({len} ft)",
                       "es": "Esquineros interiores ({len} pies)",
                       "how_en": "{n} corners x {per} post(s) each ({h} ft wall / {len} ft posts)",
                       "how_es": "{n} esquinas x {per} esquinero(s) cada una (pared de {h} pies / piezas de {len} pies)"},
    "hardie_outside_corners": {"group": "siding", "unit": "piece", "en": "Hardie outside corner trim ({len} ft)",
                               "es": "Molduras Hardie de esquina exterior ({len} pies)",
                               "how_en": "{n} corners x 2 boards x {per} ({h} ft wall / {len} ft boards)",
                               "how_es": "{n} esquinas x 2 tablas x {per} (pared de {h} pies / tablas de {len} pies)"},
    "hardie_inside_corners": {"group": "siding", "unit": "piece", "en": "Hardie inside corner trim ({len} ft)",
                              "es": "Molduras Hardie de esquina interior ({len} pies)",
                              "how_en": "{n} corners x 1 board x {per} ({h} ft wall / {len} ft boards)",
                              "how_es": "{n} esquinas x 1 tabla x {per} (pared de {h} pies / tablas de {len} pies)"},
    "starter_strip": {"group": "siding", "unit": "piece", "en": "Siding starter strip ({len} ft)",
                      "es": "Tira de arranque de siding ({len} pies)",
                      "how_en": "bottom of the walls {bottom} ft / {len} ft pieces",
                      "how_es": "parte de abajo de las paredes {bottom} pies / piezas de {len} pies"},
    # gutters
    "gutter": {"group": "gutters", "unit": "ft", "en": "Gutter", "es": "Canaleta",
               "how_en": "{feet} ft measured along the eaves ({runs} run(s))",
               "how_es": "{feet} pies medidos por los aleros ({runs} tramo(s))"},
    "downspouts": {"group": "gutters", "unit": "piece", "en": "Downspouts", "es": "Bajantes",
                   "how_en": "1 per {per} ft of gutter ({feet} ft), at least 1 per run ({runs})",
                   "how_es": "1 cada {per} pies de canaleta ({feet} pies), mínimo 1 por tramo ({runs})"},
    "downspout_pipe": {"group": "gutters", "unit": "ft", "en": "Downspout pipe", "es": "Tubo de bajante",
                       "how_en": "{d} downspouts x {h} ft high", "how_es": "{d} bajantes x {h} pies de alto"},
    "elbows": {"group": "gutters", "unit": "piece", "en": "Downspout elbows", "es": "Codos de bajante",
               "how_en": "{d} downspouts x {per} (2 at the top, 1 at the bottom)",
               "how_es": "{d} bajantes x {per} (2 arriba, 1 abajo)"},
    "outlets": {"group": "gutters", "unit": "piece", "en": "Downspout outlets", "es": "Salidas de bajante",
                "how_en": "1 per downspout ({d})", "how_es": "1 por bajante ({d})"},
    "hangers": {"group": "gutters", "unit": "piece", "en": "Hidden hangers", "es": "Ganchos ocultos",
                "how_en": "{feet} ft x 12 / one every {sp} in ({snow_en}) + 1 at the end of each run ({runs})",
                "how_es": "{feet} pies x 12 / uno cada {sp} pulg ({snow_es}) + 1 al final de cada tramo ({runs})"},
    "end_caps": {"group": "gutters", "unit": "piece", "en": "End caps", "es": "Tapas de extremo",
                 "how_en": "2 per run ({runs} run(s))", "how_es": "2 por tramo ({runs} tramo(s))"},
    "miters": {"group": "gutters", "unit": "piece", "en": "Miters (corners)", "es": "Esquinas (miters)",
               "how_en": "1 per corner ({n})", "how_es": "1 por esquina ({n})"},
}

ASK = {
    "vinyl_nails": {"en": "Vinyl siding nails", "es": "Clavos para siding de vinil",
                    "why_en": "no reliable count: depends on panel and wall; ask for boxes for {sq} squares",
                    "why_es": "no hay cuenta confiable: depende del panel y la pared; pedir cajas para {sq} cuadros"},
    "hardie_caulk": {"en": "Caulk for Hardie (color-matched)", "es": "Sellador para Hardie (del mismo color)",
                     "why_en": "no reliable formula: ask for {planks} planks and {trim} trim pieces",
                     "why_es": "no hay fórmula confiable: preguntar para {planks} tablas y {trim} molduras"},
    "hardie_paint": {"en": "Touch-up paint for Hardie", "es": "Pintura de retoque para Hardie",
                     "why_en": "no reliable formula: ask for {planks} planks (match the color)",
                     "why_es": "no hay fórmula confiable: preguntar para {planks} tablas (mismo color)"},
    "gutter_sealant": {"en": "Gutter sealant", "es": "Sellador de canaletas",
                       "why_en": "no reliable formula: ask for {runs} run(s), {caps} end caps, {miters} miters",
                       "why_es": "no hay fórmula confiable: preguntar para {runs} tramo(s), {caps} tapas, {miters} "
                                 "esquinas"},
}

ASSUME = {
    "rounded": {"en": "Every quantity is rounded up to a whole unit.",
                "es": "Cada cantidad está redondeada hacia arriba a una unidad completa."},
    "waste": {"en": "Shingle waste: gable {g}%, hip {h}%, cut-up {c}%. This roof: {type_en}, {w}%.",
              "es": "Desperdicio de tejas: dos aguas {g}%, cuatro aguas {h}%, muchos cortes {c}%. Este techo: "
                    "{type_es}, {w}%."},
    "nails": {"en": "Roof nails: 6 per shingle (high-wind nailing), about {nps} per square.",
              "es": "Clavos de techo: 6 por teja (clavado para viento fuerte), unos {nps} por cuadro."},
    "ice_water": {"en": "Ice & water shield on EVERY eave, from the edge to {inside} in inside the wall (IRC R905.1.2, "
                        "Nebraska cold zone), plus the valleys.",
                  "es": "Membrana ice & water en CADA alero, del borde hasta {inside} pulg dentro de la pared (IRC "
                        "R905.1.2, zona fría de Nebraska), más las limahoyas."},
    "no_squares": {"en": "No roof squares given: shingles, underlayment and nails are not counted.",
                   "es": "No se dieron cuadros de techo: no se cuentan tejas, membrana ni clavos."},
    "roof_type": {"en": "Roof shape not given: {type_en} assumed.",
                  "es": "No se dio la forma del techo: se supone {type_es}."},
    "pitch": {"en": "Pitch not given: {pitch}/12 assumed.", "es": "No se dio la pendiente: se supone {pitch}/12."},
    "siding_waste": {"en": "Siding waste: {w}% ({mat_en}).", "es": "Desperdicio de siding: {w}% ({mat_es})."},
    "wall_height": {"en": "Wall height not given: {h} ft assumed for corners.",
                    "es": "No se dio la altura de la pared: se suponen {h} pies para las esquinas."},
    "openings": {"en": "{n} openings x {per} ft of trim each (about a 3 x 5 ft window).",
                 "es": "{n} aberturas x {per} pies de moldura cada una (como una ventana de 3 x 5 pies)."},
    "no_area": {"en": "No wall area given: panels and house wrap are not counted.",
                "es": "No se dio el área de pared: no se cuentan paneles ni envoltura."},
    "hangers": {"en": "Gutter hangers every {sp} in ({snow_en}).",
                "es": "Ganchos de canaleta cada {sp} pulg ({snow_es})."},
    "no_height": {"en": "No wall height for the gutters: downspout pipe length not counted.",
                  "es": "No hay altura para las canaletas: no se cuenta el largo del tubo de bajante."},
}

ROOF_TYPES = {"gable": ["gable", "dos aguas"], "hip": ["hip", "cuatro aguas"], "cutup": ["cut-up", "muchos cortes"]}
MATERIALS = {"vinyl": ["vinyl", "vinil"], "insulated_vinyl": ["insulated vinyl", "vinil aislado"],
             "hardie": ["Hardie", "Hardie"]}
MATERIAL_ALIASES = {"james_hardie": "hardie", "fiber_cement": "hardie", "insulated": "insulated_vinyl"}
SNOW = {True: ["snow country", "zona de nieve"], False: ["no snow load", "sin carga de nieve"]}

TEXT = {
    "title_en": "Material order - {company}", "title_es": "Pedido de material - {company}",
    "job_en": "Job: {name}", "job_es": "Trabajo: {name}",
    "ask_en": "Please quote / confirm: {items}", "ask_es": "Favor de cotizar / confirmar: {items}",
    "end_en": "Quantities from our measurements, rounded up. Please confirm colors and quantities before ordering.",
    "end_es": "Cantidades de nuestras medidas, redondeadas hacia arriba. Favor de confirmar colores y cantidades "
              "antes de pedir.",
}


def build_rules(cfg):
    """Everything compute() needs, as plain JSON (also the HMP App's rules doc, minus test cases)."""
    c = cfg if cfg is not None else DEFAULTS
    return {"version": RULES_VERSION, "company": (c.get("company") or {}).get("name", "HMP Siding & Roofing LLC"),
            "config": c["takeoff"], "kinds": list(KINDS), "groups": GROUPS, "units": UNITS, "items": ITEMS,
            "ask": ASK, "assume": ASSUME, "roof_types": ROOF_TYPES, "materials": MATERIALS,
            "material_aliases": MATERIAL_ALIASES, "snow": {"true": SNOW[True], "false": SNOW[False]}, "text": TEXT}


# ---- helpers (each has a twin in docs/app/takeoff.js) ----

def up(x):
    """Round up to a whole number, ignoring float noise below 1e-9."""
    return int(math.ceil(x - EPS))


def fmt(x):
    """A number for the 'how' text: 12 -> '12', 12.5 -> '12.5' (same as JavaScript String(x))."""
    x = float(x)
    if x.is_integer() and abs(x) < 1e15:
        return str(int(x))
    return repr(x)


def pct(frac):
    """0.13 -> '13', 0.125 -> '12.5' (one decimal at most)."""
    return fmt(round(frac * 1000) / 10)


def fill(tpl, vals):
    for k, v in vals.items():
        tpl = tpl.replace("{" + k + "}", v)
    return tpl


def truthy(v):
    return bool(v)


def num(v, name, default=0.0):
    if v is None or v == "":
        return default
    if isinstance(v, (dict, list)):
        raise ValueError(f"{name} must be a number, got {v!r}")
    try:
        x = float(v.strip() if isinstance(v, str) else v)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a number, got {v!r}")
    if math.isnan(x) or math.isinf(x):
        raise ValueError(f"{name} must be a number, got {v!r}")
    if x < 0:
        raise ValueError(f"{name} can't be negative")
    return x


def section(job, key):
    s = job.get(key)
    if s is None:
        return None
    if not isinstance(s, dict):
        raise ValueError(f"{key} must be an object like {{\"feet\": 120}}")
    return s


def rise_of(pitch, rules):
    """Rise per 12 from '7/12', '7:12', 7, 'low|std|steep'. None = not given."""
    if pitch is None or pitch == "":
        return None
    s = str(pitch).strip().lower()
    words = rules["config"]["pitch_words"]
    if s in ("standard", "normal"):
        s = "std"
    if s in words:
        return float(words[s])
    m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*(?:[/:]\s*12)?", s)
    if not m:
        raise ValueError(f"pitch must be low, std, steep or a rise per 12 like 7/12, got {pitch!r}")
    return float(m.group(1))


def compute(job, rules):
    if not isinstance(job, dict):
        raise ValueError("job must be an object")
    kind = str(job.get("kind") or job.get("type") or "").strip().lower()
    if kind not in rules["kinds"]:
        raise ValueError("kind must be roof, siding, gutters or mixed")
    c, T = rules["config"], rules["items"]
    lines, ask, assume = [], [], [dict(rules["assume"]["rounded"])]

    def add(key, qty, vals):
        if qty <= 0:
            return
        qty = int(qty)
        it, u = T[key], rules["units"][T[key]["unit"]]
        lines.append({"group": it["group"], "item": key, "en": fill(it["en"], vals), "es": fill(it["es"], vals),
                      "qty": qty, "unit": it["unit"], "unit_en": u[0] if qty == 1 else u[1],
                      "unit_es": u[2] if qty == 1 else u[3],
                      "how": {"en": fill(it["how_en"], vals), "es": fill(it["how_es"], vals)}})

    def note(key, vals):
        a = rules["assume"][key]
        assume.append({"en": fill(a["en"], vals), "es": fill(a["es"], vals)})

    def ask_for(key, vals):
        a = rules["ask"][key]
        ask.append({"item": key, "en": a["en"], "es": a["es"],
                    "why": {"en": fill(a["why_en"], vals), "es": fill(a["why_es"], vals)}})

    want = rules["kinds"][:3] if kind == "mixed" else [kind]
    roof = section(job, "roof") if "roof" in want else None
    siding = section(job, "siding") if "siding" in want else None
    gutters = section(job, "gutters") if "gutters" in want else None
    if kind != "mixed" and (roof if kind == "roof" else siding if kind == "siding" else gutters) is None:
        raise ValueError(f"a {kind} job needs a \"{kind}\" object with measurements")
    if roof is None and siding is None and gutters is None:
        raise ValueError("a mixed job needs at least one of roof, siding, gutters")

    roof_rake = 0.0
    if roof is not None:
        sq = num(roof.get("squares"), "roof.squares")
        eave = num(roof.get("eave_ft"), "roof.eave_ft")
        rake = num(roof.get("rake_ft"), "roof.rake_ft")
        roof_rake = rake
        ridge = num(roof.get("ridge_ft"), "roof.ridge_ft")
        hip = num(roof.get("hip_ft"), "roof.hip_ft")
        valley = num(roof.get("valley_ft"), "roof.valley_ft")
        pen = up(num(roof.get("penetrations"), "roof.penetrations"))
        rt_raw = roof.get("roof_type")
        if rt_raw is None or rt_raw == "":
            rtype = "hip" if hip > 0 else "gable"
            rt_given = False
        else:
            rtype = re.sub(r"[\s_-]+", "", str(rt_raw).strip().lower())
            rt_given = True
            if rtype not in rules["roof_types"]:
                raise ValueError(f"roof_type must be gable, hip or cutup, got {rt_raw!r}")
        rise = rise_of(roof.get("pitch"), rules)
        pitch_given = rise is not None
        if rise is None:
            rise = float(c["default_pitch"])
        overhang = num(roof.get("overhang_in"), "roof.overhang_in", float(c["ice_water_overhang_in"]))
        w = c["waste"][rtype]
        names = rules["roof_types"][rtype]
        v = {"sq": fmt(sq), "waste": pct(w), "type_en": names[0], "type_es": names[1],
             "eave": fmt(eave), "rake": fmt(rake), "ridge": fmt(ridge), "hip": fmt(hip), "valley": fmt(valley)}
        if sq > 0:
            v["bps"] = fmt(c["bundles_per_square"])
            add("shingles", up(sq * (1 + w) * c["bundles_per_square"]), v)
        v["per"] = fmt(c["starter_ft_per_bundle"])
        add("starter", up((eave + rake) / c["starter_ft_per_bundle"]), v)
        v["per"] = fmt(c["ridge_cap_ft_per_bundle"])
        add("ridge_cap", up((ridge + hip) / c["ridge_cap_ft_per_bundle"]), v)
        v["extra"] = pct(c["drip_edge_extra"])
        v["stick"] = fmt(c["drip_edge_stick_ft"])
        add("drip_edge", up((eave + rake) * (1 + c["drip_edge_extra"]) / c["drip_edge_stick_ft"]), v)
        if sq > 0:
            v["per"] = fmt(c["underlayment_sq_per_roll"])
            add("underlayment", up(sq / c["underlayment_sq_per_roll"]), v)
        width = c["ice_water_width_in"]
        strip_in = (overhang + c["ice_water_inside_wall_in"]) * math.sqrt(1 + (rise / 12) * (rise / 12))
        rows = 1 + up(max(0.0, strip_in - width) / (width - c["ice_water_lap_in"]))
        v.update({"rows": fmt(rows), "width": fmt(width), "inside": fmt(c["ice_water_inside_wall_in"]),
                  "overhang": fmt(overhang), "pitch": fmt(rise), "roll": fmt(c["ice_water_roll_ft"])})
        add("ice_water", up((eave * rows + valley) / c["ice_water_roll_ft"]), v)
        if sq > 0:
            v["nps"] = fmt(c["nails_per_square"])
            v["per"] = fmt(c["nails_per_box"])
            add("roof_nails", up(sq * (1 + w) * c["nails_per_square"] / c["nails_per_box"]), v)
        v["n"] = fmt(pen)
        add("pipe_boots", pen, v)
        if truthy(roof.get("ridge_vent")):
            add("ridge_vent", up(ridge), v)
        wv = {"g": pct(c["waste"]["gable"]), "h": pct(c["waste"]["hip"]), "c": pct(c["waste"]["cutup"]),
              "type_en": names[0], "type_es": names[1], "w": pct(w), "nps": fmt(c["nails_per_square"]),
              "inside": fmt(c["ice_water_inside_wall_in"]), "pitch": fmt(rise)}
        if sq > 0:
            note("waste", wv)
            note("nails", wv)
        else:
            note("no_squares", wv)
        if not rt_given:
            note("roof_type", wv)
        if not pitch_given and (eave > 0 or valley > 0):
            note("pitch", wv)
        if eave > 0 or valley > 0:
            note("ice_water", wv)

    material = None
    if siding is not None:
        m_raw = siding.get("material")
        material = "vinyl" if m_raw is None or m_raw == "" else re.sub(r"[\s-]+", "_", str(m_raw).strip().lower())
        material = rules["material_aliases"].get(material, material)
        if material not in rules["materials"]:
            raise ValueError(f"siding.material must be vinyl, insulated_vinyl or hardie, got {m_raw!r}")
        area = num(siding.get("wall_sqft"), "siding.wall_sqft")
        if area == 0:
            area = num(siding.get("squares"), "siding.squares") * 100
        n_open = up(num(siding.get("openings"), "siding.openings"))
        open_ft = num(siding.get("opening_perimeter_ft"), "siding.opening_perimeter_ft")
        from_count = open_ft == 0 and n_open > 0
        if from_count:
            open_ft = n_open * c["ft_per_opening"]
        h_raw = siding.get("wall_height_ft")
        h = num(h_raw, "siding.wall_height_ft")
        h_given = h > 0
        if not h_given:
            h = float(c["default_wall_height_ft"])
        outside = up(num(siding.get("outside_corners"), "siding.outside_corners"))
        inside = up(num(siding.get("inside_corners"), "siding.inside_corners"))
        bottom = num(siding.get("bottom_ft"), "siding.bottom_ft")
        s_rake = num(siding.get("rake_ft"), "siding.rake_ft", roof_rake)
        w = c["siding_waste"][material]
        hardie = material == "hardie"
        mnames = rules["materials"][material]
        v = {"area": fmt(area), "waste": pct(w), "open": fmt(open_ft), "rake": fmt(s_rake), "h": fmt(h),
             "bottom": fmt(bottom), "extra": pct(c["trim_extra"])}
        planks = 0
        if hardie:
            exposure = num(siding.get("exposure_in"), "siding.exposure_in", float(c["hardie_exposure_in"]))
            if exposure <= 0:
                raise ValueError("siding.exposure_in must be more than 0")
            cov = exposure * c["hardie_plank_ft"] / 12
            v.update({"exposure": fmt(exposure), "len": fmt(c["hardie_plank_ft"]), "cov": fmt(cov)})
            planks = up(area * (1 + w) / cov)
            add("hardie_planks", planks, v)
            v["planks"] = fmt(planks)
            v["per"] = fmt(c["hardie_nails_per_plank"])
            add("hardie_nails", planks * c["hardie_nails_per_plank"], v)
        else:
            add(material + "_siding", up(area * (1 + w) / 100), v)
        v["per"] = fmt(c["house_wrap_roll_sqft"])
        v["extra"] = pct(c["house_wrap_extra"])
        add("house_wrap", up(area * (1 + c["house_wrap_extra"]) / c["house_wrap_roll_sqft"]), v)
        v["extra"] = pct(c["trim_extra"])
        trim_len = c["hardie_trim_ft"] if hardie else c["j_channel_ft"]
        v["len"] = fmt(trim_len)
        trim = up((open_ft + s_rake) * (1 + c["trim_extra"]) / trim_len)
        add("hardie_trim" if hardie else "j_channel", trim, v)
        corner_len = c["hardie_corner_ft"] if hardie else c["corner_post_ft"]
        per = up(h / corner_len)
        v.update({"len": fmt(corner_len), "per": fmt(per), "n": fmt(outside)})
        add("hardie_outside_corners" if hardie else "outside_corners", outside * per * (2 if hardie else 1), v)
        v["n"] = fmt(inside)
        add("hardie_inside_corners" if hardie else "inside_corners", inside * per, v)
        v["len"] = fmt(c["starter_strip_ft"])
        add("starter_strip", up(bottom / c["starter_strip_ft"]), v)
        av = {"w": pct(w), "mat_en": mnames[0], "mat_es": mnames[1], "h": fmt(h), "n": fmt(n_open),
              "per": fmt(c["ft_per_opening"])}
        note("siding_waste", av)
        if area == 0:
            note("no_area", av)
        if not h_given and (outside > 0 or inside > 0):
            note("wall_height", av)
        if from_count:
            note("openings", av)
        if hardie:
            ask_for("hardie_caulk", {"planks": fmt(planks), "trim": fmt(trim)})
            ask_for("hardie_paint", {"planks": fmt(planks)})
        elif area > 0:
            ask_for("vinyl_nails", {"sq": fmt(up(area * (1 + w) / 100))})

    if gutters is not None:
        feet = num(gutters.get("feet"), "gutters.feet")
        runs = up(num(gutters.get("runs"), "gutters.runs", 1.0))
        if feet > 0 and runs < 1:
            runs = 1
        corners = up(num(gutters.get("corners"), "gutters.corners"))
        snow_raw = gutters.get("snow")
        snow = True if snow_raw is None else truthy(snow_raw)
        sp = c["hanger_spacing_in"]["snow" if snow else "no_snow"]
        sn = rules["snow"]["true" if snow else "false"]
        gh = num(gutters.get("height_ft"), "gutters.height_ft")
        if gh == 0 and siding is not None:
            gh = num(siding.get("wall_height_ft"), "siding.wall_height_ft")
        v = {"feet": fmt(feet), "runs": fmt(runs), "n": fmt(corners), "sp": fmt(sp), "snow_en": sn[0],
             "snow_es": sn[1], "h": fmt(gh), "per": fmt(c["gutter_ft_per_downspout"])}
        d = 0
        if feet > 0:
            add("gutter", up(feet), v)
            d = max(runs, up(feet / c["gutter_ft_per_downspout"]))
            add("downspouts", d, v)
            v["d"] = fmt(d)
            add("downspout_pipe", up(d * gh), v)
            v["per"] = fmt(c["elbows_per_downspout"])
            add("elbows", d * c["elbows_per_downspout"], v)
            add("outlets", d, v)
            add("hangers", up(feet * 12 / sp) + runs, v)
            add("end_caps", 2 * runs, v)
            add("miters", corners, v)
            note("hangers", v)
            if gh == 0:
                note("no_height", v)
            ask_for("gutter_sealant", {"runs": fmt(runs), "caps": fmt(2 * runs), "miters": fmt(corners)})

    if not lines:
        raise ValueError("nothing to count: give measurements (roof squares/eave ft, siding wall_sqft, gutter feet)")

    name_raw = job.get("name") or job.get("address")
    name = str(name_raw).strip() if name_raw is not None and name_raw != "" else ""
    groups = []
    for g in rules["groups"]:
        n = len([ln for ln in lines if ln["group"] == g["key"]])
        if n:
            gg = {"key": g["key"], "en": g["en"], "es": g["es"], "count": n}
            if g["key"] == "siding":
                gg["en"] = g["en"] + " (" + rules["materials"][material][0] + ")"
                gg["es"] = g["es"] + " (" + rules["materials"][material][1] + ")"
            groups.append(gg)
    tx = rules["text"]
    text = {}
    for lang in ("en", "es"):
        out = [fill(tx["title_" + lang], {"company": rules["company"]})]
        if name:
            out.append(fill(tx["job_" + lang], {"name": name}))
        for g in groups:
            out.append("")
            out.append(g[lang])
            for ln in lines:
                if ln["group"] == g["key"]:
                    out.append("- " + fmt(ln["qty"]) + " " + ln["unit_" + lang] + " " + ln[lang])
        if ask:
            out.append("")
            out.append(fill(tx["ask_" + lang], {"items": ", ".join([a[lang] for a in ask])}))
        out.append("")
        out.append(tx["end_" + lang])
        text[lang] = "\n".join(out)
    return {"version": rules["version"], "kind": kind, "name": name, "material": material, "lines": lines,
            "groups": groups, "ask_supplier": ask, "assumptions": assume, "text": text}


def takeoff(job, cfg=None):
    """The material order list for one job (see the module docstring). Raises ValueError on a bad job."""
    return compute(job, build_rules(cfg))


# Jobs `export_rules` runs through takeoff() so docs/app/takeoff.js can check itself against Python.
RULE_TEST_JOBS = [
    {"name": "roof gable", "job": {"kind": "roof", "name": "1418 Irving St, Fremont",
                                   "roof": {"squares": 20, "eave_ft": 80, "rake_ft": 60, "ridge_ft": 40,
                                            "penetrations": 3, "roof_type": "gable", "pitch": "6/12"}}},
    {"name": "roof hip steep + vent", "job": {"kind": "roof", "roof": {"squares": 31.5, "eave_ft": 190, "ridge_ft": 30,
                                                                        "hip_ft": 88, "valley_ft": 24, "pitch": "9/12",
                                                                        "penetrations": 4, "ridge_vent": True}}},
    {"name": "roof cut-up words", "job": {"kind": "roof", "roof": {"squares": 42, "eave_ft": 210, "rake_ft": 96,
                                                                    "ridge_ft": 70, "hip_ft": 40, "valley_ft": 60,
                                                                    "roof_type": "cut-up", "pitch": "steep"}}},
    {"name": "siding vinyl", "job": {"kind": "siding", "siding": {"material": "vinyl", "wall_sqft": 1850,
                                                                  "openings": 14, "wall_height_ft": 18,
                                                                  "outside_corners": 4, "inside_corners": 2,
                                                                  "bottom_ft": 170, "rake_ft": 64}}},
    {"name": "siding hardie", "job": {"kind": "siding", "siding": {"material": "James Hardie", "squares": 22,
                                                                   "opening_perimeter_ft": 230, "wall_height_ft": 9,
                                                                   "outside_corners": 6, "inside_corners": 2,
                                                                   "bottom_ft": 180, "exposure_in": 6.25}}},
    {"name": "siding insulated no height", "job": {"kind": "siding", "siding": {"material": "insulated_vinyl",
                                                                                "wall_sqft": 1200, "outside_corners": 4,
                                                                                "bottom_ft": 140}}},
    {"name": "gutters snow", "job": {"kind": "gutters", "gutters": {"feet": 142, "runs": 4, "corners": 2,
                                                                    "height_ft": 10}}},
    {"name": "gutters no snow", "job": {"kind": "gutters", "gutters": {"feet": 60, "snow": False}}},
    {"name": "mixed", "job": {"kind": "mixed", "name": "The Edge bldg 3",
                              "roof": {"squares": 24, "eave_ft": 120, "rake_ft": 70, "ridge_ft": 45},
                              "siding": {"material": "hardie", "wall_sqft": 2100, "openings": 18, "outside_corners": 4,
                                         "bottom_ft": 190, "wall_height_ft": 20},
                              "gutters": {"feet": 120, "runs": 2}}},
    {"name": "roof accessories only", "job": {"kind": "roof", "roof": {"eave_ft": 45, "rake_ft": 30}}},
]


def export_rules(cfg=None, now=None):
    """The takeoff rules as ONE JSON doc for the HMP App (db path `system/takeoff`), with test cases the page's
    JavaScript (docs/app/takeoff.js) checks itself against."""
    from datetime import datetime, timezone
    doc = build_rules(cfg)
    doc["test_cases"] = [{"name": t["name"], "job": t["job"], "expect": takeoff(t["job"], cfg)}
                         for t in RULE_TEST_JOBS]
    now = now or datetime.now(timezone.utc)
    doc["updated_at"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    return doc
