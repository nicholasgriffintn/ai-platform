import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import type { ConversationScope } from "@ngriffin_uk/polychat-library-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useDiscoverConversationScope(): ConversationScope {
  const [conversationId, setConversationId] = useState<string>();
  const conversationIdRef = useRef<string | undefined>(undefined);

  const adopt = useCallback((id: string | undefined) => {
    conversationIdRef.current = id;
    setConversationId(id);
  }, []);

  useEffect(
    () =>
      useChatStore.subscribe((state) => {
        if (!state.currentConversationId && conversationIdRef.current) {
          adopt(undefined);
        }
      }),
    [adopt],
  );

  return useMemo<ConversationScope>(
    () => ({
      currentConversationId: conversationId,
      setCurrentConversationId: (id) => {
        useChatStore.getState().setCurrentConversationId(id);
        adopt(id);
      },
      startNewConversation: (id) => {
        const nextId = useChatStore.getState().startNewConversation(id);

        adopt(nextId);

        return nextId;
      },
      clearCurrentConversation: () => useChatStore.getState().clearCurrentConversation(),
      getCurrentConversationId: () => conversationIdRef.current,
    }),
    [adopt, conversationId],
  );
}
