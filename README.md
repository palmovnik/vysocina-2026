# Vysočina 2026 – Mlýn Vikinek, Cikháj

Průvodce okolím chaty **Mlýn Vikinek** (Cikháj 57, Žďárské vrchy) pro čtyři rodiny
na pobyt **čt 8. – ne 11. 10. 2026**: interaktivní mapa, skály, památky, tipy pro děti,
dobré jídlo, pivovary a farmy, cyklotrasy a pěší okruhy s výškovým profilem a GPX, jednoduché nápady po dnech
a praktické informace. Všechny tipy jsou do hodiny jízdy autem od mlýna. Každý tip se otevírá v okně s popisem, cestou od mlýna a navigací a má odkazy
na oficiální web, Google Mapy a Mapy.com.
Na mapě jsou trasy samostatnou kategorií vedle míst (tlačítko *Vše* zapne nebo vypne všechno),
sekce pod mapou jsou sbalené do skupin a fotky se načtou až po rozbalení.
Nahoře je souhrn předpovědi počasí pro mlýn, který se stahuje živě při každém otevření stránky
(podrobně po hodinách v sekci *Praktické → Počasí a světlo*), a odkaz *Mlýn Vikinek* s adresou,
navigací do Google Map, Mapy.com, Waze i Apple Map, kontaktem a webem mlýna.
Tipy, které doporučují sami majitelé na [webu mlýna](https://mlyn-vikinek.cz/tipy-na-vylet/)
(skály, rybníky, houby, sport, restaurace Tisůvka a Polnička), mají štítek *🌾 tip mlýna*
s jejich slovy (pole `mill` v `content/places.json`), dají se vyfiltrovat a jsou pohromadě
v sekci *Chata → Tipy od majitelů mlýna* (rady bez místa na mapě jsou v `meta.json`, `chata.millTips`).

Web: **https://palmovnik.github.io/vysocina-2026/**

## Nasazení webu

Web se zveřejňuje přes **GitHub Pages z větve `gh-pages`**. Workflow
**Nasazení webu (gh-pages)** (`.github/workflows/pages.yml`) po každém pushi, který mění
složku `docs/`, zkopíruje její obsah do větve `gh-pages` a GitHub Pages ho během
minuty publikuje. V nastavení repozitáře (*Settings → Pages*) je zdroj
*Deploy from a branch*, větev `gh-pages`, složka `/ (root)`.

## Počasí

Stránka si při každém otevření (a po návratu do ní po víc než půl hodině) stáhne předpověď
z [Open-Meteo](https://open-meteo.com/) (zdarma, bez klíče). Model je napevno **ECMWF IFS HRES 9 km**
(stejný jako výchozí ve Windy, pokryje 15 dní dopředu); jeho název je malým písmem v rohu karty
s počasím i grafu. Výchozí „best match“ z Open-Meteo by pro Cikháj střídal modely podle toho,
jak daleko je den (do týdne DWD ICON, dál ECMWF), a popisek by neseděl.
Poslední úspěšně stažená data si pamatuje prohlížeč. Jako záloha pro případ, že živé stažení
selže, stejný workflow *Nasazení webu* každé 3 hodiny spustí `tools/weather.py` a uloží předpověď
do `data/weather.json` na větvi `gh-pages` (po skončení pobytu už nic nestahuje).
Windy se napojit nedá: předplatné Premium platí jen v aplikaci a na webu Windy, data přes API
jsou samostatná placená služba. Na stránce je proto odkaz do Windy přímo na mlýn a jejich
mapa (vložený widget), která se načte až po kliknutí.

## Jak to funguje

| Složka | Obsah |
|---|---|
| `content/` | ručně psaný obsah: místa (`places.json`, u každého tipu pro koho se hodí), trasy (`routes.json`), nápady po dnech a praktické seznamy (`program.json`), rodiny a chata (`meta.json`) |
| `tools/fetch_data.py` | stáhne podklady z OpenStreetMap (Overpass), trasy z BRouteru, časy jízdy z OSRM, fotky z Wikimedia Commons a ověřovací stránky podniků; běží v GitHub Actions (workflow *Podklady pro mapu*), který podle změněných vstupů spustí jen potřebné kroky |
| `tools/routes.json` | body, přes které se počítají trasy |
| `tools/images.json` | vybrané fotky z Wikimedia Commons (stáhnou se do `docs/img/`) |
| `tools/pages.json` | weby podniků k ověření otevírací doby (uloží se do `data/raw/pages/`) |
| `tools/photo_candidates.json` | místa bez fotky: v okolí bodu se hledají kandidáti na Commons (`data/raw/photos/`) |
| `tools/origins.json` | odkud se jede na chatu (Říčany, Holešov, Kroměříž): krok *origins* spočítá v OSRM čas, km a trasu k mlýnu (`data/raw/origins.json`) |
| `tools/drive_check.json` | srovnávací trasy s časy z Google Map: krok *drive* rozloží trasy (k tipům, z míst odjezdu i srovnávací) podle tříd silnic do `data/raw/drive.json` a `build.py` podle nich přepočítá časy OSRM, které jsou jinak delší než v Google Mapách (hlavně na silnicích II. třídy) |
| `tools/build.py` | spojí obsah a podklady do `docs/data/trip.js` a vygeneruje GPX do `docs/gpx/` |
| `tools/weather.py` | záložní předpověď počasí pro web (běží v GitHub Actions každé 3 hodiny) |
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
mapová knihovna [Leaflet](https://leafletjs.com/) (BSD-2),
předpověď počasí: model ECMWF IFS (© [ECMWF](https://www.ecmwf.int/), CC BY 4.0) přes [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0).
Otevírací doby, vstupné a akce jsou převzaté z webů provozovatelů (stav k 27. 9. 2026).
