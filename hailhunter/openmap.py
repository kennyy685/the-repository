"""The open map's area + storm shapes for zones the brief names but data/real.js doesn't hold (King, 2026-09-29).

data/real.js (docs/design/open-map/data/build/real.py) only holds the season zones inside the basemap box, so a pick
west of it (Columbus) had no area to tap. The night shift adds those zones to its brief (`map`: {areas, storms}) in
exactly real.js's AREAS / STORMS shapes; the page merges them in (ids already in real.js win). This is a twin of
real.py's per-zone code: tests/test_night.py checks it builds the same entries real.js holds."""
import collections
import datetime as dt
import math
import re

from .season import age_line, days_ago

AGE_EN = re.compile(r'^\d+ days ago\.')

KX, KY = 111.32 * math.cos(41.2 * math.pi / 180), 110.57
MON = {'en': 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(), 'es': 'ene feb mar abr may jun jul ago sep oct nov dic'.split()}
DOW = {'en': 'Monday Tuesday Wednesday Thursday Friday Saturday Sunday'.split(),
       'es': 'lunes martes miércoles jueves viernes sábado domingo'.split()}


def km(a, b):
    return math.hypot((a[0] - b[0]) * KX, (a[1] - b[1]) * KY)


def fin(x):
    return ('%.2f' % x).rstrip('0').rstrip('.') if x % 1 else '%.1f' % x


def circle(c, r_km, n=48):
    return [[round(c[0] + r_km / KX * math.cos(2 * math.pi * i / n), 5), round(c[1] + r_km / KY * math.sin(2 * math.pi * i / n), 5)]
            for i in range(n)] + [[round(c[0] + r_km / KX, 5), round(c[1], 5)]]


def zid(z):
    """"2026-04-23~malcolm" -> "z0423-malcolm" (the page's area id)."""
    d, slug = z['id'].split('~')
    return 'z' + d[5:7] + d[8:10] + '-' + slug


def _why(z, today):
    """z's why lines with the age line re-dated to `today` (the season file may be a day older than the brief). A storm
    dated after `today` keeps the season file's own line (twin of the page's ageWhy)."""
    if not today:
        return z['why']
    n = days_ago(z['date'], today)
    return [age_line(n) if n >= 0 and isinstance(w, list) and len(w) > 1 and AGE_EN.match(str((w[1] or {}).get('en', '')))
            else w for w in z['why']]


def area(z, season, today=None):
    """One real.js AREAS entry for season zone z, or None (no Census homes: real.py needs block files for those).
    `today` (the brief's date) re-dates the "N days ago" line; None keeps the season file's own."""
    reps = {r['id']: r for r in season.get('reports') or []}
    c = [z['center']['lon'], z['center']['lat']]
    ring = z.get('outline') or circle(c, z['radius_km'])
    zr = [reps[i] for i in z.get('report_ids') or [] if i in reps]
    cnt = collections.Counter(r['county'] for r in zr if r.get('county'))
    if not cnt and season.get('reports'):  # radar zone: county of the nearest real report of the season
        near = min(season['reports'], key=lambda r: km(c, (r['lon'], r['lat'])))
        cnt = collections.Counter([near['county']]) if km(c, (near['lon'], near['lat'])) < 25 else cnt
    rep = []
    for r in sorted(zr, key=lambda r: -r['size_in'])[:4]:
        s = r['sources']; src = 'nws' if 'lsr' in s else 'spc' if 'spc' in s else 'ncei'
        by = r.get('by') or ''
        rep.append([src, {'en': f"<b>{fin(r['size_in'])} in</b>, {r['location']}" + (f", {by.lower()}" if by else ''),
                          'es': f"<b>{fin(r['size_in'])} pulg.</b>, {r['location']}" + (f", {by.lower()}" if by else '')},
                    r['time_local'], [r['lon'], r['lat']]])
    if 'mrms' in z['sources'] or 'radar' in z['sources']:
        m = z.get('mesh_in') or z.get('radar_max_in')
        if m:
            rep.append(['mrms', {'en': f"<b>{fin(m)} in</b> biggest radar estimate (MESH)",
                                 'es': f"<b>{fin(m)} pulg.</b> estimado de radar más grande (MESH)"}, None])
    sig = dict(z['signals'])
    if sig.get('homes') is None:
        return None
    nz = lambda k, f=lambda x: x: None if sig.get(k) is None else f(sig[k])  # noqa: E731
    towns = [t for t in z.get('towns') or [] if t != z['name']]
    if z.get('nearest_town'):
        sub = {'en': f"{z['nearest_km']:.0f} km from {z['nearest_town']}", 'es': f"A {z['nearest_km']:.0f} km de {z['nearest_town']}"}
    elif towns:
        sub = {'en': 'Also ' + ', '.join(towns[:3]), 'es': 'También ' + ', '.join(towns[:3])}
    else:
        sub = {'en': f"{sig['homes']:,} homes (Census)", 'es': f"{sig['homes']:,} casas (Censo)"}
    return {'id': zid(z), 'st': 'd' + z['date'].replace('-', ''), 'name': {'en': z['name'], 'es': z['name_es']}, 'sub': sub,
            'c': [round(c[0], 5), round(c[1], 5)], 'ring': ring, 'hail': z['hail_in'], 'radar': 1 if z['hail_basis'] == 'radar' else 0,
            'homes': sig['homes'], 'hb': 1 if sig.get('basis') else 0, 'roof': nz('median_year_built', lambda y: max(1, 2026 - y)),
            'old': sig['built_before_2000_share'], 'owner': nz('owner_share', lambda x: round(x * 100)), 'permits': None, 'conf': z['agree_pct'],
            'county': cnt.most_common(1)[0][0] if cnt else None, 'town': z.get('near_town') or z.get('nearest_town') or z['name'],
            'mort': None if sig.get('mortgage_share') is None else
                    [round(sig['mortgage_share'] * 100, 1), round(sig['owner_homes'] * sig['mortgage_share']), sig['owner_homes']],
            'insured': sig['likely_insured'], 'rank': z.get('rank'), 'score': z['score'], 'rep': rep, 'why': _why(z, today),
            'stack': {'n': z['stack']['count'], 'since': z['stack']['since'], 'days': z['stack']['days'], 'km': z['stack']['km']}
                     if z.get('stack') else None}


