"""Hail report for one address (T32): the storm evidence a homeowner and an adjuster can read.

It states what public weather data shows at the property: the estimated hail size (NOAA MRMS radar,
corrected by trusted ground reports), the ground reports nearby with who made them and when, and the
other storm days that reached the address. It is an estimate, not an inspection, and it never says
anything about coverage or deductibles.
"""
import html
import json
import os
import re
from datetime import date, timedelta

from . import mrms, nbhd
from .geo import haversine_mi
from .watch import hail_at

T = {
    "en": {"title": "Hail report", "for": "Property", "storm": "Storm date", "est": "Estimated hail at the property",
           "nearby": "Hail reports near the property that day", "dist": "Distance", "size": "Hail", "who": "Reported by",
           "when": "Time", "none": "No ground reports within {r} miles that day; the estimate comes from radar.",
           "other": "Other storm days with 3/4 inch or larger hail at this address (last 2 years)",
           "noother": "None found.", "sources": "Sources: NOAA MRMS radar hail estimate (about 1 km detail), "
           "National Weather Service local storm reports, NOAA Storm Events Database.",
           "note": "This is an estimate from public weather data, not an inspection. Only an inspection can confirm "
           "damage, and your insurance company decides what a policy covers.", "by": "Prepared by",
           "mi": "mi", "radar": "radar only"},
    "es": {"title": "Reporte de granizo", "for": "Propiedad", "storm": "Fecha de la tormenta",
           "est": "Granizo estimado en la propiedad", "nearby": "Reportes de granizo cerca de la propiedad ese día",
           "dist": "Distancia", "size": "Granizo", "who": "Reportado por", "when": "Hora",
           "none": "No hubo reportes en tierra a menos de {r} millas ese día; el estimado viene del radar.",
           "other": "Otros días de tormenta con granizo de 3/4 de pulgada o más en esta dirección (últimos 2 años)",
           "noother": "Ninguno.", "sources": "Fuentes: estimado de granizo por radar NOAA MRMS (detalle de 1 km aprox.), "
           "reportes de tormenta del Servicio Meteorológico Nacional, base de datos NOAA Storm Events.",
           "note": "Esto es un estimado con datos públicos del clima, no una inspección. Solo una inspección puede "
           "confirmar daños, y su compañía de seguros decide lo que cubre la póliza.", "by": "Preparado por",
           "mi": "mi", "radar": "solo radar"},
}
WHO_ES = {"trained spotter": "observador entrenado", "public": "público", "law enforcement": "policía",
          "emergency mngr": "gestor de emergencias", "mping": "app mPING", "social media": "redes sociales",
          "storm chaser": "cazador de tormentas", "nws employee": "empleado del NWS", "official": "registro oficial NOAA"}


def day_reports(conn, day):
    """The storm day's ground and official hail reports (duplicates left out)."""
    return conn.execute("""SELECT lat, lon, size_in, kind, city, local_time, extra FROM hail_obs
                           WHERE conv_day=? AND kind IN ('ground','official') AND dup_of IS NULL""", (day,)).fetchall()


def evidence(conn, cfg, day, lat, lon, radius_mi=10.0, fused=None, obs=None):
    """What the data shows at (lat, lon) on storm day `day`: {hail, reports[]} (hail None when no radar map).
    For many addresses on one day, pass fused=(grid, meta) from nbhd.fused_grid and obs=day_reports(conn, day)
    so they are computed once (hud.json's hail_evidence, O3.3)."""
    if fused is None:
        grid, meta, _ = nbhd.fused_grid(conn, cfg, day) if mrms.load_grid(cfg, day)[0] is not None else (None, None, [])
    else:
        grid, meta = fused
    est = hail_at(grid, meta, lat, lon) if grid is not None else None
    reports = []
    for r in (obs if obs is not None else day_reports(conn, day)):
        d = haversine_mi(lat, lon, r["lat"], r["lon"])
        if d > radius_mi:
            continue
        try:
            who = (json.loads(r["extra"] or "{}").get("report_source") or "").strip()
        except ValueError:
            who = ""
        reports.append({"dist_mi": round(d, 1), "size_in": r["size_in"], "who": who or r["kind"],
                        "official": r["kind"] == "official", "city": r["city"] or "", "time": r["local_time"] or ""})
    reports.sort(key=lambda x: x["dist_mi"])
    return {"day": day, "hail": None if est is None else round(est, 2), "reports": reports[:8]}


