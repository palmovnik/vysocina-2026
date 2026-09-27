#!/usr/bin/env python3
"""Sestaví data pro web z obsahu (content/) a stažených podkladů (data/raw/).

Výstupy:
  docs/data/trip.js     – window.TRIP = {...} (místa, trasy, program, …)
  docs/gpx/*.gpx        – trasy a všechna místa pro navigaci / Mapy.com
  tools/poi_candidates.json – vstup pro fetch_data.py (souřadnice míst)

Spuštění:  python3 tools/build.py
"""
import datetime
import html
import json
import math
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RAW = os.path.join(ROOT, 'data', 'raw')
DOCS = os.path.join(ROOT, 'docs')
MILL = (49.64427, 15.96844)

CATS = [
    {'id': 'chata', 'name': 'Chata', 'emoji': '🏠'},
    {'id': 'skaly', 'name': 'Skály a vyhlídky', 'emoji': '🪨'},
    {'id': 'jeskyne', 'name': 'Jeskyně a podzemí', 'emoji': '🦇'},
    {'id': 'deti', 'name': 'Pro děti', 'emoji': '🎈'},
    {'id': 'pamatky', 'name': 'Památky a muzea', 'emoji': '🏰'},
    {'id': 'priroda', 'name': 'Příroda a voda', 'emoji': '🌲'},
    {'id': 'jidlo', 'name': 'Kde se najíst', 'emoji': '🍽️'},
    {'id': 'farmy', 'name': 'Farmy a zvířata', 'emoji': '🐐'},
    {'id': 'sluzby', 'name': 'Nákupy a služby', 'emoji': '🛒'},
]
ROUTE_COLORS = {
    'bike': ['#1f6fd1', '#0b8793', '#2f9e44', '#7048e8', '#c2255c', '#8d5b2b'],
    'hike': ['#e8590c', '#d6336c', '#5c940d', '#9c36b5', '#1098ad', '#b08900', '#495057', '#e03131', '#0c8599'],
}


def rel(*p):
    return os.path.join(ROOT, *p)


def load(path, default=None):
    if not os.path.exists(path):
        if default is not None:
            return default
        sys.exit(f'Chybí {path}')
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def hav(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


# ------------------------------------------------------------------ odhady času s dětmi
def kids_minutes(kind, km, up):
    if kind == 'bike':
        return km / 11 * 60 + up / 100 * 8
    return km / 3 * 60 + up / 100 * 10


# ------------------------------------------------------------------ místa
def clean_author(s):
    s = re.sub(r'<[^>]+>', '', s or '')
    s = html.unescape(s).strip()
    m = re.match(r'Original uploader was (.+?) at ', s)
    if m:
        s = m.group(1)
    s = re.sub(r'\s+', ' ', s)
    return (s[:40] + '…') if len(s) > 41 else (s or 'neznámý autor')


def make_thumb(pid, width=420):
    """Menší náhled pro dlaždice (docs/img/t/<id>.jpg); bez knihovny Pillow se použije plná fotka."""
    src = os.path.join(DOCS, 'img', pid + '.jpg')
    dst = os.path.join(DOCS, 'img', 't', pid + '.jpg')
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return f'img/t/{pid}.jpg'
    try:
        from PIL import Image  # noqa: PLC0415 – volitelná závislost
    except ImportError:
        return None
    im = Image.open(src).convert('RGB')
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    # dlaždice mají poměr 16:10 až 4:3 – vysoké fotky ořízneme na střed
    if im.height > im.width * 0.8:
        h = round(im.width * 0.8)
        top = (im.height - h) // 2
        im = im.crop((0, top, im.width, top + h))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, 'JPEG', quality=78, optimize=True, progressive=True)
    return f'img/t/{pid}.jpg'


