import { formatAssistantMessage } from "~/lib/chat/messages/assistant-format";
import { buildMessageParts } from "~/lib/chat/messages/parts";
import { buildAssistantMessageData } from "~/lib/chat/policy/mode-metadata";
import type { ChatEventSink } from "~/lib/chat/streaming/emitter";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ConversationManager } from "~/lib/conversationManager";
import { trackTokenUsage } from "~/lib/monitoring";
import { Guardrails } from "~/lib/providers/capabilities/guardrails";
import { recordModelTurnUsage } from "~/lib/usage/modelUsage";
import type { NormalisedTokenUsage } from "~/lib/usage/tokenUsage";
import type {
  ChatMode,
  ChatRequestOptions,
  IEnv,
  IUserSettings,
  Message,
  MessagePart,
  Platform,
  ToolCall,
} from "~/types";
import { generateId } from "~/utils/id";
import { nonEmptyToolCallsOrNull } from "~/utils/toolCalls";

export interface TurnOutput {
  content: string;
  error?: unknown;
  thinking?: string;
  signature?: string;
  toolCalls: ToolCall[];
  citations?: unknown;
  usage?: NormalisedTokenUsage | null;
  rawUsage?: unknown;
  structuredData?: unknown;
  refusal?: string | null;
  annotations?: unknown;
  parts?: MessagePart[];
  status?: string;
  logId?: string;
  stopped?: boolean;
}

export interface FinaliseAssistantTurnParams {
  turn: TurnOutput;
  sink: ChatEventSink;
  conversationManager: ConversationManager;
  completionId: string;
  env: IEnv;
  model: string;
  provider: string;
  platform: Platform;
  mode: ChatMode;
  context?: ServiceContext;
  userSettings?: IUserSettings;
  requestOptions?: ChatRequestOptions;
  guardrailPrompt?: string;
  deferOutputUntilValidated?: boolean;
}

export interface FinalisedAssistantTurn {
  message: Message;
  guardrailsPassed: boolean;
  guardrailViolations: unknown[];
}

export async function finaliseAssistantTurn(
  params: FinaliseAssistantTurnParams,
): Promise<FinalisedAssistantTurn> {
  const { turn, sink, env, model, completionId, context } = params;
  const user = context?.user;

  const guardrailResult = await validateOutput(params);
  const visibleTurn = guardrailResult.passed
    ? turn
    : {
        ...turn,
        content: "Response blocked by safety checks.",
        thinking: undefined,
        signature: undefined,
        toolCalls: [],
        citations: [],
        structuredData: undefined,
        refusal: null,
        annotations: null,
        parts: [],
      };

  if (params.deferOutputUntilValidated && visibleTurn.content) {
    await sink.writeEvent("content_block_delta", { content: visibleTurn.content });
  }

  await sink.writeEvent("content_block_stop", {});

  const auditedUsage = trackTokenUsage({
    usage: turn.usage,
    provider: params.provider,
    model,
    env,
    userId: user?.id,
    completion_id: completionId,
    streamed: true,
    expectUsage: true,
  });

  const assistantMessage = formatAssistantMessage({
    content: visibleTurn.content,
    thinking: visibleTurn.thinking ?? "",
    signature: visibleTurn.signature ?? "",
    citations: (visibleTurn.citations as string[]) ?? [],
    tool_calls: visibleTurn.toolCalls,
    usage: auditedUsage,
    data: buildAssistantMessageData({ responseData: visibleTurn.structuredData }),
    guardrails: {
      passed: guardrailResult.passed,
      error: guardrailResult.error,
      violations: guardrailResult.violations,
    },
    log_id: turn.logId ?? env.AI?.aiGatewayLogId,
    model,
    platform: params.platform,
    timestamp: Date.now(),
    mode: params.mode,
    finish_reason: visibleTurn.toolCalls.length > 0 ? "tool_calls" : "stop",
    refusal: visibleTurn.refusal ?? null,
    annotations: visibleTurn.annotations ?? null,
  });

  const derivedParts = buildMessageParts({
    role: "assistant",
    content: assistantMessage.content || visibleTurn.content,
    tool_calls: assistantMessage.tool_calls,
    data: assistantMessage.data,
    timestamp: assistantMessage.timestamp,
  });
  const parts = mergeMessageParts(visibleTurn.parts ?? [], derivedParts);

  const message: Message = {
    role: "assistant",
    content:
      typeof assistantMessage.content === "string" || Array.isArray(assistantMessage.content)
        ? assistantMessage.content
        : "",
    citations: assistantMessage.citations,
    log_id: assistantMessage.log_id,
    mode: assistantMessage.mode,
    id: assistantMessage.id,
    timestamp: assistantMessage.timestamp,
    model: assistantMessage.model,
    platform: assistantMessage.platform,
    usage: assistantMessage.usage,
    tool_calls: nonEmptyToolCallsOrNull(assistantMessage.tool_calls),
    parts,
    data: assistantMessage.data || null,
    ...(turn.status ? { status: turn.status } : {}),
  };

  await params.conversationManager.add(completionId, message);

  await recordModelTurnUsage({
    env,
    repositories: context?.repositories,
    userId: user?.id,
    usage: auditedUsage,
    rawUsage: turn.rawUsage,
    model,
    provider: params.provider,
    completionId,
    messageId: message.id,
    conversationId: completionId,
  });

  await sink.writeEvent("message_delta", {
    id: completionId,
    message_id: message.id,
    object: "chat.completion",
    created: message.timestamp,
    model: message.model,
    provider: params.provider,
    platform: message.platform,
    nonce: generateId(),
    post_processing: {
      guardrails: assistantMessage.guardrails,
    },
    log_id: message.log_id,
    usage: message.usage,
    citations: message.citations,
    tool_calls: assistantMessage.tool_calls,
    finish_reason: assistantMessage.finish_reason,
    data: message.data,
    parts,
  });
  await sink.writeEvent("message_stop", {});

  return {
    message,
    guardrailsPassed: guardrailResult.passed,
    guardrailViolations: guardrailResult.violations,
  };
}

