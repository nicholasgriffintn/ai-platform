import type { MCPClientManager } from "agents/mcp/client";

import type { Agent } from "~/lib/database/schema";
import { registerMCPClient } from "~/services/functions/mcp";
import { add_reasoning_step } from "~/services/functions/reasoning";
import { compose_functions, if_then_else, parallel_execute } from "~/services/functions/workflow";
import { request_approval, ask_user } from "~/services/functions/human_in_the_loop";
import { retry_with_backoff, fallback } from "~/services/functions/error_recovery";
import { search_functions, get_function_schema } from "~/services/functions/discovery";
import {
	delegateToTeamMember,
	delegateToTeamMemberByRole,
	getTeamMembers,
} from "~/services/functions/teamDelegation";
import {
	connectMCPServerReady,
	parseMCPServerConfigs,
	resolveMCPAIToolDefinition,
	type AgentMCPToolDefinition,
	type MCPServerConfig,
} from "~/services/agents/mcp-client";
import type { ApiToolDefinition } from "~/services/functions/types";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/agents/completion-tools" });

const CORE_AGENT_TOOLS: ApiToolDefinition[] = [
	add_reasoning_step,
	compose_functions,
	if_then_else,
	parallel_execute,
	request_approval,
	ask_user,
	retry_with_backoff,
	fallback,
	search_functions,
	get_function_schema,
];

type CompletionAgent = Pick<
	Agent,
	"id" | "servers" | "system_prompt" | "few_shot_examples" | "team_role"
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
	env: IEnv,
): Promise<AgentCompletionToolDefinition[]> {
	const mcpFunctions = await setupMCPFunctions(agent, env);
	const teamDelegationTools = setupTeamDelegationTools(agent);

	return [...CORE_AGENT_TOOLS, ...teamDelegationTools, ...mcpFunctions];
}

export function buildAgentSystemPrompt(agent: CompletionAgent): string {
	const fewShotExamples = formatFewShotExamples(agent.few_shot_examples);
	const systemPrompt = agent.system_prompt || "";

	return fewShotExamples ? `${systemPrompt}\n\n${fewShotExamples}` : systemPrompt;
}

function formatFewShotExamples(rawExamples: unknown): string {
	if (!rawExamples) {
		return "";
	}

	try {
		const parsed = typeof rawExamples === "string" ? safeParseJson(rawExamples) : rawExamples;
		if (!Array.isArray(parsed)) {
			return "";
		}

		const examples = parsed
			.filter(
				(example): example is { input: string; output: string } =>
					typeof example === "object" &&
					example !== null &&
					typeof (example as { input?: unknown }).input === "string" &&
					typeof (example as { output?: unknown }).output === "string",
			)
			.map(
				(example) => `
          User: ${example.input}
          Assistant: ${example.output}
        `,
			)
			.join("\n");

		return examples
			? `
        Examples:
        ${examples}
      `
			: "";
	} catch (error) {
		logger.error("Error parsing few-shot examples", {
			error_message: error instanceof Error ? error.message : "Unknown error",
		});
		return "";
	}
}

async function setupMCPFunctions(agent: CompletionAgent, env: IEnv) {
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

		if (!env.MCP_STORAGE) {
			throw new AssistantError("MCP storage not configured", ErrorType.CONFIGURATION_ERROR);
		}

		const { MCPClientManager } = await import("agents/mcp/client");

		mcp = new MCPClientManager(agent.id, "1.0.0", {
			storage: env.MCP_STORAGE,
		});
		registerMCPClient(agent.id, mcp);

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

		const rawTools = await mcp.getAITools();
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

function setupTeamDelegationTools(agent: CompletionAgent): ApiToolDefinition[] {
	if (agent.team_role !== "orchestrator") {
		return [];
	}

	return [delegateToTeamMember, delegateToTeamMemberByRole, getTeamMembers];
}
