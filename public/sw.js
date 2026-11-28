const CACHE_PREFIX = 'lingowild-cache-';
const CACHE_VERSION = 'v3-dev';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

// Populated deterministically at build time by scripts/inject-sw-manifest.ts
const PRECACHE_URLS = [
  './',
  './index.html',
  './assets/sprites/battle-bg.png',
  './assets/sprites/characters.png',
  './assets/sprites/companions.png',
  './assets/sprites/creatures.png',
  './assets/sprites/items.png',
  './assets/sprites/structures.png',
  './assets/sprites/tileset.png',
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
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  } else if (event.data.type === 'GET_CACHE_INFO' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({
      cacheName: CACHE_NAME,
      version: CACHE_VERSION,
      precacheCount: PRECACHE_URLS.length,
    });
  }
});

function isNavigationDocumentRequest(req) {
  if (req.mode === 'navigate' || req.destination === 'document') {
    return true;
  }
  const accept = req.headers.get('accept') || '';
  return accept.includes('text/html') && !req.destination;
}

async function matchOfflineDocumentFallback(cache, req) {
  const exact = await cache.match(req, { ignoreSearch: true });
  if (exact) return exact;
  const indexDoc = await cache.match('./index.html');
  if (indexDoc) return indexDoc;
  const rootDoc = await cache.match('./');
  if (rootDoc) return rootDoc;
  return new Response('Offline document unavailable', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
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
        .catch(() => caches.open(CACHE_NAME).then((cache) => matchOfflineDocumentFallback(cache, req))),
    );
    return;
  }

  // Static subresources (JS, CSS, PNG, JSON): NEVER fall back to index.html
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) {
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
