import {
  agentModeSchema,
  mergeToolIds,
  POLY_NAVIGATION_TOOL_NAMES,
  POLY_TEAMMATE_ID,
  readToolIds,
  SKILL_LOAD_TOOL_NAME,
  type ChatHostedToolSettings,
  type McpToolConfiguration,
  type ResponseSettings,
} from "@ngriffin_uk/polychat-schemas";
import { intersectEnabledTools } from "@ngriffin_uk/polychat-utility-server/enabled-tools";

import type { Teammate } from "~/infrastructure/database/schema";

import { readTeammateSkillIds } from "./teammateResponse";

type CompletionTeammate = Pick<
  Teammate,
  "id" | "model" | "temperature" | "max_steps" | "enabled_tools" | "skill_ids" | "mode" | "kind"
>;

export interface TeammateCompletionRequestInput {
  teammate: CompletionTeammate;
  settings: ResponseSettings;
  modelProvider: string;
  mcpServers?: McpToolConfiguration["servers"];
  maxStepsOverride?: number;
  modeOverride?: string;
}

type PreparedTeammateSettings = ResponseSettings & { mode: string; max_steps: number };

class TeammateCompletionRequestPreparer {
  constructor(private readonly input: TeammateCompletionRequestInput) {}

  prepare(): PreparedTeammateSettings {
    const { settings, teammate } = this.input;
    const enabledTools = this.resolveEnabledTools();

    return {
      ...settings,
      model: teammate.model || settings.model,
      provider: teammate.model ? this.input.modelProvider : settings.provider,
      mode: this.resolveMode(enabledTools),
      max_steps: this.input.maxStepsOverride ?? teammate.max_steps ?? settings.max_steps ?? 20,
      temperature: teammate.temperature
        ? Number.parseFloat(teammate.temperature)
        : settings.temperature,
      platform: settings.platform === "obsidian" ? "api" : settings.platform,
      enabled_tools: enabledTools,
      tool_options: this.resolveToolOptions(enabledTools),
    };
  }

  private resolveMode(enabledTools: string[] | undefined): string {
    const configured = agentModeSchema.safeParse(
      this.input.modeOverride ?? this.input.teammate.mode,
    ).data;

    if (configured) {
      return configured;
    }

    if (enabledTools?.includes("use_computer")) {
      return "build";
    }

    return "teammate";
  }

  private resolveEnabledTools(): string[] | undefined {
    const stored = readToolIds(this.input.teammate.enabled_tools) ?? undefined;
    const configured =
      (this.input.mcpServers?.length ?? 0) > 0 ? mergeToolIds(stored ?? [], "mcp") : stored;
    const requested =
      this.input.teammate.id === POLY_TEAMMATE_ID && this.input.settings.enabled_tools !== undefined
        ? [...new Set([...this.input.settings.enabled_tools, ...POLY_NAVIGATION_TOOL_NAMES])]
        : this.input.settings.enabled_tools;
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
    const { mcp_servers: _requestedMcpServers, ...requested } =
      this.input.settings.tool_options ?? {};
    const mcpEnabled =
      enabledTools?.includes("mcp") === true &&
      !this.input.settings.denied_tools?.includes("mcp") &&
      (this.input.mcpServers?.length ?? 0) > 0;
    const toolOptions: ChatHostedToolSettings = {
      ...requested,
      ...(mcpEnabled
        ? {
            mcp_servers: this.input.mcpServers?.map((server) => ({
              require_approval: "always",
              server_label: server.label,
              server_url: new URL(server.url).toString(),
              ...(server.credentialConnectionId
                ? { credential_connection_id: server.credentialConnectionId }
                : {}),
              ...(server.allowedTools ? { allowed_tools: server.allowedTools } : {}),
            })),
          }
        : {}),
    };

    return Object.keys(toolOptions).length > 0 ? toolOptions : undefined;
  }
}

export function prepareTeammateCompletionRequest(
  input: TeammateCompletionRequestInput,
): PreparedTeammateSettings {
  return new TeammateCompletionRequestPreparer(input).prepare();
}
