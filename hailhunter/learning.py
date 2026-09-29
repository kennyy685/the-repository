"""The map learns from your knocks (FilthE, 2026-09-28: "the map learns from your knocks"; a lead = a yes to an
inspection; trust comes from a track record).

Every door tapped on the Knock screen is saved with the signals shown at the door, frozen at knock time
(docs/design/knock/README.md: `sig {hail, own, mort, sale, roof, score, stack, rb}`, `zone`, `st`, `o`). Here those
knocks turn into a small, honest track record:

  doors   one per house (a house knocked twice counts once: a yes if any knock there was a yes, else its last outcome);
          "sign" (No Soliciting, skipped) is not a door knocked.
  bands   hail size h0 < 1 in, h1 1-1.5, h2 1.5-2, h3 2+  ·  storm stacking s1 0-1 hail days, s2 2, s3 3+
          likely-insured signals i1 0-1 of 3, i2 2, i3 3 (owner lives here, mortgage on record, bought in the last 10
          yrs)  ·  roof-age band young / prime / check (stacking.roof_band)
  table   counts [doors, yeses] per key: all, z:<zone>, st:<street>, h:<h>, h:<h>|s:<s>, h:<h>|i:<i>, h:<h>|i:<i>|r:<rb>
  rate    smoothed hit rate, shrunk toward the prior when doors are few: (yes + k * p) / (doors + k). The prior p for
          a group = the all-doors rate, itself shrunk toward config `learning.prior_rate` (5%: industry 1-5% of
          knocked doors book an inspection for new-to-top knockers, 8-15% in fresh storm zones).
  like    the most specific group with >= `min_doors` (20) doors; below that anywhere: "Not enough doors yet (7 of 20)".
          Never a rate from a tiny sample. `factor` = rate / all-doors rate, capped (0.85-1.15), 1.0 unless enough.

Pages get the table as JSON (`doc`) and repeat `like` in a few lines of JS (docs/design/knock + open-map) so a fresh
tap moves the line at once. Nothing here says "insured", damage, or what insurance pays: counts of door outcomes only.
The real database stays empty until FilthE knocks; the design pages run on SAMPLE knocks (fake homes).
"""
from datetime import datetime

from .config import DEFAULTS

OUTCOMES = ("na", "no", "back", "roofer", "yes")      # "sign" = skipped, not a door knocked


def lcfg(cfg):
    return {**DEFAULTS["learning"], **((cfg or {}).get("learning") or {})}


# ------------------------------------------------------------------ bands
def hail_band(size_in, cuts=(1.0, 1.5, 2.0)):
    try:
        s = float(size_in)
    except (TypeError, ValueError):
        return None
    return "h" + str(sum(s >= c for c in cuts))


def stack_band(n):
    try:
        n = int(n)
    except (TypeError, ValueError):
        return None
    return "s3" if n >= 3 else ("s2" if n == 2 else "s1")


def ins_count(sig, year):
    """Likely-insured signals at the door (0-3): owner lives here, mortgage on record, bought in the last 10 yrs."""
    sale = sig.get("sale")
    try:
        recent = bool(sale) and int(str(sale)[:4]) >= int(year) - 10
    except (TypeError, ValueError):
        recent = False
    return int(bool(sig.get("own"))) + int(bool(sig.get("mort"))) + int(recent)


def ins_band(count):
    return "i3" if count >= 3 else ("i2" if count == 2 else "i1")


def roof_key(rb):
    return rb if rb in ("young", "prime", "check") else None


def door_keys(sig, year, cuts=(1.0, 1.5, 2.0)):
    """Band keys for one door's frozen signals, most specific first (the door card's back-off chain)."""
    h = hail_band(sig.get("hail"), cuts)
    if not h:
        return []
    i = ins_band(ins_count(sig, year))
    r = roof_key(sig.get("rb"))
    keys = ([f"h:{h}|i:{i}|r:{r}"] if r else []) + [f"h:{h}|i:{i}", f"h:{h}"]
    return keys


def zone_keys(hail_in, stack_n, zone=None, cuts=(1.0, 1.5, 2.0)):
    """The map pick's back-off chain: this zone's own record, zones like it (hail + stacking), same hail."""
    h, s = hail_band(hail_in, cuts), stack_band(stack_n)
    keys = [f"z:{zone}"] if zone else []
    if h and s:
        keys.append(f"h:{h}|s:{s}")
    if h:
        keys.append(f"h:{h}")
    return keys


# ------------------------------------------------------------------ doors + table
def _order(k):
    try:
        m = float(k.get("m") or 0)
    except (TypeError, ValueError):
        m = 0.0
    return (str(k.get("at") or ""), m)