def history(conn, cfg, lat, lon, days_back=730, min_hail=0.75, today=None):
    """[{day, hail}] every radar storm day with min_hail+ at the address, newest first."""
    since = ((today or date.today()) - timedelta(days=days_back)).isoformat()
    out = []
    for (day,) in conn.execute("SELECT conv_day FROM swaths WHERE conv_day >= ? ORDER BY conv_day DESC", (since,)):
        if mrms.load_grid(cfg, day)[0] is None:
            continue
        grid, meta, _ = nbhd.fused_grid(conn, cfg, day)
        h = hail_at(grid, meta, lat, lon)
        if h is not None and h >= min_hail:
            out.append({"day": day, "hail": round(h, 2)})
    return out


def _nice(day, lang):
    d = date.fromisoformat(day)
    if lang == "es":
        m = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
             "noviembre", "diciembre"][d.month - 1]
        return f"{d.day} de {m} de {d.year}"
    return d.strftime("%B %-d, %Y")


def render(address, ev, hist, lang="en", company="HMP Siding & Roofing LLC · Fremont, NE", radius_mi=10.0):
    """One printable page (HTML) in one language."""
    t, e = T[lang], html.escape
    rows = "".join(
        f"<tr><td>{r['dist_mi']:.1f} {t['mi']}</td><td>{r['size_in']:.2f}&Prime;</td>"
        f"<td>{e(WHO_ES.get(r['who'].lower(), r['who']) if lang == 'es' else r['who'])}</td><td>{e(r['time'])}</td></tr>"
        for r in ev["reports"])
    table = (f"<table><tr><th>{t['dist']}</th><th>{t['size']}</th><th>{t['who']}</th><th>{t['when']}</th></tr>{rows}</table>"
             if rows else f"<p>{e(t['none'].format(r=int(radius_mi)))}</p>")
    others = [h for h in hist if h["day"] != ev["day"]]
    other = ("<ul>" + "".join(f"<li>{e(_nice(h['day'], lang))}: {h['hail']:.2f}&Prime;</li>" for h in others) + "</ul>"
             if others else f"<p>{e(t['noother'])}</p>")
    est = f"{ev['hail']:.2f}&Prime;" if ev["hail"] is not None else "&ndash;"
    return f"""<section class="rep" lang="{lang}">
<h1>{e(t['title'])}</h1>
<p class="meta"><b>{e(t['for'])}:</b> {e(address)}<br><b>{e(t['storm'])}:</b> {e(_nice(ev['day'], lang))}</p>
<div class="big"><span>{e(t['est'])}</span><strong>{est}</strong></div>
<h2>{e(t['nearby'])}</h2>{table}
<h2>{e(t['other'])}</h2>{other}
<p class="src">{e(t['sources'])}</p>
<p class="note">{e(t['note'])}</p>
<p class="by">{e(t['by'])}: {e(company)}</p>
</section>"""


PAGE = """<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><style>
body{{font:15px/1.45 -apple-system,"Segoe UI",Roboto,sans-serif;color:#18212b;background:#fff;margin:0;padding:16px}}
.rep{{max-width:720px;margin:0 auto 32px;padding-bottom:24px;border-bottom:2px solid #18212b}}
h1{{font-size:26px;margin:0 0 8px}} h2{{font-size:16px;margin:18px 0 6px}}
.big{{display:flex;justify-content:space-between;align-items:baseline;gap:12px;background:#f3e6dc;border-left:4px solid #93542a;
padding:12px 14px;margin:12px 0}} .big strong{{font-size:30px}}
table{{width:100%;border-collapse:collapse;font-size:14px}} th,td{{text-align:left;padding:6px 8px 6px 0;border-bottom:1px solid #d3d9e0}}
.src,.by{{color:#56616e;font-size:13px}} .note{{font-size:13px;border:1px solid #d3d9e0;padding:8px 10px}}
@media print{{.rep{{page-break-after:always;border:0}}}}
</style></head><body>{body}</body></html>"""


def write(path, address, ev, hist, langs=("en", "es"), company=None):
    """company: the 'Prepared by' line (config.company_label(cfg)); None keeps HMP's."""
    kw = {"company": company} if company else {}
    body = "\n".join(render(address, ev, hist, lang, **kw) for lang in langs)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(PAGE.format(title=html.escape(f"Hail report: {address}"), body=body))
    return path


def find_parcel(conn, address, city=None):
    """The stored building whose address matches (case-insensitive), or None."""
    q, a = "SELECT * FROM parcels WHERE lower(address) = lower(?)", [address.strip()]
    if city:
        q += " AND lower(city) = lower(?)"
        a.append(city.strip())
    return conn.execute(q, a).fetchone()


def slug(address):
    return re.sub(r"[^a-z0-9]+", "_", address.lower()).strip("_")[:60]
