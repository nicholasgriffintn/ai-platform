import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useEffect } from "react";

import { syncAnalyticsIdentity } from "../lib/analytics/client.js";
import { usePostHogClient } from "./use-posthog-client.js";

export function useAnalyticsIdentity() {
  const { isAuthenticated, user } = useChatStore();
  const posthog = usePostHogClient();

  useEffect(() => {
    syncAnalyticsIdentity({
      isAuthenticated,
      user,
      posthog,
      beacon: typeof window !== "undefined" ? window.Beacon : undefined,
    });
  }, [isAuthenticated, user, posthog]);
}
