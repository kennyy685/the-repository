"""Per-house owner-occupied flag from county assessor data (T23).

The statewide parcel layer (parcels.py) has no owner mailing address or homestead flag, so door lists used the
neighborhood's owner share. Some counties publish the owner's MAILING address next to the situs (house) address:
same address = the owner lives there (owner_occupied True); a different mailing address = a landlord or investor
(False); blank or a PO box = unknown (None).

Privacy rule (CLAUDE.md): owner NAMES are never requested, stored or exported, and the mailing address is compared
in memory and thrown away. The cache table `owner_occ` keeps only the house's own address key, point, the boolean,
the last sale date and the source name.

Sources checked 2026-09-26 (from the cloud session's network):
- sarpy: Sarpy County's `Parcel_Sales2` layer on ArcGIS Online (every parcel, ~77k, with OwnerAddress/City/Zip,
  Situs, SaleDate, PropertyClass). WORKS.
- douglas: dcgis.org Parcels_public FeatureServer (DC Assessor). Owner mailing street = ADDRESS2 (ADDRESS1 is a
  "C/O" line), OWNER_ZIP; house = PROPERTY_A + PROP_ZIP. No sale date. Polygons: asks the server for centroids.
  WORKS.
- lancaster: gis.lincoln.ne.gov Assessor/TaxParcels MapServer/0. Mailing = PSTLADDRESS + PSTLZIP5; house =
  SITEADDRESS ("4240 RANDOLPH ST, LINCOLN, NE, 68510": the zip is read off its end). No sale date. MapServer: no
  centroids, so the polygon's vertices are averaged. WORKS.
- dodge (dodge.gisworkshop.com, GIS Workshop eCounty viewer): its TLS certificate is expired (https) and http is
  refused (403); ArcGIS Hub lists no other Dodge County NE parcel layer. NOT wired (never skip TLS checks).
Numbered streets are compared without the ordinal ("S 114 ST" = "S 114TH ST"): the counties differ.

Downloads by the same ~3-mile tiles as parcels.py, only for tiles a door list touches, paged 2000 at a time with a
pause between pages, cached for `max_age_days` (180). `lookup` is offline: it reads the cache only.
"""
import re
import time
from datetime import datetime, timedelta, timezone

from .geo import haversine_mi
from .models import iso
from .parcels import _tile_box, _tiles

SOURCES = {
    "sarpy": {
        "url": "https://services.arcgis.com/OiG7dbwhQEWoy77N/arcgis/rest/services/Parcel_Sales2/FeatureServer/0/query",
        "bbox": (-96.36, 40.98, -95.82, 41.25),        # Sarpy County, padded
        # never add OwnerName1/OwnerName2 here (no owner names for homes)
        "fields": "PIN,Situs,SitusPostalZip,OwnerAddress,OwnerState,OwnerZip,SaleDate,PropertyClass",
        "id": "PIN", "situs": "Situs", "situs_zip": "SitusPostalZip",
        "owner_addr": "OwnerAddress", "owner_zip": "OwnerZip", "sale": "SaleDate",
        "label": "Sarpy County assessor (owner mailing address)",
    },
    "douglas": {
        "url": "https://dcgis.org/server/rest/services/vector/Parcels_public/FeatureServer/0/query",
        "bbox": (-96.476, 41.189, -95.869, 41.395),     # Douglas County (service extent 2026-09-26)
        # never add OWNER_NAME here (no owner names for homes)
        "fields": "PIN,PROPERTY_A,PROP_ZIP,ADDRESS2,OWNER_ZIP,CLASS",
        "id": "PIN", "situs": "PROPERTY_A", "situs_zip": "PROP_ZIP",
        "owner_addr": "ADDRESS2", "owner_zip": "OWNER_ZIP", "sale": None,
        "centroid": True,                              # FeatureServer: returnCentroid, no polygons downloaded
        "label": "Douglas County assessor (owner mailing address)",
    },
    "lancaster": {
        "url": "https://gis.lincoln.ne.gov/public/rest/services/Assessor/TaxParcels/MapServer/0/query",
        "bbox": (-96.917, 40.521, -96.460, 41.048),     # Lancaster County (service extent 2026-09-26)
        # never add OWNERNME1/OWNERNME2/CNVYNAME here (no owner names for homes)
        "fields": "PARCELID,SITEADDRESS,PSTLADDRESS,PSTLZIP5,CLASSDSCRP",
        "id": "PARCELID", "situs": "SITEADDRESS", "situs_zip": None,   # zip read off the end of SITEADDRESS
        "owner_addr": "PSTLADDRESS", "owner_zip": "PSTLZIP5", "sale": None,
        "label": "Lancaster County assessor (owner mailing address)",
    },
}
PAGE = 2000
PAUSE_S = 0.5                                    # be polite between pages
MATCH_MI = 0.25                                  # a stop and a county parcel with the same address must be this close

