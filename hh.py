#!/usr/bin/env python3
"""HailHunter - storm-restoration lead engine.

  python3 hh.py init                 load towns, neighborhoods and Census housing data (run once)
  python3 hh.py ingest               pull hail reports (first run backfills 2 years; later runs catch up)
  python3 hh.py wind                 pull wind damage reports (T6, separate from hail) and list recent ones
  python3 hh.py swaths               download radar hail maps (MRMS) and score every neighborhood
  python3 hh.py storms               ranked list of towns hit, best first
  python3 hh.py hoods                ranked list of NEIGHBORHOODS hit, best first
  python3 hh.py map --day 2025-09-22 --near Fremont     hail map picture
  python3 hh.py doors --day 2026-06-13 --near Fremont   door-knock list: turfs in walking order (xlsx, csv, map)
  python3 hh.py commercial           apartment & commercial buildings in recent hail (with owners in Omaha)
  python3 hh.py hud                  snapshot for the Command Center page (data/export/hud.json)
  python3 hh.py events               storm-by-storm list
  python3 hh.py status               what's in the database, last runs, errors
  python3 hh.py serve                phone-friendly web app: door lists, commercial targets, pipeline tracking
  python3 hh.py refresh              everything end to end (what the daily Storm Watch task runs in the cloud)
  python3 hh.py diff --old OLD.json  new storm hits vs an older hud.json (for alerts), incl. contacts' buildings
  python3 hh.py hailreport --address "200 Oak St" --city Fremont   one-page hail report (English + Spanish)
  python3 hh.py bundle --out F.json  pack the engine into one JSON file, for the cloud copy
  python3 hh.py unbundle --src F.json  unpack an engine JSON bundle here
  python3 hh.py selftest             offline tests
"""
import argparse
import json
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from hailhunter import analyze, config, db, ingest, report  # noqa: E402
from hailhunter.http import Fetcher  # noqa: E402
from hailhunter.models import parse_utc  # noqa: E402


def _day(s, plus=0):
    """A storm day 'YYYY-MM-DD' starts 12Z (7am CDT) that day."""
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc) + timedelta(days=plus, hours=12)


def pick_door_lists(conn, cfg, window_days=200, max_miles=120, n_auto=4):
    """Pinned lists (config.json) plus the biggest fresh hits, for `refresh` to auto-build door lists."""
    from datetime import date
    today = date.today()
    q = """SELECT conv_day, place_name, SUM(hu) homes FROM nbhd_hits WHERE state='NE' AND hail_in >= 1.25
           AND conv_day >= ? AND dist_mi <= ? AND label NOT LIKE 'Rural%' GROUP BY conv_day, place_name
           ORDER BY homes DESC LIMIT ?"""
    auto = [(r[0], r[1]) for r in conn.execute(
        q, ((today - timedelta(days=window_days)).isoformat(), max_miles, n_auto))]
    hz = cfg.get("hot_zones", {})
    close = [(r[0], r[1]) for r in conn.execute(      # close, smaller storms are often un-worked (T23)
        """SELECT conv_day, place_name, SUM(hu) homes FROM nbhd_hits WHERE state='NE' AND hail_in >= ?
           AND conv_day >= ? AND dist_mi <= ? AND label NOT LIKE 'Rural%' GROUP BY conv_day, place_name
           ORDER BY conv_day DESC, homes DESC LIMIT ?""",
        (hz.get("close_storm_min_in", 1.0), (today - timedelta(days=window_days)).isoformat(),
         hz.get("close_storm_mi", 60), hz.get("close_storm_lists", 3)))]
    pinned = [tuple(x) for x in cfg.get("pinned_lists", [])]
    out = []
    for x in pinned + auto + close:
        if x not in out:
            out.append(x)
    return out


