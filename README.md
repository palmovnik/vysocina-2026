# Vysočina 2026 – Mlýn Vikinek, Cikháj

Průvodce okolím chaty **Mlýn Vikinek** (Cikháj 57, Žďárské vrchy) pro čtyři rodiny
na pobyt **čt 8. – ne 11. 10. 2026**: interaktivní mapa, skály, jeskyně, tipy pro děti,
cyklotrasy a pěší okruhy s výškovým profilem a GPX, program na čtyři dny a praktické informace.

Web: **https://palmovnik.github.io/vysocina-2026/**

## Zapnutí GitHub Pages (jednou)

1. V repozitáři otevřete **Settings → Pages**.
2. V části *Build and deployment* nastavte **Source: GitHub Actions**.
3. V záložce **Actions** spusťte workflow **GitHub Pages** (tlačítko *Run workflow*),
   případně stačí jakýkoli push, který mění složku `docs/`.

Web se nasazuje ze složky `docs/` (workflow `.github/workflows/pages.yml`).
Pokud raději chcete nasazení z větve, zvolte *Deploy from a branch* a složku `/docs`.

## Jak to funguje

| Složka | Obsah |
|---|---|
| `content/` | ručně psaný obsah: místa (`places.json`), trasy (`routes.json`), program (`program.json`), rodiny a chata (`meta.json`) |
| `tools/fetch_data.py` | stáhne podklady z OpenStreetMap (Overpass), trasy z BRouteru, časy jízdy z OSRM a fotky z Wikimedia Commons; běží v GitHub Actions (workflow *Podklady pro mapu*) |
| `tools/routes.json` | body, přes které se počítají trasy |
| `tools/build.py` | spojí obsah a podklady do `docs/data/trip.js` a vygeneruje GPX do `docs/gpx/` |
| `data/raw/` | stažené podklady (OSM, trasy, časy) |
| `docs/` | hotový web (HTML, CSS, JS, Leaflet, fotky, GPX) |

Úprava obsahu: změňte soubor v `content/`, spusťte `python3 tools/build.py` a pushněte.
Změna bodů tras nebo souřadnic míst: upravte `tools/routes.json` / `content/places.json`,
spusťte `python3 tools/build.py`, pushněte a workflow *Podklady pro mapu* přepočítá trasy
a časy do `data/raw/`; pak stáhněte změny a spusťte build znovu.

## Zdroje a licence

Mapová data © přispěvatelé [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL),
trasy [BRouter](https://brouter.de/), časy jízdy [OSRM](https://project-osrm.org/),
fotografie z [Wikimedia Commons](https://commons.wikimedia.org/) (autor a licence u každé fotky),
mapová knihovna [Leaflet](https://leafletjs.com/) (BSD-2).
Otevírací doby, vstupné a akce jsou převzaté z webů provozovatelů (stav k 26. 9. 2026).