SUFFIX = {"STREET": "ST", "AVENUE": "AVE", "AV": "AVE", "DRIVE": "DR", "ROAD": "RD", "LANE": "LN", "COURT": "CT",
          "CIRCLE": "CIR", "PLACE": "PL", "BOULEVARD": "BLVD", "PARKWAY": "PKWY", "TERRACE": "TER", "TRAIL": "TRL",
          "HIGHWAY": "HWY", "PLAZA": "PLZ", "TL": "TRL", "CR": "CIR",   # Douglas writes TL / CR
          "NORTH": "N", "SOUTH": "S", "EAST": "E", "WEST": "W"}
UNIT_TAIL = re.compile(r"\s+(#|UNIT|APT|STE|SUITE|LOT|BLDG|TRLR|SPC)\b.*$")
PO_BOX = re.compile(r"^\s*(P\.?\s*O\.?\s*BOX|BOX|PO BX|POB)\b")
ORDINAL = re.compile(r"^(\d+)(ST|ND|RD|TH)$")
ZIP_END = re.compile(r"\b(\d{5})(-\d{4})?\s*$")


def _ordinal(n):
    n = int(n)
    return f"{n}{'TH' if 10 <= n % 100 <= 20 else {1: 'ST', 2: 'ND', 3: 'RD'}.get(n % 10, 'TH')}"


def _legacy_street(street):
    """The street as keys stored before 2026-09-26 spelled it ('S 28 CIR' -> 'S 28TH CIR'), for older caches."""
    return " ".join(_ordinal(w) if w.isdigit() else w for w in street.split())


def addr_key(text):
    """'13706 S 28th Cir, Bellevue' / '13706 S 28TH CIR  BELLEVUE NE 68123' -> (13706, 'S 28TH CIR'), or None."""
    t = re.split(r"\s{2,}|,", str(text or "").upper().strip())[0]
    t = UNIT_TAIL.sub("", re.sub(r"[.]", "", t))
    m = re.match(r"^(\d+)\s+(.+)$", t.strip())
    if not m:
        return None
    words = [ORDINAL.sub(r"\1", w) for w in m.group(2).split()]          # '114TH' -> '114'
    street = " ".join(SUFFIX.get(w, w) for w in words)
    return int(m.group(1)), street


def occupied(situs, owner_addr, situs_zip=None, owner_zip=None):
    """True = the owner's mailing address is the house; False = mailed elsewhere; None = can't tell."""
    if not owner_addr or not str(owner_addr).strip() or PO_BOX.match(str(owner_addr).upper()):
        return None
    h, o = addr_key(situs), addr_key(owner_addr)
    if not h or not o:
        return None
    if h != o:
        return False
    sz, oz = str(situs_zip or "").strip()[:5], str(owner_zip or "").strip()[:5]
    return not (sz and oz and sz != oz)                  # same street address in another town = elsewhere


def _row(src_name, src, f, tile, now):
    a, g = f.get("attributes") or {}, f.get("centroid") or f.get("geometry") or {}
    if "x" not in g:
        ring = (g.get("rings") or [[]])[0]              # polygon without a server centroid: average its corners
        pts = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring
        if not pts:
            return None
        g = {"x": sum(p[0] for p in pts) / len(pts), "y": sum(p[1] for p in pts) / len(pts)}
    key = addr_key(a.get(src["situs"]))
    if not key:
        return None
    szip = a.get(src["situs_zip"]) if src.get("situs_zip") else None
    if not szip:
        m = ZIP_END.search(str(a.get(src["situs"]) or ""))
        szip = m.group(1) if m else None
    occ = occupied(a.get(src["situs"]), a.get(src["owner_addr"]), szip, a.get(src["owner_zip"]))
    sale = a.get(src["sale"]) if src.get("sale") else None
    sale_d = None
    if isinstance(sale, (int, float)) and sale > 0:      # epoch ms; the county's 1900-01-01 placeholder is negative
        sale_d = datetime.fromtimestamp(sale / 1000, tz=timezone.utc).date().isoformat()
    return (src_name, str(a.get(src["id"])), key[0], key[1], round(g["y"], 6), round(g["x"], 6),
            None if occ is None else int(occ), sale_d, tile, now)


