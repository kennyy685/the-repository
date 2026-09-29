"""Sample night briefs for the open map's "Since last night" strip (data/night.js), made by the ENGINE's own
hailhunter/night.py brief(), so the page shows the exact shape `hh.py night` writes.

Two nights, both on the page's real public storms + real streets, fake house numbers (SAMPLE, never owner names):
  quiet  Sep 27 -> Sep 28: no new hail (true for the real reports); ranks shift as storms age and sample doors get
         knocked (the moves and door counts are SAMPLE).
  storm  replay of the real Sep 13 storm night (Colon + Prague radar hail): Sep 12 -> Sep 14 brief.
Tonight's ranking = the page's own pick order (pickScore, captured from the page on 2026-09-28), so the strip and
"Aldaba's top 3" agree. Run from this folder: python3 night.py   (writes ../night.js)"""
import json, math, os, sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..', '..', '..', '..')
sys.path.insert(0, ROOT)
from hailhunter import night  # noqa: E402

HOME = (41.4333, -96.4981)   # Fremont (company home)
# the page's pickScore order on 2026-09-28 (x100), top 12
RANK = [("z0423-malcolm", 74.0), ("z0423-lincoln", 68.0), ("z0610-lincoln", 67.4), ("z0423-millard", 67.0),
        ("z0613-fremont", 63.9), ("z0306-valparaiso", 59.8), ("z0701-fremont", 58.9), ("z0610-raymond", 57.6),
        ("z0613-fremont-2", 57.4), ("z0605-union", 56.9), ("z0610-roca", 56.2), ("z0423-kennard", 55.7)]


def load_real():
    with open(os.path.join(HERE, '..', 'real.js'), encoding='utf-8') as f:
        t = f.read()
    return json.loads(t[t.index('{'):t.rindex('}') + 1])


def miles(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 3958.8 * 2 * math.asin(math.sqrt(a))


def main():
    R = load_real()
    with open(os.path.join(HERE, '..', 'areas.json'), encoding='utf-8') as f:
        streets = json.load(f)['areas']
    A = {a['id']: a for a in R['AREAS']}
    S = R['STORMS']

    def day(a):
        return S[a['st']]['date']

    def storms(before):                     # hud.json-like storm rows: one per zone, reported on or before `before`
        return {'storms': [{'day': day(a), 'place': a['name']['en'], 'state': 'NE', 'hail': a['hail'],
                            'dist_mi': round(miles(HOME[0], HOME[1], a['c'][1], a['c'][0]), 1)}
                           for a in R['AREAS'] if day(a) <= before and a.get('hail')]}

    def zone(zid, score, homes_off=0):
        a = A[zid]
        good = [w[1] for w in a.get('why') or [] if w[0] > 0][:2]
        return {'id': zid, 'list_id': zid, 'kind': 'storm', 'name': a['name']['en'], 'score': score,
                'hail_in': a['hail'], 'storm_day': day(a), 'homes': (a.get('homes') or 0) - homes_off,
                'dist_mi': round(miles(HOME[0], HOME[1], a['c'][1], a['c'][0]), 1),
                'why': {'en': ' '.join(w['en'] for w in good), 'es': ' '.join(w['es'] for w in good)}}

    def walks(zs):                          # 25 doors, starting on the walk's first real street; house number = SAMPLE
        out = {}
        for i, z in enumerate(zs):
            st = (streets.get(z['id']) or {}).get('s') or []
            first = st[0]['n'] if st else None
            a = A[z['id']]
            stops = [{'address': f"{1200 + 104 * i} {first}" if first else None, 'lat': a['c'][1], 'lon': a['c'][0]}]
            stops += [{'address': None, 'lat': a['c'][1], 'lon': a['c'][0]}] * 24
            out[f"walks/{z['id']}"] = {'stops': stops, 'best_time': {
                'en': 'Best time to knock today: 4-8 PM.', 'es': 'Mejor hora para tocar puertas hoy: de 4 a 8 p. m.'}}
        return out

    def brief(zs, hud, date, prev, made):
        zd = {'zones': zs}
        return night.brief(hud, zd, walks(zs), date, prev, None, now=made)

    SAMPLE = {'en': 'Sample night: real storms and streets; the rank moves, doors knocked and house numbers are made up.',
              'es': 'Noche de muestra: tormentas y calles reales; los cambios de puesto, puertas tocadas y números de '
                    'casa son inventados.'}
    # quiet: last night Lincoln (Jun 10) was #5 and Millard #3; 36 sample doors knocked in Fremont (Jun 13) since
    last = [RANK[0], RANK[1], RANK[3], RANK[4], RANK[2]] + RANK[5:]
    prev = brief([zone(z, s, -36 if z == 'z0613-fremont' else 0) for z, s in last], storms('2026-09-27'),
                 '2026-09-27', None, datetime(2026, 9, 27, 7, 40, tzinfo=timezone.utc))
    quiet = brief([zone(z, s) for z, s in RANK], storms('2026-09-28'), '2026-09-28', prev,
                  datetime(2026, 9, 28, 7, 40, tzinfo=timezone.utc))
    quiet['sample'] = {**SAMPLE, 'label': {'en': 'Quiet night', 'es': 'Noche tranquila'}}
    # storm replay: the real Sep 13 storm (radar hail at Colon + Prague) lands between the Sep 12 and Sep 14 briefs
    ranked13 = [(z, s) for z, s in RANK]
    before = brief([zone(z, s) for z, s in ranked13], storms('2026-09-12'), '2026-09-12', None,
                   datetime(2026, 9, 12, 7, 40, tzinfo=timezone.utc))
    after_rank = ranked13[:3] + [("z0913-colon", 67.2)] + ranked13[3:9] + [("z0913-prague", 57.0)] + ranked13[9:10]
    storm = brief([zone(z, s) for z, s in after_rank], storms('2026-09-13'), '2026-09-14', before,
                  datetime(2026, 9, 14, 7, 40, tzinfo=timezone.utc))
    storm['sample'] = {'en': 'Replay of the real Sep 13 storm night. Rank moves and house numbers are made up.',
                       'es': 'Repetición de la noche real de la tormenta del 13 sep. Los cambios de puesto y números '
                             'de casa son inventados.', 'label': {'en': 'Storm night', 'es': 'Noche de tormenta'}}
    body = json.dumps({'quiet': quiet, 'storm': storm}, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(HERE, '..', 'night.js'), 'w', encoding='utf-8') as f:
        f.write('/* SAMPLE night briefs for the "Since last night" strip, made by hailhunter/night.py brief() '
                '(data/build/night.py). Do not edit. */\nwindow.NIGHT=' + body + ';\n')
    print(quiet['headline']['en'])
    print(storm['headline']['en'])


if __name__ == '__main__':
    main()
