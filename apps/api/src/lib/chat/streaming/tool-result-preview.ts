import { CHAT_STREAM_TOOL_PREVIEW_CHARACTERS } from "@ngriffin_uk/polychat-schemas/chat-stream";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { Message } from "~/types";

const CHAT_STREAM_TOOL_EVENT_BYTES = 64 * 1024;
const encoder = new TextEncoder();

const retainedDataKeys = [
  "approvalId",
  "approvalRequired",
  "answers",
  "attachments",
  "error",
  "expiresAt",
  "formattedName",
  "humanInTheLoop",
  "icon",
  "operation",
  "outputId",
  "provider",
  "questions",
  "renderer",
  "resolution",
  "responseType",
  "selection",
  "members",
] as const;

function serialisedLength(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return CHAT_STREAM_TOOL_EVENT_BYTES + 1;
  }
}

function serialisedBytes(value: unknown): number {
  try {
    return encoder.encode(JSON.stringify(value)).byteLength;
  } catch {
    return CHAT_STREAM_TOOL_EVENT_BYTES + 1;
  }
}

function retainPresentationData(data: unknown): Record<string, unknown> {
  if (!isRecord(data)) {
    return {};
  }

  return Object.fromEntries(
    retainedDataKeys.flatMap((key) => (key in data ? [[key, data[key]]] : [])),
  );
}

function serialiseToolContent(content: Message["content"]): string {
  if (typeof content === "string") {
    return content;
  }

  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return "Tool output could not be serialised for the live preview.";
  }
}

function minimalInteractionData(data: unknown): Record<string, unknown> {
  const retained = retainPresentationData(data);
  const humanInTheLoop: Record<string, string | boolean> = {};

  if (isRecord(retained.humanInTheLoop)) {
    for (const key of ["interactionId", "requires_user_action", "status", "toolName", "type"]) {
      const value = retained.humanInTheLoop[key];

      if (typeof value === "string") {
        humanInTheLoop[key] = value.slice(0, 512);
      } else if (typeof value === "boolean") {
        humanInTheLoop[key] = value;
      }
    }
  }

  return {
    ...(typeof retained.approvalId === "string"
      ? { approvalId: retained.approvalId.slice(0, 512) }
      : {}),
    ...(retained.approvalRequired === true ? { approvalRequired: true } : {}),
    ...(Object.keys(humanInTheLoop).length > 0 ? { humanInTheLoop } : {}),
    ...(typeof retained.formattedName === "string"
      ? { formattedName: retained.formattedName.slice(0, 512) }
      : {}),
    ...(typeof retained.responseType === "string"
      ? { responseType: retained.responseType.slice(0, 128) }
      : {}),
  };
}

export function createStreamedToolResultEvent(result: Message): {
  tool_id: string | undefined;
  result: Message;
} {
  const originalCharacters = serialisedLength(result);

  if (serialisedBytes(result) <= CHAT_STREAM_TOOL_EVENT_BYTES) {
    return { tool_id: result.id, result };
  }

  const content = serialiseToolContent(result.content);
  const buildEvent = (
    previewCharacters: number,
    data: Record<string, unknown>,
  ): { tool_id: string | undefined; result: Message } => {
    const preview = content.slice(0, previewCharacters);

    return {
      tool_id: result.id,
      result: {
        role: "tool",
        id: result.id,
        content: `${preview}${content.length > preview.length ? "\n\n[Live preview truncated]" : ""}`,
        name: result.name,
        status: result.status,
        data: {
          ...data,
          streamPreview: {
            truncated: true,
            fullMessageId: result.id,
            originalCharacters,
            previewCharacters,
          },
        },
        timestamp: result.timestamp,
        log_id: result.log_id,
        model: result.model,
        platform: result.platform,
        tool_call_id: result.tool_call_id,
      },
    };
  };

  let previewCharacters = CHAT_STREAM_TOOL_PREVIEW_CHARACTERS;
  let event = buildEvent(previewCharacters, retainPresentationData(result.data));

  while (serialisedBytes(event) > CHAT_STREAM_TOOL_EVENT_BYTES && previewCharacters > 0) {
    previewCharacters = Math.floor(previewCharacters / 2);
    event = buildEvent(previewCharacters, retainPresentationData(result.data));
  }

  if (serialisedBytes(event) > CHAT_STREAM_TOOL_EVENT_BYTES) {
    previewCharacters = Math.min(4096, content.length);
    event = buildEvent(previewCharacters, minimalInteractionData(result.data));
  }

  return event;
}
