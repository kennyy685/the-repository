"""Build areas.json for the open map's click flow (what opens when you click an area).

For each SAMPLE area in index.html:
  - the best real residential streets inside it (names + lines: Nebraska GIS Street_Centerlines),
  - homes along each street (real 2020 Census blocks, each block's housing units shared between the
    street(s) nearest its center; blocks with 40+ units, usually apartments, are left out),
  - the hail band each street sits in (from the mockup's SAMPLE storm outlines, ported exactly below),
  - a walking loop on the real street network: park -> street 1 -> ... -> back to the car.
No owner names, no addresses, no house points.

Inputs (made by fetch.py + blocks.py, same folder): Street_Centerlines.json, blocks.json
Run:  python3 areas.py   ->  areas.json  (copy into docs/design/open-map/data/)
Keep AREAS and STORMS below in sync with index.html (same order, same numbers)."""
import json, math, collections, heapq, re, os

# ---------------- sample areas + storms (copied from index.html) ----------------
AREAS = [  # id, center, (rx km, ry km, rotation deg), storm
    ("north-fremont", (-96.497, 41.456), (2.4, 1.5, -10), "s1"), ("east-fremont", (-96.474, 41.437), (1.9, 1.2, 5), "s1"),
    ("valley", (-96.346, 41.313), (1.6, 1.1, 0), "s1"), ("elkhorn", (-96.236, 41.287), (2.3, 1.6, -20), "s1"),
    ("west-omaha", (-96.160, 41.248), (2.2, 1.4, 0), "s1"), ("bennington", (-96.157, 41.364), (1.5, 1.1, 0), "s2"),
    ("blair", (-96.135, 41.544), (1.8, 1.3, 0), "s2"), ("wahoo", (-96.620, 41.211), (1.6, 1.2, 0), "s5"),
    ("gretna", (-96.243, 41.141), (2.0, 1.4, 0), "s4"), ("papillion", (-96.060, 41.150), (2.2, 1.4, 0), "s4"),
    ("ne-lincoln", (-96.655, 40.868), (2.6, 1.6, 0), "s3"), ("waverly", (-96.528, 40.917), (1.4, 1.0, 0), "s3"),
]
STORMS = {  # path, half-widths for the 1/1.5/2 in bands (km), 2 in core span along the path
    "s1": ([(-96.80, 41.63), (-96.62, 41.53), (-96.50, 41.46), (-96.40, 41.39), (-96.28, 41.31), (-96.17, 41.25), (-96.05, 41.20)], (7.5, 4.6, 2.2), (.12, .72)),
    "s2": ([(-96.33, 41.68), (-96.22, 41.60), (-96.14, 41.53), (-96.14, 41.44), (-96.15, 41.37), (-96.09, 41.31)], (6, 3.2, 0), (0, 0)),
    "s3": ([(-96.98, 40.99), (-96.84, 40.93), (-96.70, 40.88), (-96.60, 40.90), (-96.50, 40.93)], (6.2, 3.6, 1.4), (.62, .95)),
    "s4": ([(-96.47, 41.26), (-96.36, 41.19), (-96.25, 41.145), (-96.14, 41.14), (-96.03, 41.15), (-95.95, 41.16)], (6.2, 4, 2.3), (.18, .62)),
    "s5": ([(-96.78, 41.33), (-96.70, 41.27), (-96.62, 41.21), (-96.50, 41.12), (-96.40, 41.05)], (3.4, 1.3, 0), (0, 0)),
}

# ---------------- exact ports of the page's seeded geometry ----------------
M32 = 0xffffffff
def imul(a, b): return (a * b) & M32
def rng(seed):
    s = [seed & M32]
    def f():
        s[0] = (s[0] + 0x6D2B79F5) & M32; t = s[0]
        t = imul(t ^ (t >> 15), t | 1)
        t = (t ^ ((t + imul(t ^ (t >> 7), t | 61)) & M32)) & M32
        return ((t ^ (t >> 14)) & M32) / 4294967296
    return f