def refresh(conn, fetcher, cfg, log=print):
    """Everything, end to end: what the daily Storm Watch scheduled task runs. Door lists/commercial
    export CSV even without openpyxl (see doors.make_list / commercial.write_csv)."""
    from hailhunter import commercial, doors, hud, nbhd
    t0 = datetime.now(timezone.utc)
    if not conn.execute("SELECT 1 FROM bgs LIMIT 1").fetchone():
        log("First run: loading towns, neighborhoods and Census housing...")
        from hailhunter.sources import places
        places.load(conn, fetcher, cfg)
        nbhd.load_acs(conn, fetcher, cfg)
        nbhd.load_bgs(conn, fetcher, cfg)
        nbhd.label_bgs(conn, cfg)
    before = {r[0] for r in conn.execute("SELECT DISTINCT conv_day FROM hail_events")}
    touched, _ = ingest.run(conn, fetcher, cfg, log=log)
    analyze.analyze(conn, cfg, days=sorted(touched))
    try:                                   # REQ-4: wind rides along, so Storm Watch needs no separate step
        from hailhunter import wind
        wind.ingest(conn, fetcher, cfg, log=log)
    except Exception as e:                 # wind is informational; never let it stop the hail run
        log(f"  wind skipped: {type(e).__name__}: {e}")
    from hailhunter import mrms
    done, _, errs = mrms.run(conn, fetcher, cfg, None, None, log)
    have = {r[0] for r in conn.execute("SELECT conv_day FROM swaths")}
    # Re-measure days with a new radar map AND days whose ground reports changed: late spotter reports
    # and NCEI's official records (months later) correct the radar map around them (fusion).
    todo = set(done) | (set(touched) & have)
    # Calibrate BEFORE measuring (every map is scaled by the factor), and redo it monthly as reports pile up.
    cal = db.get_meta(conn, "mesh_calibration")
    if done and (not cal or datetime.now(timezone.utc) - parse_utc(cal["computed_utc"]) >= timedelta(days=30)):
        res = nbhd.calibrate(conn, cfg, log)
        if res:
            log(f"Radar calibration: x{res['factor']} from {res['pairs']} reports")
            if abs(res["factor"] - (cal["factor"] if cal else 1.0)) >= 0.02:
                todo = have                # factor moved: every stored map needs re-measuring
    index = None
    for d in sorted(todo):
        if index is None:
            _, meta = mrms.load_grid(cfg, d)
            if meta is None:
                continue
            index = nbhd.cell_index(conn, cfg, meta)
        nbhd.measure_day(conn, cfg, d, index)
    nbhd.rescore(conn, cfg)
    lists = []
    for day, town in pick_door_lists(conn, cfg):
        try:
            res = doors.make_list(conn, cfg, day, town, fetcher.s, log=lambda *a: None)
            if res:
                lists.append(f"{res['area']} {day}: {len(res['houses']):,} homes / {len(res['turfs'])} turfs")
        except SystemExit as e:
            log(f"  skip {town} {day}: {e}")
    for s in lists:
        log("  door list " + s)
    out, done_n, total_n = commercial.build(conn, cfg, fetcher.s, log=log)
    commercial.write_csv(out, cfg)
    log(f"Apartment/commercial targets: {len(out):,}")
    path, d = hud.write(conn, cfg)
    after = {r[0] for r in conn.execute("SELECT DISTINCT conv_day FROM hail_events")}
    new_storm_days = sorted(after - before)
    fresh = [s for s in d["storms"] if s["day"] in new_storm_days and s["hail"] >= 1.0 and s["dist_mi"] <= 150]
    summary = {"finished_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
               "minutes": round((datetime.now(timezone.utc) - t0).total_seconds() / 60, 1),
               "new_storm_days": new_storm_days, "new_hits_1in_150mi": fresh[:10], "door_lists": lists,
               "targets": len(out), "hud": path}
    with open(os.path.join(cfg["paths"]["export"], "refresh_summary.json"), "w") as f:
        json.dump(summary, f, indent=1)
    log(json.dumps({k: v for k, v in summary.items() if k != "new_hits_1in_150mi"}, indent=1))
    log(f"New 1\"+ hail within 150 mi: {len(fresh)}")
    for s in fresh[:10]:
        log(f"  {s['day']} {s['place']}, {s['state']}: {s['hail']}\" {round(s['dist_mi'])} mi (score {s['score']})")
    return summary


