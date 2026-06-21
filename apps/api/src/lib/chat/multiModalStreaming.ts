import { getAIResponse } from "~/lib/chat/responses";
import type { ModelConfigInfo } from "@assistant/schemas";
import type { ConversationManager } from "~/lib/conversationManager";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ChatMode, IEnv, IUser, IUserSettings, Message, Platform } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { createStreamWithPostProcessing } from "./streaming";
import { safeParseJson } from "~/utils/json";

const logger = getLogger({ prefix: "lib/chat/multiModalStreaming" });

function getOpinionMode(messages: unknown): string | null {
	if (!Array.isArray(messages)) {
		return null;
	}

	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (
			message &&
			typeof message === "object" &&
			"role" in message &&
			message.role === "user" &&
			"data" in message &&
			message.data &&
			typeof message.data === "object" &&
			"opinion" in message.data &&
			message.data.opinion &&
			typeof message.data.opinion === "object" &&
			"mode" in message.data.opinion &&
			typeof message.data.opinion.mode === "string"
		) {
			return message.data.opinion.mode;
		}
	}

	return null;
}

function buildConsensusSynthesisPrompt(modelResponses: string): string {
	return [
		"Write a concise consensus from these model responses.",
		"State the shared answer, mention meaningful disagreement or uncertainty, and finish with the answer a user should trust.",
		"Do not mention process unless it affects confidence.",
		"",
		modelResponses,
	].join("\n");
}

/**
 * Creates a multi-model stream that queries multiple models and combines their responses
 * @param parameters - The parameters
 * @param options - The options
 * @param conversationManager - The conversation manager
 * @returns The multi-model stream
 */
