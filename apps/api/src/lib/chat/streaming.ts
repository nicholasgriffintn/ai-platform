// TODO: This file is messy, but refactoring it is a lot of work.

import type { ChatMode, IEnv, IUser, Platform } from "../../types";
import { getLogger } from "../../utils/logger";
import { handleToolCalls } from "../chat/tools";
import type { ConversationManager } from "../conversationManager";
import { Guardrails } from "../guardrails";

const logger = getLogger({ prefix: "CHAT_STREAMING" });

/**
 * Creates a transformed stream that handles post-processing of AI responses
 * With support for tool calls and guardrails
 */
export function createStreamWithPostProcessing(
	providerStream: ReadableStream,
	options: {
		env: IEnv;
		completion_id: string;
		model: string;
		platform?: Platform;
		user?: IUser;
		app_url?: string;
		mode?: ChatMode;
		isRestricted?: boolean;
	},
	conversationManager: ConversationManager,
): ReadableStream {
	const {
		env,
		completion_id,
		model,
		platform = "api",
		user,
		app_url,
		mode,
		isRestricted,
	} = options;

	let fullContent = "";
	let citationsResponse = [];
	let toolCallsData: any[] = [];
	let usageData: any = null;
	let postProcessingDone = false;
	let buffer = "";
	let currentEventType = "";
	const currentToolCalls: Record<string, any> = {};

	const guardrails = Guardrails.getInstance(env);

	return providerStream.pipeThrough(
		new TransformStream({
			async transform(chunk, controller) {
				const text = new TextDecoder().decode(chunk);
				buffer += text;

				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					if (!line.trim()) {
						continue;
					}

					if (line.startsWith("event: ")) {
						currentEventType = line.substring(7).trim();
						continue;
					}

					if (line.startsWith("data: ")) {
						const dataStr = line.substring(6).trim();

						if (dataStr === "[DONE]") {
							if (!postProcessingDone) {
								// Check if we have accumulated tool calls that haven't been processed yet
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
							const data = JSON.parse(dataStr);

							if (data.error) {
								const errorEvent = new TextEncoder().encode(
									`data: ${JSON.stringify({
										type: "error",
										error: data.error,
									})}\n\n`,
								);
								controller.enqueue(errorEvent);
								controller.enqueue(
									new TextEncoder().encode("data: [DONE]\n\n"),
								);
								logger.error("Error in data", { error: data.error });
								return;
							}

							if (
								data.choices &&
								(data.choices[0]?.finish_reason?.toLowerCase() === "stop" ||
									data.choices[0]?.finish_reason?.toLowerCase() === "length") &&
								!postProcessingDone
							) {
								if (data.choices[0]?.delta?.content) {
									fullContent += data.choices[0].delta.content || "";

									const contentDeltaEvent = new TextEncoder().encode(
										`data: ${JSON.stringify({
											type: "content_block_delta",
											content: data.choices[0].delta.content || "",
										})}\n\n`,
									);
									controller.enqueue(contentDeltaEvent);
								} else if (data.choices[0]?.message?.content && !fullContent) {
									fullContent = data.choices[0].message.content || "";

									const contentDeltaEvent = new TextEncoder().encode(
										`data: ${JSON.stringify({
											type: "content_block_delta",
											content: fullContent || "",
										})}\n\n`,
									);
									controller.enqueue(contentDeltaEvent);
								}

								if (data.usage) {
									usageData = data.usage;
								}

								if (data.citations) {
									citationsResponse = data.citations;
								}

								await handlePostProcessing();
								continue;
							}

							if (data.response !== undefined) {
								fullContent += data.response || "";

								const contentDeltaEvent = new TextEncoder().encode(
									`data: ${JSON.stringify({
										type: "content_block_delta",
										content: data.response || "",
									})}\n\n`,
								);
								controller.enqueue(contentDeltaEvent);
							} else if (
								data.choices &&
								data.choices.length > 0 &&
								data.choices[0].delta &&
								data.choices[0].delta.content !== undefined
							) {
								fullContent += data.choices[0].delta.content || "";

								const contentDeltaEvent = new TextEncoder().encode(
									`data: ${JSON.stringify({
										type: "content_block_delta",
										content: data.choices[0].delta.content || "",
									})}\n\n`,
								);
								controller.enqueue(contentDeltaEvent);

								// Fix for Perplexity Sonar models that end with an empty string.
								if (
									data.model?.includes("sonar") &&
									data.choices[0].delta.content === "" &&
									!postProcessingDone
								) {
									if (data.usage) {
										usageData = data.usage;
									}

									if (data.citations) {
										citationsResponse = data.citations;
									}

									await handlePostProcessing();

									continue;
								}
							}

							if (
								data.type === "content_block_delta" &&
								data.delta &&
								data.delta.type === "text_delta"
							) {
								fullContent += data.delta.text || "";

								const contentDeltaEvent = new TextEncoder().encode(
									`data: ${JSON.stringify({
										type: "content_block_delta",
										content: data.delta.text || "",
									})}\n\n`,
								);
								controller.enqueue(contentDeltaEvent);
							} else if (
								currentEventType === "content_block_delta" &&
								data.delta &&
								data.delta.type === "text_delta"
							) {
								fullContent += data.delta.text || "";

								const contentDeltaEvent = new TextEncoder().encode(
									`data: ${JSON.stringify({
										type: "content_block_delta",
										content: data.delta.text || "",
									})}\n\n`,
								);
								controller.enqueue(contentDeltaEvent);
							} else if (
								data.content &&
								currentEventType === "content_block_delta"
							) {
								fullContent += data.content || "";
							}

							if (!fullContent && data.content) {
								fullContent += data.content || "";
							}

							if (
								data.message?.content &&
								Array.isArray(data.message.content)
							) {
								for (const block of data.message.content) {
									if (block.type === "text" && block.text) {
										fullContent += block.text || "";
									}
								}
							}

							if (data.citations) {
								citationsResponse = data.citations;
							}

							if (data.usage) {
								usageData = data.usage;
							}

							if (
								[
									"message_start",
									"message_delta",
									"message_stop",
									"content_block_start",
									"content_block_stop",
								].includes(currentEventType)
							) {
								// Special handling for Anthropic for event types.
								const forwardEvent = new TextEncoder().encode(
									`data: ${JSON.stringify({
										type: currentEventType,
										...data,
									})}\n\n`,
								);
								controller.enqueue(forwardEvent);

								if (
									currentEventType === "content_block_start" &&
									data.content_block?.type === "tool_use" &&
									!isRestricted
								) {
									currentToolCalls[data.index] = {
										id: data.content_block.id,
										name: data.content_block.name,
										accumulatedInput: "",
										isComplete: false,
									};
								}

								if (
									currentEventType === "content_block_stop" &&
									data.index !== undefined &&
									currentToolCalls[data.index] &&
									!currentToolCalls[data.index].isComplete
								) {
									currentToolCalls[data.index].isComplete = true;

									const toolState = currentToolCalls[data.index];
									let parsedInput = {};
									try {
										if (toolState.accumulatedInput) {
											parsedInput = JSON.parse(toolState.accumulatedInput);
										}
									} catch (e) {
										logger.error("Failed to parse tool input:", e);
									}

									const toolCall = {
										id: toolState.id,
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

							if (
								data.type === "content_block_delta" &&
								data.delta?.type === "input_json_delta" &&
								data.index !== undefined &&
								currentToolCalls[data.index] &&
								!isRestricted
							) {
								if (data.delta.partial_json) {
									currentToolCalls[data.index].accumulatedInput +=
										data.delta.partial_json;
								}
							}

							if (
								data.choices &&
								data.choices.length > 0 &&
								data.choices[0].delta &&
								data.choices[0].delta.tool_calls &&
								!isRestricted
							) {
								const deltaToolCalls = data.choices[0].delta.tool_calls;

								// Accumulate tool calls from this delta
								for (const toolCall of deltaToolCalls) {
									const index = toolCall.index;

									// Initialize tool call if it's new
									if (!currentToolCalls[index]) {
										currentToolCalls[index] = {
											id: toolCall.id,
											function: {
												name: toolCall.function?.name || "",
												arguments: "",
											},
										};
									}

									// Accumulate arguments
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

								// If this is the final chunk, process the complete tool calls
								if (
									data.choices[0].finish_reason?.toLowerCase() === "tool_calls"
								) {
									const completeToolCalls = Object.values(currentToolCalls);
									toolCallsData = completeToolCalls;

									await handlePostProcessing();
								}
							} else if (data.tool_calls && !isRestricted) {
								// Handle non-OpenAI tool calls (direct format)
								toolCallsData = [...toolCallsData, ...data.tool_calls];
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
						postProcessingDone = true;

						// Validate output with guardrails
						let guardrailsFailed = false;
						let guardrailError = "";
						let violations: any[] = [];

						if (fullContent) {
							const outputValidation =
								await guardrails.validateOutput(fullContent);

							if (!outputValidation.isValid) {
								logger.debug("Output validation failed", {
									outputValidation,
								});
								guardrailsFailed = true;
								guardrailError =
									outputValidation.rawResponse?.blockedResponse ||
									"Response did not pass safety checks";
								violations = outputValidation.violations || [];
							}
						}

						// Send content stop event
						const contentStopEvent = new TextEncoder().encode(
							`data: ${JSON.stringify({
								type: "content_block_stop",
							})}\n\n`,
						);
						controller.enqueue(contentStopEvent);

						const logId = env.AI?.aiGatewayLogId;

						await conversationManager.add(completion_id, {
							role: "assistant",
							content: fullContent,
							citations: citationsResponse,
							log_id: logId,
							mode,
							id: Math.random().toString(36).substring(2, 7),
							timestamp: Date.now(),
							model,
							platform,
							usage: usageData,
						});

						// Prepare and send metadata event
						const metadata = {
							type: "message_delta",
							nonce: Math.random().toString(36).substring(2, 7),
							post_processing: {
								guardrails: {
									passed: !guardrailsFailed,
									error: guardrailError,
									violations,
								},
							},
							log_id: logId,
							usage: usageData,
							citations: citationsResponse,
						};

						const metadataEvent = new TextEncoder().encode(
							`data: ${JSON.stringify(metadata)}\n\n`,
						);
						controller.enqueue(metadataEvent);

						const messageStopEvent = new TextEncoder().encode(
							`data: ${JSON.stringify({
								type: "message_stop",
							})}\n\n`,
						);
						controller.enqueue(messageStopEvent);

						if (toolCallsData.length > 0 && !isRestricted) {
							// Emit tool use events for each tool call
							for (const toolCall of toolCallsData) {
								const toolStartEvent = new TextEncoder().encode(
									`data: ${JSON.stringify({
										type: "tool_use_start",
										tool_id: toolCall.id,
										tool_name: toolCall.function?.name || "",
									})}\n\n`,
								);
								controller.enqueue(toolStartEvent);

								const toolDeltaEvent = new TextEncoder().encode(
									`data: ${JSON.stringify({
										type: "tool_use_delta",
										tool_id: toolCall.id,
										parameters: toolCall.function?.arguments || "{}",
									})}\n\n`,
								);
								controller.enqueue(toolDeltaEvent);

								const toolStopEvent = new TextEncoder().encode(
									`data: ${JSON.stringify({
										type: "tool_use_stop",
										tool_id: toolCall.id,
									})}\n\n`,
								);
								controller.enqueue(toolStopEvent);
							}

							const toolResponseStartEvent = new TextEncoder().encode(
								`data: ${JSON.stringify({
									type: "tool_response_start",
									tool_calls: toolCallsData,
								})}\n\n`,
							);
							controller.enqueue(toolResponseStartEvent);

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
									},
									app_url,
									user: user?.id ? user : undefined,
								},
								isRestricted ?? false,
							);

							for (const toolResult of toolResults) {
								const toolResponseChunk = new TextEncoder().encode(
									`data: ${JSON.stringify({
										type: "tool_response",
										tool_id: toolResult.id,
										result: toolResult,
									})}\n\n`,
								);
								controller.enqueue(toolResponseChunk);
							}

							const toolResponseEndEvent = new TextEncoder().encode(
								`data: ${JSON.stringify({
									type: "tool_response_end",
								})}\n\n`,
							);
							controller.enqueue(toolResponseEndEvent);
						}

						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
					} catch (error) {
						logger.error("Error in stream post-processing:", error);
					}
				}
			},
		}),
	);
}
