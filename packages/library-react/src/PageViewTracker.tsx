import { useEffect } from "react";
import { useLocation } from "react-router";

import { useTrackEvent } from "./hooks/use-track-event.js";

export function PageViewTracker() {
  const { pathname } = useLocation();
  const { trackNavigation } = useTrackEvent();

  useEffect(() => {
    trackNavigation(pathname);
  }, [pathname, trackNavigation]);

  return null;
}
