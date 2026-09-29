"""Build docs/design/knock/data/walk.json for the Knock screen mockup.

REAL: street names + lines (Nebraska GIS centerlines, via the open map's areas.json / streets.json),
      homes per street (2020 Census blocks, via areas.json), the zone's storm reports (open map sample storm s1).
FAKE: every home (house number, year built, roof age, owner/mortgage/sale signals) and every knock already
      logged today. Deterministic (seeded), never an owner name. Mockup only; kept out of the real db.
Run: python3 docs/design/knock/data/build/walk.py
"""
import json, math, random, os

HERE = os.path.dirname(os.path.abspath(__file__))
OM = os.path.join(HERE, "..", "..", "..", "open-map", "data")
OUT = os.path.join(HERE, "..", "walk.json")
rnd = random.Random(41456)

areas = json.load(open(os.path.join(OM, "areas.json")))
A = areas["areas"]["north-fremont"]
K = 1 / areas["o"]

def dec(a, arr):
    x, y = a["o"]; out = []
    for i in range(0, len(arr), 2):
        x += arr[i]; y += arr[i + 1]; out.append([x * K, y * K])
    return out

KX, KY = 111.32 * math.cos(41.46 * math.pi / 180), 110.57  # km per degree near Fremont
def km(p): return (p[0] * KX, p[1] * KY)
def ll(x, y): return [round(x / KX, 6), round(y / KY, 6)]

def along(pts, f):
    P = [km(p) for p in pts]; cum = [0]
    for j in range(1, len(P)): cum.append(cum[-1] + math.dist(P[j], P[j - 1]))
    L = max(0, min(1, f)) * cum[-1]; j = 1
    while j < len(P) - 1 and cum[j] < L: j += 1
    q = (L - cum[j - 1]) / ((cum[j] - cum[j - 1]) or 1)
    dx, dy = P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]; m = math.hypot(dx, dy) or 1
    return P[j - 1][0] + dx * q, P[j - 1][1] + dy * q, -dy / m, dx / m

def cross_no(name):  # "E 23rd St" -> 23
    d = "".join(c for c in name if c.isdigit())
    return int(d) if d else None

# The walk: the open map's first two North Fremont streets (its "Plan my walk" order).
streets = [dict(n=s["n"], f=s["f"], t=s["t"], b=s["b"], h=s["h"], p=dec(A, s["p"])) for s in A["s"][:2]]
link = dec(A, A["c"][1]) if len(A["c"]) > 1 else []

HAIL = {2: 1.75}  # band 2 street under the 1.75 in core (open map hailFor)
homes = []
for si, s in enumerate(streets):
    a, b = cross_no(s["f"]), cross_no(s["t"])
    lo, hi = min(a, b) * 100, max(a, b) * 100 + 99
    n = s["h"]; per = math.ceil(n / 2)
    for d in range(n):
        side = 1 if d % 2 == 0 else -1
        k = d // 2
        f = (k + (0.3 if side > 0 else 0.8)) / per
        # house number follows the walk direction on Fremont's block grid, even = one side, odd = other
        num = a * 100 + (b - a) * 100 * f
        num = int(round(num / 2) * 2) + (0 if side > 0 else 1)
        num = max(lo, min(hi, num))
        x, y, nx, ny = along(s["p"], f)
        o = 0.022 * side
        yb = rnd.choice([1912, 1918, 1924, 1936, 1948, 1952, 1955, 1958, 1961, 1964, 1968, 1972, 1978, 1994, 2004])
        roof = rnd.choice([6, 9, 12, 14, 16, 18, 19, 21, 22, 23, 24, 26, 28, 31])
        kind = "res"
        r = rnd.random()
        if r < 0.20: kind = "rent"          # owner mails tax bill elsewhere
        elif r < 0.23: kind = "sign"        # posted No Soliciting sign (from a past knock)
        elif r < 0.25: kind = "new"         # new roof permit in 2025-26: skip
        own = kind == "res"
        mort = own and rnd.random() < 0.62
        sale = rnd.choice([None, None, None, 2008, 2012, 2016, 2019, 2021, 2023, 2024])
        mat = rnd.choice(["3-tab", "3-tab", "architectural", "architectural", "architectural"])
        sid = rnd.choice(["vinyl", "vinyl", "vinyl", "aluminum", "wood", "fiber cement"])
        # small, readable score: hail 40, owner-lived 20, mortgage 15, roof age 15, recent sale 10
        score = 40 * min(1, HAIL[s["b"]] / 2) + (20 if own else 0) + (15 if mort else 0) \
            + 15 * min(1, roof / 25) + (10 if sale and sale >= 2016 else 0)
        homes.append(dict(id=f"nf-{si}-{num}", st=s["n"], no=num, side="E" if side < 0 else "W",
                          s=si, ll=ll(x + nx * o, y + ny * o), yb=yb, roof=roof, roofSrc="assessor",
                          mat=mat, sid=sid, kind=kind, own=own, mort=mort, sale=sale,
                          hail=HAIL[s["b"]], mi=round(0.3 + rnd.random() * 1.6, 1), score=round(score)))