async function validateOutput(params: FinaliseAssistantTurnParams): Promise<{
  passed: boolean;
  error: string;
  violations: unknown[];
}> {
  const images = (params.turn.parts ?? []).flatMap((part) =>
    part.type === "file" && part.url && part.mimeType?.startsWith("image/")
      ? [{ url: part.url }]
      : [],
  );
  const toolCalls = params.turn.toolCalls.length
    ? `\n\n[Tool calls]\n${JSON.stringify(params.turn.toolCalls)}`
    : "";
  const reasoning = params.turn.thinking ? `[Reasoning]\n${params.turn.thinking}\n\n` : "";
  const text = `${reasoning}[Response]\n${params.turn.content}${toolCalls}`;

  if (
    !params.turn.content &&
    !params.turn.thinking &&
    !params.turn.toolCalls.length &&
    !images.length
  ) {
    return { passed: true, error: "", violations: [] };
  }

  const guardrails = new Guardrails(params.env, params.context?.user, params.userSettings);
  const validation = await guardrails.validateOutput(
    {
      text,
      prompt: params.guardrailPrompt,
      ...(images.length > 0 ? { images } : {}),
    },
    params.context?.user?.id,
    params.completionId,
  );

  if (validation?.isValid) {
    return { passed: true, error: "", violations: [] };
  }

  return {
    passed: false,
    error:
      typeof validation?.rawResponse?.blockedResponse === "string"
        ? validation.rawResponse.blockedResponse
        : "Content failed validation checks",
    violations: validation?.violations || [],
  };
}

export function mergeMessageParts(
  streamedParts: MessagePart[],
  derivedParts?: MessagePart[],
): MessagePart[] | undefined {
  if (streamedParts.length === 0 && (!derivedParts || derivedParts.length === 0)) {
    return undefined;
  }

  const merged: MessagePart[] = [...streamedParts];

  if (!derivedParts || derivedParts.length === 0) {
    return merged;
  }

  let hasTextPart = merged.some((part) => part.type === "text");
  let hasReasoningPart = merged.some((part) => part.type === "reasoning");

  const seenToolUse = new Set(
    merged
      .filter(
        (part): part is Extract<MessagePart, { type: "tool_use" }> => part.type === "tool_use",
      )
      .map((part) => `${part.toolCallId || ""}:${part.name}`),
  );

  for (const part of derivedParts) {
    if (part.type === "text") {
      if (hasTextPart) {
        continue;
      }

      hasTextPart = true;
    }

    if (part.type === "reasoning") {
      if (hasReasoningPart) {
        continue;
      }

      hasReasoningPart = true;
    }

    if (part.type === "tool_use") {
      const key = `${part.toolCallId || ""}:${part.name}`;

      if (seenToolUse.has(key)) {
        continue;
      }

      seenToolUse.add(key);
    }

    merged.push(part);
  }

  return merged;
}
