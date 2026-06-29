import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ConversationModeMetadata } from "@assistant/schemas";

import { CHATS_QUERY_KEY } from "~/constants";
import type { AttachmentData } from "~/lib/chat/attachments";
import { normalizeSelectedModel } from "~/lib/chat/model-selection";
import { prepareUserMessage } from "~/lib/chat/prepare-user-message";
import { createCouncilDebateTurnPlanner } from "~/lib/council-turns";
import { createConversationId } from "~/lib/conversations";
import { getErrorMessage } from "~/lib/errors";
import { useLoadingActions } from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import type { ChatRequestOptions, Conversation, Message } from "~/types";
import type { CouncilMemberId } from "@assistant/schemas";
import { useGenerateTitle } from "./useChat";
import { useModels } from "./useModels";
import { useConversationActions } from "./useConversationActions";
import { useConversationStorage } from "./useConversationStorage";
import { useMessageOperations } from "./useMessageOperations";
import { useStreamingResponse } from "./useStreamingResponse";
import { useWebLLMInitialization } from "./useWebLLMInitialization";

interface CouncilDebateOptions {
	memberIds: CouncilMemberId[];
	requireConsensus?: boolean;
}

/**
 * Main hook for managing chat operations.
 * Composes smaller hooks to handle streaming, storage, WebLLM, and conversation actions.
 */
