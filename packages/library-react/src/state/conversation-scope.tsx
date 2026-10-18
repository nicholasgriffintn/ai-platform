import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import type { ResponseAgent } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface ConversationScope {
  currentConversationId: string | undefined;
  setCurrentConversationId: (id: string | undefined) => void;
  startNewConversation: (id?: string) => string;
  clearCurrentConversation: () => void;
  getCurrentConversationId: () => string | undefined;
  agent?: ResponseAgent;
  defaultAgent?: ResponseAgent;
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
  agent?: ResponseAgent,
  defaultAgent?: ResponseAgent,
): ConversationScope {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const conversationIdRef = useRef(conversationId);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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
        const nextId = id || generateId();

        useChatStore.getState().markConversationLocallyCreated(nextId);
        update(nextId);

        return nextId;
      },
      clearCurrentConversation: () => update(undefined),
      getCurrentConversationId: () => conversationIdRef.current,
      ...(agent ? { agent } : {}),
      ...(defaultAgent ? { defaultAgent } : {}),
    };
  }, [agent, conversationId, defaultAgent]);
}
