"""NCEI Storm Events Database: the official, quality-checked record (2-4 month lag).
Yearly 'details' files; a new upload gets a new file name, so the cache refreshes itself."""
import io
import re
from datetime import datetime, timedelta, timezone

import pandas as pd

from ..models import Obs

NAME = "stormevents"
FULL_WINDOW = True   # records for old storms appear months later, so always scan the whole window
DIR = "https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/"
PAT = re.compile(r"StormEvents_details-ftp_v1\.0_d(\d{4})_c(\d{8})\.csv\.gz")
STATE_NAMES = {"NE": "NEBRASKA", "IA": "IOWA", "KS": "KANSAS", "SD": "SOUTH DAKOTA",
               "MO": "MISSOURI", "MN": "MINNESOTA", "ND": "NORTH DAKOTA", "CO": "COLORADO",
               "WY": "WYOMING", "OK": "OKLAHOMA", "IL": "ILLINOIS", "WI": "WISCONSIN"}
COLS = {"EVENT_ID", "EPISODE_ID", "STATE", "EVENT_TYPE", "CZ_NAME", "WFO", "BEGIN_DATE_TIME",
        "CZ_TIMEZONE", "DAMAGE_PROPERTY", "SOURCE", "MAGNITUDE", "BEGIN_LOCATION",
        "BEGIN_LAT", "BEGIN_LON", "EVENT_NARRATIVE", "EPISODE_NARRATIVE"}


def list_files(fetcher):
    html = fetcher.get(DIR, ttl=12 * 3600).decode("utf-8", "replace")
    latest = {}
    for m in PAT.finditer(html):
        y, c = int(m.group(1)), m.group(2)
        if y not in latest or c > latest[y][0]:
            latest[y] = (c, DIR + m.group(0))
    return latest


def urls(cfg, start, end, fetcher):
    files = list_files(fetcher)
    for y in range(start.year, end.year + 1):
        if y in files:
            yield files[y][1], None, datetime(y, 1, 1, tzinfo=timezone.utc)


def _offset_hours(tz):
    m = re.search(r"([+-]\d+)\s*$", str(tz or ""))
    return int(m.group(1)) if m else -6


def parse(content, cfg):
    comp = "gzip" if content[:2] == b"\x1f\x8b" else None
    df = pd.read_csv(io.BytesIO(content), compression=comp, dtype=str, keep_default_na=False,
                     usecols=lambda c: c in COLS, low_memory=False)
    want = {STATE_NAMES[s] for s in cfg["states"] if s in STATE_NAMES}
    df = df[(df["EVENT_TYPE"].str.strip() == "Hail") & (df["STATE"].str.strip().isin(want))]
    abbrev = {v: k for k, v in STATE_NAMES.items()}
    out = []
    for r in df.to_dict("records"):
        try:
            lat, lon, size = float(r["BEGIN_LAT"]), float(r["BEGIN_LON"]), float(r["MAGNITUDE"])
            local = datetime.strptime(r["BEGIN_DATE_TIME"].strip(), "%d-%b-%y %H:%M:%S")
        except (ValueError, KeyError):
            continue
        # Times are local *standard* time, zone given like 'CST-6'.
        valid = (local - timedelta(hours=_offset_hours(r.get("CZ_TIMEZONE")))).replace(tzinfo=timezone.utc)
        text = (r.get("EVENT_NARRATIVE") or r.get("EPISODE_NARRATIVE") or "").strip()
        out.append(Obs(
            uid=f"se:{r['EVENT_ID']}", source=NAME, kind="official", valid_utc=valid,
            lat=lat, lon=lon, size_in=size, city=(r.get("BEGIN_LOCATION") or "").title(),
            county=(r.get("CZ_NAME") or "").title(), state=abbrev.get(r["STATE"].strip(), ""),
            remark=text[:600], weight=1.0,
            extra={"damage_property": r.get("DAMAGE_PROPERTY", ""), "report_source": r.get("SOURCE", ""),
                   "episode_id": r.get("EPISODE_ID", ""), "wfo": r.get("WFO", "")}))
    return out