def fetch_tile(session, src, i, j, retries=2):
    x0, y0, x1, y1 = _tile_box(i, j)
    out, offset = [], 0
    while True:
        params = {"where": "1=1", "geometry": f"{x0},{y0},{x1},{y1}", "geometryType": "esriGeometryEnvelope",
                  "inSR": 4326, "spatialRel": "esriSpatialRelIntersects", "outFields": src["fields"],
                  "returnGeometry": "true", "outSR": 4326, "f": "json", "resultOffset": offset,
                  "resultRecordCount": PAGE, "orderByFields": src["id"]}
        if src.get("centroid"):                         # polygons: the server's centroid only, much smaller pages
            params.update(returnGeometry="false", returnCentroid="true")
        else:
            params["geometryPrecision"] = 6
        for k in range(retries + 1):
            try:
                r = session.get(src["url"], params=params, timeout=120)
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
        time.sleep(PAUSE_S)


def _overlap(a, b):
    return max(a[0], b[0]) < min(a[2], b[2]) and max(a[1], b[1]) < min(a[3], b[3])


def ensure_area(conn, session, bbox, max_age_days=180, budget_s=None, log=print, sources=None):
    """Download missing/stale owner tiles for every source whose county overlaps bbox. Returns rows stored."""
    cut = iso(datetime.now(timezone.utc) - timedelta(days=max_age_days))
    t0, stored = time.monotonic(), 0
    for name, src in (sources or SOURCES).items():
        if not _overlap(bbox, src["bbox"]):
            continue
        box = (max(bbox[0], src["bbox"][0]), max(bbox[1], src["bbox"][1]),
               min(bbox[2], src["bbox"][2]), min(bbox[3], src["bbox"][3]))
        fresh = {r[0] for r in conn.execute("SELECT tile FROM owner_tiles WHERE source=? AND fetched_utc > ?",
                                            (name, cut))}
        todo = [t for t in _tiles(box) if f"{t[0]}_{t[1]}" not in fresh]
        for n_done, (i, j) in enumerate(todo):
            if budget_s and time.monotonic() - t0 > budget_s:
                log(f"    owners ({name}): time budget reached, {len(todo) - n_done} tile(s) left - run again")
                break
            key, now = f"{i}_{j}", iso(datetime.now(timezone.utc))
            rows = [r for r in (_row(name, src, f, key, now) for f in fetch_tile(session, src, i, j)) if r]
            conn.executemany("INSERT OR REPLACE INTO owner_occ VALUES (?,?,?,?,?,?,?,?,?,?)", rows)
            conn.execute("INSERT OR REPLACE INTO owner_tiles VALUES (?,?,?,?)", (name, key, now, len(rows)))
            conn.commit()
            stored += len(rows)
        if todo:
            log(f"    owners ({name}): {stored:,} houses checked")
    return stored


def lookup(conn, stops):
    """Offline: set stop['owner_occ'] (True/False) and stop['owner_source'] from the cache, matching on the same
    house number + street within MATCH_MI. Stops without a match keep owner_occ None. Returns how many matched."""
    hit = 0
    for s in stops:
        key = addr_key(s.get("address"))
        if not key or s.get("lat") is None or s.get("lon") is None:
            continue
        best = None
        for r in conn.execute("SELECT source, lat, lon, owner_occupied FROM owner_occ WHERE house_num=? AND street IN "
                              "(?, ?) AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?",
                              (key[0], key[1], _legacy_street(key[1]), s["lat"] - 0.01, s["lat"] + 0.01,
                               s["lon"] - 0.013, s["lon"] + 0.013)):
            d = haversine_mi(s["lat"], s["lon"], r["lat"], r["lon"])
            if d <= MATCH_MI and (best is None or d < best[0]):
                best = (d, r)
        if best and best[1]["owner_occupied"] is not None:
            s["owner_occ"] = bool(best[1]["owner_occupied"])
            s["owner_source"] = best[1]["source"]
            hit += 1
    return hit
