importScripts(
	"https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js",
);

const { registerRoute, setDefaultHandler } = workbox.routing;
const { CacheFirst, NetworkOnly } = workbox.strategies;
const { CacheableResponsePlugin } = workbox.cacheableResponse;
const { ExpirationPlugin } = workbox.expiration;

self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "SKIP_WAITING") {
		self.skipWaiting();
	}
});

// Cache name with version
const CACHE_NAME = "polychat-pwa-v1";

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((cacheNames) => {
				return Promise.all(
					cacheNames.map((cacheName) => {
						if (cacheName !== CACHE_NAME && !cacheName.startsWith("workbox-")) {
							return caches.delete(cacheName);
						}
					}),
				);
			})
			.then(() => clients.claim()),
	);
});

// Cache static assets
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

// Default handler
setDefaultHandler(
	new NetworkOnly({
		cacheName: "default-cache",
	}),
);
