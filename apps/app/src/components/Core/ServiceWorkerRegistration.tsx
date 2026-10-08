import { useEffect } from "react";

import { announceClientUpdate } from "./client-update";

function activateWaitingWorker(registration: ServiceWorkerRegistration) {
  const waiting = registration.waiting;

  if (!waiting) {
    window.location.reload();

    return;
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), {
    once: true,
  });
  waiting.postMessage({ type: "SKIP_WAITING" });
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    const host = window.location.host;
    const isLocalhost = host?.startsWith("localhost");

    if (isLocalhost || !("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;

          newWorker?.addEventListener("statechange", () => {
            if (
              !cancelled &&
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              announceClientUpdate(() => activateWaitingWorker(registration));
            }
          });
        });
      } catch (error) {
        console.error("Service worker registration failed:", error);
      }
    };

    void register();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
