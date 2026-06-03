import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { apiService } from "~/lib/api/api-service";
import { normalizeSelectedModel } from "~/lib/chat/model-selection";
import { getModelProvider } from "~/lib/models";
import { normalizeMessage } from "~/lib/messages";
import type { ChatRequestOptions, Message, MessageContent } from "~/types";
import { useLoadingActions } from "~/state/contexts/LoadingContext";
import { useChatStore } from "~/state/stores/chatStore";
import { useMessageOperations } from "./useMessageOperations";
import { useModels } from "./useModels";

export interface StreamResponseOptions {
	assistantMessageData?: Partial<Message>;
	generateTitle?: boolean;
	model?: string;
	models?: string[];
}

/**
 * Hook for managing streaming responses and abort control.
 * Handles both local WebLLM and remote API streaming.
 */
export function useStreamingResponse(
	webLLMService: any,
	onTitleGeneration?: (conversationId: string, messages: Message[]) => Promise<void>,
	requestOptions?: ChatRequestOptions,
) {
	const { stopLoading } = useLoadingActions();
	const { updateLoading } = useLoadingActions();
	const {
		chatMode,
		model,
		chatSettings,
		isAuthenticated,
		isPro,
		localOnlyMode,
		useMultiModel,
		selectedAgentId,
		setModel,
	} = useChatStore();

	const [streamStarted, setStreamStarted] = useState(false);
	const [controller, setController] = useState(() => new AbortController());
	const assistantResponseRef = useRef<string>("");
	const assistantReasoningRef = useRef<string>("");
	const { data: apiModels = {} } = useModels();

	const { addMessageToConversation, addAssistantMessage, updateAssistantMessage } =
		useMessageOperations();

	const generateResponse = useCallback(
		async (
			messages: Message[],
			conversationId: string,
			overrideRequestOptions?: ChatRequestOptions,
			options?: Pick<StreamResponseOptions, "assistantMessageData" | "model" | "models">,
		): Promise<{
			status: "success" | "error";
			response: string;
			message?: Message;
		}> => {
			const isLocal = chatMode === "local";
			let response = "";
			let generatedMessage: Message | undefined;
			const assistantMessageData = options?.assistantMessageData;

			const placeholderMessage = await addAssistantMessage(
				conversationId,
				"",
				undefined,
				assistantMessageData,
			);
			let activeAssistantMessage: Message | undefined = placeholderMessage;
			let activeAssistantMessagePromise: Promise<Message> | null =
				Promise.resolve(placeholderMessage);

			const ensureActiveAssistantMessage = () => {
				if (activeAssistantMessage) {
					return Promise.resolve(activeAssistantMessage);
				}

				if (activeAssistantMessagePromise) {
					return activeAssistantMessagePromise;
				}

				activeAssistantMessagePromise = addAssistantMessage(
					conversationId,
					"",
					undefined,
					assistantMessageData,
				).then((message) => {
					activeAssistantMessage = message;
					return message;
				});
				return activeAssistantMessagePromise;
			};

			const withAssistantMessageData = (assistantMessage: Message): Message => ({
				...assistantMessage,
				...assistantMessageData,
				content: assistantMessage.content,
				model: assistantMessage.model ?? assistantMessageData?.model,
				reasoning: assistantMessage.reasoning ?? assistantMessageData?.reasoning,
				role: "assistant",
				status: assistantMessage.status,
			});

			const handleMessageUpdate = (
				content: Message["content"],
				reasoning?: string,
				toolResponses?: Message[],
				done?: boolean,
				assistantMessage?: Message,
			) => {
				if (done && assistantMessage) {
					ensureActiveAssistantMessage().then((message) => {
						const updatedAssistantMessage = withAssistantMessageData(assistantMessage);
						updateAssistantMessage(
							conversationId,
							updatedAssistantMessage.content,
							updatedAssistantMessage.reasoning?.content || reasoning,
							updatedAssistantMessage,
							{
								messageId: message.id,
							},
						);
						activeAssistantMessage = undefined;
						activeAssistantMessagePromise = null;
					});
					generatedMessage = withAssistantMessageData(assistantMessage);
					response = "";
					return;
				}

				response = typeof content === "string" ? content : response;

				if (toolResponses && toolResponses.length > 0) {
					setTimeout(() => {
						for (const toolResponse of toolResponses) {
							addMessageToConversation(conversationId, toolResponse);
						}
					}, 0);
				} else {
					ensureActiveAssistantMessage().then((message) => {
						updateAssistantMessage(conversationId, content, reasoning, undefined, {
							messageId: message.id,
						});
					});
				}
			};

			try {
				if (isLocal) {
					const currentModel = normalizeSelectedModel(options?.model ?? model);
					if (!currentModel) {
						throw new Error("Cannot generate local response without a selected model.");
					}
					const handleProgress = (text: string) => {
						response += text;
						assistantResponseRef.current = response;

						updateAssistantMessage(conversationId, response, undefined, undefined, {
							messageId: placeholderMessage.id,
						});
					};

					const lastMessage = messages[messages.length - 1];
					const lastMessageContent =
						typeof lastMessage.content === "string"
							? lastMessage.content
							: lastMessage.content.map((item) => item.text || "").join("");

					response = await webLLMService.generate(
						String(conversationId),
						lastMessageContent,
						async (_chatId: string, content: any, _model: any, _mode: any, role: string) => {
							if (role !== "user") handleMessageUpdate(content);
							return [];
						},
						handleProgress,
					);
				} else {
					const shouldStore = isAuthenticated && isPro && !localOnlyMode && !chatSettings.localOnly;

					const normalizedMessages = messages.map(normalizeMessage);

					const modelsToSend = options?.models
						?.map((modelId) => normalizeSelectedModel(modelId))
						.filter((modelId): modelId is string => Boolean(modelId));
					const modelToSend = normalizeSelectedModel(modelsToSend?.[0] ?? options?.model ?? model);
					const providerToSend = getModelProvider(apiModels, modelToSend);

					const handleStateChange = (state: string, data?: any) => {
						let msg: string | undefined;
						switch (state) {
							case "init":
								msg = "Calling provider...";
								break;
							case "thinking":
								msg = "Thinking about response...";
								break;
							case "post_processing":
								msg = "Finalizing response...";
								break;
							case "tool_use_start":
								msg = `Running tool ${data?.tool_name || ""}...`;
								break;
							case "tool_use_stop":
								msg = "Tool execution completed.";
								break;
							default:
								return;
						}
						updateLoading("stream-response", undefined, msg);
					};
					const assistantMessage = await apiService.streamChatCompletions({
						chatSettings,
						completionId: conversationId,
						endpoint: chatMode === "agent" ? `/agents/${selectedAgentId}/completions` : undefined,
						messages: normalizedMessages,
						mode: chatMode,
						model: modelToSend,
						models: modelsToSend?.length ? modelsToSend : undefined,
						onProgress: handleMessageUpdate,
						onStateChange: handleStateChange,
						provider: providerToSend,
						requestOptions: overrideRequestOptions ?? requestOptions,
						signal: controller.signal,
						store: shouldStore,
						streamingEnabled: true,
						useMultiModel: modelsToSend && modelsToSend.length > 1 ? true : useMultiModel,
					});

					const textPreview =
						typeof assistantMessage.content === "string"
							? assistantMessage.content
							: assistantMessage.content
									.map((item: MessageContent) => (item.type === "text" ? item.text || "" : ""))
									.join("");

					if (generatedMessage?.id !== assistantMessage.id) {
						const targetMessage = activeAssistantMessage || placeholderMessage;
						const updatedAssistantMessage = withAssistantMessageData(assistantMessage);
						await updateAssistantMessage(
							conversationId,
							updatedAssistantMessage.content,
							updatedAssistantMessage.reasoning?.content,
							updatedAssistantMessage,
							{ messageId: targetMessage.id },
						);
					}

					response = textPreview;
					generatedMessage = withAssistantMessageData(assistantMessage);
				}

				return {
					status: "success",
					response,
					message: generatedMessage,
				};
			} catch (error) {
				if (controller.signal.aborted) {
					console.log("Request aborted by user.");
					return { status: "error" as const, response: "Request aborted" };
				}
				throw error;
			}
		},
		[
			chatMode,
			updateAssistantMessage,
			isAuthenticated,
			isPro,
			localOnlyMode,
			chatSettings,
			model,
			controller,
			addMessageToConversation,
			addAssistantMessage,
			useMultiModel,
			selectedAgentId,
			apiModels,
			updateLoading,
			webLLMService,
			requestOptions,
		],
	);

	const streamResponse = useCallback(
		async (
			messages: Message[],
			conversationId: string,
			overrideRequestOptions?: ChatRequestOptions,
			options?: StreamResponseOptions,
		) => {
			if (!messages.length) {
				toast.error("No messages provided");
				throw new Error("No messages provided");
			}

			try {
				const response = await generateResponse(messages, conversationId, overrideRequestOptions, {
					assistantMessageData: options?.assistantMessageData,
					model: options?.model,
					models: options?.models,
				});

				const shouldGenerateTitle = options?.generateTitle ?? true;
				if (
					shouldGenerateTitle &&
					response.status === "success" &&
					messages.length <= 1 &&
					onTitleGeneration
				) {
					onTitleGeneration(conversationId, messages).catch((err) =>
						console.error("Background title generation failed:", err),
					);
				}

				return response;
			} catch (error) {
				if (controller.signal.aborted) {
					toast.error("Request aborted");
				} else {
					const streamError = error as Error & {
						status?: number;
						code?: string;
						message?: string;
					};
					console.error("Error generating response:", streamError);

					if (streamError.status === 429) {
						toast.error("Rate limit exceeded. Please try again later.");
					} else if (streamError.code === "model_not_found") {
						toast.error(`Model not found: ${model}`);
						setModel(null);
					} else {
						toast.error(streamError.message || "Failed to generate response");
					}

					throw streamError;
				}
				return {
					status: "error" as const,
					response: (error as Error).message || "Failed",
				};
			} finally {
				setStreamStarted(false);
				stopLoading("stream-response");
				setController(new AbortController());
			}
		},
		[generateResponse, controller, stopLoading, model, setModel, onTitleGeneration],
	);

	const abortStream = useCallback(() => {
		if (controller) {
			controller.abort();
		}
	}, [controller]);

	return {
		streamStarted,
		setStreamStarted,
		controller,
		assistantResponseRef,
		assistantReasoningRef,
		streamResponse,
		generateResponse,
		abortStream,
	};
}
