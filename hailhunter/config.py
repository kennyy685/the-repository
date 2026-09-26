"""Settings. Defaults live here; config.json (next to hh.py) overrides any of them."""
import copy
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DEFAULTS = {
    # Who runs this copy of the engine. Code reads the company here instead of hardcoding HMP/Fremont, so the
    # same engine can serve a second roofer someday: change this block in config.json and home base, the hunt
    # radius, the everyday radius and printed names follow (`home`, `hunt_radius_mi` and `everyday.radius_mi`
    # are filled from it by load(); setting those old keys directly in config.json still wins).
    "company": {
        "id": "hmp",
        "name": "HMP Siding & Roofing LLC",
        "short_name": "HMP",
        "home_town": "Fremont",
        "state": "NE",
        "lat": 41.4333,
        "lon": -96.4981,
        "radius_mi": {"hunt": 250, "everyday": 40},
        # Company business lines only (printed on reports and door hangers).
        "phones": {"main": "402-889-3385",
                   "en": {"name": "Kenny Cruz", "phone": "402-936-2709"},
                   "es": {"name": "Alex Mendez", "phone": "402-889-3385"}}
    },
    "home": {"name": "Fremont, NE", "lat": 41.4333, "lon": -96.4981},
    "timezone": "America/Chicago",
    "hunt_radius_mi": 250,
    "backfill_days": 730,
    # States and NWS offices whose areas touch the 250-mile circle around home base (Fremont for HMP).
    "states": ["NE", "IA", "KS", "SD", "MO", "MN"],
    "wfos": ["OAX", "GID", "LBF", "GLD", "FSD", "ABR", "UNR", "DMX", "DVN", "ARX",
             "MPX", "TOP", "EAX", "ICT", "SGF", "DDC"],
    "sources": {"lsr": True, "swdi": True, "stormevents": True},
    "chunk_days": 7,
    "thresholds": {
        "ground_min_in": 0.75,     # smallest reported hail we care about
        "radar_min_in": 1.0,       # radar hail signatures below this are mostly noise
        "radar_min_points": 2,     # a radar-only cluster needs at least this many scans
        "cluster_link_mi": 12,     # reports closer than this on the same storm day = same event
        "place_snap_mi": 6         # hail within this far outside a town's edge counts for that town
    },
    # Radar hail-size algorithms run high; radar-only size = factor x 90th-percentile radar size.
    "radar_size_factor": 0.8,
    # Trust in a ground report by who sent it (IEM "source" field).
    "report_weights": {
        "default": 0.9, "mping": 0.75, "social media": 0.85, "public": 0.9,
        "trained spotter": 1.0, "nws employee": 1.0, "emergency mngr": 1.0,
        "law enforcement": 1.0, "official nws obs": 1.0, "storm chaser": 0.95,
        "co-op observer": 1.0, "cocorahs": 1.0, "fire dept/rescue": 1.0,
        "broadcast media": 0.95, "amateur radio": 0.95, "newspaper": 0.9
    },
    "scoring": {
        # hail size (inches) -> damage likelihood 0..1
        "size_curve": [[0.5, 0.0], [0.75, 0.10], [1.0, 0.40], [1.25, 0.60], [1.5, 0.72],
                       [1.75, 0.85], [2.0, 0.93], [2.5, 1.0]],
        # days since storm -> freshness 0..1 (claim windows vary by policy; older = fewer valid claims)
        "recency_curve": [[0, 1.0], [45, 1.0], [180, 0.7], [365, 0.4], [730, 0.1], [1095, 0.05]],
        # miles from home base -> travel factor 0..1
        "distance_curve": [[0, 1.0], [30, 1.0], [100, 0.75], [250, 0.45], [251, 0.0]],
        # houses to knock: town population -> 0..1
        # houses to knock: homes in the town (Census housing units) -> 0..1
        "exposure_by_homes": [[0, 0.55], [150, 0.7], [800, 0.85], [3000, 1.0]],
        "exposure_by_pop": [[0, 0.55], [500, 0.7], [2500, 0.85], [10000, 1.0]],
        "exposure_rural": 0.35,
        "exposure_unknown": 0.7,
        "confidence": {"ground_strong": 1.0, "ground_weak": 0.85, "radar_only": 0.65,
                       "multi_source_bonus": 0.05}
    },
    "neighborhood": {
        "min_store_in": 0.75,       # keep neighborhoods whose radar hail max reached this
        "coverage_in": 1.0,         # 'hit' threshold for coverage share
        "coverage_floor": 0.4,      # score multiplier when only a sliver of the area got 1"+
        "owner_floor": 0.3, "owner_unknown": 0.65,
        "homes_full": 500, "homes_floor": 0.3,
        "age_curve": [[1970, 1.0], [1990, 0.95], [2005, 0.88], [2015, 0.8]], "age_unknown": 0.9,
        "mesh_factor": None,        # None = auto-calibrate radar vs ground reports
        # Ground reports correct the radar map around them (radar + ground fusion)
        "fusion": {"min_weight": 0.85, "length_mi": 4.0, "prior_weight": 0.3,
                   "radar_floor_in": 0.5, "ratio_range": [0.5, 2.5]}
    },
    "door_lists": {
        "min_hail_in": 1.0,         # homes with at least this much estimated hail at the house
        "turf_size": 60,            # doors per walk (about 1-2 hours)
        "max_hop_mi": 0.4,          # don't jump farther than this between streets in one turf
        "kinds": ["single", "mobile", "multi"]
    },
    # Hot Zones (T23): chance-of-a-sale "heat" per walk, 0-100 = 100 x damage x insured x roof x size x fresh x open x compete
    "hot_zones": {
        "damage_curve": [[0.75, 0.1], [1.0, 0.4], [2.0, 1.0]],   # hail at the house -> damage likelihood
        "owner_unknown": 0.65,      # owner-occupied share when the Census has none for the area
        "mortgage_unknown": 0.6,    # share of owners with a mortgage when unknown (about the US average)
        "roof_unknown": 0.9,        # roof factor when the year built is unknown
        "roof_age_steps": [[0, 0.5], [8, 0.8], [15, 1.0]],   # typical roof age (years) -> factor, step function
        "insured_base": 0.5, "mortgage_base": 0.6,   # insured = base + (1-base) x owners x (mortgage_base + (1-mortgage_base) x mortgage)
        "size_base": 0.8,           # size = size_base + (1-size_base) x min(1, median value / value_full)
        "value_full": 250000,       # median assessed value that earns the full size factor
        "size_unknown": 0.9,
        "compete_towns": ["Omaha", "Lincoln"], "compete_days": 90, "compete_factor": 0.85,
        "inspect_rate": 0.03,       # prior: inspections per home knocked at heat 50 (tune with real results)
        "close_storm_mi": 60, "close_storm_min_in": 1.0, "close_storm_lists": 3,
        "max_turfs": 40, "max_hud_mb": 6.0
    },
    # Everyday leads (T50): old-house neighborhoods for regular siding/roof replacement, no storm needed.
    # heat 0-100 per walk = 100 x old x owners x value x distance x settled x newbuild
    "everyday": {
        "radius_mi": 40,            # search this far around the --near town (default: home base)
        "old_before": 1980,         # an 'old home' was built before this year
        "old_floor": 0.2,           # old = old_floor + (1 - old_floor) x share of old homes
        "old_unknown": 0.6,         # old factor when neither parcels nor the Census know the ages
        "median_spread_years": 20,  # no age breakdown: share old ~ 0.5 - (median year - old_before) / (2 x this)
        "age_curve": [[1940, 1.0], [1979, 1.0], [1995, 0.75], [2005, 0.5], [2015, 0.25], [2025, 0.1]],  # one house
        "owner_floor": 0.3, "owner_unknown": 0.65,
        # typical home value -> factor: enough value to reinvest in, but not luxury
        "value_curve": [[60000, 0.5], [110000, 0.85], [150000, 1.0], [350000, 1.0], [500000, 0.8], [800000, 0.6]],
        "value_unknown": 0.9,
        "distance_curve": [[0, 1.0], [15, 1.0], [40, 0.8], [80, 0.6]],   # miles from home base
        "recent_sale_years": 2, "sold_penalty": 0.3,   # settled = 1 - sold_penalty x share bought in the last N years
        "new_since": 2010, "new_penalty": 0.5,         # newbuild = 1 - new_penalty x share built since new_since
        "min_homes": 150,           # skip neighborhoods with fewer homes than this
        "skip_rural": True,         # skip 'Rural near ...' block groups (farms: too far between doors)
        "kinds": ["single", "mobile", "multi"],
        "turf_size": 60,
        "inspect_rate": 0.01,       # prior: estimates per home knocked at heat 50 (lower than storm walks; tune)
        "refresh_lists": 3,         # `refresh` builds this many everyday lists
        "parcel_budget_s": 120,     # max seconds downloading parcels for everyday lists per run
        "max_turfs": 10,            # walks per everyday list that carry their stops in hud.json
        "retry_days": 7             # retry a failed Census year-built (B25034) download after this many days
    },
    # Hail report on the phone (O3.3): per-address hail evidence for the houses on the storm door lists in hud.json
    "hail_evidence": {
        "max_lists": 10,            # storm lists that get evidence (newest first, as hud.json lists them)
        "max_per_list": 300,        # houses per list, in walking order from the best walk (keeps hud.json small)
        "radius_mi": 10.0           # ground reports this close count (same as the printed hail report)
    },
    # T37: Census language spoken at home -> where Alex (Spanish) should knock, Spanish-first hanger side
    "language": {
        "spanish_high": 0.30,       # share of Spanish-speaking households at/above this: reason line + who "Alex"
        "spanish_low": 0.10,        # below this: who "Kenny"; in between (or unknown): "either"
        "retry_days": 7             # retry a failed Census language download after this many days
    },
    # O0 "Today's knock": one walk a day for the HMP App (`hh.py todaywalk`, doc today/walk)
    "today_walk": {
        "goal_doors": 25,           # doors in today's walk (~2 hours)
        "storm_max_days": 60,       # a storm walk only if the storm is this fresh...
        "storm_min_heat": 15,       # ...and its walk's Hot Zones heat is at least this...
        "storm_min_hail": 1.0,      # ...and its average hail (inches) at least this; else the best everyday walk
        "min_doors": 8,             # skip walks with fewer doors left than this
        "max_passes": 3,            # a not-home door comes back until it has been tried this many times
        "house_kinds": ["single", "mobile", "farm"],  # houses only: no apartments/multi-family/commercial
        "min_per_door": 3.0,        # est_minutes: about this many minutes at each door...
        "walk_mph": 3.0,            # ...plus the walk between stops at this pace (straight line)
        "stale_hours": 36,          # hud.json older than this (generated_utc) -> stale: true + a warning
        "best_time": {              # best hours to knock (24h local), by day of week; null = no knocking planned
            "weekday": ["16:00", "19:30"],
            "saturday": ["10:00", "17:00"],
            "sunday": None
        }
    },
    "paths": {"db": "data/hailhunter.db", "cache": "data/cache", "export": "data/export"}
}


