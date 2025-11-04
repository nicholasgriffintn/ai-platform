import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { CHATS_QUERY_KEY } from "~/constants";
import { normalizeMessage } from "~/lib/messages";
import { useLoadingActions } from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import type { Conversation, Message } from "~/types";
import { useGenerateTitle } from "./useChat";
import { useModels } from "./useModels";
import { useConversationActions } from "./useConversationActions";
import { useConversationStorage } from "./useConversationStorage";
import { useMessageOperations } from "./useMessageOperations";
import { useStreamingResponse } from "./useStreamingResponse";
import { useWebLLMInitialization } from "./useWebLLMInitialization";

/**
 * Main hook for managing chat operations.
 * Composes smaller hooks to handle streaming, storage, WebLLM, and conversation actions.
 */
export function useChatManager() {
	const queryClient = useQueryClient();
	const generateTitleMutation = useGenerateTitle();
	const { data: apiModels = {} } = useModels();
	const { startLoading } = useLoadingActions();

	const { currentConversationId, startNewConversation, model } = useChatStore();

	const { webLLMService } = useWebLLMInitialization(apiModels);
	const { updateConversation } = useConversationStorage();
	const {
		addMessageToConversation,
		addAssistantMessage,
		updateAssistantMessage,
	} = useMessageOperations();

	const generateConversationTitle = useCallback(
		async (
			conversationId: string,
			messages: Message[],
			assistantMessage: Message,
		) => {
			try {
				const userMessage = messages[0] || { content: "" };
				const titleText =
					typeof userMessage.content === "string"
						? userMessage.content
						: userMessage.content
								.map((item) => (item.type === "text" ? item.text : ""))
								.join(" ");
				const tempTitle = `${titleText.slice(0, 30)}${titleText.length > 30 ? "..." : ""}`;

				await updateConversation(conversationId, (oldData) => ({
					...oldData!,
					title: tempTitle,
				}));

				const finalTitle = await generateTitleMutation.mutateAsync({
					completion_id: conversationId,
					messages: [...messages, assistantMessage],
				});

				await updateConversation(conversationId, (oldData) => ({
					...oldData!,
					title: finalTitle,
				}));
			} catch (error) {
				console.error("Failed to generate title:", error);
			}
		},
		[generateTitleMutation, updateConversation],
	);

	const handleTitleGeneration = useCallback(
		async (conversationId: string, messages: Message[]) => {
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);

			if (conversation?.messages) {
				const lastAssistantMessage = conversation.messages
					.slice()
					.reverse()
					.find((msg) => msg.role === "assistant");

				if (lastAssistantMessage) {
					await generateConversationTitle(
						conversationId,
						messages,
						lastAssistantMessage,
					);
				}
			}
		},
		[queryClient, generateConversationTitle],
	);

	const {
		streamStarted,
		setStreamStarted,
		controller,
		assistantResponseRef,
		assistantReasoningRef,
		streamResponse,
		abortStream,
	} = useStreamingResponse(webLLMService, handleTitleGeneration);

	const {
		editingMessageId,
		isBranching,
		retryMessage,
		updateUserMessage,
		startEditingMessage,
		stopEditingMessage,
		branchConversation,
	} = useConversationActions(streamResponse, generateConversationTitle);

	const sendMessage = useCallback(
		async (
			input: string,
			attachmentData?: {
				type: string;
				data: string;
				name?: string;
				markdown?: string;
			},
		) => {
			if (!input.trim() && !attachmentData) {
				return {
					status: "error",
					response: "",
				};
			}

			setStreamStarted(true);
			startLoading("stream-response", "Generating response...");

			const userMessageId = crypto.randomUUID();
			const currentTime = Date.now();
			const currentModel = model === null ? undefined : model;

			const contentItems: any[] = [
				{
					type: "text",
					text: input.trim(),
				},
			];

			const prepareUserMessage = () => {
				if (attachmentData) {
					if (attachmentData.type === "image") {
						contentItems.push({
							type: "image_url",
							image_url: {
								url: attachmentData.data,
								detail: "auto",
							},
						});
					} else if (attachmentData.type === "document") {
						contentItems.push({
							type: "document_url",
							document_url: {
								url: attachmentData.data,
								name: attachmentData.name,
							},
						});
					} else if (attachmentData.type === "audio") {
						contentItems.push({
							type: "input_audio",
							input_audio: {
								data: attachmentData.data,
								format: attachmentData.name?.toLowerCase().endsWith(".wav")
									? "wav"
									: "mp3",
							},
						});
					}

					if (
						attachmentData?.type === "markdown_document" &&
						attachmentData?.markdown
					) {
						contentItems.push({
							type: "markdown_document",
							markdown_document: {
								markdown: attachmentData.markdown,
								name: attachmentData.name,
							},
						});
					}

					return normalizeMessage({
						role: "user",
						content: contentItems,
						id: userMessageId,
						created: currentTime,
						model: currentModel,
					});
				}

				return normalizeMessage({
					role: "user",
					content: input.trim(),
					id: userMessageId,
					created: currentTime,
					model: currentModel,
				});
			};

			try {
				let conversationId = currentConversationId;
				if (!conversationId) {
					conversationId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
					startNewConversation(conversationId);
				}

				const userMessage = prepareUserMessage();

				const cancelQueries = async () => {
					await Promise.all([
						queryClient.cancelQueries({ queryKey: [CHATS_QUERY_KEY] }),
						queryClient.cancelQueries({
							queryKey: [CHATS_QUERY_KEY, conversationId],
							exact: true,
						}),
					]);
				};

				const previousConversation = queryClient.getQueryData<Conversation>([
					CHATS_QUERY_KEY,
					conversationId,
				]);

				const cancelPromise = cancelQueries();

				await addMessageToConversation(conversationId, userMessage);

				await cancelPromise;

				const updatedMessages = previousConversation?.messages?.length
					? [...previousConversation.messages, userMessage]
					: [userMessage];

				const response = await streamResponse(updatedMessages, conversationId);
				return response;
			} catch (error) {
				console.error("Failed to send message:", error);
				return {
					status: "error",
					response: (error as Error).message || "Failed",
				};
			}
		},
		[
			model,
			currentConversationId,
			startNewConversation,
			queryClient,
			streamResponse,
			startLoading,
			addMessageToConversation,
			setStreamStarted,
		],
	);

	return {
		streamStarted,
		controller,
		assistantResponseRef,
		assistantReasoningRef,
		editingMessageId,
		isBranching,
		sendMessage,
		streamResponse,
		abortStream,
		addAssistantMessage,
		updateAssistantMessage,
		retryMessage,
		updateUserMessage,
		startEditingMessage,
		stopEditingMessage,
		branchConversation,
	};
}
