import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { normalizeMessage } from "@ngriffin_uk/polychat-library-chat/messages";
import {
  itemsToMessages,
  type PlatformResponse,
  type ResponseStreamMessage,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, isRecord } from "@ngriffin_uk/polychat-utility-core";

import { ApiError } from "./http.js";

const STREAM_ERROR_STATUS_BY_CODE: Record<string, number> = {
  authentication_error: 401,
  invalid_api_key: 401,
  insufficient_quota: 429,
  model_not_found: 404,
  quota_exceeded: 429,
  rate_limit_exceeded: 429,
};

export function createStreamingApiError(errorPayload: unknown, fallbackCode?: string): ApiError {
  if (!errorPayload || typeof errorPayload !== "object") {
    return new ApiError("Streaming response failed", 500, errorPayload, fallbackCode);
  }

  const payload = errorPayload as Record<string, unknown>;
  const code =
    typeof payload.code === "string"
      ? payload.code
      : typeof payload.type === "string"
        ? payload.type
        : fallbackCode;
  const message =
    typeof payload.message === "string" && payload.message.trim().length > 0
      ? payload.message
      : "Streaming response failed";
  const status =
    typeof payload.status === "number"
      ? payload.status
      : code
        ? (STREAM_ERROR_STATUS_BY_CODE[code] ?? 500)
        : 500;

  return new ApiError(message, status, errorPayload, code);
}

export function toAppMessage(streamMessage: ResponseStreamMessage): Message {
  const normalisedToolCalls = streamMessage.tool_calls?.map((toolCall, index) => {
    const normalisedToolCall: NonNullable<Message["tool_calls"]>[number] = {
      id: toolCall.id || `${streamMessage.id}-tool-${index}`,
      type: "function",
      function: toolCall.function,
      index: typeof toolCall.index === "number" ? toolCall.index : index,
    };

    return normalisedToolCall;
  });

  return normalizeMessage({
    role: streamMessage.role,
    content: typeof streamMessage.content === "string" ? streamMessage.content : "",
    parts: streamMessage.parts,
    reasoning: streamMessage.reasoning,
    id: streamMessage.id,
    created: streamMessage.created,
    timestamp: streamMessage.timestamp,
    model: streamMessage.model,
    provider: streamMessage.provider,
    platform: streamMessage.platform,
    citations: streamMessage.citations ?? null,
    usage: isRecord(streamMessage.usage) ? streamMessage.usage : undefined,
    log_id: streamMessage.log_id,
    name: streamMessage.name,
    tool_call_id: streamMessage.tool_call_id,
    tool_call_arguments: streamMessage.tool_call_arguments,
    tool_calls: normalisedToolCalls,
    status: streamMessage.status || undefined,
    data: isRecord(streamMessage.data) ? streamMessage.data : undefined,
    provenance: streamMessage.provenance ?? undefined,
  });
}

export function toResponseAppMessages(
  response: PlatformResponse,
  fallbackModel?: string,
): { assistant: Message; toolResponses: Message[]; compaction?: Message } {
  const messages = itemsToMessages(response.output ?? []).map((message) =>
    normalizeMessage(message as Parameters<typeof normalizeMessage>[0]),
  );
  const assistant =
    messages.filter((message) => message.role === "assistant").at(-1) ??
    normalizeMessage({
      role: "assistant",
      content: "",
      id: response.last_item_id ?? generateId(),
      model: fallbackModel,
      created: Date.parse(response.created_at) || undefined,
    });

  return {
    assistant: { ...assistant, model: assistant.model ?? fallbackModel },
    toolResponses: messages.filter((message) => message.role === "tool"),
    compaction: messages.find((message) => message.role === "compaction"),
  };
}
