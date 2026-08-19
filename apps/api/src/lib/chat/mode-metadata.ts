import {
  conversationModeMetadataSchema,
  type ConversationModeMetadata,
} from "@ngriffin_uk/polychat-schemas";

import type { ChatMode, ChatRequestOptions } from "~/types";

const AGENT_EXECUTION_MODES = new Set<ChatMode>(["agent", "plan", "build", "explore"]);

export type ChatPromptMode = "sms";
export type ChatConversationMode = ChatPromptMode | "background";

export function isAgentExecutionMode(mode: ChatMode): boolean {
  return AGENT_EXECUTION_MODES.has(mode);
}

export function resolveChatPromptMode(
  options: ChatRequestOptions | undefined,
): ChatPromptMode | undefined {
  if (options?.sms?.enabled) {
    return "sms";
  }

  return undefined;
}

export function resolveChatConversationMode(
  options: ChatRequestOptions | undefined,
  background?: boolean,
): ChatConversationMode | undefined {
  const promptMode = resolveChatPromptMode(options);

  if (promptMode) {
    return promptMode;
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
    smsSettings: options?.sms?.enabled
      ? {
          from: options.sms.from,
          to: options.sms.to,
        }
      : undefined,
  });

  return parsed.success ? parsed.data : undefined;
}
