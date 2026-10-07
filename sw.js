/* Inkwell service worker — caches the whole app so it opens with no network at all. */
const CACHE = 'inkwell-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/proofreader.js', './js/db.js', './js/exporter.js', './js/sketch.js', './js/app.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache-first for app files; refresh the cache in the background when online.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((cached) => {
    const network = fetch(e.request).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
