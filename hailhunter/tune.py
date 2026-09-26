"""T35 learning loop (`hh.py tune`): real door results -> small, bounded weight changes.

Reads one or more `hh.py weekly` outputs (their `learning.lists`: each list's and walk's heat/why when it was made,
next to what really happened at the door) and compares the engine's guess with the results. The result measure is
leads per 100 doors = (interested + booked) per 100 doors knocked; "booked" is an inspection (storm walks) or an
estimate visit (everyday walks).

Knobs it may move (only these: config.TUNABLE), at most `tune.max_step` (15%) per knob per run, half way toward what
the doors say (`tune.damping`), and never for a change under `tune.dead_band` (3%):
  everyday.weight           old-house walks vs storm walks, per point of heat (heat already expects everyday to be
                            lower; this only moves when the gap is bigger or smaller than heat said)
  hot_zones.inspect_rate    storm inspections per door at heat 50: booked vs what the engine expected
  everyday.inspect_rate     everyday estimate visits per door at heat 50: same
  hot_zones.compete_factor  storm walks with "other roofers likely here" vs storm walks without, per point of heat
Nothing is tuned until the weekly file(s) hold `tune.min_doors` (50) doors with a heat score; then it says how many
more doors it needs. Each comparison also needs `tune.min_group_doors` (20) on both sides, else that knob waits.

Default is a DRY RUN: the proposal JSON only. `--apply` writes paths.tuned (data/tuned.json, {tuned_weights}) that
config.load merges on top of config.json, and appends to paths.tune_history (data/tune_history.json). The same weekly
file can't be applied twice (its key is in the history). New weights reach new door lists (made by `refresh`);
lists already made keep the heat they were made with.

Output: {status: need_more_doors|no_change|proposal|applied|already_applied, dry_run, key, weeks, doors_used,
min_doors, need_doors, changes[{knob, section, key, old, new, pct, clamped, why{en,es}, evidence}],
skipped[{knob, why{en,es}}], lists[], signals[], tuned_weights, summary{en,es}, file?, history?}.
"""
import json
import os
import re
from datetime import datetime, timezone

from .config import DEFAULTS, TUNABLE

KINDS = ("storm", "everyday")
COMPETE_REASON = "compete"

# plain reason text (doors.hot_zone / everyday.heat `why`) -> a stable key, numbers dropped
REASONS = [
    (r'" hail', "hail"), (r"% owners$", "owners"), (r"^roofs ~", "old_roofs"),
    (r"other roofers likely", COMPETE_REASON), (r"^fresh storm", "fresh_storm"), (r"sold since storm", "sold_since_storm"),
    (r"built before", "old_homes"), (r"^median home built", "old_homes"), (r"mostly owner-occupied", "owners"),
    (r"% owner-occupied", "owners"), (r"mostly renters", "renters"), (r"bought in the last", "recent_buyers"),
    (r"built since", "new_homes"), (r"^high-end homes", "high_value"), (r"^lower home values", "low_value"),
    (r"^homes ~", "good_value"), (r" mi from ", "close_to_base"),
]


def reason_key(text):
    t = str(text or "")
    for pat, key in REASONS:
        if re.search(pat, t):
            return key
    return "other"


def _num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def settings(cfg=None):
    return {**DEFAULTS["tune"], **((cfg or {}).get("tune") or {})}


# ------------------------------------------------------------------ reading weekly outputs
def weekly_docs(obj):
    """A weekly doc, a list of them, or {"weeks": [...]} -> [weekly docs]."""
    if isinstance(obj, dict) and isinstance(obj.get("weeks"), list) and "learning" not in obj:
        obj = obj["weeks"]
    docs = obj if isinstance(obj, list) else [obj]
    return [d for d in docs if isinstance(d, dict)]


def rows(docs):
    """One row per walk (or per list when it has no walks) with a heat score and a known kind:
    {list_id, walk_id, kind, heat, why, reasons, doors, interested, booked, leads}. Also returns doors left out."""
    out, left_out = [], 0
    for doc in docs:
        for L in ((doc.get("learning") or {}).get("lists") or []):
            kind = L.get("kind")
            walks = [w for w in L.get("walks") or [] if (w.get("doors") or 0) > 0]
            parts = walks or [L]
            for w in parts:
                n = int(w.get("doors") or 0)
                heat = _num(w.get("heat")) if w is not L else None
                heat = heat if heat is not None else _num(L.get("heat"))
                why = (w.get("why") or L.get("why") or []) if w is not L else (L.get("why") or [])
                if kind not in KINDS or heat is None or heat <= 0 or n <= 0:
                    left_out += n
                    continue
                inter, booked = int(w.get("interested") or 0), int(w.get("booked") or 0)
                out.append({"week": doc.get("week"), "list_id": L.get("list_id"), "walk_id": w.get("walk_id"),
                            "kind": kind, "area": L.get("area"), "heat": float(heat), "why": list(why),
                            "list_why": list(L.get("why") or why),
                            "reasons": sorted({reason_key(x) for x in why}), "doors": n, "interested": inter,
                            "booked": booked, "leads": inter + booked})
    return out, left_out