export function useChatManager(
	requestOptions?: ChatRequestOptions,
	conversationMode?: ConversationModeMetadata,
) {
	const queryClient = useQueryClient();
	const generateTitleMutation = useGenerateTitle();
	const { data: apiModels = {} } = useModels();
	const { startLoading } = useLoadingActions();

	const { currentConversationId, startNewConversation, model } = useChatStore();

	const { webLLMService } = useWebLLMInitialization(apiModels);
	const { updateConversation } = useConversationStorage();
	const { addMessageToConversation, addAssistantMessage, updateAssistantMessage } =
		useMessageOperations();

	const generateConversationTitle = useCallback(
		async (conversationId: string, messages: Message[], assistantMessage: Message) => {
			try {
				const userMessage = messages[0] || { content: "" };
				const titleText =
					typeof userMessage.content === "string"
						? userMessage.content
						: userMessage.content.map((item) => (item.type === "text" ? item.text : "")).join(" ");
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
					await generateConversationTitle(conversationId, messages, lastAssistantMessage);
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
	} = useStreamingResponse(webLLMService, handleTitleGeneration, requestOptions);

	const {
		editingMessageId,
		isBranching,
		retryMessage,
		updateUserMessage,
		startEditingMessage,
		stopEditingMessage,
		branchConversation,
		isRequestingOpinion,
		requestOpinion,
	} = useConversationActions(streamResponse, generateConversationTitle, setStreamStarted);

	const sendMessage = useCallback(
		async (
			input: string,
			attachments?: AttachmentData[],
			overrideRequestOptions?: ChatRequestOptions,
		) => {
			if (!input.trim() && !attachments?.length) {
				return {
					status: "error",
					response: "",
				};
			}

			setStreamStarted(true);
			startLoading("stream-response", "Generating response...");

			const currentModel = normalizeSelectedModel(model);

			try {
				let conversationId = currentConversationId;
				if (!conversationId) {
					conversationId = createConversationId();
					startNewConversation(conversationId);
				}

				const userMessage = prepareUserMessage(input, attachments, currentModel, conversationMode);

				const cancelQueries = async () => {
					await Promise.all([
						queryClient.cancelQueries({ queryKey: [CHATS_QUERY_KEY] }),
						queryClient.cancelQueries({
							queryKey: [CHATS_QUERY_KEY, conversationId],
							exact: true,
						}),
					]);
				};

				await cancelQueries();

				const previousConversation = queryClient.getQueryData<Conversation>([
					CHATS_QUERY_KEY,
					conversationId,
				]);

				await addMessageToConversation(conversationId, userMessage);

				const updatedMessages = previousConversation?.messages?.length
					? [...previousConversation.messages, userMessage]
					: [userMessage];

				const response = await streamResponse(
					updatedMessages,
					conversationId,
					overrideRequestOptions,
				);
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
			conversationMode,
		],
	);

	const respondToExistingConversation = useCallback(
		async (
			conversationId: string,
			options?: { assistantMessageData?: Partial<Message>; model?: string },
		) => {
			const conversation = queryClient.getQueryData<Conversation>([
				CHATS_QUERY_KEY,
				conversationId,
			]);

			if (!conversation?.messages.length) {
				return {
					status: "error",
					response: "No messages provided",
				};
			}

			setStreamStarted(true);
			startLoading("stream-response", "Generating response...");

			try {
				return await streamResponse(conversation.messages, conversationId, undefined, {
					assistantMessageData: options?.assistantMessageData,
					model: options?.model,
				});
			} catch (error) {
				console.error("Failed to respond to live transcript:", error);
				return {
					status: "error",
					response: getErrorMessage(error, "Failed"),
				};
			}
		},
		[queryClient, setStreamStarted, startLoading, streamResponse],
	);

	const sendCouncilDebate = useCallback(
		async (
			input: string,
			attachments: AttachmentData[] | undefined,
			debate: CouncilDebateOptions,
		) => {
			if (!input.trim() && !attachments?.length) {
				return {
					status: "error",
					response: "",
				};
			}

			const currentModel = normalizeSelectedModel(model);
			const councilTurns = createCouncilDebateTurnPlanner({
				memberIds: debate.memberIds,
				model: currentModel ?? "",
				requireConsensus: debate.requireConsensus,
			});

			try {
				let conversationId = currentConversationId;
				if (!conversationId) {
					conversationId = createConversationId();
					startNewConversation(conversationId);
				}

				const previousConversation = queryClient.getQueryData<Conversation>([
					CHATS_QUERY_KEY,
					conversationId,
				]);
				const userMessage = prepareUserMessage(input, attachments, currentModel, conversationMode);

				await Promise.all([
					queryClient.cancelQueries({ queryKey: [CHATS_QUERY_KEY] }),
					queryClient.cancelQueries({
						queryKey: [CHATS_QUERY_KEY, conversationId],
						exact: true,
					}),
				]);

				await addMessageToConversation(conversationId, userMessage);

				const baseMessages = previousConversation?.messages?.length
					? [...previousConversation.messages, userMessage]
					: [userMessage];
				let accumulatedMessages = [...baseMessages];
				let finalResponse = "";
				let finalAssistantMessage: Message | undefined;
				let turn = 1;
				const speakerQueue: CouncilMemberId[] = councilTurns.openingSpeakerIds();

				while (speakerQueue.length > 0) {
					const memberId = speakerQueue.shift()!;
					setStreamStarted(true);
					startLoading("stream-response", "Council debating...");

					const debateTurn = councilTurns.createDebateTurn({
						memberId,
						turn,
						accumulatedMessages,
					});

					const result = await streamResponse(
						debateTurn.requestMessages,
						conversationId,
						debateTurn.requestOptions,
						{ generateTitle: false },
					);

					if (result.status === "error") {
						return result;
					}

					finalResponse = result.response;
					if (result.message) {
						finalAssistantMessage = result.message;
						accumulatedMessages = [
							...accumulatedMessages,
							...(result.messages?.length ? result.messages : [result.message]),
						];
						speakerQueue.splice(
							0,
							speakerQueue.length,
							...councilTurns.nextSpeakerIds(result.message),
						);
					}
					turn += 1;
				}

				const conclusionTurn = councilTurns.createConclusionTurn({
					turn,
					accumulatedMessages,
				});
				const conclusionResult = await streamResponse(
					conclusionTurn.requestMessages,
					conversationId,
					conclusionTurn.requestOptions,
					{ generateTitle: false },
				);

				if (conclusionResult.status === "error") {
					return conclusionResult;
				}

				finalResponse = conclusionResult.response;
				if (conclusionResult.message) {
					finalAssistantMessage = conclusionResult.message;
				}

				if (baseMessages.length === 1 && finalAssistantMessage) {
					generateConversationTitle(conversationId, baseMessages, finalAssistantMessage).catch(
						(err) => console.error("Background title generation failed:", err),
					);
				}

				return {
					status: "success",
					response: finalResponse,
				};
			} catch (error) {
				console.error("Failed to run council debate:", error);
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
			addMessageToConversation,
			streamResponse,
			startLoading,
			setStreamStarted,
			generateConversationTitle,
			conversationMode,
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
		respondToExistingConversation,
		sendCouncilDebate,
		streamResponse,
		abortStream,
		addAssistantMessage,
		updateAssistantMessage,
		retryMessage,
		updateUserMessage,
		startEditingMessage,
		stopEditingMessage,
		branchConversation,
		isRequestingOpinion,
		requestOpinion,
	};
}
