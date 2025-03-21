import type { ChatMode, IEnv, IUser, Message, Platform } from "../../types";
import { handleToolCalls } from "../chat/tools";
import type { ConversationManager } from "../conversationManager";
import { Guardrails } from "../guardrails";

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

	const guardrails = Guardrails.getInstance(env);

	return providerStream.pipeThrough(
		new TransformStream({
			async transform(chunk, controller) {
				const text = new TextDecoder().decode(chunk);

				buffer += text;

				const events = buffer.split("\n\n");
				buffer = events.pop() || "";

				for (const event of events) {
					if (!event.trim()) continue;

					if (event.startsWith("data: ")) {
						const dataStr = event.substring(6).trim();

						if (dataStr === "[DONE]") {
							if (!postProcessingDone) {
								await handlePostProcessing();
							}
							continue;
						}

						try {
							const data = JSON.parse(dataStr);

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

							if (data.citations) {
								citationsResponse = data.citations;
							}

							if (data.usage) {
								usageData = data.usage;
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
							console.error("Parse error", parseError);
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

						let toolResults: Message[] = [];
						if (toolCallsData.length > 0 && !isRestricted) {
							const results = await handleToolCalls(
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

							toolResults = results;
						}

						const contentStopEvent = new TextEncoder().encode(
							`data: ${JSON.stringify({
								type: "content_block_stop",
							})}\n\n`,
						);
						controller.enqueue(contentStopEvent);

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

						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
					} catch (error) {
						console.error("Error in stream post-processing:", error);
					}
				}
			},
		}),
	);
}
