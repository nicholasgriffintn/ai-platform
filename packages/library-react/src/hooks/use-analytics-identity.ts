import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useEffect } from "react";

import { syncAnalyticsIdentity } from "../lib/analytics/client.js";

export function useAnalyticsIdentity() {
  const { isAuthenticated, user } = useChatStore();

  useEffect(() => {
    syncAnalyticsIdentity({
      isAuthenticated,
      user,
      beacon: typeof window !== "undefined" ? window.Beacon : undefined,
    });
  }, [isAuthenticated, user]);
}
