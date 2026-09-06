import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

import {
  getPersonalConversationPath,
  getProjectConversationPath,
  resolvePersonalConversationId,
} from "~/lib/conversation-route";

import { useChat } from "./useChat";

export type ConversationRouteSurface =
  | { kind: "personal" }
  | { kind: "project"; workspaceId: string; projectId: string };

export function useConversationRoute({
  surface,
  pathConversationId,
}: {
  surface: ConversationRouteSurface;
  pathConversationId?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const conversationId = useChatStore((state) => state.currentConversationId);
  const { data: conversation } = useChat(conversationId);
  const hasUserMessage = conversation?.messages.some((message) => message.role === "user");

  useEffect(() => {
    if (
      !conversationId ||
      !hasUserMessage ||
      resolvePersonalConversationId(pathConversationId, location.search) ||
      useChatStore.getState().currentConversationId !== conversationId
    ) {
      return;
    }

    const path =
      surface.kind === "project"
        ? `${getProjectConversationPath(surface.workspaceId, surface.projectId, conversationId)}${location.search}`
        : `${getPersonalConversationPath(conversationId)}${location.search}`;

    void navigate(path, {
      replace: true,
    });
  }, [conversationId, hasUserMessage, location.search, navigate, pathConversationId, surface]);
}
