import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { runProvenanceSchema } from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import {
  buildMessageParts,
  normaliseMessageParts,
} from "~/modules/chat/application/messages/parts";
import type { Message } from "~/types";

const logger = getLogger({ prefix: "services/conversations/stored-message" });

export function formatStoredMessage(dbMessage: Record<string, unknown>): Message {
  let content: Message["content"] = dbMessage.content as Message["content"];

  try {
    if (typeof content === "string" && (content.startsWith("[") || content.startsWith("{"))) {
      content = safeParseJson(content);
    }
  } catch (error) {
    logger.error("Error parsing message content", { error });
  }

  const toolCalls = dbMessage.tool_calls
    ? safeParseJson(dbMessage.tool_calls as string)
    : dbMessage.tool_calls;
  const citations = dbMessage.citations
    ? safeParseJson(dbMessage.citations as string)
    : dbMessage.citations;
  const data = dbMessage.data ? safeParseJson(dbMessage.data as string) : dbMessage.data;
  const parts = dbMessage.parts ? safeParseJson(dbMessage.parts as string) : dbMessage.parts;
  const provenanceValue =
    typeof dbMessage.provenance_json === "string"
      ? safeParseJson(dbMessage.provenance_json)
      : dbMessage.provenance_json;
  const provenance = runProvenanceSchema.safeParse(provenanceValue);
  const normalisedParts = normaliseMessageParts(parts, dbMessage.timestamp as number | undefined);
  const message = Object.fromEntries(
    Object.entries({
      ...dbMessage,
      id: dbMessage.id,
      role: dbMessage.role as string,
      content,
      model: dbMessage.model as string,
      name: dbMessage.name as string,
      tool_calls: toolCalls,
      citations,
      status: dbMessage.status as string,
      timestamp: dbMessage.timestamp as number,
      platform: dbMessage.platform as string,
      mode: dbMessage.mode as string,
      data,
      parts: normalisedParts,
      usage: dbMessage.usage ? safeParseJson(dbMessage.usage as string) : undefined,
      ...(provenance.success ? { provenance: provenance.data } : {}),
      log_id: dbMessage.log_id as string,
    }).filter(([, value]) => value !== null),
  ) as Message;

  if (!message.parts || message.parts.length === 0) {
    message.parts = buildMessageParts(message);
  }

  return message;
}
