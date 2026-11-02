/* Build replaces these tokens with a content-derived version and asset list. */
const CACHE_NAME = 'bingo-static-__BUILD_VERSION__';
const PRECACHE = __PRECACHE_ASSETS__;
const ASSETS = new Set(PRECACHE);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache =>
    cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' })))));
  // Updates wait until existing app windows close. Never interrupt a live game.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('bingo-static-') && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Never cache credentials, API responses, live room state, or socket traffic.
  if (url.pathname.startsWith('/api/') || url.pathname === '/api' || url.pathname.startsWith('/socket.io')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () =>
      (await caches.open(CACHE_NAME)).match('/offline.html')));
    return;
  }
  if (!ASSETS.has(url.pathname) || url.search) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
