import {
  agentModeSchema,
  mergeToolIds,
  readToolIds,
  SKILL_LOAD_TOOL_NAME,
  type ChatHostedToolSettings,
  type McpToolConfiguration,
  type ParsedChatCompletionRequestBody,
} from "@ngriffin_uk/polychat-schemas";

import type { Teammate } from "~/lib/database/schema";
import type { AssistantPersona, ChatCompletionParameters, Message } from "~/types";
import { intersectEnabledTools } from "~/utils/enabledTools";

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
  mcpServers?: McpToolConfiguration["servers"];
  maxStepsOverride?: number;
  modeOverride?: string;
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

    const enabledTools = this.resolveEnabledTools();

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
      mode:
        agentModeSchema.safeParse(this.input.modeOverride ?? this.input.teammate.mode).data ??
        "teammate",
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
      enabled_tools: enabledTools,
      tool_options: this.resolveToolOptions(enabledTools),
      denied_tools: this.input.body.denied_tools,
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

  private resolveEnabledTools(): string[] | undefined {
    const stored = readToolIds(this.input.teammate.enabled_tools) ?? undefined;
    const configured =
      (this.input.mcpServers?.length ?? 0) > 0 ? mergeToolIds(stored ?? [], "mcp") : stored;
    const requested = this.input.body.enabled_tools;
    let permitted =
      configured && requested
        ? intersectEnabledTools(configured, requested)
        : (requested ?? configured);

    if (!this.input.mcpServers?.length && permitted?.includes("mcp")) {
      permitted = permitted.filter((toolId) => toolId !== "mcp");
    }

    if (!permitted || readTeammateSkillIds(this.input.teammate.skill_ids).length === 0) {
      return permitted;
    }

    return mergeToolIds(permitted, SKILL_LOAD_TOOL_NAME);
  }

  private resolveToolOptions(
    enabledTools: string[] | undefined,
  ): ChatHostedToolSettings | undefined {
    const { mcp_servers: _requestedMcpServers, ...requested } = this.input.body.tool_options ?? {};
    const mcpEnabled =
      enabledTools?.includes("mcp") === true &&
      !this.input.body.denied_tools?.includes("mcp") &&
      (this.input.mcpServers?.length ?? 0) > 0;
    const toolOptions: ChatHostedToolSettings = {
      ...requested,
      ...(mcpEnabled
        ? {
            mcp_servers: this.input.mcpServers?.map((server) => ({
              require_approval: "always",
              server_label: server.label,
              server_url: new URL(server.url).toString(),
            })),
          }
        : {}),
    };

    return Object.keys(toolOptions).length > 0 ? toolOptions : undefined;
  }
}

export function prepareTeammateCompletionRequest(
  input: TeammateCompletionRequestInput,
): PreparedTeammateCompletionRequest {
  return new TeammateCompletionRequestPreparer(input).prepare();
}
