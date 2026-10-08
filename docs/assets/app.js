/* Vysočina 2026 – interaktivní průvodce (Leaflet + data z data/trip.js) */
(function () {
  'use strict';

  var T = window.TRIP;
  if (!T) { document.body.insertAdjacentHTML('afterbegin', '<p style="padding:16px">Chybí data (data/trip.js).</p>'); return; }

  var CATS = {};
  T.cats.forEach(function (c) { CATS[c.id] = c; });
  var PLACES = {};
  T.places.forEach(function (p) { PLACES[p.id] = p; });
  var ROUTES = {};
  T.routes.forEach(function (r) { ROUTES[r.id] = r; });
  var MILL = T.mill;
  var MILL_TIPS = 'https://mlyn-vikinek.cz/tipy-na-vylet/';   // tipy na výlet z webu mlýna
  var TOUR_CATS = ['skaly', 'deti', 'pamatky', 'priroda'];   // sekce Výlety
  var FOOD_CATS = ['jidlo', 'farmy'];                                     // sekce Jídlo
  var SUBS = {};
  (T.gastro || []).forEach(function (g) { SUBS[g.cat + ':' + g.id] = g; });
  // štítky u podniků: [ikona, krátce, celý popis]
  var TAGS = {
    gastromapa: ['🍴', 'Gastromapa', 'v Gastromapě Lukáše Hejlíka'],
    gaultmillau: ['🎩', 'Gault&Millau', 'v průvodci Gault&Millau 2026'],
    maurer: ['🏅', 'Maurer', 'Maurerův výběr Grand Restaurant'],
    anketa: ['🏆', 'oblíbený', 'vítěz čtenářské ankety Žďárského deníku'],
    farma: ['🐄', 'vlastní farma', 'maso a suroviny z vlastní farmy'],
    hriste: ['🛝', 'hřiště', 'dětské hřiště u podniku'],
    koutek: ['🧸', 'koutek', 'dětský koutek'],
    zvirata: ['🐐', 'zvířátka', 'zvířátka k pohlazení'],
    rezervace: ['📞', 'rezervovat', 'rezervace nutná'],
    zdarma: ['🆓', 'zdarma', 'vstup zdarma'],
    sklo: ['🔥', 'sklárna', 'hned vedle se fouká sklo'],
    regional: ['🥔', 'vysočinská kuchyně', 'tradiční vysočinská jídla'],
    pivovar: ['🍺', 'pivovar', 'vlastní pivovar'],
    blizko: ['🏠', 'kousek od mlýna', 'kousek od mlýna'],
    nealko: ['🥤', 'bez alkoholu', 'nealkoholický podnik'],
    lokalni: ['🌿', 'místní suroviny', 'vaří z místních surovin']
  };
  // pro koho se tip hodí: [ikona, krátce, celý popis]
  var FIT = {
    male: ['🧸', 'malí', 'pro malé děti (do 4 let)'],
    skolaci: ['🎒', 'školáci', 'pro školáky (6–9 let)'],
    kocarek: ['🚼', 'kočárek', 'dá se projet s kočárkem'],
    dospeli: ['👫', 'dospělí', 'spíš pro dospělé, když se rozdělíte'],
    rain: ['☔', 'i za deště', 'hodí se, i když prší']
  };
  var FIT_KEYS = ['male', 'skolaci', 'kocarek', 'dospeli'];
  var FLAGS = [['top', '⭐ Top tipy'], ['mill', '🌾 Tipy mlýna'], ['male', '🧸 Pro malé'], ['skolaci', '🎒 Pro školáky'], ['kocarek', '🚼 S kočárkem'],
    ['dospeli', '👫 Pro dospělé'], ['rain', '☔ Když prší']];

  // ------------------------------------------------------------ helpers
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'style') e.setAttribute('style', attrs[k]);
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    if (html != null) e.innerHTML = html;
    return e;
  }
  function fmtKm(km) { return (km < 10 ? km.toFixed(1) : Math.round(km)).toString().replace('.', ',') + ' km'; }
  function fmtMin(min) {
    if (min == null) return '';
    min = Math.round(min);
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), m = min % 60;
    return h + ' h' + (m ? ' ' + m + ' min' : '');
  }
  function fmtDur(min) {
    if (min < 60) return Math.round(min / 5) * 5 + ' min';
    var m = Math.round(min / 5) * 5, h = Math.floor(m / 60), r = m % 60;
    return h + ':' + (r < 10 ? '0' : '') + r + ' h';
  }
  function catVar(cat) { return 'var(--c-' + cat + ')'; }
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem('vys26:' + key));
      localStorage.setItem('vys26:' + key, JSON.stringify(val));
    } catch (e) { return undefined; }
  }
  function hav(a, b) {
    var r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r;
    var h = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 12742 * Math.asin(Math.sqrt(h));
  }
  function mapyShow(p) {
    return 'https://mapy.com/fnc/v1/showmap?mapset=outdoor&center=' + p.lon + ',' + p.lat + '&zoom=16&marker=true';
  }
  function googleNav(p) {
    var t = p.carTarget || [p.lat, p.lon];
    return 'https://www.google.com/maps/dir/?api=1&destination=' + t[0] + ',' + t[1];
  }
  // navigace autem k bodu ve všech běžných aplikacích (start = aktuální poloha)
  function navApps(p) {
    var ll = p.lat + ',' + p.lon;
    return [
      ['Google Mapy', 'https://www.google.com/maps/dir/?api=1&destination=' + ll + '&travelmode=driving'],
      ['Mapy.com', 'https://mapy.com/fnc/v1/route?mapset=traffic&end=' + p.lon + ',' + p.lat + '&routeType=car_fast_traffic&navigate=true'],
      ['Waze', 'https://waze.com/ul?ll=' + ll + '&navigate=yes'],
      ['Apple Mapy', 'https://maps.apple.com/?daddr=' + ll + '&dirflg=d']
    ];
  }
  function navAppsHtml(p) {
    return '<div class="navgrid">' + navApps(p).map(function (n) { return extLink(n[1], esc(n[0]), 'btn nav'); }).join('') + '</div>';
  }
  // odkazy do map: podniky a atrakce se hledají podle názvu (karta s fotkami, recenzemi
  // a otevírací dobou), přírodní místa bez vlastní karty ukážou přesný bod
  function mapQuery(p) {
    if (p.q) return p.q;
    var n = p.name.replace(/\s*\([^)]*\)/g, '').replace(/[„“"]/g, '').split(/:|\s–\s/)[0].trim();
    return n + (p.town && n.indexOf(p.town) < 0 ? ', ' + p.town : '');
  }
  function usePin(p) { return p.pin || (!p.q && (p.cat === 'skaly' || p.cat === 'priroda')); }
  function googlePlace(p) {
    return 'https://www.google.com/maps/search/?api=1&query=' + (usePin(p) ? p.lat + ',' + p.lon : encodeURIComponent(mapQuery(p)));
  }
  function mapyPlace(p) {
    return usePin(p) ? mapyShow(p) : 'https://mapy.com/fnc/v1/search?query=' + encodeURIComponent(mapQuery(p)) +
      '&mapset=outdoor&center=' + p.lon + ',' + p.lat + '&zoom=15';
  }
  function extLink(href, label, cls) {
    return '<a class="' + (cls || 'lk') + '" href="' + esc(href) + '" target="_blank" rel="noopener">' + label + '</a>';
  }
  // řádek odkazů: oficiální web, Google Mapy, Mapy.com
  function linksHtml(p, cls) {
    return '<span class="' + (cls || 'links') + '">' + (p.web ? extLink(p.web, '🌐 Web') : '') +
      extLink(googlePlace(p), 'Google<span class="lk-x"> Mapy</span>') + extLink(mapyPlace(p), 'Mapy.com') + '</span>';
  }
  // trasa v Google Mapách: start, cíl a tři body po cestě (víc mobilní Google Mapy neberou),
  // v Mapy.com přes stejné body, přes které ji počítal BRouter
  function routeGoogle(r) {
    var g = r.geo, n = g.length;
    function pt(i) { return g[i][0].toFixed(5) + ',' + g[i][1].toFixed(5); }
    var wp = [0.25, 0.5, 0.75].map(function (f) { return pt(Math.round((n - 1) * f)); }).join('|');
    return 'https://www.google.com/maps/dir/?api=1&origin=' + pt(0) + '&destination=' + pt(n - 1) +
      '&waypoints=' + encodeURIComponent(wp) + '&travelmode=' + (r.type === 'bike' ? 'bicycling' : 'walking');
  }
  function routeLinksHtml(r, cls) {
    return '<span class="' + (cls || 'links') + '">' + extLink(r.mapy, 'Mapy.com') + extLink(routeGoogle(r), 'Google Mapy') +
      (r.start ? extLink(googleNav({ lat: r.geo[0][0], lon: r.geo[0][1] }), '🚗 Na start') : '') + '</span>';
  }
  // cesta z domova k mlýnu: Google Mapy i Mapy.com počítají s aktuální dopravou
  function homeRoute(o, mapy) {
    return mapy ? 'https://mapy.com/fnc/v1/route?mapset=traffic&start=' + o.lon + ',' + o.lat + '&end=' + MILL.lon + ',' + MILL.lat + '&routeType=car_fast_traffic'
      : 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(o.q) + '&destination=' + MILL.lat + ',' + MILL.lon + '&travelmode=driving';
  }
  function placeHref(id) { return '#misto/' + id; }
  function routeHref(id) { return '#trasa/' + id; }
  // krátký údaj „jak daleko“ pro dlaždice a seznam
  function howFar(p) {
    if (p.id === 'mlyn') return '🏠 naše chata';
    if (p.walk && p.walk.km <= 3) return '🥾 ' + fmtMin(p.walk.min);
    if (p.car) return '🚗 ' + fmtMin(p.car.min);
    if (p.bike) return '🚲 ' + fmtKm(p.bike.km);
    return '📍 ' + fmtKm(p.dist);
  }
  function accessRows(p) {
    var rows = [];
    if (p.walk && p.walk.km <= 8) rows.push(['🥾', 'Pěšky', fmtKm(p.walk.km) + (p.walk.up >= 20 ? ' · ↑ ' + p.walk.up + ' m' : '') + ' · s dětmi asi ' + fmtMin(p.walk.min)]);
    if (p.bike) rows.push(['🚲', 'Na kole', fmtKm(p.bike.km) + (p.bike.up >= 20 ? ' · ↑ ' + p.bike.up + ' m' : '') + ' · s dětmi asi ' + fmtMin(p.bike.min)]);
    if (p.car) rows.push(['🚗', 'Autem', fmtMin(p.car.min) + ' · ' + fmtKm(p.car.km) + (p.car.walk ? ' + ' + fmtKm(p.car.walk) + ' pěšky od parkoviště' : '')]);
    if (!rows.length && p.id !== 'mlyn') rows.push(['📍', 'Od mlýna', fmtKm(p.dist) + ' vzdušnou čarou']);
    return rows;
  }
  function placeLabel(p) {
    var s = SUBS[p.cat + ':' + (p.sub || '')];
    return s ? s.name : CATS[p.cat].name;
  }
  function placeIcon(p) { return p.icon || CATS[p.cat].emoji; }
  function linkChip(kind, id) {
    if (kind === 'route') {
      var r = ROUTES[id];
      if (!r) return '';
      return '<a class="link-chip" href="' + routeHref(id) + '" style="--c:' + r.color + '"><span class="d">' + (r.type === 'bike' ? '🚲' : '🥾') + '</span>' + esc(r.name) + '</a>';
    }
    var p = PLACES[id];
    if (!p) return '';
    return '<a class="link-chip" href="' + placeHref(id) + '" style="--c:' + catVar(p.cat) + '"><span class="d">' + placeIcon(p) + '</span>' + esc(p.name) + '</a>';
  }
  function fitKeys(p) {
    var k = (p.fit || []).slice();
    if (p.rain) k.push('rain');
    return k;
  }
  function fitChips(p) {
    return fitKeys(p).map(function (k) {
      return '<span class="fit fit-' + k + '" title="' + esc(FIT[k][2]) + '">' + FIT[k][0] + ' ' + FIT[k][1] + '</span>';
    }).join('');
  }
  // filtr „jen vhodné“ (top tip, pro malé, pro školáky, s kočárkem, když prší)
  function passFlags(p, f) {
    if (f.top && !p.top) return false;
    if (f.mill && !p.mill) return false;
    if (f.rain && !p.rain) return false;
    var fit = p.fit || [];
    return FIT_KEYS.every(function (k) { return !f[k] || fit.indexOf(k) >= 0; });
  }
  function linkChips(ids, kind) { return (ids || []).map(function (id) { return linkChip(kind, id); }).join(''); }
  var toastT = null;
  function toast(msg) {
    var t = $('#toast') || document.body.appendChild(el('div', { id: 'toast', 'class': 'toast', role: 'status' }));
    (modal.open ? modal : document.body).appendChild(t);
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  // ------------------------------------------------------------ hero
  (function hero() {
    var fam = $('#families');
    var adults = 0, kids = 0;
    T.families.forEach(function (f) {
      adults += f.adults; kids += f.kids;
      fam.appendChild(el('span', { 'class': 'family' }, '<b>' + esc(f.name) + '</b> ' + f.adults + '+' + f.kids));
    });
    fam.appendChild(el('span', { 'class': 'family total' }, '= <b>' + (adults + kids) + ' lidí</b>: ' + adults + ' dospělých a ' + kids + ' dětí' +
      (T.kidsSummary ? ' (' + esc(T.kidsSummary) + ')' : '')));
    // odjezd z domova kolem 13:00, na mlýně od 15:00; dny se počítají podle kalendáře v Česku
    var depart = new Date('2026-10-08T13:00:00+02:00'), start = new Date('2026-10-08T15:00:00+02:00'),
      end = new Date('2026-10-11T18:00:00+02:00'), departAt = 'kolem 13:00';
    var cd = $('#countdown');
    function pragueDay(t) {
      var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t).split('-');
      return Date.UTC(+p[0], +p[1] - 1, +p[2]);
    }
    function countdown() {
      var now = new Date();
      if (now < depart) {
        var d = Math.round((pragueDay(depart) - pragueDay(now)) / 86400000);
        if (d >= 2) cd.textContent = '⏳ za ' + d + (d < 5 ? ' dny' : ' dní') + ' vyrážíme';
        else if (d === 1) cd.textContent = '⏳ zítra ' + departAt + ' vyrážíme!';
        else {
          var m = Math.max(1, Math.round((depart - now) / 60000));
          cd.textContent = '⏳ ' + (m >= 60 ? 'dnes ' + departAt : 'za ' + m + ' min') + ' vyrážíme!';
        }
      } else if (now < start) cd.textContent = '🚗 jsme na cestě, na mlýně od 15:00';
      else if (now <= end) cd.textContent = '🎒 právě jsme na Vysočině!';
      else cd.textContent = '📸 bylo to super';
    }
    countdown();
    setInterval(countdown, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) countdown(); });
  })();

  // ------------------------------------------------------------ theme
  (function theme() {
    var saved = store('theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    $('#themeToggle').addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      if (!cur) cur = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      store('theme', next);
    });
  })();

  // ------------------------------------------------------------ map
  var map = L.map('map', { zoomControl: true, scrollWheelZoom: false, tap: true });
  var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });
  var topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17, subdomains: 'abc',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM · styl © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
  });
  var cyclo = L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
    maxZoom: 20, subdomains: 'abc',
    attribution: '© <a href="https://www.cyclosm.org">CyclOSM</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });
  var hikeOv = L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
    maxZoom: 18, opacity: .75, attribution: 'trasy © <a href="https://waymarkedtrails.org">Waymarked Trails</a>'
  });
  var cycleOv = L.tileLayer('https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png', {
    maxZoom: 18, opacity: .75, attribution: 'cyklotrasy © <a href="https://waymarkedtrails.org">Waymarked Trails</a>'
  });
  var baseName = store('base') || 'Základní (OSM)';
  var bases = { 'Základní (OSM)': osm, 'Turistická s vrstevnicemi': topo, 'Cyklomapa': cyclo };
  (bases[baseName] || osm).addTo(map);
  var overlays = { 'Značené turistické trasy (KČT)': hikeOv, 'Značené cyklotrasy': cycleOv };
  L.control.layers(bases, overlays, { collapsed: true }).addTo(map);
  L.control.scale({ imperial: false }).addTo(map);
  map.on('baselayerchange', function (e) { store('base', e.name); });

  // kolečko myši až po kliknutí do mapy (aby šlo scrollovat stránkou)
  map.on('click focus', function () { map.scrollWheelZoom.enable(); });
  map.on('mouseout blur', function () { map.scrollWheelZoom.disable(); });

  // kruhy 5 a 10 km kolem mlýna
  [5, 10].forEach(function (km) {
    L.circle([MILL.lat, MILL.lon], {
      radius: km * 1000, color: '#b8541c', weight: 1, opacity: .45, dashArray: '4 6', fill: false, interactive: false
    }).addTo(map);
  });

  // ------------------------------------------------------------ markers
  function iconFor(p, small) {
    var home = p.cat === 'chata';
    var html = '<div class="pin' + (home ? ' home' : '') + (p.top && !home && !small ? ' top' : '') + (small ? ' small' : '') + '" style="--c:' + catVar(p.cat) + ';position:relative">' +
      (home && !small ? '<i class="home-pulse"></i>' : '') + '<span>' + placeIcon(p) + '</span></div>';
    var s = home ? 42 : 32;
    if (small) s = 26;
    return L.divIcon({ html: html, className: '', iconSize: [s, s], iconAnchor: [s / 2, s + 2], popupAnchor: [0, -s] });
  }
  function popupHtml(p) {
    var h = '<div class="pop" style="--c:' + catVar(p.cat) + '">' +
      '<div class="cat">' + CATS[p.cat].emoji + ' ' + esc(placeLabel(p)) + (p.town ? ' · ' + esc(p.town) : '') + (p.top ? ' · ⭐ tip' : '') + '</div>' +
      '<h4>' + esc(p.name) + '</h4>';
    if (p.img) h += '<img src="' + esc(p.img.thumb || p.img.src) + '" alt="" loading="lazy">';
    h += '<div>' + esc(p.teaser) + '</div>';
    h += '<div class="acc">' + accessRows(p).map(function (a) { return a[0] + ' ' + esc(a[2].split(' · s dětmi')[0]); }).join('<br>') + '</div>';
    h += '<div class="row">';
    if (p.id !== 'mlyn') h += '<a class="btn small primary" href="' + placeHref(p.id) + '">Detail</a>';
    h += '<a class="btn small" href="' + googleNav(p) + '" target="_blank" rel="noopener">🧭 Navigovat</a></div>' +
      linksHtml(p, 'links pop-links') + '</div>';
    return h;
  }
  var markers = {};
  T.places.forEach(function (p) {
    var m = L.marker([p.lat, p.lon], {
      icon: iconFor(p), title: p.name, riseOnHover: true,
      zIndexOffset: p.cat === 'chata' ? 1000 : (p.top ? 300 : 0), keyboard: true, alt: p.name
    });
    m.bindPopup(function () { return popupHtml(p); }, { maxWidth: 290, autoPanPadding: [30, 60] });
    markers[p.id] = m;
  });

  // ------------------------------------------------------------ routes on map
  var routeLayers = {};
  function hoverDot() {
    return L.marker([0, 0], { icon: L.divIcon({ html: '<div class="hover-dot"></div>', className: '', iconSize: [14, 14], iconAnchor: [7, 7] }), interactive: false, zIndexOffset: 2000 });
  }
  function routePopupHtml(r) {
    return '<div class="pop" style="--c:' + r.color + '"><div class="cat">' + (r.type === 'bike' ? '🚲 na kolo' : '🥾 pěšky') + '</div>' +
      '<h4>' + esc(r.name) + '</h4><div class="acc">' + fmtKm(r.km) + ' · ↑ ' + r.up + ' m · s dětmi ' + fmtDur(r.minKids) + '</div>' +
      '<div class="row"><a class="btn small primary" href="' + routeHref(r.id) + '">Detail a profil</a>' +
      '<a class="btn small" href="' + esc(r.gpx) + '" download>⬇ GPX</a></div>' + routeLinksHtml(r, 'links pop-links') + '</div>';
  }
  T.routes.forEach(function (r) {
    var latlngs = r.geo.map(function (g) { return [g[0], g[1]]; });
    var casing = L.polyline(latlngs, { color: '#fff', weight: 7, opacity: .85, interactive: false });
    var line = L.polyline(latlngs, {
      color: r.color, weight: 4, opacity: .9, dashArray: r.type === 'hike' ? '9 7' : null, lineCap: 'round'
    });
    line.bindTooltip((r.type === 'bike' ? '🚲 ' : '🥾 ') + esc(r.name) + ' · ' + fmtKm(r.km), { sticky: true, direction: 'top', opacity: .95 });
    line.on('click', function (e) {
      selectRoute(r.id);
      openRoutePopup(r, e.latlng);
    });
    routeLayers[r.id] = L.layerGroup([casing, line]);
    routeLayers[r.id].line = line;
    routeLayers[r.id].casing = casing;
  });

  var legend = L.control({ position: 'bottomleft' });
  legend.onAdd = function () {
    return el('div', { 'class': 'map-legend' },
      '<div><span class="lg-star">★</span>top tip</div><div><i style="border-color:#1f6fd1"></i>trasa na kolo</div><div><i class="dash" style="border-color:#e8590c"></i>trasa pěšky</div><div style="color:#b8541c">◌ 5 a 10 km od mlýna</div>');
  };
  legend.addTo(map);

  // ------------------------------------------------------------ map filters
  // trasy jsou na mapě samostatná kategorie vedle míst
  var ROUTE_CAT = { id: 'trasy', name: 'Trasy', emoji: '🗺️' };
  var ALL_CATS = T.cats.map(function (c) { return c.id; }).concat(ROUTE_CAT.id);
  var state = store('filters4') || {};
  state.cats = state.cats || ALL_CATS.slice();
  state.flags = state.flags || {};
  var selectedRoute = null;
  function routeVisible(r) { return state.cats.indexOf(ROUTE_CAT.id) >= 0 && passFlags(r, state.flags); }

  function placeVisible(p) {
    if (p.cat === 'chata') return true;
    if (state.cats.indexOf(p.cat) < 0) return false;
    return passFlags(p, state.flags);
  }
  function flagsOn() { return Object.keys(state.flags).some(function (k) { return state.flags[k]; }); }
  function allOn() { return ALL_CATS.every(function (id) { return state.cats.indexOf(id) >= 0; }) && !flagsOn(); }

  function buildChips() {
    var box = $('#catChips');
    box.innerHTML = '';
    var on = allOn();
    // „Vše“: když je zapnuté všechno, vypne všechno (pak stačí vybrat, co chcete); jinak zapne vše a zruší filtry
    var all = el('button', { 'class': 'chip toggle all', type: 'button', 'aria-pressed': String(on),
      title: on ? 'Vypnout vše a pak vybrat jen to, co chcete' : 'Zobrazit vše a zrušit filtry' }, on ? '✓ Vše' : 'Vše');
    all.addEventListener('click', function () {
      if (allOn()) state.cats = ['chata'];
      else { state.cats = ALL_CATS.slice(); state.flags = {}; }
      buildChips();
      applyFilters();
    });
    box.appendChild(all);
    T.cats.forEach(function (c) {
      if (c.id === 'chata') return;
      var n = T.places.filter(function (p) { return p.cat === c.id; }).length;
      var b = el('button', { 'class': 'chip', type: 'button', 'aria-pressed': String(state.cats.indexOf(c.id) >= 0), style: '--c:' + catVar(c.id), title: 'Klik: zapnout/vypnout · dvojklik: jen tato kategorie' },
        '<span class="dot">' + c.emoji + '</span>' + esc(c.name) + ' <span class="count">' + n + '</span>');
      b.addEventListener('click', function () {
        var i = state.cats.indexOf(c.id);
        if (i >= 0) state.cats.splice(i, 1); else state.cats.push(c.id);
        buildChips();
        applyFilters();
      });
      b.addEventListener('dblclick', function () {
        state.cats = ['chata', c.id];
        buildChips();
        applyFilters();
      });
      box.appendChild(b);
    });
    var rOn = state.cats.indexOf(ROUTE_CAT.id) >= 0;
    var rb = el('button', { 'class': 'chip', type: 'button', 'aria-pressed': String(rOn), style: '--c:var(--c-trasy)', title: 'Klik: zapnout/vypnout · dvojklik: jen trasy' },
      '<span class="dot">' + ROUTE_CAT.emoji + '</span>' + ROUTE_CAT.name + ' <span class="count">' + T.routes.length + '</span>');
    rb.addEventListener('click', function () {
      var i = state.cats.indexOf(ROUTE_CAT.id);
      if (i >= 0) state.cats.splice(i, 1); else state.cats.push(ROUTE_CAT.id);
      buildChips();
      applyFilters();
    });
    rb.addEventListener('dblclick', function () {
      state.cats = ['chata', ROUTE_CAT.id];
      buildChips();
      applyFilters();
    });
    box.appendChild(rb);
    var flags = $('#flagChips');
    flags.innerHTML = '';
    FLAGS.forEach(function (f) {
      var b = el('button', { 'class': 'chip toggle', type: 'button', 'aria-pressed': String(!!state.flags[f[0]]) }, f[1]);
      b.addEventListener('click', function () {
        state.flags[f[0]] = !state.flags[f[0]];
        buildChips();
        applyFilters();
      });
      flags.appendChild(b);
    });
  }

  function applyFilters() {
    store('filters4', state);
    T.places.forEach(function (p) {
      var vis = placeVisible(p);
      if (vis && !map.hasLayer(markers[p.id])) markers[p.id].addTo(map);
      if (!vis && map.hasLayer(markers[p.id])) map.removeLayer(markers[p.id]);
    });
    T.routes.forEach(function (r) {
      var vis = routeVisible(r) || selectedRoute === r.id;
      var lg = routeLayers[r.id];
      if (vis && !map.hasLayer(lg)) lg.addTo(map);
      if (!vis && map.hasLayer(lg)) map.removeLayer(lg);
    });
    renderList();
  }

  // ------------------------------------------------------------ side list
  function renderList() {
    var box = $('#mapList');
    box.innerHTML = '';
    var items = T.places.filter(placeVisible).sort(function (a, b) { return a.dist - b.dist; });
    var rts = T.routes.filter(routeVisible);
    var n = items.length - 1;   // bez chaty
    var parts = [];
    if (n > 0) parts.push(n + (n === 1 ? ' místo' : n < 5 ? ' místa' : ' míst'));
    if (rts.length) parts.push(rts.length + (rts.length === 1 ? ' trasa' : rts.length < 5 ? ' trasy' : ' tras'));
    box.appendChild(el('div', { 'class': 'list-head' }, parts.length ? 'Na mapě ' + parts.join(' a ') + (n > 0 ? ', místa od nejbližšího' : '') :
      'Nic není vybráno. Klikněte nahoře na <b>Vše</b> nebo na kategorii.'));
    items.forEach(function (p) {
      var b = el('button', { type: 'button', 'data-id': p.id, style: '--c:' + catVar(p.cat) },
        '<span class="ico">' + placeIcon(p) + '</span><span class="nm">' + esc(p.name) + (p.top ? ' ⭐' : '') + '</span><span class="dist">' + howFar(p) + '</span>');
      b.addEventListener('click', function () { ensureMapVisible(); focusPlace(p.id, false); });
      b.addEventListener('mouseenter', function () { hl(p.id, true); });
      b.addEventListener('mouseleave', function () { hl(p.id, false); });
      box.appendChild(b);
    });
    if (rts.length) {
      box.appendChild(el('div', { 'class': 'list-head sub' }, ROUTE_CAT.emoji + ' Trasy'));
      rts.forEach(function (r) {
        var b = el('button', { type: 'button', 'data-route': r.id, style: '--c:' + r.color },
          '<span class="ico">' + (r.type === 'bike' ? '🚲' : '🥾') + '</span><span class="nm">' + esc(r.name) + (r.top ? ' ⭐' : '') + '</span><span class="dist">' + fmtKm(r.km) + '</span>');
        b.addEventListener('click', function () { ensureMapVisible(); focusRoute(r.id); });
        box.appendChild(b);
      });
    }
  }
  // na mobilu je seznam pod mapou: po kliknutí posunout stránku, aby bylo vidět okno na mapě
  function ensureMapVisible() {
    var r = $('#map').getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) $('#map').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function hl(id, on) {
    var m = markers[id];
    var node = m && m.getElement && m.getElement();
    if (node) {
      var pin = node.querySelector('.pin');
      if (pin) pin.classList.toggle('hl', on);
    }
  }

  function focusPlace(id, scroll) {
    var p = PLACES[id];
    if (!p) return;
    if (!placeVisible(p)) {
      if (state.cats.indexOf(p.cat) < 0) state.cats.push(p.cat);
      state.flags = {};
      buildChips();
      applyFilters();
    }
    if (scroll) document.getElementById('mapa').scrollIntoView({ behavior: 'smooth' });
    map.flyTo([p.lat, p.lon], Math.max(map.getZoom(), p.dist > 30 ? 13 : 14), { duration: .8 });
    map.once('moveend', function () { markers[id].openPopup(); });
    $$('#mapList button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-id') === id); });
  }
  function openRoutePopup(r, latlng) {
    var pop = L.popup({ maxWidth: 280, autoPan: false }).setLatLng(latlng).setContent(routePopupHtml(r));
    pop._routeId = r.id;
    pop.openOn(map);
  }
  function focusRoute(id) {
    var r = ROUTES[id];
    if (!r) return;
    selectRoute(id);
    map.fitBounds(routeLayers[id].line.getBounds(), { padding: [30, 30], animate: false });
    var mid = r.geo[Math.floor(r.geo.length / 2)];
    openRoutePopup(r, [mid[0], mid[1]]);
    $$('#mapList button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-route') === id); });
  }

  // ------------------------------------------------------------ view buttons
  var localKm = window.innerWidth < 700 ? 6.5 : 10.5;
  var localBounds = L.latLngBounds(T.places.filter(function (p) { return p.dist < localKm; }).map(function (p) { return [p.lat, p.lon]; }));
  var allBounds = L.latLngBounds(T.places.map(function (p) { return [p.lat, p.lon]; }));
  function fitLocal() { map.fitBounds(localBounds, { padding: [24, 24] }); }
  $('#btnHome').addEventListener('click', fitLocal);
  $('#btnAll').addEventListener('click', function () { map.fitBounds(allBounds, { padding: [24, 24] }); });
  var me = null;
  $('#btnLocate').addEventListener('click', function () {
    if (!navigator.geolocation) { toast('Prohlížeč neumí zjistit polohu.'); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      var ll = [pos.coords.latitude, pos.coords.longitude];
      if (me) map.removeLayer(me);
      me = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#1f6fd1', fillOpacity: 1 }).addTo(map)
        .bindPopup('Tady jste (±' + Math.round(pos.coords.accuracy) + ' m)').openPopup();
      map.setView(ll, 15);
    }, function () { toast('Polohu se nepodařilo zjistit.'); }, { enableHighAccuracy: true, timeout: 12000 });
  });

  // ------------------------------------------------------------ route selection
  function selectRoute(id) {
    selectedRoute = id;
    T.routes.forEach(function (r) {
      var lg = routeLayers[r.id];
      var sel = r.id === selectedRoute;
      lg.line.setStyle({ weight: sel ? 6 : 4, opacity: selectedRoute && !sel ? .3 : .9 });
      lg.casing.setStyle({ weight: sel ? 10 : 7, opacity: selectedRoute && !sel ? .3 : .85 });
      if (sel) { lg.addTo(map); lg.casing.bringToFront(); lg.line.bringToFront(); }
    });
    applyFilters();
  }
  function showRouteOnMap(id) {
    document.getElementById('mapa').scrollIntoView({ behavior: 'smooth' });
    focusRoute(id);
  }
  // zavření bubliny vybrané trasy zruší její zvýraznění
  map.on('popupclose', function (e) {
    if (!selectedRoute || !e.popup || e.popup._routeId !== selectedRoute) return;
    selectedRoute = null;
    T.routes.forEach(function (r) {
      routeLayers[r.id].line.setStyle({ weight: 4, opacity: .9 });
      routeLayers[r.id].casing.setStyle({ weight: 7, opacity: .85 });
    });
    applyFilters();
  });

  // ------------------------------------------------------------ výškový profil
  var SURF = [
    ['asfalt', 'asfalt', '#6c7a89'],
    ['zpevnene', 'zpevněná cesta', '#c9a227'],
    ['nezpevnene', 'lesní/polní cesta', '#8d6e4a'],
    ['pesina', 'pěšina', '#2d8650']
  ];
  function profileSvg(r) {
    var W = 600, H = 96, padB = 3, padT = 6;
    var ele = r.geo.map(function (g) { return g[2]; });
    var min = Math.min.apply(null, ele), max = Math.max.apply(null, ele);
    var span = Math.max(max - min, 60);
    var lo = min - span * .08, hi = lo + span * 1.16;
    var total = r.cum[r.cum.length - 1] || 1;
    function x(d) { return W * d / total; }
    function y(e) { return padT + (H - padT - padB) * (1 - (e - lo) / (hi - lo)); }
    var line = '';
    r.geo.forEach(function (g, i) { line += (i ? 'L' : 'M') + x(r.cum[i]).toFixed(1) + ',' + y(g[2]).toFixed(1); });
    var area = line + 'L' + x(total).toFixed(1) + ',' + (H - padB) + 'L0,' + (H - padB) + 'Z';
    var s = '<svg class="profile" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Výškový profil: ' + Math.round(min) + '–' + Math.round(max) + ' m n. m.">';
    s += '<line class="grid" x1="0" x2="' + W + '" y1="' + y(max).toFixed(1) + '" y2="' + y(max).toFixed(1) + '"/>';
    s += '<line class="grid" x1="0" x2="' + W + '" y1="' + y(min).toFixed(1) + '" y2="' + y(min).toFixed(1) + '"/>';
    s += '<path class="area" d="' + area + '"/><path class="line" d="' + line + '"/>';
    s += '<line class="cursor" x1="-10" x2="-10" y1="0" y2="' + H + '" visibility="hidden"/></svg>';
    s += '<span class="ax top">' + Math.round(max) + ' m</span><span class="ax bot">' + Math.round(min) + ' m</span>' +
      '<span class="ax x0">0</span><span class="ax x1">' + fmtKm(total) + '</span>';
    return { svg: s, x: x, W: W, total: total };
  }
  function sparkSvg(r) {
    var W = 300, H = 40, n = r.geo.length, step = Math.max(1, Math.floor(n / 120));
    var ele = r.geo.map(function (g) { return g[2]; });
    var min = Math.min.apply(null, ele), max = Math.max.apply(null, ele), span = Math.max(max - min, 80);
    var total = r.cum[n - 1] || 1, d = '';
    for (var i = 0; i < n; i += step) d += (d ? 'L' : 'M') + (W * r.cum[i] / total).toFixed(1) + ',' + (3 + (H - 6) * (1 - (ele[i] - min) / span)).toFixed(1);
    d += 'L' + W + ',' + (3 + (H - 6) * (1 - (ele[n - 1] - min) / span)).toFixed(1);
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><path class="area" d="' + d + 'L' + W + ',' + H + 'L0,' + H + 'Z"/><path class="line" d="' + d + '"/></svg>';
  }
  function bindProfile(root, r, geom, lmap) {
    var svg = root.querySelector('svg.profile');
    var cursor = svg.querySelector('.cursor');
    var tip = root.querySelector('.profile-tip');
    var dot = hoverDot();
    function move(ev) {
      var rect = svg.getBoundingClientRect();
      var px = (ev.clientX - rect.left) / rect.width * geom.W;
      var d = Math.max(0, Math.min(geom.total, px / geom.W * geom.total));
      var lo = 0, hi = r.cum.length - 1;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (r.cum[mid] < d) lo = mid; else hi = mid; }
      var i = (d - r.cum[lo] < r.cum[hi] - d) ? lo : hi;
      var g = r.geo[i];
      var cx = geom.x(r.cum[i]);
      cursor.setAttribute('x1', cx); cursor.setAttribute('x2', cx); cursor.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.style.left = 'calc(34px + (100% - 34px) * ' + (cx / geom.W).toFixed(4) + ')';
      tip.textContent = fmtKm(r.cum[i]) + ' · ' + Math.round(g[2]) + ' m';
      dot.setLatLng([g[0], g[1]]);
      if (lmap && !lmap.hasLayer(dot)) dot.addTo(lmap);
    }
    function leave() {
      cursor.setAttribute('visibility', 'hidden');
      tip.hidden = true;
      if (lmap && lmap.hasLayer(dot)) lmap.removeLayer(dot);
    }
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', leave);
  }

  // ------------------------------------------------------------ okno s detailem (modal)
  var modal = $('#modal'), sheet = $('#modalSheet');
  var cur = null, pushed = false, ctxList = null, lastFocus = null, mini = null;
  var LEVEL = { easy: 'lehká', medium: 'střední', hard: 'náročná' };

  function parseHash(h) {
    var m = /^#(misto|trasa)\/([\w-]+)$/.exec(h || '');
    if (m) return { kind: m[1] === 'misto' ? 'place' : 'route', id: m[2] };
    m = /^#place-([\w-]+)$/.exec(h || '');   // starší odkazy
    return m ? { kind: 'place', id: m[1] } : null;
  }
  function hrefFor(kind, id) { return kind === 'place' ? placeHref(id) : routeHref(id); }

  function barHtml() {
    var h = '<div class="m-bar">';
    var pos = ctxList && cur ? ctxList.indexOf(hrefFor(cur.kind, cur.id)) : -1;
    if (pos >= 0 && ctxList.length > 1) {
      h += '<button type="button" class="m-btn" data-act="prev" aria-label="Předchozí tip"' + (pos === 0 ? ' disabled' : '') + '>‹</button>' +
        '<span class="m-pos">' + (pos + 1) + ' / ' + ctxList.length + '</span>' +
        '<button type="button" class="m-btn" data-act="next" aria-label="Další tip"' + (pos === ctxList.length - 1 ? ' disabled' : '') + '>›</button>';
    }
    h += '<span class="m-sp"></span><button type="button" class="m-btn" data-act="share" aria-label="Sdílet odkaz" title="Sdílet odkaz">🔗</button>' +
      '<button type="button" class="m-btn m-close" data-act="close" aria-label="Zavřít" title="Zavřít (Esc)">✕</button></div>';
    return h;
  }

  function nearby(p, cats, maxKm, n) {
    return T.places.filter(function (q) { return q.id !== p.id && cats.indexOf(q.cat) >= 0; })
      .map(function (q) { return { q: q, d: hav(p, q) }; })
      .filter(function (x) { return x.d <= maxKm; })
      .sort(function (a, b) { return a.d - b.d; })
      .slice(0, n)
      .map(function (x) { return x.q.id; });
  }

  // co o místě píše web mlýna (stránka Tipy na výlet)
  function millNote(p) {
    return '<div class="m-note mill"><b>🌾 Doporučuje mlýn:</b> ' + esc(p.mill) + ' ' +
      extLink(MILL_TIPS, 'mlyn-vikinek.cz', 'lk-inline') + '</div>';
  }
  function placeModalHtml(p) {
    var c = CATS[p.cat];
    var h = barHtml();
    if (p.img) {
      h += '<figure class="m-ph"><img src="' + esc(p.img.src) + '" alt="' + esc(p.name) + '">' +
        '<figcaption>Foto: <a href="' + esc(p.img.page) + '" target="_blank" rel="noopener">' + esc(p.img.author) + '</a>, ' + esc(p.img.license) + '</figcaption></figure>';
    } else {
      h += '<div class="m-ph m-emo" aria-hidden="true"><span>' + placeIcon(p) + '</span></div>';
    }
    h += '<div class="m-body"><div class="m-cat">' + c.emoji + ' ' + esc(placeLabel(p)) + '</div>' +
      '<h3 id="modalTitle">' + esc(p.name) + '</h3>';
    var badges = '';
    if (p.top) badges += '<span class="badge top">⭐ top tip</span>';
    if (p.mill) badges += '<span class="badge mill">🌾 tip mlýna</span>';
    (p.tags || []).forEach(function (t) { if (TAGS[t]) badges += '<span class="badge">' + TAGS[t][0] + ' ' + esc(TAGS[t][2]) + '</span>'; });
    if (badges) h += '<div class="badges">' + badges + '</div>';
    h += '<p class="m-lead">' + esc(p.teaser) + '</p>';
    h += linksHtml(p, 'links m-links');
    var fk = fitKeys(p);
    if (fk.length) h += '<div class="m-fit"><b>Hodí se:</b> ' + fk.map(function (k) { return '<span class="fit fit-' + k + '">' + FIT[k][0] + ' ' + esc(FIT[k][2]) + '</span>'; }).join('') + '</div>';
    var acc = accessRows(p);
    if (acc.length) {
      h += '<dl class="m-access">' + acc.map(function (a) {
        return '<div><dt>' + a[0] + ' ' + a[1] + '</dt><dd>' + esc(a[2]) + '</dd></div>';
      }).join('') + '</dl>';
    }
    if (p.text) h += '<p>' + esc(p.text) + '</p>';
    if (p.mill) h += millNote(p);
    if (p.kidsNote) h += '<div class="m-note kids">🧒 ' + esc(p.kidsNote) + '</div>';
    if (p.info) h += '<div class="m-note info">ℹ️ ' + esc(p.info) + '</div>';
    // souvislosti: program, trasy, okolí
    var inDays = T.program.days.filter(function (d) {
      return (d.tips || []).concat(d.rain || [], d.alt || []).indexOf(p.id) >= 0;
    }).map(function (d) { return '<a href="#day-' + d.id + '" data-act="day">' + esc(d.label) + '</a>'; });
    if (inDays.length) h += '<div class="m-rel"><b>📅 Nápad na den:</b> ' + inDays.join(', ') + '</div>';
    var onRoutes = T.routes.filter(function (r) { return (r.stops || []).indexOf(p.id) >= 0; }).map(function (r) { return r.id; });
    if (onRoutes.length) h += '<div class="m-rel"><b>Po cestě na trase:</b><div class="chips-row">' + linkChips(onRoutes, 'route') + '</div></div>';
    if (p.id !== 'mlyn') {
      var sights = nearby(p, TOUR_CATS, 4, 4);
      if (sights.length) h += '<div class="m-rel"><b>🧭 Kousek odtud:</b><div class="chips-row">' + linkChips(sights, 'place') + '</div></div>';
      if (FOOD_CATS.indexOf(p.cat) < 0 && p.cat !== 'sluzby') {
        var food = nearby(p, ['jidlo'], 6, 3);
        if (food.length) h += '<div class="m-rel"><b>🍽️ Najíst se poblíž:</b><div class="chips-row">' + linkChips(food, 'place') + '</div></div>';
      }
    }
    h += '</div><div class="m-actions">' +
      '<button type="button" class="btn primary" data-act="map">🗺️ Na mapě</button>' +
      '<a class="btn" href="' + googleNav(p) + '" target="_blank" rel="noopener">🧭 Navigovat</a>';
    if (p.phone) h += '<a class="btn" href="tel:' + esc(p.phone.replace(/\s/g, '')) + '">📞 ' + esc(p.phone.replace(/^\+420\s?/, '')) + '</a>';
    h += '</div>';
    return h;
  }

  // okno „Mlýn Vikinek“: jednoduché shrnutí – adresa, navigace do všech aplikací, kontakt a web
  function copyBtn(text, what) {
    return '<button type="button" class="copy" data-act="copy" data-copy="' + esc(text) + '" title="Zkopírovat ' + what + '" aria-label="Zkopírovat ' + what + '">📋</button>';
  }
  function millModalHtml(p) {
    var c = T.chata, gps = p.lat.toFixed(5) + ', ' + p.lon.toFixed(5);
    var drive = (T.fromCities || []).map(function (o) {
      return '<li>' + extLink(homeRoute(o), esc(o.from), '') + '<span class="num">' + fmtMin(o.min) + ' · ' + o.km + ' km</span></li>';
    }).join('');
    var h = barHtml() + '<div class="m-rhead m-mill"><div class="m-cat">🏠 Naše chata</div>' +
      '<h3 id="modalTitle">' + esc(p.name) + '</h3><p class="m-lead">' + esc(p.teaser) + '</p></div><div class="m-body">';
    h += '<dl class="mill-kv">' +
      '<div><dt>📍 Adresa</dt><dd>' + esc(c.address) + copyBtn(c.address, 'adresu') + '</dd></div>' +
      '<div><dt>🛰️ GPS</dt><dd><span class="num">' + gps + '</span>' + copyBtn(gps, 'souřadnice') + ' <span class="muted">· 675 m n. m.</span></dd></div>' +
      (c.stay ? '<div><dt>🗓️ Pobyt</dt><dd>' + esc(c.stay) + '</dd></div>' : '') +
      '<div><dt>📞 Kontakt</dt><dd><a href="tel:+420602768375">602 768 375</a> · <a href="mailto:info@mlyn-vikinek.cz">info@mlyn-vikinek.cz</a></dd></div>' +
      '<div><dt>🌐 Web</dt><dd>' + extLink(p.web, 'mlyn-vikinek.cz', '') + ' · ' + extLink('https://mlyn-vikinek.cz/galerie/', 'fotky mlýna', '') + '</dd></div>' +
      '</dl>';
    h += '<div class="navapps"><b>🧭 Navigovat autem</b>' + navAppsHtml(p) +
      (drive ? '<p class="small muted drive-h">Cesta autem bez provozu, klik ukáže trasu s aktuální dopravou:</p><ul class="drive-list">' + drive + '</ul>' : '') + '</div>';
    h += '</div><div class="m-actions"><button type="button" class="btn primary" data-act="map">🗺️ Na mapě</button>' +
      '<a class="btn" href="#chata-info" data-act="day">ℹ️ Víc o mlýně</a></div>';
    return h;
  }

  function routeModalHtml(r) {
    var geom = profileSvg(r);
    var h = barHtml();
    h += '<div class="m-rhead"><div class="m-cat">' + (r.type === 'bike' ? '🚲 na kolo' : '🥾 pěšky') + (r.loop ? ' · okruh' : '') +
      ' · <span class="level ' + r.level + '">' + LEVEL[r.level] + '</span></div>' +
      '<h3 id="modalTitle">' + esc(r.name) + '</h3><p class="m-lead">' + esc(r.teaser) + '</p>' + routeLinksHtml(r, 'links m-links') +
      (r.who ? '<div class="m-fit"><b>Pro koho:</b> ' + esc(r.who) + '</div>' : '') + '</div>';
    h += '<div class="m-body">';
    h += '<div class="stats"><div class="stat"><b>' + fmtKm(r.km) + '</b><span>délka</span></div>' +
      '<div class="stat"><b>↑ ' + r.up + ' m</b><span>stoupání</span></div>' +
      '<div class="stat"><b>' + fmtDur(r.minKids) + '</b><span>s dětmi bez zastávek</span></div>' +
      '<div class="stat"><b>' + r.maxEle + ' m</b><span>nejvýš n. m.</span></div></div>';
    h += '<div class="m-map" aria-label="Mapa trasy"></div>';
    h += '<div class="profile-wrap">' + geom.svg + '<span class="profile-tip" hidden></span></div>';
    var sb = '', sl = '';
    SURF.forEach(function (s) {
      var km = r.surface[s[0]] || 0;
      if (km < .05) return;
      var pct = km / r.km * 100;
      sb += '<i style="width:' + pct.toFixed(1) + '%;background:' + s[2] + '"></i>';
      sl += '<span><i style="background:' + s[2] + '"></i>' + s[1] + ' ' + Math.round(pct) + ' %</span>';
    });
    var roadsInfo = '';
    if (r.busy >= .3) roadsInfo += '<span>⚠️ silnice II. tř. ' + fmtKm(r.busy) + '</span>';
    if (r.roads - r.busy >= .3) roadsInfo += '<span>🚗 silničky III. tř. ' + fmtKm(r.roads - r.busy) + '</span>';
    h += '<div class="surface-bar" title="Povrch">' + sb + '</div><div class="surface-legend">' + sl + roadsInfo + '</div>';
    h += '<p>' + esc(r.text) + '</p>';
    if (r.tip) h += '<div class="m-note kids">💡 ' + esc(r.tip) + '</div>';
    h += '<div class="m-note info">📍 Start: ' + esc(r.start || (r.loop ? 'od mlýna (okruh)' : 'od mlýna')) + '</div>';
    if (r.stops && r.stops.length) h += '<div class="m-rel"><b>Po cestě:</b><div class="chips-row">' + linkChips(r.stops, 'place') + '</div></div>';
    h += '</div><div class="m-actions">' +
      '<button type="button" class="btn primary" data-act="route-map">🗺️ Na velké mapě</button>' +
      '<a class="btn" href="' + esc(r.gpx) + '" download>⬇ GPX</a>' +
      '<a class="btn" href="' + esc(r.mapy) + '" target="_blank" rel="noopener">Mapy.com</a></div>';
    return { html: h, geom: geom };
  }

  function destroyMini() {
    if (mini) { mini.remove(); mini = null; }
  }
  function initRouteMap(r, geom) {
    var box = sheet.querySelector('.m-map');
    if (!box) return;
    mini = L.map(box, { scrollWheelZoom: false, zoomSnap: .25 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mini);
    var ll = r.geo.map(function (g) { return [g[0], g[1]]; });
    L.polyline(ll, { color: '#fff', weight: 7, opacity: .9, interactive: false }).addTo(mini);
    var line = L.polyline(ll, { color: r.color, weight: 4, dashArray: r.type === 'hike' ? '9 7' : null, interactive: false }).addTo(mini);
    (r.stops || []).forEach(function (id) {
      var p = PLACES[id];
      if (p) L.marker([p.lat, p.lon], { icon: iconFor(p, true), title: p.name, keyboard: false }).addTo(mini)
        .bindTooltip(esc(p.name), { direction: 'top', offset: [0, -24] });
    });
    L.marker([MILL.lat, MILL.lon], { icon: iconFor(PLACES.mlyn, true), title: 'Mlýn Vikinek', keyboard: false }).addTo(mini);
    L.circleMarker(ll[0], { radius: 7, color: '#fff', weight: 3, fillColor: r.color, fillOpacity: 1 }).addTo(mini).bindTooltip('Start');
    mini.fitBounds(line.getBounds(), { padding: [18, 18] });
    bindProfile(sheet, r, geom, mini);
    setTimeout(function () { if (mini) { mini.invalidateSize(); mini.fitBounds(line.getBounds(), { padding: [18, 18] }); } }, 250);
  }

  function showModal(kind, id) {
    var item = kind === 'place' ? PLACES[id] : ROUTES[id];
    if (!item) return false;
    destroyMini();
    cur = { kind: kind, id: id };
    var route = null;
    if (kind === 'place') sheet.innerHTML = id === 'mlyn' ? millModalHtml(item) : placeModalHtml(item);
    else { route = routeModalHtml(item); sheet.innerHTML = route.html; }
    sheet.className = 'sheet ' + (kind === 'place' ? 'is-place' : 'is-route') + (id === 'mlyn' ? ' is-mill' : '');
    sheet.style.setProperty('--c', kind === 'place' ? catVar(item.cat) : item.color);
    sheet.style.setProperty('--rc', kind === 'route' ? item.color : '');
    if (!modal.open) {
      lastFocus = document.activeElement;
      if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
      document.documentElement.classList.add('modal-open');
    }
    sheet.scrollTop = 0;
    if (route) initRouteMap(item, route.geom);
    var x = sheet.querySelector('.m-close');
    if (x) x.focus({ preventScroll: true });
    document.title = item.name + ' · Vysočina 2026';
    return true;
  }
  function hideModal() {
    destroyMini();
    if (modal.open) { if (typeof modal.close === 'function') modal.close(); else modal.removeAttribute('open'); }
    document.documentElement.classList.remove('modal-open');
    document.title = 'Vysočina 2026 · Mlýn Vikinek';
    var had = !!cur;
    cur = null; pushed = false;
    if (had && lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  function openItem(kind, id) {
    var h = hrefFor(kind, id);
    if (location.hash !== h) {
      if (modal.open) history.replaceState({ m: 1 }, '', h);
      else { history.pushState({ m: 1 }, '', h); pushed = true; }
    }
    showModal(kind, id);
  }
  function baseUrl(hash) { return location.pathname + location.search + (hash || ''); }
  function closeModal(toHash) {
    if (!modal.open) return;
    if (toHash) { history.replaceState(null, '', baseUrl(toHash)); hideModal(); return; }
    if (pushed) { history.back(); return; }   // popstate modal zavře
    history.replaceState(null, '', baseUrl());
    hideModal();
  }
  function syncFromHash() {
    var s = parseHash(location.hash);
    if (s) {
      if (!cur || cur.kind !== s.kind || cur.id !== s.id) showModal(s.kind, s.id);
    } else if (modal.open) hideModal();
  }
  window.addEventListener('popstate', syncFromHash);
  window.addEventListener('hashchange', syncFromHash);

  function step(dir) {
    if (!ctxList || !cur) return;
    var i = ctxList.indexOf(hrefFor(cur.kind, cur.id)) + dir;
    if (i < 0 || i >= ctxList.length) return;
    var s = parseHash(ctxList[i]);
    if (s) openItem(s.kind, s.id);
  }

  // odkazy #misto/… a #trasa/… kdekoli na stránce otevírají okno
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#misto/"], a[href^="#trasa/"]');
    if (!a || e.defaultPrevented || e.button > 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    var s = parseHash(a.getAttribute('href'));
    if (!s) return;
    e.preventDefault();
    var list = a.closest('[data-list]');
    if (list) ctxList = $$('a[href^="#misto/"], a[href^="#trasa/"]', list).map(function (x) { return x.getAttribute('href'); });
    else if (!modal.contains(a)) ctxList = null;
    else if (ctxList && ctxList.indexOf(a.getAttribute('href')) < 0) ctxList = null;
    openItem(s.kind, s.id);
  });
  sheet.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'close') closeModal();
    else if (act === 'prev') step(-1);
    else if (act === 'next') step(1);
    else if (act === 'share') {
      var url = location.href;
      if (navigator.share) navigator.share({ title: document.title, url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast('Odkaz zkopírován'); });
    } else if (act === 'copy') {
      var txt = b.getAttribute('data-copy');
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('Zkopírováno: ' + txt); }, function () { toast(txt); });
      else toast(txt);
    } else if (act === 'map' && cur) {
      var pid = cur.id;
      closeModal('#mapa');
      focusPlace(pid, true);
    } else if (act === 'route-map' && cur) {
      var rid = cur.id;
      closeModal('#mapa');
      showRouteOnMap(rid);
    } else if (act === 'day') {
      e.preventDefault();
      var target = b.getAttribute('href');
      closeModal(target);
      var d = document.querySelector(target);
      if (d) {
        if (d.tagName === 'DETAILS') d.open = true;
        d.scrollIntoView({ behavior: 'smooth', block: 'start' });
        d.classList.add('flash');
        setTimeout(function () { d.classList.remove('flash'); }, 1800);
      }
    }
  });
  modal.addEventListener('cancel', function (e) { e.preventDefault(); closeModal(); });
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  modal.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('.m-map')) return;
    if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });

  // ------------------------------------------------------------ dlaždice
  function tileHtml(p, big) {
    var ph = p.img ? '<img src="' + esc(p.img.thumb || p.img.src) + '" alt="" loading="lazy" decoding="async">' : '<span class="emo">' + placeIcon(p) + '</span>';
    // karta: hlavní odkaz otevře okno s detailem, pod ním odkazy na web a do map
    return '<div class="tile' + (big ? ' big' : '') + (p.top ? ' is-top' : '') + '" style="--c:' + catVar(p.cat) + '">' +
      '<a class="tile-main" href="' + placeHref(p.id) + '">' +
      '<span class="tile-ph">' + ph + (p.top && !big ? '<span class="star" title="top tip">★</span>' : '') + '</span>' +
      '<span class="tile-body"><span class="tile-cat">' + CATS[p.cat].emoji + ' ' + esc(placeLabel(p)) +
      (p.mill ? '<span class="tile-mill" title="Doporučuje i web mlýna">🌾 tip mlýna</span>' : '') + '</span>' +
      '<span class="tile-name">' + esc(p.name) + '</span>' +
      '<span class="tile-teaser">' + esc(p.teaser) + '</span>' +
      '<span class="tile-fits">' + fitChips(p) + '</span>' +
      '<span class="tile-meta">' + howFar(p) + '</span></span></a>' + linksHtml(p, 'links tile-links') + '</div>';
  }
  function gtileHtml(p) {
    var tags = (p.mill ? '<span class="tag mill" title="Doporučuje i web mlýna">🌾 tip mlýna</span>' : '') +
      (p.tags || []).filter(function (t) { return TAGS[t]; }).map(function (t) {
        return '<span class="tag" title="' + esc(TAGS[t][2]) + '">' + TAGS[t][0] + ' ' + esc(TAGS[t][1]) + '</span>';
      }).join('');
    return '<div class="gtile" style="--c:' + catVar(p.cat) + '"><a class="g-main" href="' + placeHref(p.id) + '">' +
      '<span class="g-ico">' + (p.img ? '<img src="' + esc(p.img.thumb || p.img.src) + '" alt="" loading="lazy" decoding="async">' : placeIcon(p)) + '</span>' +
      '<span class="g-body"><span class="g-name">' + (p.top ? '<span class="star-s" title="top tip">★</span> ' : '') + esc(p.name) + '</span>' +
      '<span class="g-where">' + (p.town ? esc(p.town) + ' · ' : '') + howFar(p) + '</span>' +
      '<span class="g-teaser">' + esc(p.teaser) + '</span>' +
      (tags ? '<span class="g-tags">' + tags + '</span>' : '') + '</span></a>' + linksHtml(p, 'links g-links') + '</div>';
  }
  function rtileHtml(r) {
    return '<div class="rtile" style="--rc:' + r.color + '" data-type="' + r.type + '"><a class="rt-main" href="' + routeHref(r.id) + '">' +
      '<span class="rt-top"><span class="rt-type">' + (r.type === 'bike' ? '🚲 na kolo' : '🥾 pěšky') + (r.loop ? ' · okruh' : '') + '</span>' +
      '<span class="level ' + r.level + '">' + LEVEL[r.level] + '</span></span>' +
      '<span class="rt-name">' + esc(r.name) + '</span>' +
      '<span class="rt-stats"><b>' + fmtKm(r.km) + '</b><span>↑ ' + r.up + ' m</span><span>⏱ ' + fmtDur(r.minKids) + '</span></span>' +
      sparkSvg(r) +
      '<span class="tile-teaser">' + esc(r.teaser) + '</span>' +
      '<span class="rt-kids">🧒 ' + esc(r.who || '') + '</span></a>' + routeLinksHtml(r, 'links tile-links rt-links') + '</div>';
  }

  // ------------------------------------------------------------ to nejlepší
  (function highlights() {
    var box = $('#highlights');
    (T.highlights || []).forEach(function (id) {
      var p = PLACES[id];
      if (p) box.insertAdjacentHTML('beforeend', tileHtml(p, true));
    });
  })();

  // ------------------------------------------------------------ rozbalovací skupiny (vše pod mapou)
  function makeAcc(o) {
    var d = el('details', { 'class': 'acc', style: '--c:' + (o.color || 'var(--forest)') });
    if (o.id) d.id = o.id;
    d.innerHTML = '<summary><span class="acc-dot">' + o.emoji + '</span><span class="acc-main"><span class="acc-title"></span>' +
      '<span class="acc-prev"></span></span><span class="acc-chev" aria-hidden="true"></span></summary><div class="acc-body"></div>';
    var body = d.querySelector('.acc-body');
    d.setHead = function (title, count, preview) {
      d.querySelector('.acc-title').innerHTML = esc(title) + (count != null ? ' <span class="acc-n">' + count + '</span>' : '');
      d.querySelector('.acc-prev').innerHTML = preview || (count === 0 ? 'S vybranými štítky tu nic není.' : '');
      d.classList.toggle('is-empty', count === 0);
    };
    d.setHead(o.title, o.count, o.preview);
    d.dirty = true;
    if (o.html != null) { body.innerHTML = o.html; d.dirty = false; }
    // obsah (a fotky) se vykreslí až při prvním rozbalení
    d.addEventListener('toggle', function () {
      if (d.open && d.dirty && o.render) { o.render(body); d.dirty = false; }
    });
    d.refresh = function () {
      if (d.open && o.render) { o.render(body); d.dirty = false; } else if (o.render) d.dirty = true;
    };
    return d;
  }
  function previewNames(items, max) {
    max = max || 6;
    var names = items.slice(0, max).map(function (x) { return (x.top ? '★ ' : '') + x.name; });
    return esc(names.join(' · ')) + (items.length > max ? ' …' : '');
  }

  // ------------------------------------------------------------ nápady po dnech
  (function days() {
    var box = $('#days');
    function item(x) {
      if (x.indexOf('route:') === 0) {
        var r = ROUTES[x.slice(6)];
        if (!r) return '';
        return '<li><a href="' + routeHref(r.id) + '"><span class="d" style="--c:' + r.color + '">' + (r.type === 'bike' ? '🚲' : '🥾') + '</span>' +
          '<span>' + esc(r.name) + ' <span class="muted">· ' + fmtKm(r.km) + '</span></span></a></li>';
      }
      var p = PLACES[x];
      if (!p) return '';
      return '<li><a href="' + placeHref(p.id) + '"><span class="d" style="--c:' + catVar(p.cat) + '">' + placeIcon(p) + '</span>' +
        '<span>' + esc(p.name) + (p.top ? ' <span class="star-s" title="top tip">★</span>' : '') + '</span></a></li>';
    }
    function name(x) {
      var o = x.indexOf('route:') === 0 ? ROUTES[x.slice(6)] : PLACES[x];
      return o ? o.name : '';
    }
    T.program.days.forEach(function (d) {
      var h = (d.note ? '<p class="daynote">' + esc(d.note) + '</p>' : '') +
        '<ul class="daylist" data-list="day-' + d.id + '">' + (d.tips || []).map(item).join('') + '</ul>';
      if (d.rain && d.rain.length) h += '<div class="dayalt"><b>☔ Když prší</b><ul class="daylist">' + d.rain.map(item).join('') + '</ul></div>';
      if (d.alt && d.alt.length) h += '<div class="dayalt"><b>↪ ' + esc(d.altLabel || 'Jiná možnost') + '</b><ul class="daylist">' + d.alt.map(item).join('') + '</ul></div>';
      box.appendChild(makeAcc({ id: 'day-' + d.id, emoji: '📅', color: 'var(--accent)', title: d.label + ' · ' + d.title,
        preview: esc((d.tips || []).map(name).join(' · ')), html: h }));
    });
  })();

  // ------------------------------------------------------------ výlety a místa
  (function placesSection() {
    var flagBox = $('#placeFlags'), box = $('#places');
    var st = store('placeTab4') || {};
    st.flags = st.flags || {};
    var pool = T.places.filter(function (p) { return TOUR_CATS.indexOf(p.cat) >= 0; });
    function list(id) {
      return pool.filter(function (p) { return p.cat === id && passFlags(p, st.flags); })
        .sort(function (a, b) { return (b.top ? 1 : 0) - (a.top ? 1 : 0) || a.dist - b.dist; });
    }
    var accs = {};
    TOUR_CATS.forEach(function (id) {
      accs[id] = makeAcc({ id: 'cat-' + id, emoji: CATS[id].emoji, color: catVar(id), title: CATS[id].name, render: function (body) {
        var items = list(id);
        body.innerHTML = items.length ? '<div class="tiles" data-list="places-' + id + '">' + items.map(function (p) { return tileHtml(p); }).join('') + '</div>' :
          '<p class="muted">S vybranými štítky tu nic není.</p>';
      } });
      box.appendChild(accs[id]);
    });
    function update() {
      store('placeTab4', st);
      TOUR_CATS.forEach(function (id) {
        var items = list(id);
        accs[id].setHead(CATS[id].name, items.length, previewNames(items));
        accs[id].refresh();
      });
      $$('button', flagBox).forEach(function (b) { b.setAttribute('aria-pressed', String(!!st.flags[b.getAttribute('data-v')])); });
    }
    FLAGS.forEach(function (f) {
      var b = el('button', { 'class': 'chip toggle flag', type: 'button', 'data-v': f[0] }, f[1]);
      b.addEventListener('click', function () { st.flags[f[0]] = !st.flags[f[0]]; update(); });
      flagBox.appendChild(b);
    });
    update();
  })();

  // ------------------------------------------------------------ jídlo, kavárny a farmy
  (function gastro() {
    var box = $('#gastro');
    (T.gastro || []).forEach(function (g) {
      var items = T.places.filter(function (p) { return p.cat === g.cat && (p.sub || '') === g.id; })
        .sort(function (a, b) { return (a.order != null ? a.order : 99) - (b.order != null ? b.order : 99) || a.dist - b.dist; });
      if (!items.length) return;
      box.appendChild(makeAcc({ id: 'g-' + g.id, emoji: g.emoji, color: catVar(g.cat), title: g.name, count: items.length,
        preview: previewNames(items), render: function (body) {
          body.innerHTML = (g.desc ? '<p class="muted gdesc">' + esc(g.desc) + '</p>' : '') +
            '<div class="gtiles" data-list="g-' + g.id + '">' + items.map(gtileHtml).join('') + '</div>';
        } }));
    });
  })();

  // ------------------------------------------------------------ trasy
  (function routes() {
    var box = $('#routes');
    [['bike', '🚲', 'Na kolo'], ['hike', '🥾', 'Pěšky']].forEach(function (t) {
      var items = T.routes.filter(function (r) { return r.type === t[0]; });
      var prev = esc(items.slice(0, 6).map(function (r) { return (r.top ? '★ ' : '') + r.name + ' (' + fmtKm(r.km) + ')'; }).join(' · ')) + (items.length > 6 ? ' …' : '');
      box.appendChild(makeAcc({ id: 'r-' + t[0], emoji: t[1], color: t[0] === 'bike' ? '#1f6fd1' : '#e8590c', title: t[2], count: items.length, preview: prev,
        render: function (body) {
          body.innerHTML = '<div class="tiles routes" data-list="routes-' + t[0] + '">' + items.map(rtileHtml).join('') + '</div>';
        } }));
    });
  })();

  // ------------------------------------------------------------ chata
  (function chata() {
    var m = PLACES.mlyn;
    var box = $('#chataBox');
    var c = T.chata;
    var left = '<p>' + esc(m.text) + '</p><dl class="kv">' +
      '<dt>Adresa</dt><dd>' + esc(c.address) + ' · <a href="' + placeHref('mlyn') + '">🧭 navigace</a></dd>' +
      '<dt>GPS</dt><dd><button type="button" class="btn small" id="copyGps">' + MILL.lat.toFixed(5) + ' N, ' + MILL.lon.toFixed(5) + ' E 📋</button></dd>' +
      '<dt>Kontakt</dt><dd><a href="tel:+420602768375">+420 602 768 375</a> · <a href="mailto:info@mlyn-vikinek.cz">info@mlyn-vikinek.cz</a></dd>' +
      '<dt>Kapacita</dt><dd>' + esc(c.capacity) + '</dd>' +
      (c.checkin ? '<dt>Příjezd</dt><dd>' + esc(c.checkin) + '</dd>' : '') +
      '<dt>Vybavení</dt><dd>' + esc(c.amenities) + '</dd>' +
      '<dt>Web</dt><dd><a href="https://mlyn-vikinek.cz/" target="_blank" rel="noopener">mlyn-vikinek.cz</a> · <a href="https://mlyn-vikinek.cz/galerie/" target="_blank" rel="noopener">fotky mlýna</a></dd></dl>';
    var cities = T.fromCities || [];
    var right = '<p class="muted small">Čas jízdy autem bez provozu (trasa z OSRM, rychlosti srovnané s Google Mapami). Aktuální čas i s dopravou ukážou odkazy do map:</p><div class="drive">';
    cities.forEach(function (o) {
      right += '<div class="stat"><b>' + fmtMin(o.min) + '</b><span>' + esc(o.from) + ' · ' + o.km + ' km</span>' +
        '<span class="stat-links">' + extLink(homeRoute(o), 'Google Mapy', '') + ' · ' + extLink(homeRoute(o, true), 'Mapy.com', '') + '</span></div>';
    });
    right += '</div><h4 class="svc-h">🧭 Navigovat k mlýnu</h4>' + navAppsHtml(m) +
      '<div class="row"><a class="btn" href="gpx/vysocina-2026-mista.gpx" download>⬇ Všechna místa do navigace (GPX)</a></div>' +
      '<h4 class="svc-h">🛒 Nejbližší služby</h4><ul class="svc">';
    c.services.forEach(function (id) {
      var p = PLACES[id];
      if (!p) return;
      right += '<li><a href="' + placeHref(id) + '"><span class="ico" style="--c:' + catVar(p.cat) + '">' + placeIcon(p) + '</span><span class="t">' + esc(p.name) +
        '<span class="how">' + esc(p.teaser) + '</span></span><span class="dist">' + howFar(p) + '</span></a></li>';
    });
    right += '</ul>';
    box.appendChild(makeAcc({ id: 'chata-info', emoji: '🏠', color: 'var(--c-chata)', title: m.name,
      preview: esc([c.address, '16 lůžek + dětská postýlka', 'sauna, krb, zahrada s ohništěm', c.checkin].filter(Boolean).join(' · ')), html: left }));
    box.appendChild(makeAcc({ emoji: '🚗', color: 'var(--c-sluzby)', title: 'Cesta a nejbližší služby',
      preview: esc(cities.map(function (o) { return o.from + ' ' + fmtMin(o.min); }).join(' · ') + ' · obchod, lékárna, benzinka, nemocnice'), html: right }));
    // tipy z webu mlýna: místa se štítkem „tip mlýna“ po kategoriích a k tomu rady bez místa na mapě
    var mt = c.millTips;
    if (mt) {
      var tipsHtml = '<p class="muted small">' + esc(mt.intro) + ' ' + extLink(MILL_TIPS, 'Tipy na výlet na webu mlýna', 'lk-inline') + '</p>';
      var tipNames = [];
      T.cats.forEach(function (cat) {
        var items = T.places.filter(function (p) { return p.mill && p.cat === cat.id; })
          .sort(function (a, b) { return a.dist - b.dist; });
        if (!items.length) return;
        tipsHtml += '<h4 class="svc-h">' + cat.emoji + ' ' + esc(cat.name) + '</h4><ul class="svc mill-tips">' + items.map(function (p) {
          tipNames.push(p.name.replace(/\s*\(.*$/, '').split(':')[0]);
          return '<li><a href="' + placeHref(p.id) + '"><span class="ico" style="--c:' + catVar(p.cat) + '">' + placeIcon(p) + '</span><span class="t">' + esc(p.name) +
            '<span class="how">' + esc(p.mill) + '</span>' +
            (p.warn ? '<span class="how warn">⚠️ ' + esc(p.warn) + '</span>' : '') + '</span><span class="dist">' + howFar(p) + '</span></a></li>';
        }).join('') + '</ul>';
      });
      if ((mt.notes || []).length) {
        tipsHtml += '<h4 class="svc-h">💡 Další rady z webu mlýna</h4><ul class="plain mill-notes">' + mt.notes.map(function (n) {
          var p = n.place && PLACES[n.place];
          return '<li><span class="t">' + n.icon + ' ' + esc(n.text) + '</span>' +
            (p ? '<span class="how"><a href="' + placeHref(p.id) + '">' + esc(p.name) + '</a></span>' : '') +
            (n.url ? '<span class="how">' + extLink(n.url, esc(n.label || '🌐 web'), 'lk-inline') + '</span>' : '') + '</li>';
        }).join('') + '</ul>';
      }
      if (mt.skipped) tipsHtml += '<p class="small muted">' + esc(mt.skipped) + '</p>';
      box.appendChild(makeAcc({ id: 'chata-tipy', emoji: '🌾', color: 'var(--c-priroda)', title: 'Tipy od majitelů mlýna',
        preview: esc(tipNames.join(' · ')), html: tipsHtml }));
    }
    $('#copyGps').addEventListener('click', function (e) {
      var t = MILL.lat.toFixed(5) + ', ' + MILL.lon.toFixed(5);
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { e.target.textContent = 'Zkopírováno ✓'; });
    });
  })();

  // ------------------------------------------------------------ praktické
  function checklist(key, items) {
    var done = store(key) || {};
    var ul = el('ul', { 'class': 'checklist' });
    items.forEach(function (it, i) {
      var id = it.id || key + i;
      var li = el('li', done[id] ? { 'class': 'done' } : null,
        '<input type="checkbox" id="' + id + '"' + (done[id] ? ' checked' : '') + '><label for="' + id + '"><span class="t">' + esc(it.text || it) + '</span>' +
        (it.how ? '<span class="how">' + esc(it.how) + '</span>' : '') + '</label>');
      li.querySelector('input').addEventListener('change', function (e) {
        done[id] = e.target.checked;
        li.classList.toggle('done', e.target.checked);
        store(key, done);
      });
      ul.appendChild(li);
    });
    return ul;
  }
  (function practical() {
    var box = $('#practical');
    // telefony a e-maily jako odkazy
    function linkHow(t) {
      return esc(t).replace(/(\+?\d[\d ]{7,}\d)|([\w.+-]+@[\w-]+\.[\w.]+)/g, function (m, tel, mail) {
        return tel ? '<a href="tel:' + tel.replace(/\s/g, '') + '">' + tel + '</a>' : '<a href="mailto:' + mail + '">' + mail + '</a>';
      });
    }
    var res = T.program.reservations;
    box.appendChild(makeAcc({ emoji: '📞', color: 'var(--forest)', title: 'Kam zavolat předem', count: res.length,
      preview: esc(res.map(function (r) { return r.text.split(' (')[0].split(' – ')[0].split(':')[0]; }).join(' · ')),
      html: '<ul class="plain" data-list="res">' + res.map(function (r) {
        var p = r.place && PLACES[r.place];
        var t = p ? '<a href="' + placeHref(p.id) + '">' + esc(r.text) + '</a>' : esc(r.text);
        return '<li><span class="t">' + t + '</span><span class="how">' + linkHow(r.how) +
          (p && p.web ? ' · ' + extLink(p.web, '🌐 web', 'lk-inline') : '') + '</span></li>';
      }).join('') + '</ul>' }));
    var sunRows = T.sun.map(function (s) {
      return '<tr><td>' + esc(s.label) + '</td><td>' + s.rise + '</td><td>' + s.set + '</td><td>' + s.dusk + '</td></tr>';
    }).join('');
    // živou předpověď doplní modul počasí níž (#wxDetail), zbytek je statický
    box.appendChild(makeAcc({ id: 'pocasi', emoji: '🌦️', color: 'var(--c-pamatky)', title: 'Počasí a světlo',
      preview: esc('aktuální předpověď pro mlýn · slunce zapadá kolem ' + T.sun[0].set + ' · 10. 10. novoluní, tma na hvězdy'),
      html: '<div class="wx-live" id="wxDetail"></div>' +
        '<h4 class="svc-h">Jak tu bývá a kdy je světlo</h4><p>' + esc(T.weather.text) + '</p>' +
        '<table class="sun"><thead><tr><th>Den</th><th>Východ</th><th>Západ</th><th>Tma</th></tr></thead><tbody>' + sunRows + '</tbody></table>' +
        '<p class="small" style="margin-top:10px">🌑 ' + esc(T.weather.moon) + '</p>' +
        '<h4 class="svc-h">Další předpovědi</h4><div class="row">' + T.weather.links.map(function (l) {
          return '<a class="btn small" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.name) + '</a>';
        }).join('') + '</div>' +
        '<div class="wx-windy"><button type="button" class="btn" data-wx="windy">🌀 Zobrazit mapu Windy</button>' +
        '<span class="small muted">radar, srážky a vítr v okolí, načte se až po kliknutí</span></div>' }));
    var quests = makeAcc({ emoji: '🧭', color: 'var(--c-deti)', title: 'Úkoly pro malé průzkumníky', count: (T.program.quests || []).length,
      preview: 'Kdo splní nejvíc? Lodička na pramenu, klokan v zookoutku, perníčky na skále …', html: '' });
    quests.querySelector('.acc-body').appendChild(checklist('quest', T.program.quests || []));
    box.appendChild(quests);
    var pack = makeAcc({ emoji: '🎒', color: 'var(--c-jidlo)', title: 'Co s sebou', count: T.program.packing.length,
      preview: 'Teplé a nepromokavé věci, nosítko, odrážedla, čelovky … a tísňová čísla', html: '' });
    pack.querySelector('.acc-body').appendChild(checklist('pack', T.program.packing));
    pack.querySelector('.acc-body').appendChild(el('div', { 'class': 'note', style: 'margin-top:12px' },
      '<b>Tísňová volání:</b> 112 · záchranka 155 · hasiči 150 · policie 158<br>Nemocnice: Nové Město na Moravě · lékárna o víkendu: Benu Žďár (8–20)'));
    box.appendChild(pack);
  })();

  // tlačítka „Rozbalit vše / Sbalit vše“ u sekcí
  $$('.acc-all').forEach(function (b) {
    var box = document.getElementById(b.getAttribute('data-target'));
    function sync() {
      var ds = $$('details.acc', box);
      b.textContent = ds.length && ds.every(function (d) { return d.open; }) ? 'Sbalit vše' : 'Rozbalit vše';
    }
    b.addEventListener('click', function () {
      var ds = $$('details.acc', box);
      var open = !ds.every(function (d) { return d.open; });
      ds.forEach(function (d) { d.open = open; });
      sync();
    });
    box.addEventListener('toggle', sync, true);
    sync();
  });

  // ------------------------------------------------------------ počasí (živá předpověď)
  // Při každém otevření stránky se stáhne čerstvá předpověď z Open-Meteo (zdarma a bez klíče).
  // Model je napevno ECMWF IFS HRES 9 km (stejný jako výchozí ve Windy, dny pobytu pokryje
  // celé až 15 dní dopředu), aby popisek v rohu vždycky platil a čísla šla porovnat s Windy.
  // Poslední úspěšná data si pamatuje prohlížeč a GitHub Actions je každé 3 hodiny ukládá
  // i do data/weather.json, takže bez signálu nebo při výpadku zůstane poslední známá předpověď.
  (function weather() {
    var LAT = 49.6443, LON = 15.9684, ELE = 675;
    var MODEL = { id: 'ecmwf_ifs', name: 'ECMWF IFS 9 km',
      title: 'Model ECMWF IFS HRES (Evropské centrum pro střednědobé předpovědi), rozlišení 9 km, stejný jako výchozí model ve Windy. Data přes Open-Meteo.' };
    var DATES = T.program.days.map(function (d) { return d.date; });
    var API = 'https://api.open-meteo.com/v1/forecast?latitude=' + LAT + '&longitude=' + LON + '&elevation=' + ELE + '&models=' + MODEL.id +
      '&timezone=Europe%2FPrague&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation,is_day';
    var DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,precipitation_hours,wind_gusts_10m_max,sunshine_duration,sunrise,sunset';
    var HOURLY = 'temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,is_day';
    var WINDY = 'https://www.windy.com/49.644/15.968?49.644,15.968,10';
    var WINDY_EMBED = 'https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=%C2%B0C&metricWind=km%2Fh' +
      '&zoom=9&overlay=rain&product=ecmwf&level=surface&lat=49.644&lon=15.968&detailLat=49.644&detailLon=15.968&detail=true&message=true&marker=true';
    var CLIMATE = 'Začátkem října tu bývá přes den kolem 7–13 °C a v noci 0–5 °C.';
    // kódy počasí WMO → [ikona, popis]
    var CODES = {
      0: ['☀️', 'jasno'], 1: ['🌤️', 'skoro jasno'], 2: ['⛅', 'polojasno'], 3: ['☁️', 'zataženo'],
      45: ['🌫️', 'mlha'], 48: ['🌫️', 'mlha s námrazou'],
      51: ['🌦️', 'slabé mrholení'], 53: ['🌦️', 'mrholení'], 55: ['🌧️', 'husté mrholení'], 56: ['🌧️', 'mrznoucí mrholení'], 57: ['🌧️', 'mrznoucí mrholení'],
      61: ['🌦️', 'slabý déšť'], 63: ['🌧️', 'déšť'], 65: ['🌧️', 'silný déšť'], 66: ['🌧️', 'mrznoucí déšť'], 67: ['🌧️', 'mrznoucí déšť'],
      71: ['🌨️', 'slabé sněžení'], 73: ['🌨️', 'sněžení'], 75: ['❄️', 'husté sněžení'], 77: ['🌨️', 'sněhová zrna'],
      80: ['🌦️', 'přeháňky'], 81: ['🌧️', 'přeháňky'], 82: ['⛈️', 'prudké přeháňky'], 85: ['🌨️', 'sněhové přeháňky'], 86: ['🌨️', 'sněhové přeháňky'],
      95: ['⛈️', 'bouřka'], 96: ['⛈️', 'bouřka s kroupami'], 99: ['⛈️', 'bouřka s kroupami']
    };
    var DOW = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
    var DOW_IN = ['v neděli', 'v pondělí', 'v úterý', 've středu', 've čtvrtek', 'v pátek', 'v sobotu'];
    var DOW_NOM = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
    var hero = $('#wxHero'), acc = $('#pocasi'), detail = $('#wxDetail');
    var dayAccs = {};
    T.program.days.forEach(function (d) { var a = document.getElementById('day-' + d.id); if (a) dayAccs[d.date] = a; });
    var st = { raw: null, at: 0, src: '', loading: false, failed: false };
    var chart = null;   // stav grafu po hodinách (šířka, data pro přepočet při změně velikosti)

    // ---- datum a čas v Praze (zařízení může být v jiném pásmu)
    function prague(d) {
      try {
        var p = {};
        new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
          .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
        return { date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
      } catch (e) {
        var iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
        return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
      }
    }
    function addDays(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
    function diffDays(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5); }
    function dow(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay(); }
    function dShort(iso) { return DOW[dow(iso)] + ' ' + (+iso.slice(8, 10)) + '.'; }
    function dLong(iso) { return dShort(iso) + ' ' + (+iso.slice(5, 7)) + '.'; }
    // ---- čísla po česku
    function num(x, dec) { return (dec ? x.toFixed(dec) : String(Math.round(x))).replace('.', ',').replace('-', '−'); }
    function deg(x) { return num(x) + '°'; }
    function mm(x) { var r = Math.round(x * 10) / 10; return r >= 10 || r % 1 === 0 ? num(r) : num(r, 1); }
    function rangeC(a, b) {   // nezalomitelné mezery a pomlčka, ať se „15–17 °C“ nerozdělí na dva řádky
      var lo = Math.round(a), hi = Math.round(b);
      if (lo === hi) return 'kolem ' + num(lo) + '\u00a0°C';
      return num(lo) + (lo < 0 ? '\u00a0až ' : '\u2060–\u2060') + num(hi) + '\u00a0°C';
    }
    function codeInfo(c, night) {
      var x = CODES[c] || ['🌡️', 'bez údaje'];
      if (night && c <= 1) return ['🌙', x[1]];
      if (night && c === 2) return ['☁️', x[1]];
      return x;
    }
    function rel(ms) {
      var m = Math.round((Date.now() - ms) / 60000);
      if (m < 1) return 'právě teď';
      if (m < 60) return 'před ' + m + ' min';
      if (m < 24 * 60) return 'před ' + Math.round(m / 60) + ' h';
      var p = prague(new Date(ms));
      return (+p.date.slice(8)) + '. ' + (+p.date.slice(5, 7)) + '. ' + p.time;
    }

    // ---- stažení
    function apiUrl() {
      var today = prague(new Date()).date;
      var a = DATES[0], b = DATES[DATES.length - 1], lo = addDays(today, -60), hi = addDays(today, 15);
      if (a < lo) a = lo;
      if (b > hi) b = hi;
      return API + (a <= b ? '&daily=' + DAILY + '&hourly=' + HOURLY + '&start_date=' + a + '&end_date=' + b : '');
    }
    function fetchJson(u, ms, sameOrigin) {
      var ctl = window.AbortController ? new AbortController() : null;
      var t = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
      return fetch(u, sameOrigin ? { cache: 'no-cache', signal: ctl && ctl.signal } : { signal: ctl && ctl.signal }).then(function (r) {
        clearTimeout(t);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }, function (e) { clearTimeout(t); throw e; });
    }
    function parse(j) {
      var o = { cur: null, days: [], hours: [] };
      function v(obj, k, i) { var a = obj[k]; return a && a[i] != null ? a[i] : null; }
      var c = j && j.current;
      if (c && c.temperature_2m != null) {
        o.cur = { time: c.time, t: c.temperature_2m, feel: c.apparent_temperature, code: c.weather_code, night: c.is_day === 0 };
      }
      var d = j && j.daily, h = j && j.hourly;
      if (d && d.time) d.time.forEach(function (date, i) {
        if (DATES.indexOf(date) < 0 || v(d, 'temperature_2m_max', i) == null || v(d, 'temperature_2m_min', i) == null) return;
        var sun = v(d, 'sunshine_duration', i);
        o.days.push({ date: date, code: v(d, 'weather_code', i), tmax: v(d, 'temperature_2m_max', i), tmin: v(d, 'temperature_2m_min', i),
          psum: v(d, 'precipitation_sum', i), pprob: v(d, 'precipitation_probability_max', i), gust: v(d, 'wind_gusts_10m_max', i),
          sun: sun == null ? null : sun / 3600 });
      });
      var have = o.days.map(function (x) { return x.date; });
      if (h && h.time) h.time.forEach(function (t, i) {
        if (have.indexOf(t.slice(0, 10)) < 0) return;
        o.hours.push({ time: t, t: v(h, 'temperature_2m', i), p: v(h, 'precipitation', i) || 0, pp: v(h, 'precipitation_probability', i),
          code: v(h, 'weather_code', i), wind: v(h, 'wind_speed_10m', i), gust: v(h, 'wind_gusts_10m', i), night: v(h, 'is_day', i) === 0 });
      });
      return o;
    }

    // ---- slovní shrnutí
    function isWet(d) { return (d.psum || 0) >= 2 || ((d.pprob || 0) >= 60 && (d.psum || 0) >= 0.5); }
    function isShowery(d) { return !isWet(d) && ((d.psum || 0) >= 0.3 || (d.pprob || 0) >= 45); }
    function isSunny(d) { return !isWet(d) && !isShowery(d) && d.sun != null && d.sun >= 6; }
    function score(d) { return (d.sun || 0) - 3 * (d.psum || 0) - (d.pprob || 0) / 20 + d.tmax / 5 - Math.max(0, (d.gust || 0) - 45) / 10; }
    function inDay(date, today) { return date === today ? 'dnes' : date === addDays(today, 1) ? 'zítra' : DOW_IN[dow(date)]; }
    function listIn(ds, today) {
      var a = ds.map(function (d) { return inDay(d.date, today); });
      return a.length < 2 ? a[0] : a.slice(0, -1).join(', ') + ' a ' + a[a.length - 1];
    }
    function minOf(ds, k) { return Math.min.apply(null, ds.map(function (d) { return d[k]; })); }
    function maxOf(ds, k) { return Math.max.apply(null, ds.map(function (d) { return d[k]; })); }
    function summary(all, today) {
      var past = all.every(function (d) { return d.date < today; });
      var ds = past ? all : all.filter(function (d) { return d.date >= today; });
      var one = ds.length === 1, s = [];
      var wet = ds.filter(isWet), shw = ds.filter(isShowery), sunny = ds.filter(isSunny);
      if (past) {
        return 'Přes den bylo ' + rangeC(minOf(ds, 'tmax'), maxOf(ds, 'tmax')) + ', v noci ' + rangeC(minOf(ds, 'tmin'), maxOf(ds, 'tmin')) +
          (wet.length ? ', pršelo ' + listIn(wet, '') : ', skoro bez deště') + '.';
      }
      if (wet.length === ds.length) s.push(one ? 'Vypadá to na deštivý den, hodí se tipy do deště.' : 'Vypadá to na deštivé dny, počítejte s pláštěnkami a tipy do deště.');
      else if (wet.length) s.push('Déšť hlavně ' + listIn(wet, today) + (shw.length ? ', přeháňky ' + listIn(shw, today) : '') + '.');
      else if (shw.length) s.push(one ? 'Spíš suchý den, ale můžou přijít přeháňky.' : 'Spíš sucho, jen ' + listIn(shw, today) + ' můžou přijít přeháňky.');
      else if (one) s.push(sunny.length ? 'Vypadá to na suchý a slunečný den.' : 'Vypadá to na suchý den.');
      else s.push(sunny.length * 2 >= ds.length ? 'Vypadá to na suché a slunečné dny.' : 'Vypadá to na suché dny.');
      s.push('Přes den ' + rangeC(minOf(ds, 'tmax'), maxOf(ds, 'tmax')) + ', v noci ' + rangeC(minOf(ds, 'tmin'), maxOf(ds, 'tmin')) + '.');
      if (minOf(ds, 'tmin') <= 1) s.push('Ráno může mrznout, hodí se čepice a rukavice.');
      var windy = ds.filter(function (d) { return (d.gust || 0) >= 55; });
      if (windy.length) s.push('Silný vítr ' + listIn(windy, today) + ' (nárazy až ' + num(maxOf(windy, 'gust')) + '\u00a0km/h), na hřebenech opatrně.');
      if (ds.length >= 3 && (wet.length || shw.length) && wet.length < ds.length) {
        var best = ds.slice().sort(function (a, b) { return score(b) - score(a); })[0];
        if (!isWet(best) && !isShowery(best)) {
          s.push('Na kolo nebo delší výlet vychází nejlépe ' + (best.date === today ? 'dnešek' : best.date === addDays(today, 1) ? 'zítřek' : DOW_NOM[dow(best.date)]) + '.');
        }
      }
      return s.join(' ');
    }
    function reliability(lead) {
      if (lead >= 8) return 'Víc než týden dopředu je to jen hrubý odhad, v týdnu před odjezdem se předpověď zpřesní.';
      if (lead >= 4) return 'Na několik dní dopředu se předpověď ještě může změnit.';
      return '';
    }
    function fallback(lead) {
      var from = addDays(DATES[0], -15);
      if (lead > 15) return 'Předpověď na pobyt se objeví ' + DOW_IN[dow(from)] + ' ' + (+from.slice(8)) + '. ' + (+from.slice(5, 7)) + '. ' + CLIMATE;
      return (st.loading ? 'Načítám aktuální předpověď… ' : 'Předpověď se teď nepodařilo načíst. ') + CLIMATE;
    }
    function nowText(c) {
      var ci = codeInfo(c.code, c.night), fresh = Date.now() - st.at < 90 * 60000;
      return ci[0] + ' ' + (fresh ? 'Teď' : 'Naposledy') + ' ' + num(c.t) + ' °C, ' + ci[1] +
        (c.feel != null && Math.abs(c.feel - c.t) >= 3 ? ', pocitově ' + num(c.feel) + ' °C' : '');
    }
    function updText() {
      if (!st.at) return st.loading ? 'načítám předpověď…' : '';
      return 'aktualizováno ' + rel(st.at) + (st.loading ? ' · načítám nová data…' : st.failed ? ' · nová data se teď nepodařilo stáhnout' : '');
    }
    function modelTag() {
      return '<span class="wxh-model" title="' + esc(MODEL.title) + '">' + esc(MODEL.name) + '</span>';
    }
    function rainCell(d) {
      var p = d.pprob, s = d.psum || 0;
      if (s >= 1) return '<span class="wxh-rain" title="srážky ' + mm(s) + ' mm' + (p != null ? ', pravděpodobnost ' + p + ' %' : '') + '">💧 ' + mm(s) + ' mm</span>';
      if (p != null) return '<span class="wxh-rain' + (p < 30 ? ' dim' : '') + '" title="pravděpodobnost srážek">💧 ' + p + ' %</span>';
      return '<span class="wxh-rain dim">–</span>';
    }
    function dayAria(d) {
      return dLong(d.date) + ': ' + codeInfo(d.code)[1] + ', ' + rangeC(d.tmin, d.tmax) +
        (d.pprob != null ? ', pravděpodobnost srážek ' + d.pprob + ' %' : '') + ((d.psum || 0) >= 0.1 ? ', ' + mm(d.psum) + ' mm' : '');
    }

    // ---- souhrn nahoře
    function renderHero(data, today) {
      if (!hero) return;
      var days = data ? data.days : [], byDate = {};
      days.forEach(function (d) { byDate[d.date] = d; });
      var lead = diffDays(today, DATES[0]), after = today > DATES[DATES.length - 1];
      var badge = !days.length ? (st.loading ? 'načítám…' : lead > 15 ? 'zatím bez předpovědi' : 'bez spojení') :
        after ? 'jak bylo' : lead <= 0 ? 'jsme tu' : lead >= 8 ? 'orientační výhled' : 'předpověď';
      var lo = Infinity, hi = -Infinity;
      days.forEach(function (d) { lo = Math.min(lo, d.tmin); hi = Math.max(hi, d.tmax); });
      lo = Math.floor(lo) - 1; hi = Math.ceil(hi) + 1;
      var rows = DATES.map(function (date) {
        var d = byDate[date];
        var cls = 'wxh-day' + (date === today ? ' is-today' : date < today && !after ? ' is-past' : '');
        var name = date === today ? '<b>dnes</b>' : '<b>' + DOW[dow(date)] + '</b> ' + (+date.slice(8)) + '.';
        if (!d) {
          return '<li class="' + cls + ' is-empty"><span class="wxh-dn">' + name + '</span><span class="wxh-ico" aria-hidden="true">·</span>' +
            '<span class="wxh-lo">–</span><span class="wxh-bar" aria-hidden="true"></span><span class="wxh-hi">–</span><span class="wxh-rain"></span></li>';
        }
        var ci = codeInfo(d.code), span = hi - lo;
        var left = (d.tmin - lo) / span * 100, width = Math.max(4, (d.tmax - d.tmin) / span * 100);
        var dot = date === today && data.cur ? '<span class="now" style="left:' + Math.max(0, Math.min(100, (data.cur.t - lo) / span * 100)).toFixed(1) + '%"></span>' : '';
        return '<li class="' + cls + '" aria-label="' + esc(dayAria(d)) + '"><span class="wxh-dn" aria-hidden="true">' + name + '</span>' +
          '<span class="wxh-ico" title="' + esc(ci[1]) + '" aria-hidden="true">' + ci[0] + '</span>' +
          '<span class="wxh-lo" aria-hidden="true">' + deg(d.tmin) + '</span>' +
          '<span class="wxh-bar" aria-hidden="true"><i style="left:' + left.toFixed(1) + '%;width:' + width.toFixed(1) + '%"></i>' + dot + '</span>' +
          '<span class="wxh-hi" aria-hidden="true">' + deg(d.tmax) + '</span>' + rainCell(d).replace('<span ', '<span aria-hidden="true" ') + '</li>';
      }).join('');
      var cur = data && data.cur ? nowText(data.cur) : '';
      hero.classList.toggle('is-loading', st.loading);
      hero.setAttribute('aria-busy', st.loading ? 'true' : 'false');
      hero.innerHTML = '<div class="wxh-head"><h2 class="wxh-title">🌦️ Počasí na mlýně</h2><span class="wxh-badge">' + esc(badge) + '</span></div>' +
        '<ol class="wxh-days">' + rows + '</ol>' +
        '<p class="wxh-sum">' + esc(days.length ? summary(days, today) : fallback(lead)) + '</p>' +
        '<div class="wxh-foot"><span class="wxh-now">' + esc(cur) + '</span><span class="wxh-links">' +
        '<a href="#pocasi" data-wx="open">Po hodinách ›</a><a href="' + WINDY + '" target="_blank" rel="noopener">Windy ↗</a></span></div>' +
        '<div class="wxh-bot"><span class="wxh-upd">' + esc(updText()) + '</span>' + (st.raw ? modelTag() : '') + '</div>';
    }

    // ---- detail v sekci Praktické
    function daysTable(days, today) {
      return '<div class="wx-tablewrap"><table class="wx-table"><thead><tr><th>Den</th><th>Počasí</th><th>Teplota</th><th>Srážky</th><th class="opt">Vítr</th><th class="opt">Slunce</th></tr></thead><tbody>' +
        days.map(function (d) {
          var ci = codeInfo(d.code);
          return '<tr' + (d.date === today ? ' class="is-today"' : '') + '><td>' + dLong(d.date) + '</td><td><span aria-hidden="true">' + ci[0] + '</span> <span class="txt">' + esc(ci[1]) + '</span></td>' +
            '<td><b>' + deg(d.tmax) + '</b> / ' + deg(d.tmin) + '</td>' +
            '<td>' + mm(d.psum || 0) + ' mm' + (d.pprob != null ? ' · ' + d.pprob + ' %' : '') + '</td>' +
            '<td class="opt">' + (d.gust != null ? 'nárazy ' + num(d.gust) + '\u00a0km/h' : '–') + '</td>' +
            '<td class="opt">' + (d.sun != null ? num(d.sun, 1) + ' h' : '–') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    function hoursTable(hrs) {
      var rows = '';
      for (var i = 0; i < hrs.length; i += 3) {
        var a = hrs[i];
        if (a.time.slice(11, 13) === '00') rows += '<tr class="dh"><th colspan="5">' + dLong(a.time.slice(0, 10)) + '</th></tr>';
        if (a.t == null) continue;
        var p = 0, pp = null;
        for (var k = i; k < i + 3 && k < hrs.length; k++) { p += hrs[k].p || 0; if (hrs[k].pp != null) pp = Math.max(pp || 0, hrs[k].pp); }
        var ci = codeInfo(a.code, a.night);
        rows += '<tr><td>' + a.time.slice(11, 16) + '</td><td><span aria-hidden="true">' + ci[0] + '</span> <span class="txt">' + esc(ci[1]) + '</span></td><td>' + deg(a.t) + '</td>' +
          '<td>' + mm(p) + ' mm' + (pp != null ? ' · ' + pp + ' %' : '') + '</td><td>' + (a.wind != null ? num(a.wind) + ' km/h' : '–') + '</td></tr>';
      }
      return '<div class="wx-tablewrap"><table class="wx-table"><thead><tr><th>Čas</th><th>Počasí</th><th>Teplota</th><th>Srážky za 3 h</th><th>Vítr</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    function renderDetail(data, today) {
      if (!detail) return;
      var days = data ? data.days : [], lead = diffDays(today, DATES[0]), h = '';
      detail.classList.toggle('is-loading', st.loading);
      if (days.length) {
        var note = today <= DATES[DATES.length - 1] ? reliability(lead) : '';
        h += '<p class="wx-sum">' + esc(summary(days, today)) + '</p>' + (note ? '<p class="wx-note">' + esc(note) + '</p>' : '') + daysTable(days, today);
        if (data.hours.length) {
          h += '<figure class="wxc" tabindex="0" aria-label="Graf po hodinách: teplota a srážky. Šipkami doleva a doprava se posouváte po hodinách.">' +
            '<div class="wxc-box"></div><div class="wxc-tip" hidden></div></figure>' +
            '<details class="wx-hours"><summary>Tabulka po 3 hodinách</summary>' + hoursTable(data.hours) + '</details>';
        }
      } else {
        h += '<p class="wx-sum">' + esc(fallback(lead)) + '</p>';
      }
      h += '<p class="wx-src"><span class="wx-upd">' + esc(updText()) + '</span>' +
        '<span class="wx-model" title="' + esc(MODEL.title) + '">model ' + esc(MODEL.name) + ' · data <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a></span>' +
        ' <button type="button" class="btn small" data-wx="refresh">↻ Aktualizovat</button>' +
        ' <a class="btn small" href="' + WINDY + '" target="_blank" rel="noopener">Windy ↗</a></p>';
      detail.innerHTML = h;
      chart = data && data.hours.length ? { data: data, w: 0 } : null;
      drawChart();
    }

    // graf po hodinách: nahoře teplota (čára), dole srážky po 3 hodinách (sloupce) – každý se svou osou
    function drawChart() {
      var fig = detail && detail.querySelector('.wxc');
      if (!fig || !chart) return;
      var box = fig.querySelector('.wxc-box'), tip = fig.querySelector('.wxc-tip');
      var W = Math.round(box.clientWidth);
      if (W < 100) return;   // sbalená sekce – nakreslí se po rozbalení
      chart.w = W;
      var hrs = chart.data.hours, n = hrs.length;
      var padL = 30, padR = 10, tTop = 26, tBot = 146, pTop = 180, pBot = 222, H = 258;
      var step = (W - padL - padR) / n;
      function X(i) { return padL + i * step; }
      var ts = hrs.map(function (x) { return x.t; }).filter(function (v) { return v != null; });
      var tmin = Math.min.apply(null, ts), tmax = Math.max.apply(null, ts);
      var tst, lo, hi;
      [1, 2, 5, 10].some(function (x) {   // krok osy tak, aby vyšlo nejvýš 5 dílků
        tst = x; lo = Math.floor((tmin - 1) / x) * x; hi = Math.ceil((tmax + 2) / x) * x;
        return (hi - lo) / x <= 5;
      });
      function YT(v) { return tBot - (v - lo) / (hi - lo) * (tBot - tTop); }
      var bins = [];
      for (var i = 0; i < n; i += 3) {
        var sum = 0, pp = null;
        for (var k = i; k < Math.min(n, i + 3); k++) { sum += hrs[k].p || 0; if (hrs[k].pp != null) pp = Math.max(pp || 0, hrs[k].pp); }
        bins.push({ i: i, n: Math.min(3, n - i), s: sum, pp: pp });
      }
      var pRaw = Math.max.apply(null, bins.map(function (b) { return b.s; }));
      var pmax = [1, 2, 5, 10, 20, 50].filter(function (v) { return v >= pRaw; })[0] || Math.ceil(pRaw / 10) * 10;
      function YP(v) { return pBot - v / pmax * (pBot - pTop); }
      function f(x) { return x.toFixed(1); }
      var s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Teplota ' +
        esc(rangeC(tmin, tmax)) + ', srážky nejvýš ' + mm(pRaw) + ' mm za 3 hodiny. Hodnoty jsou i v tabulce pod grafem.">';
      // noc
      [[tTop, tBot], [pTop, pBot]].forEach(function (band) {
        for (var i = 0; i < n; i++) {
          if (!hrs[i].night) continue;
          var j = i;
          while (j + 1 < n && hrs[j + 1].night) j++;
          s += '<rect class="night" x="' + f(X(i)) + '" y="' + band[0] + '" width="' + f(Math.min(j + 1, n) * step - i * step) + '" height="' + (band[1] - band[0]) + '"/>';
          i = j;
        }
      });
      // mřížka a osy
      for (var v = lo; v <= hi + 1e-9; v += tst) {
        s += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + f(YT(v)) + '" y2="' + f(YT(v)) + '"/>' +
          '<text class="ytick" x="' + (padL - 5) + '" y="' + f(YT(v) + 4) + '" text-anchor="end">' + num(v) + '°</text>';
      }
      s += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + pTop + '" y2="' + pTop + '"/>' +
        '<line class="axis" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + pBot + '" y2="' + pBot + '"/>' +
        '<text class="ytick" x="' + (padL - 5) + '" y="' + (pBot + 4) + '" text-anchor="end">0</text>' +
        '<text class="ytick" x="' + (padL - 5) + '" y="' + (pTop + 4) + '" text-anchor="end">' + num(pmax) + '</text>';
      s += '<text class="plab" x="0" y="14">Teplota (°C)</text><text class="plab" x="0" y="' + (pTop - 12) + '">Srážky (mm za 3 hodiny)</text>' +
        '<text class="mlab" x="' + (W - padR) + '" y="14" text-anchor="end">model ' + esc(MODEL.name) + '</text>';
      // dny: dělicí čáry, hodiny a názvy
      var starts = [];
      hrs.forEach(function (x, i) { if (i === 0 || x.time.slice(11, 13) === '00') starts.push(i); });
      starts.forEach(function (i, k) {
        var end = k + 1 < starts.length ? starts[k + 1] : n, date = hrs[i].time.slice(0, 10);
        if (i > 0) s += '<line class="sep" x1="' + f(X(i)) + '" x2="' + f(X(i)) + '" y1="' + (tTop - 6) + '" y2="' + (H - 2) + '"/>';
        [6, 12, 18].forEach(function (hh) {
          if (i + hh >= end) return;
          var x = f(X(i + hh));
          s += '<line class="tick" x1="' + x + '" x2="' + x + '" y1="' + pBot + '" y2="' + (pBot + 4) + '"/>';
          if (hh === 12 || step * 6 >= 24) s += '<text class="xtick" x="' + x + '" y="' + (pBot + 16) + '" text-anchor="middle">' + hh + '</text>';
        });
        s += '<text class="day" x="' + f((X(i) + X(end)) / 2) + '" y="' + (H - 4) + '" text-anchor="middle">' + ((end - i) * step > 84 ? dLong(date) : dShort(date)) + '</text>';
      });
      // teplota: plocha, čára, nejvyšší a nejnižší hodnota každého dne
      var line = '', first = -1, last = -1;
      hrs.forEach(function (x, i) {
        if (x.t == null) return;
        line += (first < 0 ? 'M' : 'L') + f(X(i)) + ',' + f(YT(x.t));
        if (first < 0) first = i;
        last = i;
      });
      s += '<path class="t-area" d="' + line + 'L' + f(X(last)) + ',' + tBot + 'L' + f(X(first)) + ',' + tBot + 'Z"/><path class="t-line" d="' + line + '"/>';
      // srážky: sloupce se zaobleným vrškem, rovné u základny
      var bw = Math.max(2, Math.min(24, 3 * step - 2));
      bins.forEach(function (b) {
        if (b.s < 0.05) return;
        var x0 = X(b.i) + b.n * step / 2 - bw / 2, y = YP(b.s), r = Math.min(4, bw / 2, pBot - y);
        s += '<path class="bar" d="M' + f(x0) + ',' + pBot + 'V' + f(y + r) + 'A' + f(r) + ',' + f(r) + ' 0 0 1 ' + f(x0 + r) + ',' + f(y) +
          'H' + f(x0 + bw - r) + 'A' + f(r) + ',' + f(r) + ' 0 0 1 ' + f(x0 + bw) + ',' + f(y + r) + 'V' + pBot + 'Z"/>';
      });
      if (pRaw < 0.05) s += '<text class="none" x="' + f((padL + W - padR) / 2) + '" y="' + ((pTop + pBot) / 2 + 4) + '" text-anchor="middle">bez srážek</text>';
      starts.forEach(function (i, k) {
        var end = k + 1 < starts.length ? starts[k + 1] : n, ma = -1, mi = -1;
        for (var j = i; j < end; j++) {
          if (hrs[j].t == null) continue;
          if (ma < 0 || hrs[j].t > hrs[ma].t) ma = j;
          if (mi < 0 || hrs[j].t < hrs[mi].t) mi = j;
        }
        if (ma < 0) return;
        [[ma, -9], [mi, 17]].forEach(function (e) {
          var x = X(e[0]), y = YT(hrs[e[0]].t);
          s += '<circle class="t-dot" cx="' + f(x) + '" cy="' + f(y) + '" r="4"/>' +
            '<text class="lbl" x="' + f(Math.max(padL + 10, Math.min(W - padR - 10, x))) + '" y="' + f(Math.max(tTop + 9, Math.min(tBot + 13, y + e[1]))) + '" text-anchor="middle">' + deg(hrs[e[0]].t) + '</text>';
        });
      });
      // teď
      var now = prague(new Date()), ni = -1;
      hrs.forEach(function (x, i) { if (x.time.slice(0, 10) === now.date && x.time.slice(11, 13) === now.time.slice(0, 2)) ni = i; });
      if (ni >= 0) {
        var nx = f(X(ni) + (+now.time.slice(3, 5)) / 60 * step);
        s += '<line class="now" x1="' + nx + '" x2="' + nx + '" y1="' + (tTop - 6) + '" y2="' + pBot + '"/>' +
          '<text class="nowl" x="' + nx + '" y="' + (tTop - 10) + '" text-anchor="middle">teď</text>';
      }
      s += '<line class="cur" x1="-9" x2="-9" y1="' + (tTop - 6) + '" y2="' + pBot + '" visibility="hidden"/>' +
        '<circle class="cur-dot" cx="-9" cy="-9" r="5" visibility="hidden"/></svg>';
      box.innerHTML = s;
      var svg = box.querySelector('svg'), cur = svg.querySelector('.cur'), dot = svg.querySelector('.cur-dot');
      var pos = ni >= 0 ? ni : 12;
      function show(i) {
        pos = Math.max(0, Math.min(n - 1, i));
        var x = hrs[pos], cx = f(X(pos)), ci = codeInfo(x.code, x.night);
        cur.setAttribute('x1', cx); cur.setAttribute('x2', cx); cur.setAttribute('visibility', 'visible');
        if (x.t != null) { dot.setAttribute('cx', cx); dot.setAttribute('cy', f(YT(x.t))); dot.setAttribute('visibility', 'visible'); }
        else dot.setAttribute('visibility', 'hidden');
        tip.innerHTML = '<b>' + (x.t != null ? num(x.t) + ' °C' : '–') + '</b> <span aria-hidden="true">' + ci[0] + '</span> ' + esc(ci[1]) +
          '<span class="t2">' + esc(dLong(x.time.slice(0, 10))) + ' · ' + x.time.slice(11, 16) + '</span>' +
          '<span class="t2">srážky ' + mm(x.p || 0) + '\u00a0mm' + (x.pp != null ? ' · ' + x.pp + '\u00a0%' : '') + '</span>' +
          (x.wind != null ? '<span class="t2">vítr ' + num(x.wind) + ' km/h' + (x.gust != null ? ', nárazy ' + num(x.gust) : '') + '</span>' : '');
        tip.hidden = false;
        var right = X(pos) > W * 0.58;
        tip.style.left = f(X(pos)) + 'px';
        tip.style.transform = right ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)';
      }
      function hide() {
        cur.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true;
      }
      function at(ev) { var r = svg.getBoundingClientRect(); return Math.round((ev.clientX - r.left - padL) / step); }
      svg.addEventListener('pointermove', function (ev) { show(at(ev)); });
      svg.addEventListener('pointerdown', function (ev) { show(at(ev)); });
      svg.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse') hide(); });
      fig.onkeydown = function (ev) {
        var d = { ArrowLeft: -1, ArrowRight: 1, PageUp: -6, PageDown: 6 }[ev.key];
        if (ev.key === 'Home') d = -n;
        if (ev.key === 'End') d = n;
        if (!d) return;
        ev.preventDefault();
        show(pos + (ev.shiftKey ? d * 6 : d));
      };
      fig.onfocus = function () { show(pos); };
      fig.onblur = hide;
    }

    // ---- štítek s počasím u nápadů po dnech
    function renderDays(data, today) {
      var byDate = {};
      (data ? data.days : []).forEach(function (d) { byDate[d.date] = d; });
      Object.keys(dayAccs).forEach(function (date) {
        var a = dayAccs[date], d = byDate[date], sum = a.querySelector('summary'), body = a.querySelector('.acc-body');
        var chip = sum.querySelector('.acc-wx'), line = body.querySelector('.daywx');
        if (!d) {
          if (chip) chip.parentNode.removeChild(chip);
          if (line) line.parentNode.removeChild(line);
          a.classList.remove('has-wx');
          return;
        }
        var ci = codeInfo(d.code), wet = isWet(d) || isShowery(d);
        if (!chip) { chip = el('span', { 'class': 'acc-wx' }); sum.insertBefore(chip, sum.querySelector('.acc-chev')); }
        chip.className = 'acc-wx' + (wet ? ' wet' : '');
        chip.title = (date < today ? 'Počasí: ' : 'Předpověď: ') + dayAria(d);
        chip.innerHTML = '<span class="ico" aria-hidden="true">' + ci[0] + '</span><b>' + deg(d.tmax) + '</b><span class="lo">/' + deg(d.tmin) + '</span>' +
          ((d.pprob || 0) >= 30 || (d.psum || 0) >= 1 ? '<span class="rn">💧' + ((d.psum || 0) >= 1 ? mm(d.psum) + ' mm' : d.pprob + ' %') + '</span>' : '');
        a.classList.add('has-wx');
        if (!line) { line = el('p', { 'class': 'daywx' }); body.insertBefore(line, body.firstChild); }
        line.innerHTML = '<b>' + (date < today ? 'Počasí' : 'Předpověď') + ':</b> ' + ci[0] + ' ' + esc(ci[1]) + ', ' + esc(rangeC(d.tmin, d.tmax)) +
          (d.pprob != null ? ', srážky ' + d.pprob + ' %' + ((d.psum || 0) >= 0.1 ? ' (' + mm(d.psum) + ' mm)' : '') : '') +
          ((d.gust || 0) >= 40 ? ', nárazy větru ' + num(d.gust) + ' km/h' : '') + '.' +
          (wet && date >= today ? ' <span class="muted">Hodí se tipy „Když prší“ níž.</span>' : '');
      });
    }
    function renderPreview(data) {
      if (!acc || !acc.setHead) return;
      var days = data ? data.days : [];
      acc.setHead('Počasí a světlo', null, esc(days.length ? days.map(function (d) {
        return DOW[dow(d.date)] + ' ' + codeInfo(d.code)[0] + ' ' + deg(d.tmax) + '/' + deg(d.tmin);
      }).join(' · ') + ' · ' + updText() : 'aktuální předpověď pro mlýn · slunce zapadá kolem ' + T.sun[0].set + ' · 10. 10. novoluní'));
    }
    function renderUpd() {
      var t = updText();
      $$('.wxh-upd, .wx-upd').forEach(function (x) { x.textContent = t; });
    }
    function renderAll() {
      var data = st.raw ? parse(st.raw) : null, today = prague(new Date()).date;
      renderHero(data, today);
      renderDetail(data, today);
      renderDays(data, today);
      renderPreview(data);
    }

    // ---- načtení: hned poslední známá data, pak čerstvá z Open-Meteo, při chybě záloha z GitHubu
    function set(raw, at, src) { st.raw = raw; st.at = at; st.src = src; }
    var snapP = null;
    function snapshot() {
      if (!snapP) {
        snapP = fetchJson('data/weather.json', 6000, true).then(function (s) {
          var at = s && s.fetched ? Date.parse(s.fetched) : 0;
          if (s && s.data && at && (s.model || 'best_match') === MODEL.id && st.src !== 'live' && at > st.at) set(s.data, at, 'snap');
        }).catch(function () {});
      }
      return snapP;
    }
    function load() {
      if (st.loading) return;
      st.loading = true; st.failed = false;
      renderAll();
      var live = fetchJson(apiUrl(), 10000).then(function (j) {
        if (!j || (!j.current && !j.daily)) throw new Error('prázdná odpověď');
        set(j, Date.now(), 'live');
        store('wx1', { at: st.at, model: MODEL.id, j: j });
      });
      if (!st.raw) snapshot().then(function () { if (st.loading && st.raw) renderAll(); });
      live.catch(function () { st.failed = true; return snapshot(); }).then(function () {
        st.loading = false;
        renderAll();
      });
    }
    var c0 = store('wx1');
    if (c0 && c0.j && c0.at && c0.model === MODEL.id) set(c0.j, c0.at, 'cache');
    load();

    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-wx]');
      if (!b) return;
      var act = b.getAttribute('data-wx');
      if (act === 'open') {
        e.preventDefault();
        if (acc) { acc.open = true; acc.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      } else if (act === 'refresh') load();
      else if (act === 'windy') {
        b.parentNode.innerHTML = '<iframe src="' + esc(WINDY_EMBED) + '" title="Windy: předpověď a radar pro Cikháj" allowfullscreen></iframe>';
      }
    });
    if (acc) acc.addEventListener('toggle', function () { if (acc.open && chart && !chart.w) drawChart(); });
    var rT = null;
    window.addEventListener('resize', function () {
      clearTimeout(rT);
      rT = setTimeout(function () {
        var fig = detail && detail.querySelector('.wxc-box');
        if (chart && fig && Math.abs(fig.clientWidth - chart.w) > 6) drawChart();
      }, 150);
    });
    // po návratu do stránky (třeba ráno na mlýně) se předpověď obnoví sama
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && Date.now() - st.at > 30 * 60000) load();
    });
    setInterval(function () { if (!document.hidden) renderUpd(); }, 60000);
    if (location.hash === '#pocasi' && acc) acc.open = true;
  })();

  // ------------------------------------------------------------ credits
  $('#credits').innerHTML = T.credits;

  // ------------------------------------------------------------ start
  buildChips();
  applyFilters();
  fitLocal();
  if (parseHash(location.hash)) {
    var s0 = parseHash(location.hash);
    if (/^#place-/.test(location.hash)) history.replaceState(null, '', baseUrl(hrefFor(s0.kind, s0.id)));
    setTimeout(function () { showModal(s0.kind, s0.id); }, 50);
  }

  // aktivní odkaz v navigaci
  var links = $$('.topnav a');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('section.block').forEach(function (s) { io.observe(s); });
  }

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  // ------------------------------------------------------------ nová verze webu
  // GitHub Pages posílá soubory s cache na 10 minut a Safari navíc rád ukáže stránku z paměti.
  // Při nasazení se do index.html zapíše verze (tools/stamp.py) a stejná do version.json, který
  // se tu stahuje bez cache. Když se liší, stránka se sama načte znovu z adresy ?v=…, takže
  // dostane čerstvé HTML i skripty; otevřené místo nebo trasa zůstane díky # v adrese.
  (function autoUpdate() {
    var meta = document.querySelector('meta[name="build"]');
    var cur = meta && meta.getAttribute('content');
    if (!cur || cur === 'dev' || !window.fetch) return;
    var KEY = 'vy-update';
    function triedRecently(v) {   // pojistka proti smyčce, kdyby server ještě chvíli vracel starou stránku
      try {
        var s = JSON.parse(sessionStorage.getItem(KEY) || 'null');
        return !!s && s.v === v && Date.now() - s.t < 120000;
      } catch (e) { return false; }
    }
    function check() {
      fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || !d.version || d.version === cur || triedRecently(d.version)) return;
          try { sessionStorage.setItem(KEY, JSON.stringify({ v: d.version, t: Date.now() })); } catch (e) { /* bez úložiště */ }
          location.replace(location.pathname + '?v=' + encodeURIComponent(d.version) + location.hash);
        })
        .catch(function () { /* offline: zůstane, co je */ });
    }
    setTimeout(check, 1500);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) check(); });
    setInterval(function () { if (!document.hidden) check(); }, 15 * 60 * 1000);
  })();
})();
