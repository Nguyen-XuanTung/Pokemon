const CACHE_PREFIX = 'lingowild-cache-';
const CACHE_VERSION = 'v2';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

// __PRECACHE_MANIFEST__ is populated at build time by scripts/inject-sw-manifest.ts
const PRECACHE_URLS = [
  './',
  './index.html',
  './assets/sprites/tileset.png',
  './assets/sprites/characters.png',
  './assets/sprites/creatures.png',
  './assets/sprites/items.png',
  './assets/sprites/vfx.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

function isNavigationDocumentRequest(req) {
  if (req.mode === 'navigate' || req.destination === 'document') {
    return true;
  }
  const accept = req.headers.get('accept') || '';
  return accept.includes('text/html') && !req.destination;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Scope strictly to the service worker's registration directory
  const scopePath = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(scopePath)) return;

  if (isNavigationDocumentRequest(req)) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const copy = networkRes.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkRes;
        })
        .catch(() =>
          caches
            .open(CACHE_NAME)
            .then(
              (cache) =>
                cache.match(req, { ignoreSearch: true }) ||
                cache.match('./index.html') ||
                cache.match('./'),
            )
            .then(
              (cached) =>
                cached ||
                new Response('Offline document unavailable', {
                  status: 503,
                  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                }),
            ),
        ),
    );
    return;
  }

  // Static subresources (JS, CSS, PNG, JSON): NEVER fall back to index.html
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) {
        // Refresh in background if online, return cached immediately for snappy cold/offline load
        void fetch(req)
          .then((netRes) => {
            if (netRes && netRes.ok) {
              void cache.put(req, netRes.clone());
            }
          })
          .catch(() => {});
        return cached;
      }
      try {
        const netRes = await fetch(req);
        if (netRes && netRes.ok) {
          await cache.put(req, netRes.clone());
        }
        return netRes;
      } catch {
        return new Response('Offline resource unavailable', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    }),
  );
});
