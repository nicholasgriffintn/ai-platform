import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { CHATS_QUERY_KEY } from "~/constants";
import { apiService } from "~/lib/api/api-service";
import { normalizeMessage } from "~/lib/messages";
import type { Conversation, Message } from "~/types";
import { useChatStore } from "~/state/stores/chatStore";
import { useConversationStorage } from "./useConversationStorage";
import { useMessageOperations } from "./useMessageOperations";

/**
 * Hook for advanced conversation actions like editing, retrying, and branching.
 */
export function useConversationActions(
	generateResponse: (
		messages: Message[],
		conversationId: string,
	) => Promise<any>,
	generateTitle: (
		conversationId: string,
		messages: Message[],
		assistantMessage: Message,
	) => Promise<void>,
) {
	const queryClient = useQueryClient();
	const {
		currentConversationId,
		model,
		chatMode,
		chatSettings,
		isAuthenticated,
		isPro,
		localOnlyMode,
		useMultiModel,
		selectedAgentId,
		setCurrentConversationId,
	} = useChatStore();

	const { updateConversation } = useConversationStorage();
	const { updateAssistantMessage } = useMessageOperations();

	const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
	const [isBranching, setIsBranching] = useState(false);

	const retryMessage = useCallback(
		async (messageId: string) => {
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				currentConversationId || "",
			]);

			if (!conversation?.messages || !currentConversationId) {
				toast.error("Unable to retry: conversation not found");
				return;
			}

			const messageIndex = conversation.messages.findIndex(
				(msg) => msg.id === messageId,
			);

			if (messageIndex === -1) {
				toast.error("Unable to retry: message not found");
				return;
			}

			const message = conversation.messages[messageIndex];

			let messagesToRetry: Message[];

			if (message.role === "assistant") {
				messagesToRetry = conversation.messages.slice(0, messageIndex);
			} else {
				messagesToRetry = conversation.messages.slice(0, messageIndex + 1);
			}

			try {
				await updateConversation(currentConversationId, (prev) => ({
					...prev!,
					messages: messagesToRetry,
				}));

				await generateResponse(messagesToRetry, currentConversationId);
			} catch (error) {
				console.error("Error retrying message:", error);
				toast.error("Failed to retry message");
			}
		},
		[queryClient, currentConversationId, updateConversation, generateResponse],
	);

	const updateUserMessage = useCallback(
		async (messageId: string, newContent: string) => {
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				currentConversationId || "",
			]);

			if (!conversation?.messages || !currentConversationId) {
				toast.error("Unable to edit: conversation not found");
				return;
			}

			const messageIndex = conversation.messages.findIndex(
				(msg) => msg.id === messageId,
			);

			if (messageIndex === -1) {
				toast.error("Unable to edit: message not found");
				return;
			}

			const message = conversation.messages[messageIndex];

			if (message.role !== "user") {
				toast.error("Can only edit user messages");
				return;
			}

			try {
				const updatedMessages = [...conversation.messages];
				updatedMessages[messageIndex] = {
					...message,
					content: newContent.trim(),
				};

				const messagesToRegenerate = updatedMessages.slice(0, messageIndex + 1);

				await updateConversation(currentConversationId, (prev) => ({
					...prev!,
					messages: messagesToRegenerate,
				}));

				await generateResponse(messagesToRegenerate, currentConversationId);
			} catch (error) {
				console.error("Error updating message:", error);
				toast.error("Failed to update message");
			}
		},
		[queryClient, currentConversationId, updateConversation, generateResponse],
	);

	const startEditingMessage = useCallback((messageId: string) => {
		setEditingMessageId(messageId);
	}, []);

	const stopEditingMessage = useCallback(() => {
		setEditingMessageId(null);
	}, []);

	const branchConversation = useCallback(
		async (messageId: string, selectedModelId?: string) => {
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				currentConversationId || "",
			]);

			if (!conversation?.messages || !currentConversationId) {
				toast.error("Unable to branch: conversation not found");
				return;
			}

			const messageIndex = conversation.messages.findIndex(
				(msg) => msg.id === messageId,
			);

			if (messageIndex === -1) {
				toast.error("Unable to branch: message not found");
				return;
			}

			try {
				setIsBranching(true);

				const messagesUpToPoint = conversation.messages.slice(
					0,
					messageIndex + 1,
				);

				const newConversationId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

				const branchMetadata = {
					branch_of: JSON.stringify({
						conversation_id: currentConversationId,
						message_id: messageId,
					}),
				};

				const shouldStore =
					isAuthenticated && isPro && !localOnlyMode && !chatSettings.localOnly;

				await updateConversation(newConversationId, () => ({
					id: newConversationId,
					title: conversation.title || "Branched Conversation",
					messages: messagesUpToPoint,
					isLocalOnly: !shouldStore,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					last_message_at: new Date().toISOString(),
				}));

				if (shouldStore) {
					const normalizedMessages = messagesUpToPoint.map(normalizeMessage);
					const modelToSend =
						selectedModelId || (model === null ? undefined : model);

					const chatSettingsWithMetadata = {
						...chatSettings,
						metadata: branchMetadata,
					};

					let lastContent = "";
					let lastReasoning = "";

					setCurrentConversationId(newConversationId);

					await apiService.streamChatCompletions(
						newConversationId,
						normalizedMessages,
						modelToSend,
						chatMode,
						chatSettingsWithMetadata,
						new AbortController().signal,
						(content, reasoning, _toolResponses, done) => {
							lastContent = content;
							if (reasoning) lastReasoning = reasoning;

							if (done) {
								updateAssistantMessage(newConversationId, content, reasoning);
							} else {
								updateAssistantMessage(newConversationId, content);
							}
						},
						() => {},
						shouldStore,
						true,
						useMultiModel,
						chatMode === "agent"
							? `/agents/${selectedAgentId}/completions`
							: undefined,
					);

					await updateAssistantMessage(
						newConversationId,
						lastContent,
						lastReasoning,
					);

					setTimeout(() => {
						const lastMessage = messagesUpToPoint[messagesUpToPoint.length - 1];
						if (lastMessage) {
							generateTitle(
								newConversationId,
								messagesUpToPoint.slice(0, -1),
								lastMessage,
							).catch((err) =>
								console.error(
									"Background title generation failed for branched conversation:",
									err,
								),
							);
						}
					}, 0);
				}

				toast.success("Conversation branched successfully!");
			} catch (error) {
				console.error("Error branching conversation:", error);
				toast.error("Failed to branch conversation");
			} finally {
				setIsBranching(false);
			}
		},
		[
			queryClient,
			currentConversationId,
			isAuthenticated,
			isPro,
			localOnlyMode,
			chatSettings,
			model,
			chatMode,
			useMultiModel,
			selectedAgentId,
			updateConversation,
			updateAssistantMessage,
			setCurrentConversationId,
			generateTitle,
		],
	);

	return {
		editingMessageId,
		isBranching,
		retryMessage,
		updateUserMessage,
		startEditingMessage,
		stopEditingMessage,
		branchConversation,
	};
}
