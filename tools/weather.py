#!/usr/bin/env python3
"""Stáhne aktuální předpověď počasí pro Mlýn Vikinek z Open-Meteo (záloha pro web).

Web si předpověď stahuje sám při každém otevření. Tenhle soubor (data/weather.json
na větvi gh-pages) použije, jen když živé stažení selže. Spouští ho workflow
„Nasazení webu“ při každém nasazení a navíc každé 3 hodiny. Parametry dotazu
odpovídají dotazu v docs/assets/app.js (modul počasí), aby šla data zpracovat stejně.
Po skončení pobytu už nic nestahuje a na webu zůstane poslední stav.

Použití: python3 tools/weather.py [výstupní soubor]   (výchozí docs/data/weather.json)
"""
import datetime
import json
import os
import sys
import time
import urllib.request
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAT, LON, ELE = 49.6443, 15.9684, 675
MODEL = 'ecmwf_ifs'   # ECMWF IFS HRES 9 km, stejný model jako na webu (a výchozí ve Windy)
CURRENT = 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation,is_day'
DAILY = ('weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,'
         'precipitation_hours,wind_gusts_10m_max,sunshine_duration,sunrise,sunset')
HOURLY = 'temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,is_day'


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'docs', 'data', 'weather.json')
    with open(os.path.join(ROOT, 'content', 'program.json'), encoding='utf-8') as f:
        dates = [datetime.date.fromisoformat(d['date']) for d in json.load(f)['days']]
    today = datetime.datetime.now(ZoneInfo('Europe/Prague')).date()
    if today > dates[-1] + datetime.timedelta(days=2):
        print('Pobyt skončil, předpověď se už nestahuje.')
        return 0
    # denní a hodinová data jen pro dny pobytu, které už předpověď pokrývá (16 dní dopředu)
    start = max(dates[0], today - datetime.timedelta(days=60))
    end = min(dates[-1], today + datetime.timedelta(days=15))
    url = (f'https://api.open-meteo.com/v1/forecast?latitude={LAT}&longitude={LON}&elevation={ELE}&models={MODEL}'
           f'&timezone=Europe%2FPrague&current={CURRENT}')
    if start <= end:
        url += f'&daily={DAILY}&hourly={HOURLY}&start_date={start}&end_date={end}'
    req = urllib.request.Request(url, headers={'User-Agent': 'vysocina-2026 (GitHub Actions)'})
    data = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.load(r)
            break
        except Exception as e:  # noqa: BLE001 – jen zalogovat a zkusit znovu
            print(f'pokus {attempt + 1}: {e}')
            time.sleep(10 * (attempt + 1))
    if not data or not (data.get('current') or data.get('daily')):
        print('Předpověď se nepodařilo stáhnout.')
        return 1
    snap = {'fetched': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'source': 'Open-Meteo', 'model': MODEL, 'data': data}
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(snap, f, ensure_ascii=False, separators=(',', ':'))
    days = (data.get('daily') or {}).get('time', [])
    print(f'{out}: aktuálně {data.get("current", {}).get("temperature_2m")} °C, dny pobytu v předpovědi: {", ".join(days) or "zatím žádné"}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
