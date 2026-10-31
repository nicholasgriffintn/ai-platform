import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { syncAnalyticsIdentity } from "../lib/analytics/client.js";

export function useAnalyticsIdentity() {
  const { isAuthenticated, user } = useChatStore(
    useShallow((state) => ({ isAuthenticated: state.isAuthenticated, user: state.user })),
  );

  useEffect(() => {
    syncAnalyticsIdentity({
      isAuthenticated,
      user,
      beacon: typeof window !== "undefined" ? window.Beacon : undefined,
    });
  }, [isAuthenticated, user]);
}
