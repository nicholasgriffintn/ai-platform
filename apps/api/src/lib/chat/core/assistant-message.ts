import { buildAssistantMessageData } from "~/lib/chat/policy/mode-metadata";
import { extractUsagePayload } from "~/lib/usage/extractUsage";
import { normaliseTokenUsage } from "~/lib/usage/tokenUsage";
import type { ChatMode, ChatRequestOptions, Message, Platform } from "~/types";
import { generateId } from "~/utils/id";
import { nonEmptyToolCallsOrNull } from "~/utils/toolCalls";

type AssistantResponseForStorage = {
  response?: string;
  citations?: string[] | null;
  data?: unknown;
  log_id?: string;
  usage?: Record<string, unknown>;
  usageMetadata?: Record<string, unknown>;
  tool_calls?: unknown;
  status?: string;
};

export interface BuildStoredAssistantMessageParams {
  response: AssistantResponseForStorage;
  content: string;
  envLogId?: string;
  mode: ChatMode;
  model: string;
  platform: Platform;
  requestOptions?: ChatRequestOptions;
}

export function buildStoredAssistantMessage(params: BuildStoredAssistantMessageParams): Message {
  return {
    role: "assistant",
    content: params.content,
    citations: params.response.citations || null,
    data: buildAssistantMessageData({ responseData: params.response.data }),
    log_id: params.envLogId || params.response.log_id,
    mode: params.mode,
    id: generateId(),
    timestamp: Date.now(),
    model: params.model,
    platform: params.platform,
    usage: normaliseTokenUsage(extractUsagePayload(params.response)) ?? undefined,
    tool_calls: nonEmptyToolCallsOrNull(params.response.tool_calls),
    status: params.response.status || undefined,
  };
}