def build_places():
    places = load(rel('content', 'places.json'))
    osrm = load(os.path.join(RAW, 'osrm_car.json'), {})
    access = load(os.path.join(RAW, 'access.json'), {})
    commons = load(os.path.join(RAW, 'commons.json'), {})
    images = {i['id']: i['file'] for i in load(rel('tools', 'images.json'), [])}
    out = []
    for p in places:
        q = {k: v for k, v in p.items() if k not in ('walk', 'bike', 'car', 'noCar', 'park_max_m')}
        q['dist'] = round(hav(MILL, (p['lat'], p['lon'])) / 1000, 2)
        o = osrm.get(p['id'])
        if o and not p.get('noCar') and o.get('min') is not None and q['dist'] > 2.5:
            trustworthy = o['via'] != 'bod' or o['snap_m'] <= 250
            if trustworthy:
                q['car'] = {'km': o['km'], 'min': o['min']}
                q['carTarget'] = o['target']
                walk_m = hav(o['target'], (p['lat'], p['lon']))
                if walk_m > 250:
                    q['car']['walk'] = round(walk_m * 1.3 / 1000, 1)
        a = access.get(p['id'], {})
        for mode in ('walk', 'bike'):
            if mode in a:
                km = a[mode]['length_m'] / 1000
                up = a[mode]['ascend_m']
                q[mode] = {'km': round(km, 1), 'up': up,
                           'min': round(kids_minutes('bike' if mode == 'bike' else 'hike', km, up))}
        f = images.get(p['id'])
        m = commons.get(f) if f else None
        if m and os.path.exists(os.path.join(DOCS, 'img', p['id'] + '.jpg')):
            q['img'] = {'src': f'img/{p["id"]}.jpg', 'author': clean_author(m.get('artist')),
                        'license': m.get('license') or 'viz zdroj', 'page': m.get('page')}
            thumb = make_thumb(p['id'])
            if thumb:
                q['img']['thumb'] = thumb
        out.append(q)
    return out


# ------------------------------------------------------------------ trasy
PAVED = {'asphalt', 'paved', 'concrete', 'concrete:plates', 'concrete:lanes', 'paving_stones', 'sett',
         'cobblestone', 'unhewn_cobblestone', 'metal', 'chipseal'}
FIRM = {'gravel', 'fine_gravel', 'compacted', 'pebblestone'}
SOFT = {'unpaved', 'ground', 'dirt', 'earth', 'grass', 'mud', 'sand', 'grass_paver', 'woodchips', 'rock',
        'roots', 'stone', 'unknown'}
ROADS = {'primary', 'secondary', 'tertiary', 'trunk', 'primary_link', 'secondary_link', 'tertiary_link'}
BUSY = {'primary', 'secondary', 'trunk', 'primary_link', 'secondary_link'}


def classify(tags):
    hw, sf, tt = tags.get('highway'), tags.get('surface'), tags.get('tracktype')
    if sf == 'wood':
        return 'pesina'
    if hw in ('path', 'footway', 'steps', 'bridleway') and sf not in PAVED:
        return 'pesina'
    if sf in PAVED:
        return 'asfalt'
    if sf in FIRM:
        return 'zpevnene'
    if sf in SOFT and sf != 'unknown':
        return 'nezpevnene'
    if tt == 'grade1':
        return 'asfalt'
    if tt == 'grade2':
        return 'zpevnene'
    if tt in ('grade3', 'grade4', 'grade5') or hw == 'track':
        return 'nezpevnene'
    if hw in ('path', 'footway', 'steps', 'bridleway'):
        return 'pesina'
    return 'asfalt'


def rdp(points, eps):
    """Douglas–Peucker nad [(x, y)] v metrech; vrací indexy zachovaných bodů."""
    n = len(points)
    if n < 3:
        return list(range(n))
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]
        bx, by = points[b]
        dx, dy = bx - ax, by - ay
        seg = dx * dx + dy * dy
        best, idx = -1.0, -1
        for i in range(a + 1, b):
            px, py = points[i]
            if seg == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / seg))
                d = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if d > best:
                best, idx = d, i
        if best > eps:
            keep[idx] = True
            stack.append((a, idx))
            stack.append((idx, b))
    return [i for i, k in enumerate(keep) if k]


def mapy_link(points, kind, road=False):
    fmt = lambda p: f'{p[1]:.5f},{p[0]:.5f}'  # noqa: E731 – Mapy.com chce lon,lat
    start, end = points[0], points[-1]
    mid = points[1:-1]
    if len(mid) > 15:
        step = len(mid) / 15
        mid = [mid[int(i * step)] for i in range(15)]
    rtype = 'foot_hiking' if kind == 'hike' else ('bike_road' if road else 'bike_mountain')
    url = (f'https://mapy.com/fnc/v1/route?mapset=outdoor&start={fmt(start)}&end={fmt(end)}'
           f'&routeType={rtype}')
    if mid:
        url += '&waypoints=' + ';'.join(fmt(p) for p in mid)
    return url


