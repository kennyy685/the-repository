"""NWS Local Storm Reports via the Iowa Environmental Mesonet GeoJSON API (near real-time)."""
import json

from ..models import Obs, parse_utc
from . import chunks, ttl_for

NAME = "lsr"
BASE = "https://mesonet.agron.iastate.edu/geojson/lsr.geojson"


def urls(cfg, start, end, fetcher=None):
    wfos = ",".join(cfg["wfos"])
    for s, e in chunks(start, end, cfg["chunk_days"]):
        yield f"{BASE}?sts={s:%Y-%m-%dT%H:%MZ}&ets={e:%Y-%m-%dT%H:%MZ}&wfos={wfos}", ttl_for(e), s


def source_weight(cfg, src):
    w = cfg["report_weights"]
    return float(w.get((src or "").strip().lower(), w["default"]))


def parse(content, cfg):
    data = json.loads(content)
    out = []
    for f in data.get("features", []):
        p = f.get("properties") or {}
        if str(p.get("typetext", "")).strip().upper() != "HAIL":
            continue
        try:
            size = float(p.get("magnitude"))
        except (TypeError, ValueError):
            continue
        coords = (f.get("geometry") or {}).get("coordinates") or [p.get("lon"), p.get("lat")]
        try:
            lon, lat = float(coords[0]), float(coords[1])
            valid = parse_utc(p["valid"])
        except (TypeError, ValueError, KeyError, IndexError):
            continue
        src = p.get("source") or ""
        out.append(Obs(
            uid=f"lsr:{valid:%Y%m%d%H%M}:{lat:.3f}:{lon:.3f}",
            source=NAME, kind="ground", valid_utc=valid, lat=lat, lon=lon, size_in=size,
            city=p.get("city") or "", county=p.get("county") or "",
            state=p.get("st") or p.get("state") or "", remark=(p.get("remark") or "").strip(),
            weight=source_weight(cfg, src),
            extra={"report_source": src, "wfo": p.get("wfo") or "",
                   "product_id": p.get("product_id") or "", "qualifier": p.get("qualifier") or ""}))
    return out
