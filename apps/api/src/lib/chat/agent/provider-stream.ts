import {
  MAX_CONTENT_LENGTH,
  MAX_PROVIDER_STREAM_EVENT_LENGTH,
  MAX_THINKING_LENGTH,
} from "~/constants/app";
import {
  buildAnthropicSearchGrounding,
  buildAnthropicHostedToolResultPart,
  buildAnthropicHostedToolUsePart,
  mergeAnthropicSearchGrounding,
  readAnthropicHostedToolStart,
  type AnthropicHostedToolState,
} from "~/lib/chat/messages/anthropic-response-parts";
import { GoogleCodeExecutionCollector } from "~/lib/chat/messages/google-response-parts";
import {
  buildOpenAIHostedToolParts,
  extractOpenAIReasoningSummary,
} from "~/lib/chat/messages/openai-response-parts";
import { appendReasoningPart, appendTextPart, buildMessageParts } from "~/lib/chat/messages/parts";
import { modelEmitsUnterminatedThinking } from "~/lib/chat/messages/unterminated-thinking";
import type { ChatEventSink } from "~/lib/chat/streaming/emitter";
import { SseLineBuffer } from "~/lib/chat/streaming/sse-line-buffer";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { ResponseFormatter, StreamingFormatter } from "~/lib/formatter";
import { findModelConfig } from "~/lib/providers/models";
import {
  hasTokenUsageChanged,
  mergeStreamedTokenUsage,
  type NormalisedTokenUsage,
} from "~/lib/usage/tokenUsage";
import type { IEnv, MessagePart, ToolCall } from "~/types";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";
import { isRecord } from "~/utils/objects";

const logger = getLogger({ prefix: "lib/chat/agent/provider-stream" });

export interface ProviderStreamContext {
  env: IEnv;
  model: string;
  provider: string;
  completionId: string;
  userId?: number;
  serviceContext?: ServiceContext;
  shouldStop?: () => boolean;
}

export interface StreamedTurn {
  content: string;
  thinking: string;
  signature: string;
  toolCalls: ToolCall[];
  citations: unknown[];
  usage: NormalisedTokenUsage | null;
  structuredData: unknown;
  refusal: string | null;
  annotations: unknown;
  parts: MessagePart[];
  error: unknown;
  interrupted?: boolean;
  stopped?: boolean;
}

class BoundedText {
  private chunks: string[] = [];
  private length = 0;

  constructor(
    private readonly maxLength: number,
    private readonly label: string,
    private readonly completionId: string,
  ) {}

  add(chunk: string) {
    this.chunks.push(chunk);
    this.length += chunk.length;

    if (this.length <= this.maxLength) {
      return;
    }

    logger.warn(`${this.label} size exceeded limit, trimming older content`, {
      completion_id: this.completionId,
      totalLength: this.length,
      maxLength: this.maxLength,
    });

    while (this.length > this.maxLength * 0.8 && this.chunks.length > 1) {
      this.length -= this.chunks.shift().length;
    }
  }

  replace(value: string) {
    this.chunks = [];
    this.length = 0;

    if (value) {
      this.add(value);
    }
  }

  toString(): string {
    return this.chunks.join("");
  }
}

