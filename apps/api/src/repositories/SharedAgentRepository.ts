import type {
  Agent,
  AgentInstall,
  AgentRating,
  SharedAgent,
} from "~/lib/database/schema";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { BaseRepository } from "./BaseRepository";

const logger = getLogger({ prefix: "REPOSITORIES:SHARED_AGENT" });

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
    const agent = await this.runQuery<Agent>(
      "SELECT * FROM agents WHERE id = ? AND user_id = ?",
      [params.agentId, userId],
      true,
    );

    if (!agent) {
      throw new Error("Agent not found or unauthorized");
    }

    const existingShared = await this.runQuery<SharedAgent>(
      "SELECT * FROM shared_agents WHERE agent_id = ?",
      [params.agentId],
      true,
    );

    if (existingShared) {
      throw new Error("Agent is already shared");
    }

    const id = generateId();
    const templateData = {
      name: agent.name,
      description: agent.description,
      avatar_url: agent.avatar_url,
      servers: agent.servers ? JSON.parse(agent.servers as string) : [],
      model: agent.model,
      temperature: agent.temperature,
      max_steps: agent.max_steps,
      system_prompt: agent.system_prompt,
      few_shot_examples: agent.few_shot_examples
        ? JSON.parse(agent.few_shot_examples as string)
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
      SELECT sa.*, u.name as author_name, u.avatar_url as author_avatar_url
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
      `SELECT sa.*, u.name as author_name, u.avatar_url as author_avatar_url
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
      "SELECT * FROM shared_agents WHERE agent_id = ?",
      [agentId],
      true,
    );
  }

  public async getAllSharedAgentsForAdmin(
    filters: SharedAgentFilters = {},
  ): Promise<SharedAgentWithAuthor[]> {
    let query = `
      SELECT sa.*, u.name as author_name, u.avatar_url as author_avatar_url
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
      throw new Error("Shared agent not found");
    }

    const existingInstall = await this.runQuery<AgentInstall>(
      "SELECT * FROM agent_installs WHERE shared_agent_id = ? AND user_id = ?",
      [sharedAgentId, userId],
      true,
    );

    if (existingInstall) {
      throw new Error("Agent already installed");
    }

    const templateData = JSON.parse(sharedAgent.template_data as string);

    if (templateData.team_id) {
      throw new Error(
        "Team agents are not supported for sharing yet. Please contact support.",
      );
    }

    const agentId = generateId();
    const installId = generateId();

    await this.executeBatch([
      {
        sql: `INSERT INTO agents 
       (id, user_id, name, description, avatar_url, servers, model, temperature, max_steps, system_prompt, few_shot_examples) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
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
        ],
      },
      {
        sql: "INSERT INTO agent_installs (id, shared_agent_id, user_id, agent_id) VALUES (?, ?, ?, ?)",
        params: [installId, sharedAgentId, userId, agentId],
      },
      {
        sql: "UPDATE shared_agents SET usage_count = usage_count + 1 WHERE id = ?",
        params: [sharedAgentId],
      },
    ]);

    const now = new Date().toISOString();
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
      throw new Error("Agent not installed by user");
    }

    const sharedAgent = await this.runQuery<SharedAgent>(
      "SELECT * FROM shared_agents WHERE id = ?",
      [install.shared_agent_id],
      true,
    );

    if (!sharedAgent) {
      throw new Error("Shared agent not found");
    }

    await this.executeBatch([
      { sql: "DELETE FROM agent_installs WHERE id = ?", params: [install.id] },
      {
        sql: "UPDATE shared_agents SET usage_count = usage_count - 1 WHERE id = ?",
        params: [sharedAgent.id],
      },
    ]);
  }

  public async rateAgent(
    userId: number,
    sharedAgentId: string,
    rating: number,
    review?: string,
  ): Promise<AgentRating> {
    if (rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    const sharedAgent = await this.getSharedAgentById(sharedAgentId);
    if (!sharedAgent) {
      throw new Error("Shared agent not found");
    }

    const existingRating = await this.runQuery<AgentRating>(
      "SELECT * FROM agent_ratings WHERE shared_agent_id = ? AND user_id = ?",
      [sharedAgentId, userId],
      true,
    );

    const id = existingRating?.id || generateId();
    const now = new Date().toISOString();

    // Update or insert rating, then recompute stats and update shared_agents atomically
    const upsertSql = existingRating
      ? "UPDATE agent_ratings SET rating = ?, review = ?, updated_at = ? WHERE id = ?"
      : "INSERT INTO agent_ratings (id, shared_agent_id, user_id, rating, review) VALUES (?, ?, ?, ?, ?)";
    const upsertParams = existingRating
      ? [rating, review || null, now, id]
      : [id, sharedAgentId, userId, rating, review || null];

    // Recompute stats within the batch by using deterministic update based on current values
    // Since D1 batch does not support multi-statement expressions depending on previous statements' results,
    // we compute stats outside, then apply together.
    const ratingStats = await this.runQuery<{ count: number; average: number }>(
      "SELECT COUNT(*) as count, AVG(rating) as average FROM agent_ratings WHERE shared_agent_id = ?",
      [sharedAgentId],
      true,
    );

    await this.executeBatch([
      { sql: upsertSql, params: upsertParams },
      {
        sql: "UPDATE shared_agents SET rating_count = ?, rating_average = ? WHERE id = ?",
        params: [ratingStats?.count || 0, (ratingStats?.average || 0).toFixed(1), sharedAgentId],
      },
    ]);

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
    const sharedAgent = await this.runQuery<SharedAgent>(
      "SELECT * FROM shared_agents WHERE id = ? AND user_id = ?",
      [sharedAgentId, userId],
      true,
    );

    if (!sharedAgent) {
      throw new Error("Shared agent not found or unauthorized");
    }

    const sets: string[] = [];
    const params: any[] = [];

    if (updates.name !== undefined) {
      sets.push("name = ?");
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      sets.push("description = ?");
      params.push(updates.description);
    }
    if (updates.avatar_url !== undefined) {
      sets.push("avatar_url = ?");
      params.push(updates.avatar_url);
    }
    if (updates.category !== undefined) {
      sets.push("category = ?");
      params.push(updates.category);
    }
    if (updates.tags !== undefined) {
      sets.push("tags = ?");
      params.push(JSON.stringify(updates.tags));
    }

    if (sets.length === 0) return;

    params.push(sharedAgentId);
    const sql = `UPDATE shared_agents SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await this.executeRun(sql, params);
  }

  public async deleteSharedAgent(
    userId: number,
    sharedAgentId: string,
  ): Promise<void> {
    const sharedAgent = await this.runQuery<SharedAgent>(
      "SELECT * FROM shared_agents WHERE id = ? AND user_id = ?",
      [sharedAgentId, userId],
      true,
    );

    if (!sharedAgent) {
      throw new Error("Shared agent not found or unauthorized");
    }

    await this.executeBatch([
      { sql: "DELETE FROM agent_ratings WHERE shared_agent_id = ?", params: [sharedAgentId] },
      { sql: "DELETE FROM agent_installs WHERE shared_agent_id = ?", params: [sharedAgentId] },
      { sql: "DELETE FROM shared_agents WHERE id = ?", params: [sharedAgentId] },
    ]);
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
        const tags = JSON.parse(result.tags) as string[];
        for (const tag of tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      } catch (e) {
        logger.error("Error parsing tags:", e, result.tags);
      }
    }

    return Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([tag]) => tag);
  }
}
