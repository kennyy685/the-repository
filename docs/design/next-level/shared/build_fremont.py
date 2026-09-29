"""Builds shared/data-fremont.js: the next-level mockups' pick moved home to Fremont (FilthE, 2026-09-29: "we're a
local Fremont company"). Load it AFTER data.js; it reassigns NL.pick, NL.homes, NL.walk, NL.columbus (+ NL.streets,
NL.city), NL.headline and NL.hq in the exact shapes build.py writes for Columbus, so pages work unchanged.

Everything real except the homes:
- zone = the Fremont storm area with the engine's best area score (open-map real.js AREAS, hh.py / openmap.py);
- hail, storm day, reports, Census numbers (owner share, median year built, built-before-2000 share) = that area's;
- streets + house-number ranges = Nebraska GIS Street_Centerlines (gis.ne.gov), cached in _fremont_raw.json;
- walk order, walk lines, best time and door scores = the engine's own code (todaywalk.walking_order,
  basemap.build + mapwalk.page_walk, todaywalk.best_time, doorscore.score);
- HMP = 2600 N Laverna St, placed from the county's address range on that block.
Homes are FAKE samples (house numbers inside the real block ranges, no owner names, ever); their hail stays between
the zone's 1.0-in ground report and the radar estimate, their ages/owner flags follow the zone's Census numbers.

Run from repo root: python3 docs/design/next-level/shared/build_fremont.py [--fetch]   (--fetch re-pulls streets)
Check: node docs/design/next-level/shared/check_fremont.js"""
import json, math, os, random, sys
sys.path.insert(0, os.getcwd())
from datetime import date
from hailhunter import basemap, doorscore, mapwalk, night, todaywalk as tw
from hailhunter.geo import haversine_mi

D = 'docs/design/open-map/data/'
OUT = 'docs/design/next-level/shared/'
RAW = OUT + '_fremont_raw.json'
TODAY = '2026-09-29'
FIELDS = basemap.STREET_FIELDS + ',FULL_ST_NM,ADDR_LF,ADDR_LT,ADDR_RF,ADDR_RT'
NEAR_M = 900                                  # NL.columbus/streets: named streets within this of the walk


def js(path):
    t = open(path).read(); return json.loads(t[t.index('{'):t.rindex('}') + 1])


real = js(D + 'real.js')

# --- 1. the zone: Fremont's storm area with the engine's best score (real.js AREAS = the engine's open-map areas)
cands = sorted([a for a in real['AREAS'] if a.get('town') == 'Fremont'], key=lambda a: (-a['score'], a['id']))
area = cands[0]
storm = real['STORMS'][area['st']]
print('candidates:', ', '.join(f"{a['id']} score {a['score']} hail {a['hail']}{' radar-only' if a['radar'] else ''} "
                               f"({a['county']})" for a in cands))
print('chosen:', area['id'])
ground = [r for r in area['rep'] if r[0] == 'nws' and r[3]]
inch = lambda r: float(r[1]['en'].split('<b>')[1].split(' ')[0])   # noqa: E731  "<b>1.0 in</b>, ..." -> 1.0
report = max(ground, key=inch)                                     # the biggest ground report: the walk sits on it
REPORT_IN = inch(report)
RADAR_MAX = next((inch(r) for r in area['rep'] if r[0] == 'mrms'), area['hail'])
MED_BUILT = 2026 - area['roof']               # openmap.py: roof = 2026 - median year built (Census)

# --- 2. real streets around the report point (gis.ne.gov), cached so the build runs offline
c0 = report[3]
kx, ky = basemap._proj(c0[1])
box = [round(c0[0] - 1400 / kx, 4), round(c0[1] - 1400 / ky, 4), round(c0[0] + 2000 / kx, 4), round(c0[1] + 2000 / ky, 4)]  # NE: HMP
if '--fetch' in sys.argv or not os.path.exists(RAW):
    import requests
    feats = basemap.fetch_layer(requests.Session(), basemap.STREETS_URL, box, FIELDS)
    json.dump([{'attributes': {k: f['attributes'].get(k) for k in FIELDS.split(',')},
                'geometry': {'paths': [[[round(x, 6), round(y, 6)] for x, y, *_ in p] for p in f['geometry']['paths']]}}
               for f in feats], open(RAW, 'w'), separators=(',', ':'))
feats = json.load(open(RAW))

# HMP's office: 2600 N Laverna St, from the county's address range on its block
hq = None
for f in feats:
    a = f['attributes']
    if (a['ST_NAME'] or '').upper() == 'LAVERNA' and a['ADDR_RF'] is not None and a['ADDR_RF'] <= 2600 <= a['ADDR_RT']:
        p = f['geometry']['paths'][0]; t = (2600 - a['ADDR_RF']) / ((a['ADDR_RT'] + 2) - a['ADDR_RF'])
        hq = [round(p[0][0] + (p[-1][0] - p[0][0]) * t, 5), round(p[0][1] + (p[-1][1] - p[0][1]) * t, 5)]