export function createMultiModelStream(
	parameters: any,
	options: {
		env: IEnv;
		completion_id: string;
		model: string;
		provider: string;
		platform?: Platform;
		user?: IUser;
		context?: ServiceContext;
		userSettings?: IUserSettings;
		app_url?: string;
		mode?: ChatMode;
		tools?: any[];
		enabled_tools?: string[];
	},
	conversationManager: ConversationManager,
): ReadableStream {
	const { models, ...baseParams } = parameters;
	const primaryParams = {
		...baseParams,
		model: models[0].model,
		provider: models[0].provider,
		stream: true,
	};

	const primaryResponsePromise = getAIResponse(primaryParams);

	const secondaryPromises =
		models.length > 1
			? models.slice(1).map(async (modelConfig: ModelConfigInfo) => {
					logger.info("Secondary model request", { model: modelConfig.model });

					const secondaryParams = {
						...baseParams,
						model: modelConfig.model,
						provider: modelConfig.provider,
						stream: false,
					};

					try {
						const response = await getAIResponse(secondaryParams);

						if (!(response instanceof ReadableStream)) {
							const encoder = new TextEncoder();
							const responseText = response.response || "";
							const modelName = modelConfig.displayName;
							const modelResponse = `${responseText}`;

							return new ReadableStream({
								start(controller) {
									controller.enqueue(
										encoder.encode(
											`data: ${JSON.stringify({
												type: "content_block_delta",
												content: modelResponse,
												modelName: modelName,
											})}\n\n`,
										),
									);
									controller.enqueue(encoder.encode("data: [DONE]\n\n"));
									controller.close();
								},
							});
						}

						return response;
					} catch (error) {
						logger.error(`Error getting response from secondary model ${modelConfig.model}`, {
							error,
						});

						return new ReadableStream({
							start(controller) {
								controller.close();
							},
						});
					}
				})
			: [];

	return new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			let primaryContent = "";
			let modelHeader = "";

			try {
				const usageLimits = await conversationManager.getUsageLimits();
				if (usageLimits) {
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({
								type: "usage_limits",
								usage_limits: usageLimits,
							})}\n\n`,
						),
					);
				}
			} catch (error) {
				logger.error("Failed to get usage limits for multi-model streaming:", error);
			}

			try {
				const primaryResponse = await primaryResponsePromise;
				if (!(primaryResponse instanceof ReadableStream)) {
					throw new AssistantError(
						"Primary model response is not a stream",
						ErrorType.PROVIDER_ERROR,
					);
				}

				const primaryProcessedStream = await createStreamWithPostProcessing(
					primaryResponse,
					{ ...options, model: models[0].model, provider: models[0].provider },
					conversationManager,
				);

				const primaryReader = primaryProcessedStream.getReader();

				const modelNames = models.map((m: ModelConfigInfo) => m.displayName).join(", ");
				modelHeader = `Using the following models: ${modelNames}\n\n`;
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "content_block_delta",
							content: modelHeader,
						})}\n\n`,
					),
				);

				while (true) {
					const { done, value } = await primaryReader.read();
					if (done) break;

					const text = new TextDecoder().decode(value);
					try {
						const matches = text.match(/data: (.*?)\n\n/g);
						if (matches) {
							for (const match of matches) {
								const dataStr = match.substring(6, match.length - 2);
								if (dataStr === "[DONE]") continue;
								const data = safeParseJson(dataStr);
								if (!data) {
									throw new AssistantError("Failed to parse data", ErrorType.PARAMS_ERROR);
								}
								if (data.type === "content_block_delta" && data.content) {
									primaryContent += data.content;
								} else if (data.type === "text" && data.text) {
									primaryContent += data.text;
								}
							}
						}
					} catch {
						/* ignore parse errors during capture */
					}

					controller.enqueue(value);
				}
			} catch (error) {
				logger.error("Error processing primary stream in multi-model setup:", error);
				controller.error(error);
				return;
			}

			let secondaryContent = "";
			try {
				const secondaryResponses = await Promise.all(secondaryPromises);
				let secondaryIndex = 0;

				for (const secondaryStream of secondaryResponses) {
					const modelConfig = models[secondaryIndex + 1];
					const modelName = modelConfig?.displayName || "Secondary model";

					const divider = `\n\n***\n### ${modelName} response\n\n`;
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({ type: "content_block_delta", content: divider })}\n\n`,
						),
					);
					secondaryContent += divider;

					const secondaryReader = secondaryStream.getReader();
					while (true) {
						const { done, value } = await secondaryReader.read();
						if (done) break;

						const text = new TextDecoder().decode(value);
						try {
							const matches = text.match(/data: (.*?)\n\n/g);
							if (matches) {
								for (const match of matches) {
									const dataStr = match.substring(6, match.length - 2);
									if (dataStr === "[DONE]") continue;
									const data = safeParseJson(dataStr);
									if (!data) {
										throw new AssistantError("Failed to parse data", ErrorType.PARAMS_ERROR);
									}
									if (data.type === "content_block_delta" && data.content) {
										secondaryContent += data.content;
										const deltaEvent = encoder.encode(
											`data: ${JSON.stringify({
												type: "content_block_delta",
												content: data.content,
											})}\n\n`,
										);
										controller.enqueue(deltaEvent);
									} else {
										controller.enqueue(value);
									}
								}
							} else {
								controller.enqueue(value);
							}
						} catch {
							controller.enqueue(value);
						}
					}
					secondaryIndex++;
				}
			} catch (error) {
				logger.error("Error processing secondary streams:", {
					error_message: error instanceof Error ? error.message : "Unknown error",
				});

				const errorMessage =
					"\n\n***\n### Error processing additional model responses\n\nThere was an error processing responses from secondary models. Only the primary model response is available.\n\n";

				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "content_block_delta",
							content: errorMessage,
							isError: true,
						})}\n\n`,
					),
				);

				secondaryContent += errorMessage;
			}

			if (getOpinionMode(baseParams.messages) === "consensus" && secondaryContent.trim()) {
				const consensusDivider = "\n\n***\n### Consensus\n\n";
				const comparisonContent = `${modelHeader}### ${models[0].displayName} response\n\n${primaryContent}${secondaryContent}`;

				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "content_block_delta",
							content: consensusDivider,
						})}\n\n`,
					),
				);
				secondaryContent += consensusDivider;

				try {
					const consensusResponse = await getAIResponse({
						...baseParams,
						disable_functions: true,
						enabled_tools: [],
						messages: [
							...baseParams.messages,
							{
								role: "user",
								content: buildConsensusSynthesisPrompt(comparisonContent),
							},
						],
						model: models[0].model,
						provider: models[0].provider,
						stream: false,
						tools: undefined,
					});

					if (!(consensusResponse instanceof ReadableStream)) {
						const consensusContent = consensusResponse.response || "";
						secondaryContent += consensusContent;
						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({
									type: "content_block_delta",
									content: consensusContent,
								})}\n\n`,
							),
						);
					}
				} catch (error) {
					logger.error("Error synthesizing multi-model consensus:", {
						error_message: error instanceof Error ? error.message : "Unknown error",
					});
					const consensusError =
						"Consensus synthesis failed, but the individual model responses above are available.";
					secondaryContent += consensusError;
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({
								type: "content_block_delta",
								content: consensusError,
								isError: true,
							})}\n\n`,
						),
					);
				}
			}

			try {
				const conversation = await conversationManager.get(options.completion_id);
				const secondaryModels = models.slice(1).map((m: ModelConfigInfo) => m.model) || [];
				const buildFinalMessage = (content: string, baseMessage?: Partial<Message>): Message => ({
					...baseMessage,
					role: "assistant",
					content,
					citations: baseMessage?.citations || [],
					log_id: baseMessage?.log_id || null,
					mode: options.mode,
					id: baseMessage?.id || generateId(),
					timestamp: baseMessage?.timestamp || Date.now(),
					model: baseMessage?.model || models[0].model,
					platform: baseMessage?.platform || options.platform || "api",
					usage: baseMessage?.usage || null,
					data: {
						...baseMessage?.data,
						includesSecondaryModels: true,
						secondaryModels,
					},
					tool_calls: baseMessage?.tool_calls || null,
				});
				let finalAssistantMessage: Message | null = null;

				if (conversation?.length > 0) {
					const assistantMessages = conversation.filter((msg) => msg.role === "assistant");
					if (assistantMessages.length > 0) {
						const lastMessage = assistantMessages[assistantMessages.length - 1];
						let storedPrimaryContent = "";
						if (typeof lastMessage.content === "string") {
							storedPrimaryContent = lastMessage.content;
						} else if (Array.isArray(lastMessage.content)) {
							const textBlock = lastMessage.content.find((block) => block.type === "text");
							storedPrimaryContent = textBlock?.text || "";
						}

						const finalCombinedContent = modelHeader + storedPrimaryContent + secondaryContent;
						finalAssistantMessage = buildFinalMessage(finalCombinedContent, lastMessage);

						await conversationManager.update(options.completion_id, [finalAssistantMessage]);
					} else {
						const finalCombinedContentForAdd = modelHeader + primaryContent + secondaryContent;
						finalAssistantMessage = buildFinalMessage(finalCombinedContentForAdd);
						await conversationManager.add(options.completion_id, finalAssistantMessage);
					}
				} else {
					const finalCombinedContentForAdd = modelHeader + primaryContent + secondaryContent;
					finalAssistantMessage = buildFinalMessage(finalCombinedContentForAdd);
					await conversationManager.add(options.completion_id, finalAssistantMessage);
				}

				if (finalAssistantMessage) {
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({
								type: "message_delta",
								id: options.completion_id,
								message_id: finalAssistantMessage.id,
								object: "chat.completion",
								created: finalAssistantMessage.timestamp,
								model: finalAssistantMessage.model,
								content: finalAssistantMessage.content,
								data: finalAssistantMessage.data,
								log_id: finalAssistantMessage.log_id,
								usage: finalAssistantMessage.usage,
								citations: finalAssistantMessage.citations,
								finish_reason: "stop",
							})}\n\n`,
						),
					);
				}

				try {
					const updatedUsageLimits = await conversationManager.getUsageLimits();
					if (updatedUsageLimits) {
						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({
									type: "usage_limits",
									usage_limits: updatedUsageLimits,
								})}\n\n`,
							),
						);
					}
				} catch (error) {
					logger.error("Failed to get updated usage limits for multi-model streaming:", error);
				}

				controller.enqueue(encoder.encode("data: [DONE]\n\n"));
				controller.close();
			} catch (error) {
				logger.error("Error during finalization/storage:", {
					error_message: error instanceof Error ? error.message : "Unknown error",
				});
				controller.error(error);
			}
		},
		cancel(reason) {
			logger.warn("Multi-model stream cancelled", {
				reason,
				completion_id: options.completion_id,
			});
		},
	});
}
