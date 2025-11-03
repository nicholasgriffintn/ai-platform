import type { Agent } from "~/lib/database/schema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { BaseRepository } from "./BaseRepository";

export class AgentRepository extends BaseRepository {
	public async createAgent(
		userId: number,
		name: string,
		description: string,
		avatarUrl: string | null,
		servers?: any[],
		model?: string,
		temperature?: number,
		maxSteps?: number,
		systemPrompt?: string,
		fewShotExamples?: any[],
		teamId?: string | null,
		teamRole?: string | null,
		isTeamAgent?: boolean,
	): Promise<Agent> {
		const id = generateId();
		const insert = this.buildInsertQuery(
			"agents",
			{
				id,
				user_id: userId,
				name,
				description,
				avatar_url: avatarUrl ?? null,
				servers: servers ?? null,
				model: model ?? null,
				temperature:
					temperature !== undefined && temperature !== null
						? temperature.toString()
						: null,
				max_steps: maxSteps ?? null,
				system_prompt: systemPrompt ?? null,
				few_shot_examples: fewShotExamples ?? null,
				team_id: teamId ?? null,
				team_role: teamRole ?? null,
				is_team_agent: isTeamAgent ? 1 : 0,
			},
			{ jsonFields: ["servers", "few_shot_examples"], returning: "*" },
		);

		if (!insert) {
			throw new AssistantError(
				"Failed to build agent insert query",
				ErrorType.INTERNAL_ERROR,
			);
		}

		const created = await this.runQuery<Agent>(insert.query, insert.values, true);

		if (!created) {
			throw new AssistantError(
				"Failed to insert agent",
				ErrorType.INTERNAL_ERROR,
			);
		}

		return created;
	}

	public async getAgentsByUser(userId: number): Promise<Agent[]> {
		const { query, values } = this.buildSelectQuery(
			"agents",
			{ user_id: userId },
			{ orderBy: "created_at DESC" },
		);
		return this.runQuery<Agent>(query, values);
	}

	public async getAgentById(agentId: string): Promise<Agent | null> {
		const { query, values } = this.buildSelectQuery("agents", { id: agentId });
		return this.runQuery<Agent>(query, values, true);
	}

	public async updateAgent(
		agentId: string,
		data: Partial<{
			name: string;
			description: string;
			avatar_url: string;
			servers: any[];
			model: string;
			temperature: number;
			max_steps: number;
			system_prompt: string;
			few_shot_examples: any[];
			team_id: string;
			team_role: string;
			is_team_agent: boolean;
		}>,
	): Promise<void> {
		const allowedFields = [
			"name",
			"description",
			"avatar_url",
			"servers",
			"model",
			"temperature",
			"max_steps",
			"system_prompt",
			"few_shot_examples",
			"team_id",
			"team_role",
			"is_team_agent",
		];

		const result = this.buildUpdateQuery(
			"agents",
			data,
			allowedFields,
			"id = ?",
			[agentId],
			{
				jsonFields: ["servers", "few_shot_examples"],
				transformer: (field, value) => {
					if (field === "temperature" && value !== undefined && value !== null) {
						return value.toString();
					}
					if (field === "is_team_agent" && typeof value === "boolean") {
						return value ? 1 : 0;
					}
					return value;
				},
			},
		);

		if (!result) {
			return;
		}

		const queryWithTimestamp = result.query.replace(
			"updated_at = datetime('now')",
			"updated_at = CURRENT_TIMESTAMP",
		);

		await this.executeRun(queryWithTimestamp, result.values);
	}

	public async deleteAgent(agentId: string): Promise<void> {
		const { query, values } = this.buildDeleteQuery("agents", { id: agentId });
		if (!query) {
			return;
		}
		await this.executeRun(query, values);
	}

	public async createTeamAgent(
		userId: number,
		teamId: string,
		teamRole: string,
		name: string,
		description: string,
		avatarUrl: string | null,
		servers?: any[],
		model?: string,
		temperature?: number,
		maxSteps?: number,
		systemPrompt?: string,
		fewShotExamples?: any[],
	): Promise<Agent> {
		return this.createAgent(
			userId,
			name,
			description,
			avatarUrl,
			servers,
			model,
			temperature,
			maxSteps,
			systemPrompt,
			fewShotExamples,
			teamId,
			teamRole,
			true,
		);
	}

	public async getTeamAgents(userId: number): Promise<Agent[]> {
		const { query, values } = this.buildSelectQuery(
			"agents",
			{ user_id: userId, is_team_agent: 1 },
			{ orderBy: "created_at DESC" },
		);
		return this.runQuery<Agent>(query, values);
	}

	public async getAgentsByTeam(teamId: string): Promise<Agent[]> {
		const { query, values } = this.buildSelectQuery(
			"agents",
			{ team_id: teamId },
			{ orderBy: "created_at DESC" },
		);
		return this.runQuery<Agent>(query, values);
	}

	public async getAgentsByTeamAndUser(
		teamId: string,
		userId: number,
	): Promise<Agent[]> {
		const { query, values } = this.buildSelectQuery(
			"agents",
			{ team_id: teamId, user_id: userId },
			{ orderBy: "created_at DESC" },
		);
		return this.runQuery<Agent>(query, values);
	}
}
