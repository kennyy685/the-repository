"""Builds shared/data.js for the next-level mockups from REAL public data already in the repo
(docs/design/open-map/data: base.json, streets.json, real.js, night.js) plus Columbus streets pulled once
from Nebraska GIS Street_Centerlines (_columbus_raw.json). Homes are FAKE samples (no owner names, ever).
Run from repo root: python3 docs/design/next-level/shared/build.py"""
import json, math, random
D = 'docs/design/open-map/data/'
OUT = 'docs/design/next-level/shared/'
def js(path):
    t = open(path).read(); return json.loads(t[t.index('{'):t.rindex('}') + 1])
real, night = js(D + 'real.js'), js(D + 'night.js')
R = (-97.62, 40.98, -95.84, 41.74)  # region: Columbus to Omaha
inb = lambda p, b: b[0] <= p[0] <= b[2] and b[1] <= p[1] <= b[3]
r4 = lambda p: [round(p[0], 4), round(p[1], 4)]
r5 = lambda p: [round(p[0], 5), round(p[1], 5)]

# --- basemap: water, streams, highways, rail, towns (outlines), counties
base = json.load(open(D + 'base.json'))
feats = []
def lines(g):
    t = g['type']; c = g['coordinates']
    if t == 'LineString': return [c]
    if t == 'MultiLineString': return c
    if t == 'Polygon': return c
    if t == 'MultiPolygon': return [r for p in c for r in p]
    return []
for f in base['features']:
    p = f['properties']; k = p['k']
    for ln in lines(f['geometry']):
        if not any(inb(q, R) for q in ln): continue
        pts = [r4(q) for q in ln]
        if len(pts) < 2: continue
        feats.append({'k': k, 'n': p.get('n', ''), 't': p.get('t', ''), 'a': p.get('a'), 'poly': f['geometry']['type'].endswith('Polygon'), 'p': pts})

# --- Fremont street grid (real, NE GIS) + regional arterials
s = json.load(open(D + 'streets.json')); OX, OY = s['o']; S = s['s']
def dec(e):
    x, y = e[0], e[1]; pts = [(x, y)]
    for i in range(2, len(e), 2): x += e[i]; y += e[i + 1]; pts.append((x, y))
    return [[round(OX + a / S, 5), round(OY + b / S, 5)] for a, b in pts]
FB = (-96.56, 41.41, -96.43, 41.475)
fremont, arts = [], []
for c in range(4):
    for e in s['t'][c]:
        p = dec(e)
        if any(inb(q, FB) for q in p): fremont.append({'c': c, 'p': p})
        elif c <= 1 and any(inb(q, R) for q in p): arts.append({'c': c, 'p': [r4(q) for q in p[::2] + [p[-1]]]})

# --- Columbus street grid (real, NE GIS, fetched 2026-09-29)
HW = {'Interstate', 'Freeway', 'Expressway', 'Ramp'}
ART = {'Federal', 'Primary', 'Major Arterial', 'Minor Arterial', 'Other Arterial', 'SECONDARY'}
COL = {'Collector', 'Major Collector', 'Minor Collector'}
cls = lambda c: 0 if c in HW else 1 if c in ART else 2 if c in COL else 3
columbus = []
for f in json.load(open(OUT + '_columbus_raw.json')):
    a = f['attributes']
    for p in f['geometry'].get('paths', []):
        columbus.append({'c': cls(a.get('ST_CLASS')), 'n': a.get('FULL_ST_NM') or '', 'p': [r5(q) for q in p]})

# --- storms (real public reports) + areas
storms = []
for k, v in list(real['STORMS'].items()) + list(night['map']['storms'].items()):
    storms.append({'id': k, 'date': v['date'], 'days': v['days'], 'time': v.get('time'), 'd': v['d'], 'long': v['long'],
                   'max': v['max'], 'path': v['path']})
storms.sort(key=lambda x: x['date'], reverse=True)
areas = []
for a in real['AREAS'] + night['map']['areas']:
    if not inb(a['c'], R): continue
    areas.append({k: a.get(k) for k in ('id', 'st', 'name', 'sub', 'c', 'hail', 'homes', 'owner', 'roof', 'rank', 'score', 'town', 'county')} |
                 {'insured': (a.get('insured') or {}).get('label'), 'ring': [r4(q) for q in a['ring']]})

