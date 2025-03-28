import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    const host = window.location.host;
    const isLocalhost = host?.startsWith("localhost");

    if (!isLocalhost && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("SW registered: ", registration);

          // Check for updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  // New service worker available
                  console.log("New service worker available");
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error("Service worker registration failed:", error);
        });

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("New service worker activated");
      });
    }
  }, []);

  return null;
}
