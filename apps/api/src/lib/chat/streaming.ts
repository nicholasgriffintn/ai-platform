import type {
  ChatMode,
  IEnv,
  IUser,
  IUserSettings,
  Platform,
} from "../../types";
import { getLogger } from "../../utils/logger";
import { handleToolCalls } from "../chat/tools";
import type { ConversationManager } from "../conversationManager";
import { ResponseFormatter, StreamingFormatter } from "../formatter";
import { Guardrails } from "../guardrails";
import { getModelConfigByMatchingModel } from "../models";

const logger = getLogger({ prefix: "CHAT_STREAMING" });

/**
 * Creates a transformed stream that handles post-processing of AI responses
 * With support for tool calls and guardrails
 */
export async function createStreamWithPostProcessing(
  providerStream: ReadableStream,
  options: {
    env: IEnv;
    completion_id: string;
    model: string;
    platform?: Platform;
    user?: IUser;
    userSettings?: IUserSettings;
    app_url?: string;
    mode?: ChatMode;
    isRestricted?: boolean;
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
    isRestricted,
  } = options;

  let fullContent = "";
  let fullThinking = "";
  let signature = "";
  let citationsResponse = [];
  let toolCallsData: any[] = [];
  let usageData: any = null;
  let postProcessingDone = false;
  let buffer = "";
  let currentEventType = "";
  const currentToolCalls: Record<string, any> = {};

  const guardrails = Guardrails.getInstance(env, user, userSettings);
  const modelConfig = getModelConfigByMatchingModel(model);

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

              // Use ResponseFormatter to standardize the response format
              const formattedData = ResponseFormatter.formatResponse(
                data,
                platform,
                {
                  model,
                  type: modelConfig?.type,
                },
              );

              // Check if this chunk indicates completion
              if (
                StreamingFormatter.isCompletionIndicated(data) &&
                !postProcessingDone
              ) {
                // Extract content if present
                const contentDelta = StreamingFormatter.extractContentFromChunk(
                  data,
                  currentEventType,
                );
                if (contentDelta) {
                  fullContent += contentDelta;

                  const contentDeltaEvent = new TextEncoder().encode(
                    `data: ${JSON.stringify({
                      type: "content_block_delta",
                      content: contentDelta,
                    })}\n\n`,
                  );
                  controller.enqueue(contentDeltaEvent);
                }

                // Extract usage data
                const extractedUsage =
                  StreamingFormatter.extractUsageData(data);
                if (extractedUsage) {
                  usageData = extractedUsage;
                }

                // Extract citations
                const extractedCitations =
                  StreamingFormatter.extractCitations(data);
                if (extractedCitations.length > 0) {
                  citationsResponse = extractedCitations;
                }

                await handlePostProcessing();
                continue;
              }

              let contentDelta = "";

              // For Perplexity and OpenAI-like streaming, use the delta directly
              if (data.choices?.[0]?.delta?.content !== undefined) {
                contentDelta = data.choices[0].delta.content;
              } else {
                contentDelta = StreamingFormatter.extractContentFromChunk(
                  formattedData,
                  currentEventType,
                );
              }

              if (contentDelta) {
                fullContent += contentDelta;

                const contentDeltaEvent = new TextEncoder().encode(
                  `data: ${JSON.stringify({
                    type: "content_block_delta",
                    content: contentDelta,
                  })}\n\n`,
                );
                controller.enqueue(contentDeltaEvent);
              }

              const thinkingData = StreamingFormatter.extractThinkingFromChunk(
                data,
                currentEventType,
              );

              if (thinkingData) {
                if (typeof thinkingData === "string") {
                  fullThinking += thinkingData;

                  const thinkingDeltaEvent = new TextEncoder().encode(
                    `data: ${JSON.stringify({
                      type: "thinking_delta",
                      thinking: thinkingData,
                    })}\n\n`,
                  );
                  controller.enqueue(thinkingDeltaEvent);
                } else if (thinkingData.type === "signature") {
                  signature = thinkingData.signature;

                  const signatureDeltaEvent = new TextEncoder().encode(
                    `data: ${JSON.stringify({
                      type: "signature_delta",
                      signature: thinkingData.signature,
                    })}\n\n`,
                  );
                  controller.enqueue(signatureDeltaEvent);
                }
              }

              // Process tool calls
              const toolCallData = StreamingFormatter.extractToolCall(
                data,
                currentEventType,
              );
              if (toolCallData && !isRestricted) {
                if (toolCallData.format === "openai") {
                  const deltaToolCalls = toolCallData.toolCalls;

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
                } else if (toolCallData.format === "direct") {
                  toolCallsData = [...toolCallsData, ...toolCallData.toolCalls];
                }
              }

              // Handle Anthropic-specific event types
              if (
                [
                  "message_start",
                  "message_delta",
                  "message_stop",
                  "content_block_start",
                  "content_block_stop",
                ].includes(currentEventType)
              ) {
                // Forward the event
                const forwardEvent = new TextEncoder().encode(
                  `data: ${JSON.stringify({
                    type: currentEventType,
                    ...data,
                  })}\n\n`,
                );
                controller.enqueue(forwardEvent);

                // Handle content block stop for tool calls
                if (
                  currentEventType === "content_block_stop" &&
                  data.index !== undefined &&
                  currentToolCalls[data.index] &&
                  !currentToolCalls[data.index].isComplete &&
                  !isRestricted
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

                // Handle message stop event
                if (
                  currentEventType === "message_stop" &&
                  !postProcessingDone
                ) {
                  await handlePostProcessing();
                }
              }

              // Extract citations and usage data
              const extractedCitations =
                StreamingFormatter.extractCitations(data);
              if (extractedCitations.length > 0) {
                citationsResponse = extractedCitations;
              }

              const extractedUsage = StreamingFormatter.extractUsageData(data);
              if (extractedUsage) {
                usageData = extractedUsage;
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
              const outputValidation = await guardrails.validateOutput(
                fullContent,
                user?.id,
                completion_id,
              );

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

            // Create the assistant message content with possible thinking
            let messageContent: string | Array<any> = fullContent;

            // If we have thinking or signature, use structured content
            if (fullThinking || signature) {
              const contentBlocks = [];

              if (fullThinking) {
                contentBlocks.push({
                  type: "thinking",
                  thinking: fullThinking,
                  signature: signature || "",
                });
              }

              if (fullContent) {
                contentBlocks.push({
                  type: "text",
                  text: fullContent,
                });
              }

              messageContent = contentBlocks;
            }

            await conversationManager.add(completion_id, {
              role: "assistant",
              content: messageContent,
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
