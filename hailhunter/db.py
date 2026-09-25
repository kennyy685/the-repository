"""SQLite storage. One file: data/hailhunter.db"""
import json
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from .geo import bearing_deg, compass, haversine_mi
from .models import iso, parse_utc
from .sources import ttl_for

SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS hail_obs (
    uid TEXT PRIMARY KEY,
    source TEXT NOT NULL,            -- lsr | swdi | stormevents
    kind TEXT NOT NULL,              -- ground | radar | official
    valid_utc TEXT NOT NULL,
    conv_day TEXT NOT NULL,          -- storm day (12Z-12Z)
    local_time TEXT,
    lat REAL NOT NULL, lon REAL NOT NULL,
    size_in REAL,
    city TEXT, county TEXT, state TEXT, remark TEXT,
    dist_mi REAL, bearing TEXT,
    weight REAL,
    dup_of TEXT,                     -- primary record's uid when this is the same hail reported twice
    event_id TEXT, place_key TEXT,
    extra TEXT, first_seen TEXT, last_seen TEXT
);
CREATE INDEX IF NOT EXISTS ix_obs_day ON hail_obs(conv_day);
CREATE INDEX IF NOT EXISTS ix_obs_event ON hail_obs(event_id);

CREATE TABLE IF NOT EXISTS hail_events (
    event_id TEXT PRIMARY KEY, conv_day TEXT NOT NULL,
    start_utc TEXT, end_utc TEXT,
    lat REAL, lon REAL, min_lat REAL, max_lat REAL, min_lon REAL, max_lon REAL,
    max_ground_in REAL, max_official_in REAL, max_radar_in REAL,
    n_ground INTEGER, n_official INTEGER, n_radar INTEGER,
    area_label TEXT, dist_mi REAL, bearing TEXT, top_score REAL, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_events_day ON hail_events(conv_day);

CREATE TABLE IF NOT EXISTS hail_hits (
    hit_id TEXT PRIMARY KEY,         -- event_id|place_key : one storm x one town
    event_id TEXT NOT NULL, conv_day TEXT NOT NULL,
    place_key TEXT, place_name TEXT, state TEXT, place_pop INTEGER, is_rural INTEGER,
    lat REAL, lon REAL, dist_mi REAL, bearing TEXT,
    max_ground_in REAL, max_official_in REAL, max_radar_in REAL,
    best_size_in REAL, size_basis TEXT, strong_ground INTEGER,
    n_ground INTEGER, n_official INTEGER, n_radar INTEGER,
    first_utc TEXT, last_utc TEXT, local_time TEXT,
    score REAL, score_parts TEXT, first_seen TEXT, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS ix_hits_score ON hail_hits(score);
CREATE INDEX IF NOT EXISTS ix_hits_day ON hail_hits(conv_day);

CREATE TABLE IF NOT EXISTS places (
    geoid TEXT PRIMARY KEY, name TEXT, state TEXT, lat REAL, lon REAL,
    pop INTEGER, aland_sqmi REAL, dist_mi REAL
);

CREATE TABLE IF NOT EXISTS ingest_runs (
    run_id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT, started_utc TEXT, finished_utc TEXT,
    range_start TEXT, range_end TEXT, reached_utc TEXT,
    requests INTEGER, parsed INTEGER, kept INTEGER, new INTEGER, updated INTEGER,
    status TEXT, errors TEXT
);

CREATE TABLE IF NOT EXISTS fetch_failures (
    url TEXT PRIMARY KEY, source TEXT, chunk_start TEXT,
    error TEXT, fail_count INTEGER, last_try TEXT
);
CREATE TABLE IF NOT EXISTS swaths (
    conv_day TEXT PRIMARY KEY, mrms_key TEXT, valid_utc TEXT, complete INTEGER,
    max_in REAL, cells_075 INTEGER, cells_100 INTEGER, cells_150 INTEGER, cells_200 INTEGER, processed_utc TEXT
);

CREATE TABLE IF NOT EXISTS acs (            -- Census ACS 5-year: homes and owners
    geoid TEXT PRIMARY KEY, level TEXT,     -- level: bg (block group) | place
    hu INTEGER, occupied INTEGER, owner INTEGER, renter INTEGER,
    med_year INTEGER, med_value INTEGER, vintage TEXT
);

CREATE TABLE IF NOT EXISTS bgs (            -- Census block groups ("neighborhoods", ~250-1500 homes each)
    geoid TEXT PRIMARY KEY, state TEXT, county TEXT, tract TEXT, bg TEXT,
    lat REAL, lon REAL, aland_sqmi REAL, dist_mi REAL,
    min_lon REAL, min_lat REAL, max_lon REAL, max_lat REAL,
    rings TEXT, place_key TEXT, label TEXT
);

CREATE TABLE IF NOT EXISTS nbhd_hits (      -- one storm day x one neighborhood
    conv_day TEXT, geoid TEXT, label TEXT, place_name TEXT, state TEXT,
    lat REAL, lon REAL, dist_mi REAL, bearing TEXT,
    hu INTEGER, owner_share REAL, med_year INTEGER, med_value INTEGER,
    mesh_max_in REAL, mesh_p75_in REAL, hail_in REAL, frac_ge_1 REAL, frac_ge_15 REAL, cells INTEGER,
    score REAL, score_parts TEXT, first_seen TEXT, updated_at TEXT,
    PRIMARY KEY (conv_day, geoid)
);
CREATE INDEX IF NOT EXISTS ix_nbhd_score ON nbhd_hits(score);

CREATE TABLE IF NOT EXISTS parcels (        -- buildings from the Nebraska statewide parcel layer
    pid TEXT PRIMARY KEY, county TEXT, parcel_id TEXT, house_num INTEGER, street TEXT, unit TEXT,
    address TEXT, city TEXT, zip TEXT, lat REAL, lon REAL,
    kind TEXT, kind_inferred INTEGER,       -- single | multi | commercial | industrial | farm | mobile
    year_built INTEGER, sqft REAL, imp_value REAL, total_value REAL, quality TEXT, condition TEXT,
    sale_date TEXT, subdivision TEXT, url TEXT, acres REAL, tile TEXT, updated_utc TEXT
);
CREATE INDEX IF NOT EXISTS ix_parcels_ll ON parcels(lat, lon);
CREATE TABLE IF NOT EXISTS parcel_tiles (tile TEXT PRIMARY KEY, fetched_utc TEXT, n INTEGER);

CREATE TABLE IF NOT EXISTS door_lists (
    list_id TEXT PRIMARY KEY, conv_day TEXT, area TEXT, created_utc TEXT, params TEXT,
    n_doors INTEGER, n_turfs INTEGER, csv_path TEXT, xlsx_path TEXT, map_path TEXT
);
CREATE TABLE IF NOT EXISTS door_list_stops (
    list_id TEXT, turf INTEGER, stop INTEGER, pid TEXT, address TEXT, hail_in REAL, score REAL, flags TEXT,
    PRIMARY KEY (list_id, turf, stop)
);

CREATE TABLE IF NOT EXISTS wind_obs (      -- T6: wind damage reports, separate from hail_obs (different
    uid TEXT PRIMARY KEY,                  -- unit, different meaning - a gust speed isn't a hail size).
    source TEXT NOT NULL,                  -- lsr (more sources can be added the same way later)
    valid_utc TEXT NOT NULL, conv_day TEXT NOT NULL, local_time TEXT,
    lat REAL NOT NULL, lon REAL NOT NULL,
    speed_kt REAL, speed_mph REAL,         -- null when it's a damage report with no measured gust
    report_kind TEXT,                      -- gust | damage  (NWS typetext: TSTM WND GST vs TSTM WND DMG)
    city TEXT, county TEXT, state TEXT, remark TEXT,
    dist_mi REAL, bearing TEXT, weight REAL,
    extra TEXT, first_seen TEXT, last_seen TEXT
);

CREATE TABLE IF NOT EXISTS door_status (   -- pipeline status per building, keyed by pid (survives list regens)
    pid TEXT PRIMARY KEY, status TEXT, contact_name TEXT, contact_phone TEXT, notes TEXT, updated_utc TEXT
);
CREATE TABLE IF NOT EXISTS commercial_targets (   -- last `hh.py commercial` run, one row per building (JSON)
    pid TEXT PRIMARY KEY, run_utc TEXT, data TEXT
);
"""


def _add_col(conn, table, col, typ):
    if col not in {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {typ}")


def _recover_hot_journal(path):
    """A crash (or a tool opening the DB in SQLite's default mode) can leave an undo journal that the
    synced folder won't let SQLite delete. Roll it back on a temporary copy, then put the copy back."""
    import shutil
    import tempfile
    jr = path + "-journal"
    if not os.path.exists(jr) or os.path.getsize(jr) == 0:
        return False
    tmp = tempfile.mkdtemp()
    shutil.copy2(path, os.path.join(tmp, "db"))
    shutil.copy2(jr, os.path.join(tmp, "db-journal"))
    c = sqlite3.connect(os.path.join(tmp, "db"))
    ok = c.execute("PRAGMA integrity_check").fetchone()[0]
    c.close()
    if ok != "ok":
        raise RuntimeError(f"database repair failed integrity check: {ok}")
    open(jr, "wb").close()                          # journal no longer 'hot'
    shutil.copyfile(os.path.join(tmp, "db"), path)
    return True


def connect(path):
    for attempt in (1, 2):
        try:
            conn = sqlite3.connect(path, timeout=30)
            conn.row_factory = sqlite3.Row
            # TRUNCATE: the synced Documents folder doesn't allow deleting files, which SQLite's default mode needs.
            conn.execute("PRAGMA journal_mode=TRUNCATE")
            break
        except sqlite3.OperationalError:
            if attempt == 2 or not _recover_hot_journal(path):
                raise
    conn.executescript(SCHEMA)
    _add_col(conn, "places", "hu", "INTEGER")          # housing units (ACS), added in step 2
    _add_col(conn, "hail_hits", "place_hu", "INTEGER")
    if not conn.execute("SELECT 1 FROM meta WHERE key='wind_mph_fix'").fetchone():
        # Older wind.py read every gust as knots, but IEM sends land gusts in MPH: the raw number sat in
        # speed_kt and speed_mph came out ~15% high. Marine reports really are knots, so they stay as-is.
        conn.execute("""UPDATE wind_obs SET speed_mph = speed_kt, speed_kt = ROUND(speed_kt / 1.15078, 1)
                        WHERE speed_kt IS NOT NULL
                          AND COALESCE(json_extract(extra, '$.typetext'), '') NOT LIKE 'MARINE%'""")
        conn.execute("INSERT INTO meta VALUES ('wind_mph_fix', 'true')")
    conn.execute("INSERT OR IGNORE INTO meta VALUES ('schema_version', ?)", (str(SCHEMA_VERSION),))
    conn.commit()
    return conn


def _now():
    return iso(datetime.now(timezone.utc))


def upsert_obs(conn, obs, cfg):
    """Insert/refresh observations. Returns (new, updated, storm days that changed)."""
    if not obs:
        return 0, 0, set()
    obs = list({o.uid: o for o in obs}.values())
    tz, home, now = ZoneInfo(cfg["timezone"]), cfg["home"], _now()
    existing = {}
    uids = [o.uid for o in obs]
    for i in range(0, len(uids), 500):
        q = uids[i:i + 500]
        for r in conn.execute(f"SELECT uid, size_in FROM hail_obs WHERE uid IN ({','.join('?' * len(q))})", q):
            existing[r[0]] = r[1]
    new = upd = 0
    touched, rows = set(), []
    for o in obs:
        if o.uid not in existing:
            new += 1
            touched.add(o.conv_day)
        elif existing[o.uid] != o.size_in:
            upd += 1
            touched.add(o.conv_day)
        d = haversine_mi(home["lat"], home["lon"], o.lat, o.lon)
        rows.append((o.uid, o.source, o.kind, iso(o.valid_utc), o.conv_day,
                     o.valid_utc.astimezone(tz).strftime("%Y-%m-%d %H:%M %Z"), o.lat, o.lon, o.size_in,
                     o.city, o.county, o.state, o.remark, round(d, 2),
                     compass(bearing_deg(home["lat"], home["lon"], o.lat, o.lon)), o.weight,
                     json.dumps(o.extra), now, now))
    conn.executemany("""
        INSERT INTO hail_obs (uid, source, kind, valid_utc, conv_day, local_time, lat, lon, size_in,
                              city, county, state, remark, dist_mi, bearing, weight, extra, first_seen, last_seen)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(uid) DO UPDATE SET size_in=excluded.size_in, remark=excluded.remark,
            weight=excluded.weight, extra=excluded.extra, last_seen=excluded.last_seen""", rows)
    conn.commit()
    return new, upd, touched


def upsert_wind(conn, obs, cfg):
    """Same shape as upsert_obs, for wind_obs (T6). Kept separate from hail_obs/upsert_obs on purpose -
    different unit (knots, not inches), different table, zero risk to the tested hail scoring path."""
    if not obs:
        return 0, 0, set()
    obs = list({o["uid"]: o for o in obs}.values())
    tz, home, now = ZoneInfo(cfg["timezone"]), cfg["home"], _now()
    existing = {}
    uids = [o["uid"] for o in obs]
    for i in range(0, len(uids), 500):
        q = uids[i:i + 500]
        for r in conn.execute(f"SELECT uid, speed_kt FROM wind_obs WHERE uid IN ({','.join('?' * len(q))})", q):
            existing[r[0]] = r[1]
    new = upd = 0
    touched, rows = set(), []
    for o in obs:
        conv_day = (o["valid_utc"] - timedelta(hours=12)).date().isoformat()
        if o["uid"] not in existing:
            new += 1
            touched.add(conv_day)
        elif existing[o["uid"]] != o.get("speed_kt"):
            upd += 1
            touched.add(conv_day)
        d = haversine_mi(home["lat"], home["lon"], o["lat"], o["lon"])
        rows.append((o["uid"], o["source"], iso(o["valid_utc"]), conv_day,
                     o["valid_utc"].astimezone(tz).strftime("%Y-%m-%d %H:%M %Z"), o["lat"], o["lon"],
                     o.get("speed_kt"), o.get("speed_mph"), o.get("report_kind", ""),
                     o.get("city", ""), o.get("county", ""), o.get("state", ""), o.get("remark", ""),
                     round(d, 2), compass(bearing_deg(home["lat"], home["lon"], o["lat"], o["lon"])),
                     o.get("weight", 1.0), json.dumps(o.get("extra", {})), now, now))
    conn.executemany("""
        INSERT INTO wind_obs (uid, source, valid_utc, conv_day, local_time, lat, lon, speed_kt, speed_mph,
                              report_kind, city, county, state, remark, dist_mi, bearing, weight, extra,
                              first_seen, last_seen)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(uid) DO UPDATE SET speed_kt=excluded.speed_kt, speed_mph=excluded.speed_mph,
            remark=excluded.remark, weight=excluded.weight, extra=excluded.extra,
            last_seen=excluded.last_seen""", rows)
    conn.commit()
    return new, upd, touched


def log_run(conn, source, started, start, end, reached, st, status):
    conn.execute("""INSERT INTO ingest_runs (source, started_utc, finished_utc, range_start, range_end, reached_utc,
                    requests, parsed, kept, new, updated, status, errors) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                 (source, started, _now(), iso(start), iso(end), reached, st["requests"], st["parsed"],
                  st["kept"], st["new"], st["updated"], status, json.dumps(st["errors"][:20])))
    conn.commit()


def record_failure(conn, source, url, chunk_start, error):
    conn.execute("""INSERT INTO fetch_failures VALUES (?,?,?,?,1,?)
                    ON CONFLICT(url) DO UPDATE SET fail_count=fail_count+1, error=excluded.error,
                    last_try=excluded.last_try""", (url, source, iso(chunk_start), error, _now()))
    conn.commit()


def clear_failure(conn, url):
    conn.execute("DELETE FROM fetch_failures WHERE url=?", (url,))


def recent_failures(conn, source, hours):
    cut = iso(datetime.now(timezone.utc) - timedelta(hours=hours))
    return {r[0] for r in conn.execute("SELECT url FROM fetch_failures WHERE source=? AND last_try>?", (source, cut))}


def due_failures(conn, source, exclude=(), hours=12, limit=10):
    """Older failed windows outside today's range, to retry now and then."""
    cut = iso(datetime.now(timezone.utc) - timedelta(hours=hours))
    out = []
    for url, cs in conn.execute("""SELECT url, chunk_start FROM fetch_failures WHERE source=? AND last_try<=?
                                   ORDER BY chunk_start LIMIT ?""", (source, cut, limit)):
        if url not in exclude:
            s = parse_utc(cs)
            out.append((url, ttl_for(s + timedelta(days=7)), s))
    return out


def get_meta(conn, key, default=None):
    r = conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
    return json.loads(r[0]) if r else default


def set_meta(conn, key, value):
    conn.execute("INSERT OR REPLACE INTO meta VALUES (?,?)", (key, json.dumps(value)))
    conn.commit()
