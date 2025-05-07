import { formatAssistantMessage } from "~/lib/chat/responses";
import { getAIResponse } from "~/lib/chat/responses";
import { handleToolCalls } from "~/lib/chat/tools";
import type { ConversationManager } from "~/lib/conversationManager";
import { ResponseFormatter, StreamingFormatter } from "~/lib/formatter";
import { Guardrails } from "~/lib/guardrails";
import { MemoryManager } from "~/lib/memory";
import { getModelConfigByMatchingModel } from "~/lib/models";
import type {
  ChatMode,
  ContentType,
  IEnv,
  IUser,
  IUserSettings,
  MessageContent,
  Platform,
} from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

interface ModelConfigInfo {
  model: string;
  provider: string;
  displayName: string;
}

const logger = getLogger({ prefix: "CHAT_STREAMING" });

/**
 * Helper to emit a standardized SSE event to the stream controller
 * @param controller - The stream controller
 * @param type - The type of event
 * @param payload - The payload of the event
 * @returns The event
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
 * @param controller - The stream controller
 * @param toolCall - The tool call
 * @param stage - The stage of the tool call
 * @param data - The data of the tool call
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
    platform?: Platform;
    user?: IUser;
    userSettings?: IUserSettings;
    app_url?: string;
    mode?: ChatMode;
    max_steps?: number;
    current_step?: number;
  },
  conversationManager: ConversationManager,
): Promise<ReadableStream> {
  logger.debug("Starting stream post-processing", {
    completion_id: options.completion_id,
    model: options.model,
    platform: options.platform,
    userId: options.user?.id,
    mode: options.mode,
  });

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
      async start(controller) {
        try {
          emitEvent(controller, "state", { state: "init" });
          const usageLimits = await conversationManager.getUsageLimits();
          if (usageLimits) {
            emitEvent(controller, "usage_limits", {
              usage_limits: usageLimits,
            });
          }
          emitEvent(controller, "state", { state: "thinking" });
        } catch (error) {
          logger.error("Failed in stream start:", error);
        }
      },
      async transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        logger.trace("Incoming chunk", {
          chunkSize: chunk.byteLength,
          bufferBefore: buffer.length,
        });

        if (buffer.length > 100000) {
          logger.warn("Buffer size exceeded limit, truncating", {
            completion_id,
            bufferSize: buffer.length,
          });
          buffer = buffer.substring(buffer.length - 50000);
        }

        buffer += text;

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

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
              const data = JSON.parse(dataStr);
              logger.trace("Parsed SSE data", { currentEventType, data });

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

              const formattedData = await ResponseFormatter.formatResponse(
                data,
                platform,
                {
                  model,
                  type: modelConfig?.type,
                  env,
                },
              );

              if (
                StreamingFormatter.isCompletionIndicated(data) &&
                !postProcessingDone
              ) {
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

                const extractedUsage =
                  StreamingFormatter.extractUsageData(data);
                if (extractedUsage) {
                  usageData = extractedUsage;
                }

                const extractedCitations =
                  StreamingFormatter.extractCitations(data);
                if (extractedCitations.length > 0) {
                  citationsResponse = extractedCitations;
                }

                await handlePostProcessing();
                continue;
              }

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

              const toolCallData = StreamingFormatter.extractToolCall(
                data,
                currentEventType,
              );
              if (toolCallData) {
                logger.debug("Detected tool call delta", { toolCallData });
              }

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
                } else if (toolCallData.format === "direct") {
                  toolCallsData = [...toolCallsData, ...toolCallData.toolCalls];
                }
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
                const forwardEvent = new TextEncoder().encode(
                  `data: ${JSON.stringify({
                    type: currentEventType,
                    ...data,
                  })}\n\n`,
                );
                controller.enqueue(forwardEvent);

                if (
                  currentEventType === "content_block_stop" &&
                  data.index !== undefined &&
                  Object.prototype.hasOwnProperty.call(
                    currentToolCalls,
                    data.index,
                  ) &&
                  currentToolCalls[data.index] &&
                  !currentToolCalls[data.index].isComplete
                ) {
                  currentToolCalls[data.index].isComplete = true;

                  const toolState = currentToolCalls[data.index];
                  let parsedInput = {};
                  try {
                    if (toolState.accumulatedInput) {
                      parsedInput = JSON.parse(toolState.accumulatedInput);

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
              logger.debug("Post-processing already done, skipping", {
                completion_id,
              });
              return;
            }

            emitEvent(controller, "state", { state: "post_processing" });
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

            if (fullContent) {
              const outputValidation = await guardrails.validateOutput(
                fullContent,
                user?.id,
                completion_id,
              );

              if (!outputValidation.isValid) {
                guardrailsFailed = true;
                guardrailError =
                  outputValidation.rawResponse ||
                  "Content failed validation checks";
                guardrailViolations = outputValidation.violations || [];

                logger.warn("Guardrails failed", {
                  outputValidation,
                  violations: guardrailViolations,
                });
              } else {
                logger.debug("Guardrails passed", { completion_id });
              }
            }

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
                violations: guardrailViolations,
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
              tool_calls: assistantMessage.tool_calls,
            });

            logger.debug("Stored assistant message", {
              completion_id,
              messageId: assistantMessage.id,
              finish_reason: assistantMessage.finish_reason,
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
              logger.error("Failed to get updated usage limits:", error);
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

              if (!hasToolErrors) {
                try {
                  const nextStream = await getAIResponse({
                    ...options,
                    messages: history,
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
                } catch (error) {
                  logger.error("Error in next stream:", error);
                }
              } else {
                logger.info(
                  "Tool errors detected, stopping multi-step execution",
                  {
                    completion_id,
                    current_step,
                  },
                );
              }
            }

            emitEvent(controller, "state", { state: "done" });

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
    platform?: Platform;
    user?: IUser;
    userSettings?: IUserSettings;
    app_url?: string;
    mode?: ChatMode;
  },
  conversationManager: ConversationManager,
): ReadableStream {
  logger.debug("Starting multi-model stream", {
    completion_id: options.completion_id,
    models: parameters.models.map((m: ModelConfigInfo) => m.model),
  });
  const { models, ...baseParams } = parameters;
  logger.debug("Primary model request", { model: models[0].model });
  const primaryParams = {
    ...baseParams,
    model: models[0].model,
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
        logger.error(
          "Failed to get usage limits for multi-model streaming:",
          error,
        );
      }

      try {
        const primaryResponse = await primaryResponsePromise;
        if (!(primaryResponse instanceof ReadableStream)) {
          throw new Error("Primary model response is not a stream");
        }

        const primaryProcessedStream = await createStreamWithPostProcessing(
          primaryResponse,
          { ...options, model: models[0].model },
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
              model: models[0].model,
              platform: options.platform || "api",
              usage: null,
              data: {
                includesSecondaryModels: true,
                secondaryModels:
                  models.slice(1).map((m: ModelConfigInfo) => m.model) || [],
              },
              tool_calls: null,
            });
          }
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
          logger.error(
            "Failed to get updated usage limits for multi-model streaming:",
            error,
          );
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        logger.error("Error during finalization/storage:", error);
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