def run_key(docs):
    """Identifies the weekly file(s): the same key can't be applied twice."""
    return ";".join(sorted(f"{d.get('week')}@{d.get('as_of')}:{(d.get('totals') or {}).get('doors')}" for d in docs))


# ------------------------------------------------------------------ comparing
def group(rs):
    """Totals for a set of rows. per_heat = leads per 100 doors per point of (door-weighted) heat: how much a walk
    beat or missed what its heat said."""
    doors = sum(r["doors"] for r in rs)
    leads = sum(r["leads"] for r in rs)
    booked = sum(r["booked"] for r in rs)
    heat = sum(r["heat"] * r["doors"] for r in rs) / doors if doors else 0.0
    lp = 100.0 * leads / doors if doors else 0.0
    return {"walks": len(rs), "doors": doors, "leads": leads, "booked": booked, "avg_heat": round(heat, 1),
            "leads_per_100": round(lp, 1), "per_heat": lp / heat if heat else 0.0}


def _ratio(a, b):
    """a / b for two per_heat numbers; None when neither side has a lead yet."""
    if a == 0 and b == 0:
        return None
    return float("inf") if b == 0 else a / b


def _step(ratio, s):
    """Raw ratio (what the doors say / what the engine said) -> the bounded step (fraction, e.g. 0.15)."""
    raw = s["max_step"] if ratio == float("inf") else s["damping"] * (ratio - 1.0)
    step = max(-s["max_step"], min(s["max_step"], raw))
    return round(step, 4), abs(raw) > s["max_step"]


def _fmt(x):
    return f"{x:.1f}".rstrip("0").rstrip(".")


def _pl(n, one, many):
    return f"{n} {one if n == 1 else many}"


def _times(a, b):
    """'2x' style comparison of two rates for sentences; None when it can't be said."""
    if b == 0:
        return None
    return _fmt(a / b)


def _kind_balance(rs, s):
    st, ev = group([r for r in rs if r["kind"] == "storm"]), group([r for r in rs if r["kind"] == "everyday"])
    ev_txt = {"en": "Old-house (everyday) walks vs storm walks", "es": "Rutas de casas viejas vs rutas de tormenta"}
    if min(st["doors"], ev["doors"]) < s["min_group_doors"]:
        return None, _wait(ev_txt, s, (st["doors"], ev["doors"]))
    ratio = _ratio(ev["per_heat"], st["per_heat"])
    ev_d = {"storm": st, "everyday": ev, "ratio_per_heat": None if ratio in (None, float("inf")) else round(ratio, 3)}
    for g in (st, ev):
        g.pop("per_heat", None)
    if ratio is None:
        return None, _no_leads(ev_txt)
    step, clamped = _step(ratio, s)
    q = _times(ev["leads_per_100"], st["leads_per_100"])
    if q is None:
        head_en = f"Old-house streets are getting leads ({_fmt(ev['leads_per_100'])} per 100 doors) and storm streets none"
        head_es = (f"Las calles de casas viejas están dando clientes ({_fmt(ev['leads_per_100'])} por cada 100 puertas) "
                   f"y las de tormenta ninguno")
    elif float(q) >= 1.1:
        head_en, head_es = (f"Old-house streets are booking {q}x storm streets",
                            f"Las calles de casas viejas están dando {q}x lo de las calles de tormenta")
    elif float(q) <= 0.9:
        head_en, head_es = (f"Old-house streets are booking {q}x what storm streets book",
                            f"Las calles de casas viejas están dando {q}x lo de las calles de tormenta")
    else:
        head_en, head_es = ("Old-house streets are booking about the same as storm streets",
                            "Las calles de casas viejas están dando casi lo mismo que las de tormenta")
    detail_en = (f" ({_fmt(ev['leads_per_100'])} vs {_fmt(st['leads_per_100'])} interested or booked per 100 doors; "
                 f"heat said {_fmt(ev['avg_heat'])} vs {_fmt(st['avg_heat'])})")
    detail_es = (f" ({_fmt(ev['leads_per_100'])} vs {_fmt(st['leads_per_100'])} interesados o con cita por cada 100 "
                 f"puertas; el sistema calculaba {_fmt(ev['avg_heat'])} vs {_fmt(st['avg_heat'])})")
    pct = round(abs(step) * 100)
    if step > 0:
        act_en, act_es = f"raising the everyday weight {pct}%", f"subimos el peso de las casas viejas {pct}%"
    else:
        act_en, act_es = f"lowering the everyday weight {pct}%", f"bajamos el peso de las casas viejas {pct}%"
    why = {"en": f"{head_en}{detail_en}: {act_en}.", "es": f"{head_es}{detail_es}: {act_es}."}
    return (step, clamped, why, ev_d), None


