/* Koka service worker — only used to show notifications and handle taps.
   (Android Chrome and installed PWAs refuse `new Notification()`; they need
   ServiceWorkerRegistration.showNotification().) No caching, no fetch handler. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