def doors(knocks):
    """One row per house: {door, zone, st, sig, o, yes}. Bad rows are skipped, never fatal."""
    by = {}
    for k in sorted((k for k in knocks or [] if isinstance(k, dict)), key=_order):
        o = k.get("o")
        if o not in OUTCOMES:
            continue
        d = k.get("door") or (f"{k.get('st')}|{k.get('no')}" if k.get("st") else None)
        if not d:
            continue
        row = by.get(d)
        yes = o == "yes" or bool(row and row["yes"])
        by[d] = {"door": d, "zone": k.get("zone"), "st": k.get("st"), "sig": k["sig"] if isinstance(k.get("sig"), dict) else {}, "o": o, "yes": yes,
                 "year": str(k.get("at") or "")[:4]}
    return list(by.values())


def table(knocks, year=None, cfg=None):
    """{key: [doors, yeses]} over every door (see module doc for the keys)."""
    lc = lcfg(cfg)
    cuts = tuple(lc["hail_cuts"])
    t = {}

    def add(key, yes):
        c = t.setdefault(key, [0, 0])
        c[0] += 1
        c[1] += int(yes)

    for r in doors(knocks):
        y = year or r["year"] or datetime.utcnow().year
        add("all", r["yes"])
        if r["zone"]:
            add(f"z:{r['zone']}", r["yes"])
        if r["st"]:
            add(f"st:{r['st']}", r["yes"])
        sig = r["sig"]
        for key in door_keys(sig, y, cuts):
            add(key, r["yes"])
        s = stack_band(sig.get("stack"))
        h = hail_band(sig.get("hail"), cuts)
        if h and s:
            add(f"h:{h}|s:{s}", r["yes"])
    return t


# ------------------------------------------------------------------ rates + lines
def rate(d, y, prior, k):
    return (y + k * prior) / (d + k) if d + k > 0 else prior


def prior_all(t, cfg=None):
    lc = lcfg(cfg)
    d, y = t.get("all", [0, 0])
    return rate(d, y, lc["prior_rate"], lc["prior_doors"])


LABEL = {"z": ("This zone", "Esta zona"), "zone": ("Zones like this", "Zonas como esta"),
         "door": ("Doors like this", "Puertas como esta"), "st": ("This street", "Esta calle"),
         "all": ("All doors so far", "Todas las puertas hasta ahora")}


def line(label, d, y, r=None, need=None):
    en, es = LABEL[label]
    if need is not None:
        return {"en": f"{en}: not enough doors yet ({d} of {need})",
                "es": f"{es}: aún no hay suficientes puertas ({d} de {need})"}
    pct = f" (~{round(r * 100)}%)" if r is not None else ""
    return {"en": f"{en}: {y} inspection {'yes' if y == 1 else 'yeses'} from {d} doors{pct}",
            "es": f"{es}: {y} sí a inspección de {d} puertas{pct}"}


def like(t, keys, kind="zone", cfg=None):
    """Track record for one map pick (kind "zone") or door card (kind "door"), from `table` counts.
    Returns {key, doors, yes, enough, rate, factor, line{en, es}}; rate is None and factor 1.0 unless enough doors."""
    lc = lcfg(cfg)
    need, k = int(lc["min_doors"]), lc["prior_doors"]
    p = prior_all(t, cfg)
    lo, hi = lc["factor_cap"]
    for key in list(keys) + ["all"]:
        d, y = t.get(key, [0, 0])
        if d >= need:
            r = rate(d, y, p, k)
            label = "all" if key == "all" else ("z" if key.startswith("z:") else
                                                ("st" if key.startswith("st:") else kind))
            f = 1.0 if key == "all" else max(lo, min(hi, r / p)) if p > 0 else 1.0
            return {"key": key, "doors": d, "yes": y, "enough": True, "rate": round(r, 4), "factor": round(f, 3),
                    "line": line(label, d, y, r)}
    first = next((key for key in keys if key in t), keys[0] if keys else "all")
    d, y = t.get(first, [0, 0])
    label = "all" if first == "all" else ("z" if first.startswith("z:") else kind)
    return {"key": first, "doors": d, "yes": y, "enough": False, "rate": None, "factor": 1.0,
            "line": line(label, d, y, need=need)}


def doc(knocks, year=None, cfg=None, src="SAMPLE", now=None):
    """What the pages load: the counts table plus the constants their JS twin of `like` needs."""
    lc = lcfg(cfg)
    t = table(knocks, year, cfg)
    d, y = t.get("all", [0, 0])
    return {"v": 1, "as_of": (now or datetime.utcnow()).strftime("%Y-%m-%dT%H:%MZ"), "src": src,
            "doors": d, "yes": y, "prior_rate": lc["prior_rate"], "k": lc["prior_doors"], "min": lc["min_doors"],
            "cap": list(lc["factor_cap"]), "cuts": list(lc["hail_cuts"]), "t": t,
            "note": {"en": "Door outcomes only: a yes = the homeowner agreed to an inspection. Never a verdict on "
                           "coverage.",
                     "es": "Solo resultados de puertas: un sí = el dueño aceptó una inspección. Nunca un juicio "
                           "sobre la cobertura."}}
