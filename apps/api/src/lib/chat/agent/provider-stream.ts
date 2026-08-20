import { MAX_BUFFER_LENGTH, MAX_CONTENT_LENGTH, MAX_THINKING_LENGTH } from "~/constants/app";
import type { ChatEventSink } from "~/lib/chat/emitter";
import { appendReasoningPart, appendTextPart } from "~/lib/chat/messageParts";
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

const logger = getLogger({ prefix: "lib/chat/agent/provider-stream" });

export interface ProviderStreamContext {
  env: IEnv;
  model: string;
  provider: string;
  completionId: string;
  userId?: number;
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
  const buffer = new BoundedText(MAX_BUFFER_LENGTH, "Buffer", completionId);

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
  let qwqThinkTagAdded = false;
  let completed = false;

  const finaliseToolCalls = () => {
    if (turn.toolCalls.length === 0 && Object.keys(partialToolCalls).length > 0) {
      turn.toolCalls = Object.values(partialToolCalls);
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
      turn.error = streamError;

      return true;
    }

    const formattedData = await ResponseFormatter.formatResponse(data, provider, {
      model,
      modalities: modelConfig?.modalities,
      env,
      is_streaming: true,
      userId: context.userId,
    });

    const contentDelta =
      data.choices?.[0]?.delta?.content !== undefined
        ? data.choices[0].delta.content
        : StreamingFormatter.extractContentFromChunk(formattedData, currentEventType);

    if (contentDelta) {
      if (
        model.toLowerCase().includes("qwq") &&
        isFirstContentChunk &&
        !qwqThinkTagAdded &&
        !contentDelta.trim().startsWith("<think>")
      ) {
        await sink.writeEvent("content_block_delta", { content: "<think>\n" });
        content.add("<think>\n");
        qwqThinkTagAdded = true;
      }

      content.add(contentDelta);
      appendTextPart(turn.parts, contentDelta, Date.now());
      isFirstContentChunk = false;

      await sink.writeEvent("content_block_delta", { content: contentDelta });
    }

    const thinkingData = StreamingFormatter.extractThinkingFromChunk(data, currentEventType);

    if (typeof thinkingData === "string") {
      thinking.add(thinkingData);
      appendReasoningPart(turn.parts, thinkingData, Date.now());
      await sink.writeEvent("thinking_delta", { thinking: thinkingData });
    } else if (thinkingData?.type === "signature") {
      turn.signature = thinkingData.signature;
      await sink.writeEvent("signature_delta", { signature: thinkingData.signature });
    }

    collectToolCallDelta(
      StreamingFormatter.extractToolCall(data, currentEventType),
      partialToolCalls,
      turn.toolCalls,
    );

    if (currentEventType === "content_block_start" || currentEventType === "content_block_stop") {
      await sink.writeEvent(currentEventType, data);

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
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer.add(decoder.decode(value, { stream: true }));

      const lines = buffer.toString().split("\n");

      buffer.replace(lines.pop() || "");

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
