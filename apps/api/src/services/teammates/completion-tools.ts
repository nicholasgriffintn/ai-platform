import type { MCPClientManager } from "agents/mcp/client";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { Teammate } from "~/lib/database/schema";
import { request_approval, ask_user } from "~/services/functions/human_in_the_loop";
import { registerMCPClient } from "~/services/functions/mcp";
import { messageParent } from "~/services/functions/message-parent";
import {
  connectMCPServerReady,
  parseMCPServerConfigs,
  resolveMCPAIToolDefinition,
  type TeammateMCPToolDefinition,
  type MCPServerConfig,
} from "~/services/teammates/mcp-client";
import { readTeammateSkillIds } from "~/services/teammates/teammateResponse";
import type { AssistantPersona, AssistantPersonaExample } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/teammates/completion-tools" });

const CORE_TEAMMATE_TOOLS: ApiToolDefinition[] = [request_approval, ask_user, messageParent];

type CompletionTeammate = Pick<
  Teammate,
  "id" | "servers" | "system_prompt" | "few_shot_examples" | "skill_ids"
>;

export type TeammateCompletionToolDefinition =
  | ApiToolDefinition
  | {
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    };

export async function buildTeammateCompletionTools(
  teammate: CompletionTeammate,
  context: ServiceContext,
): Promise<TeammateCompletionToolDefinition[]> {
  const mcpFunctions = await setupMCPFunctions(teammate, context);

  return [...CORE_TEAMMATE_TOOLS, ...mcpFunctions];
}

export function buildTeammatePersona(teammate: CompletionTeammate): AssistantPersona {
  return {
    instructions: buildPersonaInstructions(teammate),
    examples: parseFewShotExamples(teammate.few_shot_examples),
  };
}

function buildPersonaInstructions(teammate: CompletionTeammate): string | undefined {
  const skillIds = readTeammateSkillIds(teammate.skill_ids);
  const sections = [
    teammate.system_prompt?.trim() || undefined,
    skillIds.length > 0
      ? `Load these skills before you start and follow them: ${skillIds.join(", ")}.`
      : undefined,
  ].filter((section): section is string => Boolean(section));

  return sections.length > 0 ? sections.join("\n\n") : undefined;
}

function parseFewShotExamples(rawExamples: unknown): AssistantPersonaExample[] {
  if (!rawExamples) {
    return [];
  }

  try {
    const parsed = typeof rawExamples === "string" ? safeParseJson(rawExamples) : rawExamples;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (example): example is AssistantPersonaExample =>
        typeof example === "object" &&
        example !== null &&
        typeof (example as { input?: unknown }).input === "string" &&
        typeof (example as { output?: unknown }).output === "string",
    );
  } catch (error) {
    logger.error("Error parsing few-shot examples", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });

    return [];
  }
}

async function setupMCPFunctions(teammate: CompletionTeammate, context: ServiceContext) {
  const mcpFunctions: TeammateMCPToolDefinition[] = [];

  if (!teammate.servers) {
    return mcpFunctions;
  }

  let mcp: MCPClientManager | null = null;

  try {
    const serverConfigs = parseMCPServerConfigs(teammate.servers);

    if (serverConfigs.length === 0) {
      return mcpFunctions;
    }

    if (!context.env.MCP_STORAGE) {
      throw new AssistantError("MCP storage not configured", ErrorType.CONFIGURATION_ERROR);
    }

    const { MCPClientManager } = await import("agents/mcp/client");

    mcp = new MCPClientManager(teammate.id, "1.0.0", {
      storage: context.env.MCP_STORAGE,
    });
    await registerMCPClient(context, teammate.id, mcp);

    for (const cfg of serverConfigs) {
      await collectServerTools(teammate, mcp, cfg, mcpFunctions);
    }
  } catch (error) {
    logger.error("Error setting up MCP functions", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return mcpFunctions;
}

async function collectServerTools(
  teammate: CompletionTeammate,
  mcp: MCPClientManager,
  cfg: MCPServerConfig,
  mcpFunctions: TeammateMCPToolDefinition[],
) {
  try {
    const readyConnection = await connectMCPServerReady(mcp, cfg);

    if ("error" in readyConnection) {
      logger.error("MCP connection failed", {
        server_url: cfg.url,
        error_message: readyConnection.error,
      });

      return;
    }

    const rawTools = await Promise.resolve(mcp.getAITools());
    const defs = Object.entries(rawTools);

    for (const [name, def] of defs) {
      const toolDefinition = resolveMCPAIToolDefinition(teammate.id, name, def);

      if (toolDefinition) {
        mcpFunctions.push(toolDefinition);
      }
    }
  } catch (error) {
    logger.error("Error connecting to MCP server", {
      server_url: cfg.url,
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
