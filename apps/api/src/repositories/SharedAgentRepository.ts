import type {
	Agent,
	AgentInstall,
	AgentRating,
	SharedAgent,
} from "~/lib/database/schema";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { AssistantError, ErrorType } from "~/utils/errors";
import { BaseRepository } from "./BaseRepository";
import { safeParseJson } from "~/utils/json";

const logger = getLogger({ prefix: "repositories/SharedAgentRepository" });

export interface SharedAgentWithAuthor extends SharedAgent {
	author_name: string;
	author_avatar_url: string | null;
}

export interface CreateSharedAgentParams {
	agentId: string;
	name: string;
	description?: string;
	avatarUrl?: string;
	category?: string;
	tags?: string[];
}

export interface SharedAgentFilters {
	category?: string;
	tags?: string[];
	search?: string;
	featured?: boolean;
	limit?: number;
	offset?: number;
	sortBy?: "recent" | "popular" | "rating";
}

export class SharedAgentRepository extends BaseRepository {
	public async shareAgent(
		userId: number,
		params: CreateSharedAgentParams,
	): Promise<SharedAgent> {
		const { query: agentQuery, values: agentValues } = this.buildSelectQuery(
			"agents",
			{ id: params.agentId, user_id: userId },
		);
		const agent = await this.runQuery<Agent>(agentQuery, agentValues, true);

		if (!agent) {
			throw new AssistantError(
				"Agent not found or unauthorized",
				ErrorType.NOT_FOUND,
			);
		}

		const { query: existingSharedQuery, values: existingSharedValues } =
			this.buildSelectQuery("shared_agents", { agent_id: params.agentId });
		const existingShared = await this.runQuery<SharedAgent>(
			existingSharedQuery,
			existingSharedValues,
			true,
		);

		if (existingShared) {
			throw new AssistantError(
				"Agent is already shared",
				ErrorType.CONFLICT_ERROR,
			);
		}

		const id = generateId();
		const templateData = {
			name: agent.name,
			description: agent.description,
			avatar_url: agent.avatar_url,
			servers: agent.servers ? safeParseJson(agent.servers as string) : [],
			model: agent.model,
			temperature: agent.temperature,
			max_steps: agent.max_steps,
			system_prompt: agent.system_prompt,
			few_shot_examples: agent.few_shot_examples
				? safeParseJson(agent.few_shot_examples as string)
				: [],
			enabled_tools: agent.enabled_tools
				? safeParseJson(agent.enabled_tools as string)
				: [],
		};

		await this.executeRun(
			`INSERT INTO shared_agents 
       (id, agent_id, user_id, name, description, avatar_url, category, tags, template_data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				params.agentId,
				userId,
				params.name,
				params.description || "",
				params.avatarUrl || null,
				params.category || null,
				params.tags ? JSON.stringify(params.tags) : null,
				JSON.stringify(templateData),
			],
		);

		const now = new Date().toISOString();
		return {
			id,
			agent_id: params.agentId,
			user_id: userId,
			name: params.name,
			description: params.description || "",
			avatar_url: params.avatarUrl || null,
			category: params.category || null,
			tags: params.tags ? JSON.stringify(params.tags) : null,
			is_featured: false,
			is_public: true,
			usage_count: 0,
			rating_count: 0,
			rating_average: "0",
			template_data: JSON.stringify(templateData),
			created_at: now,
			updated_at: now,
		};
	}

	public async getSharedAgents(
		filters: SharedAgentFilters = {},
	): Promise<SharedAgentWithAuthor[]> {
		let query = `
      SELECT
        sa.id, sa.agent_id, sa.user_id, sa.name, sa.description, sa.avatar_url,
        sa.category, sa.tags, sa.is_featured, sa.is_public, sa.usage_count,
        sa.rating_count, sa.rating_average, sa.template_data, sa.created_at, sa.updated_at,
        u.name as author_name, u.avatar_url as author_avatar_url
      FROM shared_agents sa
      JOIN user u ON sa.user_id = u.id
      WHERE sa.is_public = 1
    `;
		const params: any[] = [];

		if (filters.category) {
			query += " AND sa.category = ?";
			params.push(filters.category);
		}

		if (filters.featured) {
			query += " AND sa.is_featured = 1";
		}

		if (filters.search) {
			query += " AND (sa.name LIKE ? OR sa.description LIKE ?)";
			params.push(`%${filters.search}%`, `%${filters.search}%`);
		}

		if (filters.tags && filters.tags.length > 0) {
			const tagConditions = filters.tags
				.map(() => "sa.tags LIKE ?")
				.join(" OR ");
			query += ` AND (${tagConditions})`;
			for (const tag of filters.tags) {
				params.push(`%"${tag}"%`);
			}
		}

		switch (filters.sortBy) {
			case "popular":
				query += " ORDER BY sa.usage_count DESC, sa.created_at DESC";
				break;
			case "rating":
				query +=
					" ORDER BY CAST(sa.rating_average AS REAL) DESC, sa.rating_count DESC, sa.created_at DESC";
				break;
			default:
				query += " ORDER BY sa.created_at DESC";
		}

		if (filters.limit) {
			query += " LIMIT ?";
			params.push(filters.limit);
		}

		if (filters.offset) {
			query += " OFFSET ?";
			params.push(filters.offset);
		}

		return this.runQuery<SharedAgentWithAuthor>(query, params);
	}

	public async getFeaturedAgents(limit = 10): Promise<SharedAgentWithAuthor[]> {
		return this.getSharedAgents({ featured: true, limit, sortBy: "popular" });
	}

	public async getSharedAgentById(
		id: string,
	): Promise<SharedAgentWithAuthor | null> {
		return this.runQuery<SharedAgentWithAuthor>(
			`SELECT
         sa.id, sa.agent_id, sa.user_id, sa.name, sa.description, sa.avatar_url,
         sa.category, sa.tags, sa.is_featured, sa.is_public, sa.usage_count,
         sa.rating_count, sa.rating_average, sa.template_data, sa.created_at, sa.updated_at,
         u.name as author_name, u.avatar_url as author_avatar_url
       FROM shared_agents sa
       JOIN user u ON sa.user_id = u.id
       WHERE sa.id = ?`,
			[id],
			true,
		);
	}

	public async getSharedAgentByAgentId(
		agentId: string,
	): Promise<SharedAgent | null> {
		return this.runQuery<SharedAgent>(
			`SELECT
         id, agent_id, user_id, name, description, avatar_url,
         category, tags, is_featured, is_public, usage_count,
         rating_count, rating_average, template_data, created_at, updated_at
       FROM shared_agents WHERE agent_id = ?`,
			[agentId],
			true,
		);
	}

	public async getAllSharedAgentsForAdmin(
		filters: SharedAgentFilters = {},
	): Promise<SharedAgentWithAuthor[]> {
		let query = `
      SELECT
        sa.id, sa.agent_id, sa.user_id, sa.name, sa.description, sa.avatar_url,
        sa.category, sa.tags, sa.is_featured, sa.is_public, sa.usage_count,
        sa.rating_count, sa.rating_average, sa.template_data, sa.created_at, sa.updated_at,
        u.name as author_name, u.avatar_url as author_avatar_url
      FROM shared_agents sa
      JOIN user u ON sa.user_id = u.id
    `;
		const params: any[] = [];

		if (filters.category) {
			query += " WHERE sa.category = ?";
			params.push(filters.category);
		}

		if (filters.featured) {
			query += filters.category ? " AND" : " WHERE";
			query += " sa.is_featured = 1";
		}

		if (filters.search) {
			const hasWhere = filters.category || filters.featured;
			query += hasWhere ? " AND" : " WHERE";
			query += " (sa.name LIKE ? OR sa.description LIKE ?)";
			params.push(`%${filters.search}%`, `%${filters.search}%`);
		}

		if (filters.tags && filters.tags.length > 0) {
			const hasWhere = filters.category || filters.featured || filters.search;
			query += hasWhere ? " AND" : " WHERE";
			const tagConditions = filters.tags
				.map(() => "sa.tags LIKE ?")
				.join(" OR ");
			query += ` (${tagConditions})`;
			for (const tag of filters.tags) {
				params.push(`%"${tag}"%`);
			}
		}

		switch (filters.sortBy) {
			case "popular":
				query += " ORDER BY sa.usage_count DESC, sa.created_at DESC";
				break;
			case "rating":
				query +=
					" ORDER BY CAST(sa.rating_average AS REAL) DESC, sa.rating_count DESC, sa.created_at DESC";
				break;
			default:
				query += " ORDER BY sa.created_at DESC";
		}

		if (filters.limit) {
			query += " LIMIT ?";
			params.push(filters.limit);
		}

		if (filters.offset) {
			query += " OFFSET ?";
			params.push(filters.offset);
		}

		return this.runQuery<SharedAgentWithAuthor>(query, params);
	}

	public async installAgent(
		userId: number,
		sharedAgentId: string,
	): Promise<{ agent: Agent; install: AgentInstall }> {
		const sharedAgent = await this.getSharedAgentById(sharedAgentId);
		if (!sharedAgent) {
			throw new AssistantError("Shared agent not found", ErrorType.NOT_FOUND);
		}

		const existingInstall = await this.runQuery<AgentInstall>(
			"SELECT * FROM agent_installs WHERE shared_agent_id = ? AND user_id = ?",
			[sharedAgentId, userId],
			true,
		);

		if (existingInstall) {
			throw new AssistantError(
				"Agent already installed",
				ErrorType.CONFLICT_ERROR,
			);
		}

		if (!sharedAgent.template_data) {
			throw new AssistantError("Template data not found", ErrorType.NOT_FOUND);
		}

		let templateData = safeParseJson(sharedAgent.template_data as string);
		if (!templateData) {
			logger.error(
				"Error parsing template data:",
				{ error: "" },
				sharedAgent.template_data,
			);
			throw new AssistantError(
				"Error parsing template data",
				ErrorType.PARAMS_ERROR,
			);
		}

		if (templateData.team_id) {
			throw new AssistantError(
				"Team agents are not supported for sharing yet. Please contact support.",
				ErrorType.PARAMS_ERROR,
			);
		}

		const agentId = generateId();
		const installId = generateId();

		await this.executeRun(
			`INSERT INTO agents 
       (id, user_id, name, description, avatar_url, servers, model, temperature, max_steps, system_prompt, few_shot_examples, enabled_tools) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				agentId,
				userId,
				templateData.name,
				templateData.description,
				templateData.avatar_url,
				JSON.stringify(templateData.servers),
				templateData.model,
				templateData.temperature,
				templateData.max_steps,
				templateData.system_prompt,
				JSON.stringify(templateData.few_shot_examples),
				JSON.stringify(templateData.enabled_tools ?? []),
			],
		);