# --- zones (engine's ranked list) with map points
col = night['map']['areas'][0]['c']
rnd = random.Random(808)
cent = {z['zone_id']: [z['center']['lon'], z['center']['lat']] for z in night['top']}
zones = []
for z in night['zones']:
    c = cent.get(z['id'])
    if not c:
        ang = rnd.random() * 6.283; rr = 0.006 + rnd.random() * 0.028
        c = [round(col[0] + math.cos(ang) * rr * 1.3, 5), round(col[1] + math.sin(ang) * rr, 5)]
    zones.append(z | {'c': c})
omaha = night['backup']

# --- the pick's real walk + FAKE sample homes along it (no owner names)
walk = night['map']['zwalks'][night['pick']['zone_id']]
def interp(p, t):
    L = [math.dist(p[i], p[i + 1]) for i in range(len(p) - 1)]; T = sum(L) * t
    for i, l in enumerate(L):
        if T <= l or i == len(L) - 1:
            f = T / l if l else 0; return [round(p[i][0] + (p[i + 1][0] - p[i][0]) * f, 6), round(p[i][1] + (p[i + 1][1] - p[i][1]) * f, 6)]
        T -= l
homes = []; rnd = random.Random(2026)
NUM = {'22 St': 3902, '21 St': 3903, '40 Ave': 2108}
for st in walk['s']:
    n0 = NUM.get(st['n'], 3900)
    for i in range(st['h']):
        t = (i + .5) / st['h']; side = 1 if i % 2 else -1
        q = interp(st['p'], t)
        dx, dy = st['p'][-1][0] - st['p'][0][0], st['p'][-1][1] - st['p'][0][1]; L = math.hypot(dx, dy) or 1
        q = [round(q[0] - dy / L * 0.00013 * side, 6), round(q[1] + dx / L * 0.00013 * side, 6)]
        built = rnd.choice([1958, 1962, 1965, 1968, 1971, 1974, 1976, 1978, 1981, 1984, 1993, 2001])
        roof = rnd.choice([11, 13, 14, 16, 17, 19, 21, 22, 24])
        own = rnd.random() < .78
        hail = round(1.45 + rnd.random() * .25, 2)
        score = round(55 + (hail - 1.45) * 60 + (roof - 11) * .9 + (8 if own else -6) + rnd.random() * 6)
        homes.append({'addr': f"{n0 + (i // 2) * 8 + (0 if side < 0 else 1) * 1} {st['n']}", 'st': st['n'], 'p': q,
                      'built': built, 'roof': roof, 'own': own, 'hail': hail, 'score': min(score, 96)})
homes.sort(key=lambda h: -h['score'])
for i, h in enumerate(homes): h['rank'] = i + 1

DATA = {
  'v': 1, 'today': '2026-09-29', 'as_of': night['made_at'],
  'src': {'streets': 'Nebraska GIS Street_Centerlines (gis.ne.gov)', 'base': base['src'],
          'storms': 'NOAA SPC storm reports + MRMS radar hail estimates (engine, hh.py)', 'census': 'US Census ACS ' + real['census'],
          'homes': 'SAMPLE homes (fake) until knocking starts. No owner names.'},
  'headline': night['headline'], 'pick': night['pick'], 'backup': night['backup'], 'zones': zones,
  'storms': storms, 'areas': areas, 'base': feats, 'arts': arts, 'fremont': fremont, 'columbus': columbus,
  'walk': walk, 'homes': homes,
  'places': {'Fremont': [-96.498, 41.433], 'Columbus': [-97.368, 41.43], 'Omaha': [-95.99, 41.26], 'Blair': [-96.134, 41.544],
             'Schuyler': [-97.059, 41.447], 'Wahoo': [-96.62, 41.211], 'Lincoln': [-96.70, 40.84], 'North Bend': [-96.779, 41.462], 'Valley': [-96.346, 41.313]},
  'hq': [-96.4867, 41.4403],
}
open(OUT + 'data.js', 'w').write('/* Next-level mockups: shared REAL data (see build.py). Homes are FAKE samples. */\nwindow.NL=' + json.dumps(DATA, separators=(',', ':'), ensure_ascii=False) + ';\n')
import os; print('data.js', os.path.getsize(OUT + 'data.js'), len(feats), len(fremont), len(arts), len(columbus), len(storms), len(areas), len(zones), len(homes))