export async function consumeProviderStream(
  providerStream: ReadableStream,
  sink: ChatEventSink,
  context: ProviderStreamContext,
): Promise<StreamedTurn> {
  const { env, model, provider, completionId } = context;
  const modelConfig = await findModelConfig(model, env, provider, context.userId);
  const content = new BoundedText(MAX_CONTENT_LENGTH, "Content", completionId);
  const thinking = new BoundedText(MAX_THINKING_LENGTH, "Thinking", completionId);
  const buffer = new SseLineBuffer(MAX_PROVIDER_STREAM_EVENT_LENGTH);

  const turn: StreamedTurn = {
    content: "",
    thinking: "",
    signature: "",
    toolCalls: [],
    citations: [],
    usage: null,
    structuredData: null,
    refusal: null,
    annotations: null,
    parts: [],
    error: null,
  };

  const partialToolCalls: Record<string, any> = {};
  let currentEventType = "";
  let isFirstContentChunk = true;
  let openedThinkTag = false;
  let completed = false;
  const handledReasoningItems = new Set<string>();
  const completedHostedToolItems = new Set<string>();
  const pendingHostedToolCallIds = new Map<string, string[]>();
  const anthropicHostedTools = new Map<number, AnthropicHostedToolState>();
  const anthropicHostedToolNames = new Map<string, string>();
  const anthropicSearchQueries = new Map<string, string>();
  const googleCodeExecution = new GoogleCodeExecutionCollector();

  const hasIncompleteToolCall = () =>
    Object.values(partialToolCalls).some(
      (toolCall) => isRecord(toolCall) && toolCall.isComplete === false,
    );

  const markInterrupted = (error: unknown, source: "error_event" | "stream_read"): boolean => {
    const partialContent = content.toString();
    const incompleteToolCall = hasIncompleteToolCall();

    if (!partialContent && !incompleteToolCall) {
      return false;
    }

    turn.interrupted = true;
    logger.warn("Provider stream interrupted after partial content", {
      error,
      source,
      completion_id: completionId,
      contentLength: partialContent.length,
      incompleteToolCall,
    });

    return true;
  };

  const finaliseToolCalls = () => {
    if (turn.toolCalls.length > 0) {
      return;
    }

    turn.toolCalls = Object.values(partialToolCalls).filter(
      (toolCall) => isRecord(toolCall) && isRecord(toolCall.function),
    );
  };

  const appendCompletedResponseAssets = async (data: unknown) => {
    if (!isRecord(data) || data.type !== "response.completed" || !isRecord(data.response)) {
      return;
    }

    let formattedResponse: any;

    try {
      formattedResponse = await ResponseFormatter.formatResponse(data.response, provider, {
        model,
        modalities: modelConfig?.modalities,
        env,
        context: context.serviceContext,
        completion_id: completionId,
        is_streaming: false,
        userId: context.userId,
      });
    } catch (error) {
      turn.error = error;
      throw error;
    }

    if (!Array.isArray(formattedResponse.response)) {
      return;
    }

    const assetParts = buildMessageParts({
      role: "assistant",
      content: formattedResponse.response,
      timestamp: Date.now(),
    })?.filter((part) => part.type === "file");

    if (assetParts?.length) {
      turn.parts.push(...assetParts);
    }

    if (formattedResponse.data) {
      turn.structuredData = formattedResponse.data;
    }
  };

  const handleLine = async (line: string): Promise<boolean> => {
    if (!line.trim()) {
      return false;
    }

    if (line.startsWith("event: ")) {
      currentEventType = line.substring(7).trim();

      return false;
    }

    if (!line.startsWith("data: ")) {
      return false;
    }

    const dataStr = line.substring(6).trim();

    if (dataStr === "[DONE]") {
      return true;
    }

    const data = safeParseJson(dataStr);

    if (!data) {
      logger.error("Failed to parse provider stream data", { data: dataStr });

      return false;
    }

    const streamError =
      data.error || (data.type === "response.failed" ? data.response?.error : null);

    if (streamError) {
      if (!markInterrupted(streamError, "error_event")) {
        turn.error = streamError;
      }

      return true;
    }

    const formattedData = await ResponseFormatter.formatResponse(data, provider, {
      model,
      modalities: modelConfig?.modalities,
      env,
      is_streaming: true,
      userId: context.userId,
    });

    const googleStreamParts =
      provider === "google-ai-studio" || provider === "google-vertex"
        ? googleCodeExecution.collect(data, turn.parts, Date.now())
        : { handled: false, text: "" };
    const contentDelta = googleStreamParts.handled
      ? googleStreamParts.text
      : typeof data.choices?.[0]?.delta?.content === "string"
        ? data.choices[0].delta.content
        : StreamingFormatter.extractContentFromChunk(formattedData, currentEventType);

    if (contentDelta) {
      if (
        modelEmitsUnterminatedThinking(model) &&
        isFirstContentChunk &&
        !openedThinkTag &&
        !contentDelta.trim().startsWith("<think>")
      ) {
        await sink.writeEvent("content_block_delta", { content: "<think>\n" });
        content.add("<think>\n");
        openedThinkTag = true;
      }

      content.add(contentDelta);
      appendTextPart(turn.parts, contentDelta, Date.now());
      isFirstContentChunk = false;

      await sink.writeEvent("content_block_delta", { content: contentDelta });
    }

    const thinkingData = StreamingFormatter.extractThinkingFromChunk(data, currentEventType);

    if (typeof thinkingData === "string") {
      if (
        data.type === "response.reasoning_summary_text.delta" &&
        typeof data.item_id === "string"
      ) {
        handledReasoningItems.add(data.item_id);
      }

      thinking.add(thinkingData);
      appendReasoningPart(turn.parts, thinkingData, Date.now());
      await sink.writeEvent("thinking_delta", { thinking: thinkingData });
    } else if (thinkingData?.type === "signature") {
      turn.signature = thinkingData.signature;
      await sink.writeEvent("signature_delta", { signature: thinkingData.signature });
    }

    const responseOutputItems =
      data.type === "response.output_item.done" && isRecord(data.item)
        ? [data.item]
        : data.type === "response.completed" && Array.isArray(data.response?.output)
          ? data.response.output
          : [];

    for (const item of responseOutputItems) {
      if (!isRecord(item)) {
        continue;
      }

      const itemId = typeof item.id === "string" ? item.id : undefined;
      const reasoningSummary = extractOpenAIReasoningSummary(item);

      if (reasoningSummary && (!itemId || !handledReasoningItems.has(itemId))) {
        thinking.add(reasoningSummary);
        appendReasoningPart(turn.parts, reasoningSummary, Date.now());
        await sink.writeEvent("thinking_delta", { thinking: reasoningSummary });

        if (itemId) {
          handledReasoningItems.add(itemId);
        }
      }

      if (itemId && completedHostedToolItems.has(itemId)) {
        continue;
      }

      let hostedToolParts = buildOpenAIHostedToolParts(item, Date.now());
      const hostedToolUse = hostedToolParts.find((part) => part.type === "tool_use");
      const hostedToolResult = hostedToolParts.find((part) => part.type === "tool_result");

      if (hostedToolUse && !hostedToolResult && hostedToolUse.toolCallId) {
        const pendingIds = pendingHostedToolCallIds.get(hostedToolUse.name) ?? [];

        pendingIds.push(hostedToolUse.toolCallId);
        pendingHostedToolCallIds.set(hostedToolUse.name, pendingIds);
      }

      if (!hostedToolUse && hostedToolResult?.name) {
        const pendingIds = pendingHostedToolCallIds.get(hostedToolResult.name);
        const pendingId = pendingIds?.shift();

        if (pendingId) {
          hostedToolParts = buildOpenAIHostedToolParts(item, Date.now(), pendingId);
        }
      }

      if (hostedToolParts.length > 0) {
        turn.parts.push(...hostedToolParts);

        if (itemId) {
          completedHostedToolItems.add(itemId);
        }
      }
    }

    await appendCompletedResponseAssets(data);

    if (provider === "anthropic" && currentEventType === "content_block_start") {
      const hostedTool = readAnthropicHostedToolStart(data.content_block);

      if (hostedTool && typeof data.index === "number") {
        anthropicHostedTools.set(data.index, hostedTool);
        anthropicHostedToolNames.set(hostedTool.id, hostedTool.name);
      }

      const toolUseId = isRecord(data.content_block) ? data.content_block.tool_use_id : undefined;
      const searchGrounding = buildAnthropicSearchGrounding(
        data.content_block,
        typeof toolUseId === "string" ? anthropicSearchQueries.get(toolUseId) : undefined,
      );

      if (searchGrounding) {
        turn.structuredData = mergeAnthropicSearchGrounding(turn.structuredData, searchGrounding);
      } else {
        const hostedToolResult = buildAnthropicHostedToolResultPart(
          data.content_block,
          anthropicHostedToolNames,
          Date.now(),
        );

        if (hostedToolResult) {
          turn.parts.push(hostedToolResult);
        }
      }
    }

    if (
      provider === "anthropic" &&
      currentEventType === "content_block_delta" &&
      data.delta?.type === "input_json_delta" &&
      typeof data.index === "number"
    ) {
      const hostedTool = anthropicHostedTools.get(data.index);

      if (hostedTool && typeof data.delta.partial_json === "string") {
        hostedTool.inputJson += data.delta.partial_json;
      }
    }

    collectToolCallDelta(
      StreamingFormatter.extractToolCall(data, currentEventType),
      partialToolCalls,
      turn.toolCalls,
    );

    if (currentEventType === "content_block_start" || currentEventType === "content_block_stop") {
      await sink.writeEvent(currentEventType, data);
    }

    if (currentEventType === "content_block_stop") {
      if (provider === "anthropic" && typeof data.index === "number") {
        const hostedTool = anthropicHostedTools.get(data.index);

        if (hostedTool) {
          const hostedToolUse = buildAnthropicHostedToolUsePart(hostedTool, Date.now());

          if (hostedToolUse.type === "tool_use" && hostedToolUse.name === "search_grounding") {
            const query = isRecord(hostedToolUse.input) ? hostedToolUse.input.query : undefined;

            if (typeof query === "string") {
              anthropicSearchQueries.set(hostedTool.id, query);
            }
          } else {
            turn.parts.push(hostedToolUse);
          }

          anthropicHostedTools.delete(data.index);
        }
      }

      const completedToolCall = closeAnthropicToolCall(data, partialToolCalls);

      if (completedToolCall) {
        turn.toolCalls.push(completedToolCall);
      }
    }

    const extractedCitations = StreamingFormatter.extractCitations(data);

    if (extractedCitations.length > 0) {
      turn.citations = extractedCitations;
    }

    const extractedUsage = StreamingFormatter.extractUsageData(data);

    if (extractedUsage) {
      const mergedUsage = mergeStreamedTokenUsage(turn.usage, extractedUsage);

      if (hasTokenUsageChanged(turn.usage, mergedUsage)) {
        await sink.writeEvent("usage", { usage: mergedUsage });
      }

      turn.usage = mergedUsage;
    }

    const extractedStructuredData = StreamingFormatter.extractStructuredData(data);

    if (extractedStructuredData) {
      turn.structuredData = extractedStructuredData;
    }

    const refusalDelta = StreamingFormatter.extractRefusalFromChunk(data);

    if (typeof refusalDelta === "string") {
      turn.refusal = refusalDelta;
    }

    const annotationsDelta = StreamingFormatter.extractAnnotationsFromChunk(data);

    if (annotationsDelta !== null && annotationsDelta !== undefined) {
      turn.annotations = annotationsDelta;
    }

    return StreamingFormatter.isCompletionIndicated(data);
  };

  const reader = providerStream.getReader();
  const decoder = new TextDecoder();

  try {
    while (!completed) {
      if (context.shouldStop?.()) {
        turn.stopped = true;
        await reader.cancel().catch(() => {});
        break;
      }

      const { done, value } = await reader.read();

      if (done) {
        if (hasIncompleteToolCall()) {
          markInterrupted(
            new Error("Provider stream ended before tool call input was complete"),
            "stream_read",
          );
        }

        break;
      }

      const lines = buffer.append(decoder.decode(value, { stream: true }));

      for (const line of lines) {
        try {
          if (await handleLine(line)) {
            completed = true;
            break;
          }
        } catch (error) {
          logger.error("Failed to handle provider stream line", { error, line });
        }
      }
    }
  } catch (error) {
    if (!markInterrupted(error, "stream_read")) {
      throw error;
    }
  } finally {
    reader.releaseLock();
  }

  finaliseToolCalls();

  turn.content = content.toString();
  turn.thinking = thinking.toString();

  return turn;
}

