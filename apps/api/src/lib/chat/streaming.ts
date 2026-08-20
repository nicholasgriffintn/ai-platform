import { MAX_BUFFER_LENGTH, MAX_CONTENT_LENGTH, MAX_THINKING_LENGTH } from "~/constants/app";
import { resolveStreamingGoalContinuation } from "~/lib/chat/goal-continuation";
import { MEMORY_STORE_TOOL_NAME } from "~/lib/chat/memoryPolicy";
import { appendReasoningPart, appendTextPart, buildMessageParts } from "~/lib/chat/messageParts";
import { buildAssistantMessageData } from "~/lib/chat/mode-metadata";
import { formatAssistantMessage, getAIResponse } from "~/lib/chat/responses";
import { handleToolCalls } from "~/lib/chat/tools";
import { evaluateTurnContinuation } from "~/lib/chat/turn-continuation";
import { getToolEventPayload } from "~/lib/chat/utils";
import { preprocessQwQResponse } from "~/lib/chat/utils/qwq";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ConversationManager } from "~/lib/conversationManager";
import { ResponseFormatter, StreamingFormatter } from "~/lib/formatter";
import { MemoryManager } from "~/lib/memory";
import { trackTokenUsage } from "~/lib/monitoring";
import { Guardrails } from "~/lib/providers/capabilities/guardrails";
import { findModelConfig } from "~/lib/providers/models";
import { isUsageExhausted } from "~/lib/usage/limitState";
import { mergeStreamedTokenUsage, type NormalisedTokenUsage } from "~/lib/usage/tokenUsage";
import { closeComposioConnectorRun } from "~/services/apps/connectors/composio-run";
import {
  type ChatCompletionParameters,
  type ChatMode,
  type IEnv,
  type IUserSettings,
  type Message,
  type MemoryScope,
  type MessagePart,
  type Platform,
  StreamState,
  type ToolCall,
  ToolStage,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { finaliseReadableStream } from "~/utils/finalise-readable-stream";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";
import { hasToolCallNamed, nonEmptyToolCallsOrNull } from "~/utils/toolCalls";

import { emitDoneEvent, emitEvent } from "./emitter";

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

function mergeMessageParts(
  streamedParts: MessagePart[],
  derivedParts?: MessagePart[],
): MessagePart[] | undefined {
  if (streamedParts.length === 0 && (!derivedParts || derivedParts.length === 0)) {
    return undefined;
  }

  const merged: MessagePart[] = [...streamedParts];

  if (!derivedParts || derivedParts.length === 0) {
    return merged;
  }

  let hasTextPart = merged.some((part) => part.type === "text");
  let hasReasoningPart = merged.some((part) => part.type === "reasoning");

  const seenToolUse = new Set(
    merged
      .filter(
        (part): part is Extract<MessagePart, { type: "tool_use" }> => part.type === "tool_use",
      )
      .map((part) => `${part.toolCallId || ""}:${part.name}`),
  );

  for (const part of derivedParts) {
    if (part.type === "text") {
      if (hasTextPart) {
        continue;
      }

      hasTextPart = true;
    }

    if (part.type === "reasoning") {
      if (hasReasoningPart) {
        continue;
      }

      hasReasoningPart = true;
    }

    if (part.type === "tool_use") {
      const key = `${part.toolCallId || ""}:${part.name}`;

      if (seenToolUse.has(key)) {
        continue;
      }

      seenToolUse.add(key);
    }

    merged.push(part);
  }

  return merged;
}

/**
 * Creates a transformed stream that handles post-processing of AI responses
 * With support for tool calls and guardrails
 * @param providerStream - The provider stream
 * @param options - The options
 * @param conversationManager - The conversation manager
 * @returns The transformed stream
 */
export interface StreamPostProcessingOptions {
  env: IEnv;
  completion_id: string;
  model: string;
  provider: string;
  platform?: Platform;
  context?: ServiceContext;
  userSettings?: IUserSettings;
  app_url?: string;
  mode?: ChatMode;
  max_steps?: number;
  current_step?: number;
  tools?: any[];
  enabled_tools?: string[];
  approved_tools?: string[];
  current_agent_id?: string;
  delegation_stack?: string[];
  max_delegation_depth?: number;
  requestOptions?: Record<string, any>;
  continuationRequest?: ChatCompletionParameters;
  memoryScope?: MemoryScope;
  unknownToolRecoveryUsed?: boolean;
}

interface StreamContinuationParams {
  controller: TransformStreamDefaultController;
  conversationManager: ConversationManager;
  options: StreamPostProcessingOptions;
  completionId: string;
  env: IEnv;
  model: string;
  tools: unknown;
  enabledTools: unknown;
  currentStep: number;
  nextOptions: Record<string, unknown>;
  instruction?: string;
}

/**
 * Runs the next streaming turn and pumps it into the current stream. Both
 * reasons a turn continues — pending tool results and an unsatisfied goal —
 * take this path, so the continuation request is built once.
 */
async function continueStreamingTurn(params: StreamContinuationParams): Promise<boolean> {
  try {
    // Each continuation is another model call inside the same request, so the
    // limit is re-checked here rather than only at the request boundary.
    if (await isUsageExhausted(params.conversationManager)) {
      logger.info("Stopping streaming continuation at the usage limit", {
        completion_id: params.completionId,
      });

      return false;
    }

    const history = await params.conversationManager.get(params.completionId);
    const continuationBase = params.options.continuationRequest ?? params.options;
    const messages = params.instruction
      ? [...history, { role: "user" as const, content: params.instruction }]
      : history;
    const nextStream = await getAIResponse({
      ...continuationBase,
      env: params.env,
      completion_id: params.completionId,
      model: params.model,
      provider: params.options.provider,
      messages,
      message: undefined,
      tools: params.tools,
      enabled_tools: params.enabledTools,
      current_step: params.currentStep + 1,
      stream: true,
    } as Parameters<typeof getAIResponse>[0]);
    const nextTransformed = await createStreamWithPostProcessing(
      nextStream as ReadableStream,
      {
        ...params.options,
        ...params.nextOptions,
        current_step: params.currentStep + 1,
        continuationRequest: continuationBase,
      },
      params.conversationManager,
    );
    const reader = nextTransformed.getReader();

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      params.controller.enqueue(value);
    }

    return true;
  } catch (error) {
    logger.error("Streaming continuation failed", {
      completion_id: params.completionId,
      error_message: error instanceof Error ? error.message : "Unknown error",
    });

    return false;
  }
}

