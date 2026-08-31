import {
  agentModeSchema,
  mergeToolIds,
  readToolIds,
  SKILL_LOAD_TOOL_NAME,
  type ParsedChatCompletionRequestBody,
} from "@ngriffin_uk/polychat-schemas";

import type { Agent } from "~/lib/database/schema";
import type { AssistantPersona, ChatCompletionParameters, Message } from "~/types";

import { readAgentSkillIds } from "./agentResponse";

type CompletionAgent = Pick<
  Agent,
  "id" | "model" | "temperature" | "max_steps" | "enabled_tools" | "skill_ids" | "mode"
>;

export interface AgentCompletionRequestInput {
  agent: CompletionAgent;
  body: ParsedChatCompletionRequestBody;
  modelProvider: string;
  formattedTools: NonNullable<ChatCompletionParameters["tools"]>;
  persona: AssistantPersona;
}

type PreparedAgentCompletionRequest = Omit<ChatCompletionParameters, "env">;

class AgentCompletionRequestPreparer {
  constructor(private readonly input: AgentCompletionRequestInput) {}

  prepare(): PreparedAgentCompletionRequest {
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
      model: this.input.agent.model || this.input.body.model,
      provider: this.input.agent.model ? this.input.modelProvider : this.input.body.provider,
      tools: this.input.formattedTools,
      stream: this.input.body.stream,
      mode: agentModeSchema.safeParse(this.input.agent.mode).data ?? "agent",
      tool_policy_mode: "chat",
      max_steps: this.input.agent.max_steps || this.input.body.max_steps || 20,
      temperature: this.input.agent.temperature
        ? Number.parseFloat(this.input.agent.temperature)
        : this.input.body.temperature || 0.8,
      top_p: this.input.body.top_p,
      platform: requestPlatform === "obsidian" ? "api" : requestPlatform,
      stop: requestStop ? (Array.isArray(requestStop) ? requestStop : [requestStop]) : undefined,
      enabled_tools: this.resolveEnabledTools(),
      approved_tools: this.input.body.approved_tools,
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

  private resolveEnabledTools(): string[] | undefined {
    const requested =
      this.input.body.enabled_tools ?? readToolIds(this.input.agent.enabled_tools) ?? undefined;

    if (!requested || readAgentSkillIds(this.input.agent.skill_ids).length === 0) {
      return requested;
    }

    return mergeToolIds(requested, SKILL_LOAD_TOOL_NAME);
  }
}

export function prepareAgentCompletionRequest(
  input: AgentCompletionRequestInput,
): PreparedAgentCompletionRequest {
  return new AgentCompletionRequestPreparer(input).prepare();
}
