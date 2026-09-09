import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    const host = window.location.host;
    const isLocalhost = host?.startsWith("localhost");

    if (!isLocalhost && "serviceWorker" in navigator) {
      const register = async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js");

          console.log("SW registered: ", registration);

          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;

            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("New service worker available");
                }
              });
            }
          });
        } catch (error) {
          console.error("Service worker registration failed:", error);
        }
      };

      void register();

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("New service worker activated");
      });
    }
  }, []);

  return null;
}
