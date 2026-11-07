import { isRecord, readStringField, truncateText } from "@ngriffin_uk/polychat-utility-core";

import type { TelemetryMessage } from "../types.js";

const MAX_PART_LENGTH = 20_000;
const MAX_MESSAGES_LENGTH = 20_000;
const CONVERSATION_ID_PATTERN = /^[\w-]+$/;

type SentryMessagePart =
  | { type: "text" | "reasoning"; content: string }
  | { type: "tool_call"; id?: string; name?: string; arguments: string }
  | { type: "tool_call_response"; id?: string; response: string };

function toPayload(value: unknown): string {
  const payload = typeof value === "string" ? value : JSON.stringify(value);

  return truncateText(payload ?? "", MAX_PART_LENGTH);
}

function toContentPart(part: unknown): SentryMessagePart {
  if (!isRecord(part)) {
    return { type: "text", content: toPayload(part) };
  }

  switch (part.type) {
    case "text":
      return { type: "text", content: toPayload(part.text) };
    case "thinking":
      return { type: "reasoning", content: toPayload(part.thinking) };
    case "tool_result":
      return {
        type: "tool_call_response",
        id: readStringField(part, "tool_use_id"),
        response: toPayload(part.content),
      };
    default:
      return { type: "text", content: `[${readStringField(part, "type") ?? "content"}]` };
  }
}

function toToolCallPart(toolCall: unknown): SentryMessagePart {
  const call = isRecord(toolCall) ? toolCall : {};
  const definition = isRecord(call.function) ? call.function : call;

  return {
    type: "tool_call",
    id: readStringField(call, "id"),
    name: readStringField(definition, "name"),
    arguments: toPayload(definition.arguments),
  };
}

function toContentParts({ role, content, tool_call_id }: TelemetryMessage): SentryMessagePart[] {
  if (role === "tool") {
    return [{ type: "tool_call_response", id: tool_call_id, response: toPayload(content) }];
  }

  if (Array.isArray(content)) {
    return content.map(toContentPart);
  }

  return content ? [{ type: "text", content: toPayload(content) }] : [];
}

function toMessageParts(message: TelemetryMessage): SentryMessagePart[] {
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];

  return [...toContentParts(message), ...toolCalls.map(toToolCallPart)];
}

export function serialiseSentryMessages(messages: readonly TelemetryMessage[]): string | undefined {
  const kept: string[] = [];
  let length = 0;

  for (const message of [...messages].reverse()) {
    const parts = toMessageParts(message);

    if (parts.length === 0) {
      continue;
    }

    const serialised = JSON.stringify({ role: message.role, parts });

    length += serialised.length;

    if (kept.length > 0 && length > MAX_MESSAGES_LENGTH) {
      break;
    }

    kept.unshift(serialised);
  }

  return kept.length > 0 ? `[${kept.join(",")}]` : undefined;
}

export function toSentryConversationId(id: string | undefined): string | undefined {
  return id && CONVERSATION_ID_PATTERN.test(id) ? id : undefined;
}
