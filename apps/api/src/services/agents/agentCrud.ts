import type { ServiceContext } from "~/lib/context/serviceContext";
import type { IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export async function getUserAgents(context: ServiceContext, userId?: number) {
	context.ensureDatabase();
	const id = userId ?? context.requireUser().id;
	return context.repositories.agents.getAgentsByUser(id);
}

export async function getUserTeamAgents(
	context: ServiceContext,
	userId?: number,
) {
	context.ensureDatabase();
	const id = userId ?? context.requireUser().id;
	return context.repositories.agents.getTeamAgents(id);
}

export async function getAgentsByTeam(
	context: ServiceContext,
	teamId: string,
	userId?: number,
) {
	context.ensureDatabase();
	const id = userId ?? context.requireUser().id;
	return context.repositories.agents.getAgentsByTeamAndUser(teamId, id);
}

export async function getAgentById(
	context: ServiceContext,
	agentId: string,
	userId?: number,
) {
	context.ensureDatabase();
	const id = userId ?? context.requireUser().id;
	const agent = await context.repositories.agents.getAgentById(agentId);

	if (!agent) {
		throw new AssistantError("Agent not found", ErrorType.NOT_FOUND);
	}

	if (agent.user_id !== id) {
		throw new AssistantError("Forbidden", ErrorType.AUTHENTICATION_ERROR);
	}

	return agent;
}

interface CreateAgentParams {
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
}

export async function createAgent(
	context: ServiceContext,
	params: CreateAgentParams,
	user?: IUser,
) {
	context.ensureDatabase();
	const currentUser = user ?? context.requireUser();

	return context.repositories.agents.createAgent(
		currentUser.id,
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

interface UpdateAgentParams {
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
}

export async function updateAgent(
	context: ServiceContext,
	agentId: string,
	updates: UpdateAgentParams,
	userId?: number,
) {
	context.ensureDatabase();
	const id = userId ?? context.requireUser().id;

	const agent = await getAgentById(context, agentId, id);

	await context.repositories.agents.updateAgent(agentId, updates);

	return agent;
}

export async function deleteAgent(
	context: ServiceContext,
	agentId: string,
	userId?: number,
) {
	context.ensureDatabase();
	const id = userId ?? context.requireUser().id;

	await getAgentById(context, agentId, id);
	await context.repositories.agents.deleteAgent(agentId);

	return { success: true };
}