def _calibration(rs, kind, s, cfg):
    sec = "hot_zones" if kind == "storm" else "everyday"
    rate = float(cfg[sec]["inspect_rate"])
    g = group([r for r in rs if r["kind"] == kind])
    txt = ({"en": "Storm inspections booked vs expected", "es": "Inspecciones de tormenta agendadas vs esperadas"}
           if kind == "storm" else
           {"en": "Old-house estimate visits booked vs expected",
            "es": "Citas de presupuesto (casas viejas) agendadas vs esperadas"})
    if g["doors"] < s["min_group_doors"]:
        return None, _wait(txt, s, (g["doors"],))
    expected = sum(r["doors"] * rate * r["heat"] / 50.0 for r in rs if r["kind"] == kind)
    if expected <= 0:
        return None, {"en": f"{txt['en']}: nothing expected yet.", "es": f"{txt['es']}: todavía no se esperaba nada."}
    ratio = g["booked"] / expected
    step, clamped = _step(ratio, s)
    pct = round(abs(step) * 100)
    b, x = g["booked"], _fmt(round(expected, 1))
    if kind == "storm":
        en = f"Storm walks booked {_pl(b, 'inspection', 'inspections')} where the engine expected {x}"
        es = f"Las rutas de tormenta agendaron {_pl(b, 'inspección', 'inspecciones')} y el sistema esperaba {x}"
        what_en, what_es = "the storm booking guess", "el cálculo de inspecciones de tormenta"
    else:
        en = f"Old-house walks booked {_pl(b, 'estimate visit', 'estimate visits')} where the engine expected {x}"
        es = (f"Las rutas de casas viejas agendaron {_pl(b, 'cita de presupuesto', 'citas de presupuesto')} y el "
              f"sistema esperaba {x}")
        what_en, what_es = "the old-house booking guess", "el cálculo de citas de casas viejas"
    act_en = f"{'raising' if step > 0 else 'lowering'} {what_en} {pct}%"
    act_es = f"{'subimos' if step > 0 else 'bajamos'} {what_es} {pct}%"
    why = {"en": f"{en} ({g['doors']} doors): {act_en}.", "es": f"{es} ({g['doors']} puertas): {act_es}."}
    return (step, clamped, why, {"doors": g["doors"], "booked": b, "expected": round(expected, 2),
                                 "ratio": round(ratio, 3)}), None


def _compete(rs, s):
    storm = [r for r in rs if r["kind"] == "storm"]
    w, wo = group([r for r in storm if COMPETE_REASON in r["reasons"]]), \
        group([r for r in storm if COMPETE_REASON not in r["reasons"]])
    txt = {"en": "Storm walks with other roofers around vs without",
           "es": "Rutas de tormenta con otros techadores cerca vs sin ellos"}
    if min(w["doors"], wo["doors"]) < s["min_group_doors"]:
        return None, _wait(txt, s, (w["doors"], wo["doors"]))
    ratio = _ratio(w["per_heat"], wo["per_heat"])
    ev = {"with": {k: v for k, v in w.items() if k != "per_heat"},
          "without": {k: v for k, v in wo.items() if k != "per_heat"},
          "ratio_per_heat": None if ratio in (None, float("inf")) else round(ratio, 3)}
    if ratio is None:
        return None, _no_leads(txt)
    step, clamped = _step(ratio, s)
    pct = round(abs(step) * 100)
    better = step > 0
    en = (f"Storm streets where other roofers are likely are doing {'better' if better else 'worse'} than the engine "
          f"guessed ({_fmt(w['leads_per_100'])} vs {_fmt(wo['leads_per_100'])} interested or booked per 100 doors): "
          f"{'softening' if better else 'deepening'} the other-roofers cut {pct}%.")
    es = (f"Las calles de tormenta donde probablemente hay otros techadores están dando "
          f"{'más' if better else 'menos'} de lo que calculaba el sistema ({_fmt(w['leads_per_100'])} vs "
          f"{_fmt(wo['leads_per_100'])} interesados o con cita por cada 100 puertas): "
          f"{'suavizamos' if better else 'aumentamos'} el descuento por otros techadores {pct}%.")
    return (step, clamped, {"en": en, "es": es}, ev), None


