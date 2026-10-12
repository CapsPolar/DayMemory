// DayMemory AI - Service Worker
// Caches the app shell so it works fully offline once installed.

const CACHE_NAME = 'daymemory-cache-v2';

// Files with stable names, known ahead of time. Vite's built JS/CSS bundle
// has a hashed filename we can't list here, so it (and anything else)
// gets cached on first fetch by the handler below instead.
const APP_SHELL = [
  '/',
  '/style.css',
  '/crypto-js.min.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
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
// This also picks up Vite's hashed /assets/*.js and *.css bundle files
// the first time they're requested, since we can't know their names in
// advance. NOTE: this intentionally only intercepts requests for the
// app's own static files. Any request to a different origin (e.g. a local
// Ollama endpoint you configure in Settings) is left alone and goes
// straight to the network, since that's a runtime API call, not part of
// the app shell.
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
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
    })
  );
});
