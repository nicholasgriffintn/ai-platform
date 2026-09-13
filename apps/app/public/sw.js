const STATIC_CACHE = "polychat-static-v1";
const LEGACY_CACHES = new Set(["polychat-pwa-v1"]);
const MAX_ENTRIES = 100;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const CACHEABLE_DESTINATIONS = new Set(["script", "style", "image", "font"]);

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

function isFresh(cachedDateHeader) {
  if (!cachedDateHeader) {
    return false;
  }

  const cachedTime = Date.parse(cachedDateHeader);

  if (Number.isNaN(cachedTime)) {
    return false;
  }

  return Date.now() - cachedTime < MAX_AGE_SECONDS * 1000;
}

async function trimCache(cache) {
  const keys = await cache.keys();

  if (keys.length <= MAX_ENTRIES) {
    return;
  }

  await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).map((key) => cache.delete(key)));
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached && isFresh(cached.headers.get("date"))) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (response && (response.status === 200 || response.status === 0)) {
      const cacheControl = response.headers.get("cache-control") ?? "";

      if (!cacheControl.includes("no-store")) {
        await cache.put(request, response.clone());
        await trimCache(cache);
      }
    }

    return response;
  } catch (error) {
    if (cached) {
      return cached;
    }

    throw error;
  }
}

function shouldBypass(request, url) {
  if (url.pathname.startsWith("/__manifest")) {
    return true;
  }

  if (url.origin !== self.location.origin) {
    return true;
  }

  return false;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  if (!CACHEABLE_DESTINATIONS.has(request.destination)) {
    return;
  }

  const url = new URL(request.url);

  if (shouldBypass(request, url)) {
    return;
  }

  if (url.pathname === "/sw.js") {
    return;
  }

  event.respondWith(cacheFirst(request));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName !== STATIC_CACHE &&
                (cacheName.startsWith("workbox-") || LEGACY_CACHES.has(cacheName)),
            )
            .map((cacheName) => caches.delete(cacheName)),
        );
      })
      .then(() => clients.claim()),
  );

  event.waitUntil(
    (async () => {
      if ("navigationPreload" in self.registration) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {
          // Navigation preload is best-effort.
        }
      }
    })(),
  );
});
