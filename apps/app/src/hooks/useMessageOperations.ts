import { useCallback } from "react";
import type { Message, MessageContent } from "~/types";
import { normalizeMessage } from "~/lib/messages";
import { useConversationStorage } from "./useConversationStorage";
import { useChatStore } from "~/state/stores/chatStore";

/**
 * Hook for managing message operations within conversations.
 * Handles adding, updating, and deleting messages.
 */
export function useMessageOperations() {
  const { updateConversation } = useConversationStorage();
  const { model } = useChatStore();

  const addMessageToConversation = useCallback(
    async (conversationId: string, message: Message) => {
      const normalizedMessage = normalizeMessage(message);

      await updateConversation(conversationId, (oldData) => {
        if (!oldData) {
          const messageContent =
            typeof normalizedMessage.content === "string"
              ? normalizedMessage.content
              : normalizedMessage.content
                  .map((item) => (item.type === "text" ? item.text : ""))
                  .join(" ");

          const now = new Date().toISOString();
          return {
            id: conversationId,
            title: `${messageContent.slice(0, 20)}...`,
            messages: [normalizedMessage],
            isLocalOnly: false,
            created_at: now,
            updated_at: now,
            last_message_at: now,
          };
        }

        return {
          ...oldData,
          messages: [...oldData.messages, normalizedMessage],
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        };
      });
    },
    [updateConversation],
  );

  const updateAssistantMessage = useCallback(
    async (
      conversationId: string,
      content: Message["content"],
      reasoning?: string,
      messageData?: Partial<Message>,
    ) => {
      await updateConversation(conversationId, (oldData) => {
        const now = Date.now();
        const nowISOString = new Date(now).toISOString();
        const currentModel = model === null ? undefined : model;

        const contentPreview =
          typeof content === "string"
            ? content
            : content
                .map((item: MessageContent) =>
                  item.type === "text" ? item.text || "" : "",
                )
                .join("");

        if (!oldData) {
          const assistantMessage = normalizeMessage({
            role: "assistant",
            content,
            id: messageData?.id || crypto.randomUUID(),
            created: messageData?.created || now,
            timestamp: messageData?.timestamp || now,
            model: messageData?.model || currentModel,
            reasoning: reasoning
              ? {
                  collapsed: true,
                  content: reasoning,
                }
              : undefined,
            ...messageData,
          });

          return {
            id: conversationId,
            title: `${contentPreview.slice(0, 20)}...`,
            messages: [assistantMessage],
            isLocalOnly: false,
            created_at: nowISOString,
            updated_at: nowISOString,
            last_message_at: nowISOString,
          };
        }

        const messages = [...oldData.messages];
        const lastMessageIndex = messages.length - 1;
        const hasAssistantLastMessage =
          lastMessageIndex >= 0 &&
          messages[lastMessageIndex].role === "assistant";

        let updatedMessages;

        if (!hasAssistantLastMessage) {
          const newAssistantMessage = normalizeMessage({
            role: "assistant",
            content,
            id: messageData?.id || crypto.randomUUID(),
            created: messageData?.created || now,
            timestamp: messageData?.timestamp || now,
            model: messageData?.model || currentModel,
            reasoning: reasoning
              ? {
                  collapsed: true,
                  content: reasoning,
                }
              : undefined,
            ...messageData,
          });

          updatedMessages = [...messages, newAssistantMessage];
        } else {
          const lastMessage = messages[lastMessageIndex];

          const updatedMessage = normalizeMessage({
            ...lastMessage,
            ...(messageData || {}),
            role: "assistant",
            content,
            created: messageData?.created || lastMessage.created || now,
            timestamp: messageData?.timestamp || lastMessage.timestamp || now,
            model: messageData?.model || currentModel,
            reasoning: reasoning
              ? {
                  collapsed: true,
                  content: reasoning,
                }
              : lastMessage.reasoning,
          });

          messages[lastMessageIndex] = updatedMessage;
          updatedMessages = [...messages];
        }

        return {
          ...oldData,
          messages: updatedMessages,
          updated_at: nowISOString,
          last_message_at: nowISOString,
          created_at: oldData.created_at || nowISOString,
        };
      });
    },
    [model, updateConversation],
  );

  return {
    addMessageToConversation,
    updateAssistantMessage,
  };
}
