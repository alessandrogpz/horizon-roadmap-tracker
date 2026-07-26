// Bump the version whenever cached-asset behavior changes; activation deletes
// all older caches so a new deploy can't be served stale forever.
const CACHE_NAME = "dev-tracker-cache-v3";
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept non-GET requests, cross-origin requests (Google APIs,
  // GitHub API), or the app's own API routes — those must always be live.
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Network-first with cache fallback, so the app stays fresh online and
  // still opens offline.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cachedResponse) =>
            cachedResponse ||
            new Response("Offline content not available", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
        )
      )
  );
});
