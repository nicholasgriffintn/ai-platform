import { AgentRepository } from "~/repositories/AgentRepository";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export async function getUserAgents(env: IEnv, userId: number) {
	const repo = new AgentRepository(env);
	return await repo.getAgentsByUser(userId);
}

export async function getUserTeamAgents(env: IEnv, userId: number) {
	const repo = new AgentRepository(env);
	return await repo.getTeamAgents(userId);
}

export async function getAgentsByTeam(
	env: IEnv,
	teamId: string,
	userId: number,
) {
	const repo = new AgentRepository(env);
	return await repo.getAgentsByTeamAndUser(teamId, userId);
}

export async function getAgentById(env: IEnv, agentId: string, userId: number) {
	const repo = new AgentRepository(env);
	const agent = await repo.getAgentById(agentId);

	if (!agent) {
		throw new AssistantError("Agent not found", ErrorType.NOT_FOUND);
	}

	if (agent.user_id !== userId) {
		throw new AssistantError("Forbidden", ErrorType.AUTHENTICATION_ERROR);
	}

	return agent;
}

export async function createAgent(
	env: IEnv,
	user: IUser,
	params: {
		name: string;
		description: string;
		avatar_url?: string | null;
		servers?: any[];
		model: string;
		temperature: number;
		max_steps: number;
		system_prompt: string;
		few_shot_examples?: any[];
		team_id?: string;
		team_role?: string;
		is_team_agent?: boolean;
	},
) {
	const repo = new AgentRepository(env);
	return await repo.createAgent(
		user.id,
		params.name,
		params.description,
		params.avatar_url || null,
		params.servers || [],
		params.model,
		params.temperature,
		params.max_steps,
		params.system_prompt,
		params.few_shot_examples,
		params.team_id,
		params.team_role,
		params.is_team_agent,
	);
}

export async function updateAgent(
	env: IEnv,
	agentId: string,
	userId: number,
	updates: {
		name?: string;
		description?: string;
		avatar_url?: string | null;
		servers?: any[];
		model?: string;
		temperature?: number;
		max_steps?: number;
		system_prompt?: string;
		few_shot_examples?: any[];
		team_id?: string;
		team_role?: string;
		is_team_agent?: boolean;
	},
) {
	const agent = await getAgentById(env, agentId, userId);

	const repo = new AgentRepository(env);
	await repo.updateAgent(agentId, updates);

	return agent;
}

export async function deleteAgent(env: IEnv, agentId: string, userId: number) {
	const agent = await getAgentById(env, agentId, userId);

	const repo = new AgentRepository(env);
	await repo.deleteAgent(agentId);

	return { success: true };
}
