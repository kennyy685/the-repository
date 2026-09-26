"""Settings. Defaults live here; config.json (next to hh.py) overrides any of them."""
import copy
import json
import os
import sys

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
        "weight": 1.0,              # T35: everyday heat x this (capped at 100); `hh.py tune` moves it vs storm walks
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
        "goal_doors": 25,           # doors in today's walk (~2 hours): a starting session, not a full day
        # Winter (month number -> factor on the door goal; months not listed = 1.0): short cold days, fewer doors.
        # Never below goal_min_doors (unless the asked goal itself is smaller).
        "goal_factor_by_month": {"12": 0.65, "1": 0.65, "2": 0.65},
        "goal_min_doors": 10,
        "storm_max_days": 60,       # a storm walk only if the storm is this fresh (in season, Apr-Sep)...
        # ...off-season (Oct-Mar, month number -> days): re-knock storms from the last ~11 months that aren't
        # fully worked yet (claims are usually allowed ~12 months: a policy term, never promise it)
        "storm_max_days_by_month": {"10": 330, "11": 330, "12": 330, "1": 330, "2": 330, "3": 330},
        "storm_min_heat": 15,       # ...and its walk's Hot Zones heat is at least this...
        "storm_min_hail": 1.0,      # ...and its average hail (inches) at least this; else the best everyday walk
        "min_doors": 8,             # skip walks with fewer doors left than this
        "max_passes": 3,            # a not-home door comes back until it has been tried this many times
        "house_kinds": ["single", "mobile", "farm"],  # houses only: no apartments/multi-family/commercial
        "min_per_door": 3.0,        # est_minutes: about this many minutes at each door...
        "walk_mph": 3.0,            # ...plus the walk between stops at this pace (straight line)
        "stale_hours": 36,          # hud.json older than this (generated_utc) -> stale: true + a warning
        # Per-house facts on each stop (year_built, sqft, rough siding price) from the county assessor's data in
        # hud.json stops (`built`, `sqft`). No stories in that data: the rough range then covers these story counts.
        "house_facts": {
            "material": "vinyl",            # rough price as a vinyl siding job (estimate.estimate)
            "stories_if_unknown": [1, 2],   # low = 1-story price, high = 2-story price for the same living sq ft
            "min_sqft": 400,                # outside min..max the county size is likely wrong: no sqft, no price
            "max_sqft": 6000
        },
        "old_strong_before": 1970,  # everyday why: "Most homes here were built before 1970" when that's true per house
        "evidence_fade_days": 30,   # storm walk under this many days old: evidence_note (spatter marks fade in weeks)
        "best_time": {              # best hours to knock (24h local), by day of week; null = no knocking planned
            "weekday": ["16:00", "19:30"],
            "saturday": ["10:00", "17:00"],
            "sunday": None
        },
        # Short days (month number -> the day types it changes, + an optional note). Months not listed use best_time.
        "best_time_by_month": {
            "10": {"weekday": ["16:00", "18:30"]},
            "3": {"weekday": ["16:00", "18:30"]},
            **{m: {"weekday": ["15:30", "17:30"],
                   "note": {"en": "End by dusk.", "es": "Terminen antes de que oscurezca."}}
               for m in ("11", "12", "1", "2")}
        }
    },
    # Week results report from the HMP App's door taps + leads (`hh.py weekly`, T35 learning loop)
    "weekly": {
        "min_doors_area": 5         # a walk needs at least this many doors to be named best/worst area
    },
    # T35 learning loop (`hh.py tune --weekly weekly.json`): real door results -> small weight changes.
    # `--apply` writes paths.tuned (data/tuned.json); load() merges its `tuned_weights` on top of config.json, but
    # only for the keys in TUNABLE below. Every change is capped at max_step per run and kept inside its bounds.
    "tune": {
        "min_doors": 50,            # no tuning at all until the weekly file(s) have this many doors with a heat score
        "min_group_doors": 20,      # each side of a comparison needs this many doors (else that knob is skipped)
        "max_step": 0.15,           # max +/-15% change per knob per run
        "damping": 0.5,             # move half way toward what the doors say (small steps, less noise)
        "dead_band": 0.03,          # a change under 3% is noise: leave the knob alone
        "history_max": 200          # entries kept in paths.tune_history
    },
    # Today's business call list (`hh.py calltoday`): apartment/commercial targets with a known business line,
    # ranked by scoring.size_curve x scoring.recency_curve (freshest, strongest hail first)
    "call_today": {
        "min_hail": 1.0,            # inches at the building
        "max_days": 365,            # storm no older than this
        "max_calls": 15,            # calls on the list
        "kinds": ["Apartments / multi-family", "Commercial", "Industrial"]   # hud targets[].type; never homes
    },
    # T52 quick estimate (`hh.py estimate`): HMP's OWN prices, set by the boss (T51). Each {low, high} in dollars,
    # installed. null = not set yet: the estimate then uses `prices_reference` for that item and says so loudly.
    # A price with only one side set uses it for both. Fill these in config.json, not here.
    "prices": {
        "vinyl_siding_sq": {"low": None, "high": None},    # per square (100 sf of wall), incl. 1-layer tear-off
        "hardie_siding_sq": {"low": None, "high": None},   # James Hardie fiber cement, per square of wall
        "shingle_roof_sq": {"low": None, "high": None},    # architectural shingle roof, 1-layer tear-off, per square
        "extra_layer_sq": {"low": None, "high": None},     # each extra old layer to tear off + dispose, per square
        "soffit_fascia_ft": {"low": None, "high": None},   # per linear foot
        "gutters_ft": {"low": None, "high": None},         # seamless aluminum, per linear foot
        "house_wrap_sq": {"low": None, "high": None},      # per square of wall (100 sf)
        "permit": {"low": None, "high": None},             # per job
        "min_job": {"low": None, "high": None},            # smallest job total (siding / gutters / any job)
        "min_job_roof": {"low": None, "high": None}        # optional: smallest roof job (null = use min_job)
    },
    # MARKET REFERENCE, NOT HMP's prices: eastern Nebraska "typical" ranges from
    # docs/research/2026-09-26-market-prices.md (search summaries of cost guides; spot-check with suppliers).
    # Used only where `prices` is null, and every estimate that uses them carries using_reference: true + a warning.
    "prices_reference": {
        "_label": "market reference, not HMP (docs/research/2026-09-26-market-prices.md, typical range)",
        "vinyl_siding_sq": {"low": 700, "high": 900},      # market $400-1,200 full range
        "hardie_siding_sq": {"low": 900, "high": 1200},    # market $600-1,800
        "shingle_roof_sq": {"low": 450, "high": 550},      # market $350-850
        "extra_layer_sq": {"low": 100, "high": 150},       # disposal/tear-off per square per layer
        "soffit_fascia_ft": {"low": 14, "high": 17},       # market $7.50-22
        "gutters_ft": {"low": 12, "high": 16},             # market $8-25
        "house_wrap_sq": {"low": 100, "high": 150},        # $1-1.50 per sf of wall
        "permit": {"low": 150, "high": 350},               # market $100-500
        "min_job": {"low": 300, "high": 400},              # siding repair minimum
        "min_job_roof": {"low": 2500, "high": 3000}        # roofing minimum
    },
    # How a job's shape changes the price (add-ons as fractions {low, high}) and the rough-squares helper.
    "estimate": {
        "pitch_adders": {"low": {"low": 0.0, "high": 0.0}, "std": {"low": 0.0, "high": 0.0},
                         "steep": {"low": 0.15, "high": 0.25}},       # roof items only; steep = over 6:12
        "story_adders": {"1": {"low": 0.0, "high": 0.0}, "2": {"low": 0.15, "high": 0.15},
                         "3": {"low": 0.35, "high": 0.35}},           # every installed item (not the permit)
        "steep_over": 6, "low_under": 4,     # a numeric pitch (rise per 12): >6 steep, <4 low, else std
        # rough squares from a footprint (clearly labeled rough): roof area = footprint x pitch factor
        "pitch_factor": {"low": 1.05, "std": 1.12, "steep": 1.25},
        "story_height_ft": 9,               # wall height per story
        "openings": 0.15,                   # share of wall that is windows/doors
        "perimeter_factor": 1.1             # real houses are longer than a square: perimeter = 4 x sqrt(area) x this
    },
    "paths": {"db": "data/hailhunter.db", "cache": "data/cache", "export": "data/export",
              "tuned": "data/tuned.json", "tune_history": "data/tune_history.json"}
}

