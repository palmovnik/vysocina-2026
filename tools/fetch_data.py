#!/usr/bin/env python3
"""Stáhne podklady pro průvodce (OpenStreetMap, trasy, časy jízdy autem, Wikidata).

Spouští se v GitHub Actions (workflow "Podklady pro mapu"), protože tam je volný
přístup na internet. Výsledky se ukládají do data/raw/ a workflow je commitne.

Vstupy (vše v tools/):
  routes.json          – trasy k výpočtu v BRouteru (id, profil, body)
  poi_candidates.json  – body, ke kterým se počítá vzdálenost autem od chaty
  images.json          – soubory z Wikimedia Commons ke stažení (náhledy)
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RAW = os.path.join(ROOT, 'data', 'raw')
TOOLS = os.path.join(ROOT, 'tools')
UA = 'vysocina-2026-trip-guide/1.0 (+https://github.com/palmovnik/vysocina-2026)'

MILL = (49.64427, 15.96844)  # Mlýn Vikinek, Cikháj 57

# Okolí chaty (cca 25 km) a užší okolí pro služby
BBOX_WIDE = (49.45, 15.65, 49.85, 16.30)
BBOX_NEAR = (49.53, 15.80, 49.76, 16.14)
BBOX_KARST = (49.30, 16.60, 49.46, 16.85)
BBOX_FAR = (49.20, 15.50, 49.90, 16.90)

OVERPASS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]


def log(*a):
    print(*a, flush=True)


def http(url, data=None, headers=None, timeout=240, retries=3):
    h = {'User-Agent': UA}
    if headers:
        h.update(headers)
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, data=data, headers=h)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001 – chceme jen zalogovat a zkusit znovu
            log(f'  ! pokus {attempt + 1}: {e} ({url[:100]})')
            time.sleep(8 * (attempt + 1))
    return None


def save(name, obj):
    path = os.path.join(RAW, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    log(f'  -> {name} ({os.path.getsize(path) // 1024} kB)')


def load_input(name, default):
    path = os.path.join(TOOLS, name)
    if not os.path.exists(path):
        return default
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def bb(b):
    return f'{b[0]},{b[1]},{b[2]},{b[3]}'


# ---------------------------------------------------------------- Overpass
def overpass(name, query):
    log(f'Overpass: {name}')
    body = urllib.parse.urlencode({'data': query}).encode()
    for ep in OVERPASS:
        raw = http(ep, data=body, retries=2)
        if raw:
            try:
                js = json.loads(raw)
            except ValueError:
                log('  ! neplatná odpověď, zkouším jiný server')
                continue
            log(f'  {len(js.get("elements", []))} prvků')
            save(f'osm_{name}.json', js)
            return
    log(f'  ! Overpass {name} selhal na všech serverech')


def run_overpass():
    w, n, k, f = bb(BBOX_WIDE), bb(BBOX_NEAR), bb(BBOX_KARST), bb(BBOX_FAR)
    overpass('features', f"""
[out:json][timeout:240];
(
  nwr["natural"~"^(peak|rock|stone|cave_entrance|cliff|spring|arch|bare_rock|saddle)$"]["name"]({w});
  nwr["natural"="cave_entrance"]({w});
  nwr["tourism"~"^(viewpoint|attraction|museum|zoo|theme_park|picnic_site|artwork|gallery|camp_site|alpine_hut|wilderness_hut|aquarium)$"]({w});
  nwr["man_made"="tower"]["tower:type"="observation"]({w});
  nwr["man_made"~"^(watermill|windmill|adit|mineshaft)$"]["name"]({w});
  nwr["historic"~"^(castle|ruins|memorial|monument|archaeological_site|mine|manor|monastery|fort|mill|technical_monument|church)$"]["name"]({w});
  nwr["leisure"~"^(water_park|sports_centre|park|nature_reserve|swimming_area|beach_resort|bird_hide|miniature_golf|horse_riding|ice_rink|summer_camp|track|pitch)$"]["name"]({w});
  nwr["leisure"="swimming_pool"]["name"]({w});
  nwr["boundary"="protected_area"]["name"]({w});
  nwr["place"~"^(town|village|hamlet|isolated_dwelling|locality|suburb)$"]({w});
  nwr["natural"="water"]["name"]({w});
  nwr["waterway"~"^(river|stream)$"]["name"]["name"~"Svratka|Sázava|Stržský"]({n});
);
out center tags;
""")
    overpass('services', f"""
