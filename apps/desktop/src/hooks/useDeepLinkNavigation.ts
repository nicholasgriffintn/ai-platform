import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useNavigate } from "react-router";

import { DEEP_LINK_EVENT, readDeepLinkPath } from "../lib/deep-links";

export function useDeepLinkNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    const listening = listen(DEEP_LINK_EVENT, (event) => {
      const path = readDeepLinkPath(event.payload);

      if (path) {
        void navigate(path);
      }
    });

    return () => {
      void listening.then((stopListening) => stopListening());
    };
  }, [navigate]);
}
