import { CHATS_QUERY_KEY } from "@ngriffin_uk/polychat-library-client";
import {
  getMetaNavigationHref,
  readMetaNavigationTarget,
  type useChat,
} from "@ngriffin_uk/polychat-library-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

export function useMetaAssistantNavigation(
  conversation: ReturnType<typeof useChat>["data"],
  conversationId: string | undefined,
  onNavigate: (href: string) => void,
) {
  const queryClient = useQueryClient();
  const initialConversationId = useRef(conversationId);
  const historyLoaded = useRef(!conversationId);
  const handledMessageIds = useRef(new Set<string>());

  useEffect(() => {
    if (!conversation) {
      return;
    }

    const messages = conversation.messages ?? [];

    if (!historyLoaded.current && conversationId === initialConversationId.current) {
      for (const message of messages) {
        if (message.id) {
          handledMessageIds.current.add(message.id);
        }
      }

      historyLoaded.current = true;

      return;
    }

    for (const message of messages) {
      if (message.role !== "tool" || !message.id || handledMessageIds.current.has(message.id)) {
        continue;
      }

      handledMessageIds.current.add(message.id);
      if (message.name === "organise_conversation") {
        void queryClient.invalidateQueries({ queryKey: [CHATS_QUERY_KEY] });
      }

      const target = readMetaNavigationTarget(message.data);

      if (target) {
        onNavigate(getMetaNavigationHref(target));
      }
    }
  }, [conversation, conversationId, onNavigate, queryClient]);
}
