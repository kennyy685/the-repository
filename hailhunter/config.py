"""Settings. Defaults live here; config.json (next to hh.py) overrides any of them."""
import copy
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DEFAULTS = {
    "home": {"name": "Fremont, NE", "lat": 41.4333, "lon": -96.4981},
    "timezone": "America/Chicago",
    "hunt_radius_mi": 250,
    "backfill_days": 730,
    # States and NWS offices whose areas touch the 250-mile circle around Fremont.
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
        "value_full": 250000,       # median assessed value that earns the full size factor
        "size_unknown": 0.9,
        "compete_towns": ["Omaha", "Lincoln"], "compete_days": 90, "compete_factor": 0.85,
        "inspect_rate": 0.03,       # prior: inspections per home knocked at heat 50 (tune with real results)
        "close_storm_mi": 60, "close_storm_min_in": 1.0, "close_storm_lists": 3,
        "max_turfs": 40, "max_hud_mb": 6.0
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


def load(path=None):
    path = path or os.path.join(ROOT, "config.json")
    cfg = copy.deepcopy(DEFAULTS)
    if os.path.exists(path):
        with open(path) as f:
            _merge(cfg, json.load(f))
    for k, v in list(cfg["paths"].items()):
        if not os.path.isabs(v):
            cfg["paths"][k] = os.path.join(ROOT, v)
    os.makedirs(os.path.dirname(cfg["paths"]["db"]), exist_ok=True)
    os.makedirs(cfg["paths"]["cache"], exist_ok=True)
    os.makedirs(cfg["paths"]["export"], exist_ok=True)
    return cfg
