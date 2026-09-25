"""Nebraska Statewide Parcels (state GIS, compiled from every county assessor):
address, year built, size, value, last sale, property type - for every property.

Downloaded in ~3-mile tiles only where hail fell, kept in the parcels table, refreshed every 180 days.
Property type codes (Neb. Admin. Code Title 350 ch. 10): 01 single family, 02 multi-family,
03 commercial, 04 industrial, 05 agricultural, 07 mobile home. Some counties (Lancaster) leave the
type blank; there the zoning digit is used instead (marked 'inferred')."""
import re
import string
import time
from datetime import datetime, timedelta, timezone

import numpy as np

from .models import iso

URL = "https://gis.ne.gov/Enterprise/rest/services/StatewideParcelsExternal/FeatureServer/0/query"
FIELDS = ("State_PID,Parcel_ID,County_ID,Situs_Address,Ph_Rd_Num,Ph_Pre_Dir,Ph_Rd_Name,Ph_Rd_Type,Ph_Suf_Dir,"
          "Ph_City,Ph_Zip5,BuildingYear,Classification_Code,Property_Parcel_Type,Property_Parcel_Status,Zoning,"
          "ImpSF,Improvements_Value,Total_Assessed_Value,QualImp,CondImp,Sales_Date,Subdivision,Parcel_URL,GIS_Acres")
TILE = 0.05                                     # degrees (~3.5 x 2.6 miles)
TYPES = {"01": "single", "02": "multi", "03": "commercial", "04": "industrial", "05": "farm", "07": "mobile"}
BY_ZONING = {"01": "single", "02": "multi", "03": "commercial", "04": "industrial"}
UNIT_RE = re.compile(r"\b(UNIT|APT|LOT|STE|SUITE|BLDG|TRLR|SPC)\.?\s*#?\s*([A-Z0-9-]+)|#\s*([A-Z0-9-]+)", re.I)
NE_BOX = (-104.06, 39.99, -95.30, 43.01)        # Nebraska's bounding box


def _tiles(bbox):
    x0, y0, x1, y1 = bbox
    for i in range(int(np.floor(y0 / TILE)), int(np.floor(y1 / TILE)) + 1):
        for j in range(int(np.floor(x0 / TILE)), int(np.floor(x1 / TILE)) + 1):
            yield i, j


def _tile_box(i, j):
    return (round(j * TILE, 4), round(i * TILE, 4), round((j + 1) * TILE, 4), round((i + 1) * TILE, 4))


def classify(a):
    """-> (kind, inferred) or (None, 0) for vacant/unknown."""
    code = a.get("Classification_Code") or ""
    status = (a.get("Property_Parcel_Status") or code[:2]).strip()
    if status != "01":                                    # 01 = improved (has a building)
        return None, 0
    t = (a.get("Property_Parcel_Type") or code[2:4]).strip()
    if t in TYPES:
        kind = TYPES[t]
        if kind == "farm" and not (a.get("ImpSF") or 0) > 0:
            return None, 0
        return kind, 0
    if t in ("", "00"):
        z = (a.get("Zoning") or code[4:6]).strip()
        if z in BY_ZONING:
            return BY_ZONING[z], 1
    return None, 0


def _int(x):
    m = re.match(r"\s*(\d+)", str(x or ""))
    return int(m.group(1)) if m else None


def normalize(a):
    street = " ".join(p.strip() for p in (a.get("Ph_Pre_Dir"), a.get("Ph_Rd_Name"), a.get("Ph_Rd_Type"),
                                          a.get("Ph_Suf_Dir")) if p and p.strip()).upper()
    num = _int(a.get("Ph_Rd_Num"))
    situs = (a.get("Situs_Address") or "").upper()
    if not street or num is None:                         # fall back to parsing the one-line address
        seg = re.split(r"\s{2,}", situs.strip())         # Lancaster style: '445 HONOR DR  LINCOLN  NE  68510'
        m = re.match(r"^(\d+)\s+(.+)$", seg[0])
        if not m:
            return None
        num, rest = int(m.group(1)), m.group(2)
        if len(seg) == 1:                                 # single-spaced: drop ' CITY NE 68xxx'
            city = (a.get("Ph_City") or "").upper().strip()
            rest = re.sub(rf"\s+{re.escape(city)}\s+NE\b.*$", "", rest) if city else \
                re.sub(r"\s+[A-Z ]+\s+NE\s+\d{5}.*$", "", rest)
        street = re.sub(r"\s+", " ", rest).strip()
    m_unit = re.search(r"\s+(LOT|UNIT|APT|STE|SUITE|BLDG|TRLR|SPC)\.?\s*#?\s*([A-Z0-9-]+)$", street)
    if m_unit:                                            # unit words sometimes sit inside the street name
        street = street[:m_unit.start()].strip()
    u = UNIT_RE.search(situs.split(street, 1)[-1]) if street in situs else None
    unit = (u.group(2) or u.group(3)) if u else ""
    unit_label = f"{u.group(1).title()} {unit}" if u and u.group(1) else (f"#{unit}" if unit else "")
    return num, street, unit_label


