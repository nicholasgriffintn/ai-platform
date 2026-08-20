import {
  conversationModeMetadataSchema,
  type ConversationModeMetadata,
} from "@ngriffin_uk/polychat-schemas";

import type { ChatMode, ChatRequestOptions } from "~/types";

const AGENT_EXECUTION_MODES = new Set<ChatMode>(["agent", "plan", "build", "explore"]);

export type ChatConversationMode = "sms" | "background";

export function isAgentExecutionMode(mode: ChatMode | null | undefined): boolean {
  return typeof mode === "string" && AGENT_EXECUTION_MODES.has(mode);
}

export function resolveChatConversationMode(
  options: ChatRequestOptions | undefined,
  background?: boolean,
): ChatConversationMode | undefined {
  if (options?.channel) {
    return options.channel.id;
  }

  if (background) {
    return "background";
  }

  return undefined;
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
  background?: boolean,
): Record<string, unknown> | undefined {
  const conversationMode = buildConversationModeMetadataFromRequestOptions(options, background);
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
  background?: boolean,
): ConversationModeMetadata | undefined {
  const mode = resolveChatConversationMode(options, background);

  if (!mode) {
    return undefined;
  }

  const parsed = conversationModeMetadataSchema.safeParse({
    mode,
    requestOptions: mode === "background" ? undefined : options,
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
