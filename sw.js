const CACHE_NAME = 'rsc-app-v26';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/utils.js',
  './js/store.js',
  './js/sync.js',
  './js/modules.js',
  './js/crud.js',
  './js/dashboard.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192-v2.png',
  './icons/icon-512-v2.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  /* 동기화 API 요청은 캐시하지 않는다 (항상 최신 데이터 필요) */
  if (event.request.url.includes('api.github.com')) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      }).catch(() => cached);
    })
  );
});