def gpx_escape(s):
    return html.escape(str(s), quote=True)


def write_gpx(path, name, desc, track=None, wpts=()):
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<gpx version="1.1" creator="Vysočina 2026 – Mlýn Vikinek" xmlns="http://www.topografix.com/GPX/1/1">',
             f'<metadata><name>{gpx_escape(name)}</name><desc>{gpx_escape(desc)}</desc></metadata>']
    for w in wpts:
        lines.append(f'<wpt lat="{w["lat"]:.6f}" lon="{w["lon"]:.6f}"><name>{gpx_escape(w["name"])}</name>'
                     f'<desc>{gpx_escape(w.get("desc", ""))}</desc></wpt>')
    if track:
        lines.append(f'<trk><name>{gpx_escape(name)}</name><trkseg>')
        for lon, lat, ele in track:
            lines.append(f'<trkpt lat="{lat:.6f}" lon="{lon:.6f}"><ele>{ele:.0f}</ele></trkpt>')
        lines.append('</trkseg></trk>')
    lines.append('</gpx>')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')


def build_routes(places_by_id):
    meta = load(rel('content', 'routes.json'))
    wps = {r['id']: r['points'] for r in load(rel('tools', 'routes.json'))}
    counters = {'bike': 0, 'hike': 0}
    out = []
    for r in meta:
        path = os.path.join(RAW, 'routes', r['id'] + '.geojson')
        if not os.path.exists(path):
            print(f'  ! chybí geometrie trasy {r["id"]} – přeskakuji')
            continue
        gj = load(path)
        feat = gj['features'][0]
        props = feat['properties']
        coords = feat['geometry']['coordinates']  # [lon, lat, ele]
        # kumulativní vzdálenost
        cum = [0.0]
        for a, b in zip(coords, coords[1:]):
            cum.append(cum[-1] + hav((a[1], a[0]), (b[1], b[0])))
        lat0 = math.radians(coords[0][1])
        xy = [(c[0] * 111320 * math.cos(lat0), c[1] * 110540) for c in coords]
        keep = rdp(xy, 5.0)
        geo = [[round(coords[i][1], 5), round(coords[i][0], 5), round(coords[i][2])] for i in keep]
        cumk = [round(cum[i] / 1000, 3) for i in keep]
        # povrch a provoz
        surf = {'asfalt': 0.0, 'zpevnene': 0.0, 'nezpevnene': 0.0, 'pesina': 0.0}
        roads = busy = 0.0
        msgs = props.get('messages', [])
        for m in msgs[1:]:
            d = float(m[3])
            tags = dict(t.split('=', 1) for t in m[9].split() if '=' in t)
            surf[classify(tags)] += d
            if tags.get('highway') in ROADS:
                roads += d
            if tags.get('highway') in BUSY:
                busy += d
        total_m = float(props.get('track-length', cum[-1]))
        ssum = sum(surf.values()) or 1
        surf = {k: round(v / ssum * total_m / 1000, 2) for k, v in surf.items()}
        km = total_m / 1000
        up = int(props.get('filtered ascend', 0))
        kind = r['type']
        color = ROUTE_COLORS[kind][counters[kind] % len(ROUTE_COLORS[kind])]
        counters[kind] += 1
        pts = wps.get(r['id'], [[coords[0][1], coords[0][0]], [coords[-1][1], coords[-1][0]]])
        stops = [s for s in r.get('stops', []) if s in places_by_id]
        missing = set(r.get('stops', [])) - set(stops)
        if missing:
            print(f'  ! {r["id"]}: neznámé zastávky {missing}')
        q = dict(r)
        q.update({
            'km': round(km, 2), 'up': up, 'minKids': round(kids_minutes(kind, km, up)),
            'maxEle': round(max(c[2] for c in coords)), 'minEle': round(min(c[2] for c in coords)),
            'geo': geo, 'cum': cumk, 'surface': surf, 'roads': round(roads / 1000, 1), 'busy': round(busy / 1000, 1),
            'color': color, 'loop': hav((coords[0][1], coords[0][0]), (coords[-1][1], coords[-1][0])) < 150,
            'gpx': f'gpx/{r["id"]}.gpx', 'mapy': mapy_link(pts, kind, road=r['id'] == 'b-stezka-sazava'),
            'stops': stops,
        })
        write_gpx(os.path.join(DOCS, 'gpx', r['id'] + '.gpx'), r['name'], r['teaser'], track=coords,
                  wpts=[{'lat': places_by_id[s]['lat'], 'lon': places_by_id[s]['lon'],
                         'name': places_by_id[s]['name'], 'desc': places_by_id[s]['teaser']} for s in stops])
        out.append(q)
        print(f'  trasa {r["id"]:18} {km:5.1f} km ↑{up:4d} m  bodů {len(coords):4d} → {len(geo):4d}  '
              f'asfalt {surf["asfalt"]:.1f} / zpevn. {surf["zpevnene"]:.1f} / lesní {surf["nezpevnene"]:.1f} / pěšina {surf["pesina"]:.1f}'
              f'  silnice {roads / 1000:.1f} km (II. tř.+ {busy / 1000:.1f})')
    return out


