"""Printing and exporting results."""
import json
import os
from datetime import datetime, timezone

from .models import iso


def _in(x):
    return f'{x:.2f}"' if x is not None else "-"


def top_hits(conn, limit=25, since=None, min_size=None, min_score=0.05):
    q, args = "SELECT * FROM hail_hits WHERE score >= ?", [min_score]
    if since:
        q += " AND conv_day >= ?"
        args.append(since)
    if min_size:
        q += " AND best_size_in >= ?"
        args.append(min_size)
    q += " ORDER BY score DESC, conv_day DESC LIMIT ?"
    args.append(limit)
    return [dict(r) for r in conn.execute(q, args)]


def print_hits(rows, title="Top hail hits (storm x town), best first"):
    if not rows:
        print("No hail hits yet. Run: python3 hh.py ingest")
        return
    print(f"\n{title}")
    hdr = (f"{'#':>3}  {'Storm day':10}  {'Area':30}  {'Hail':>6}  {'Based on':12}  {'Rpts':>4}  "
           f"{'Radar':>5}  {'Miles':>5}  {'Dir':>3}  {'Days':>4}  {'Score':>5}")
    print(hdr)
    print("-" * len(hdr))
    for i, h in enumerate(rows, 1):
        p = json.loads(h["score_parts"] or "{}") if isinstance(h["score_parts"], str) else h["score_parts"]
        area = f"{h['place_name']}, {h['state']}"[:30]
        print(f"{i:>3}  {h['conv_day']:10}  {area:30}  {_in(h['best_size_in']):>6}  {(h['size_basis'] or '')[:12]:12}  "
              f"{(h['n_ground'] or 0) + (h['n_official'] or 0):>4}  {h['n_radar'] or 0:>5}  {h['dist_mi']:>5.0f}  "
              f"{h['bearing'] or '':>3}  {p.get('days_ago', '-'):>4}  {h['score']:>5.1f}")


def print_events(conn, limit=25, since=None):
    q, args = "SELECT * FROM hail_events", []
    if since:
        q += " WHERE conv_day >= ?"
        args.append(since)
    q += " ORDER BY conv_day DESC LIMIT ?"
    args.append(limit)
    rows = conn.execute(q, args).fetchall()
    if not rows:
        print("No storm events yet.")
        return
    hdr = (f"{'Storm day':10}  {'Where':36}  {'Ground':>6}  {'Offic.':>6}  {'Radar':>6}  "
           f"{'Rpts':>4}  {'Scans':>5}  {'Closest':>7}  {'Best':>5}")
    print(hdr)
    print("-" * len(hdr))
    for e in rows:
        print(f"{e['conv_day']:10}  {(e['area_label'] or '')[:36]:36}  {_in(e['max_ground_in']):>6}  "
              f"{_in(e['max_official_in']):>6}  {_in(e['max_radar_in']):>6}  {e['n_ground'] + e['n_official']:>4}  "
              f"{e['n_radar']:>5}  {e['dist_mi']:>5.0f}mi  {(e['top_score'] or 0):>5.1f}")


def status(conn, cfg):
    print(f"Database : {cfg['paths']['db']}")
    print(f"Home     : {cfg['home']['name']} ({cfg['home']['lat']}, {cfg['home']['lon']}), "
          f"hunting radius {cfg['hunt_radius_mi']} mi")
    print(f"Towns    : {conn.execute('SELECT COUNT(*) FROM places').fetchone()[0]} loaded")
    print("\nObservations by source:")
    for r in conn.execute("""SELECT source, kind, COUNT(*) n, MIN(conv_day) a, MAX(conv_day) b,
                             SUM(dup_of IS NOT NULL) d FROM hail_obs GROUP BY source, kind"""):
        print(f"  {r['source']:12s} {r['kind']:9s} {r['n']:>8,d}  {r['a']} -> {r['b']}"
              + (f"  ({r['d']} linked to an earlier report)" if r["d"] else ""))
    ev = conn.execute("SELECT COUNT(*), COUNT(DISTINCT conv_day) FROM hail_events").fetchone()
    hits = conn.execute("SELECT COUNT(*) FROM hail_hits").fetchone()[0]
    print(f"\nStorm events: {ev[0]} on {ev[1]} storm days;  hits (storm x town): {hits}")
    print("\nLast runs:")
    for r in conn.execute("SELECT * FROM ingest_runs ORDER BY run_id DESC LIMIT 6"):
        errs = json.loads(r["errors"] or "[]")
        print(f"  {r['finished_utc']}  {r['source']:12s} {r['status']:10s} new={r['new']:<6} "
              f"requests={r['requests']}" + (f"  e.g. {errs[0][:70]}" if errs else ""))
    sw = conn.execute("SELECT COUNT(*), SUM(complete), MIN(conv_day), MAX(conv_day) FROM swaths").fetchone()
    nb = conn.execute("SELECT COUNT(*), COUNT(DISTINCT geoid) FROM nbhd_hits").fetchone()
    nbg = conn.execute("SELECT COUNT(*) FROM bgs").fetchone()[0]
    print(f"\nRadar hail maps: {sw[0]} storm days ({sw[2]} -> {sw[3]})" if sw[0] else "\nRadar hail maps: none yet")
    print(f"Neighborhoods: {nbg:,} loaded; {nb[0]:,} neighborhood-storm hits across {nb[1]:,} neighborhoods")
    cal = conn.execute("SELECT value FROM meta WHERE key='mesh_calibration'").fetchone()
    if cal:
        c = json.loads(cal[0])
        print(f"Radar calibration: x{c['factor']} from {c['pairs']:,} ground reports ({c['computed_utc'][:10]})")
    nf = conn.execute("SELECT COUNT(*) FROM fetch_failures").fetchone()[0]
    if nf:
        print(f"\n{nf} data window(s) failed to download; they are retried automatically.")


def export(conn, cfg, path=None):
    path = path or os.path.join(cfg["paths"]["export"], "storms.json")
    hits = top_hits(conn, limit=1000, min_score=0)
    for h in hits:
        h["score_parts"] = json.loads(h["score_parts"] or "{}")
    events = [dict(r) for r in conn.execute("SELECT * FROM hail_events ORDER BY conv_day DESC")]
    hoods = [dict(r) for r in conn.execute("SELECT * FROM nbhd_hits ORDER BY score DESC LIMIT 2000")]
    for h in hoods:
        h["score_parts"] = json.loads(h["score_parts"] or "{}")
    data = {"generated_utc": iso(datetime.now(timezone.utc)), "home": cfg["home"],
            "hunt_radius_mi": cfg["hunt_radius_mi"], "hits": hits, "neighborhoods": hoods, "events": events}
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=1)
    os.replace(tmp, path)
    return path, len(hits), len(events)
