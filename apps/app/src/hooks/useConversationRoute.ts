import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

import {
  getPersonalConversationPath,
  getProjectConversationPath,
  resolvePersonalConversationId,
} from "~/lib/conversation-route";
import { useChatStore } from "~/state/stores/chatStore";

import { useChat } from "./useChat";

export function useConversationRoute({
  surface,
  pathConversationId,
}: {
  surface: "personal" | "project";
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
      surface === "project"
        ? getProjectConversationPath(location.pathname, location.search, conversationId)
        : `${getPersonalConversationPath(conversationId)}${location.search}`;

    void navigate(path, {
      replace: true,
    });
  }, [
    conversationId,
    hasUserMessage,
    location.pathname,
    location.search,
    navigate,
    pathConversationId,
    surface,
  ]);
}
