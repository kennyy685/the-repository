"""Turn the engine's real 2026 season (data/storms-2026.json) into the open map's data (data/real.js).

The page was built on a sample model (STORMS, AREAS, DAILY, TOWN_OF, MORT). This writes the same shapes from real
public data, so the page swaps in one line: `const STORMS = REAL ? REAL.STORMS : {...sample}`.
  STORMS  one per storm day with a zone inside the map; path = that day's ground reports in time order
          (radar-only days: a short line through the biggest zone, `deco:1`, drawn faint).
  AREAS   the zones whose centre sits inside the basemap box (DATA_BBOX). ring = the engine's outline
          (ground zones) or a circle of radius_km (radar zones). No roof age or permit data exists:
          roof = typical home age (Census median year built), permits = null ("not checked yet").
  DAILY   biggest hail each day inside the map, Mar 1 -> today.
Also writes build/real_areas.json (id, centre, ring, band) for areas.py (best streets + walks).
Zones the engine has no Census block groups for (small villages) get homes from 2020 Census blocks inside the ring
(blocks.json from blocks.py; pass its folder as BLOCKS=...); their owner/mortgage/home-age stay null ("no data").
Run from this folder:  BLOCKS=<folder with blocks.json> python3 real.py   (reads ../../../../../data/storms-2026.json)"""
import json, math, os, collections, datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '..', '..', '..', '..', 'data', 'storms-2026.json')
BBOX = (-96.95, 40.72, -95.80, 41.70)  # same as the page's DATA_BBOX (basemap, streets, homes)
SEASON_START = '2026-03-01'
KX, KY = 111.32 * math.cos(41.2 * math.pi / 180), 110.57
MON = {'en': 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(), 'es': 'ene feb mar abr may jun jul ago sep oct nov dic'.split()}
DOW = {'en': 'Monday Tuesday Wednesday Thursday Friday Saturday Sunday'.split(),
       'es': 'lunes martes miércoles jueves viernes sábado domingo'.split()}
SIZE = [(2.75, 'baseball', 'pelota de béisbol'), (2.5, 'tennis ball', 'pelota de tenis'), (2.0, 'hen egg', 'huevo'),
        (1.75, 'golf ball', 'pelota de golf'), (1.5, 'ping pong ball', 'pelota de ping pong'), (1.25, 'half dollar', 'moneda de medio dólar'),
        (1.0, 'quarter', 'moneda de 25 centavos'), (0, 'penny', 'centavo')]


def inside(lon, lat): return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]
def km(a, b): return math.hypot((a[0] - b[0]) * KX, (a[1] - b[1]) * KY)
def fin(x): return ('%.2f' % x).rstrip('0').rstrip('.') if x % 1 else '%.1f' % x


def circle(c, r_km, n=48):
    return [[round(c[0] + r_km / KX * math.cos(2 * math.pi * i / n), 5), round(c[1] + r_km / KY * math.sin(2 * math.pi * i / n), 5)]
            for i in range(n)] + [[round(c[0] + r_km / KX, 5), round(c[1], 5)]]


def inring(p, ring):
    ins = False; j = len(ring) - 1
    for i in range(len(ring)):
        (xi, yi), (xj, yj) = ring[i], ring[j]
        if (yi > p[1]) != (yj > p[1]) and p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi: ins = not ins
        j = i
    return ins


def band(h): return 2 if h >= 2 else 1.5 if h >= 1.5 else 1


def zid(z):  # "2026-04-23~malcolm" -> "z0423-malcolm" (safe in HTML attributes and CSS selectors)
    d, slug = z['id'].split('~')
    return 'z' + d[5:7] + d[8:10] + '-' + slug


