import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { CHATS_QUERY_KEY } from "~/constants";
import { apiService } from "~/lib/api/api-service";
import { createBranchConversation, getBranchPoint } from "~/lib/chat/branching";
import { createConversationId } from "~/lib/conversations";
import type { ChatRequestOptions, Conversation, Message } from "~/types";
import { useChatStore } from "~/state/stores/chatStore";
import { useConversationStorage } from "./useConversationStorage";

/**
 * Hook for advanced conversation actions like editing, retrying, and branching.
 */
export function useConversationActions(
	generateResponse: (
		messages: Message[],
		conversationId: string,
		overrideRequestOptions?: ChatRequestOptions,
		options?: { generateTitle?: boolean; model?: string },
	) => Promise<{
		status: "success" | "error";
		response: string;
		message?: Message;
	}>,
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
		chatSettings,
		isAuthenticated,
		isPro,
		localOnlyMode,
		setCurrentConversationId,
	} = useChatStore();

	const { updateConversation } = useConversationStorage();

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

			const messageIndex = conversation.messages.findIndex((msg) => msg.id === messageId);

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

			const messageIndex = conversation.messages.findIndex((msg) => msg.id === messageId);

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

			const branchPoint = getBranchPoint(conversation.messages, messageId);
			if (!branchPoint) {
				toast.error("Unable to branch: message not found");
				return;
			}

			try {
				setIsBranching(true);

				const newConversationId = createConversationId();
				const shouldStore = isAuthenticated && isPro && !localOnlyMode && !chatSettings.localOnly;
				const branchConversation = createBranchConversation({
					conversation,
					conversationId: newConversationId,
					isLocalOnly: !shouldStore,
					messages: branchPoint.messages,
					parentConversationId: currentConversationId,
					parentMessageId: messageId,
				});

				if (shouldStore) {
					await apiService.updateConversation(newConversationId, {
						title: branchConversation.title,
						messages: branchPoint.messages,
						parent_conversation_id: currentConversationId,
						parent_message_id: messageId,
					});
				}

				await updateConversation(newConversationId, () => branchConversation);
				setCurrentConversationId(newConversationId);

				if (branchPoint.shouldGenerateResponse) {
					const result = await generateResponse(
						branchPoint.messages,
						newConversationId,
						undefined,
						{
							generateTitle: false,
							model: selectedModelId || model || undefined,
						},
					);

					if (result.status === "success" && result.message) {
						generateTitle(newConversationId, branchPoint.messages, result.message).catch((err) =>
							console.error("Background title generation failed for branched conversation:", err),
						);
					}
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
			updateConversation,
			setCurrentConversationId,
			generateResponse,
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