assert hq, '2600 N Laverna St not in the street data (widen the box or --fetch)'

# --- 3. the walk's blocks: the residential grid at the report point. (street, block's low number, doors)
BLOCKS = [('East 12TH Street', 500, 4), ('East 12TH Street', 600, 4), ('East 12TH Street', 700, 4),
          ('East LINDEN Avenue', 700, 4), ('East LINDEN Avenue', 600, 3), ('East LINDEN Avenue', 500, 3),
          ('North CLARKSON Street', 1200, 3)]


def block(name, lo):
    for f in feats:
        a = f['attributes']
        if a.get('FULL_ST_NM') == name and min(a['ADDR_LF'] or 0, a['ADDR_RF'] or 0) == lo:
            return a, f['geometry']['paths'][0]
    raise SystemExit(f'block {lo} {name} not found')


def at(path, t):
    L = [math.dist(path[i], path[i + 1]) for i in range(len(path) - 1)]; T = sum(L) * t
    for i, l in enumerate(L):
        if T <= l or i == len(L) - 1:
            f = T / l if l else 0
            return path[i][0] + (path[i + 1][0] - path[i][0]) * f, path[i][1] + (path[i + 1][1] - path[i][1]) * f, i
        T -= l


rnd = random.Random(701)
stops = []
for name, lo, n in BLOCKS:
    a, path = block(name, lo)
    short = basemap.street_name(a)
    sides = [('L', a['ADDR_LF'], a['ADDR_LT'], 1), ('R', a['ADDR_RF'], a['ADDR_RT'], -1)]
    for i in range(n):
        side, f0, f1, sgn = sides[i % 2]
        k = i // 2; per = (n + 1 - i % 2) // 2               # houses on this side of the block
        num = f0 + 2 * round(((f1 - f0) / 2) * (k + .5) / per * .92 + rnd.randint(0, 1))  # keeps the side's parity
        num = min(max(num, f0 + 2), f1 - 2)
        t = (num - f0) / ((f1 + 2) - f0)
        x, y, j = at(path, t)
        dx, dy = (path[j + 1][0] - path[j][0]) * kx, (path[j + 1][1] - path[j][1]) * ky; L = math.hypot(dx, dy) or 1
        off = 16 + rnd.random() * 5                          # front door ~16-21 m off the centerline
        x, y = x - dy / L * off * sgn / kx, y + dx / L * off * sgn / ky   # sgn 1 = left of the digitized direction
        stops.append({'address': f'{num} {short}', 'st': short, 'lat': round(y, 6), 'lon': round(x, 6)})
stops = tw.walking_order(stops)

# --- 4. sample facts from the zone's Census numbers (fake per house, honest in aggregate) + engine door score
n = len(stops)
own_n = round(n * area['owner'] / 100)                     # owner share (Census)
new_n = round(n * (1 - area['old']))                       # built 2000 or later (Census built_before_2000_share)
owners = [True] * own_n + [False] * (n - own_n); rnd.shuffle(owners)
olds = sorted(rnd.choice(range(1905, 1996)) for _ in range(n - new_n))
mid = MED_BUILT - olds[len(olds) // 2]                     # centre the old homes on the Census median year built
builts = [min(1999, max(1895, y + mid)) for y in olds] + [rnd.choice([2002, 2006, 2011, 2016])
                                                           for _ in range(new_n)]
rnd.shuffle(builts)
homes = []
for s, own, built in zip(stops, owners, builts):
    roof_year = max(built, rnd.choice([2002, 2005, 2007, 2009, 2010, 2012, 2014, 2016]))   # older homes are re-roofed
    hail = round(REPORT_IN + rnd.random() * min(.25, RADAR_MAX - REPORT_IN), 2)
    ds = doorscore.score({'hail': hail, 'built': built, 'roof_year': roof_year, 'owner_occ': own,
                          'stack_count': (area.get('stack') or {}).get('n')}, 'storm', None, area['st'][1:5] + '-' +
                         area['st'][5:7] + '-' + area['st'][7:9], TODAY)
    homes.append({'addr': s['address'], 'st': s['st'], 'p': [s['lon'], s['lat']], 'built': built,
                  'roof': 2026 - roof_year, 'own': own, 'hail': hail, 'score': ds['score']})
order = {h['addr']: i for i, h in enumerate(homes)}
ranked = sorted(homes, key=lambda h: (-h['score'], order[h['addr']]))
for i, h in enumerate(ranked):
    h['rank'] = i + 1

# --- 5. the walk lines: the engine's own map walk (basemap.build + mapwalk.page_walk)
bm = basemap.build(feats, [], basemap.walk_bbox(stops), None, basemap.street_bbox(stops))
day = storm['date']
zone_id = f'{day}_Fremont~t1'
walk = mapwalk.page_walk({'zone_id': zone_id, 'stops': stops, 'basemap': bm}, area['hail'])
assert walk and sum(s['h'] for s in walk['s']) == n, walk

# --- 6. streets near the walk (build.py's Columbus shape {c, n, p})
HW = {'Interstate', 'Freeway', 'Expressway', 'Ramp'}
ART = {'Federal', 'Primary', 'Major Arterial', 'Minor Arterial', 'Other Arterial', 'SECONDARY'}
COL = {'Collector', 'Major Collector', 'Minor Collector'}
cls = lambda c: 0 if c in HW else 1 if c in ART else 2 if c in COL else 3   # noqa: E731
wpts = [q for s in walk['s'] for q in s['p']]
near = lambda q: min(math.hypot((q[0] - w[0]) * kx, (q[1] - w[1]) * ky) for w in wpts) <= NEAR_M   # noqa: E731
streets = []
for f in feats:
    a = f['attributes']
    if not a.get('FULL_ST_NM'):
        continue
    for p in f['geometry']['paths']:
        if any(near(q) for q in p):
            streets.append({'c': cls(a.get('ST_CLASS')), 'n': a['FULL_ST_NM'], 'p': [[round(x, 5), round(y, 5)] for x, y in p]})

# --- 7. the pick card (night._plan_card's shape) + headline
names = []
for s in walk['s']:
    if s['n'] not in names:
        names.append(s['n'])
zname = 'Fremont: ' + ' & '.join(names[:2])
dist = round(haversine_mi(hq[1], hq[0], walk['park'][1], walk['park'][0]), 1)
walk_c = {'lat': round(sum(s['lat'] for s in stops) / n, 3), 'lon': round(sum(s['lon'] for s in stops) / n, 3)}
m_en, m_es = date.fromisoformat(day).strftime('%B') + f' {int(day[8:])}', f"{int(day[8:])} de " + \
    ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre',
     'diciembre'][int(day[5:7]) - 1]
