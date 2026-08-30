import { resolveConversationStorageMode } from "@ngriffin_uk/polychat-library-chat/conversation-storage-policy";
import { upsertConversationInChatCaches } from "@ngriffin_uk/polychat-library-react/conversation-cache";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { CHATS_QUERY_KEY } from "~/constants";
import { persistLockedConversation } from "~/lib/chat/locked-conversation";
import { getLocalChatScope } from "~/lib/local/local-chat-scope";
import { localChatService } from "~/lib/local/local-chat-service";
import { useChatStore } from "~/state/stores/chatStore";
import { useConversationLockStore } from "~/state/stores/conversationLockStore";
import type { ChatRequestOptions, Conversation } from "~/types";

/**
 * Hook for managing conversation storage across local and remote storage.
 * Handles query cache updates and IndexedDB persistence.
 */
export function useConversationStorage(requestOptions?: ChatRequestOptions) {
  const queryClient = useQueryClient();
  const { isAuthenticated, isPro, localOnlyMode, chatSettings, chatMode, user } = useChatStore();

  const determineStorageMode = useCallback(
    (conversationId?: string) =>
      resolveConversationStorageMode(
        {
          chatMode,
          isAuthenticated,
          isLocked: conversationId
            ? Boolean(useConversationLockStore.getState().unlocked[conversationId])
            : false,
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
      const {
        isLocalOnly,
        isLocked,
        isProjectScoped,
        shouldPersistPlaintext,
        shouldSyncEnvelopes,
      } = determineStorageMode(conversationId);

      const currentConversation = queryClient.getQueryData<Conversation>([
        CHATS_QUERY_KEY,
        conversationId,
      ]);

      const now = new Date().toISOString();
      const nextConversation = updater(currentConversation);
      const updatedConversation = {
        ...nextConversation,
        isLocalOnly: isProjectScoped ? false : nextConversation.isLocalOnly || isLocalOnly,
        created_at: nextConversation.created_at || now,
        updated_at: now,
        last_message_at: now,
      };

      upsertConversationInChatCaches(queryClient, updatedConversation, {
        includeLocalList: isLocalOnly && !isLocked,
        includeRemoteLists: !isLocalOnly || isLocked,
        localScope: getLocalChatScope(user?.id),
      });

      if (isLocked) {
        if (shouldSyncEnvelopes) {
          const conversationKey =
            useConversationLockStore.getState().unlocked[conversationId]?.key ?? null;

          if (conversationKey) {
            await persistLockedConversation({
              conversationId,
              conversationKey,
              messages: updatedConversation.messages,
            });
          }
        }

        return;
      }

      if (isLocalOnly && shouldPersistPlaintext) {
        await localChatService.saveLocalChat({
          ...updatedConversation,
          isLocalOnly: true,
        });
      }
    },
    [queryClient, determineStorageMode, user?.id],
  );

  return {
    updateConversation,
    determineStorageMode,
  };
}