def main():
    D = json.load(open(SRC))
    today = D['today']
    reps = {r['id']: r for r in D['reports']}
    zones = [z for z in D['zones'] if inside(z['center']['lon'], z['center']['lat'])]
    zones.sort(key=lambda z: z.get('rank', 999))

    bpath = os.path.join(os.environ.get('BLOCKS', HERE), 'blocks.json')
    blocks = json.load(open(bpath)) if os.path.exists(bpath) else None
    areas, raw, kept = [], [], []
    for z in zones:
        c = [z['center']['lon'], z['center']['lat']]
        ring = z.get('outline') or circle(c, z['radius_km'])
        zr = [reps[i] for i in z['report_ids'] if i in reps]
        cnt = collections.Counter(r['county'] for r in zr if r.get('county'))
        if not cnt:  # radar zone: county of the nearest real report of the season
            near = min(D['reports'], key=lambda r: km(c, (r['lon'], r['lat'])))
            cnt = collections.Counter([near['county']]) if km(c, (near['lon'], near['lat'])) < 25 else cnt
        rep = []
        for r in sorted(zr, key=lambda r: -r['size_in'])[:4]:
            s = r['sources']; src = 'nws' if 'lsr' in s else 'spc' if 'spc' in s else 'ncei'
            by = r.get('by') or ''
            rep.append([src, {'en': f"<b>{fin(r['size_in'])} in</b>, {r['location']}" + (f", {by.lower()}" if by else ''),
                              'es': f"<b>{fin(r['size_in'])} pulg.</b>, {r['location']}" + (f", {by.lower()}" if by else '')},
                        r['time_local']])
        if 'mrms' in z['sources'] or 'radar' in z['sources']:
            m = z.get('mesh_in') or z.get('radar_max_in')
            if m:
                rep.append(['mrms', {'en': f"<b>{fin(m)} in</b> biggest radar estimate (MESH)",
                                     'es': f"<b>{fin(m)} pulg.</b> estimado de radar más grande (MESH)"}, None])
        sig = dict(z['signals'])
        if sig.get('homes') is None:
            if not blocks: continue
            sig['homes'] = sum(b[2] for b in blocks if b[2] < 40 and inring(b, ring))
            sig['basis'] = 'blocks'
            if sig['homes'] < 20: continue  # fields, not a neighborhood
        nz = lambda k, f=lambda x: x: None if sig.get(k) is None else f(sig[k])
        towns = [t for t in z.get('towns') or [] if t != z['name']]
        if z.get('nearest_town'):
            sub = {'en': f"{z['nearest_km']:.0f} km from {z['nearest_town']}", 'es': f"A {z['nearest_km']:.0f} km de {z['nearest_town']}"}
        elif towns:
            sub = {'en': 'Also ' + ', '.join(towns[:3]), 'es': 'También ' + ', '.join(towns[:3])}
        else:
            sub = {'en': f"{sig['homes']:,} homes (Census)", 'es': f"{sig['homes']:,} casas (Censo)"}
        radar = z['hail_basis'] == 'radar'
        a = {'id': zid(z), 'st': 'd' + z['date'].replace('-', ''), 'name': {'en': z['name'], 'es': z['name_es']}, 'sub': sub,
             'c': [round(c[0], 5), round(c[1], 5)], 'ring': ring, 'hail': z['hail_in'], 'radar': 1 if radar else 0,
             'homes': sig['homes'], 'hb': 1 if sig.get('basis') else 0, 'roof': nz('median_year_built', lambda y: max(1, 2026 - y)),
             'old': sig['built_before_2000_share'], 'owner': nz('owner_share', lambda x: round(x * 100)), 'permits': None, 'conf': z['agree_pct'],
             'county': cnt.most_common(1)[0][0] if cnt else None, 'town': z.get('near_town') or z.get('nearest_town') or z['name'],
             'mort': None if sig.get('mortgage_share') is None else
                     [round(sig['mortgage_share'] * 100, 1), round(sig['owner_homes'] * sig['mortgage_share']), sig['owner_homes']],
             'insured': sig['likely_insured'], 'rank': z.get('rank'), 'score': z['score'], 'rep': rep, 'why': z['why']}
        areas.append(a); kept.append(z)
        raw.append({'id': a['id'], 'c': a['c'], 'ring': ring, 'band': band(a['hail'])})

    zones = kept; outside = len(D['zones']) - len(zones)
    storms = {}
    for day in sorted({z['date'] for z in zones}, reverse=True):
        k = 'd' + day.replace('-', '')
        dz = [z for z in zones if z['date'] == day]
        rs = sorted({i for z in dz for i in z['report_ids']}, key=lambda i: reps[i]['utc'] if i in reps else '')
        pts = [[reps[i]['lon'], reps[i]['lat']] for i in rs if i in reps]
        deco = 0
        # a track is only drawn between reports that could be one storm (< 60 km apart, in time order)
        path = [p for j, p in enumerate(pts) if j == 0 or km(p, pts[j - 1]) < 60]
        if len(path) < 2:  # radar-only day: short SW->NE stroke through the biggest zone (decorative)
            big = max(dz, key=lambda z: z['hail_in']); c = (big['center']['lon'], big['center']['lat'])
            path = [[c[0] - 6 / KX, c[1] - 4 / KY], [c[0], c[1]], [c[0] + 6 / KX, c[1] + 4 / KY]]; deco = 1
        times = [t for z in dz for t in (z.get('time_local') or [])]
        def mins(s):
            h, m = s.split(' ')[0].split(':'); return (int(h) % 12 + (12 if s.endswith('PM') else 0)) * 60 + int(m)
        times.sort(key=mins)
        d = dt.date.fromisoformat(day)
        storms[k] = {'date': day, 'days': (dt.date.fromisoformat(today) - d).days,
                     'time': (times[0] + ('–' + times[-1] if times[-1] != times[0] else '')) if times else None,
                     'd': {'en': f"{MON['en'][d.month - 1]} {d.day}", 'es': f"{d.day} {MON['es'][d.month - 1]}"},
                     'long': {'en': f"{DOW['en'][d.weekday()]}, {MON['en'][d.month - 1]} {d.day}, {d.year}",
                              'es': f"{DOW['es'][d.weekday()]} {d.day} de {MON['es'][d.month - 1]}. de {d.year}"},
                     'path': [[round(x, 4), round(y, 4)] for x, y in path], 'deco': deco, 'max': max(z['hail_in'] for z in dz)}

    t0, t1 = dt.date.fromisoformat(SEASON_START), dt.date.fromisoformat(today)
    n = (t1 - t0).days + 1
    daily = []
    for i in range(n):
        day = (t0 + dt.timedelta(days=i)).isoformat(); k = 'd' + day.replace('-', '')
        e = {'d': n - 1 - i, 'v': storms[k]['max'] if k in storms else 0}
        if k in storms: e['storm'] = k
        daily.append(e)

    town_of = {a['id']: a['town'].lower().replace(' ', '-') for a in areas}
    towns = {v: next(a['town'] for a in areas if town_of[a['id']] == v) for v in set(town_of.values())}
    out = {'v': 1, 'today': today, 'as_of': D['as_of'], 'note': D['note'], 'census': D['census_vintage'],
           'outside': outside, 'total': len(D['zones']), 'STORMS': storms, 'AREAS': areas, 'DAILY': daily,
           'TOWN_OF': town_of, 'TOWNS': towns}
    js = '/* REAL public data for the open map. Built by data/build/real.py from data/storms-2026.json. Do not edit. */\n'
    js += 'window.REAL=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
    dst = os.path.join(HERE, '..', 'real.js')
    open(dst, 'w').write(js)
    json.dump(raw, open(os.path.join(HERE, 'real_areas.json'), 'w'), separators=(',', ':'))
    print(f"real.js {os.path.getsize(dst):,} bytes: {len(areas)} zones on the map, {outside} outside, {len(storms)} storm days, {n} days")
    for a in areas[:8]: print(' ', a['id'], a['hail'], a['homes'], a['county'], a['conf'], len(a['rep']))


if __name__ == '__main__':
    main()