def fetch_tile(session, i, j, retries=2):
    x0, y0, x1, y1 = _tile_box(i, j)
    out, offset = [], 0
    while True:
        params = {"where": "Situs_Address<>''", "geometry": f"{x0},{y0},{x1},{y1}",
                  "geometryType": "esriGeometryEnvelope", "inSR": 4326, "spatialRel": "esriSpatialRelIntersects",
                  "outFields": FIELDS, "returnGeometry": "false", "returnCentroid": "true", "outSR": 4326,
                  "f": "json", "resultOffset": offset, "resultRecordCount": 2000, "orderByFields": "OBJECTID"}
        for k in range(retries + 1):
            try:
                r = session.get(URL, params=params, timeout=120)
                r.raise_for_status()
                d = r.json()
                if "error" in d:
                    raise RuntimeError(str(d["error"])[:200])
                break
            except Exception:
                if k == retries:
                    raise
                time.sleep(2 * (k + 1))
        feats = d.get("features", [])
        out += feats
        if not d.get("exceededTransferLimit") or not feats:
            return out
        offset += len(feats)


def _row(f, tile, now):
    a, c = f.get("attributes") or {}, f.get("centroid") or {}
    if "x" not in c:
        return None
    kind, inferred = classify(a)
    if not kind:
        return None
    n = normalize(a)
    if not n:
        return None
    num, street, unit = n
    pid = a.get("State_PID") or f"{a.get('County_ID')}-{a.get('Parcel_ID')}"
    sale = a.get("Sales_Date")
    city = string.capwords((a.get("Ph_City") or "").strip().lower())
    addr = f"{num} {string.capwords(street.lower())}" + (f" {unit}" if unit else "")   # '11th St', not '11Th St'
    return (pid, a.get("County_ID"), a.get("Parcel_ID"), num, street, unit, addr, city, (a.get("Ph_Zip5") or "").strip(),
            round(c["y"], 6), round(c["x"], 6), kind, inferred, _int(a.get("BuildingYear")),
            a.get("ImpSF") or None, a.get("Improvements_Value") or None, a.get("Total_Assessed_Value") or None,
            a.get("QualImp") or "", a.get("CondImp") or "",
            datetime.fromtimestamp(sale / 1000, tz=timezone.utc).date().isoformat() if sale else None,
            a.get("Subdivision") or "", a.get("Parcel_URL") or "", a.get("GIS_Acres") or None, tile, now)


def ensure_area(conn, session, bbox, max_age_days=180, budget_s=None, log=print):
    """Download any missing/stale tiles covering bbox (Nebraska only). Returns (tiles fetched, parcels stored)."""
    x0, y0, x1, y1 = bbox
    bx0, by0, bx1, by1 = NE_BOX
    bbox = (max(x0, bx0), max(y0, by0), min(x1, bx1), min(y1, by1))
    if bbox[0] >= bbox[2] or bbox[1] >= bbox[3]:
        return 0, 0
    cut = iso(datetime.now(timezone.utc) - timedelta(days=max_age_days))
    fresh = {r[0] for r in conn.execute("SELECT tile FROM parcel_tiles WHERE fetched_utc > ?", (cut,))}
    todo = [t for t in _tiles(bbox) if f"{t[0]}_{t[1]}" not in fresh]
    t0, got, stored = time.monotonic(), 0, 0
    for i, j in todo:
        if budget_s and time.monotonic() - t0 > budget_s:
            log(f"    parcels: time budget reached, {len(todo) - got} tile(s) left - run again")
            break
        key, now = f"{i}_{j}", iso(datetime.now(timezone.utc))
        rows = [r for r in (_row(f, key, now) for f in fetch_tile(session, i, j)) if r]
        conn.executemany("INSERT OR REPLACE INTO parcels VALUES (" + ",".join("?" * 25) + ")", rows)
        conn.execute("INSERT OR REPLACE INTO parcel_tiles VALUES (?,?,?)", (key, now, len(rows)))
        conn.commit()
        got += 1
        stored += len(rows)
    if got:
        log(f"    parcels: {got} tile(s) downloaded, {stored:,} buildings stored")
    return got, stored