BUNDLE_EXTRA = ("config.json", "data/scout_contacts.json", "data/watch_list.json", "CLAUDE.md")


def bundle(out_path):
    files = {}
    for root, _, names in os.walk(HERE):
        for n in names:
            rel = os.path.relpath(os.path.join(root, n), HERE)
            if "__pycache__" in rel:
                continue
            if (rel.endswith(".py") and (rel.startswith("hailhunter" + os.sep) or rel.startswith("vendor" + os.sep)
                                          or rel == "hh.py")
                    or rel in BUNDLE_EXTRA
                    or (rel.startswith(".claude" + os.sep) and rel.endswith(".md"))):
                files[rel] = open(os.path.join(HERE, rel)).read()
    with open(out_path, "w") as f:
        json.dump({"version": 1, "files": files}, f)
    return files


def unbundle(src_path):
    b = json.load(open(src_path))
    for rel, txt in b["files"].items():
        dest = os.path.join(HERE, rel)
        os.makedirs(os.path.dirname(dest) or HERE, exist_ok=True)
        with open(dest, "w") as f:
            f.write(txt)
    return b["files"]


def main(argv=None):
    ap = argparse.ArgumentParser(prog="hh", description="HailHunter storm lead engine")
    ap.add_argument("--config", help="path to config.json")
    ap.add_argument("--offline", action="store_true", help="use cached data only, no network")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("init", help="load towns, neighborhoods, Census housing (needs network)")
    p.add_argument("--only", help="places,acs,bgs")
    p = sub.add_parser("swaths", help="radar hail maps -> neighborhood scores")
    p.add_argument("--day", help="one storm day YYYY-MM-DD")
    p.add_argument("--since", help="only storm days on/after YYYY-MM-DD")
    p.add_argument("--budget", type=int, help="stop after N seconds; re-run to continue")
    p.add_argument("--rescore", action="store_true", help="re-measure all saved swaths (after calibration)")
    p = sub.add_parser("hoods", help="ranked neighborhoods")
    p.add_argument("--limit", type=int, default=25)
    p.add_argument("--day")
    p.add_argument("--since")
    p.add_argument("--near", help="town name, e.g. Fremont")
    sub.add_parser("calibrate", help="compare radar hail sizes with ground reports")
    p = sub.add_parser("doors", help="door-knock list for one storm day and town")
    p.add_argument("--day", required=True)
    p.add_argument("--near", required=True, help="town, e.g. Fremont")
    p.add_argument("--radius", type=float, help="miles around the town center (default: town size + 2)")
    p.add_argument("--min-hail", type=float, help="inches at the house (default 1.0)")
    p.add_argument("--turf-size", type=int, help="doors per walk (default 60)")
    p = sub.add_parser("commercial", help="apartment & commercial buildings hit by hail")
    p.add_argument("--since", help="storms on/after YYYY-MM-DD (default: last 365 days)")
    p.add_argument("--max-miles", type=float, default=100)
    p.add_argument("--min-hail", type=float, default=1.0)
    p.add_argument("--budget", type=int, default=150)
    sub.add_parser("hud", help="write data/export/hud.json for the Command Center page")
    p = sub.add_parser("map", help="draw a hail map for one storm day")
    p.add_argument("--day", required=True)
    p.add_argument("--near", help="town to center on (default: worst-hit town that day)")
    p.add_argument("--radius", type=float, help="miles around the center (default 6 near a town, else 10)")
    p = sub.add_parser("ingest", help="pull hail data")
    p.add_argument("--since", help="YYYY-MM-DD (default: resume / 2-year backfill)")
    p.add_argument("--until", help="YYYY-MM-DD inclusive")
    p.add_argument("--days", type=int, help="just the last N days")
    p.add_argument("--sources", help="comma list: lsr,swdi,stormevents")
    p.add_argument("--budget", type=int, help="stop after N seconds; re-run to continue")
    p = sub.add_parser("wind", help="T6: pull wind damage reports (separate from hail) and list recent ones")
    p.add_argument("--days", type=int, default=30, help="how far back to list (default 30)")
    p.add_argument("--budget", type=int, help="stop after N seconds; re-run to continue")
    p = sub.add_parser("analyze", help="rebuild events/hits from stored data")
    p.add_argument("--all", action="store_true")
    p = sub.add_parser("storms", help="ranked hail hits")
    p.add_argument("--limit", type=int, default=25)
    p.add_argument("--since")
    p.add_argument("--min-size", type=float)
    p = sub.add_parser("events", help="storm events, newest first")
    p.add_argument("--limit", type=int, default=25)
    p.add_argument("--since")
    sub.add_parser("status", help="database summary and recent runs")
    p = sub.add_parser("export", help="write data/export/storms.json")
    p.add_argument("--out")
    p = sub.add_parser("serve", help="phone-friendly web app: door lists, commercial targets, pipeline tracking")
    p.add_argument("--port", type=int, default=8420)
    sub.add_parser("refresh", help="everything end to end (what the daily Storm Watch task runs)")
    p = sub.add_parser("diff", help="new storm hits vs an older hud.json (for alerts)")
    p.add_argument("--old", required=True)
    p.add_argument("--new")
    p.add_argument("--min-hail", type=float, default=1.0)
    p.add_argument("--max-miles", type=float, default=150)
    p = sub.add_parser("hailreport", help="one-page hail report for an address (English + Spanish), T32")
    p.add_argument("--address", required=True, help='as stored, e.g. "200 Oak St"')
    p.add_argument("--city")
    p.add_argument("--day", help="storm day YYYY-MM-DD (default: the newest 1\"+ storm at the address)")
    p.add_argument("--lat", type=float)
    p.add_argument("--lon", type=float)
    p = sub.add_parser("bundle", help="pack engine code + config + CLAUDE.md into one JSON file, for the cloud")
    p.add_argument("--out", required=True)
    p = sub.add_parser("unbundle", help="unpack an engine JSON bundle here")
    p.add_argument("--src", required=True)
    sub.add_parser("selftest", help="run offline tests")
    a = ap.parse_args(argv)

    if a.cmd == "selftest":
        suite = unittest.defaultTestLoader.discover(os.path.join(HERE, "tests"))
        ok = unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful()
        return 0 if ok else 1

    cfg = config.load(a.config)
    conn = db.connect(cfg["paths"]["db"])
    fetcher = Fetcher(cfg["paths"]["cache"], offline=a.offline)

    if a.cmd == "init":
        from hailhunter import nbhd
        from hailhunter.sources import places
        only = set(a.only.split(",")) if a.only else {"places", "acs", "bgs"}
        if "places" in only:
            n = places.load(conn, fetcher, cfg)
            print(f"Towns: {n} within {cfg['hunt_radius_mi'] + 20} miles of {cfg['home']['name']}.")
        if "acs" in only:
            n, v = nbhd.load_acs(conn, fetcher, cfg)
            print(f"Census housing (ACS 5-year, {v}): {n:,} neighborhoods and towns.")
        if "bgs" in only:
            n = nbhd.load_bgs(conn, fetcher, cfg)
            print(f"Neighborhood shapes: {n:,} block groups.")
        elif "places" in only:
            nbhd.label_bgs(conn, cfg)
        if conn.execute("SELECT 1 FROM hail_obs LIMIT 1").fetchone():
            analyze.analyze(conn, cfg)
    elif a.cmd == "ingest":
        now = datetime.now(timezone.utc)
        start = _day(a.since) if a.since else (now - timedelta(days=a.days) if a.days else None)
        end = _day(a.until, plus=1) if a.until else None
        names = [s.strip() for s in a.sources.split(",")] if a.sources else None
        if not conn.execute("SELECT 1 FROM places LIMIT 1").fetchone():
            print("Note: town list not loaded (python3 hh.py init) - hits will be named from report text.")
        print(f"Ingest {'(resume/backfill)' if start is None else 'from ' + start.date().isoformat()}"
              f" -> {'now' if end is None else end.date().isoformat()}")
        touched, summary = ingest.run(conn, fetcher, cfg, start, end, names, budget_s=a.budget)
        print(f"Analyzing {len(touched)} changed storm day(s)...")
        analyze.analyze(conn, cfg, days=sorted(touched), log=print)
        path, nh, ne = report.export(conn, cfg)
        f = fetcher.stats
        print(f"Downloaded {f['fetched']} file(s), {f['bytes'] / 1e6:.1f} MB; {f['cache_hits']} from cache."
              + (" INCOMPLETE - run the same command again to continue." if any(
                  s["status"] == "incomplete" for s in summary.values()) else ""))
        report.print_hits(report.top_hits(conn, limit=10))
    elif a.cmd == "wind":
        from hailhunter import wind
        touched, st = wind.ingest(conn, fetcher, cfg, budget_s=a.budget)
        since = (datetime.now(timezone.utc) - timedelta(days=a.days)).isoformat()
        rows = conn.execute(
            """SELECT conv_day, valid_utc, speed_mph, report_kind, city, state, dist_mi, remark
               FROM wind_obs WHERE valid_utc >= ? ORDER BY valid_utc DESC LIMIT 40""", (since,)).fetchall()
        print(f"\n{len(rows)} wind report(s) in the last {a.days} day(s) within {cfg['hunt_radius_mi']} mi:")
        for r in rows:
            spd = f"{r['speed_mph']:.0f} mph" if r["speed_mph"] else "(no gust measured)"
            print(f"  {r['conv_day']}  {r['city'] or '?':16} {r['state']:2}  {spd:16} {r['report_kind']:7} "
                  f"{r['dist_mi']:>5.0f} mi  {(r['remark'] or '')[:50]}")
    elif a.cmd == "swaths":
        from hailhunter import mrms, nbhd
        if not conn.execute("SELECT 1 FROM bgs LIMIT 1").fetchone():
            print("Run `python3 hh.py init` first (neighborhood shapes missing).")
            return 1
        days = [a.day] if a.day else None
        if a.since and days is None:
            days = [r[0] for r in conn.execute("SELECT DISTINCT conv_day FROM hail_events WHERE conv_day >= ?",
                                               (a.since,))]
        if a.rescore:
            todo = [r[0] for r in conn.execute("SELECT conv_day FROM swaths ORDER BY conv_day")]
        else:
            done, left, errs = mrms.run(conn, fetcher, cfg, days, a.budget)
            print(f"Radar hail maps: {len(done)} storm day(s) downloaded" + (f", {left} left - run again" if left else "")
                  + (f", {len(errs)} failed (e.g. {errs[0]})" if errs else ""))
            todo = done
        index = None
        for i, d in enumerate(todo, 1):
            if index is None:
                _, meta = mrms.load_grid(cfg, d)
                if meta is None:
                    continue
                index = nbhd.cell_index(conn, cfg, meta)
            nbhd.measure_day(conn, cfg, d, index)
        n = nbhd.rescore(conn, cfg)
        print(f"Neighborhoods measured on {len(todo)} day(s); {n:,} neighborhood-storm hits scored.")
        print_hoods(nbhd.top(conn, 15))
    elif a.cmd == "hoods":
        from hailhunter import nbhd
        print_hoods(nbhd.top(conn, a.limit, a.day, a.since, a.near))
    elif a.cmd == "calibrate":
        from hailhunter import nbhd
        res = nbhd.calibrate(conn, cfg)
        if res:
            print(f"Radar vs ground: {res['pairs']} trusted reports on {res['days']} storm days.")
            print(f"Ground size / radar size: median {res['factor']} (middle half {res['p25']}-{res['p75']}).")
            print(f"Radar hail sizes will be multiplied by {res['factor']}. Run `python3 hh.py swaths --rescore`.")
    elif a.cmd == "doors":
        from hailhunter import doors
        res = doors.make_list(conn, cfg, a.day, a.near, fetcher.s, a.radius, a.min_hail, a.turf_size)
        if not res:
            print("No homes with that much hail there. Try --min-hail 0.75 or another day.")
            return 1
        print(f"\n{res['area']}: {len(res['houses']):,} homes in {len(res['turfs'])} turfs")
        print(f"{'Turf':>4}  {'Main streets':46}  {'Doors':>5}  {'Avg hail':>8}  {'Value':>6}")
        for t, turf in enumerate(res["turfs"][:12], 1):
            print(f"{t:>4}  {turf['streets'][:46]:46}  {turf['doors']:>5}  {turf['avg_hail']:>7.2f}\"  {turf['value']:>6.0f}")
        for k, v in res["paths"].items():
            print(f"  {k}: {v}")
    elif a.cmd == "commercial":
        from hailhunter import commercial
        out, done, total = commercial.build(conn, cfg, fetcher.s, a.since, a.max_miles, a.min_hail, budget_s=a.budget)
        title = "Apartment & commercial targets in recent hail"
        sub_ = (f"{len(out):,} buildings with {a.min_hail:g}\"+ estimated hail, Nebraska towns within {a.max_miles:g} mi, "
                f"storms since {a.since or 'the last 365 days'}. Made {datetime.now():%b %d, %Y}.")
        if done < total:
            sub_ += f" PARTIAL: {done}/{total} storm-town areas checked."
        xlsx, csvp = commercial.write(out, cfg, title, sub_)
        now = datetime.now(timezone.utc).isoformat()
        conn.execute("DELETE FROM commercial_targets")
        conn.executemany("INSERT INTO commercial_targets (pid, run_utc, data) VALUES (?, ?, ?)",
                          [(b["pid"], now, json.dumps(b)) for b in out])
        conn.commit()
        print(f"{len(out):,} buildings ({done}/{total} areas checked)")
        for k, b in enumerate(out[:15], 1):
            print(f"{k:>3}. {b['address'][:28]:28} {b['city'][:12]:12} {b['kind']:10} ${(b['imp_value'] or 0)/1e6:5.1f}M "
                  f"{b['hail_in']:.2f}\" {b['storm_day']}  {b['owner'][:30]}")
        print(f"  xlsx: {xlsx}\n  csv: {csvp}")
    elif a.cmd == "hud":
        from hailhunter import hud
        path, d = hud.write(conn, cfg)
        print(f"Wrote {path}: {len(d['storms'])} storm hits, {len(d['lists'])} door lists, {len(d['targets'])} targets, "
              f"{os.path.getsize(path) / 1e6:.2f} MB")
    elif a.cmd == "map":
        from hailhunter import maps
        path = maps.draw(conn, cfg, a.day, a.near, a.radius)
        print(f"Map saved: {path}")
    elif a.cmd == "analyze":
        n = analyze.analyze(conn, cfg, days=None if a.all else [], log=print)
        print(f"Re-analyzed {n} storm day(s); scores refreshed.")
    elif a.cmd == "storms":
        report.print_hits(report.top_hits(conn, a.limit, a.since, a.min_size))
    elif a.cmd == "events":
        report.print_events(conn, a.limit, a.since)
    elif a.cmd == "status":
        report.status(conn, cfg)
    elif a.cmd == "export":
        path, nh, ne = report.export(conn, cfg, a.out)
        print(f"Wrote {path} ({nh} hits, {ne} events)")
    elif a.cmd == "serve":
        from hailhunter import web
        web.run(cfg["paths"]["db"], a.port)
    elif a.cmd == "refresh":
        refresh(conn, fetcher, cfg)
    elif a.cmd == "diff":
        old = json.load(open(a.old)) if os.path.exists(a.old) else {"storms": []}
        new = json.load(open(a.new or os.path.join(cfg["paths"]["export"], "hud.json")))
        seen = {(s["day"], s["place"], s["state"]) for s in old.get("storms", [])}
        fresh = [s for s in new["storms"] if (s["day"], s["place"], s["state"]) not in seen
                 and s["hail"] >= a.min_hail and s["dist_mi"] <= a.max_miles]
        from hailhunter import watch
        extra = watch.new_hits(old, new, a.min_hail)
        print(json.dumps({"new_hits": fresh[:15], "count": len(fresh), "new_contact_hits": extra["contacts"][:15],
                          "new_watch_hits": extra["watch"][:15]}, indent=1))
    elif a.cmd == "hailreport":
        from hailhunter import hailreport
        p = hailreport.find_parcel(conn, a.address, a.city)
        lat, lon = (a.lat, a.lon) if a.lat is not None and a.lon is not None else ((p["lat"], p["lon"]) if p else (None, None))
        if lat is None:
            print(f"Address not found in stored buildings: {a.address}. Pass --lat and --lon.")
            return 1
        hist = hailreport.history(conn, cfg, lat, lon)
        day = a.day or next((h["day"] for h in hist if h["hail"] >= 1.0), hist[0]["day"] if hist else None)
        if not day:
            print("No 3/4 inch or larger hail at this address in the last 2 years.")
            return 1
        ev = hailreport.evidence(conn, cfg, day, lat, lon)
        label = a.address + (f", {p['city']}" if p and p["city"] else (f", {a.city}" if a.city else ""))
        path = hailreport.write(os.path.join(cfg["paths"]["export"], "reports", f"hail_{hailreport.slug(label)}.html"),
                                label, ev, hist)
        hail = f'{ev["hail"]:.2f}"' if ev["hail"] is not None else "unknown"
        print(f"{label}: {day}, estimated {hail} at the property, {len(ev['reports'])} ground report(s) nearby")
        print(f"  report: {path}")
    elif a.cmd == "bundle":
        files = bundle(a.out)
        print(f"bundled {len(files)} files -> {a.out}")
    elif a.cmd == "unbundle":
        files = unbundle(a.src)
        print(f"unpacked {len(files)} files")
    return 0