def _wait(txt, s, sides):
    have = min(sides)
    return {"en": f"{txt['en']}: waiting for {s['min_group_doors']} doors on each side (have {have}).",
            "es": f"{txt['es']}: esperando {s['min_group_doors']} puertas de cada lado (hay {have})."}


def _no_leads(txt):
    return {"en": f"{txt['en']}: no leads on either side yet.",
            "es": f"{txt['es']}: todavía no hay clientes en ningún lado."}


def _signals(rs):
    """Per reason, per kind: leads per 100 doors on walks that showed it vs walks that didn't (info only)."""
    out = []
    for kind in KINDS:
        k_rows = [r for r in rs if r["kind"] == kind]
        for key in sorted({x for r in k_rows for x in r["reasons"]}):
            w = group([r for r in k_rows if key in r["reasons"]])
            wo = group([r for r in k_rows if key not in r["reasons"]])
            ratio = _ratio(w["per_heat"], wo["per_heat"]) if wo["doors"] else None
            out.append({"kind": kind, "reason": key, "doors_with": w["doors"], "leads_per_100_with": w["leads_per_100"],
                        "doors_without": wo["doors"], "leads_per_100_without": wo["leads_per_100"],
                        "vs_heat": None if ratio in (None, float("inf")) else round(ratio, 3)})
    return out


def _lists(rs):
    """Each list: its heat vs its real leads per 100 doors, and vs what all walks' leads-per-heat would expect."""
    overall = group(rs)["per_heat"]
    by = {}
    for r in rs:
        by.setdefault((r["kind"], r["list_id"]), []).append(r)
    out = []
    for (kind, lid), grp in sorted(by.items(), key=lambda x: (x[0][0], str(x[0][1]))):
        g = group(grp)
        exp = overall * g["avg_heat"]
        out.append({"list_id": lid, "kind": kind, "area": grp[0]["area"], "heat": g["avg_heat"],
                    "why": grp[0]["list_why"], "doors": g["doors"], "leads": g["leads"], "booked": g["booked"],
                    "leads_per_100": g["leads_per_100"], "expected_leads_per_100": round(exp, 1),
                    "vs_expected": round(g["leads_per_100"] / exp, 2) if exp else None})
    return out


