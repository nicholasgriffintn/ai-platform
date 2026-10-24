import { responseSettingsSchema, type EngineRequest } from "@ngriffin_uk/polychat-schemas";

import type {
  ResponseAuthority,
  ResponseCommand,
  TeammateRunAuthority,
} from "~/modules/responses/domain/command";
import type { ChatCompletionParameters, Message } from "~/types";

const admittedSettingsSchema = responseSettingsSchema.strict();

type IncomingChatCompletionRequest = Omit<ChatCompletionParameters, "env" | "messages"> & {
  messages?: EngineRequest["messages"] | Message[];
  user?: string;
};
type PreparedChatCompletionRequest = Omit<ChatCompletionParameters, "env">;
type IncomingMessage = NonNullable<IncomingChatCompletionRequest["messages"]>[number];

function textFromPart(part: NonNullable<IncomingMessage["parts"]>[number]): string | undefined {
  if ("text" in part && typeof part.text === "string") {
    return part.text;
  }

  if ("summary" in part && typeof part.summary === "string") {
    return part.summary;
  }

  if ("content" in part && typeof part.content === "string") {
    return part.content;
  }

  return undefined;
}

function contentFromParts(parts: IncomingMessage["parts"]): string {
  return (
    parts
      ?.map(textFromPart)
      .filter((text): text is string => !!text)
      .join("\n") ?? ""
  );
}

function normaliseMessages(
  messages: IncomingChatCompletionRequest["messages"],
): Message[] | undefined {
  return messages?.map((message): Message => ({
    ...message,
    content: message.content ?? contentFromParts(message.parts),
  }));
}

function normaliseStop(stop: IncomingChatCompletionRequest["stop"]): string[] | undefined {
  if (!stop) {
    return undefined;
  }

  return Array.isArray(stop) ? stop : [stop];
}

function normaliseMaxTokens(request: IncomingChatCompletionRequest): number | undefined {
  return request.max_tokens ?? request.max_completion_tokens ?? request.max_output_tokens;
}

function normaliseReasoningEffort(
  request: IncomingChatCompletionRequest,
): ChatCompletionParameters["reasoning_effort"] {
  return request.reasoning_effort ?? request.reasoning?.effort;
}

function normaliseChatCompletionRequest(
  request: IncomingChatCompletionRequest,
): PreparedChatCompletionRequest {
  const {
    user: _openAiUser,
    max_completion_tokens: _maxCompletionTokens,
    max_output_tokens: _maxOutputTokens,
    reasoning: _reasoning,
    ...chatRequest
  } = request;

  return {
    ...chatRequest,
    messages: normaliseMessages(request.messages),
    stop: normaliseStop(request.stop),
    max_tokens: normaliseMaxTokens(request),
    reasoning_effort: normaliseReasoningEffort(request),
    options: request.options || {},
  };
}

function teammateEngineFields(
  teammate: TeammateRunAuthority,
): Partial<PreparedChatCompletionRequest> {
  return {
    persona: teammate.configuration.persona,
    tools: teammate.functionTools,
    tool_policy_mode: "chat",
    resolved_configuration: teammate.configuration,
    ...(teammate.contextId
      ? {
          teammate_context_id: teammate.contextId,
          autonomy_level: teammate.autonomyLevel,
          standing_approvals: teammate.standingApprovals,
          approval_streaks: teammate.approvalStreaks,
          acting_rules_suspended: teammate.actingRulesSuspended,
        }
      : {}),
    ...(teammate.computerId ? { computer_id: teammate.computerId } : {}),
    ...(teammate.delegationId ? { delegation_id: teammate.delegationId } : {}),
  };
}

function authorityEngineFields(
  authority: ResponseAuthority,
): Partial<PreparedChatCompletionRequest> {
  return {
    ...(authority.trigger ? { trigger: authority.trigger } : {}),
    ...(authority.dryRun ? { dry_run: true } : {}),
    ...(authority.delegationContext ? { delegation_context: authority.delegationContext } : {}),
    ...(authority.durableExecution ? { durable_execution: authority.durableExecution } : {}),
    ...(authority.commandPayload ? { command_payload: authority.commandPayload } : {}),
    ...(authority.requireApprovalFor ? { require_approval_for: authority.requireApprovalFor } : {}),
    ...(authority.enforceModeToolPolicy !== undefined
      ? { enforce_mode_tool_policy: authority.enforceModeToolPolicy }
      : {}),
    ...(authority.teammate ? teammateEngineFields(authority.teammate) : {}),
  };
}

export function toEngineRequest(
  command: ResponseCommand,
  authority: ResponseAuthority = {},
): PreparedChatCompletionRequest {
  const settings = admittedSettingsSchema.parse(command.settings ?? {});

  return {
    ...normaliseChatCompletionRequest({
      ...settings,
      messages: command.messages,
      ...(command.conversationId ? { completion_id: command.conversationId } : {}),
      ...(command.conversationType ? { conversation_type: command.conversationType } : {}),
      ...(command.conversationSubject ? { conversation_subject: command.conversationSubject } : {}),
      ...(command.commandId ? { command_id: command.commandId } : {}),
      ...(command.runId ? { run_id: command.runId } : {}),
      ...(command.stream !== undefined ? { stream: command.stream } : {}),
      ...(command.store !== undefined ? { store: command.store } : {}),
    }),
    ...authorityEngineFields(authority),
  };
}
