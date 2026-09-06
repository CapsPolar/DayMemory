// DayMemory AI - Service Worker
// Caches the entire app shell so it works fully offline once installed.

const CACHE_NAME = 'daymemory-cache-v1';

// Everything the app needs to run with zero network access.
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './crypto-js.min.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: pre-cache the app shell.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old cache versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first, falling back to network, then updating the cache.
// NOTE: this intentionally only intercepts requests for the app's own
// static files. Any request to a different origin (e.g. a local Ollama
// endpoint you configure in Settings) is left alone and goes straight
// to the network, since that's a runtime API call, not part of the app shell.
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) {
    return; // let non-app requests (e.g. your Ollama server) pass through untouched
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          // Cache a copy of newly fetched app-shell files for next time offline.
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch(() => {
          // Offline and not cached: for navigations, fall back to index.html.
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});