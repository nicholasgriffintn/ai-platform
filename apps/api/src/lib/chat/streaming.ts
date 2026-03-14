import {
	MAX_BUFFER_LENGTH,
	MAX_CONTENT_LENGTH,
	MAX_THINKING_LENGTH,
} from "~/constants/app";
import { formatAssistantMessage, getAIResponse } from "~/lib/chat/responses";
import { handleToolCalls } from "~/lib/chat/tools";
import { getToolEventPayload } from "~/lib/chat/utils";
import { preprocessQwQResponse } from "~/lib/chat/utils/qwq";
import type { ConversationManager } from "~/lib/conversationManager";
import { ResponseFormatter, StreamingFormatter } from "~/lib/formatter";
import { AssistantError, ErrorType } from "~/utils/errors";
import { Guardrails } from "~/lib/providers/capabilities/guardrails";
import { MemoryManager } from "~/lib/memory";
import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import {
	type ChatMode,
	type IEnv,
	type IUser,
	type IUserSettings,
	type Platform,
	StreamState,
	type ToolCall,
	ToolStage,
} from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { emitDoneEvent, emitEvent } from "./emitter";
import { safeParseJson } from "~/utils/json";

const logger = getLogger({ prefix: "lib/chat/streaming" });

/**
 * Helper to emit standardized tool events
 * @param controller - The stream controller
 * @param toolCall - The tool call
 * @param stage - The stage of the tool call
 * @param parameters - Optional string containing the parameters for delta stage
 */
function emitToolEvents(
	controller: TransformStreamDefaultController<Uint8Array>,
	toolCall: ToolCall,
	stage: ToolStage,
	parameters?: string,
) {
	const eventType =
		stage === ToolStage.START
			? "tool_use_start"
			: stage === ToolStage.DELTA
				? "tool_use_delta"
				: "tool_use_stop";

	const payload = getToolEventPayload(toolCall, stage, parameters);
	emitEvent(controller, eventType, payload);
}

/**
 * Creates a transformed stream that handles post-processing of AI responses
 * With support for tool calls and guardrails
 * @param providerStream - The provider stream
 * @param options - The options
 * @param conversationManager - The conversation manager
 * @returns The transformed stream
 */