		await this.executeRun(
			"INSERT INTO agent_installs (id, shared_agent_id, user_id, agent_id) VALUES (?, ?, ?, ?)",
			[installId, sharedAgentId, userId, agentId],
		);

		await this.executeRun(
			"UPDATE shared_agents SET usage_count = usage_count + 1 WHERE id = ?",
			[sharedAgentId],
		);

		const now = new Date().toISOString();
		// TODO: Make team agents sharable
		const agent: Agent = {
			id: agentId,
			user_id: userId,
			name: templateData.name,
			description: templateData.description,
			avatar_url: templateData.avatar_url,
			servers: JSON.stringify(templateData.servers),
			model: templateData.model,
			temperature: templateData.temperature,
			max_steps: templateData.max_steps,
			system_prompt: templateData.system_prompt,
			few_shot_examples: JSON.stringify(templateData.few_shot_examples),
			enabled_tools: JSON.stringify(templateData.enabled_tools ?? []),
			is_team_agent: false,
			team_id: null,
			team_role: null,
			created_at: now,
			updated_at: now,
		};

		const install: AgentInstall = {
			id: installId,
			shared_agent_id: sharedAgentId,
			user_id: userId,
			agent_id: agentId,
			created_at: now,
		};

		return { agent, install };
	}

	public async uninstallAgent(userId: number, agentId: string): Promise<void> {
		const install = await this.runQuery<AgentInstall>(
			"SELECT * FROM agent_installs WHERE agent_id = ? AND user_id = ?",
			[agentId, userId],
			true,
		);

		if (!install) {
			throw new AssistantError(
				"Agent not installed by user",
				ErrorType.NOT_FOUND,
			);
		}

		const sharedAgent = await this.runQuery<SharedAgent>(
			"SELECT * FROM shared_agents WHERE id = ?",
			[install.shared_agent_id],
			true,
		);

		if (!sharedAgent) {
			throw new AssistantError("Shared agent not found", ErrorType.NOT_FOUND);
		}

		await this.executeRun("DELETE FROM agent_installs WHERE id = ?", [
			install.id,
		]);

		await this.executeRun(
			"UPDATE shared_agents SET usage_count = usage_count - 1 WHERE id = ?",
			[sharedAgent.id],
		);
	}

	public async rateAgent(
		userId: number,
		sharedAgentId: string,
		rating: number,
		review?: string,
	): Promise<AgentRating> {
		if (rating < 1 || rating > 5) {
			throw new AssistantError(
				"Rating must be between 1 and 5",
				ErrorType.PARAMS_ERROR,
			);
		}

		const sharedAgent = await this.getSharedAgentById(sharedAgentId);
		if (!sharedAgent) {
			throw new AssistantError("Shared agent not found", ErrorType.NOT_FOUND);
		}

		const existingRating = await this.runQuery<AgentRating>(
			"SELECT * FROM agent_ratings WHERE shared_agent_id = ? AND user_id = ?",
			[sharedAgentId, userId],
			true,
		);

		const id = existingRating?.id || generateId();
		const now = new Date().toISOString();

		if (existingRating) {
			await this.executeRun(
				"UPDATE agent_ratings SET rating = ?, review = ?, updated_at = ? WHERE id = ?",
				[rating, review || null, now, id],
			);
		} else {
			await this.executeRun(
				"INSERT INTO agent_ratings (id, shared_agent_id, user_id, rating, review) VALUES (?, ?, ?, ?, ?)",
				[id, sharedAgentId, userId, rating, review || null],
			);
		}

		const ratingStats = await this.runQuery<{ count: number; average: number }>(
			"SELECT COUNT(*) as count, AVG(rating) as average FROM agent_ratings WHERE shared_agent_id = ?",
			[sharedAgentId],
			true,
		);

		await this.executeRun(
			"UPDATE shared_agents SET rating_count = ?, rating_average = ? WHERE id = ?",
			[
				ratingStats?.count || 0,
				(ratingStats?.average || 0).toFixed(1),
				sharedAgentId,
			],
		);

		return {
			id,
			shared_agent_id: sharedAgentId,
			user_id: userId,
			rating,
			review: review || null,
			created_at: existingRating?.created_at || now,
			updated_at: now,
		};
	}

	public async getAgentRatings(
		sharedAgentId: string,
		limit = 10,
	): Promise<(AgentRating & { author_name: string })[]> {
		return this.runQuery<AgentRating & { author_name: string }>(
			`SELECT ar.*, u.name as author_name
       FROM agent_ratings ar
       JOIN user u ON ar.user_id = u.id
       WHERE ar.shared_agent_id = ?
       ORDER BY ar.created_at DESC
       LIMIT ?`,
			[sharedAgentId, limit],
		);
	}

	public async updateSharedAgent(
		userId: number,
		sharedAgentId: string,
		updates: Partial<
			Pick<
				SharedAgent,
				"name" | "description" | "avatar_url" | "category" | "tags"
			>
		>,
	): Promise<void> {
		const { query, values } = this.buildSelectQuery("shared_agents", {
			id: sharedAgentId,
			user_id: userId,
		});
		const sharedAgent = await this.runQuery<SharedAgent>(query, values, true);

		if (!sharedAgent) {
			throw new AssistantError(
				"Shared agent not found or unauthorized",
				ErrorType.NOT_FOUND,
			);
		}

		const allowedFields = [
			"name",
			"description",
			"avatar_url",
			"category",
			"tags",
		] as const;

		const result = this.buildUpdateQuery(
			"shared_agents",
			updates,
			[...allowedFields],
			"id = ?",
			[sharedAgentId],
			{
				jsonFields: ["tags"],
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

	public async deleteSharedAgent(
		userId: number,
		sharedAgentId: string,
	): Promise<void> {
		const { query, values } = this.buildSelectQuery("shared_agents", {
			id: sharedAgentId,
			user_id: userId,
		});
		const sharedAgent = await this.runQuery<SharedAgent>(query, values, true);

		if (!sharedAgent) {
			throw new AssistantError(
				"Shared agent not found or unauthorized",
				ErrorType.NOT_FOUND,
			);
		}

		const deleteRatings = this.buildDeleteQuery("agent_ratings", {
			shared_agent_id: sharedAgentId,
		});
		if (deleteRatings.query) {
			await this.executeRun(deleteRatings.query, deleteRatings.values);
		}

		const deleteInstalls = this.buildDeleteQuery("agent_installs", {
			shared_agent_id: sharedAgentId,
		});
		if (deleteInstalls.query) {
			await this.executeRun(deleteInstalls.query, deleteInstalls.values);
		}

		const deleteSharedAgent = this.buildDeleteQuery("shared_agents", {
			id: sharedAgentId,
		});
		if (deleteSharedAgent.query) {
			await this.executeRun(deleteSharedAgent.query, deleteSharedAgent.values);
		}
	}

	public async setFeatured(
		sharedAgentId: string,
		featured: boolean,
	): Promise<void> {
		await this.executeRun(
			"UPDATE shared_agents SET is_featured = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
			[featured ? 1 : 0, sharedAgentId],
		);
	}

	public async moderateAgent(
		sharedAgentId: string,
		isPublic: boolean,
	): Promise<void> {
		await this.executeRun(
			"UPDATE shared_agents SET is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
			[isPublic ? 1 : 0, sharedAgentId],
		);
	}

	public async getCategories(): Promise<string[]> {
		const results = await this.runQuery<{ category: string }>(
			"SELECT DISTINCT category FROM shared_agents WHERE category IS NOT NULL AND is_public = 1 ORDER BY category",
			[],
		);
		return results.map((r) => r.category);
	}

	public async getPopularTags(limit = 20): Promise<string[]> {
		const results = await this.runQuery<{ tags: string }>(
			"SELECT tags FROM shared_agents WHERE tags IS NOT NULL AND is_public = 1",
			[],
		);

		const tagCounts: { [key: string]: number } = {};
		for (const result of results) {
			try {
				const tags = safeParseJson(result.tags) as string[];
				for (const tag of tags) {
					tagCounts[tag] = (tagCounts[tag] || 0) + 1;
				}
			} catch (e) {
				logger.error("Error parsing tags:", { error: "", tags: result.tags });
			}
		}

		return Object.entries(tagCounts)
			.sort(([, a], [, b]) => b - a)
			.slice(0, limit)
			.map(([tag]) => tag);
	}
}

// Re-export types for use in services
export type { SharedAgent, AgentInstall, AgentRating };
