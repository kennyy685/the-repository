"""Wind damage reports (T6) - same NWS Local Storm Reports feed `lsr.py` already pulls for hail,
re-parsed for wind instead. Kept separate from the hail pipeline: different unit (knots, not inches),
own table (wind_obs), own scoring - not yet wired into door/neighborhood scores (see CLAUDE.md notes,
2026-09-25). This is informational: "wind damage happened here" alongside the hail picture, not
merged into it yet - merging them needs a design call (how do you compare a 1.5" hailstone to a 60kt
gust on one severity scale?) that should get a second pair of eyes before it changes the shared
hud.json contract.
"""
import json

from .geo import haversine_mi
from .models import parse_utc
from .sources import chunks, ttl_for
from .sources.lsr import BASE, source_weight

KT_TO_MPH = 1.15078
# NWS LSR typetext values that mean wind (not hail, not tornado).
WIND_TYPES = ("TSTM WND GST", "TSTM WND DMG", "NON-TSTM WND GST", "NON-TSTM WND DMG",
              "HIGH WIND", "MARINE TSTM WND")


def urls(cfg, start, end):
    wfos = ",".join(cfg["wfos"])
    for s, e in chunks(start, end, cfg["chunk_days"]):
        yield f"{BASE}?sts={s:%Y-%m-%dT%H:%MZ}&ets={e:%Y-%m-%dT%H:%MZ}&wfos={wfos}", ttl_for(e), s


def parse(content, cfg):
    data = json.loads(content)
    out = []
    for f in data.get("features", []):
        p = f.get("properties") or {}
        typetext = str(p.get("typetext", "")).strip().upper()
        if typetext not in WIND_TYPES:
            continue
        coords = (f.get("geometry") or {}).get("coordinates") or [p.get("lon"), p.get("lat")]
        try:
            lon, lat = float(coords[0]), float(coords[1])
            valid = parse_utc(p["valid"])
        except (TypeError, ValueError, KeyError, IndexError):
            continue
        speed_kt = speed_mph = None
        try:
            mag = float(p.get("magnitude"))
        except (TypeError, ValueError):
            mag = None  # damage-only reports often carry no numeric gust - still a real, useful signal
        if mag:
            # IEM gives the unit per report: land gusts come in MPH, marine ones in knots.
            if str(p.get("unit") or "MPH").strip().upper().startswith("K"):
                speed_kt, speed_mph = mag, round(mag * KT_TO_MPH, 1)
            else:
                speed_kt, speed_mph = round(mag / KT_TO_MPH, 1), mag
        src = p.get("source") or ""
        out.append({
            "uid": f"wind:{valid:%Y%m%d%H%M}:{lat:.3f}:{lon:.3f}",
            "source": "lsr", "valid_utc": valid, "lat": lat, "lon": lon,
            "speed_kt": speed_kt, "speed_mph": speed_mph,
            "report_kind": "gust" if "GST" in typetext else ("damage" if "DMG" in typetext else "wind"),
            "city": p.get("city") or "", "county": p.get("county") or "",
            "state": p.get("st") or p.get("state") or "", "remark": (p.get("remark") or "").strip(),
            "weight": source_weight(cfg, src),
            "extra": {"typetext": typetext, "report_source": src, "wfo": p.get("wfo") or ""},
        })
    return out


def ingest(conn, fetcher, cfg, start=None, end=None, budget_s=None, log=print):
    """Pulls wind reports the same way ingest.run() pulls hail - own bookkeeping (source='wind' in
    ingest_runs), own cache entries are shared with lsr's (same URLs, so no extra network cost)."""
    import time
    from datetime import datetime, timedelta, timezone

    from . import db
    from .http import NotFound
    from .models import iso

    now = datetime.now(timezone.utc)
    end = end or now + timedelta(hours=1)
    if start is None:
        back = now - timedelta(days=cfg["backfill_days"])
        row = conn.execute("SELECT MAX(reached_utc) FROM ingest_runs WHERE source='wind' "
                           "AND reached_utc IS NOT NULL").fetchone()
        start = back if not row or not row[0] else max(back, min(parse_utc(row[0]), now) - timedelta(days=3))
    home, radius = cfg["home"], cfg["hunt_radius_mi"]
    t0 = time.monotonic()
    st = {"requests": 0, "parsed": 0, "kept": 0, "new": 0, "updated": 0, "errors": []}
    status, reached, touched = "ok", iso(end), set()
    first_failed = None          # resume from the earliest failed window, so a failed download gets retried
    began = iso(now)
    for url, ttl, chunk_start in urls(cfg, start, end):
        if budget_s and time.monotonic() - t0 > budget_s:
            status, reached = "incomplete", iso(max(chunk_start, start))
            break
        st["requests"] += 1
        try:
            content = fetcher.get(url, ttl=ttl)
        except NotFound:
            continue
        except Exception as e:
            st["errors"].append(f"{type(e).__name__}: {str(e)[:160]}")
            first_failed = first_failed or max(chunk_start, start)
            continue
        try:
            obs = parse(content, cfg)
        except Exception as e:
            st["errors"].append(f"parse error: {type(e).__name__}: {e}"[:300])
            continue
        st["parsed"] += len(obs)
        obs = [o for o in obs if start <= o["valid_utc"] < end
               and haversine_mi(home["lat"], home["lon"], o["lat"], o["lon"]) <= radius]
        st["kept"] += len(obs)
        n, u, days = db.upsert_wind(conn, obs, cfg)
        st["new"] += n
        st["updated"] += u
        touched |= days
    if first_failed is not None:
        if status == "ok":
            status = "partial" if st["requests"] > len(st["errors"]) else "failed"
        reached = min(reached, iso(first_failed))
    db.log_run(conn, "wind", began, start, end, reached, st, status)
    log(f"  wind         {status:10} requests={st['requests']:<5} new={st['new']:<5} updated={st['updated']}")
    return touched, st
