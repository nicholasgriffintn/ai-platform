import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { CHATS_QUERY_KEY } from "~/constants";
import { localChatService } from "~/lib/local/local-chat-service";
import type { Conversation } from "~/types";
import { useChatStore } from "~/state/stores/chatStore";

/**
 * Hook for managing conversation storage across local and remote storage.
 * Handles query cache updates and IndexedDB persistence.
 */
export function useConversationStorage() {
	const queryClient = useQueryClient();
	const { isAuthenticated, isPro, localOnlyMode, chatSettings, chatMode } =
		useChatStore();

	const determineStorageMode = useCallback(() => {
		const isLocalOnly =
			!isAuthenticated ||
			!isPro ||
			localOnlyMode ||
			chatSettings.localOnly === true ||
			chatMode === "local";

		return {
			isLocalOnly,
			shouldSyncRemote: !isLocalOnly,
		};
	}, [isAuthenticated, isPro, localOnlyMode, chatSettings.localOnly, chatMode]);

	const updateConversation = useCallback(
		async (
			conversationId: string,
			updater: (conversation: Conversation | undefined) => Conversation,
		) => {
			const { isLocalOnly } = determineStorageMode();

			const currentConversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);
			const allConversations =
				queryClient.getQueryData<Conversation[]>([CHATS_QUERY_KEY]) || [];

			const now = new Date().toISOString();
			const updatedConversation = {
				...updater(currentConversation),
				isLocalOnly: updater(currentConversation)?.isLocalOnly || isLocalOnly,
				created_at: updater(currentConversation)?.created_at || now,
				updated_at: now,
				last_message_at: now,
			};

			queryClient.setQueryData(
				[CHATS_QUERY_KEY, conversationId],
				updatedConversation,
			);

			const existingIndex = allConversations.findIndex(
				(c) => c.id === conversationId,
			);
			const updatedAllConversations = [...allConversations];

			if (existingIndex >= 0) {
				updatedAllConversations[existingIndex] = updatedConversation;
			} else {
				updatedAllConversations.unshift(updatedConversation);
			}

			queryClient.setQueryData([CHATS_QUERY_KEY], updatedAllConversations);

			if (isLocalOnly) {
				const localChats =
					queryClient.getQueryData<Conversation[]>([
						CHATS_QUERY_KEY,
						"local",
					]) || [];

				const localExistingIndex = localChats.findIndex(
					(c) => c.id === conversationId,
				);
				const updatedLocalChats = [...localChats];

				if (localExistingIndex >= 0) {
					updatedLocalChats[localExistingIndex] = updatedConversation;
				} else {
					updatedLocalChats.unshift(updatedConversation);
				}

				queryClient.setQueryData([CHATS_QUERY_KEY, "local"], updatedLocalChats);
			} else {
				const remoteChats =
					queryClient.getQueryData<Conversation[]>([
						CHATS_QUERY_KEY,
						"remote",
					]) || [];
				const remoteExistingIndex = remoteChats.findIndex(
					(c) => c.id === conversationId,
				);
				const updatedRemoteChats = [...remoteChats];

				if (remoteExistingIndex >= 0) {
					updatedRemoteChats[remoteExistingIndex] = updatedConversation;
				} else {
					updatedRemoteChats.unshift(updatedConversation);
				}

				queryClient.setQueryData(
					[CHATS_QUERY_KEY, "remote"],
					updatedRemoteChats,
				);
			}

			if (isLocalOnly) {
				await localChatService.saveLocalChat({
					...updatedConversation,
					isLocalOnly: true,
				});
			}
		},
		[queryClient, determineStorageMode],
	);

	return {
		updateConversation,
		determineStorageMode,
	};
}
