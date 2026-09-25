"""Pull hail observations from every enabled source into the database (resumable)."""
import time
from datetime import datetime, timedelta, timezone

from . import db
from .geo import haversine_mi
from .http import NotFound
from .models import iso, parse_utc
from .sources import lsr, stormevents, swdi

SOURCES = {"lsr": lsr, "swdi": swdi, "stormevents": stormevents}


def resume_start(conn, cfg, name, now):
    back = now - timedelta(days=cfg["backfill_days"])
    if getattr(SOURCES[name], "FULL_WINDOW", False):
        return back
    row = conn.execute("SELECT MAX(reached_utc) FROM ingest_runs WHERE source=? AND reached_utc IS NOT NULL",
                       (name,)).fetchone()
    if not row or not row[0]:
        return back
    return max(back, min(parse_utc(row[0]), now) - timedelta(days=3))


def run(conn, fetcher, cfg, start=None, end=None, names=None, budget_s=None, log=print):
    """start=None resumes each source where it left off (first run = full backfill).
    budget_s stops cleanly after that many seconds; run again to continue."""
    now = datetime.now(timezone.utc)
    end = end or now + timedelta(hours=1)
    names = names or [n for n, on in cfg["sources"].items() if on and n in SOURCES]
    home, radius = cfg["home"], cfg["hunt_radius_mi"]
    t0 = time.monotonic()
    touched, summary = set(), {}
    for name in names:
        mod = SOURCES[name]
        s0 = start or resume_start(conn, cfg, name, now)
        began = iso(datetime.now(timezone.utc))
        st = {"requests": 0, "parsed": 0, "kept": 0, "new": 0, "updated": 0, "skipped": 0, "errors": []}
        status, reached = "ok", iso(end)
        try:
            window = list(mod.urls(cfg, s0, end, fetcher))
        except Exception as e:
            window = []
            st["errors"].append(f"listing failed: {type(e).__name__}: {e}"[:300])
            status = "failed"
        retries = db.due_failures(conn, name, exclude={u for u, _, _ in window})
        cooling = db.recent_failures(conn, name, hours=6)
        jobs = [(j, False) for j in retries] + [(j, True) for j in window]
        for (url, ttl, chunk_start), in_window in jobs:
            if budget_s and time.monotonic() - t0 > budget_s:
                status, reached = "incomplete", iso(max(chunk_start, s0) if in_window else s0)
                break
            if url in cooling and fetcher.cached(url) is None:
                st["skipped"] += 1
                continue
            st["requests"] += 1
            try:
                content = fetcher.get(url, ttl=ttl)
            except NotFound:
                db.clear_failure(conn, url)
                continue
            except Exception as e:
                db.record_failure(conn, name, url, chunk_start, f"{type(e).__name__}: {e}"[:300])
                st["errors"].append(f"{type(e).__name__}: {str(e)[:160]}")
                continue
            db.clear_failure(conn, url)
            try:
                obs = mod.parse(content, cfg)
            except Exception as e:
                st["errors"].append(f"parse error: {type(e).__name__}: {e}"[:300])
                continue
            st["parsed"] += len(obs)
            obs = [o for o in obs if s0 <= o.valid_utc < end
                   and haversine_mi(home["lat"], home["lon"], o.lat, o.lon) <= radius]
            st["kept"] += len(obs)
            n, u, days = db.upsert_obs(conn, obs, cfg)
            st["new"] += n
            st["updated"] += u
            touched |= days
            if st["requests"] % 25 == 0:
                log(f"    {name}: {st['requests']}/{len(jobs)} requests, {st['kept']} kept, {st['new']} new")
        if status == "ok" and st["errors"]:
            status = "partial" if st["requests"] > len(st["errors"]) else "failed"
        db.log_run(conn, name, began, s0, end, None if status == "failed" else reached, st, status)
        summary[name] = {**st, "status": status, "from": iso(s0)}
        log(f"  {name:12s} {status:10s} requests={st['requests']:<4d} kept={st['kept']:<6d} new={st['new']:<6d}"
            f" updated={st['updated']}" + (f"  errors={len(st['errors'])}" if st["errors"] else "")
            + (f"  skipped={st['skipped']}" if st["skipped"] else ""))
        if st["errors"]:
            log(f"      first error: {st['errors'][0]}")
    return touched, summary