hail_s = f"{area['hail']:g}"
zone = {'id': zone_id, 'name': zname, 'kind': 'storm', 'score': area['score'], 'hail_in': area['hail'],
        'storm_day': day, 'dist_mi': dist, 'walk_center': walk_c, 'area_id': area['id'],
        'why': {'en': f"{hail_s}-inch hail hit here on {m_en} ({len(ground)} ground reports, radar up to "
                      f"{RADAR_MAX:g} in), {round(area['old'] * 100)}% of homes were built before 2000 and most are "
                      f"owner-lived.",
                'es': f"Aquí cayó granizo de {hail_s} pulgada el {m_es} ({len(ground)} reportes en tierra, el radar "
                      f"marca hasta {RADAR_MAX:g} pulg.), el {round(area['old'] * 100)}% de las casas se construyó antes "
                      f"del 2000 y en la mayoría viven sus dueños."}}
pick = night._plan_card(zone, {'stops': stops, 'best_time': tw.best_time(TODAY)})
pick['start'] = {'address': walk['pn'][0], 'lat': round(walk['park'][1], 3), 'lon': round(walk['park'][0], 3)}
pick['plan'] = night._plan(zname, pick['start']['address'], n)
where = ' & '.join(names[:2])
headline = {'en': f"No new hail since last night; best zone is right here in Fremont: {where}.",
            'es': f"Sin granizo nuevo desde anoche; la mejor zona está aquí mismo en Fremont: {where.replace(' & ', ' y ')}."}

DATA = {'city': 'Fremont', 'pick': pick, 'homes': ranked, 'walk': walk, 'columbus': streets, 'headline': headline,
        'hq': hq}
src = ('/* Next-level mockups: the pick moved home to Fremont (build_fremont.py). Load AFTER data.js.\n'
       f" Zone {area['id']}: engine's best Fremont area (score {area['score']}), real {day} hail + Census numbers;\n"
       ' streets: Nebraska GIS Street_Centerlines. Homes are FAKE samples: no owner names. */\n'
       '(function (N) {\n  var F = ' + json.dumps(DATA, separators=(',', ':'), ensure_ascii=False) + ';\n'
       '  N.city = F.city; N.pick = F.pick; N.homes = F.homes; N.walk = F.walk; N.columbus = F.columbus;\n'
       '  N.streets = F.columbus; N.headline = F.headline; N.hq = F.hq;\n'
       '  if (N.src) N.src.homes = "SAMPLE homes (fake) on real Fremont blocks until knocking starts. No owner names.";\n'
       '})(window.NL = window.NL || {});\n')
open(OUT + 'data-fremont.js', 'w').write(src)
print('data-fremont.js', len(src), 'bytes;', n, 'homes;', len(walk['s']), 'street runs:',
      ', '.join(f"{s['n']} ({s['h']})" for s in walk['s']), '; start', pick['start']['address'], '; hq', hq, dist, 'mi;',
      len(streets), 'streets')
