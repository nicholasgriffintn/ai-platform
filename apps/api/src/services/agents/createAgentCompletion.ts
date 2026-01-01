import { MCPClientManager } from "agents/mcp/client";

import { formatToolCalls } from "~/lib/chat/tools";
import {
	createServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import { getModelConfig } from "~/lib/providers/models";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import { registerMCPClient } from "~/services/functions/mcp";
import { add_reasoning_step } from "~/services/functions/reasoning";
import {
	delegateToTeamMember,
	delegateToTeamMemberByRole,
	getTeamMembers,
} from "~/services/functions/teamDelegation";
import type { ChatCompletionParameters, IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { safeParseJson } from "../../utils/json";

const logger = getLogger({ prefix: "services/agents/completions" });

export interface AgentCompletionParams {
	body: ChatCompletionParameters;
	agentId: string;
	user: IUser | undefined;
	anonymousUser: any;
}

export async function createAgentCompletion({
	env,
	context,
	body,
	agentId,
	user,
	anonymousUser,
}: {
	env: IEnv;
	context?: ServiceContext;
	body: ChatCompletionParameters;
	agentId: string;
	user: IUser | undefined;
	anonymousUser: any;
}) {
	const serviceContext =
		context ??
		createServiceContext({
			env,
			user,
		});

	serviceContext.ensureDatabase();

	const agent = await getValidatedAgent(serviceContext, agentId, user?.id);

	const mcpFunctions = await setupMCPFunctions(agent, serviceContext.env);

	const teamDelegationTools = setupTeamDelegationTools(agent);

	const functionSchemas = [
		{
			name: add_reasoning_step.name,
			description: add_reasoning_step.description,
			parameters: add_reasoning_step.parameters,
		},
		...teamDelegationTools,
		...mcpFunctions.map((fn) => ({
			name: fn.name,
			description: fn.description,
			parameters: fn.parameters,
		})),
	];

	const modelToUse = agent.model || body.model;
	const modelDetails = await getModelConfig(modelToUse);
	if (!modelDetails) {
		throw new AssistantError("Invalid model", ErrorType.PARAMS_ERROR);
	}

	const formattedTools = formatToolCalls(
		modelDetails.provider,
		functionSchemas,
	);

	let fewShotExamples;
	if (agent.few_shot_examples) {
		try {
			const rawFewShotExamples = safeParseJson(
				agent.few_shot_examples as string,
			);

			fewShotExamples = `
        Examples:
        ${rawFewShotExamples
					.map(
						(example: { input: string; output: string }) => `
          User: ${example.input}
          Assistant: ${example.output}
        `,
					)
					.join("\n")}
      `;
		} catch (error) {
			logger.error("Error parsing few-shot examples", {
				error_message: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	let systemPrompt = agent.system_prompt || "";
	if (fewShotExamples) {
		systemPrompt = `${systemPrompt}\n\n${fewShotExamples}`;
	}

	const requestParams: ChatCompletionParameters = {
		...body,
		system_prompt: systemPrompt,
		model: modelToUse,
		tools: formattedTools,
		stream: true,
		mode: "agent",
		max_steps: agent.max_steps || body.max_steps || 20,
		temperature:
			Number.parseFloat(agent.temperature) || body.temperature || 0.8,
		current_agent_id: agentId,
	};

	const response = await handleCreateChatCompletions({
		env: serviceContext.env,
		request: requestParams,
		user,
		anonymousUser,
		context: serviceContext,
	});

	return response;
}

async function setupMCPFunctions(agent: any, env: IEnv) {
	const mcpFunctions: Array<{
		name: string;
		description?: string;
		parameters: Record<string, any>;
	}> = [];

	if (!agent.servers) {
		return mcpFunctions;
	}

	let mcp: MCPClientManager | null = null;

	try {
		const serversJson = agent.servers as string;
		let serverConfigs = [];
		serverConfigs = safeParseJson(serversJson) as Array<{ url: string }>;
		if (!serverConfigs) {
			throw new AssistantError(
				"Invalid servers configuration",
				ErrorType.PARAMS_ERROR,
			);
		}

		if (serverConfigs && serverConfigs.length > 0) {
			if (!env.MCP_STORAGE) {
				throw new AssistantError(
					"MCP storage not configured",
					ErrorType.CONFIGURATION_ERROR,
				);
			}

			mcp = new MCPClientManager(agent.id, "1.0.0", {
				storage: env.MCP_STORAGE,
			});
			registerMCPClient(agent.id, mcp);

			for (const cfg of serverConfigs) {
				try {
					const { id } = await mcp.connect(cfg.url);

					if (!id) {
						logger.error("No ID returned from MCP connect");
						continue;
					}

					const connection = mcp.mcpConnections[id];

					if (!connection?.connectionState) {
						logger.error("No connection found for ID:", id);
						continue;
					}

					while (connection.connectionState !== "ready") {
						await new Promise((resolve) => setTimeout(resolve, 50));
					}

					const rawTools = (await mcp.unstable_getAITools()) as any;
					const defs = Object.entries(rawTools) as [string, any][];

					for (const [name, def] of defs) {
						const shortAgentId = agent.id.substring(0, 8);
						const toolName = `mcp_${shortAgentId}_${name}`;

						if (
							!def.parameters ||
							(!def.parameters.properties &&
								!def.parameters.jsonSchema.properties)
						) {
							continue;
						}

						mcpFunctions.push({
							name: toolName,
							description: def.description as string,
							parameters: def.parameters as Record<string, any>,
						});
					}
				} catch (error) {
					logger.error("Error connecting to MCP server", {
						server_url: cfg.url,
						error_message:
							error instanceof Error ? error.message : "Unknown error",
					});
				}
			}
		}
	} catch (error) {
		logger.error("Error setting up MCP functions", {
			error_message: error instanceof Error ? error.message : "Unknown error",
		});
	}

	return mcpFunctions;
}

function setupTeamDelegationTools(agent: any) {
	if (agent.team_role !== "orchestrator") {
		return [];
	}

	return [
		{
			name: delegateToTeamMember.name,
			description: delegateToTeamMember.description,
			parameters: delegateToTeamMember.parameters,
		},
		{
			name: delegateToTeamMemberByRole.name,
			description: delegateToTeamMemberByRole.description,
			parameters: delegateToTeamMemberByRole.parameters,
		},
		{
			name: getTeamMembers.name,
			description: getTeamMembers.description,
			parameters: getTeamMembers.parameters,
		},
	];
}

async function getValidatedAgent(
	context: ServiceContext,
	agentId: string,
	userId?: number,
) {
	const repo = context.repositories.agents;
	const agent = await repo.getAgentById(agentId);

	if (!agent) {
		throw new AssistantError("Agent not found", ErrorType.NOT_FOUND);
	}

	if (userId && agent.user_id !== userId) {
		throw new AssistantError("Forbidden", ErrorType.AUTHENTICATION_ERROR);
	}

	return agent;
}
