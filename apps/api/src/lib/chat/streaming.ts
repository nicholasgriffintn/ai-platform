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
import { getAIResponse } from "./responses";

interface ModelConfigInfo {
  model: string;
  provider: string;
  displayName: string;
}

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

/**
 * Creates a multi-model stream that queries multiple models and combines their responses
 */
export async function createMultiModelStream(
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
): Promise<ReadableStream> {
  const { models, ...baseParams } = parameters;
  const primaryModel = models[0];

  const primaryParams = {
    ...baseParams,
    model: primaryModel.model,
    stream: true,
  };

  const primaryResponse = await getAIResponse(primaryParams);

  if (!(primaryResponse instanceof ReadableStream)) {
    throw new Error("Primary model response is not a stream");
  }

  let secondaryModelResponses: ReadableStream[] = [];

  if (models.length > 1) {
    const secondaryModels = models.slice(1);

    const secondaryPromises = secondaryModels.map(
      async (modelConfig: ModelConfigInfo) => {
        const secondaryParams = {
          ...baseParams,
          model: modelConfig.model,
          stream: false,
        };

        try {
          return {
            model: modelConfig,
            response: await getAIResponse(secondaryParams),
          };
        } catch (error) {
          logger.error(
            `Error getting response from secondary model ${modelConfig.model}`,
            { error },
          );
          return null;
        }
      },
    );

    const results = await Promise.all(secondaryPromises);
    const validResults = results.filter((result) => result !== null);

    secondaryModelResponses = validResults
      .map((result) => {
        if (!result) return null;

        const { model, response } = result;
        if (response instanceof ReadableStream) {
          return response;
        }

        const encoder = new TextEncoder();
        const responseText = response.response || "";
        const modelName = model.displayName;

        // Process the response to extract unique insights
        const processedResponse = extractAdditionalInsights(
          responseText,
          parameters.primaryContent || "", // We'll need to capture the primary content as it streams
          modelName,
        );

        return new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "content_block_delta",
                  content: processedResponse,
                  modelName: modelName,
                })}\n\n`,
              ),
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
      })
      .filter(Boolean) as ReadableStream[];
  }

  let primaryContent = "";

  const contentCaptureStream = new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);

      try {
        const matches = text.match(/data: (.*?)\n\n/g);
        if (matches) {
          for (const match of matches) {
            const dataStr = match.substring(6, match.length - 2);
            if (dataStr === "[DONE]") continue;

            const data = JSON.parse(dataStr);
            if (data.type === "content_block_delta" && data.content) {
              primaryContent += data.content;
            }
          }
        }
      } catch (e) {
        // Just pass through if we can't parse
      }

      controller.enqueue(chunk);
    },
  });

  const capturedStream = primaryResponse.pipeThrough(contentCaptureStream);

  const primaryTransformedStream = await createStreamWithPostProcessing(
    capturedStream,
    options,
    conversationManager,
  );

  if (secondaryModelResponses.length === 0) {
    return primaryTransformedStream;
  }

  return createCombinedStream(
    primaryTransformedStream,
    secondaryModelResponses,
    primaryContent,
  );
}

/**
 * Processes a secondary model response to extract additional insights
 * that aren't present in the primary response
 */
function extractAdditionalInsights(
  secondaryResponse: string,
  primaryResponse: string,
  modelName: string,
): string {
  let formattedResponse = `\n\n***\n### ${modelName} additions\n\n\n\n`;

  const primaryParagraphs = primaryResponse.split(/\n+/);
  const secondaryParagraphs = secondaryResponse.split(/\n+/);

  const uniqueParagraphs = secondaryParagraphs.filter((secondary) => {
    if (secondary.length < 20) return false;

    return !primaryParagraphs.some((primary) => {
      const similarity = calculateSimpleSimilarity(primary, secondary);
      return similarity > 0.6;
    });
  });

  if (uniqueParagraphs.length > 0) {
    formattedResponse += uniqueParagraphs.join("\n\n");
  } else {
    formattedResponse +=
      "This model provided a similar response to the primary model.";
  }

  return formattedResponse;
}

/**
 * Calculate a simple word-based similarity between two texts
 * Returns a value between 0 (completely different) and 1 (identical)
 */
function calculateSimpleSimilarity(text1: string, text2: string): number {
  const words1 = new Set(
    text1
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3),
  );
  const words2 = new Set(
    text2
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3),
  );

  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      overlap++;
    }
  }

  const union = words1.size + words2.size - overlap;
  return union === 0 ? 0 : overlap / union;
}

/**
 * Combines multiple streams into one, appending secondary streams after the primary
 */
function createCombinedStream(
  primaryStream: ReadableStream,
  secondaryStreams: ReadableStream[],
  primaryContent = "",
): ReadableStream {
  let primaryStreamDone = false;
  let currentSecondaryStreamIndex = 0;

  return new ReadableStream({
    async start(controller) {
      const primaryReader = primaryStream.getReader();

      try {
        // First process the primary stream
        while (true) {
          const { done, value } = await primaryReader.read();

          if (done) {
            primaryStreamDone = true;
            break;
          }

          const text = new TextDecoder().decode(value);
          if (!text.includes("data: [DONE]")) {
            controller.enqueue(value);
          }
        }

        // Update the secondary streams with the final primary content
        // This helps them make better comparisons
        for (const secondaryStream of secondaryStreams) {
          const secondaryReader = secondaryStream.getReader();

          while (true) {
            const { done, value } = await secondaryReader.read();

            if (done) {
              break;
            }

            // Before sending the secondary content, try to update it with
            // the primary content, if we can parse it
            const text = new TextDecoder().decode(value);
            try {
              const matches = text.match(/data: (.*?)\n\n/g);
              if (matches) {
                for (const match of matches) {
                  const dataStr = match.substring(6, match.length - 2);
                  if (dataStr === "[DONE]") continue;

                  const data = JSON.parse(dataStr);
                  if (data.type === "content_block_delta" && data.content) {
                    if (primaryContent) {
                      data.content = extractAdditionalInsights(
                        data.content.replace(
                          /\n\n\*\*\*\n### .* additions\n\n\n\n/,
                          "",
                        ),
                        primaryContent,
                        data.modelName,
                      );

                      const encoder = new TextEncoder();
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
                      );
                    }
                  }
                }
              }
            } catch (e) {
              // If we can't parse, just send the original
            }

            controller.enqueue(value);
          }

          currentSecondaryStreamIndex++;
        }

        // Send the final DONE message
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        logger.error("Error in combined stream", { error });
        controller.error(error);
      }
    },

    cancel() {},
  });
}
