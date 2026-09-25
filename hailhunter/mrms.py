"""NOAA MRMS MESH (Maximum Estimated Size of Hail) - 1 km radar hail grids, free on AWS.

We use the 24-hour max ending 12Z, which covers exactly one storm day (12Z-12Z).
Each day's grid is cropped to the hunting area and saved as data/mrms/mesh_YYYY-MM-DD.npz
(uint16, tenths of a millimetre). Raw downloads are not kept."""
import io
import json
import os
import re
import struct
import time
from datetime import date, datetime, timedelta, timezone

import numpy as np
from PIL import Image

from .geo import bbox_for_radius
from .http import NotFound
from .models import iso

BUCKET = "https://noaa-mrms-pds.s3.amazonaws.com"
PRODUCT = "CONUS/MESH_Max_1440min_00.50"
FIRST_DAY = date(2020, 10, 15)          # AWS archive starts Oct 2020
MM_PER_IN = 25.4
Image.MAX_IMAGE_PIXELS = None           # the CONUS grid is 24.5M pixels


# ------------------------------------------------------------------ GRIB2
def _s16(b):
    v = struct.unpack(">H", b)[0]
    return -(v & 0x7FFF) if v & 0x8000 else v


def _s32(b):
    v = struct.unpack(">I", b)[0]
    return -(v & 0x7FFFFFFF) if v & 0x80000000 else v


def decode_grib2(raw):
    """Minimal GRIB2 reader: one field on a lat/lon grid (template 3.0), packed simple (5.0) or PNG (5.41)."""
    if raw[:4] != b"GRIB" or raw[7] != 2:
        raise ValueError("not a GRIB2 file")
    pos, grid, pack, data, bitmap = 16, None, None, None, 255
    while pos < len(raw) - 4 and raw[pos:pos + 4] != b"7777":
        ln, num = struct.unpack(">I", raw[pos:pos + 4])[0], raw[pos + 4]
        sec = raw[pos:pos + ln]
        if num == 3:
            if struct.unpack(">H", sec[12:14])[0] != 0:
                raise ValueError("only lat/lon grids (template 3.0) supported")
            Ni, Nj = struct.unpack(">II", sec[30:38])
            lo1 = _s32(sec[50:54]) / 1e6
            grid = {"Ni": Ni, "Nj": Nj, "la1": _s32(sec[46:50]) / 1e6, "lo1": lo1 - 360 if lo1 > 180 else lo1,
                    "di": struct.unpack(">I", sec[63:67])[0] / 1e6, "dj": struct.unpack(">I", sec[67:71])[0] / 1e6,
                    "scan": sec[71]}
        elif num == 5:
            pack = {"tpl": struct.unpack(">H", sec[9:11])[0], "R": struct.unpack(">f", sec[11:15])[0],
                    "E": _s16(sec[15:17]), "D": _s16(sec[17:19]), "bits": sec[19]}
        elif num == 6:
            bitmap = sec[5]
        elif num == 7:
            data = sec[5:]
        pos += ln
    if grid is None or pack is None or data is None:
        raise ValueError("incomplete GRIB2 message")
    if bitmap != 255:
        raise ValueError("GRIB2 bitmaps not supported")
    n = grid["Ni"] * grid["Nj"]
    if pack["tpl"] == 41:
        X = np.asarray(Image.open(io.BytesIO(data))).astype(np.float32).reshape(grid["Nj"], grid["Ni"])
    elif pack["tpl"] == 0:
        b = pack["bits"]
        if b == 0:
            X = np.zeros(n, np.float32)
        else:
            bits = np.unpackbits(np.frombuffer(data, np.uint8))[: n * b].reshape(n, b)
            X = (bits.astype(np.uint64) << np.arange(b - 1, -1, -1, dtype=np.uint64)).sum(1).astype(np.float32)
        X = X.reshape(grid["Nj"], grid["Ni"])
    else:
        raise ValueError(f"packing template 5.{pack['tpl']} not supported")
    Y = (pack["R"] + X * np.float32(2.0 ** pack["E"])) / np.float32(10.0 ** pack["D"])
    if grid["scan"] & 0x40:                 # rows stored south->north: flip to north->south
        Y = Y[::-1]
    return Y, grid


def crop(Y, grid, bbox):
    min_lon, min_lat, max_lon, max_lat = bbox
    i0 = max(0, int(np.floor((grid["la1"] - max_lat) / grid["dj"])))
    i1 = min(grid["Nj"], int(np.ceil((grid["la1"] - min_lat) / grid["dj"])) + 1)
    j0 = max(0, int(np.floor((min_lon - grid["lo1"]) / grid["di"])))
    j1 = min(grid["Ni"], int(np.ceil((max_lon - grid["lo1"]) / grid["di"])) + 1)
    meta = {"lat0": round(grid["la1"] - i0 * grid["dj"], 6), "lon0": round(grid["lo1"] + j0 * grid["di"], 6),
            "dlat": grid["dj"], "dlon": grid["di"], "shape": [i1 - i0, j1 - j0]}
    return Y[i0:i1, j0:j1], meta


