import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router";

import { getProjectChatPath } from "../lib/conversation-route.js";
import { getProductMode, MODE_BASE_PATHS } from "../lib/navigation/places.js";
import { useUIStore } from "../state/stores/uiStore.js";
import { useTrackEvent } from "./use-track-event.js";

export function useStartNewChat() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { workspaceId, projectId } = useParams<"workspaceId" | "projectId">();
  const { trackEvent } = useTrackEvent();
  const clearCurrentConversation = useChatStore((state) => state.clearCurrentConversation);
  const setShowProjectPicker = useUIStore((state) => state.setShowProjectPicker);

  return useCallback(() => {
    const mode = getProductMode(pathname);

    trackEvent({
      name: "new_chat",
      category: "sidebar",
      label: mode === "work" ? (projectId ? "project" : "project_picker_open") : "chat",
      value: 1,
    });

    if (mode === "work" && workspaceId && projectId) {
      clearCurrentConversation();
      void navigate(getProjectChatPath(workspaceId, projectId));

      return;
    }

    if (mode === "work") {
      setShowProjectPicker(true);

      return;
    }

    clearCurrentConversation();
    void navigate(MODE_BASE_PATHS.chat);
  }, [
    clearCurrentConversation,
    navigate,
    pathname,
    projectId,
    setShowProjectPicker,
    trackEvent,
    workspaceId,
  ]);
}