export async function createStreamWithPostProcessing(
	providerStream: ReadableStream,
	options: {
		env: IEnv;
		completion_id: string;
		model: string;
		provider: string;
		platform?: Platform;
		user?: IUser;
		userSettings?: IUserSettings;
		app_url?: string;
		mode?: ChatMode;
		max_steps?: number;
		current_step?: number;
		tools?: any[];
		enabled_tools?: string[];
		current_agent_id?: string;
		delegation_stack?: string[];
		max_delegation_depth?: number;
	},
	conversationManager: ConversationManager,
): Promise<ReadableStream> {
	const {
		env,
		completion_id,
		model,
		platform = "api",
		user,
		userSettings,
		app_url,
		mode,
		max_steps = 1,
		current_step = 1,
		tools,
		enabled_tools,
	} = options;

	const fullContentChunks: string[] = [];
	const fullThinkingChunks: string[] = [];
	const bufferChunks: string[] = [];
	let totalContentLength = 0;
	let totalThinkingLength = 0;
	let totalBufferLength = 0;

	let signature = "";
	let citationsResponse = [];
	let toolCallsData: any[] = [];
	let usageData: any = null;
	let structuredData: any = null;
	let postProcessingDone = false;
	let currentEventType = "";
	const currentToolCalls: Record<string, any> = {};
	let isFirstContentChunk = true;
	let qwqThinkTagAdded = false;
	let refusalData: string | null = null;
	let annotationsData: any = null;

	const getFullContent = () => fullContentChunks.join("");
	const getFullThinking = () => fullThinkingChunks.join("");
	const getBuffer = () => bufferChunks.join("");

	const addToFullContent = (chunk: string) => {
		fullContentChunks.push(chunk);
		totalContentLength += chunk.length;

		if (totalContentLength > MAX_CONTENT_LENGTH) {
			logger.warn("Content size exceeded limit, trimming older content", {
				completion_id,
				totalLength: totalContentLength,
				maxLength: MAX_CONTENT_LENGTH,
			});

			while (
				totalContentLength > MAX_CONTENT_LENGTH * 0.8 &&
				fullContentChunks.length > 1
			) {
				const removedChunk = fullContentChunks.shift()!;
				totalContentLength -= removedChunk.length;
			}
		}
	};

	const addToFullThinking = (chunk: string) => {
		fullThinkingChunks.push(chunk);
		totalThinkingLength += chunk.length;

		if (totalThinkingLength > MAX_THINKING_LENGTH) {
			logger.warn("Thinking size exceeded limit, trimming older content", {
				completion_id,
				totalLength: totalThinkingLength,
				maxLength: MAX_THINKING_LENGTH,
			});

			while (
				totalThinkingLength > MAX_THINKING_LENGTH * 0.8 &&
				fullThinkingChunks.length > 1
			) {
				const removedChunk = fullThinkingChunks.shift()!;
				totalThinkingLength -= removedChunk.length;
			}
		}
	};

	const addToBuffer = (chunk: string) => {
		bufferChunks.push(chunk);
		totalBufferLength += chunk.length;

		if (totalBufferLength > MAX_BUFFER_LENGTH) {
			logger.warn("Buffer size exceeded limit, trimming older content", {
				completion_id,
				totalLength: totalBufferLength,
				maxLength: MAX_BUFFER_LENGTH,
			});

			while (
				totalBufferLength > MAX_BUFFER_LENGTH * 0.8 &&
				bufferChunks.length > 1
			) {
				const removedChunk = bufferChunks.shift()!;
				totalBufferLength -= removedChunk.length;
			}
		}
	};

	const setBuffer = (newBuffer: string) => {
		bufferChunks.length = 0;
		totalBufferLength = 0;
		if (newBuffer) {
			addToBuffer(newBuffer);
		}
	};

	const guardrails = new Guardrails(env, user, userSettings);
	const modelConfig = await getModelConfigByMatchingModel(model);

	return providerStream.pipeThrough(
		new TransformStream({
			async start(controller) {
				try {
					emitEvent(controller, "state", {
						state: StreamState.INIT,
					});
					const usageLimits = await conversationManager.getUsageLimits();
					if (usageLimits) {
						emitEvent(controller, "usage_limits", {
							usage_limits: usageLimits,
						});
					}
					emitEvent(controller, "state", {
						state: StreamState.THINKING,
					});
				} catch (error) {
					logger.error("Failed in stream start:", {
						error_message:
							error instanceof Error ? error.message : "Unknown error",
					});
				}
			},
			async transform(chunk, controller) {
				let text: string;
				try {
					text = new TextDecoder().decode(chunk);
				} catch (error) {
					logger.error("Failed to decode chunk:", {
						error_message:
							error instanceof Error ? error.message : "Unknown error",
					});
					return;
				}

				logger.trace("Incoming chunk", {
					chunkSize: chunk.byteLength,
					bufferBefore: totalBufferLength,
				});

				addToBuffer(text);

				const buffer = getBuffer();
				const lines = buffer.split("\n");
				setBuffer(lines.pop() || "");

				for (const line of lines) {
					if (!line.trim()) {
						continue;
					}

					if (line.startsWith("event: ")) {
						currentEventType = line.substring(7).trim();
						logger.trace("Received SSE event", { currentEventType });
						continue;
					}

					if (line.startsWith("data: ")) {
						const dataStr = line.substring(6).trim();

						if (dataStr === "[DONE]") {
							if (!postProcessingDone) {
								if (
									Object.keys(currentToolCalls).length > 0 &&
									toolCallsData.length === 0
								) {
									const completeToolCalls = Object.values(currentToolCalls);
									toolCallsData = completeToolCalls;
								}

								await handlePostProcessing();
							}
							continue;
						}

						try {
							const data = safeParseJson(dataStr);
							if (!data) {
								throw new AssistantError(
									"Failed to parse data",
									ErrorType.PARAMS_ERROR,
								);
							}
							logger.trace("Parsed SSE data", { currentEventType, data });

							if (data.error) {
								emitEvent(controller, "error", {
									error: data.error,
								});
								emitDoneEvent(controller);
								logger.error("Error in data", { error: data.error });
								return;
							}

							const formattedData = await ResponseFormatter.formatResponse(
								data,
								options.provider,
								{
									model,
									modalities: modelConfig?.modalities,
									env,
									is_streaming: true,
								},
							);

							let contentDelta = "";

							if (data.choices?.[0]?.delta?.content !== undefined) {
								contentDelta = data.choices[0].delta.content;
							} else {
								contentDelta = StreamingFormatter.extractContentFromChunk(
									formattedData,
									currentEventType,
								);
							}

							if (contentDelta) {
								// Handle QwQ models: add <think> tag if needed on first content chunk
								const isQwQModel = model.toLowerCase().includes("qwq");
								if (isQwQModel && isFirstContentChunk && !qwqThinkTagAdded) {
									const contentStartsWithThink = contentDelta
										.trim()
										.startsWith("<think>");
									if (!contentStartsWithThink) {
										emitEvent(controller, "content_block_delta", {
											content: "<think>\n",
										});
										addToFullContent("<think>\n");
										qwqThinkTagAdded = true;
									}
								}

								addToFullContent(contentDelta);
								isFirstContentChunk = false;

								emitEvent(controller, "content_block_delta", {
									content: contentDelta,
								});
							}

							const thinkingData = StreamingFormatter.extractThinkingFromChunk(
								data,
								currentEventType,
							);

							if (thinkingData) {
								if (typeof thinkingData === "string") {
									addToFullThinking(thinkingData);

									emitEvent(controller, "thinking_delta", {
										thinking: thinkingData,
									});
								} else if (thinkingData.type === "signature") {
									signature = thinkingData.signature;

									emitEvent(controller, "signature_delta", {
										signature: thinkingData.signature,
									});
								}
							}

							const toolCallData = StreamingFormatter.extractToolCall(
								data,
								currentEventType,
							);

							if (toolCallData) {
								if (toolCallData.format === "openai") {
									const deltaToolCalls = toolCallData.toolCalls;

									for (const toolCall of deltaToolCalls) {
										const index = toolCall.index;

										if (!currentToolCalls[index]) {
											currentToolCalls[index] = {
												id: toolCall.id,
												type: toolCall.type || "function",
												function: {
													name: toolCall.function?.name || "",
													arguments: "",
												},
											};
										}

										if (toolCall.function) {
											if (toolCall.function.name) {
												currentToolCalls[index].function.name =
													toolCall.function.name;
											}
											if (toolCall.function.arguments) {
												currentToolCalls[index].function.arguments +=
													toolCall.function.arguments;
											}
										}
									}
								} else if (toolCallData.format === "anthropic") {
									currentToolCalls[toolCallData.index] = {
										id: toolCallData.id,
										name: toolCallData.name,
										accumulatedInput: "",
										isComplete: false,
									};
								} else if (toolCallData.format === "anthropic_delta") {
									if (
										currentToolCalls[toolCallData.index] &&
										toolCallData.partial_json
									) {
										currentToolCalls[toolCallData.index].accumulatedInput +=
											toolCallData.partial_json;
									}
								} else if (toolCallData.format === "nova") {
									currentToolCalls[toolCallData.index] = {
										id: toolCallData.id,
										name: toolCallData.name,
										accumulatedInput: "",
										isComplete: false,
									};
								} else if (toolCallData.format === "nova_delta") {
									if (
										currentToolCalls[toolCallData.index] &&
										toolCallData.partial_json
									) {
										currentToolCalls[toolCallData.index].accumulatedInput +=
											toolCallData.partial_json;
									}
								} else if (toolCallData.format === "direct") {
									toolCallsData = [...toolCallsData, ...toolCallData.toolCalls];
								}
							}

							if (
								currentEventType === "message_start" ||
								currentEventType === "message_delta" ||
								currentEventType === "message_stop" ||
								currentEventType === "content_block_start" ||
								currentEventType === "content_block_stop"
							) {
								emitEvent(controller, currentEventType, data);

								if (
									currentEventType === "content_block_stop" &&
									data.index !== undefined &&
									Object.hasOwn(currentToolCalls, data.index) &&
									currentToolCalls[data.index] &&
									!currentToolCalls[data.index].isComplete
								) {
									currentToolCalls[data.index].isComplete = true;

									const toolState = currentToolCalls[data.index];
									let parsedInput = {};
									try {
										if (toolState.accumulatedInput) {
											parsedInput = safeParseJson(toolState.accumulatedInput);

											if (
												parsedInput === null ||
												typeof parsedInput !== "object" ||
												Array.isArray(parsedInput)
											) {
												logger.warn("Tool input parsed to non-object value", {
													toolId: toolState.id,
													toolName: toolState.name,
													parsed: typeof parsedInput,
												});
												parsedInput = {};
											}
										}
									} catch (e) {
										logger.error("Failed to parse tool input:", {
											error: e,
											toolId: toolState.id,
											toolName: toolState.name,
											input:
												toolState.accumulatedInput?.substring(0, 100) +
												(toolState.accumulatedInput?.length > 100 ? "..." : ""),
										});
									}

									const toolCall = {
										id: toolState.id,
										type: toolState.type || "function",
										function: {
											name: toolState.name,
											arguments: JSON.stringify(parsedInput),
										},
									};

									toolCallsData.push(toolCall);
								}

								if (
									currentEventType === "message_stop" &&
									!postProcessingDone
								) {
									await handlePostProcessing();
								}
							}

							const extractedCitations =
								StreamingFormatter.extractCitations(data);
							if (extractedCitations.length > 0) {
								citationsResponse = extractedCitations;
							}

							const extractedUsage = StreamingFormatter.extractUsageData(data);
							if (extractedUsage) {
								usageData = extractedUsage;
							}

							const extractedStructuredData =
								StreamingFormatter.extractStructuredData(data);
							if (extractedStructuredData) {
								structuredData = extractedStructuredData;
							}

							const refusalDelta =
								StreamingFormatter.extractRefusalFromChunk(data);
							if (typeof refusalDelta === "string") {
								refusalData = refusalDelta;
							}

							const annotationsDelta =
								StreamingFormatter.extractAnnotationsFromChunk(data);
							if (annotationsDelta !== null && annotationsDelta !== undefined) {
								annotationsData = annotationsDelta;
							}

							if (
								StreamingFormatter.isCompletionIndicated(data) &&
								!postProcessingDone
							) {
								await handlePostProcessing();
							}
						} catch (parseError) {
							logger.error("Parse error on data", {
								error: parseError,
								data: dataStr,
							});
						}
					}
				}

				async function handlePostProcessing() {
					try {
						if (postProcessingDone) {
							return;
						}

						emitEvent(controller, "state", {
							state: StreamState.POST_PROCESSING,
						});
						postProcessingDone = true;

						const isProUser = user?.plan_id === "pro";

						const memoriesEnabled =
							userSettings?.memories_save_enabled ||
							userSettings?.memories_chat_history_enabled;
						if (isProUser && memoriesEnabled) {
							try {
								const history = await conversationManager.get(completion_id);
								const userHistory = history.filter((m) => m.role === "user");
								const lastUserRaw = userHistory.length
									? userHistory[userHistory.length - 1].content
									: "";
								const lastUserText =
									typeof lastUserRaw === "string"
										? lastUserRaw
										: Array.isArray(lastUserRaw)
											? (lastUserRaw.find((b: any) => b.type === "text") as any)
													?.text || ""
											: "";

								if (lastUserText.trim()) {
									const memMgr = MemoryManager.getInstance(env, user);
									const memEvents = await memMgr.handleMemory(
										lastUserText,
										history,
										conversationManager,
										completion_id,
										userSettings,
									);
									for (const ev of memEvents) {
										toolCallsData.push({
											id: generateId(),
											type: "function",
											function: {
												name: "memory",
												arguments: JSON.stringify(ev),
											},
										});
									}
								}
							} catch (error) {
								logger.error("Failed to process memory for chat:", {
									error,
									completion_id,
								});
							}
						}

						let guardrailsFailed = false;
						let guardrailError = "";
						let guardrailViolations: any[] = [];

						const fullContent = getFullContent();
						if (fullContent) {
							const outputValidation = await guardrails.validateOutput(
								fullContent,
								user?.id,
								completion_id,
							);

							if (!outputValidation?.isValid) {
								guardrailsFailed = true;
								guardrailError =
									outputValidation.rawResponse ||
									"Content failed validation checks";
								guardrailViolations = outputValidation.violations || [];

								logger.warn("Guardrails failed", {
									outputValidation,
									violations: guardrailViolations,
								});
							}
						}

						emitEvent(controller, "content_block_stop", {});

						const logId = env.AI?.aiGatewayLogId;

						const processedContent = preprocessQwQResponse(fullContent, model);

						const assistantMessage = formatAssistantMessage({
							content: processedContent,
							thinking: getFullThinking(),
							signature: signature,
							citations: citationsResponse,
							tool_calls: toolCallsData,
							usage: usageData,
							data: structuredData,
							guardrails: {
								passed: !guardrailsFailed,
								error: guardrailError,
								violations: guardrailViolations,
							},
							log_id: logId,
							model,
							platform,
							timestamp: Date.now(),
							mode,
							finish_reason: toolCallsData.length > 0 ? "tool_calls" : "stop",
							refusal: refusalData,
							annotations: annotationsData,
						});

						const contentForStorage =
							typeof assistantMessage.content === "string" ||
							Array.isArray(assistantMessage.content)
								? assistantMessage.content
								: "";

						await conversationManager.add(completion_id, {
							role: "assistant",
							content: contentForStorage,
							citations: assistantMessage.citations,
							log_id: assistantMessage.log_id,
							mode: assistantMessage.mode as ChatMode,
							id: assistantMessage.id,
							timestamp: assistantMessage.timestamp,
							model: assistantMessage.model,
							platform: assistantMessage.platform,
							usage: assistantMessage.usage,
							tool_calls: assistantMessage.tool_calls,
						});

						emitEvent(controller, "message_delta", {
							id: completion_id,
							object: "chat.completion",
							created: assistantMessage.timestamp,
							model: assistantMessage.model,
							nonce: generateId(),
							post_processing: {
								guardrails: assistantMessage.guardrails,
							},
							log_id: assistantMessage.log_id,
							usage: assistantMessage.usage,
							citations: assistantMessage.citations,
							finish_reason: assistantMessage.finish_reason,
							data: assistantMessage.data,
						});

						emitEvent(controller, "message_stop", {});

						if (toolCallsData.length > 0) {
							for (const toolCall of toolCallsData) {
								try {
									emitToolEvents(controller, toolCall, ToolStage.START);
								} catch (error) {
									logger.error("Error emitting tool start event", {
										error,
										toolCall,
									});
								}
								try {
									emitToolEvents(
										controller,
										toolCall,
										ToolStage.DELTA,
										toolCall.function?.arguments || "{}",
									);
								} catch (error) {
									logger.error("Error emitting tool delta event", {
										error,
										toolCall,
									});
								}
								try {
									emitToolEvents(controller, toolCall, ToolStage.STOP);
								} catch (error) {
									logger.error("Error emitting tool stop event", {
										error,
										toolCall,
									});
								}
							}

							emitEvent(controller, "tool_response_start", {
								tool_calls: toolCallsData,
							});

							const toolResults = await handleToolCalls(
								completion_id,
								{ response: fullContent || "", tool_calls: toolCallsData },
								conversationManager,
								{
									env,
									request: {
										completion_id,
										input: fullContent || "",
										model,
										date: new Date().toISOString().split("T")[0],
										current_agent_id: options.current_agent_id,
										delegation_stack: options.delegation_stack,
										max_delegation_depth: options.max_delegation_depth,
									},
									app_url,
									user: user?.id ? user : undefined,
								},
							);

							for (const toolResult of toolResults) {
								emitEvent(controller, "tool_response", {
									tool_id: toolResult.id,
									result: toolResult,
								});
							}

							emitEvent(controller, "tool_response_end", {});
						}

						try {
							const updatedUsageLimits =
								await conversationManager.getUsageLimits();
							if (updatedUsageLimits) {
								emitEvent(controller, "usage_limits", {
									usage_limits: updatedUsageLimits,
								});
							}
						} catch (error) {
							logger.error("Failed to get updated usage limits:", {
								error_message:
									error instanceof Error ? error.message : "Unknown error",
							});
						}

						if (
							toolCallsData.length > 0 &&
							max_steps &&
							current_step < max_steps
						) {
							const history = await conversationManager.get(completion_id);
							const lastToolResponses = history
								.filter((msg) => msg.role === "tool")
								.slice(-toolCallsData.length);

							const hasToolErrors = lastToolResponses.some(
								(message) => message.status === "error",
							);

							if (hasToolErrors) {
								logger.warn(
									"Tool errors detected, stopping multi-step execution",
									{
										completion_id,
										current_step,
									},
								);
							} else {
								try {
									const nextStream = await getAIResponse({
										...options,
										messages: history,
										tools,
										enabled_tools,
										stream: true,
									});
									const nextTransformed = await createStreamWithPostProcessing(
										nextStream,
										{ ...options, current_step: current_step + 1 },
										conversationManager,
									);

									const reader = nextTransformed.getReader();
									while (true) {
										const { done, value } = await reader.read();
										if (done) break;
										controller.enqueue(value);
									}
								} catch (error: any) {
									console.error("Next stream error:", {
										error_message:
											error instanceof Error ? error.message : "Unknown error",
									});
								}
							}
						}

						emitEvent(controller, "state", {
							state: StreamState.DONE,
						});

						emitDoneEvent(controller);
					} catch (error) {
						logger.error("Error in stream post-processing:", {
							error_message:
								error instanceof Error ? error.message : "Unknown error",
						});
					}
				}
			},
		}),
	);
}
