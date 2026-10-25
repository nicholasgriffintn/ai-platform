import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  OUTPUT_QUERY_KEYS,
  subjectConversationsQueryKey,
  useChat,
} from "@ngriffin_uk/polychat-library-react";
import { DOCUMENT_WRITE_TOOL_NAME, type ConversationSubject } from "@ngriffin_uk/polychat-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

export function useSubjectConversationSync(
  conversationId: string | undefined,
  subject: ConversationSubject,
) {
  const queryClient = useQueryClient();
  const { data: conversation } = useChat(conversationId);
  const isLocalOnly = useChatStore((state) =>
    Boolean(conversationId && state.locallyCreatedConversationIds[conversationId]),
  );
  const seen = useRef<Set<string> | null>(null);
  const listedConversationId = useRef<string | null>(null);

  useEffect(() => {
    if (!conversation?.id || isLocalOnly || listedConversationId.current === conversation.id) {
      return;
    }

    listedConversationId.current = conversation.id;
    void queryClient.invalidateQueries({ queryKey: subjectConversationsQueryKey(subject) });
  }, [conversation?.id, isLocalOnly, queryClient, subject]);

  useEffect(() => {
    if (subject.type !== "output" || !conversation) {
      return;
    }

    const writes = (conversation.messages ?? []).filter(
      (message) =>
        message.role === "tool" && message.name === DOCUMENT_WRITE_TOOL_NAME && message.id,
    );

    if (!seen.current) {
      seen.current = new Set(writes.map((message) => message.id ?? ""));

      return;
    }

    const fresh = writes.filter((message) => !seen.current?.has(message.id ?? ""));

    if (fresh.length === 0) {
      return;
    }

    for (const message of fresh) {
      seen.current.add(message.id ?? "");
    }

    void queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.detail(subject.id) });
    void queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.history(subject.id) });
  }, [conversation, queryClient, subject.id, subject.type]);
}
