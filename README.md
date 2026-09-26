# Vysočina 2026 – Mlýn Vikinek, Cikháj

Průvodce okolím chaty **Mlýn Vikinek** (Cikháj 57, Žďárské vrchy) pro čtyři rodiny
na pobyt **čt 8. – ne 11. 10. 2026**: interaktivní mapa, skály, jeskyně, tipy pro děti,
dobré jídlo a farmy, cyklotrasy a pěší okruhy s výškovým profilem a GPX, program na čtyři dny
a praktické informace. Každý tip se otevírá v okně s popisem, cestou od mlýna a navigací.

Web: **https://palmovnik.github.io/vysocina-2026/**

## Nasazení webu

Web se zveřejňuje přes **GitHub Pages z větve `gh-pages`**. Workflow
**Nasazení webu (gh-pages)** (`.github/workflows/pages.yml`) po každém pushi, který mění
složku `docs/`, zkopíruje její obsah do větve `gh-pages` a GitHub Pages ho během
minuty publikuje. V nastavení repozitáře (*Settings → Pages*) je zdroj
*Deploy from a branch*, větev `gh-pages`, složka `/ (root)`.

## Jak to funguje

| Složka | Obsah |
|---|---|
| `content/` | ručně psaný obsah: místa (`places.json`), trasy (`routes.json`), program (`program.json`), rodiny a chata (`meta.json`) |
| `tools/fetch_data.py` | stáhne podklady z OpenStreetMap (Overpass), trasy z BRouteru, časy jízdy z OSRM, fotky z Wikimedia Commons a ověřovací stránky podniků; běží v GitHub Actions (workflow *Podklady pro mapu*), který podle změněných vstupů spustí jen potřebné kroky |
| `tools/routes.json` | body, přes které se počítají trasy |
| `tools/images.json` | vybrané fotky z Wikimedia Commons (stáhnou se do `docs/img/`) |
| `tools/pages.json` | weby podniků k ověření otevírací doby (uloží se do `data/raw/pages/`) |
| `tools/photo_candidates.json` | místa bez fotky: v okolí bodu se hledají kandidáti na Commons (`data/raw/photos/`) |
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
gastro tipy mimo jiné z [Gastromapy Lukáše Hejlíka](https://www.vysocina.eu/stravovaci-zarizeni/gastromapa-lukase-hejlika),
průvodce [Gault&Millau](https://www.gault-millau.cz/) a [Maurerova výběru](https://maureruv-vyber.cz/),
mapová knihovna [Leaflet](https://leafletjs.com/) (BSD-2).
Otevírací doby, vstupné a akce jsou převzaté z webů provozovatelů (stav k 26. 9. 2026).
