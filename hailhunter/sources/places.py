"""Towns in the hunting ground: Census Gazetteer locations + 2020 Census populations."""
import io
import json
import zipfile

from ..geo import haversine_mi

GAZ = [f"https://www2.census.gov/geo/docs/maps-data/data/gazetteer/{y}_Gazetteer/{y}_Gaz_place_national.zip"
       for y in (2025, 2024, 2023)]
POP = "https://api.census.gov/data/2020/dec/pl?get=NAME,P1_001N&for=place:*&in=state:{fips}"
FIPS = {"NE": "31", "IA": "19", "KS": "20", "SD": "46", "MO": "29", "MN": "27", "ND": "38",
        "CO": "08", "WY": "56", "OK": "40", "IL": "17", "WI": "55"}
SUFFIXES = (" city", " village", " town", " CDP", " borough")


def clean_name(n):
    for s in SUFFIXES:
        if n.endswith(s):
            return n[: -len(s)]
    return n


def load(conn, fetcher, cfg, log=print):
    raw, errors = None, []
    for u in GAZ:
        try:
            raw = fetcher.get(u, ttl=None)
            break
        except Exception as e:
            errors.append(f"{u}: {e}")
    if raw is None:
        raise RuntimeError("Could not download the Census place list: " + "; ".join(errors)[:400])
    z = zipfile.ZipFile(io.BytesIO(raw))
    name = next(n for n in z.namelist() if n.endswith(".txt"))
    lines = z.read(name).decode("utf-8", "replace").splitlines()
    sep = "|" if "|" in lines[0] else "\t"          # 2025 files use '|', older ones tabs
    hdr = [h.strip() for h in lines[0].split(sep)]
    ix = {h: i for i, h in enumerate(hdr)}
    home, lim = cfg["home"], cfg["hunt_radius_mi"] + 20
    rows = []
    for ln in lines[1:]:
        f = [x.strip() for x in ln.split(sep)]
        if len(f) < len(hdr) or f[ix["USPS"]] not in cfg["states"]:
            continue
        lat, lon = float(f[ix["INTPTLAT"]]), float(f[ix["INTPTLONG"]])
        d = haversine_mi(home["lat"], home["lon"], lat, lon)
        if d <= lim:
            rows.append([f[ix["GEOID"]], clean_name(f[ix["NAME"]]), f[ix["USPS"]], lat, lon, None,
                         float(f[ix["ALAND_SQMI"]] or 0), round(d, 1)])
    pops = {}
    for st in cfg["states"]:
        try:
            data = json.loads(fetcher.get(POP.format(fips=FIPS[st]), ttl=None))
            head = data[0]
            for rec in data[1:]:
                r = dict(zip(head, rec))
                pops[r["state"] + r["place"]] = int(r["P1_001N"])
        except Exception as e:
            log(f"  population lookup failed for {st}: {e}")
    for r in rows:
        r[5] = pops.get(r[0])
    conn.execute("DELETE FROM places")
    conn.executemany("INSERT INTO places (geoid,name,state,lat,lon,pop,aland_sqmi,dist_mi) "
                     "VALUES (?,?,?,?,?,?,?,?)", rows)
    conn.commit()
    return len(rows)
