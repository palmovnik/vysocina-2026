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

  // ------------------------------------------------------------ helpers
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
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
  function mapyShow(p) {
    return 'https://mapy.com/fnc/v1/showmap?mapset=outdoor&center=' + p.lon + ',' + p.lat + '&zoom=16&marker=true';
  }
  function googleNav(p) {
    var t = p.carTarget || [p.lat, p.lon];
    return 'https://www.google.com/maps/dir/?api=1&destination=' + t[0] + ',' + t[1];
  }
  function accessHtml(p, compact) {
    var a = [];
    if (p.walk && p.walk.km <= 6) a.push('<span>🥾 ' + fmtKm(p.walk.km) + ' · ' + fmtMin(p.walk.min) + '</span>');
    if (p.bike && (!p.walk || p.walk.km > 3)) a.push('<span>🚲 ' + fmtKm(p.bike.km) + (p.bike.up ? ' · ↑' + p.bike.up + ' m' : '') + '</span>');
    if (p.car && p.car.km > 3) a.push('<span>🚗 ' + fmtMin(p.car.min) + ' · ' + fmtKm(p.car.km) + (p.car.walk ? ' + 🥾 ' + fmtKm(p.car.walk) : '') + '</span>');
    if (!a.length && p.id !== 'mlyn') a.push('<span>📍 ' + fmtKm(p.dist) + ' vzdušně</span>');
    return compact ? a.slice(0, 2).join('') : a.join('');
  }
  function kidsStars(n) { return n ? '🧒'.repeat(n) : ''; }

  // ------------------------------------------------------------ hero
  (function hero() {
    var fam = $('#families');
    var adults = 0, kids = 0;
    T.families.forEach(function (f) {
      adults += f.adults; kids += f.kids;
      fam.appendChild(el('span', { 'class': 'family' }, '<b>' + esc(f.name) + '</b> ' + f.adults + '+' + f.kids));
    });
    fam.appendChild(el('span', { 'class': 'family' }, '= <b>' + (adults + kids) + ' lidí</b> (' + adults + ' dospělých, ' + kids + ' dětí)'));
    var start = new Date('2026-10-08T15:00:00+02:00'), end = new Date('2026-10-11T18:00:00+02:00'), now = new Date();
    var cd = $('#countdown');
    if (now < start) {
      var d = Math.ceil((start - now) / 86400000);
      cd.textContent = '⏳ ' + (d === 1 ? 'zítra vyrážíme!' : 'za ' + d + (d < 5 ? ' dny' : ' dní') + ' vyrážíme');
    } else if (now <= end) cd.textContent = '🎒 právě jsme na Vysočině!';
    else cd.textContent = '📸 bylo to super';
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
  var map = L.map('map', { zoomControl: true, scrollWheelZoom: false, tap: true, preferCanvas: false });
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
  function iconFor(p) {
    var c = CATS[p.cat];
    var home = p.cat === 'chata';
    var html = '<div class="pin' + (home ? ' home' : '') + (p.top && !home ? ' top' : '') + '" style="--c:' + catVar(p.cat) + ';position:relative">' +
      (home ? '<i class="home-pulse"></i>' : '') + '<span>' + c.emoji + '</span></div>';
    var s = home ? 42 : 32;
    return L.divIcon({ html: html, className: '', iconSize: [s, s], iconAnchor: [s / 2, s + 2], popupAnchor: [0, -s] });
  }
  function popupHtml(p) {
    var c = CATS[p.cat];
    var h = '<div class="pop" style="--c:' + catVar(p.cat) + '">' +
      '<div class="cat">' + c.emoji + ' ' + esc(c.name) + (p.top ? ' · ⭐ tip' : '') + '</div>' +
      '<h4>' + esc(p.name) + '</h4>';
    if (p.img) h += '<img src="' + esc(p.img.src) + '" alt="" loading="lazy">';
    h += '<div>' + esc(p.teaser) + '</div>';
    var acc = accessHtml(p);
    if (acc) h += '<div class="acc">' + acc.replace(/<\/span><span>/g, ' &nbsp; ') + '</div>';
    h += '<div class="row">';
    if (p.id !== 'mlyn') h += '<a class="btn small primary" href="#place-' + p.id + '" data-card="' + p.id + '">Detail</a>';
    h += '<a class="btn small" href="' + googleNav(p) + '" target="_blank" rel="noopener">Navigovat</a>' +
      '<a class="btn small" href="' + mapyShow(p) + '" target="_blank" rel="noopener">Mapy.com</a></div></div>';
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
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-card]');
    if (!a) return;
    e.preventDefault();
    showCard(a.getAttribute('data-card'));
  });

  // ------------------------------------------------------------ routes on map
  var routeLayers = {};
  var hoverDot = L.marker([0, 0], { icon: L.divIcon({ html: '<div class="hover-dot"></div>', className: '', iconSize: [14, 14], iconAnchor: [7, 7] }), interactive: false, zIndexOffset: 2000 });
  T.routes.forEach(function (r) {
    var latlngs = r.geo.map(function (g) { return [g[0], g[1]]; });
    var casing = L.polyline(latlngs, { color: '#fff', weight: 7, opacity: .85, interactive: false });
    var line = L.polyline(latlngs, {
      color: r.color, weight: 4, opacity: .9, dashArray: r.type === 'hike' ? '9 7' : null, lineCap: 'round'
    });
    line.bindTooltip((r.type === 'bike' ? '🚲 ' : '🥾 ') + esc(r.name) + ' · ' + fmtKm(r.km), { sticky: true, direction: 'top', opacity: .95 });
    line.on('click', function () { selectRoute(r.id, true); });
    routeLayers[r.id] = L.layerGroup([casing, line]);
    routeLayers[r.id].line = line;
    routeLayers[r.id].casing = casing;
  });

  var legend = L.control({ position: 'bottomleft' });
  legend.onAdd = function () {
    return el('div', { 'class': 'map-legend' },
      '<div><i style="border-color:#1f6fd1"></i>trasa na kolo</div><div><i class="dash" style="border-color:#e8590c"></i>trasa pěšky</div><div style="color:#b8541c">◌ 5 a 10 km od mlýna</div>');
  };
  legend.addTo(map);

  // ------------------------------------------------------------ filters
  var state = store('filters') || {};
  state.cats = state.cats || T.cats.map(function (c) { return c.id; });
  state.flags = state.flags || {};
  state.routeTypes = state.routeTypes || { bike: true, hike: true };
  var selectedRoute = null;

  function placeVisible(p) {
    if (p.cat === 'chata') return true;
    if (state.cats.indexOf(p.cat) < 0) return false;
    if (state.flags.top && !p.top) return false;
    if (state.flags.kids && (p.kids || 0) < 3) return false;
    if (state.flags.rain && !p.rain) return false;
    return true;
  }

  function buildChips() {
    var box = $('#catChips');
    box.innerHTML = '';
    T.cats.forEach(function (c) {
      if (c.id === 'chata') return;
      var n = T.places.filter(function (p) { return p.cat === c.id; }).length;
      var b = el('button', { 'class': 'chip', type: 'button', 'aria-pressed': String(state.cats.indexOf(c.id) >= 0), style: '--c:' + catVar(c.id) },
        '<span class="dot">' + c.emoji + '</span>' + esc(c.name) + ' <span class="count">' + n + '</span>');
      b.addEventListener('click', function () {
        var i = state.cats.indexOf(c.id);
        if (i >= 0) state.cats.splice(i, 1); else state.cats.push(c.id);
        b.setAttribute('aria-pressed', String(i < 0));
        applyFilters();
      });
      b.addEventListener('dblclick', function () {
        state.cats = ['chata', c.id];
        buildChips();
        applyFilters();
      });
      box.appendChild(b);
    });
    var flags = $('#flagChips');
    flags.innerHTML = '';
    [['top', '⭐ Top tipy'], ['kids', '🧒 Nejvíc pro děti'], ['rain', '☔ Za deště']].forEach(function (f) {
      var b = el('button', { 'class': 'chip toggle', type: 'button', 'aria-pressed': String(!!state.flags[f[0]]) }, f[1]);
      b.addEventListener('click', function () {
        state.flags[f[0]] = !state.flags[f[0]];
        b.setAttribute('aria-pressed', String(state.flags[f[0]]));
        applyFilters();
      });
      flags.appendChild(b);
    });
    var rc = $('#routeChips');
    rc.innerHTML = '';
    [['bike', '🚲 Na kolo'], ['hike', '🥾 Pěšky']].forEach(function (f) {
      var b = el('button', { 'class': 'chip toggle', type: 'button', 'aria-pressed': String(!!state.routeTypes[f[0]]) }, f[1]);
      b.addEventListener('click', function () {
        state.routeTypes[f[0]] = !state.routeTypes[f[0]];
        b.setAttribute('aria-pressed', String(state.routeTypes[f[0]]));
        applyFilters();
      });
      rc.appendChild(b);
    });
    var all = el('button', { 'class': 'chip toggle', type: 'button', 'aria-pressed': 'false', title: 'Zapnout všechny kategorie a zrušit filtry' }, '↺ Vše');
    all.addEventListener('click', function () {
      state.cats = T.cats.map(function (c) { return c.id; });
      state.flags = {};
      buildChips();
      applyFilters();
    });
    flags.appendChild(all);
  }

  function applyFilters() {
    store('filters', state);
    T.places.forEach(function (p) {
      var vis = placeVisible(p);
      if (vis && !map.hasLayer(markers[p.id])) markers[p.id].addTo(map);
      if (!vis && map.hasLayer(markers[p.id])) map.removeLayer(markers[p.id]);
      var card = document.getElementById('place-' + p.id);
      if (card) card.hidden = !vis;
    });
    document.querySelectorAll('.cat-section').forEach(function (s) {
      s.hidden = !s.querySelector('.card:not([hidden])');
    });
    T.routes.forEach(function (r) {
      var vis = !!state.routeTypes[r.type] || selectedRoute === r.id;
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
    items.forEach(function (p) {
      var c = CATS[p.cat];
      var d = p.id === 'mlyn' ? 'chata' : (p.car && p.car.km > 6 ? '🚗 ' + fmtMin(p.car.min) : fmtKm(p.dist));
      var b = el('button', { type: 'button', 'data-id': p.id, style: '--c:' + catVar(p.cat) },
        '<span class="ico">' + c.emoji + '</span><span class="nm">' + esc(p.name) + (p.top ? ' ⭐' : '') + '</span><span class="dist">' + d + '</span>');
      b.addEventListener('click', function () { focusPlace(p.id, false); });
      b.addEventListener('mouseenter', function () { hl(p.id, true); });
      b.addEventListener('mouseleave', function () { hl(p.id, false); });
      box.appendChild(b);
    });
    if (!items.length) box.innerHTML = '<p class="muted small" style="padding:10px">Žádné místo neodpovídá filtrům.</p>';
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
    document.querySelectorAll('#mapList button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-id') === id); });
  }

  function showCard(id) {
    var card = document.getElementById('place-' + id);
    if (!card) return;
    if (card.hidden) {
      var p = PLACES[id];
      if (state.cats.indexOf(p.cat) < 0) state.cats.push(p.cat);
      state.flags = {};
      buildChips();
      applyFilters();
    }
    var det = card.querySelector('details');
    if (det) det.open = true;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('flash');
    setTimeout(function () { card.classList.remove('flash'); }, 1800);
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
    if (!navigator.geolocation) { alert('Prohlížeč neumí zjistit polohu.'); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      var ll = [pos.coords.latitude, pos.coords.longitude];
      if (me) map.removeLayer(me);
      me = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#1f6fd1', fillOpacity: 1 }).addTo(map)
        .bindPopup('Tady jste (±' + Math.round(pos.coords.accuracy) + ' m)').openPopup();
      map.setView(ll, 15);
    }, function () { alert('Polohu se nepodařilo zjistit.'); }, { enableHighAccuracy: true, timeout: 12000 });
  });

  // ------------------------------------------------------------ route selection
  function selectRoute(id, fromMap) {
    selectedRoute = selectedRoute === id && fromMap ? null : id;
    T.routes.forEach(function (r) {
      var lg = routeLayers[r.id];
      var sel = r.id === selectedRoute;
      lg.line.setStyle({ weight: sel ? 6 : 4, opacity: selectedRoute && !sel ? .3 : .9 });
      lg.casing.setStyle({ weight: sel ? 10 : 7, opacity: selectedRoute && !sel ? .3 : .85 });
      if (sel) { lg.addTo(map); lg.casing.bringToFront(); lg.line.bringToFront(); }
    });
    applyFilters();
    if (selectedRoute) {
      var r = ROUTES[selectedRoute];
      map.fitBounds(routeLayers[r.id].line.getBounds(), { padding: [30, 30] });
      if (fromMap) {
        var card = document.getElementById('route-' + r.id);
        if (card) { card.classList.add('flash'); setTimeout(function () { card.classList.remove('flash'); }, 1800); }
      }
    }
  }

  // ------------------------------------------------------------ program
  function linkChips(ids, kind) {
    return (ids || []).map(function (id) {
      if (kind === 'route') {
        var r = ROUTES[id];
        if (!r) return '';
        return '<button type="button" class="link-chip" data-route="' + id + '" style="--c:' + r.color + '"><span class="d" style="background:' + r.color + '">' + (r.type === 'bike' ? '🚲' : '🥾') + '</span>' + esc(r.name) + '</button>';
      }
      var p = PLACES[id];
      if (!p) return '';
      return '<button type="button" class="link-chip" data-place="' + id + '" style="--c:' + catVar(p.cat) + '"><span class="d">' + CATS[p.cat].emoji + '</span>' + esc(p.name) + '</button>';
    }).join('');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-place]');
    if (b) { focusPlace(b.getAttribute('data-place'), true); return; }
    var r = e.target.closest('[data-route]');
    if (r) {
      var id = r.getAttribute('data-route');
      document.getElementById('mapa').scrollIntoView({ behavior: 'smooth' });
      setTimeout(function () { selectRoute(id, false); }, 350);
    }
  });

  (function program() {
    var box = $('#days');
    T.program.days.forEach(function (d) {
      var sun = T.sun.filter(function (s) { return s.date === d.date; })[0];
      var h = '<header><div class="date">' + esc(d.label) + '</div><h3>' + esc(d.title) + '</h3>' +
        (sun ? '<div class="sun">🌅 ' + sun.rise + ' · 🌇 ' + sun.set + ' · tma ' + sun.dusk + '</div>' : '') +
        '<div class="small muted" style="margin-top:4px">' + esc(d.weather || '') + '</div></header><ol>';
      d.items.forEach(function (it) {
        h += '<li><div class="t">' + esc(it.time) + '</div><div>' + esc(it.text) + '</div>';
        var links = linkChips(it.routes, 'route') + linkChips(it.places, 'place');
        if (links) h += '<div class="links">' + links + '</div>';
        h += '</li>';
      });
      h += '</ol>';
      if (d.planB) {
        h += '<div class="planb"><b>☔ Plán B:</b> ' + esc(d.planB);
        if (d.planBRoutes) h += '<div class="links" style="margin-top:6px">' + linkChips(d.planBRoutes, 'route') + '</div>';
        h += '</div>';
      }
      box.appendChild(el('article', { 'class': 'day', id: 'day-' + d.id }, h));
    });
  })();

  // ------------------------------------------------------------ place cards
  (function places() {
    var box = $('#places');
    T.cats.forEach(function (c) {
      if (c.id === 'chata') return;
      var list = T.places.filter(function (p) { return p.cat === c.id; })
        .sort(function (a, b) { return (b.top ? 1 : 0) - (a.top ? 1 : 0) || a.dist - b.dist; });
      if (!list.length) return;
      var sec = el('div', { 'class': 'cat-section', id: 'cat-' + c.id, style: '--c:' + catVar(c.id) },
        '<h3><span class="dot">' + c.emoji + '</span>' + esc(c.name) + ' <span class="muted small">(' + list.length + ')</span></h3>');
      var grid = el('div', { 'class': 'cards' });
      list.forEach(function (p) {
        var h = '';
        if (p.img) {
          h += '<div class="ph"><img src="' + esc(p.img.src) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async">' +
            '<span class="credit">Foto: <a href="' + esc(p.img.page) + '" target="_blank" rel="noopener">' + esc(p.img.author) + '</a>, ' + esc(p.img.license) + '</span></div>';
        }
        h += '<div class="body"><div class="cat">' + c.emoji + ' ' + esc(c.name) + '</div><h4>' + esc(p.name) + '</h4>';
        var badges = '';
        if (p.top) badges += '<span class="badge top">⭐ top tip</span>';
        if (p.kids >= 3) badges += '<span class="badge kids">🧒 skvělé pro děti</span>';
        if (p.rain) badges += '<span class="badge rain">☔ i za deště</span>';
        if (badges) h += '<div class="badges">' + badges + '</div>';
        h += '<div class="teaser">' + esc(p.teaser) + '</div>';
        var acc = accessHtml(p);
        if (acc) h += '<div class="access">' + acc + '</div>';
        h += '<details class="more"><summary>Více</summary><p>' + esc(p.text) + '</p>';
        if (p.kidsNote) h += '<div class="kidsnote">🧒 ' + esc(p.kidsNote) + '</div>';
        if (p.info) h += '<p class="info">ℹ️ ' + esc(p.info) + '</p>';
        h += '</details><div class="actions">' +
          '<button type="button" class="btn small primary" data-place="' + p.id + '">Na mapě</button>' +
          '<a class="btn small" href="' + googleNav(p) + '" target="_blank" rel="noopener">Navigovat</a>' +
          '<a class="btn small" href="' + mapyShow(p) + '" target="_blank" rel="noopener">Mapy.com</a>';
        if (p.web) h += '<a class="btn small" href="' + esc(p.web) + '" target="_blank" rel="noopener">Web</a>';
        if (p.phone) h += '<a class="btn small" href="tel:' + esc(p.phone.replace(/\s/g, '')) + '">📞</a>';
        h += '</div></div>';
        grid.appendChild(el('article', { 'class': 'card', id: 'place-' + p.id, style: '--c:' + catVar(p.cat) }, h));
      });
      sec.appendChild(grid);
      box.appendChild(sec);
    });
  })();

  // ------------------------------------------------------------ routes
  var SURF = [
    ['asfalt', 'asfalt', '#6c7a89'],
    ['zpevnene', 'zpevněná cesta', '#c9a227'],
    ['nezpevnene', 'lesní/polní cesta', '#8d6e4a'],
    ['pesina', 'pěšina', '#2d8650']
  ];
  function profileSvg(r) {
    var W = 600, H = 84, padL = 0, padB = 3, padT = 6;
    var ele = r.geo.map(function (g) { return g[2]; });
    var min = Math.min.apply(null, ele), max = Math.max.apply(null, ele);
    var span = Math.max(max - min, 60);
    var lo = min - span * .08, hi = lo + span * 1.16;
    var total = r.cum[r.cum.length - 1] || 1;
    function x(d) { return padL + (W - padL) * d / total; }
    function y(e) { return padT + (H - padT - padB) * (1 - (e - lo) / (hi - lo)); }
    var line = '', area = '';
    r.geo.forEach(function (g, i) {
      var p = x(r.cum[i]).toFixed(1) + ',' + y(g[2]).toFixed(1);
      line += (i ? 'L' : 'M') + p;
    });
    area = line + 'L' + x(total).toFixed(1) + ',' + (H - padB) + 'L' + x(0).toFixed(1) + ',' + (H - padB) + 'Z';
    var s = '<svg class="profile" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Výškový profil: ' + Math.round(min) + '–' + Math.round(max) + ' m n. m.">';
    s += '<line class="grid" x1="0" x2="' + W + '" y1="' + y(max).toFixed(1) + '" y2="' + y(max).toFixed(1) + '"/>';
    s += '<line class="grid" x1="0" x2="' + W + '" y1="' + y(min).toFixed(1) + '" y2="' + y(min).toFixed(1) + '"/>';
    s += '<path class="area" d="' + area + '"/><path class="line" d="' + line + '"/>';
    s += '<line class="cursor" x1="-10" x2="-10" y1="0" y2="' + H + '" visibility="hidden"/></svg>';
    s += '<span class="ax top">' + Math.round(max) + ' m</span><span class="ax bot">' + Math.round(min) + ' m</span>' +
      '<span class="ax x0">0</span><span class="ax x1">' + fmtKm(total) + '</span>';
    return { svg: s, x: x, padL: padL, W: W, total: total };
  }
  function bindProfile(card, r, geom) {
    var svg = card.querySelector('svg.profile');
    var cursor = svg.querySelector('.cursor');
    var tip = card.querySelector('.profile-tip');
    function move(ev) {
      var rect = svg.getBoundingClientRect();
      var px = (ev.clientX - rect.left) / rect.width * geom.W;
      var d = Math.max(0, Math.min(geom.total, (px - geom.padL) / (geom.W - geom.padL) * geom.total));
      var lo = 0, hi = r.cum.length - 1;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (r.cum[mid] < d) lo = mid; else hi = mid; }
      var i = (d - r.cum[lo] < r.cum[hi] - d) ? lo : hi;
      var g = r.geo[i];
      var cx = geom.x(r.cum[i]);
      cursor.setAttribute('x1', cx); cursor.setAttribute('x2', cx); cursor.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.style.left = 'calc(34px + (100% - 34px) * ' + (cx / geom.W).toFixed(4) + ')';
      tip.textContent = fmtKm(r.cum[i]) + ' · ' + Math.round(g[2]) + ' m';
      if (!map.hasLayer(routeLayers[r.id])) routeLayers[r.id].addTo(map);
      hoverDot.setLatLng([g[0], g[1]]);
      if (!map.hasLayer(hoverDot)) hoverDot.addTo(map);
    }
    function leave() {
      cursor.setAttribute('visibility', 'hidden');
      tip.hidden = true;
      if (map.hasLayer(hoverDot)) map.removeLayer(hoverDot);
    }
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', leave);
  }

  (function routes() {
    var box = $('#routes');
    var tabs = $('#routeTabs');
    var filter = 'all';
    [['all', 'Vše'], ['bike', '🚲 Na kolo'], ['hike', '🥾 Pěšky']].forEach(function (t) {
      var b = el('button', { 'class': 'chip toggle', type: 'button', 'aria-pressed': String(t[0] === 'all') }, t[1]);
      b.addEventListener('click', function () {
        filter = t[0];
        tabs.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        box.querySelectorAll('.route').forEach(function (c) { c.hidden = filter !== 'all' && c.getAttribute('data-type') !== filter; });
      });
      tabs.appendChild(b);
    });
    var LEVEL = { easy: 'lehká', medium: 'střední', hard: 'náročná' };
    T.routes.forEach(function (r) {
      var geom = profileSvg(r);
      var h = '<div class="rhead"><div><div class="type">' + (r.type === 'bike' ? '🚲 na kolo' : '🥾 pěšky') + (r.loop ? ' · okruh' : '') + '</div>' +
        '<h4>' + esc(r.name) + '</h4></div><span class="level ' + r.level + '">' + LEVEL[r.level] + ' · děti ' + esc(r.kids) + '</span></div>';
      h += '<div class="teaser">' + esc(r.teaser) + '</div>';
      h += '<div class="stats"><div class="stat"><b>' + fmtKm(r.km) + '</b><span>délka</span></div>' +
        '<div class="stat"><b>↑ ' + r.up + ' m</b><span>stoupání</span></div>' +
        '<div class="stat"><b>' + fmtDur(r.minKids) + '</b><span>s dětmi, bez zastávek</span></div>' +
        '<div class="stat"><b>' + r.maxEle + ' m</b><span>nejvýš n. m.</span></div></div>';
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
      h += '<div class="profile-wrap">' + geom.svg + '<span class="profile-tip" hidden></span></div>';
      if (r.stops && r.stops.length) h += '<div class="stops">' + linkChips(r.stops, 'place') + '</div>';
      h += '<details class="more"><summary>Popis trasy</summary><p>' + esc(r.text) + '</p>' +
        (r.tip ? '<div class="kidsnote">💡 ' + esc(r.tip) + '</div>' : '') +
        '<p class="info">📍 Start: ' + esc(r.start || (r.loop ? 'od mlýna (okruh)' : 'od mlýna')) + '</p></details>';
      h += '<div class="actions" style="display:flex;flex-wrap:wrap;gap:6px">' +
        '<button type="button" class="btn small primary" data-route="' + r.id + '">Ukázat na mapě</button>' +
        '<a class="btn small" href="' + esc(r.gpx) + '" download>⬇ GPX</a>' +
        '<a class="btn small" href="' + esc(r.mapy) + '" target="_blank" rel="noopener">Mapy.com</a>' +
        (r.start ? '<a class="btn small" href="' + googleNav({ lat: r.geo[0][0], lon: r.geo[0][1] }) + '" target="_blank" rel="noopener">🚗 Na start</a>' : '') + '</div>';
      var card = el('article', { 'class': 'route', id: 'route-' + r.id, 'data-type': r.type, style: '--rc:' + r.color }, h);
      box.appendChild(card);
      bindProfile(card, r, geom);
    });
  })();

  // ------------------------------------------------------------ chata
  (function chata() {
    var m = PLACES.mlyn;
    var box = $('#chataBox');
    var c = T.chata;
    var photo = m.img ? '<div class="card" style="box-shadow:none;margin:-4px 0 12px"><div class="ph"><img src="' + esc(m.img.src) + '" alt="Mlýn Vikinek v Cikháji" loading="lazy">' +
      '<span class="credit">Foto: <a href="' + esc(m.img.page) + '" target="_blank" rel="noopener">' + esc(m.img.author) + '</a>, ' + esc(m.img.license) + '</span></div></div>' : '';
    var left = '<div class="panel"><h3>🏠 ' + esc(m.name) + '</h3>' + photo + '<p>' + esc(m.text) + '</p><dl class="kv">' +
      '<dt>Adresa</dt><dd>' + esc(c.address) + '</dd>' +
      '<dt>GPS</dt><dd><button type="button" class="btn small" id="copyGps">' + MILL.lat.toFixed(5) + ' N, ' + MILL.lon.toFixed(5) + ' E 📋</button></dd>' +
      '<dt>Kontakt</dt><dd><a href="tel:+420602768375">+420 602 768 375</a> · <a href="mailto:info@mlyn-vikinek.cz">info@mlyn-vikinek.cz</a></dd>' +
      '<dt>Kapacita</dt><dd>' + esc(c.capacity) + '</dd>' +
      '<dt>Vybavení</dt><dd>' + esc(c.amenities) + '</dd>' +
      '<dt>Web</dt><dd><a href="https://mlyn-vikinek.cz/" target="_blank" rel="noopener">mlyn-vikinek.cz</a></dd></dl>' +
      '<div class="note">⚠️ ' + esc(c.note) + '</div></div>';
    var right = '<div class="panel"><h3>🚗 Jak se k nám dostat</h3><p class="muted small">Orientační čas jízdy autem (OSRM, bez provozu):</p><div class="drive">';
    Object.keys(T.fromCities).forEach(function (k) {
      var f = T.fromCities[k];
      right += '<div class="stat"><b>' + fmtMin(f.min) + '</b><span>z ' + esc(k) + ' · ' + f.km + ' km</span></div>';
    });
    right += '</div><div class="row" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">' +
      '<a class="btn primary" href="' + googleNav(m) + '" target="_blank" rel="noopener">Navigovat (Google)</a>' +
      '<a class="btn" href="' + mapyShow(m) + '" target="_blank" rel="noopener">Mlýn v Mapy.com</a>' +
      '<a class="btn" href="gpx/vysocina-2026-mista.gpx" download>⬇ Všechna místa (GPX)</a></div>' +
      '<h3 style="margin-top:18px">🛒 Nejbližší služby</h3><ul class="checklist">';
    c.services.forEach(function (id) {
      var p = PLACES[id];
      if (!p) return;
      right += '<li><span class="t"><a href="#place-' + id + '" data-card="' + id + '">' + esc(p.name) + '</a><span class="how">' + esc(p.teaser) + ' · ' +
        (p.car && p.car.km > 1.5 ? '🚗 ' + fmtMin(p.car.min) : fmtKm(p.dist)) + '</span></span></li>';
    });
    right += '</ul></div>';
    box.innerHTML = left + right;
    $('#copyGps').addEventListener('click', function (e) {
      var t = MILL.lat.toFixed(5) + ', ' + MILL.lon.toFixed(5);
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { e.target.textContent = 'Zkopírováno ✓'; });
    });
  })();

  // ------------------------------------------------------------ practical
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
    var p1 = el('div', { 'class': 'panel' }, '<h3>📞 Rezervovat předem</h3>');
    p1.appendChild(checklist('res', T.program.reservations));
    var sunRows = T.sun.map(function (s) {
      return '<tr><td>' + esc(s.label) + '</td><td>' + s.rise + '</td><td>' + s.set + '</td><td>' + s.dusk + '</td></tr>';
    }).join('');
    var p2 = el('div', { 'class': 'panel' },
      '<h3>🌦️ Počasí a světlo</h3><p>' + esc(T.weather.text) + '</p>' +
      '<table class="sun"><thead><tr><th>Den</th><th>Východ</th><th>Západ</th><th>Tma</th></tr></thead><tbody>' + sunRows + '</tbody></table>' +
      '<p class="small" style="margin-top:10px">🌑 ' + esc(T.weather.moon) + '</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' + T.weather.links.map(function (l) {
        return '<a class="btn small" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.name) + '</a>';
      }).join('') + '</div>');
    var p3 = el('div', { 'class': 'panel' }, '<h3>🎒 Co s sebou</h3>');
    p3.appendChild(checklist('pack', T.program.packing));
    p3.appendChild(el('div', { 'class': 'note', style: 'margin-top:12px' },
      '<b>Tísňová volání:</b> 112 · záchranka 155 · hasiči 150 · policie 158<br>Nemocnice: Nové Město na Moravě · lékárna o víkendu: Benu Žďár (8–20)'));
    var p4 = el('div', { 'class': 'panel' }, '<h3>🧭 Úkoly pro malé průzkumníky</h3><p class="small muted">Kdo splní nejvíc úkolů?</p>');
    p4.appendChild(checklist('quest', T.program.quests || []));
    box.appendChild(p1); box.appendChild(p2); box.appendChild(p4); box.appendChild(p3);
  })();

  // ------------------------------------------------------------ credits
  $('#credits').innerHTML = T.credits;

  // ------------------------------------------------------------ start
  buildChips();
  applyFilters();
  fitLocal();
  if (location.hash && location.hash.indexOf('#place-') === 0) setTimeout(function () { showCard(location.hash.slice(7)); }, 300);

  // aktivní odkaz v navigaci
  var links = Array.prototype.slice.call(document.querySelectorAll('.topnav a'));
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('section.block').forEach(function (s) { io.observe(s); });
  }

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