def print_hoods(rows):
    import json
    if not rows:
        print("No neighborhood hits yet. Run: python3 hh.py swaths")
        return
    print("\nTop neighborhoods (storm day x Census block group), best first")
    hdr = (f"{'#':>3}  {'Storm day':10}  {'Neighborhood':34}  {'Hail':>5}  {'>=1in':>5}  {'Homes':>5}  "
           f"{'Own%':>4}  {'Built':>5}  {'Miles':>5}  {'Days':>4}  {'Score':>5}")
    print(hdr)
    print("-" * len(hdr))
    for i, h in enumerate(rows, 1):
        p = json.loads(h["score_parts"] or "{}")
        own = f"{h['owner_share'] * 100:.0f}" if h["owner_share"] is not None else "-"
        print(f"{i:>3}  {h['conv_day']:10}  {(h['label'] or h['geoid'])[:34]:34}  {h['hail_in']:>4.2f}\"  "
              f"{h['frac_ge_1'] * 100:>4.0f}%  {h['hu'] or 0:>5}  {own:>4}  {h['med_year'] or '-':>5}  "
              f"{h['dist_mi']:>5.0f}  {p.get('days_ago', '-'):>4}  {h['score']:>5.1f}")


if __name__ == "__main__":
    sys.exit(main())
