---
"@assistant/desktop": patch
---

Stop the deep link subscription throwing into nothing when the event bridge refuses.

`useDeepLinkNavigation` called `listen` and never handled the promise rejecting, so a bridge that could not start the subscription produced an unhandled rejection and the window went on believing it was listening for `polychat://` links. Driving the renderer outside a Tauri window surfaced it as an uncaught `transformCallback` error on every mount.

Subscribing moved into `subscribeToDeepLinks`, which takes the listener as an argument. It handles a refused subscription, stops listening when the window is done with it even if the subscription resolves after that, and ignores a link that arrives once it has stopped — all of which are now covered by tests that need neither a browser nor the bridge.
