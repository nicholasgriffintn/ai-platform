importScripts("https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js");

const { registerRoute, setDefaultHandler } = workbox.routing;
const { CacheFirst, NetworkOnly } = workbox.strategies;
const { CacheableResponsePlugin } = workbox.cacheableResponse;
const { ExpirationPlugin } = workbox.expiration;

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = {};
  }

  const notification = payload.notification ?? payload;
  const data = notification.data ?? {};

  event.waitUntil(
    self.registration.showNotification(notification.title ?? "Polychat task update", {
      body: notification.body ?? "A task has changed.",
      tag: data.itemId ?? "polychat-task-update",
      data: { itemId: data.itemId, deepLink: data.deepLink },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  let target = new URL("/work", self.location.origin);

  try {
    const candidate = new URL(event.notification.data?.deepLink ?? "/work", self.location.origin);

    if (candidate.origin === self.location.origin) {
      target = candidate;
    }
  } catch {
    target = new URL("/work", self.location.origin);
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => new URL(client.url).origin === target.origin);

      if (existing) {
        return existing.navigate(target.href).then(() => existing.focus());
      }

      return clients.openWindow(target.href);
    }),
  );
});

const CACHE_NAME = "polychat-pwa-v1";

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME && !cacheName.startsWith("workbox-"))
            .map((cacheName) => caches.delete(cacheName)),
        );
      })
      .then(() => clients.claim()),
  );
});

registerRoute(
  ({ request }) => request.destination === "assets",
  new CacheFirst({
    cacheName: "static-assets",
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  }),
);

setDefaultHandler(
  new NetworkOnly({
    cacheName: "default-cache",
  }),
);
