/**
 * Mermaid Quest Academy — Service Worker
 * Strategy: cache-first for app-shell assets, network-only for TTS API calls.
 *
 * Assets (JS, CSS) are dynamically cached on first fetch so that subsequent
 * visits and offline mode are fully supported after the initial page load.
 */

const CACHE_NAME = 'mqa-shell-v1';

/**
 * Core HTML shell to pre-cache on install so the app boots even before any
 * other assets have been fetched.
 */
const PRECACHE_URLS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  // Activate the new SW immediately without waiting for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      ),
  );
  // Take control of all open clients right away
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Pass through cross-origin requests (e.g. TTS server, CDN fonts) untouched
  if (url.origin !== self.location.origin) return;

  // Pass through non-GET requests (e.g. POST to /tts)
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // Only cache successful same-origin responses
        if (!response.ok || response.type === 'opaque') return response;

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        return response;
      });
    }),
  );
});