function collectToolCallDelta(
  toolCallData: any,
  partialToolCalls: Record<string, any>,
  toolCalls: ToolCall[],
) {
  if (!toolCallData) {
    return;
  }

  if (toolCallData.format === "openai") {
    for (const toolCall of toolCallData.toolCalls) {
      const index = toolCall.index;

      partialToolCalls[index] ??= {
        id: toolCall.id,
        type: toolCall.type || "function",
        function: { name: toolCall.function?.name || "", arguments: "" },
      };

      if (toolCall.function?.name) {
        partialToolCalls[index].function.name = toolCall.function.name;
      }

      if (toolCall.function?.arguments) {
        partialToolCalls[index].function.arguments += toolCall.function.arguments;
      }
    }

    return;
  }

  if (toolCallData.format === "anthropic" || toolCallData.format === "nova") {
    partialToolCalls[toolCallData.index] = {
      id: toolCallData.id,
      name: toolCallData.name,
      accumulatedInput: "",
      isComplete: false,
    };

    return;
  }

  if (toolCallData.format === "anthropic_delta" || toolCallData.format === "nova_delta") {
    if (partialToolCalls[toolCallData.index] && toolCallData.partial_json) {
      partialToolCalls[toolCallData.index].accumulatedInput += toolCallData.partial_json;
    }

    return;
  }

  if (toolCallData.format === "direct") {
    const seenToolCallIds = new Set(toolCalls.map((toolCall) => toolCall.id).filter(Boolean));

    for (const toolCall of toolCallData.toolCalls) {
      if (toolCall.id && seenToolCallIds.has(toolCall.id)) {
        continue;
      }

      if (toolCall.id) {
        seenToolCallIds.add(toolCall.id);
      }

      toolCalls.push(toolCall);
    }
  }
}

function closeAnthropicToolCall(data: any, partialToolCalls: Record<string, any>): ToolCall | null {
  if (
    data.index === undefined ||
    !Object.hasOwn(partialToolCalls, data.index) ||
    !partialToolCalls[data.index] ||
    partialToolCalls[data.index].isComplete
  ) {
    return null;
  }

  const toolState = partialToolCalls[data.index];

  toolState.isComplete = true;

  let parsedInput: unknown = {};

  if (toolState.accumulatedInput) {
    parsedInput = safeParseJson(toolState.accumulatedInput);

    if (parsedInput === null || typeof parsedInput !== "object" || Array.isArray(parsedInput)) {
      logger.warn("Tool input parsed to non-object value", {
        toolId: toolState.id,
        toolName: toolState.name,
        parsed: typeof parsedInput,
      });
      parsedInput = {};
    }
  }

  return {
    id: toolState.id,
    type: toolState.type || "function",
    function: {
      name: toolState.name,
      arguments: JSON.stringify(parsedInput),
    },
  };
}
