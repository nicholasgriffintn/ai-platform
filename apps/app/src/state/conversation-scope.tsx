import { createContext, type ReactNode, useContext, useMemo, useRef, useState } from "react";

import { createConversationId } from "~/lib/conversations";
import { useChatStore } from "~/state/stores/chatStore";

export interface ConversationScope {
  currentConversationId: string | undefined;
  setCurrentConversationId: (id: string | undefined) => void;
  startNewConversation: (id?: string) => string;
  clearCurrentConversation: () => void;
  getCurrentConversationId: () => string | undefined;
}

const ConversationScopeContext = createContext<ConversationScope | null>(null);

export function ConversationScopeProvider({
  children,
  scope,
}: {
  children: ReactNode;
  scope: ConversationScope;
}) {
  return (
    <ConversationScopeContext.Provider value={scope}>{children}</ConversationScopeContext.Provider>
  );
}

export function useConversationScope(): ConversationScope {
  const scoped = useContext(ConversationScopeContext);
  const currentConversationId = useChatStore((state) => state.currentConversationId);
  const setCurrentConversationId = useChatStore((state) => state.setCurrentConversationId);
  const startNewConversation = useChatStore((state) => state.startNewConversation);
  const clearCurrentConversation = useChatStore((state) => state.clearCurrentConversation);
  const storeScope = useMemo<ConversationScope>(
    () => ({
      currentConversationId,
      setCurrentConversationId,
      startNewConversation,
      clearCurrentConversation,
      getCurrentConversationId: () => useChatStore.getState().currentConversationId,
    }),
    [
      clearCurrentConversation,
      currentConversationId,
      setCurrentConversationId,
      startNewConversation,
    ],
  );

  return scoped ?? storeScope;
}

export function useLocalConversationScope(
  initialConversationId: string | undefined,
  onChange?: (id: string | undefined) => void,
): ConversationScope {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const conversationIdRef = useRef(conversationId);
  const onChangeRef = useRef(onChange);

  conversationIdRef.current = conversationId;
  onChangeRef.current = onChange;

  return useMemo<ConversationScope>(() => {
    const update = (id: string | undefined) => {
      conversationIdRef.current = id;
      setConversationId(id);
      onChangeRef.current?.(id);
    };

    return {
      currentConversationId: conversationId,
      setCurrentConversationId: update,
      startNewConversation: (id?: string) => {
        const nextId = id || createConversationId();

        useChatStore.getState().markConversationLocallyCreated(nextId);
        update(nextId);

        return nextId;
      },
      clearCurrentConversation: () => update(undefined),
      getCurrentConversationId: () => conversationIdRef.current,
    };
  }, [conversationId]);
}
