import {
  conversationModeMetadataSchema,
  type ConversationModeMetadata,
} from "@ngriffin_uk/polychat-schemas";

import type { ChatMode, ChatRequestOptions } from "~/types";

const AGENT_EXECUTION_MODES = new Set<ChatMode>(["agent", "plan", "build", "explore"]);

export type ChatConversationMode = "sms";

export function isAgentExecutionMode(mode: ChatMode | null | undefined): boolean {
  return typeof mode === "string" && AGENT_EXECUTION_MODES.has(mode);
}

export function resolveChatConversationMode(
  options: ChatRequestOptions | undefined,
): ChatConversationMode | undefined {
  return options?.channel?.id;
}

function asResponseDataRecord(data: unknown): Record<string, unknown> | null {
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : null;
}

export function buildAssistantMessageData(params: {
  responseData?: unknown;
}): Record<string, unknown> | null {
  return asResponseDataRecord(params.responseData);
}

export function buildUserMessageData(
  options: ChatRequestOptions | undefined,
): Record<string, unknown> | undefined {
  const conversationMode = buildConversationModeMetadataFromRequestOptions(options);
  const codingTaskType = options?.sandbox?.enabled ? options.sandbox.taskType : undefined;

  if (!conversationMode && !codingTaskType) {
    return undefined;
  }

  return {
    ...(conversationMode ? { conversationMode } : {}),
    ...(codingTaskType ? { codingTaskType } : {}),
  };
}

export function buildConversationModeMetadataFromRequestOptions(
  options: ChatRequestOptions | undefined,
): ConversationModeMetadata | undefined {
  const mode = resolveChatConversationMode(options);

  if (!mode) {
    return undefined;
  }

  const parsed = conversationModeMetadataSchema.safeParse({
    mode,
    requestOptions: options,
    smsSettings:
      options?.channel?.id === "sms"
        ? {
            from: options.channel.from,
            to: options.channel.to,
          }
        : undefined,
  });

  return parsed.success ? parsed.data : undefined;
}
