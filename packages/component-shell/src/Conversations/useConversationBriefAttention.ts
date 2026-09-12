import { useEffect, useRef, useState } from "react";

export function useConversationBriefAttention(
  conversationId: string | undefined,
  revision: number | undefined,
  isFetched: boolean,
) {
  const baseline = useRef<{ conversationId?: string; revision?: number } | undefined>(undefined);
  const [attentionKey, setAttentionKey] = useState<string>();

  useEffect(() => {
    if (!isFetched) {
      return;
    }

    const previous = baseline.current;

    if (!previous || previous.conversationId !== conversationId) {
      baseline.current = { conversationId, revision };
      setAttentionKey(undefined);

      return;
    }

    if (revision !== undefined && revision !== previous.revision) {
      baseline.current = { conversationId, revision };
      setAttentionKey(`${conversationId}:${revision}`);
    }
  }, [conversationId, isFetched, revision]);

  return attentionKey ? { key: attentionKey, pane: "context" as const } : undefined;
}
