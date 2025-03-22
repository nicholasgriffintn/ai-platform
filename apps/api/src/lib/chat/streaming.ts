import type { ChatMode, IEnv, IUser, Platform } from "../../types";
import { handleToolCalls } from "../chat/tools";
import type { ConversationManager } from "../conversationManager";
import { Guardrails } from "../guardrails";

interface AnthropicToolState {
	id: string;
	name: string;
	accumulatedInput: string;
	isComplete: boolean;
}

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
	// Special handling just for Anthropic - because they have to be difficult for some reason and stream the input independently of the tool_use event.
	const currentAnthropicTools: Record<string, AnthropicToolState> = {};

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
								return;
							}

							if (
								data.choices &&
								data.choices[0]?.finish_reason === "stop" &&
								!postProcessingDone
							) {
								if (data.choices[0]?.delta?.content) {
									fullContent += data.choices[0].delta.content;

									const contentDeltaEvent = new TextEncoder().encode(
										`data: ${JSON.stringify({
											type: "content_block_delta",
											content: data.choices[0].delta.content,
										})}\n\n`,
									);
									controller.enqueue(contentDeltaEvent);
								} else if (data.choices[0]?.message?.content && !fullContent) {
									fullContent = data.choices[0].message.content;

									const contentDeltaEvent = new TextEncoder().encode(
										`data: ${JSON.stringify({
											type: "content_block_delta",
											content: fullContent,
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
								fullContent += data.response;

								const contentDeltaEvent = new TextEncoder().encode(
									`data: ${JSON.stringify({
										type: "content_block_delta",
										content: data.response,
									})}\n\n`,
								);
								controller.enqueue(contentDeltaEvent);
							} else if (
								data.choices &&
								data.choices.length > 0 &&
								data.choices[0].delta &&
								data.choices[0].delta.content
							) {
								fullContent += data.choices[0].delta.content;

								const contentDeltaEvent = new TextEncoder().encode(
									`data: ${JSON.stringify({
										type: "content_block_delta",
										content: data.choices[0].delta.content,
									})}\n\n`,
								);
								controller.enqueue(contentDeltaEvent);
							}

							if (
								data.type === "content_block_delta" &&
								data.delta &&
								data.delta.type === "text_delta"
							) {
								fullContent += data.delta.text;

								const contentDeltaEvent = new TextEncoder().encode(
									`data: ${JSON.stringify({
										type: "content_block_delta",
										content: data.delta.text,
									})}\n\n`,
								);
								controller.enqueue(contentDeltaEvent);
							} else if (
								currentEventType === "content_block_delta" &&
								data.delta &&
								data.delta.type === "text_delta"
							) {
								fullContent += data.delta.text;

								const contentDeltaEvent = new TextEncoder().encode(
									`data: ${JSON.stringify({
										type: "content_block_delta",
										content: data.delta.text,
									})}\n\n`,
								);
								controller.enqueue(contentDeltaEvent);
							} else if (
								data.content &&
								currentEventType === "content_block_delta"
							) {
								fullContent += data.content;
							}

							if (!fullContent && data.content) {
								fullContent += data.content;
							}

							if (
								data.message?.content &&
								Array.isArray(data.message.content)
							) {
								for (const block of data.message.content) {
									if (block.type === "text" && block.text) {
										fullContent += block.text;
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
								// Special handling for Anthropic - because they're special.
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
									currentAnthropicTools[data.index] = {
										id: data.content_block.id,
										name: data.content_block.name,
										accumulatedInput: "",
										isComplete: false,
									};
								}

								if (
									currentEventType === "content_block_stop" &&
									data.index !== undefined &&
									currentAnthropicTools[data.index] &&
									!currentAnthropicTools[data.index].isComplete
								) {
									currentAnthropicTools[data.index].isComplete = true;

									const toolState = currentAnthropicTools[data.index];
									let parsedInput = {};
									try {
										if (toolState.accumulatedInput) {
											parsedInput = JSON.parse(toolState.accumulatedInput);
										}
									} catch (e) {
										console.error("Failed to parse tool input:", e);
									}

									const toolCall = {
										id: toolState.id,
										function: {
											name: toolState.name,
											arguments: JSON.stringify(parsedInput),
										},
									};

									const toolStartEvent = new TextEncoder().encode(
										`data: ${JSON.stringify({
											type: "tool_use_start",
											tool_id: toolCall.id,
											tool_name: toolCall.function.name,
										})}\n\n`,
									);
									controller.enqueue(toolStartEvent);

									const toolDeltaEvent = new TextEncoder().encode(
										`data: ${JSON.stringify({
											type: "tool_use_delta",
											tool_id: toolCall.id,
											parameters: toolCall.function.arguments,
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
								currentAnthropicTools[data.index] &&
								!isRestricted
							) {
								if (data.delta.partial_json) {
									currentAnthropicTools[data.index].accumulatedInput +=
										data.delta.partial_json;
								}
							}

							let toolCalls = null;
							if (data.tool_calls && !isRestricted) {
								toolCalls = data.tool_calls;
							} else if (
								data.choices &&
								data.choices.length > 0 &&
								data.choices[0].delta &&
								data.choices[0].delta.tool_calls &&
								!isRestricted
							) {
								toolCalls = data.choices[0].delta.tool_calls;
							}

							if (toolCalls) {
								for (const toolCall of toolCalls) {
									const toolStartEvent = new TextEncoder().encode(
										`data: ${JSON.stringify({
											type: "tool_use_start",
											tool_id: toolCall.id,
											tool_name: toolCall.function?.name || toolCall.name,
										})}\n\n`,
									);
									controller.enqueue(toolStartEvent);

									const toolDeltaEvent = new TextEncoder().encode(
										`data: ${JSON.stringify({
											type: "tool_use_delta",
											tool_id: toolCall.id,
											parameters:
												toolCall.function?.arguments || toolCall.parameters,
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

								toolCallsData = [...toolCallsData, ...toolCalls];
							}
						} catch (parseError) {
							console.error("Parse error", parseError, "on data:", dataStr);
						}
					}
				}

				async function handlePostProcessing() {
					try {
						postProcessingDone = true;

						let guardrailsFailed = false;
						let guardrailError = "";
						let violations: any[] = [];

						if (fullContent) {
							const outputValidation =
								await guardrails.validateOutput(fullContent);

							if (!outputValidation.isValid) {
								guardrailsFailed = true;
								guardrailError =
									outputValidation.rawResponse?.blockedResponse ||
									"Response did not pass safety checks";
								violations = outputValidation.violations || [];
							}
						}

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
							const toolResults = await handleToolCalls(
								completion_id,
								{ response: fullContent, tool_calls: toolCallsData },
								conversationManager,
								{
									env,
									request: {
										completion_id,
										input: fullContent,
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
						}

						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
					} catch (error) {
						console.error("Error in stream post-processing:", error);
					}
				}
			},
		}),
	);
}
