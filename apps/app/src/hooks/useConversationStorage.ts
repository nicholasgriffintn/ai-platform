import { resolveConversationStorageMode } from "@ngriffin_uk/polychat-library-chat/conversation-storage-policy";
import { upsertConversationInChatCaches } from "@ngriffin_uk/polychat-library-react/conversation-cache";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { CHATS_QUERY_KEY } from "~/constants";
import { getLocalChatScope } from "~/lib/local/local-chat-scope";
import { localChatService } from "~/lib/local/local-chat-service";
import { useChatStore } from "~/state/stores/chatStore";
import type { ChatRequestOptions, Conversation } from "~/types";

/**
 * Hook for managing conversation storage across local and remote storage.
 * Handles query cache updates and IndexedDB persistence.
 */
export function useConversationStorage(requestOptions?: ChatRequestOptions) {
  const queryClient = useQueryClient();
  const { isAuthenticated, isPro, localOnlyMode, chatSettings, chatMode, user } = useChatStore();

  const determineStorageMode = useCallback(
    () =>
      resolveConversationStorageMode(
        {
          chatMode,
          isAuthenticated,
          isPro,
          localOnlyMode,
          settingsLocalOnly: chatSettings.localOnly === true,
        },
        requestOptions,
      ),
    [chatMode, chatSettings.localOnly, isAuthenticated, isPro, localOnlyMode, requestOptions],
  );

  const updateConversation = useCallback(
    async (
      conversationId: string,
      updater: (conversation: Conversation | undefined) => Conversation,
    ) => {
      const { isLocalOnly, isProjectScoped } = determineStorageMode();

      const currentConversation = queryClient.getQueryData<Conversation>([
        CHATS_QUERY_KEY,
        conversationId,
      ]);

      const now = new Date().toISOString();
      const nextConversation = updater(currentConversation);
      const updatedConversation = {
        ...nextConversation,
        type: nextConversation.type ?? (requestOptions?.options?.recipe ? "task" : "chat"),
        isLocalOnly: isProjectScoped ? false : nextConversation.isLocalOnly || isLocalOnly,
        created_at: nextConversation.created_at || now,
        updated_at: now,
        last_message_at: now,
      };

      upsertConversationInChatCaches(queryClient, updatedConversation, {
        includeLocalList: isLocalOnly,
        includeRemoteLists: !isLocalOnly,
        localScope: getLocalChatScope(user?.id),
      });

      if (isLocalOnly) {
        await localChatService.saveLocalChat({
          ...updatedConversation,
          isLocalOnly: true,
        });
      }
    },
    [queryClient, determineStorageMode, requestOptions?.options?.recipe, user?.id],
  );

  return {
    updateConversation,
    determineStorageMode,
  };
}
