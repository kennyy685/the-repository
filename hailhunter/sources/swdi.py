"""NEXRAD Level-III hail signatures (NCEI Severe Weather Data Inventory, 'nx3hail').
One row per storm cell per radar scan with the algorithm's max hail size estimate."""
import csv
import io

from ..geo import bbox_for_radius
from ..models import Obs, parse_utc
from . import chunks, ttl_for

NAME = "swdi"
BASE = "https://www.ncei.noaa.gov/swdiws/csv/nx3hail"


def urls(cfg, start, end, fetcher=None):
    h = cfg["home"]
    bbox = ",".join(f"{v:.3f}" for v in bbox_for_radius(h["lat"], h["lon"], cfg["hunt_radius_mi"]))
    for s, e in chunks(start, end, cfg["chunk_days"]):
        yield f"{BASE}/{s:%Y%m%d}:{e:%Y%m%d}?bbox={bbox}", ttl_for(e), s


def parse(content, cfg):
    keep_from = cfg["thresholds"]["radar_min_in"] * 0.75
    out, header = [], None
    for row in csv.reader(io.StringIO(content.decode("utf-8", "replace"))):
        if not row:
            continue
        if header is None:
            if row[0].strip().upper() == "ZTIME":
                header = [c.strip().upper() for c in row]
            continue
        if len(row) != len(header):
            break                      # reached the trailing 'summary' block
        r = dict(zip(header, (c.strip() for c in row)))
        try:
            size, lat, lon = float(r["MAXSIZE"]), float(r["LAT"]), float(r["LON"])
            valid = parse_utc(r["ZTIME"])
        except (ValueError, KeyError):
            continue
        if size < keep_from:
            continue
        sev = float(r.get("SEVPROB") or 0)
        out.append(Obs(
            uid=f"swdi:{valid:%Y%m%d%H%M%S}:{r.get('WSR_ID','')}:{r.get('CELL_ID','')}",
            source=NAME, kind="radar", valid_utc=valid, lat=lat, lon=lon, size_in=size,
            weight=round(0.3 + 0.5 * sev / 100.0, 3),
            extra={"radar": r.get("WSR_ID", ""), "cell": r.get("CELL_ID", ""),
                   "prob": float(r.get("PROB") or 0), "sevprob": sev}))
    return out
