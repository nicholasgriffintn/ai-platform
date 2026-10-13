import { useEffect } from "react";

import { announceClientUpdate, fetchDeployedBuildId, reloadAfterChunkError } from "./client-update";

const VERSION_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function ClientUpdateWatcher() {
  useEffect(() => {
    const handlePreloadError = (event: Event) => {
      if (reloadAfterChunkError()) {
        event.preventDefault();
      }
    };

    window.addEventListener("vite:preloadError", handlePreloadError);

    if (import.meta.env.DEV) {
      return () => window.removeEventListener("vite:preloadError", handlePreloadError);
    }

    let announced = false;
    const checkForUpdate = async () => {
      if (announced || document.visibilityState !== "visible") {
        return;
      }

      const deployed = await fetchDeployedBuildId();

      if (deployed && deployed !== __POLYCHAT_BUILD_ID__) {
        announced = true;
        announceClientUpdate(() => window.location.reload());
      }
    };

    const handleVisibilityChange = () => void checkForUpdate();
    const interval = window.setInterval(handleVisibilityChange, VERSION_CHECK_INTERVAL_MS);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("vite:preloadError", handlePreloadError);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