# T35: the only config keys `hh.py tune` may change (section -> key -> [min, max]). data/tuned.json can't touch
# anything else, so a bad tune file can never move prices, radii or the hard rules.
TUNABLE = {
    "hot_zones": {"inspect_rate": [0.002, 0.2], "compete_factor": [0.5, 1.0]},
    "everyday": {"weight": [0.5, 2.0], "inspect_rate": [0.001, 0.1]},
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


def apply_tuned(cfg, tuned):
    """Merges a data/tuned.json doc's `tuned_weights` into cfg: TUNABLE keys only, numbers only, kept in bounds.
    Returns the {section: {key: value}} actually applied."""
    done = {}
    tw = (tuned or {}).get("tuned_weights") if isinstance(tuned, dict) else None
    for sec, keys in (tw or {}).items():
        if sec not in TUNABLE or not isinstance(keys, dict):
            continue
        for k, v in keys.items():
            if k not in TUNABLE[sec] or isinstance(v, bool) or not isinstance(v, (int, float)):
                continue
            lo, hi = TUNABLE[sec][k]
            cfg.setdefault(sec, {})[k] = done.setdefault(sec, {})[k] = min(hi, max(lo, float(v)))
    return done


def load(path=None, tuned_path=None):
    """Defaults <- config.json <- data/tuned.json (T35 `hh.py tune --apply`; TUNABLE keys only, never required)."""
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
    tuned_path = tuned_path or cfg["paths"]["tuned"]
    if os.path.exists(tuned_path):
        try:
            with open(tuned_path) as f:
                apply_tuned(cfg, json.load(f))
        except (OSError, ValueError) as e:        # a broken tune file never stops refresh: defaults + config.json
            print(f"config: ignoring {tuned_path} ({type(e).__name__})", file=sys.stderr)
    os.makedirs(os.path.dirname(cfg["paths"]["db"]), exist_ok=True)
    os.makedirs(cfg["paths"]["cache"], exist_ok=True)
    os.makedirs(cfg["paths"]["export"], exist_ok=True)
    return cfg
