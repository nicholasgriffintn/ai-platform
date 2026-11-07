import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { runWhenIdle } from "@ngriffin_uk/polychat-utility-react";
import { useEffect } from "react";

import { preloadResponseViews } from "../Content/customResponseViews.js";
import { preloadFileViewerOverlay } from "../Files/Viewer/LazyFileViewerOverlay.js";
import { preloadPolyPanel } from "./LazyPolyPanel.js";

const PRELOAD_DEADLINE_MS = 2000;

export function usePreloadPolyPanel() {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    return runWhenIdle(() => {
      preloadPolyPanel();
      preloadFileViewerOverlay();
      preloadResponseViews();
    }, PRELOAD_DEADLINE_MS);
  }, [isAuthenticated]);
}