[out:json][timeout:180];
(
  nwr["amenity"~"^(restaurant|pub|cafe|fast_food|pharmacy|hospital|clinic|doctors|fuel|bicycle_rental|ice_cream|bar|biergarten|drinking_water|shelter|bbq|atm|post_office|marketplace|toilets|place_of_worship)$"]({n});
  nwr["shop"]({n});
  nwr["tourism"~"^(hotel|guest_house|chalet|information|motel|hostel)$"]({n});
  nwr["leisure"="playground"]({n});
  nwr["amenity"="hospital"]({w});
);
out center tags;
""")
    overpass('far', f"""
[out:json][timeout:240];
(
  nwr["natural"="cave_entrance"]({k});
  nwr["tourism"~"^(attraction|museum|viewpoint|information)$"]["name"]({k});
  nwr["amenity"="parking"]["name"]({k});
  nwr["railway"~"^(station|halt)$"]["name"]({k});
  nwr["tourism"]["name"~"Pernštejn|podzemí|Veselý Kopec|Svojanov|Macocha|Punkevní|Kateřinská|Balcarka|Sloupsko|Výpustek|Skalní mlýn|Arena|Aréna|Horácké|Kinských|Zelená hora|Nové generace"]({f});
  nwr["historic"]["name"~"Pernštejn|Svojanov|Zubštejn|Pyšolec|Mitrov|Kinských|Zelená hora"]({f});
  nwr["leisure"]["name"~"Vysočina|Aréna|Arena|Relaxační|pumptrack|Pumptrack|aquapark|Aquapark|lanov|Lanov"]({f});
  nwr["sport"]["name"~"pumptrack|Pumptrack|Vysočina Aréna|Vysočina Arena"]({f});
);
out center tags;
""")
    overpass('routes', f"""
[out:json][timeout:180];
rel["route"~"^(bicycle|mtb|hiking|foot|ski|horse|running)$"]({w});
out tags;
""")
    overpass('trails', f"""
[out:json][timeout:180];
rel["route"~"^(hiking|foot|bicycle|mtb)$"]["name"~"[Nn]aučná|NS |[Ss]tezka|[Pp]ohád|okruh|Okruh"]({n});
out geom;
""")
    overpass('parking', f"""
[out:json][timeout:180];
nwr["amenity"="parking"]["access"!~"^(private|no|customers)$"]({w});
out center tags;
""")


def run_overpass_parking():
    """Jen parkoviště (pro rychlé doplnění bez ostatních dotazů)."""
    overpass('parking', f"""