# ------------------------------------------------------------------ slunce
def sun_times(date, zenith):
    lat, lon = MILL
    n = date.timetuple().tm_yday
    res = []
    for rising in (True, False):
        lng_hour = lon / 15
        t = n + ((6 if rising else 18) - lng_hour) / 24
        m = 0.9856 * t - 3.289
        l_ = (m + 1.916 * math.sin(math.radians(m)) + 0.020 * math.sin(math.radians(2 * m)) + 282.634) % 360
        ra = math.degrees(math.atan(0.91764 * math.tan(math.radians(l_)))) % 360
        ra = (ra + (math.floor(l_ / 90) * 90 - math.floor(ra / 90) * 90)) / 15
        sin_dec = 0.39782 * math.sin(math.radians(l_))
        cos_dec = math.cos(math.asin(sin_dec))
        cos_h = (math.cos(math.radians(zenith)) - sin_dec * math.sin(math.radians(lat))) / (cos_dec * math.cos(math.radians(lat)))
        h = (360 - math.degrees(math.acos(cos_h))) if rising else math.degrees(math.acos(cos_h))
        ut = (h / 15 + ra - 0.06571 * t - 6.622 - lng_hour) % 24
        local = (ut + 2) % 24  # letní čas (SELČ) platí do 25. 10. 2026
        hh, mm = int(local), int(round((local % 1) * 60))
        if mm == 60:
            hh, mm = hh + 1, 0
        res.append(f'{hh}:{mm:02d}')
    return res


def sun_times_ephem(date):
    """Přesnější výpočet (knihovna ephem), pokud je k dispozici."""
    import ephem  # noqa: PLC0415 – volitelná závislost
    o = ephem.Observer()
    o.lat, o.lon, o.elevation, o.pressure = str(MILL[0]), str(MILL[1]), 675, 0
    o.date = date.strftime('%Y/%m/%d 00:00')
    sun = ephem.Sun()
    fmt = lambda d: (ephem.Date(d).datetime() + datetime.timedelta(hours=2)).strftime('%-H:%M')  # noqa: E731
    o.horizon = '-0:50'
    rise, sset = fmt(o.next_rising(sun)), fmt(o.next_setting(sun))
    o.horizon = '-6'
    return rise, sset, fmt(o.next_setting(sun, use_center=True))


def build_sun():
    days = ['čt 8. 10.', 'pá 9. 10.', 'so 10. 10.', 'ne 11. 10.', 'po 12. 10.']
    out = []
    for i, label in enumerate(days):
        d = datetime.date(2026, 10, 8 + i)
        try:
            rise, sset, dusk = sun_times_ephem(d)
        except ImportError:
            rise, sset = sun_times(d, 90.833)
            _, dusk = sun_times(d, 96)
        out.append({'date': d.isoformat(), 'label': label, 'rise': rise, 'set': sset, 'dusk': dusk})
    return out


# ------------------------------------------------------------------ kontrola odkazů
def check_refs(program, places_by_id, routes_by_id, meta):
    bad = []
    for d in program['days']:
        for key in ('tips', 'rain', 'alt'):
            for x in d.get(key, []):
                if x.startswith('route:'):
                    if x[6:] not in routes_by_id:
                        bad.append(('trasa', x))
                elif x not in places_by_id:
                    bad.append(('místo', x))
    bad += [('služba', x) for x in meta['chata']['services'] if x not in places_by_id]
    bad += [('tip', x) for x in meta.get('highlights', []) if x not in places_by_id]
    bad += [('rezervace', r['place']) for r in program.get('reservations', []) if r.get('place') and r['place'] not in places_by_id]
    subs = {(g['cat'], g['id']) for g in meta.get('gastro', [])}
    bad += [('podsekce', p['id']) for p in places_by_id.values()
            if p['cat'] in ('jidlo', 'farmy') and (p['cat'], p.get('sub', '')) not in subs]
    if bad:
        sys.exit(f'Neplatné odkazy: {bad}')


