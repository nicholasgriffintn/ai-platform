import { getLocalChatScope } from "@ngriffin_uk/polychat-library-chat";
import { resolveConversationStorageMode } from "@ngriffin_uk/polychat-library-chat/conversation-storage-policy";
import type {
  ChatRequestOptions,
  Conversation,
} from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { CHATS_QUERY_KEY, apiService, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { upsertConversationInChatCaches } from "../conversation-cache.js";
import { localChatService } from "../index.js";
import { useSelectedModelRunsOnDevice } from "./useSelectedModelRunsOnDevice.js";

/**
 * Hook for managing conversation storage across local and remote storage.
 * Handles query cache updates and IndexedDB persistence.
 */
export function useConversationStorage(requestOptions?: ChatRequestOptions) {
  const queryClient = useQueryClient();
  const {
    isAuthenticated,
    isPro,
    markConversationRemoteAvailable,
    temporaryChat,
    temporaryChatsDefault,
    user,
  } = useChatStore();
  const answersOnDevice = useSelectedModelRunsOnDevice();

  const determineStorageMode = useCallback(
    (conversationId?: string) => {
      const conversation = conversationId
        ? queryClient.getQueryData<Conversation>([CHATS_QUERY_KEY, conversationId])
        : undefined;
      const hasExistingConversation = Boolean(conversation);

      return resolveConversationStorageMode(
        {
          isAuthenticated,
          isPro,
          temporaryChat: conversation?.isLocalOnly ?? temporaryChat,
          temporaryChatsDefault: hasExistingConversation ? false : temporaryChatsDefault,
          runsOnDevice: answersOnDevice,
        },
        requestOptions,
      );
    },
    [
      answersOnDevice,
      isAuthenticated,
      isPro,
      queryClient,
      requestOptions,
      temporaryChat,
      temporaryChatsDefault,
    ],
  );

  const updateConversation = useCallback(
    async (
      conversationId: string,
      updater: (conversation: Conversation | undefined) => Conversation,
    ) => {
      const storageMode = determineStorageMode(conversationId);
      const isTemporary = storageMode.retention === "temporary";
      const { isProjectScoped } = storageMode;

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
        isLocalOnly: updatedConversation.isLocalOnly ?? isTemporary,
      });
    },
    [queryClient, determineStorageMode, requestOptions?.options?.recipe, user?.id],
  );

  const keepConversation = useCallback(
    async (conversationId: string) => {
      if (!isAuthenticated || !isPro) {
        throw new Error("Stored conversations are only available to Pro users");
      }

      const cachedConversation = queryClient.getQueryData<Conversation>([
        CHATS_QUERY_KEY,
        conversationId,
      ]);
      const conversation =
        cachedConversation ?? (await localChatService.getLocalChat(conversationId));

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      if (!conversation.isLocalOnly) {
        return conversation;
      }

      const remoteConversation = await apiService.updateConversation(conversationId, {
        title: conversation.title,
        messages: conversation.messages,
      });
      const keptConversation = {
        ...conversation,
        ...remoteConversation,
        id: remoteConversation.id || conversationId,
        isLocalOnly: false,
      };

      await localChatService.saveLocalChat(keptConversation);
      markConversationRemoteAvailable(conversationId);
      upsertConversationInChatCaches(queryClient, keptConversation, {
        includeLocalList: false,
        includeRemoteLists: true,
        localScope: getLocalChatScope(user?.id),
      });
      await queryClient.invalidateQueries({
        queryKey: [CHATS_QUERY_KEY, "local", getLocalChatScope(user?.id)],
      });

      return keptConversation;
    },
    [isAuthenticated, isPro, markConversationRemoteAvailable, queryClient, user?.id],
  );

  return {
    keepConversation,
    updateConversation,
    determineStorageMode,
  };
}