def _merge(base, over):
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _merge(base[k], v)
        else:
            base[k] = v
    return base


def apply_company(cfg, over=None):
    """Fills `home`, `hunt_radius_mi` and `everyday.radius_mi` from the `company` block, except the ones the
    config file (`over`) sets directly. Returns cfg."""
    over = over or {}
    c = cfg.get("company") or {}
    if "home" not in over and c.get("lat") is not None and c.get("lon") is not None:
        town = c.get("home_town") or cfg["home"]["name"].split(",")[0].strip()
        cfg["home"] = {"name": f"{town}, {c['state']}" if c.get("state") else town,
                       "lat": c["lat"], "lon": c["lon"]}
    r = c.get("radius_mi") or {}
    if "hunt_radius_mi" not in over and r.get("hunt") is not None:
        cfg["hunt_radius_mi"] = r["hunt"]
    if "radius_mi" not in over.get("everyday", {}) and r.get("everyday") is not None:
        cfg.setdefault("everyday", {})["radius_mi"] = r["everyday"]
    return cfg


def company_label(cfg):
    """'HMP Siding & Roofing LLC · Fremont, NE' (printed 'Prepared by' line)."""
    c = cfg.get("company") or {}
    return f"{c.get('name', 'HMP Siding & Roofing LLC')} · {cfg['home']['name']}"


def load(path=None):
    path = path or os.path.join(ROOT, "config.json")
    cfg = copy.deepcopy(DEFAULTS)
    over = {}
    if os.path.exists(path):
        with open(path) as f:
            over = json.load(f)
        _merge(cfg, over)
    apply_company(cfg, over)
    for k, v in list(cfg["paths"].items()):
        if not os.path.isabs(v):
            cfg["paths"][k] = os.path.join(ROOT, v)
    os.makedirs(os.path.dirname(cfg["paths"]["db"]), exist_ok=True)
    os.makedirs(cfg["paths"]["cache"], exist_ok=True)
    os.makedirs(cfg["paths"]["export"], exist_ok=True)
    return cfg