# ------------------------------------------------------------------ the proposal
def propose(weekly, cfg, min_doors=None):
    """Dry run: the proposal doc (nothing written). `weekly` = a weekly doc or a list of them."""
    s = settings(cfg)
    min_doors = int(min_doors if min_doors is not None else s["min_doors"])
    docs = weekly_docs(weekly)
    rs, left_out = rows(docs)
    used = sum(r["doors"] for r in rs)
    doc = {"status": None, "dry_run": True, "key": run_key(docs), "weeks": [d.get("week") for d in docs],
           "doors_used": used, "doors_left_out": left_out, "min_doors": min_doors,
           "need_doors": max(0, min_doors - used), "changes": [], "skipped": [], "lists": _lists(rs),
           "signals": _signals(rs), "settings": {k: s[k] for k in ("max_step", "damping", "dead_band",
                                                                   "min_group_doors")},
           "tuned_weights": current(cfg)}
    if used < min_doors:
        n = min_doors - used
        doc["status"] = "need_more_doors"
        doc["summary"] = {
            "en": f"Need {n} more doors before the engine tunes itself ({used} of {min_doors} doors with a heat "
                  f"score so far). No weights changed.",
            "es": f"Faltan {n} puertas más para que el sistema se ajuste solo ({used} de {min_doors} puertas con "
                  f"puntaje hasta ahora). No se cambió ningún peso."}
        return doc

    checks = [("everyday", "weight", _kind_balance(rs, s)),
              ("hot_zones", "inspect_rate", _calibration(rs, "storm", s, cfg)),
              ("everyday", "inspect_rate", _calibration(rs, "everyday", s, cfg)),
              ("hot_zones", "compete_factor", _compete(rs, s))]
    tuned = current(cfg)
    for sec, key, (res, wait) in checks:
        knob = f"{sec}.{key}"
        if res is None:
            doc["skipped"].append({"knob": knob, "why": wait})
            continue
        step, clamped, why, evidence = res
        old = float(cfg[sec][key])
        if abs(step) < s["dead_band"]:
            doc["skipped"].append({"knob": knob, "why": {
                "en": f"{knob}: results match the engine's guess (off by under {round(s['dead_band'] * 100)}%), "
                      f"no change.",
                "es": f"{knob}: los resultados coinciden con el cálculo del sistema (menos de "
                      f"{round(s['dead_band'] * 100)}% de diferencia), sin cambio."}, "evidence": evidence})
            continue
        lo, hi = TUNABLE[sec][key]
        new = round(min(hi, max(lo, old * (1 + step))), 5)
        if new == round(old, 5):
            doc["skipped"].append({"knob": knob, "why": {
                "en": f"{knob} is already at its limit ({old:g}), no change.",
                "es": f"{knob} ya está en su límite ({old:g}), sin cambio."}, "evidence": evidence})
            continue
        doc["changes"].append({"knob": knob, "section": sec, "key": key, "old": old, "new": new,
                               "pct": round(100 * (new - old) / old, 1), "clamped": clamped or new in (lo, hi),
                               "why": why, "evidence": evidence})
        tuned.setdefault(sec, {})[key] = new
    doc["tuned_weights"] = tuned
    if doc["changes"]:
        doc["status"] = "proposal"
        doc["summary"] = {"en": " ".join(c["why"]["en"] for c in doc["changes"]),
                          "es": " ".join(c["why"]["es"] for c in doc["changes"])}
    else:
        doc["status"] = "no_change"
        doc["summary"] = {"en": f"{used} doors checked: the engine's guesses hold up (or need more doors per "
                                f"comparison). No weights changed.",
                          "es": f"Se revisaron {used} puertas: los cálculos del sistema van bien (o faltan puertas "
                                f"por comparación). No se cambió ningún peso."}
    return doc


def current(cfg):
    """The tunable knobs' current values (after config.json + data/tuned.json)."""
    return {sec: {k: float(cfg[sec][k]) for k in keys if k in cfg.get(sec, {})} for sec, keys in TUNABLE.items()}


def _read(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def apply(doc, cfg, tuned_path=None, history_path=None, now=None):
    """Writes a `proposal` doc: tuned_path (data/tuned.json) + one history entry. Returns the doc, updated."""
    s = settings(cfg)
    tuned_path = tuned_path or cfg["paths"]["tuned"]
    history_path = history_path or cfg["paths"]["tune_history"]
    history = _read(history_path, [])
    history = history if isinstance(history, list) else []
    doc = {**doc, "dry_run": False}
    if doc["status"] != "proposal":
        return doc
    if any(h.get("key") == doc["key"] and h.get("applied") for h in history if isinstance(h, dict)):
        doc["status"] = "already_applied"
        doc["summary"] = {"en": "These weekly results were already used for a tune. Nothing changed.",
                          "es": "Estos resultados semanales ya se usaron para un ajuste. No cambió nada."}
        return doc
    at = (now or datetime.now(timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ")
    old_file = _read(tuned_path, {})
    weights = (old_file.get("tuned_weights") if isinstance(old_file, dict) else None) or {}
    for c in doc["changes"]:
        weights.setdefault(c["section"], {})[c["key"]] = c["new"]
    os.makedirs(os.path.dirname(os.path.abspath(tuned_path)), exist_ok=True)
    with open(tuned_path, "w", encoding="utf-8") as f:
        json.dump({"tuned_weights": weights, "updated_utc": at, "updated_by": "hh.py tune", "key": doc["key"],
                   "note": "T35 learning loop: merged on top of config.json by config.load (TUNABLE keys only). "
                           "Delete this file to go back to config.json."}, f, indent=1, ensure_ascii=False)
        f.write("\n")
    history.append({"at": at, "key": doc["key"], "weeks": doc["weeks"], "doors_used": doc["doors_used"],
                    "applied": True, "changes": [{k: c[k] for k in ("knob", "old", "new", "pct", "clamped")}
                                                 for c in doc["changes"]],
                    "summary": doc["summary"]})
    history = history[-int(s["history_max"]):]
    os.makedirs(os.path.dirname(os.path.abspath(history_path)), exist_ok=True)
    with open(history_path, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=1, ensure_ascii=False)
        f.write("\n")
    doc.update(status="applied", file=tuned_path, history=history_path, tuned_weights=weights)
    return doc