def storm(day, zones, season):
    """One real.js STORMS entry for a storm day, drawn from `zones` (that day's zones)."""
    reps = {r['id']: r for r in season.get('reports') or []}
    dz = [z for z in zones if z['date'] == day]
    rs = sorted({i for z in dz for i in z.get('report_ids') or []}, key=lambda i: reps[i]['utc'] if i in reps else '')
    pts = [[reps[i]['lon'], reps[i]['lat']] for i in rs if i in reps]
    deco = 0
    path = [p for j, p in enumerate(pts) if j == 0 or km(p, pts[j - 1]) < 60]
    if len(path) < 2:  # radar-only day: short SW->NE stroke through the biggest zone (decorative)
        big = max(dz, key=lambda z: z['hail_in']); c = (big['center']['lon'], big['center']['lat'])
        path = [[c[0] - 6 / KX, c[1] - 4 / KY], [c[0], c[1]], [c[0] + 6 / KX, c[1] + 4 / KY]]; deco = 1
    times = [t for z in dz for t in (z.get('time_local') or [])]

    def mins(s):
        h, m = s.split(' ')[0].split(':'); return (int(h) % 12 + (12 if s.endswith('PM') else 0)) * 60 + int(m)
    times.sort(key=mins)
    d = dt.date.fromisoformat(day)
    return {'date': day, 'days': (dt.date.fromisoformat(season['today']) - d).days,
            'time': (times[0] + ('–' + times[-1] if times[-1] != times[0] else '')) if times else None,
            'd': {'en': f"{MON['en'][d.month - 1]} {d.day}", 'es': f"{d.day} {MON['es'][d.month - 1]}"},
            'long': {'en': f"{DOW['en'][d.weekday()]}, {MON['en'][d.month - 1]} {d.day}, {d.year}",
                     'es': f"{DOW['es'][d.weekday()]} {d.day} de {MON['es'][d.month - 1]}. de {d.year}"},
            'path': [[round(x, 4), round(y, 4)] for x, y in path], 'deco': deco, 'max': max(z['hail_in'] for z in dz)}


def extra(season, ids, today=None):
    """{areas, storms} for the area ids the brief names (real.js shapes; the page skips ids it already holds).
    A storm day's path uses only the zones sent, like real.py uses only the zones on the map."""
    want = set(i for i in ids if i)
    zs = [z for z in (season or {}).get('zones') or [] if '~' in str(z.get('id')) and zid(z) in want]
    areas = [a for a in (area(z, season, today) for z in zs) if a]
    kept = [z for z in zs if zid(z) in {a['id'] for a in areas}]
    storms = {'d' + d.replace('-', ''): storm(d, kept, season) for d in sorted({z['date'] for z in kept})}
    return {'today': season.get('today'), 'areas': areas, 'storms': storms}
