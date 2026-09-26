/* Offline záloha průvodce: stránka, data, fotky a GPX se po první návštěvě uloží do mezipaměti.
   Strategie „nejdřív síť“: online se vždy načte aktuální verze, bez signálu poslouží uložená.
   Mapové dlaždice se neukládají (načítají se z mapových serverů). */
var CACHE = 'vysocina26-v2';
var CORE = ['./', 'index.html', 'assets/style.css', 'assets/app.js', 'data/trip.js',
  'vendor/leaflet/leaflet.css', 'vendor/leaflet/leaflet.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) { return hit || caches.match('index.html'); });
  }));
});