KX = 111.32 * math.cos(41.2 * math.pi / 180); KY = 110.57
toKm = lambda p: (p[0] * KX, p[1] * KY)
toLL = lambda p: (p[0] / KX, p[1] / KY)
def catmull(pts, n):
    out = []
    for i in range(len(pts) - 1):
        p0 = pts[i - 1] if i >= 1 else pts[i]; p1 = pts[i]; p2 = pts[i + 1]; p3 = pts[i + 2] if i + 2 < len(pts) else p2
        for k in range(n):
            t = k / n; t2 = t * t; t3 = t2 * t
            out.append(tuple(.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                   + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(pts[-1]); return out
def swath(path, hw, t0, t1, seed):
    r = rng(seed); P = catmull([toKm(p) for p in path], 14); N = len(P); left = []; right = []
    ph = r() * 6.28; ph2 = r() * 6.28
    for i in range(N):
        t = i / (N - 1)
        if t < t0 or t > t1: continue
        u = (t - t0) / (t1 - t0)
        a = P[max(0, i - 1)]; b = P[min(N - 1, i + 1)]; dx = b[0] - a[0]; dy = b[1] - a[1]; m = math.hypot(dx, dy) or 1; dx /= m; dy /= m
        taper = math.sin(math.pi * min(1, max(0, u))) ** .55
        wob = 1 + .09 * math.sin(u * 8 + ph) + .035 * math.sin(u * 21 + ph2)
        wl = hw * taper * wob; wr = hw * taper * (2 - wob)
        left.append(toLL((P[i][0] - dy * wl, P[i][1] + dx * wl))); right.append(toLL((P[i][0] + dy * wr, P[i][1] - dx * wr)))
    ring = left + right[::-1]; ring.append(ring[0]); return ring
def blob(c, rx, ry, rot, seed, n=56):
    r = rng(seed); cx, cy = toKm(c); a0 = rot * math.pi / 180; ph = r() * 6.28; ring = []
    for i in range(n):
        a = i / n * 2 * math.pi; w = 1 + .09 * math.sin(a * 3 + ph) + .05 * math.sin(a * 5 + ph * 2)
        x = math.cos(a) * rx * w; y = math.sin(a) * ry * w
        ring.append(toLL((cx + x * math.cos(a0) - y * math.sin(a0), cy + x * math.sin(a0) + y * math.cos(a0))))
    ring.append(ring[0]); return ring
def inring(p, ring):
    ins = False; j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > p[1]) != (yj > p[1]) and p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi: ins = not ins
        j = i
    return ins
def bbox(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; return (min(xs), min(ys), max(xs), max(ys))

BANDS = {}  # storm -> [(band, ring, bbox)]
for si, (k, (path, w, core)) in enumerate(STORMS.items()):
    BANDS[k] = []
    for bi, (b, hw, t0, t1) in enumerate([(1, w[0], 0, 1), (1.5, w[1], .06, .94), (2, w[2], core[0], core[1])]):
        if not hw: continue
        ring = swath(path, hw, t0, t1, si * 10 + bi + 1); BANDS[k].append((b, ring, bbox(ring)))
# REAL zones (real_areas.json from real.py) replace the samples when present: ring = the zone, band = its biggest hail
REAL = json.load(open('real_areas.json')) if os.path.exists('real_areas.json') else None
REAL_BY = {z['id']: z for z in REAL or []}
def band_at(p, storm):
    if REAL:
        z = REAL_BY[storm]
        return z['band'] if inring(p, z['ring']) else 0
    best = 0
    for b, ring, bb in BANDS[storm]:
        if b > best and bb[0] <= p[0] <= bb[2] and bb[1] <= p[1] <= bb[3] and inring(p, ring): best = b
    return best

# ---------------- street names: one clean format across counties ----------------
DIR = {'NORTH': 'N', 'SOUTH': 'S', 'EAST': 'E', 'WEST': 'W'}
TYP = {'STREET': 'St', 'AVENUE': 'Ave', 'ROAD': 'Rd', 'DRIVE': 'Dr', 'LANE': 'Ln', 'CIRCLE': 'Cir', 'COURT': 'Ct', 'BOULEVARD': 'Blvd',
       'PARKWAY': 'Pkwy', 'PLACE': 'Pl', 'PLAZA': 'Plz', 'TRAIL': 'Trl', 'HIGHWAY': 'Hwy', 'TERRACE': 'Ter', 'WAY': 'Way', 'ST': 'St',
       'AVE': 'Ave', 'RD': 'Rd', 'DR': 'Dr', 'LN': 'Ln', 'CIR': 'Cir', 'CT': 'Ct', 'BLVD': 'Blvd', 'PKWY': 'Pkwy', 'PL': 'Pl',
       'PLZ': 'Plz', 'TRL': 'Trl', 'HWY': 'Hwy', 'TER': 'Ter'}
def nice(n):
    w = n.split(); out = []
    for i, x in enumerate(w):
        u = x.upper()
        if i == 0 and u in DIR and len(w) > 2: out.append(DIR[u])
        elif i == len(w) - 1 and u in TYP: out.append(TYP[u])
        elif re.fullmatch(r'\d+(ST|ND|RD|TH)', u): out.append(u[:-2] + u[-2:].lower())
        elif u in ('US', 'NE'): out.append(u)
        elif len(u) == 1: out.append(u)
        elif u.startswith('MC') and len(u) > 3: out.append('Mc' + u[2:].capitalize())
        else: out.append(u.capitalize())
    out = [x for i, x in enumerate(out) if i == 0 or x != out[i - 1]]  # "Ave Ave A", "Hwy Hwy 34"
    return ' '.join(out)

NOWALK = {'Interstate', 'Freeway', 'Expressway', 'Ramp'}
RESID = {'Local', 'LOCAL', None, 'Collector', 'Minor Collector'}
BUSY = re.compile(r'\b(Hwy|Highway|Ramp|County Road|Co Rd|Frontage|Cornhusker)\b', re.I)
# Lancaster County's centerlines carry no class: its mile-grid arterials, left out of "best streets" by name
ARTERIAL = {'Superior St', 'Fletcher Ave', 'N 27th St', 'N 33rd St', 'N 48th St', 'N 56th St', 'N 70th St', 'N 84th St',
            'Holdrege St', 'Adams St', 'Havelock Ave', 'Folkways Blvd', 'N 148th St', 'N 14th St', 'Arbor Rd', 'Enterprise Dr'}

def main():
    raw = json.load(open('Street_Centerlines.json'))
    blocks = json.load(open('blocks.json'))
    out = {'src': 'Street names + lines: Nebraska GIS Street_Centerlines (gis.ne.gov). Homes per street: 2020 Census blocks '
                  '(Total_Housing, blocks under 40 units) shared to the nearest streets. Hail band per street: the mockup\'s '
                  'SAMPLE storms. Walk: shortest paths on the real street network. Built by data/build/areas.py.',
           'o': 1e5, 'areas': {}}
    if REAL:
        out['src'] = out['src'].replace("the mockup's SAMPLE storms", "the real 2026 zone it sits in (data/storms-2026.json)")
    todo = [(z['id'], tuple(z['c']), None, z['id']) for z in REAL] if REAL else AREAS
    for ai, (aid, c, geo, storm) in enumerate(todo):
        if REAL:
            ring = REAL_BY[aid]['ring']; bb = bbox(ring)
            # big zones: walk where the homes are (densest 1 km cell inside the zone), not the whole outline
            cell = collections.Counter()
            for x, y, n in blocks:
                if n < 40 and bb[0] <= x <= bb[2] and bb[1] <= y <= bb[3] and inring((x, y), ring): cell[(round(x * KX), round(y * KY))] += n
            if not cell: print(aid, 'no homes'); continue
            (gx, gy), _ = cell.most_common(1)[0]; c = (gx / KX, gy / KY); r = 2.2
            box = (max(bb[0], c[0] - r / KX) - .006, max(bb[1], c[1] - r / KY) - .006, min(bb[2], c[0] + r / KX) + .006, min(bb[3], c[1] + r / KY) + .006)
        else:
            rx, ry, rot = geo
            ring = blob(c, rx, ry, rot, ai + 50); bb = bbox(ring)
            mg = 0.006
            box = (bb[0] - mg, bb[1] - mg, bb[2] + mg, bb[3] + mg)
        # --- graph of walkable street segments around the area ---
        adj = collections.defaultdict(list); segs = []
        for f in raw:
            cl = f['attributes']['ST_CLASS']
            if cl in NOWALK: continue
            nm = nice(f['attributes']['FULL_ST_NM']) if f['attributes']['FULL_ST_NM'] else ''
            for p in f['geometry']['paths']:
                if all(q[0] < box[0] or q[0] > box[2] or q[1] < box[1] or q[1] > box[3] for q in p): continue
                for a, b in zip(p, p[1:]):
                    ka = (round(a[0], 5), round(a[1], 5)); kb = (round(b[0], 5), round(b[1], 5))
                    if ka == kb: continue
                    L = math.hypot((ka[0] - kb[0]) * KX, (ka[1] - kb[1]) * KY) * 1000
                    adj[ka].append((kb, L, nm)); adj[kb].append((ka, L, nm))
                    segs.append((ka, kb, nm, cl))
        # --- homes per street name from Census blocks (inside the area, < 40 units) ---
        G = 0.002; grid = collections.defaultdict(list)
        for s in segs:
            if not s[2]: continue
            for gx in range(int(min(s[0][0], s[1][0]) / G) - 0, int(max(s[0][0], s[1][0]) / G) + 1):
                for gy in range(int(min(s[0][1], s[1][1]) / G) - 0, int(max(s[0][1], s[1][1]) / G) + 1):
                    grid[(gx, gy)].append(s)
        def dseg(p, a, b):
            px, py = toKm(p); ax, ay = toKm(a); bx, by = toKm(b); dx, dy = bx - ax, by - ay
            t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / ((dx * dx + dy * dy) or 1e-12)))
            return math.hypot(px - ax - t * dx, py - ay - t * dy)
        homes = collections.Counter()
        for x, y, n in blocks:
            if n < 1 or n >= 40 or not (bb[0] <= x <= bb[2] and bb[1] <= y <= bb[3]) or not inring((x, y), ring): continue
            gx, gy = int(x / G), int(y / G); best = {}
            for i in range(gx - 1, gx + 2):
                for j in range(gy - 1, gy + 2):
                    for s in grid[(i, j)]:
                        d = dseg((x, y), s[0], s[1])
                        if d < best.get(s[2], 9): best[s[2]] = d
            if not best: continue
            dmin = min(best.values())
            if dmin > 0.2: continue
            near = [k for k, d in best.items() if d <= dmin * 1.25 + 0.01]
            for k in near: homes[k] += n / len(near)
        # --- street pieces inside the area: longest chain per name, capped to a ~1 km walk ---
        byname = collections.defaultdict(lambda: collections.defaultdict(list)); totlen = collections.Counter(); cls = {}
        for ka, kb, nm, cl in segs:
            if not nm: continue
            mid = ((ka[0] + kb[0]) / 2, (ka[1] + kb[1]) / 2)
            if not inring(mid, ring): continue
            L = math.hypot((ka[0] - kb[0]) * KX, (ka[1] - kb[1]) * KY) * 1000
            byname[nm][ka].append((kb, L)); byname[nm][kb].append((ka, L)); totlen[nm] += L; cls[nm] = cl
        def far(g, s):
            dist = {s: 0}; prev = {s: None}; h = [(0, s)]
            while h:
                d, u = heapq.heappop(h)
                if d > dist[u]: continue
                for v, L in g[u]:
                    if d + L < dist.get(v, 1e18): dist[v] = d + L; prev[v] = u; heapq.heappush(h, (d + L, v))
            t = max(dist, key=dist.get); path = [t]
            while prev[path[-1]] is not None: path.append(prev[path[-1]])
            return path[::-1], dist[t]
        cands = []
        for nm, g in byname.items():
            if cls[nm] not in RESID or BUSY.search(nm) or nm in ARTERIAL: continue
            seen = set(); comps = []
            for s0 in g:
                if s0 in seen: continue
                stack = [s0]; comp = set([s0])
                while stack:
                    u = stack.pop()
                    for v, _ in g[u]:
                        if v not in comp: comp.add(v); stack.append(v)
                seen |= comp; comps.append(comp)
            comp = max(comps, key=len); a, _ = far(g, next(iter(comp))); path, L = far(g, a[-1])
            cum = [0]
            for p, q in zip(path, path[1:]): cum.append(cum[-1] + math.hypot((p[0] - q[0]) * KX, (p[1] - q[1]) * KY) * 1000)
            bands = [band_at(p, storm) for p in path]
            # window of <= 1000 m with the most hail-weighted length
            bi, bj, bs = 0, len(path) - 1, -1
            for i in range(len(path)):
                s = 0
                for j in range(i + 1, len(path)):
                    if cum[j] - cum[i] > 1000: break
                    s += (cum[j] - cum[j - 1]) * (1 + max(bands[j], bands[j - 1]))
                    if s > bs: bs, bi, bj = s, i, j
            win = path[bi:bj + 1]; wl = cum[bj] - cum[bi]
            if wl < 150: continue
            h = homes[nm] * wl / max(totlen[nm], 1)
            if h < 8: continue
            fr = {0: 0, 1: 0, 1.5: 0, 2: 0}
            for j in range(bi + 1, bj + 1): fr[max(bands[j], bands[j - 1])] += cum[j] - cum[j - 1]
            f2 = fr[2] / wl; f15 = f2 + fr[1.5] / wl; f1 = f15 + fr[1] / wl
            band = 2 if f2 >= .35 else 1.5 if f15 >= .35 else 1 if f1 >= .35 else 0
            cands.append({'n': nm, 'p': win, 'm': wl, 'h': h, 'b': band})
        cands.sort(key=lambda s: (-s['b'], -s['h']))
        # --- cross streets at each end (for "from -> to") ---
        def cross(path, own):
            res = []
            for seq in (path, path[::-1]):
                nm = ''; walked = 0
                for i, u in enumerate(seq):
                    if i: walked += math.hypot((u[0] - seq[i - 1][0]) * KX, (u[1] - seq[i - 1][1]) * KY) * 1000
                    if walked > 160: break
                    oth = sorted({e[2] for e in adj[u] if e[2] and e[2] != own})
                    if oth: nm = oth[0]; break
                res.append(nm)
            return res
        def dijkstra(src):
            dist = {src: 0}; prev = {src: None}; h = [(0, src)]
            while h:
                d, u = heapq.heappop(h)
                if d > dist[u]: continue
                if d > 6000: break
                for v, L, _ in adj[u]:
                    if d + L < dist.get(v, 1e18): dist[v] = d + L; prev[v] = u; heapq.heappush(h, (d + L, v))
            return dist, prev
        def pathto(prev, t):
            p = [t]
            while prev[p[-1]] is not None: p.append(prev[p[-1]])
            return p[::-1]
        pick = []; used = set()
        for s in cands:
            if s['n'] in used: continue
            used.add(s['n']); pick.append(s)
            if len(pick) == 8: break
        if not pick:
            print(aid, 'no streets'); continue
        # --- tour: try each of the top 3 as the start, nearest-neighbour by walking distance ---
        best = None
        for si in range(min(3, len(pick))):
            for flip in (0, 1):
                st0 = dict(pick[si]); st0['p'] = st0['p'][::-1] if flip else st0['p']
                order = [st0]; rest = [dict(x) for i, x in enumerate(pick) if i != si]; conns = [[]]; cost = 0
                cur = st0['p'][-1]
                while rest:
                    dist, prev = dijkstra(cur); bj, bd, bflip = None, 1e18, 0
                    for j, x in enumerate(rest):
                        for fl, end in ((0, x['p'][0]), (1, x['p'][-1])):
                            if dist.get(end, 1e18) < bd: bj, bd, bflip = j, dist[end], fl
                    if bj is None: break
                    x = rest.pop(bj); x['p'] = x['p'][::-1] if bflip else x['p']
                    conns.append(pathto(prev, x['p'][0])); cost += bd if len(order) < 4 else bd * .3
                    order.append(x); cur = x['p'][-1]
                if best is None or (len(order), -cost) > (len(best[0]), -best[2]): best = (order, conns, cost)
        order, conns, _ = best
        park = order[0]['p'][0]
        rets = []
        for x in order:
            dist, prev = dijkstra(x['p'][-1])
            rets.append(pathto(prev, park) if park in dist else [x['p'][-1], park])
        ox, oy = round(c[0] * 1e5), round(c[1] * 1e5)
        def enc(pts):
            o = []; px, py = ox, oy
            for p in pts:
                x, y = round(p[0] * 1e5), round(p[1] * 1e5); o += [x - px, y - py]; px, py = x, y
            return o
        streets = []
        for x in order:
            fr, to = cross(x['p'], x['n'])
            streets.append({'n': x['n'], 'b': x['b'], 'h': round(x['h']), 'm': round(x['m']), 'f': fr, 't': to, 'p': enc(x['p'])})
        pk = cross(order[0]['p'], order[0]['n'])[0]
        out['areas'][aid] = {'o': [ox, oy], 'park': enc([park]), 'pn': [order[0]['n'], pk], 's': streets,
                             'c': [enc(p) for p in conns], 'r': [enc(p) for p in rets]}
        tot = sum(s['h'] for s in streets)
        print(f"{aid:14s} {len(streets)} streets, {tot} homes | " + '; '.join(f"{s['n']} ({s['f']}->{s['t']}) b{s['b']} h{s['h']} {s['m']}m" for s in streets))
    json.dump(out, open('areas.json', 'w'), separators=(',', ':'))
    print('areas.json', os.path.getsize('areas.json'), 'bytes')

if __name__ == '__main__':
    main()
