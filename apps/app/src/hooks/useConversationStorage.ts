import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { CHATS_QUERY_KEY } from "~/constants";
import { upsertConversationInChatCaches } from "~/lib/conversation-cache";
import { localChatService } from "~/lib/local/local-chat-service";
import type { Conversation } from "~/types";
import { useChatStore } from "~/state/stores/chatStore";

/**
 * Hook for managing conversation storage across local and remote storage.
 * Handles query cache updates and IndexedDB persistence.
 */
export function useConversationStorage() {
	const queryClient = useQueryClient();
	const { isAuthenticated, isPro, localOnlyMode, chatSettings, chatMode } = useChatStore();

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

			const now = new Date().toISOString();
			const nextConversation = updater(currentConversation);
			const updatedConversation = {
				...nextConversation,
				isLocalOnly: nextConversation.isLocalOnly || isLocalOnly,
				created_at: nextConversation.created_at || now,
				updated_at: now,
				last_message_at: now,
			};

			upsertConversationInChatCaches(queryClient, updatedConversation, {
				includeLocalList: isLocalOnly,
				includeRemoteLists: !isLocalOnly,
			});

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
