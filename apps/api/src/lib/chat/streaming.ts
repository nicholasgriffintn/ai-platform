import { generateId } from "~/utils/id";
import type {
  ChatMode,
  ContentType,
  IEnv,
  IUser,
  IUserSettings,
  MessageContent,
  Platform,
} from "../../types";
import { getLogger } from "../../utils/logger";
import { handleToolCalls } from "../chat/tools";
import type { ConversationManager } from "../conversationManager";
import { ResponseFormatter, StreamingFormatter } from "../formatter";
import { Guardrails } from "../guardrails";
import { getModelConfigByMatchingModel } from "../models";
import { formatAssistantMessage } from "./responses";
import { getAIResponse } from "./responses";

interface ModelConfigInfo {
  model: string;
  provider: string;
  displayName: string;
}

const logger = getLogger({ prefix: "CHAT_STREAMING" });

/**
 * Helper to emit a standardized SSE event to the stream controller
 */
function emitEvent(
  controller: TransformStreamDefaultController,
  type: string,
  payload: Record<string, any>,
) {
  const event = new TextEncoder().encode(
    `data: ${JSON.stringify({ type, ...payload })}\n\n`,
  );
  controller.enqueue(event);
}

/**
 * Helper to emit standardized tool events
 */
function emitToolEvents(
  controller: TransformStreamDefaultController,
  toolCall: any,
  stage: "start" | "delta" | "stop",
  data?: any,
) {
  const eventType = `tool_use_${stage}`;
  const payload: Record<string, any> = {
    tool_id: toolCall.id,
  };

  if (stage === "start") {
    payload.tool_name = toolCall.function?.name || "";
  } else if (stage === "delta") {
    payload.parameters = data || "{}";
  }

  emitEvent(controller, eventType, payload);
}

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
            emitEvent(controller, "content_block_stop", {});

            const logId = env.AI?.aiGatewayLogId;

            const assistantMessage = formatAssistantMessage({
              content: fullContent,
              thinking: fullThinking,
              signature: signature,
              citations: citationsResponse,
              tool_calls: toolCallsData,
              usage: usageData,
              guardrails: {
                passed: !guardrailsFailed,
                error: guardrailError,
                violations,
              },
              log_id: logId,
              model,
              platform,
              timestamp: Date.now(),
              mode,
              finish_reason: toolCallsData.length > 0 ? "tool_calls" : "stop",
            });

            await conversationManager.add(completion_id, {
              role: "assistant",
              content:
                assistantMessage.thinking || assistantMessage.signature
                  ? ([
                      assistantMessage.thinking
                        ? {
                            type: "thinking" as ContentType,
                            thinking: assistantMessage.thinking,
                            signature: assistantMessage.signature || "",
                          }
                        : null,
                      {
                        type: "text" as ContentType,
                        text: assistantMessage.content,
                      },
                    ].filter(Boolean) as MessageContent[])
                  : assistantMessage.content,
              citations: assistantMessage.citations,
              log_id: assistantMessage.log_id,
              mode: assistantMessage.mode as ChatMode,
              id: assistantMessage.id,
              timestamp: assistantMessage.timestamp,
              model: assistantMessage.model,
              platform: assistantMessage.platform,
              usage: assistantMessage.usage,
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

            if (toolCallsData.length > 0 && !isRestricted) {
              // Emit tool use events for each tool call
              for (const toolCall of toolCallsData) {
                emitToolEvents(controller, toolCall, "start");
                emitToolEvents(
                  controller,
                  toolCall,
                  "delta",
                  toolCall.function?.arguments || "{}",
                );
                emitToolEvents(controller, toolCall, "stop");
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
                  },
                  app_url,
                  user: user?.id ? user : undefined,
                },
                isRestricted ?? false,
              );

              for (const toolResult of toolResults) {
                emitEvent(controller, "tool_response", {
                  tool_id: toolResult.id,
                  result: toolResult,
                });
              }

              emitEvent(controller, "tool_response_end", {});
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

/**
 * Creates a multi-model stream that queries multiple models and combines their responses
 */
export function createMultiModelStream(
  parameters: any,
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
): ReadableStream {
  const { models, ...baseParams } = parameters;
  const primaryModel = models[0];

  const primaryParams = {
    ...baseParams,
    model: primaryModel.model,
    stream: true,
  };

  const primaryResponsePromise = getAIResponse(primaryParams);

  const secondaryPromises =
    models.length > 1
      ? models.slice(1).map(async (modelConfig: ModelConfigInfo) => {
          const secondaryParams = {
            ...baseParams,
            model: modelConfig.model,
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
            logger.error(
              `Error getting response from secondary model ${modelConfig.model}`,
              { error },
            );
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
        const primaryResponse = await primaryResponsePromise;
        if (!(primaryResponse instanceof ReadableStream)) {
          throw new Error("Primary model response is not a stream");
        }

        const primaryProcessedStream = await createStreamWithPostProcessing(
          primaryResponse,
          { ...options, model: primaryModel.model },
          conversationManager,
        );

        const primaryReader = primaryProcessedStream.getReader();

        const modelNames = models
          .map((m: ModelConfigInfo) => m.displayName)
          .join(", ");
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
                const data = JSON.parse(dataStr);
                if (data.type === "content_block_delta" && data.content) {
                  primaryContent += data.content;
                } else if (data.type === "text" && data.text) {
                  primaryContent += data.text;
                }
              }
            }
          } catch (e) {
            /* ignore parse errors during capture */
          }

          controller.enqueue(value);
        }
      } catch (error) {
        logger.error(
          "Error processing primary stream in multi-model setup:",
          error,
        );
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
                  const data = JSON.parse(dataStr);
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
            } catch (e) {
              controller.enqueue(value);
            }
          }
          secondaryIndex++;
        }
      } catch (error) {
        logger.error("Error processing secondary streams:", error);
      }

      try {
        const conversation = await conversationManager.get(
          options.completion_id,
        );
        if (conversation?.length > 0) {
          const assistantMessages = conversation.filter(
            (msg) => msg.role === "assistant",
          );
          if (assistantMessages.length > 0) {
            const lastMessage = assistantMessages[assistantMessages.length - 1];
            let storedPrimaryContent = "";
            if (typeof lastMessage.content === "string") {
              storedPrimaryContent = lastMessage.content;
            } else if (Array.isArray(lastMessage.content)) {
              const textBlock = lastMessage.content.find(
                (block) => block.type === "text",
              );
              storedPrimaryContent = textBlock?.text || "";
            }

            const finalCombinedContent =
              modelHeader + storedPrimaryContent + secondaryContent;

            await conversationManager.update(options.completion_id, [
              {
                ...lastMessage,
                content: finalCombinedContent,
                data: {
                  ...lastMessage.data,
                  includesSecondaryModels: true,
                  secondaryModels:
                    models.slice(1).map((m: ModelConfigInfo) => m.model) || [],
                },
              },
            ]);
          } else {
            const finalCombinedContentForAdd =
              modelHeader + primaryContent + secondaryContent;
            await conversationManager.add(options.completion_id, {
              role: "assistant",
              content: finalCombinedContentForAdd,
              citations: [],
              log_id: null,
              mode: options.mode,
              id: generateId(),
              timestamp: Date.now(),
              model: primaryModel.model,
              platform: options.platform || "api",
              usage: null,
              data: {
                includesSecondaryModels: true,
                secondaryModels:
                  models.slice(1).map((m: ModelConfigInfo) => m.model) || [],
              },
            });
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        logger.error("Error during finalization/storage:", error);
        controller.error(error);
      }
    },
    cancel(reason) {
      logger.warn("Multi-model stream cancelled:", reason);
    },
  });
}