export async function createStreamWithPostProcessing(
  providerStream: ReadableStream,
  options: StreamPostProcessingOptions,
  conversationManager: ConversationManager,
): Promise<ReadableStream> {
  const {
    env,
    completion_id,
    model,
    platform = "api",
    context,
    userSettings,
    app_url,
    mode,
    max_steps,
    current_step = 1,
    tools,
    enabled_tools,
    approved_tools,
    memoryScope = { type: "personal" },
    unknownToolRecoveryUsed = false,
  } = options;
  const user = context?.user;

  const fullContentChunks: string[] = [];
  const fullThinkingChunks: string[] = [];
  const bufferChunks: string[] = [];
  let totalContentLength = 0;
  let totalThinkingLength = 0;
  let totalBufferLength = 0;

  let signature = "";
  let citationsResponse = [];
  let toolCallsData: any[] = [];
  let usageData: NormalisedTokenUsage | null = null;
  let structuredData: any = null;
  let postProcessingDone = false;
  let streamFailed = false;
  let currentEventType = "";
  const currentToolCalls: Record<string, any> = {};
  let isFirstContentChunk = true;
  let qwqThinkTagAdded = false;
  let refusalData: string | null = null;
  let annotationsData: any = null;
  const streamedParts: MessagePart[] = [];

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

      while (totalContentLength > MAX_CONTENT_LENGTH * 0.8 && fullContentChunks.length > 1) {
        const removedChunk = fullContentChunks.shift();

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

      while (totalThinkingLength > MAX_THINKING_LENGTH * 0.8 && fullThinkingChunks.length > 1) {
        const removedChunk = fullThinkingChunks.shift();

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

      while (totalBufferLength > MAX_BUFFER_LENGTH * 0.8 && bufferChunks.length > 1) {
        const removedChunk = bufferChunks.shift();

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
  const modelConfig = await findModelConfig(model, env, options.provider, user?.id);

  const finalizePendingToolCalls = () => {
    if (Object.keys(currentToolCalls).length > 0 && toolCallsData.length === 0) {
      toolCallsData = Object.values(currentToolCalls);
    }
  };

  async function handlePostProcessing(controller: TransformStreamDefaultController<Uint8Array>) {
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
        userSettings?.memories_save_enabled || userSettings?.memories_chat_history_enabled;
      const memoryAlreadyStoredByTool = hasToolCallNamed(toolCallsData, MEMORY_STORE_TOOL_NAME);

      if (isProUser && memoriesEnabled && !memoryAlreadyStoredByTool) {
        try {
          const history = await conversationManager.get(completion_id);
          const userHistory = history.filter((m) => m.role === "user");
          const lastUserRaw = userHistory.length ? userHistory[userHistory.length - 1].content : "";
          const lastUserText =
            typeof lastUserRaw === "string"
              ? lastUserRaw
              : Array.isArray(lastUserRaw)
                ? lastUserRaw.find((b: any) => b.type === "text")?.text || ""
                : "";

          if (lastUserText.trim()) {
            const memMgr = MemoryManager.getInstance(env, user, context, memoryScope);
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
          guardrailError = outputValidation.rawResponse || "Content failed validation checks";
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
      const messageData = buildAssistantMessageData({ responseData: structuredData });

      const auditedUsage = trackTokenUsage({
        usage: usageData,
        provider: options.provider,
        model,
        env,
        userId: user?.id,
        completion_id,
        streamed: true,
        expectUsage: true,
      });

      const assistantMessage = formatAssistantMessage({
        content: processedContent,
        thinking: getFullThinking(),
        signature: signature,
        citations: citationsResponse,
        tool_calls: toolCallsData,
        usage: auditedUsage,
        data: messageData,
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

      const derivedParts = buildMessageParts({
        role: "assistant",
        content: assistantMessage.content || processedContent,
        tool_calls: assistantMessage.tool_calls,
        data: assistantMessage.data,
        timestamp: assistantMessage.timestamp,
      });

      const messageParts = mergeMessageParts(streamedParts, derivedParts);

      const contentForStorage =
        typeof assistantMessage.content === "string" || Array.isArray(assistantMessage.content)
          ? assistantMessage.content
          : "";

      await conversationManager.add(completion_id, {
        role: "assistant",
        content: contentForStorage,
        citations: assistantMessage.citations,
        log_id: assistantMessage.log_id,
        mode: assistantMessage.mode,
        id: assistantMessage.id,
        timestamp: assistantMessage.timestamp,
        model: assistantMessage.model,
        platform: assistantMessage.platform,
        usage: assistantMessage.usage,
        tool_calls: nonEmptyToolCallsOrNull(assistantMessage.tool_calls),
        parts: messageParts,
        data: assistantMessage.data || null,
      });

      emitEvent(controller, "message_delta", {
        id: completion_id,
        message_id: assistantMessage.id,
        object: "chat.completion",
        created: assistantMessage.timestamp,
        model: assistantMessage.model,
        provider: options.provider,
        platform: assistantMessage.platform,
        nonce: generateId(),
        post_processing: {
          guardrails: assistantMessage.guardrails,
        },
        log_id: assistantMessage.log_id,
        usage: assistantMessage.usage,
        citations: assistantMessage.citations,
        tool_calls: assistantMessage.tool_calls,
        finish_reason: assistantMessage.finish_reason,
        data: assistantMessage.data,
        parts: messageParts,
      });

      emitEvent(controller, "message_stop", {});

      let toolResults: Message[] = [];

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

        toolResults = await handleToolCalls(
          completion_id,
          { response: fullContent || "", tool_calls: toolCallsData },
          conversationManager,
          {
            env,
            mode: options.mode,
            request: {
              completion_id,
              input: fullContent || "",
              model,
              mode: options.mode,
              date: new Date().toISOString().split("T")[0],
              approved_tools: approved_tools,
              enabled_tools,
              options: options.requestOptions || {},
              current_agent_id: options.current_agent_id,
              delegation_stack: options.delegation_stack,
              max_delegation_depth: options.max_delegation_depth,
            },
            app_url,
            user: user?.id ? user : undefined,
            context,
            memoryScope,
          },
          {
            persistResults: "immediate",
            recoverUnknownToolCalls: !unknownToolRecoveryUsed,
            onToolResult: (toolResult) => {
              emitEvent(controller, "tool_response", {
                tool_id: toolResult.id,
                result: toolResult,
              });
            },
          },
        );

        emitEvent(controller, "tool_response_end", {});
      }

      try {
        const updatedUsageLimits = await conversationManager.getUsageLimits();

        if (updatedUsageLimits) {
          emitEvent(controller, "usage_limits", {
            usage_limits: updatedUsageLimits,
          });
        }
      } catch (error) {
        logger.error("Failed to get updated usage limits:", {
          error_message: error instanceof Error ? error.message : "Unknown error",
        });
      }

      if (toolCallsData.length > 0) {
        const continuation = evaluateTurnContinuation({
          toolCalls: toolCallsData,
          toolResults,
          currentStep: current_step,
          maxSteps: max_steps,
          unknownToolRecoveryUsed,
        });
        const resolvedMaxSteps = continuation.maxSteps;
        const recoveredUnknownTool = continuation.unknownToolRecoveryUsed;

        if (!continuation.shouldContinue) {
          logger.info("Stopping multi-step streaming execution", {
            completion_id,
            current_step,
            reason: continuation.reason,
          });
          emitEvent(controller, "state", {
            state: StreamState.DONE,
          });
          emitDoneEvent(controller);

          return;
        }

        const continued = await continueStreamingTurn({
          controller,
          conversationManager,
          options,
          completionId: completion_id,
          env,
          model,
          tools,
          enabledTools: enabled_tools,
          currentStep: current_step,
          nextOptions: {
            max_steps: resolvedMaxSteps,
            unknownToolRecoveryUsed: unknownToolRecoveryUsed || recoveredUnknownTool,
          },
        });

        if (continued) {
          return;
        }
      }

      if (toolCallsData.length === 0) {
        const goalContinuation = await resolveStreamingGoalContinuation({
          completionId: completion_id,
          context,
          conversationManager,
          summary: fullContent || "",
          producedEvidence: false,
        });

        if (goalContinuation) {
          const continued = await continueStreamingTurn({
            controller,
            conversationManager,
            options,
            completionId: completion_id,
            env,
            model,
            tools,
            enabledTools: enabled_tools,
            currentStep: current_step,
            nextOptions: {},
            instruction: goalContinuation.instruction,
          });

          if (continued) {
            return;
          }
        }
      }

      emitEvent(controller, "state", {
        state: StreamState.DONE,
      });

      emitDoneEvent(controller);
    } catch (error) {
      logger.error("Error in stream post-processing:", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      try {
        emitEvent(controller, "error", {
          error: {
            message: "Failed to finalise the response",
          },
        });
        emitDoneEvent(controller);
      } catch {}
    }
  }

  return finaliseReadableStream({
    stream: providerStream.pipeThrough(
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

            emitEvent(controller, "message_start", {
              id: completion_id,
              created: Date.now(),
              model,
              provider: options.provider,
              platform,
            });
            emitEvent(controller, "state", {
              state: StreamState.THINKING,
            });
          } catch (error) {
            logger.error("Failed in stream start:", {
              error_message: error instanceof Error ? error.message : "Unknown error",
            });
          }
        },
        async transform(chunk, controller) {
          if (streamFailed) {
            return;
          }

          let text: string;

          try {
            text = new TextDecoder().decode(chunk);
          } catch (error) {
            logger.error("Failed to decode chunk:", {
              error_message: error instanceof Error ? error.message : "Unknown error",
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
                if (!streamFailed && !postProcessingDone) {
                  finalizePendingToolCalls();

                  await handlePostProcessing(controller);
                }

                continue;
              }

              try {
                const data = safeParseJson(dataStr);

                if (!data) {
                  throw new AssistantError("Failed to parse data", ErrorType.PARAMS_ERROR);
                }

                logger.trace("Parsed SSE data", { currentEventType, data });

                const streamError =
                  data.error || (data.type === "response.failed" ? data.response?.error : null);

                if (streamError) {
                  streamFailed = true;
                  postProcessingDone = true;
                  emitEvent(controller, "error", {
                    error: streamError,
                  });
                  emitDoneEvent(controller);
                  logger.error("Error in data", { error: streamError });

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
                    userId: context?.user?.id,
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
                    const contentStartsWithThink = contentDelta.trim().startsWith("<think>");

                    if (!contentStartsWithThink) {
                      emitEvent(controller, "content_block_delta", {
                        content: "<think>\n",
                      });
                      addToFullContent("<think>\n");
                      qwqThinkTagAdded = true;
                    }
                  }

                  addToFullContent(contentDelta);
                  appendTextPart(streamedParts, contentDelta, Date.now());
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
                    appendReasoningPart(streamedParts, thinkingData, Date.now());

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

                const toolCallData = StreamingFormatter.extractToolCall(data, currentEventType);

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
                          currentToolCalls[index].function.name = toolCall.function.name;
                        }

                        if (toolCall.function.arguments) {
                          currentToolCalls[index].function.arguments += toolCall.function.arguments;
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
                    if (currentToolCalls[toolCallData.index] && toolCallData.partial_json) {
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
                    if (currentToolCalls[toolCallData.index] && toolCallData.partial_json) {
                      currentToolCalls[toolCallData.index].accumulatedInput +=
                        toolCallData.partial_json;
                    }
                  } else if (toolCallData.format === "direct") {
                    const seenToolCallIds = new Set(
                      toolCallsData.map((toolCall) => toolCall.id).filter(Boolean),
                    );

                    for (const toolCall of toolCallData.toolCalls) {
                      if (toolCall.id && seenToolCallIds.has(toolCall.id)) {
                        continue;
                      }

                      if (toolCall.id) {
                        seenToolCallIds.add(toolCall.id);
                      }

                      toolCallsData.push(toolCall);
                    }
                  }
                }

                if (
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
                }

                const extractedCitations = StreamingFormatter.extractCitations(data);

                if (extractedCitations.length > 0) {
                  citationsResponse = extractedCitations;
                }

                const extractedUsage = StreamingFormatter.extractUsageData(data);

                if (extractedUsage) {
                  usageData = mergeStreamedTokenUsage(usageData, extractedUsage);
                }

                const extractedStructuredData = StreamingFormatter.extractStructuredData(data);

                if (extractedStructuredData) {
                  structuredData = extractedStructuredData;
                }

                const refusalDelta = StreamingFormatter.extractRefusalFromChunk(data);

                if (typeof refusalDelta === "string") {
                  refusalData = refusalDelta;
                }

                const annotationsDelta = StreamingFormatter.extractAnnotationsFromChunk(data);

                if (annotationsDelta !== null && annotationsDelta !== undefined) {
                  annotationsData = annotationsDelta;
                }

                if (StreamingFormatter.isCompletionIndicated(data) && !postProcessingDone) {
                  finalizePendingToolCalls();
                  await handlePostProcessing(controller);
                }
              } catch (parseError) {
                logger.error("Parse error on data", {
                  error: parseError,
                  data: dataStr,
                });
              }
            }
          }
        },
        async flush(controller) {
          if (streamFailed || postProcessingDone) {
            return;
          }

          finalizePendingToolCalls();
          await handlePostProcessing(controller);
        },
      }),
    ),
    cleanup: current_step === 1 && context ? () => closeComposioConnectorRun(context) : undefined,
    onError(error, controller) {
      logger.error("Provider stream failed mid-flight", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
      emitEvent(controller as unknown as TransformStreamDefaultController, "error", {
        error: {
          message: error instanceof Error ? error.message : "Stream failed",
        },
      });
      emitDoneEvent(controller as unknown as TransformStreamDefaultController);
    },
  });
}