CREDITS = (
    'Podklady: © přispěvatelé <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> (ODbL) · '
    'trasy spočítané v <a href="https://brouter.de/">BRouter</a> · časy jízdy autem '
    '<a href="https://project-osrm.org/">OSRM</a> · fotografie z '
    '<a href="https://commons.wikimedia.org/">Wikimedia Commons</a> (autor a licence u každé fotky) · '
    'gastro tipy mimo jiné z <a href="https://gastromapa.hejlik.cz/">Gastromapy Lukáše Hejlíka</a> a '
    '<a href="https://maureruv-vyber.cz/">Maurerova výběru</a> · '
    'mapa <a href="https://leafletjs.com/">Leaflet</a>, dlaždice OpenStreetMap, OpenTopoMap, CyclOSM a Waymarked Trails.'
    '<br>Otevírací doby, vstupné a akce jsou převzaté z webů provozovatelů (stav k 27. 9. 2026). '
    'Před výletem je prosím ověřte, v říjnu se často mění. '
    'Časy „s dětmi“ jsou hrubý odhad čisté chůze či jízdy bez zastávek.'
)


def main():
    places = build_places()
    by_id = {p['id']: p for p in places}
    print(f'Místa: {len(places)} ({sum(1 for p in places if p.get("img"))} s fotkou, '
          f'{sum(1 for p in places if p.get("car"))} s časem autem)')
    routes = build_routes(by_id)
    program = load(rel('content', 'program.json'))
    meta = load(rel('content', 'meta.json'))
    check_refs(program, by_id, {r['id']: r for r in routes}, meta)
    osrm = load(os.path.join(RAW, 'osrm_car.json'), {})
    from_cities = {k[6:]: v for k, v in osrm.items() if k.startswith('_from_')}
    data = {
        'generated': datetime.date.today().isoformat(),
        'mill': {'lat': MILL[0], 'lon': MILL[1]},
        'cats': CATS, 'families': meta['families'], 'chata': meta['chata'], 'weather': meta['weather'],
        'highlights': meta.get('highlights', []), 'gastro': meta.get('gastro', []),
        'kidsSummary': meta.get('kidsSummary', ''),
        'places': places, 'routes': routes, 'program': program, 'sun': build_sun(),
        'fromCities': from_cities, 'credits': CREDITS,
    }
    os.makedirs(os.path.join(DOCS, 'data'), exist_ok=True)
    js = 'window.TRIP=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    with open(os.path.join(DOCS, 'data', 'trip.js'), 'w', encoding='utf-8') as f:
        f.write(js)
    print(f'docs/data/trip.js: {len(js.encode()) // 1024} kB')
    write_gpx(os.path.join(DOCS, 'gpx', 'vysocina-2026-mista.gpx'), 'Vysočina 2026 – místa v okolí Mlýna Vikinek',
              'Všechna místa z průvodce jako body pro navigaci',
              wpts=[{'lat': p['lat'], 'lon': p['lon'], 'name': p['name'], 'desc': p['teaser']} for p in places])
    # vstup pro další běh fetch_data.py (jen souřadnice a režimy)
    src = load(rel('content', 'places.json'))
    cands = []
    for p in src:
        if p['cat'] == 'chata':
            continue
        c = {'id': p['id'], 'lat': p['lat'], 'lon': p['lon']}
        for k in ('car', 'walk', 'bike', 'park_max_m'):
            if k in p:
                c[k] = p[k]
        cands.append(c)
    text = '[\n' + ',\n'.join('  ' + json.dumps(c, ensure_ascii=False) for c in cands) + '\n]\n'
    cpath = rel('tools', 'poi_candidates.json')
    if not os.path.exists(cpath) or open(cpath, encoding='utf-8').read() != text:
        with open(cpath, 'w', encoding='utf-8') as f:
            f.write(text)
        print('tools/poi_candidates.json aktualizován – po pushi se přepočítají časy (GitHub Actions).')


if __name__ == '__main__':
    main()
