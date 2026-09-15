import { useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router";

import { getProjectCanvasPath } from "../lib/conversation-route.js";
import { getPlacePaths, getProductMode } from "../lib/navigation/places.js";
import { useUIStore } from "../state/stores/uiStore.js";
import { useTrackEvent } from "./use-track-event.js";

export function useOpenCanvas() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { workspaceId, projectId } = useParams<"workspaceId" | "projectId">();
  const { trackEvent } = useTrackEvent();
  const openProjectPicker = useUIStore((state) => state.openProjectPicker);

  return useCallback(() => {
    const mode = getProductMode(pathname);

    trackEvent({
      name: "open_canvas",
      category: "sidebar",
      label: mode === "work" ? (projectId ? "project" : "project_picker_open") : "chat",
      value: 1,
    });

    if (mode === "work" && workspaceId && projectId) {
      void navigate(getProjectCanvasPath(workspaceId, projectId));

      return;
    }

    if (mode === "work") {
      openProjectPicker("canvas");

      return;
    }

    void navigate(getPlacePaths("chat").canvas);
  }, [navigate, openProjectPicker, pathname, projectId, trackEvent, workspaceId]);
}
