import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { CHATS_QUERY_KEY } from "~/constants";
import { apiService } from "~/lib/api/api-service";
import { createBranchConversation, getBranchPoint } from "~/lib/chat/branching";
import {
	buildOpinionRequestPrompt,
	canRequestOpinionForMessage,
	getOpinionSourceContext,
	type OpinionRequest,
} from "~/lib/chat/opinion";
import { createConversationId } from "~/lib/conversations";
import { normalizeMessage } from "~/lib/messages";
import type { ChatRequestOptions, Conversation, Message } from "~/types";
import { useLoadingActions } from "~/state/contexts/LoadingContext";
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
		options?: { generateTitle?: boolean; model?: string; models?: string[] },
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
	setStreamStarted?: (started: boolean) => void,
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
	const { startLoading, stopLoading } = useLoadingActions();

	const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
	const [isBranching, setIsBranching] = useState(false);
	const [isRequestingOpinion, setIsRequestingOpinion] = useState(false);
	const branchInFlightRef = useRef(false);
	const opinionInFlightRef = useRef(false);

	const generateResponseWithLoading = useCallback(
		async (
			messages: Message[],
			conversationId: string,
			loadingMessage: string,
			overrideRequestOptions?: ChatRequestOptions,
			options?: { generateTitle?: boolean; model?: string; models?: string[] },
		) => {
			setStreamStarted?.(true);
			startLoading("stream-response", loadingMessage);
			try {
				return await generateResponse(messages, conversationId, overrideRequestOptions, options);
			} finally {
				setStreamStarted?.(false);
				stopLoading("stream-response");
			}
		},
		[generateResponse, setStreamStarted, startLoading, stopLoading],
	);

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

				await generateResponseWithLoading(
					messagesToRetry,
					currentConversationId,
					"Generating response...",
				);
			} catch (error) {
				console.error("Error retrying message:", error);
				toast.error("Failed to retry message");
			}
		},
		[queryClient, currentConversationId, updateConversation, generateResponseWithLoading],
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

				await generateResponseWithLoading(
					messagesToRegenerate,
					currentConversationId,
					"Generating response...",
				);
			} catch (error) {
				console.error("Error updating message:", error);
				toast.error("Failed to update message");
			}
		},
		[queryClient, currentConversationId, updateConversation, generateResponseWithLoading],
	);

	const startEditingMessage = useCallback((messageId: string) => {
		setEditingMessageId(messageId);
	}, []);

	const stopEditingMessage = useCallback(() => {
		setEditingMessageId(null);
	}, []);

	const branchConversation = useCallback(
		async (messageId: string, selectedModelId?: string) => {
			if (branchInFlightRef.current) {
				return;
			}

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
				branchInFlightRef.current = true;
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
					const result = await generateResponseWithLoading(
						branchPoint.messages,
						newConversationId,
						"Generating branched response...",
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
				branchInFlightRef.current = false;
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
			generateResponseWithLoading,
			generateTitle,
		],
	);

	const requestOpinion = useCallback(
		async (messageId: string, request: OpinionRequest) => {
			if (opinionInFlightRef.current) {
				return;
			}

			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				currentConversationId || "",
			]);

			if (!conversation?.messages || !currentConversationId) {
				toast.error("Unable to request opinion: conversation not found");
				return;
			}

			if (!canRequestOpinionForMessage(conversation.messages, messageId)) {
				toast.error("Second opinions are only available on the latest answer");
				return;
			}

			if (
				request.modelIds.length === 0 ||
				(request.mode === "consensus" && request.modelIds.length < 2)
			) {
				toast.error("Select enough models to request an opinion");
				return;
			}

			try {
				opinionInFlightRef.current = true;
				setIsRequestingOpinion(true);
				const sourceContext = getOpinionSourceContext(conversation.messages, messageId);

				const opinionMessage = normalizeMessage({
					role: "user",
					content: buildOpinionRequestPrompt(request, sourceContext),
					id: crypto.randomUUID(),
					created: Date.now(),
					model: request.modelIds[0] || model || "",
					data: {
						opinion: {
							mode: request.mode,
							sourceMessageId: messageId,
							modelIds: request.modelIds,
						},
					},
				});
				const messagesWithOpinionRequest = [...conversation.messages, opinionMessage];
				const shouldStore = isAuthenticated && isPro && !localOnlyMode && !chatSettings.localOnly;

				await updateConversation(currentConversationId, (prev) => ({
					...prev!,
					messages: messagesWithOpinionRequest,
				}));

				if (shouldStore) {
					await apiService.updateConversation(currentConversationId, {
						messages: messagesWithOpinionRequest,
					});
				}

				await generateResponseWithLoading(
					messagesWithOpinionRequest,
					currentConversationId,
					request.mode === "consensus" ? "Requesting consensus..." : "Requesting second opinion...",
					undefined,
					{
						generateTitle: false,
						model: request.modelIds[0],
						models: request.modelIds,
					},
				);
			} catch (error) {
				console.error("Error requesting second opinion:", error);
				toast.error("Failed to request second opinion");
			} finally {
				opinionInFlightRef.current = false;
				setIsRequestingOpinion(false);
			}
		},
		[
			queryClient,
			currentConversationId,
			model,
			isAuthenticated,
			isPro,
			localOnlyMode,
			chatSettings.localOnly,
			updateConversation,
			generateResponseWithLoading,
		],
	);

	return {
		editingMessageId,
		isBranching,
		isRequestingOpinion,
		retryMessage,
		updateUserMessage,
		startEditingMessage,
		stopEditingMessage,
		branchConversation,
		requestOpinion,
	};
}
