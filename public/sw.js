/* Koka Service Worker — PWA Caching & Push Notifications */

const CACHE_VERSION = "koka-v2";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const AIRING_IMAGES_CACHE = `${CACHE_VERSION}-airing-images`;
const MAX_AIRING_IMAGES = 60;

const PRECACHE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
];

// Clean up old caches on activate
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (!key.startsWith(CACHE_VERSION)) {
            return caches.delete(key);
          }
        }),
      ),
    ).then(() => self.clients.claim()),
  );
});

// Helper: Trim cache size to prevent bloat
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      await cache.delete(keys[0]);
      trimCache(cacheName, maxItems);
    }
  } catch {}
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests (e.g. server functions, mutations)
  if (request.method !== "GET") return;

  // 1. Navigation requests (HTML Pages) -> Network-first with Shell fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/")),
        ),
    );
    return;
  }

  // 2. Static Assets (Scripts, Styles, Fonts, Manifest, Icons) -> Stale-while-revalidate
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/assets/") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".woff2") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".ico") ||
      url.pathname.endsWith(".webmanifest"))
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => null);

        return cached || fetchPromise;
      }),
    );
    return;
  }

  // 3. AniList GraphQL API caching (Titles, Synopsis, Metadata for offline support)
  if (url.hostname === "graphql.anilist.co") {
    // Note: AniList queries are usually POST, but if GET or cached via client we handle
    return;
  }

  // 4. External Images (AniList CDN, etc.)
  if (
    request.destination === "image" ||
    url.hostname.includes("anilist.co") ||
    /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(url.pathname)
  ) {
    const referrer = request.referrer || "";

    // DO NOT cache images from library or discover (/seasons) to avoid bloat
    const isFromLibraryOrDiscover =
      referrer.includes("/library") ||
      referrer.includes("/seasons") ||
      referrer.includes("/discover");

    if (isFromLibraryOrDiscover) {
      // Direct network pass-through, do NOT store in cache
      return;
    }

    // Only cache images from the home page / current airing
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(AIRING_IMAGES_CACHE).then((cache) => {
                cache.put(request, clone);
                trimCache(AIRING_IMAGES_CACHE, MAX_AIRING_IMAGES);
              });
            }
            return networkResponse;
          })
          .catch(() => cached);
      }),
    );
    return;
  }
});

// Notification handling
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("focus" in client) {
            if ("navigate" in client) client.navigate(target).catch(() => {});
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