# walk order: street by street, one side up, the other side back (no zig-zag across the street)
walk = []
for si in range(len(streets)):
    H = [h for h in homes if h["s"] == si]
    a, b = cross_no(streets[si]["f"]), cross_no(streets[si]["t"])
    fwd = a < b
    w = sorted([h for h in H if h["side"] == "W"], key=lambda h: h["no"], reverse=not fwd)
    e = sorted([h for h in H if h["side"] == "E"], key=lambda h: h["no"], reverse=fwd)
    walk += w + e
for i, h in enumerate(walk): h["w"] = i

# today's log so far (SAMPLE): started 4:05 PM, first 14 knockable doors done
T0 = 16 * 60 + 5
outs = ["na", "na", "no", "back", "na", "roofer", "na", "yes", "no", "na", "na", "back", "no", "na"]
log, t, j = [], T0, 0
for h in walk:
    if j >= len(outs): break
    if h["kind"] != "res": continue
    t += rnd.choice([2, 2, 3, 3, 4, 5])
    o = outs[j]; j += 1
    e = dict(door=h["id"], o=o, m=t)
    if o == "back": e["when"] = rnd.choice(["tonight", "sat"])
    if o == "yes": e["yes"] = dict(when="now", scope=["roof", "gutters"], m=t)
    if o in ("yes", "back", "roofer"): e["seen"] = rnd.sample(["gutters", "screens", "ac", "vents", "siding"], 2)
    log.append(e); t += 1

bb = [min(h["ll"][0] for h in homes), min(h["ll"][1] for h in homes), max(h["ll"][0] for h in homes), max(h["ll"][1] for h in homes)]
box = [bb[0] - 0.0042, bb[1] - 0.0012, bb[2] + 0.0042, bb[3] + 0.0012]

# background streets from the open map's statewide file, clipped to the box
S = json.load(open(os.path.join(OM, "streets.json")))
ox, oy = S["o"]; k = 1 / S["s"]; bg = []
for c, lines in enumerate(S["t"]):
    for a in lines:
        x, y = a[0], a[1]; pts = [[ox + x * k, oy + y * k]]
        for i in range(2, len(a), 2):
            x += a[i]; y += a[i + 1]; pts.append([ox + x * k, oy + y * k])
        if any(box[0] <= p[0] <= box[2] and box[1] <= p[1] <= box[3] for p in pts):
            bg.append([c] + [v for p in pts for v in (round(p[0], 5), round(p[1], 5))])

out = dict(
    src={"streets": "REAL: Nebraska GIS Street_Centerlines (gis.ne.gov), via docs/design/open-map/data",
         "homesPerStreet": "REAL: 2020 Census blocks (Total_Housing), via open-map areas.json",
         "homes": "SAMPLE: fake homes on real streets (numbers on Fremont's block grid, never owner names)",
         "log": "SAMPLE: knocks already logged this afternoon"},
    zone=dict(id="north-fremont", name={"en": "North Fremont", "es": "Norte de Fremont"}, storm="s1",
              date="2026-09-14", time="6:04–6:31 PM", town="Fremont",
              rep=[["nws", 1.75, "2 mi N of Fremont, trained spotter", "2 mi al N de Fremont, observador entrenado", "6:12 PM"],
                   ["mping", 1.5, "near Morningside Rd & Clarkson St", "cerca de Morningside Rd y Clarkson St", "6:15 PM"],
                   ["mrms", 2.1, "radar estimate, 1 km cell", "estimado de radar, cuadro de 1 km", "6:14 PM"]]),
    clock=dict(today="2026-09-28", now=t + 2, start=T0, sunset=19 * 60 + 11),
    streets=[dict(n=s["n"], f=s["f"], t=s["t"], p=[[round(p[0], 6), round(p[1], 6)] for p in s["p"]]) for s in streets],
    ctx=[dict(n=x["n"], p=[[round(p[0], 6), round(p[1], 6)] for p in dec(A, x["p"])]) for x in A["s"][2:]],
    link=[[round(p[0], 6), round(p[1], 6)] for p in link],
    box=[round(v, 6) for v in box], bg=bg, homes=walk, log=log)
json.dump(out, open(OUT, "w"), separators=(",", ":"), ensure_ascii=False)
print("homes", len(walk), "knockable", sum(h["kind"] == "res" for h in walk), "bg lines", len(bg), "bytes", os.path.getsize(OUT))
print([ (h["st"],h["no"],h["side"]) for h in walk[:6]], walk[-1]["st"], walk[-1]["no"])