[out:json][timeout:180];
nwr["amenity"="parking"]["access"!~"^(private|no|customers)$"]({bb(BBOX_WIDE)});
out center tags;
""")


# ---------------------------------------------------------------- BRouter
def brouter(points, profile):
    """Vrátí GeoJSON trasy přes zadané body [(lat, lon), …] nebo (None, chyba)."""
    pts = '|'.join(f'{lon:.6f},{lat:.6f}' for lat, lon in points)
    url = ('https://brouter.de/brouter?' + urllib.parse.urlencode({
        'lonlats': pts, 'profile': profile, 'alternativeidx': 0, 'format': 'geojson'}))
    raw = http(url, timeout=120)
    time.sleep(1.5)
    if not raw or not raw.lstrip().startswith(b'{'):
        return None, (raw or b'bez odpovedi').decode('utf-8', 'replace')[:300]
    return json.loads(raw), None


def route_stats(gj):
    props = gj['features'][0]['properties']
    return {'length_m': int(props.get('track-length', 0)),
            'ascend_m': int(props.get('filtered ascend', 0)),
            'plain_ascend_m': int(props.get('plain-ascend', 0)),
            'time_s': int(props.get('total-time', 0))}


def run_brouter():
    routes = load_input('routes.json', [])
    summary = []
    for r in routes:
        profile = r.get('profile', 'trekking')
        log(f'BRouter: {r["id"]} ({profile}, {len(r["points"])} bodů)')
        gj, err = brouter(r['points'], profile)
        if err:
            log(f'  ! chyba: {err}')
            summary.append({'id': r['id'], 'error': err})
            continue
        s = {'id': r['id'], 'profile': profile, **route_stats(gj)}
        log(f'  {s["length_m"] / 1000:.1f} km, ↑{s["ascend_m"]} m')
        summary.append(s)
        save(f'routes/{r["id"]}.geojson', gj)
    if routes:
        save('routes_summary.json', summary)

    # Jak daleko je to od chaty pěšky / na kole (jen souhrn, bez geometrie)
    pois = load_input('poi_candidates.json', [])
    access = {}
    for p in pois:
        for mode, profile in (('walk', 'hiking-mountain'), ('bike', 'trekking')):
            if not p.get(mode):
                continue
            gj, err = brouter([MILL, (p['lat'], p['lon'])], profile)
            if err:
                log(f'  ! {p["id"]} {mode}: {err[:120]}')
                continue
            access.setdefault(p['id'], {})[mode] = route_stats(gj)
            st = access[p['id']][mode]
            log(f'  {mode:4} {p["id"]}: {st["length_m"] / 1000:.1f} km ↑{st["ascend_m"]} m')
    if access:
        save('access.json', access)


# ---------------------------------------------------------------- OSRM (auto)
def haversine(a, b):
    import math
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def nearest_parking(lat, lon, max_m=1200):
    path = os.path.join(RAW, 'osm_parking.json')
    if not os.path.exists(path):
        return None
    best = None
    for e in json.load(open(path, encoding='utf-8'))['elements']:
        c = (e['lat'], e['lon']) if 'lat' in e else (e['center']['lat'], e['center']['lon'])
        d = haversine((lat, lon), c)
        if d <= max_m and (best is None or d < best[0]):
            best = (d, c, e['tags'].get('name', ''), f'{e["type"][0]}{e["id"]}')
    return best


def run_osrm():
    pois = load_input('poi_candidates.json', [])
    if not pois:
        return
    log(f'OSRM: čas jízdy autem k {len(pois)} bodům')
    targets = []
    for p in pois:
        if p.get('car'):
            targets.append((p, tuple(p['car']), 'ručně'))
            continue
        np_ = nearest_parking(p['lat'], p['lon'], p.get('park_max_m', 1200))
        if np_:
            targets.append((p, np_[1], f'parkoviště {np_[3]} {np_[2]} ({round(np_[0])} m)'))
        else:
            targets.append((p, (p['lat'], p['lon']), 'bod'))
    result = {}
    chunk = 80
    for i in range(0, len(targets), chunk):
        part = targets[i:i + chunk]
        coords = ';'.join([f'{MILL[1]},{MILL[0]}'] + [f'{c[1]},{c[0]}' for _, c, _ in part])
        url = (f'https://router.project-osrm.org/table/v1/driving/{coords}'
               '?sources=0&annotations=duration,distance')
        raw = http(url, timeout=120)
        if not raw:
            continue
        js = json.loads(raw)
        if js.get('code') != 'Ok':
            log(f'  ! {js.get("code")} {js.get("message")}')
            continue
        for j, (p, c, how) in enumerate(part, start=1):
            d = js['distances'][0][j]
            t = js['durations'][0][j]
            snap = js['destinations'][j]
            result[p['id']] = {'km': round(d / 1000, 1) if d is not None else None,
                               'min': round(t / 60) if t is not None else None,
                               'target': [round(c[0], 6), round(c[1], 6)], 'via': how,
                               'snap_m': round(snap.get('distance', 0))}
        time.sleep(2)
    # Příjezd z domova (orientačně)
    for name, (lat, lon) in (('Praha', (50.0755, 14.4378)), ('Brno', (49.1951, 16.6068)),
                             ('Jihlava', (49.3961, 15.5912))):
        url = (f'https://router.project-osrm.org/route/v1/driving/{lon},{lat};{MILL[1]},{MILL[0]}'
               '?overview=false')
        raw = http(url, timeout=60)
        if raw:
            js = json.loads(raw)
            if js.get('code') == 'Ok':
                rt = js['routes'][0]
                result['_from_' + name] = {'km': round(rt['distance'] / 1000), 'min': round(rt['duration'] / 60)}
        time.sleep(1)
    save('osrm_car.json', result)


# ---------------------------------------------------------------- Wikidata
SPARQL = """
SELECT ?item ?itemLabel ?itemDescription ?coord ?image ?article ?inst ?instLabel WHERE {
  SERVICE wikibase:box {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point(%s %s)"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point(%s %s)"^^geo:wktLiteral .
  }
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?item wdt:P31 ?inst . }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://cs.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "cs,en". }
}
"""


def run_wikidata():
    out = []
    for name, b in (('wide', BBOX_WIDE), ('karst', BBOX_KARST)):
        q = SPARQL % (b[1], b[0], b[3], b[2])
        url = 'https://query.wikidata.org/sparql?' + urllib.parse.urlencode({'query': q, 'format': 'json'})
        log(f'Wikidata: {name}')
        raw = http(url, headers={'Accept': 'application/sparql-results+json'}, timeout=120)
        if not raw:
            continue
        rows = json.loads(raw)['results']['bindings']
        log(f'  {len(rows)} řádků')
        for r in rows:
            out.append({k: v['value'] for k, v in r.items()})
        time.sleep(2)
    if out:
        save('wikidata.json', out)


# ---------------------------------------------------------------- Commons
def run_commons():
    files = load_input('images.json', [])
    if not files:
        return
    imgdir = os.path.join(ROOT, 'docs', 'img')
    os.makedirs(imgdir, exist_ok=True)
    meta = {}
    titles = [f['file'] for f in files]
    for i in range(0, len(titles), 40):
        part = titles[i:i + 40]
        url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({
            'action': 'query', 'format': 'json', 'prop': 'imageinfo',
            'iiprop': 'url|extmetadata|size', 'iiurlwidth': 800,
            'titles': '|'.join('File:' + t for t in part)})
        raw = http(url, timeout=60)
        if not raw:
            continue
        pages = json.loads(raw)['query']['pages']
        for p in pages.values():
            if 'imageinfo' not in p:
                continue
            ii = p['imageinfo'][0]
            em = ii.get('extmetadata', {})
            meta[p['title'][5:]] = {
                'thumb': ii.get('thumburl'), 'page': ii.get('descriptionurl'),
                'artist': em.get('Artist', {}).get('value', ''),
                'license': em.get('LicenseShortName', {}).get('value', ''),
                'license_url': em.get('LicenseUrl', {}).get('value', ''),
                'credit': em.get('Credit', {}).get('value', ''),
            }
    for f in files:
        m = meta.get(f['file']) or meta.get(f['file'].replace('_', ' '))
        if not m or not m.get('thumb'):
            log(f'  ! bez metadat: {f["file"]}')
            continue
        path = os.path.join(imgdir, f['id'] + '.jpg')
        if os.path.exists(path):  # už stažené (a zmenšené) – nepřepisovat
            m['local'] = f'img/{f["id"]}.jpg'
            continue
        raw = http(m['thumb'], timeout=60)
        if raw:
            with open(path, 'wb') as fh:
                fh.write(raw)
            m['local'] = f'img/{f["id"]}.jpg'
            log(f'  obrázek {f["id"]} ({len(raw) // 1024} kB)')
        time.sleep(1)
    save('commons.json', meta)


def run_missing():
    """Stáhne jen to, co v data/raw ještě chybí (výchozí chování při změně v tools/)."""
    if not os.path.exists(os.path.join(RAW, 'osm_features.json')):
        run_overpass()
    elif not os.path.exists(os.path.join(RAW, 'osm_parking.json')):
        run_overpass_parking()
    if not os.path.exists(os.path.join(RAW, 'wikidata.json')):
        run_wikidata()


def main():
    steps = sys.argv[1:] or ['missing', 'brouter', 'osrm', 'commons']
    for s in steps:
        globals()['run_' + s]()


if __name__ == '__main__':
    main()
