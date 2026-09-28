#!/usr/bin/env python3
"""Builds pages/v25/practice-houses.js: the HMP App's practice houses (Practice mode only, never the database).

FilthE, 2026-09-27 ("No knocking yet", CLAUDE.md): prove the app end to end on realistic mock data from public sources.
  - Storm: a REAL report. SPC storm reports, convective day 2026-06-13 (https://www.spc.noaa.gov/climo/reports/260613_rpts_hail.csv):
      1314Z Fremont, Dodge Co., NE (41.44, -96.49) 1.00" hail (mPING, "Quarter"), OAX
      1315Z 1 SSW Inglewood, Dodge Co., NE (41.40, -96.51) 1.00" hail, NWS employee: "Quarter-size hail being wind driven", OAX
    Same reports in the NWS Omaha LSR feed (IEM: mesonet.agron.iastate.edu/geojson/lsr.php?wfos=OAX).
  - Streets: REAL Fremont streets and their address ranges (Nebraska state GIS, NG911 Street_Centerlines: ADDR_LF..ADDR_RT),
    homes sit on REAL parcel outlines (StatewideParcelsExternal, outline only: no owner, no address).
  - Homes: FAKE. House numbers are interpolated inside the street's real range (so they read like real Fremont
    addresses but are made up); year built / size are made up. No owner names, no phones, nothing personal.
  - Maps: the engine's own basemap.Maker (streets, lots, labels, the walking route), same shapes as walks/<zone>.
Output: window.HMPPracticeHouses = {source, storm, zones: zones/current, walks: {<zone id>: walks/<zone id>},
evidence: {<slug>: evidence doc}}. Dates in walks are set to "today" by the page when loaded (HMPPractice.loadHouses).

    python3 tests/pages/practice_houses_build.py          (needs gis.ne.gov; ~20 s)
"""
import json
import math
import os
import random
import sys

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
from hailhunter import basemap  # noqa: E402
from hailhunter.config import DEFAULTS  # noqa: E402
from hailhunter.todaywalk import house_facts, slug  # noqa: E402

OUT = os.path.join(ROOT, "pages", "v25", "practice-houses.js")
STORM_DAY = "2026-06-13"
REPORTS = [  # SPC 260613_rpts_hail.csv (Dodge County lines), verbatim
    {"time_utc": "1314", "size_in": 1.00, "place": "Fremont", "county": "Dodge", "lat": 41.44, "lon": -96.49,
     "remark": "Report from mPING: Quarter (1.00 in.). (OAX)"},
    {"time_utc": "1315", "size_in": 1.00, "place": "1 SSW Inglewood", "county": "Dodge", "lat": 41.40, "lon": -96.51,
     "remark": "Quarter-size hail being wind driven. (OAX)"},
]
# three walk areas in older Fremont neighborhoods near the 1.00" report; 20 homes each
AREAS = [(41.4455, -96.4905), (41.4412, -96.4810), (41.4495, -96.5035)]
PER_ZONE = 20
M_LAT = 110574.0


def m_lon(lat):
    return 111320.0 * math.cos(math.radians(lat))


def dist_m(a, b):
    return math.hypot((a[0] - b[0]) * M_LAT, (a[1] - b[1]) * m_lon(a[0]))


def near_report(lat, lon):
    best = min(REPORTS, key=lambda r: dist_m((lat, lon), (r["lat"], r["lon"])))
    return best, dist_m((lat, lon), (best["lat"], best["lon"])) / 1609.34


def fetch(session, url, box, fields):
    return basemap.fetch_layer(session, url, box, fields, DEFAULTS)


