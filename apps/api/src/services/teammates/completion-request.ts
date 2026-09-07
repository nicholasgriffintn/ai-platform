import {
  agentModeSchema,
  DEFAULT_TEAMMATE_KIND,
  filterToolIdsForTeammateKind,
  mergeToolIds,
  readToolIds,
  SKILL_LOAD_TOOL_NAME,
  TEAMMATE_BOT_DENIED_TOOLS,
  teammateKindSchema,
  type ParsedChatCompletionRequestBody,
} from "@ngriffin_uk/polychat-schemas";

import type { Teammate } from "~/lib/database/schema";
import type { AssistantPersona, ChatCompletionParameters, Message } from "~/types";

import { readTeammateSkillIds } from "./teammateResponse";

type CompletionTeammate = Pick<
  Teammate,
  "id" | "model" | "temperature" | "max_steps" | "enabled_tools" | "skill_ids" | "mode" | "kind"
>;

export interface TeammateCompletionRequestInput {
  teammate: CompletionTeammate;
  body: ParsedChatCompletionRequestBody;
  modelProvider: string;
  formattedTools: NonNullable<ChatCompletionParameters["tools"]>;
  persona: AssistantPersona;
  maxStepsOverride?: number;
}

type PreparedTeammateCompletionRequest = Omit<ChatCompletionParameters, "env">;

class TeammateCompletionRequestPreparer {
  constructor(private readonly input: TeammateCompletionRequestInput) {}

  prepare(): PreparedTeammateCompletionRequest {
    const {
      user: _requestUser,
      platform: requestPlatform,
      stop: requestStop,
      tool_choice: requestToolChoice,
      messages: requestMessages,
      ...requestBody
    } = this.input.body;

    return {
      ...requestBody,
      messages: requestMessages.map((message): Message => ({
        ...message,
        content: message.content ?? "",
      })),
      persona: this.input.persona,
      model: this.input.teammate.model || this.input.body.model,
      provider: this.input.teammate.model ? this.input.modelProvider : this.input.body.provider,
      tools: this.input.formattedTools,
      stream: this.input.body.stream,
      mode: agentModeSchema.safeParse(this.input.teammate.mode).data ?? "teammate",
      tool_policy_mode: "chat",
      max_steps:
        this.input.maxStepsOverride ??
        this.input.teammate.max_steps ??
        this.input.body.max_steps ??
        20,
      temperature: this.input.teammate.temperature
        ? Number.parseFloat(this.input.teammate.temperature)
        : this.input.body.temperature,
      top_p: this.input.body.top_p,
      platform: requestPlatform === "obsidian" ? "api" : requestPlatform,
      stop: requestStop ? (Array.isArray(requestStop) ? requestStop : [requestStop]) : undefined,
      enabled_tools: this.resolveEnabledTools(),
      denied_tools: this.resolveDeniedTools(),
      approved_tools: this.input.body.approved_tools,
      delegation_context: this.input.body.delegation_context,
      use_multi_model: this.input.body.use_multi_model,
      models: this.input.body.models,
      reasoning_effort: this.input.body.reasoning_effort ?? this.input.body.reasoning?.effort,
      verbosity: this.input.body.verbosity,
      budget_constraint: this.input.body.budget_constraint,
      parallel_tool_calls: this.input.body.parallel_tool_calls,
      response_format: this.input.body.response_format,
      tool_choice: requestToolChoice,
    };
  }

  private resolveTeammateKind() {
    return teammateKindSchema.safeParse(this.input.teammate.kind).data ?? DEFAULT_TEAMMATE_KIND;
  }

  private resolveDeniedTools(): string[] | undefined {
    return this.resolveTeammateKind() === "bot" ? [...TEAMMATE_BOT_DENIED_TOOLS] : undefined;
  }

  private resolveEnabledTools(): string[] | undefined {
    const requested =
      this.input.body.enabled_tools ?? readToolIds(this.input.teammate.enabled_tools) ?? undefined;
    const permitted =
      filterToolIdsForTeammateKind(this.resolveTeammateKind(), requested) ?? undefined;

    if (!permitted || readTeammateSkillIds(this.input.teammate.skill_ids).length === 0) {
      return permitted;
    }

    return mergeToolIds(permitted, SKILL_LOAD_TOOL_NAME);
  }
}

export function prepareTeammateCompletionRequest(
  input: TeammateCompletionRequestInput,
): PreparedTeammateCompletionRequest {
  return new TeammateCompletionRequestPreparer(input).prepare();
}