# ------------------------------------------------------------------ files
def _key(t):
    return f"{PRODUCT}/{t:%Y%m%d}/MRMS_MESH_Max_1440min_00.50_{t:%Y%m%d-%H%M%S}.grib2.gz"


def list_keys(fetcher, day_str):
    xml = fetcher.get(f"{BUCKET}/?list-type=2&prefix={PRODUCT}/{day_str}/", ttl=600, cache=False)
    return re.findall(r"<Key>([^<]+)</Key>", xml.decode("utf-8", "replace"))


def _time_of(key):
    m = re.search(r"_(\d{8}-\d{6})\.grib2", key)
    return datetime.strptime(m.group(1), "%Y%m%d-%H%M%S").replace(tzinfo=timezone.utc) if m else None


def pick_file(fetcher, day):
    """(key, valid_time, complete) for storm day `day` (a date)."""
    target = datetime(day.year, day.month, day.day, tzinfo=timezone.utc) + timedelta(days=1, hours=12)
    now = datetime.now(timezone.utc)
    if target <= now - timedelta(minutes=40):
        return _key(target), target, True
    keys = [k for d in (target.date(), day) for k in list_keys(fetcher, d.strftime("%Y%m%d"))]
    times = sorted((t, k) for k in keys if (t := _time_of(k)) and t <= target)
    if not times:
        raise NotFound(f"no MRMS file yet for {day}")
    t, k = times[-1]
    return k, t, False


def grid_path(cfg, day):
    d = os.path.join(os.path.dirname(cfg["paths"]["db"]), "mrms")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, f"mesh_{day}.npz")


def load_grid(cfg, day):
    """-> (mesh in inches as float32 array, meta) or (None, None)."""
    p = grid_path(cfg, day)
    if not os.path.exists(p):
        return None, None
    z = np.load(p)
    return z["mesh"].astype(np.float32) / 10.0 / MM_PER_IN, json.loads(str(z["meta"]))


def process_day(conn, fetcher, cfg, day_str):
    day = date.fromisoformat(day_str)
    key, valid, complete = pick_file(fetcher, day)
    url = f"{BUCKET}/{key}"
    try:
        raw = fetcher.get(url, cache=False)
    except NotFound:                         # exact 12Z file missing: take the closest one within 30 min
        cands = [(abs((_time_of(k) - valid).total_seconds()), k) for k in list_keys(fetcher, valid.strftime("%Y%m%d"))
                 if _time_of(k)]
        cands = [c for c in cands if c[0] <= 1800]
        if not cands:
            raise
        key = min(cands)[1]
        url, valid = f"{BUCKET}/{key}", _time_of(key)
        raw = fetcher.get(url, cache=False)
    import gzip
    Y, grid = decode_grib2(gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw)
    h = cfg["home"]
    sub, meta = crop(Y, grid, bbox_for_radius(h["lat"], h["lon"], cfg["hunt_radius_mi"] + 10))
    mm10 = np.clip(np.nan_to_num(sub, nan=0.0), 0, None) * 10.0          # negatives = missing / no coverage
    arr = np.round(mm10).astype(np.uint16)
    meta.update({"key": key, "valid_utc": iso(valid), "complete": complete, "units": "0.1 mm"})
    with open(grid_path(cfg, day_str), "wb") as f:
        np.savez_compressed(f, mesh=arr, meta=json.dumps(meta))
    inch = arr / 10.0 / MM_PER_IN
    conn.execute("""INSERT OR REPLACE INTO swaths VALUES (?,?,?,?,?,?,?,?,?,?)""",
                 (day_str, key, iso(valid), int(complete), round(float(inch.max()), 2),
                  int((inch >= 0.75).sum()), int((inch >= 1.0).sum()), int((inch >= 1.5).sum()),
                  int((inch >= 2.0).sum()), iso(datetime.now(timezone.utc))))
    conn.commit()
    return float(inch.max()), complete


def pending_days(conn, cfg, days=None):
    if days is None:
        days = [r[0] for r in conn.execute("""SELECT conv_day FROM hail_events GROUP BY conv_day
                                               ORDER BY MAX(top_score) DESC""")]
    done = {r[0] for r in conn.execute("SELECT conv_day FROM swaths WHERE complete=1")}
    return [d for d in days if d not in done and date.fromisoformat(d) >= FIRST_DAY]


def run(conn, fetcher, cfg, days=None, budget_s=None, log=print):
    todo = pending_days(conn, cfg, days)
    t0, done, errors = time.monotonic(), [], []
    for i, d in enumerate(todo, 1):
        if budget_s and time.monotonic() - t0 > budget_s:
            break
        try:
            mx, complete = process_day(conn, fetcher, cfg, d)
            done.append(d)
            if i % 10 == 0 or len(todo) < 10:
                log(f"    swath {d}: max {mx:.2f}\"{'' if complete else ' (storm day still in progress)'}"
                    f"  [{i}/{len(todo)}]")
        except Exception as e:
            errors.append(f"{d}: {type(e).__name__}: {e}"[:200])
    return done, len(todo) - len(done) - len(errors), errors
