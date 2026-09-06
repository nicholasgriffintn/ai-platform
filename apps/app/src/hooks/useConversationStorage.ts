import { resolveConversationStorageMode } from "@ngriffin_uk/polychat-library-chat/conversation-storage-policy";
import { CHATS_QUERY_KEY, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { upsertConversationInChatCaches } from "@ngriffin_uk/polychat-library-react/conversation-cache";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { getLocalChatScope } from "~/lib/local/local-chat-scope";
import { localChatService } from "~/lib/local/local-chat-service";
import type { ChatRequestOptions, Conversation } from "~/types";

/**
 * Hook for managing conversation storage across local and remote storage.
 * Handles query cache updates and IndexedDB persistence.
 */
export function useConversationStorage(requestOptions?: ChatRequestOptions) {
  const queryClient = useQueryClient();
  const { isAuthenticated, isPro, localOnlyMode, temporaryChatsDefault, user } = useChatStore();

  const determineStorageMode = useCallback(
    () =>
      resolveConversationStorageMode(
        {
          isAuthenticated,
          isPro,
          temporaryChat: localOnlyMode,
          temporaryChatsDefault,
        },
        requestOptions,
      ),
    [isAuthenticated, isPro, localOnlyMode, temporaryChatsDefault, requestOptions],
  );

  const updateConversation = useCallback(
    async (
      conversationId: string,
      updater: (conversation: Conversation | undefined) => Conversation,
    ) => {
      const { isTemporary, isProjectScoped } = determineStorageMode();

      const currentConversation = queryClient.getQueryData<Conversation>([
        CHATS_QUERY_KEY,
        conversationId,
      ]);

      const now = new Date().toISOString();
      const nextConversation = updater(currentConversation);
      const updatedConversation = {
        ...nextConversation,
        type: nextConversation.type ?? (requestOptions?.options?.recipe ? "task" : "chat"),
        isLocalOnly: isProjectScoped ? false : nextConversation.isLocalOnly || isTemporary,
        created_at: nextConversation.created_at || now,
        updated_at: now,
        last_message_at: now,
      };

      upsertConversationInChatCaches(queryClient, updatedConversation, {
        includeLocalList: isTemporary,
        includeRemoteLists: !isTemporary,
        localScope: getLocalChatScope(user?.id),
      });

      await localChatService.saveLocalChat({
        ...updatedConversation,
        isLocalOnly: isTemporary,
      });
    },
    [queryClient, determineStorageMode, requestOptions?.options?.recipe, user?.id],
  );

  return {
    updateConversation,
    determineStorageMode,
  };
}
