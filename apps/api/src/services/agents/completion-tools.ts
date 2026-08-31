import type { MCPClientManager } from "agents/mcp/client";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { Agent } from "~/lib/database/schema";
import { readAgentSkillIds } from "~/services/agents/agentResponse";
import {
  connectMCPServerReady,
  parseMCPServerConfigs,
  resolveMCPAIToolDefinition,
  type AgentMCPToolDefinition,
  type MCPServerConfig,
} from "~/services/agents/mcp-client";
import { request_approval, ask_user } from "~/services/functions/human_in_the_loop";
import { registerMCPClient } from "~/services/functions/mcp";
import type { AssistantPersona, AssistantPersonaExample } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/agents/completion-tools" });

const CORE_AGENT_TOOLS: ApiToolDefinition[] = [request_approval, ask_user];

type CompletionAgent = Pick<
  Agent,
  "id" | "servers" | "system_prompt" | "few_shot_examples" | "skill_ids"
>;

export type AgentCompletionToolDefinition =
  | ApiToolDefinition
  | {
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    };

export async function buildAgentCompletionTools(
  agent: CompletionAgent,
  context: ServiceContext,
): Promise<AgentCompletionToolDefinition[]> {
  const mcpFunctions = await setupMCPFunctions(agent, context);

  return [...CORE_AGENT_TOOLS, ...mcpFunctions];
}

export function buildAgentPersona(agent: CompletionAgent): AssistantPersona {
  return {
    instructions: buildPersonaInstructions(agent),
    examples: parseFewShotExamples(agent.few_shot_examples),
  };
}

function buildPersonaInstructions(agent: CompletionAgent): string | undefined {
  const skillIds = readAgentSkillIds(agent.skill_ids);
  const sections = [
    agent.system_prompt?.trim() || undefined,
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

async function setupMCPFunctions(agent: CompletionAgent, context: ServiceContext) {
  const mcpFunctions: AgentMCPToolDefinition[] = [];

  if (!agent.servers) {
    return mcpFunctions;
  }

  let mcp: MCPClientManager | null = null;

  try {
    const serverConfigs = parseMCPServerConfigs(agent.servers);

    if (serverConfigs.length === 0) {
      return mcpFunctions;
    }

    if (!context.env.MCP_STORAGE) {
      throw new AssistantError("MCP storage not configured", ErrorType.CONFIGURATION_ERROR);
    }

    const { MCPClientManager } = await import("agents/mcp/client");

    mcp = new MCPClientManager(agent.id, "1.0.0", {
      storage: context.env.MCP_STORAGE,
    });
    await registerMCPClient(context, agent.id, mcp);

    for (const cfg of serverConfigs) {
      await collectServerTools(agent, mcp, cfg, mcpFunctions);
    }
  } catch (error) {
    logger.error("Error setting up MCP functions", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return mcpFunctions;
}

async function collectServerTools(
  agent: CompletionAgent,
  mcp: MCPClientManager,
  cfg: MCPServerConfig,
  mcpFunctions: AgentMCPToolDefinition[],
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
      const toolDefinition = resolveMCPAIToolDefinition(agent.id, name, def);

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
