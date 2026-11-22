/* Koka Service Worker — PWA Caching & Push Notifications */

const CACHE_VERSION = "koka-v3";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const AIRING_IMAGES_CACHE = `${CACHE_VERSION}-airing-images`;
const MAX_AIRING_IMAGES = 60;

const PRECACHE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/favicon96.png",
  "/icon-192.png",
  "/icon-512.png",
];

// Clean up old caches on activate & precache individually
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch {}
      }
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (!key.startsWith(CACHE_VERSION)) {
              return caches.delete(key);
            }
          }),
        ),
      )
      .then(() => self.clients.claim()),
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

  // 1. AniList GraphQL API caching (POST requests for titles, synopsis, schedules)
  if (url.hostname === "graphql.anilist.co" && request.method === "POST") {
    event.respondWith(
      (async () => {
        let bodyText = "";
        try {
          bodyText = await request.clone().text();
        } catch {}

        const cacheKey = new Request(
          `https://koka-graphql.internal/cache?q=${encodeURIComponent(bodyText)}`,
        );

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(DATA_CACHE).then((cache) => cache.put(cacheKey, clone));
          }
          return networkResponse;
        } catch (err) {
          const cached = await caches.match(cacheKey);
          if (cached) return cached;
          throw err;
        }
      })(),
    );
    return;
  }

  // Skip any other non-GET requests (e.g. server mutations)
  if (request.method !== "GET") return;

  // 2. Navigation requests (HTML Pages) -> Network-first with Shell fallback
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
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const root = await caches.match("/");
          if (root) return root;
          return new Response("Offline", {
            status: 503,
            statusText: "Offline",
            headers: { "Content-Type": "text/html" },
          });
        }),
    );
    return;
  }

  // 3. Static Assets (Scripts, Styles, Fonts, Manifest, Icons, Chunks) -> Cache-first with network revalidate
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/assets/") ||
      url.pathname.startsWith("/_build/") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".woff2") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".ico") ||
      url.pathname.endsWith(".webmanifest"))
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Revalidate in background if online
          if (navigator.onLine) {
            fetch(request)
              .then((res) => {
                if (res && res.status === 200) {
                  const clone = res.clone();
                  caches.open(SHELL_CACHE).then((c) => c.put(request, clone));
                }
              })
              .catch(() => {});
          }
          return cached;
        }

        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Never return null or undefined to respondWith
            return new Response("", {
              status: 408,
              statusText: "Offline Asset Unavailable",
            });
          });
      }),
    );
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
          .catch(() => cached || new Response("", { status: 404 }));
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