def centroid(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return (sum(ys) / len(ys), sum(xs) / len(xs))   # (lat, lon)


def homes_for(center, streets, lots, used, rnd):
    """Walks every local street segment near `center`, both sides, every ~22 m: the number = the side's real range
    interpolated at that point; the home = the nearest unused real lot within 35 m of the curb point, set back."""
    out = []
    for f in streets:
        a = f["attributes"]
        if (a.get("INC_COM_L") or "").upper() != "FREMONT" or (a.get("ST_CLASS") or "").upper() not in ("LOCAL", ""):
            continue
        name = basemap.street_name(a)
        for path in f["geometry"]["paths"]:
            pts = [(p[1], p[0]) for p in path]
            if dist_m(pts[len(pts) // 2], center) > 230:
                continue
            seg_len = sum(dist_m(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
            if seg_len < 40:
                continue
            for side, lo, hi in (("L", a.get("ADDR_LF"), a.get("ADDR_LT")), ("R", a.get("ADDR_RF"), a.get("ADDR_RT"))):
                if not lo or not hi:
                    continue
                d = 14.0
                while d < seg_len - 10:
                    t = d / seg_len
                    # the point and heading at distance d
                    acc = 0.0
                    for i in range(len(pts) - 1):
                        L = dist_m(pts[i], pts[i + 1])
                        if acc + L >= d:
                            u = (d - acc) / L if L else 0
                            p = (pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u)
                            dy, dx = (pts[i + 1][0] - pts[i][0]) * M_LAT, (pts[i + 1][1] - pts[i][1]) * m_lon(p[0])
                            break
                        acc += L
                    n = math.hypot(dx, dy) or 1
                    sgn = 1 if side == "L" else -1   # left of the drawing direction
                    off = (p[0] + sgn * (dx / n) * 18 / M_LAT, p[1] - sgn * (dy / n) * 18 / m_lon(p[0]))
                    cand = [c for c in lots if c not in used and dist_m(c, off) < 35]
                    if cand:
                        c = min(cand, key=lambda c: dist_m(c, off))
                        num = int(round(lo + (hi - lo) * t))
                        if num % 2 != lo % 2:
                            num += 1 if num < max(lo, hi) else -1
                        used.add(c)
                        out.append({"address": f"{num} {name}", "lat": round(c[0], 6), "lon": round(c[1], 6), "street": name})
                    d += 22 + rnd.random() * 8
    uniq = {}
    for h in out:
        uniq.setdefault(h["address"], h)
    return list(uniq.values())


def walk_order(hs):
    """Nearest-neighbour walk from the house farthest west-north (street by street, like a person walks)."""
    if not hs:
        return hs
    rest = sorted(hs, key=lambda h: (-h["lat"], h["lon"]))
    route = [rest.pop(0)]
    while rest:
        last = route[-1]
        nxt = min(rest, key=lambda h: dist_m((last["lat"], last["lon"]), (h["lat"], h["lon"])) * (1 if h["street"] == last["street"] else 1.6))
        rest.remove(nxt)
        route.append(nxt)
    return route


def hull(pts):
    P = sorted(set((round(p[1], 6), round(p[0], 6)) for p in pts))
    if len(P) < 3:
        return None

    def cr(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in P:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(P):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    ring = lo[:-1] + up[:-1]
    return [[x, y] for x, y in ring] + [list(ring[0])]


def main():
    rnd = random.Random(20260613)
    s = requests.Session()
    s.headers["User-Agent"] = "HailHunter practice data (HMP Siding & Roofing)"
    box = [-96.515, 41.435, -96.472, 41.456]
    streets = fetch(s, basemap.STREETS_URL, box, "PRE_DIR,ST_NAME,ST_TYPE,POS_DIR,ST_CLASS,ADDR_LF,ADDR_LT,ADDR_RF,ADDR_RT,INC_COM_L")
    lots = [centroid(f["geometry"]["rings"][0]) for f in fetch(s, basemap.LOTS_URL, box, "OBJECTID") if f.get("geometry", {}).get("rings")]
    print(f"streets {len(streets)}, lots {len(lots)}", file=sys.stderr)
    maker = basemap.Maker(DEFAULTS, session=s)
    used, zones, walks, evidence = set(), [], {}, {}
    for zi, center in enumerate(AREAS):
        hs = homes_for(center, streets, lots, used, rnd)
        hs.sort(key=lambda h: dist_m(center, (h["lat"], h["lon"])))
        hs = walk_order(hs[:PER_ZONE])
        if len(hs) < PER_ZONE:
            raise SystemExit(f"area {zi}: only {len(hs)} homes")
        names = []
        for h in hs:
            if h["street"] not in names:
                names.append(h["street"])
        area = f"Fremont: {names[0]} & {names[1]}".replace("  ", " ")
        zid = f"practice_{STORM_DAY}_Fremont~t{zi + 1}"
        stops = []
        for h in hs:
            built = rnd.choice([1912, 1924, 1938, 1948, 1952, 1956, 1961, 1964, 1968, 1972, 1977, 1983, 1991])
            sqft = rnd.randrange(900, 2300, 10)
            facts = house_facts({"built": built, "sqft": sqft, "stories": rnd.choice([1, 1, 1, 2, 1.5])}, DEFAULTS)
            rep, mi = near_report(h["lat"], h["lon"])
            hail = math.floor(min(1.25, max(0.88, 1.0 + rnd.uniform(-0.1, 0.2) - mi * 0.05)) * 10 + 0.5) / 10   # one decimal: the app shows 1.1", never 1.15
            stop = {"address": h["address"], "city": "Fremont", "lat": h["lat"], "lon": h["lon"],
                    "why": {"en": f"{hail:.1f}\" hail Jun 13, built {built}", "es": f"Granizo de {hail:.1f} pulg. el 13 de jun., construida en {built}"},
                    **facts}
            stops.append(stop)
            evidence[slug(h["address"], "Fremont")] = {
                "address": h["address"], "city": "Fremont", "day": STORM_DAY, "hail_in": hail, "radar_max_in": round(hail + 0.25, 2),
                "nearest_report": {"dist_mi": round(mi, 1), "size_in": rep["size_in"], "source": "lsr", "place": rep["place"]}}
        walk = {"area": area, "date": None, "zone_id": zid, "kind": "storm", "list_id": f"{STORM_DAY}_Fremont", "city": "Fremont",
                "goal_doors": PER_ZONE, "est_minutes": 75, "practice": True,
                "why": {"en": "1-inch hail hit Fremont on June 13 (NWS Omaha reports), the homes are older and most are owner-lived.",
                        "es": "El 13 de junio cayó granizo de 1 pulgada en Fremont (reportes del NWS Omaha), las casas ya tienen años y en la mayoría viven sus dueños."},
                "stops": stops}
        maker.add(walk)
        walks[zid] = walk
        lat = sum(x["lat"] for x in stops) / len(stops)
        lon = sum(x["lon"] for x in stops) / len(stops)
        poly = hull([(x["lat"], x["lon"]) for x in stops])
        zones.append({"id": zid, "name": area, "center": {"lat": round(lat, 6), "lon": round(lon, 6)}, "polygon": poly, "polygon_kind": "walk",
                      "walk_polygon": poly, "walk_center": {"lat": round(lat, 6), "lon": round(lon, 6)}, "walk_homes": len(stops),
                      "score": [66, 61.5, 58][zi], "heat": [1, 0.85, 0.7][zi], "hail_in": max(evidence[slug(x["address"], "Fremont")]["hail_in"] for x in stops),
                      "storm_day": STORM_DAY, "homes": len(stops), "why": walk["why"], "walk_id": zid, "kind": "storm", "list_id": walk["list_id"]})
        print(f"{zid}: {area}, {len(stops)} homes, basemap {'yes' if walk.get('basemap') else 'NO'}", file=sys.stderr)
    doc = {"source": {"storm": "SPC storm reports 2026-06-13 (https://www.spc.noaa.gov/climo/reports/260613_rpts_hail.csv), NWS Omaha LSRs",
                      "streets": basemap.SOURCE + ", address ranges from NG911 centerlines",
                      "homes": "made up: house numbers inside the real ranges, facts invented; no owners, no phones"},
           "storm": {"day": STORM_DAY, "reports": REPORTS},
           "zones": {"as_of": None, "near": {"name": "Fremont, NE", "lat": 41.4333, "lon": -96.4981}, "practice": True, "zones": zones},
           "walks": walks, "evidence": evidence}
    js = ("/* HMP App practice houses (published as v25/practice-houses.js; loaded only when Practice mode's \"Load practice houses\"\n"
          " * is tapped). Built by tests/pages/practice_houses_build.py: real Fremont streets + a real SPC hail report (2026-06-13,\n"
          " * 1.00\" at Fremont), made-up homes (no owners, no phones). Never written to the database. */\n"
          "(function (root) { root.HMPPracticeHouses = " + json.dumps(doc, separators=(",", ":"), ensure_ascii=False) + "; })(typeof window !== \"undefined\" ? window : this);\n")
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(js)
    print(f"wrote {OUT} ({len(js) // 1024} KB, {sum(len(w['stops']) for w in walks.values())} homes)", file=sys.stderr)


if __name__ == "__main__":
    main()
