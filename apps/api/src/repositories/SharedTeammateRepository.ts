import { agentModeSchema, skillIdSchema } from "@ngriffin_uk/polychat-schemas";

import type {
  Teammate,
  TeammateInstall,
  TeammateRating,
  SharedTeammate,
} from "~/lib/database/schema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { parseJsonArrayColumn, safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";

import { BaseRepository } from "./BaseRepository";

const logger = getLogger({ prefix: "repositories/SharedTeammateRepository" });

export interface SharedTeammateWithAuthor extends SharedTeammate {
  author_name: string;
  author_avatar_url: string | null;
}

export interface CreateSharedTeammateParams {
  teammateId: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  category?: string;
  tags?: string[];
}

export interface SharedTeammateFilters {
  category?: string;
  tags?: string[];
  search?: string;
  featured?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: "recent" | "popular" | "rating";
}

export class SharedTeammateRepository extends BaseRepository {
  public async shareTeammate(
    userId: number,
    params: CreateSharedTeammateParams,
  ): Promise<SharedTeammate> {
    const { query: teammateQuery, values: teammateValues } = this.buildSelectQuery("teammates", {
      id: params.teammateId,
      user_id: userId,
    });
    const teammate = await this.runQuery<Teammate>(teammateQuery, teammateValues, true);

    if (!teammate) {
      throw new AssistantError("Teammate not found or unauthorized", ErrorType.NOT_FOUND);
    }

    const { query: existingSharedQuery, values: existingSharedValues } = this.buildSelectQuery(
      "shared_teammates",
      { teammate_id: params.teammateId },
    );
    const existingShared = await this.runQuery<SharedTeammate>(
      existingSharedQuery,
      existingSharedValues,
      true,
    );

    if (existingShared) {
      throw new AssistantError("Teammate is already shared", ErrorType.CONFLICT_ERROR);
    }

    const id = generateId();
    const templateData = {
      name: teammate.name,
      description: teammate.description,
      avatar_url: teammate.avatar_url,
      servers: teammate.servers ? safeParseJson(teammate.servers as string) : [],
      model: teammate.model,
      temperature: teammate.temperature,
      max_steps: teammate.max_steps,
      system_prompt: teammate.system_prompt,
      few_shot_examples: teammate.few_shot_examples
        ? safeParseJson(teammate.few_shot_examples as string)
        : [],
      enabled_tools: teammate.enabled_tools ? safeParseJson(teammate.enabled_tools as string) : [],
      skill_ids: parseJsonArrayColumn(teammate.skill_ids, skillIdSchema) ?? [],
      mode: teammate.mode,
    };

    await this.executeRun(
      `INSERT INTO shared_teammates 
       (id, teammate_id, user_id, name, description, avatar_url, category, tags, template_data) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.teammateId,
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
      teammate_id: params.teammateId,
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

  public async getSharedTeammates(
    filters: SharedTeammateFilters = {},
  ): Promise<SharedTeammateWithAuthor[]> {
    let query = `
      SELECT
        sa.id, sa.teammate_id, sa.user_id, sa.name, sa.description, sa.avatar_url,
        sa.category, sa.tags, sa.is_featured, sa.is_public, sa.usage_count,
        sa.rating_count, sa.rating_average, sa.template_data, sa.created_at, sa.updated_at,
        u.name as author_name, u.avatar_url as author_avatar_url
      FROM shared_teammates sa
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
      const tagConditions = filters.tags.map(() => "sa.tags LIKE ?").join(" OR ");

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

    return this.runQuery<SharedTeammateWithAuthor>(query, params);
  }

  public async getFeaturedTeammates(limit = 10): Promise<SharedTeammateWithAuthor[]> {
    return this.getSharedTeammates({ featured: true, limit, sortBy: "popular" });
  }

  public async getSharedTeammateById(id: string): Promise<SharedTeammateWithAuthor | null> {
    return this.runQuery<SharedTeammateWithAuthor>(
      `SELECT
         sa.id, sa.teammate_id, sa.user_id, sa.name, sa.description, sa.avatar_url,
         sa.category, sa.tags, sa.is_featured, sa.is_public, sa.usage_count,
         sa.rating_count, sa.rating_average, sa.template_data, sa.created_at, sa.updated_at,
         u.name as author_name, u.avatar_url as author_avatar_url
       FROM shared_teammates sa
       JOIN user u ON sa.user_id = u.id
       WHERE sa.id = ?`,
      [id],
      true,
    );
  }

  public async getSharedTeammateByTeammateId(teammateId: string): Promise<SharedTeammate | null> {
    return this.runQuery<SharedTeammate>(
      `SELECT
         id, teammate_id, user_id, name, description, avatar_url,
         category, tags, is_featured, is_public, usage_count,
         rating_count, rating_average, template_data, created_at, updated_at
       FROM shared_teammates WHERE teammate_id = ?`,
      [teammateId],
      true,
    );
  }

  public async getAllSharedTeammatesForAdmin(
    filters: SharedTeammateFilters = {},
  ): Promise<SharedTeammateWithAuthor[]> {
    let query = `
      SELECT
        sa.id, sa.teammate_id, sa.user_id, sa.name, sa.description, sa.avatar_url,
        sa.category, sa.tags, sa.is_featured, sa.is_public, sa.usage_count,
        sa.rating_count, sa.rating_average, sa.template_data, sa.created_at, sa.updated_at,
        u.name as author_name, u.avatar_url as author_avatar_url
      FROM shared_teammates sa
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
      const tagConditions = filters.tags.map(() => "sa.tags LIKE ?").join(" OR ");

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

    return this.runQuery<SharedTeammateWithAuthor>(query, params);
  }

  public async installTeammate(
    userId: number,
    sharedTeammateId: string,
  ): Promise<{ teammate: Teammate; install: TeammateInstall }> {
    const sharedTeammate = await this.getSharedTeammateById(sharedTeammateId);

    if (!sharedTeammate) {
      throw new AssistantError("Shared teammate not found", ErrorType.NOT_FOUND);
    }

    const existingInstall = await this.runQuery<TeammateInstall>(
      "SELECT * FROM teammate_installs WHERE shared_teammate_id = ? AND user_id = ?",
      [sharedTeammateId, userId],
      true,
    );

    if (existingInstall) {
      throw new AssistantError("Teammate already installed", ErrorType.CONFLICT_ERROR);
    }

    if (!sharedTeammate.template_data) {
      throw new AssistantError("Template data not found", ErrorType.NOT_FOUND);
    }

    const templateData = safeParseJson(sharedTeammate.template_data as string);

    if (!templateData) {
      logger.error("Error parsing template data:", { error: "" }, sharedTeammate.template_data);
      throw new AssistantError("Error parsing template data", ErrorType.PARAMS_ERROR);
    }

    const teammateId = generateId();
    const installId = generateId();
    const installedSkillIds = parseJsonArrayColumn(templateData.skill_ids, skillIdSchema) ?? [];
    const installedMode = agentModeSchema.safeParse(templateData.mode).data ?? null;

    await this.executeRun(
      `INSERT INTO teammates
       (id, user_id, owner_scope_type, owner_scope_id, name, description, avatar_url, servers, model, temperature, max_steps, system_prompt, few_shot_examples, enabled_tools, skill_ids, mode)
       VALUES (?, ?, 'user', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        teammateId,
        userId,
        String(userId),
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
        JSON.stringify(installedSkillIds),
        installedMode,
      ],
    );

    await this.executeRun(
      "INSERT INTO teammate_installs (id, shared_teammate_id, user_id, teammate_id) VALUES (?, ?, ?, ?)",
      [installId, sharedTeammateId, userId, teammateId],
    );

    await this.executeRun(
      "UPDATE shared_teammates SET usage_count = usage_count + 1 WHERE id = ?",
      [sharedTeammateId],
    );

    const now = new Date().toISOString();
    const teammate: Teammate = {
      id: teammateId,
      user_id: userId,
      owner_scope_type: "user",
      owner_scope_id: String(userId),
      derived_from_teammate_id: null,
      kind: "colleague",
      workspace_default: false,
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
      skill_ids: JSON.stringify(installedSkillIds),
      mode: installedMode,
      created_at: now,
      updated_at: now,
    };

    const install: TeammateInstall = {
      id: installId,
      shared_teammate_id: sharedTeammateId,
      user_id: userId,
      teammate_id: teammateId,
      created_at: now,
    };

    return { teammate, install };
  }

  public async getInstallByTeammateId(
    userId: number,
    teammateId: string,
  ): Promise<TeammateInstall | null> {
    return this.runQuery<TeammateInstall>(
      "SELECT * FROM teammate_installs WHERE teammate_id = ? AND user_id = ?",
      [teammateId, userId],
      true,
    );
  }

  public async uninstallTeammate(userId: number, teammateId: string): Promise<void> {
    const install = await this.runQuery<TeammateInstall>(
      "SELECT * FROM teammate_installs WHERE teammate_id = ? AND user_id = ?",
      [teammateId, userId],
      true,
    );

    if (!install) {
      throw new AssistantError("Teammate not installed by user", ErrorType.NOT_FOUND);
    }

    const sharedTeammate = await this.runQuery<SharedTeammate>(
      "SELECT * FROM shared_teammates WHERE id = ?",
      [install.shared_teammate_id],
      true,
    );

    if (!sharedTeammate) {
      throw new AssistantError("Shared teammate not found", ErrorType.NOT_FOUND);
    }

    await this.executeRun("DELETE FROM teammate_installs WHERE id = ?", [install.id]);

    await this.executeRun(
      "UPDATE shared_teammates SET usage_count = usage_count - 1 WHERE id = ?",
      [sharedTeammate.id],
    );
  }

  public async rateTeammate(
    userId: number,
    sharedTeammateId: string,
    rating: number,
    review?: string,
  ): Promise<TeammateRating> {
    if (rating < 1 || rating > 5) {
      throw new AssistantError("Rating must be between 1 and 5", ErrorType.PARAMS_ERROR);
    }

    const sharedTeammate = await this.getSharedTeammateById(sharedTeammateId);

    if (!sharedTeammate) {
      throw new AssistantError("Shared teammate not found", ErrorType.NOT_FOUND);
    }

    const existingRating = await this.runQuery<TeammateRating>(
      "SELECT * FROM teammate_ratings WHERE shared_teammate_id = ? AND user_id = ?",
      [sharedTeammateId, userId],
      true,
    );

    const id = existingRating?.id || generateId();
    const now = new Date().toISOString();

    if (existingRating) {
      await this.executeRun(
        "UPDATE teammate_ratings SET rating = ?, review = ?, updated_at = ? WHERE id = ?",
        [rating, review || null, now, id],
      );
    } else {
      await this.executeRun(
        "INSERT INTO teammate_ratings (id, shared_teammate_id, user_id, rating, review) VALUES (?, ?, ?, ?, ?)",
        [id, sharedTeammateId, userId, rating, review || null],
      );
    }

    const ratingStats = await this.runQuery<{ count: number; average: number }>(
      "SELECT COUNT(*) as count, AVG(rating) as average FROM teammate_ratings WHERE shared_teammate_id = ?",
      [sharedTeammateId],
      true,
    );

    await this.executeRun(
      "UPDATE shared_teammates SET rating_count = ?, rating_average = ? WHERE id = ?",
      [ratingStats?.count || 0, (ratingStats?.average || 0).toFixed(1), sharedTeammateId],
    );

    return {
      id,
      shared_teammate_id: sharedTeammateId,
      user_id: userId,
      rating,
      review: review || null,
      created_at: existingRating?.created_at || now,
      updated_at: now,
    };
  }

  public async getTeammateRatings(
    sharedTeammateId: string,
    limit = 10,
  ): Promise<(TeammateRating & { author_name: string })[]> {
    return this.runQuery<TeammateRating & { author_name: string }>(
      `SELECT ar.*, u.name as author_name
       FROM teammate_ratings ar
       JOIN user u ON ar.user_id = u.id
       WHERE ar.shared_teammate_id = ?
       ORDER BY ar.created_at DESC
       LIMIT ?`,
      [sharedTeammateId, limit],
    );
  }

  public async updateSharedTeammate(
    userId: number,
    sharedTeammateId: string,
    updates: Partial<
      Pick<SharedTeammate, "name" | "description" | "avatar_url" | "category" | "tags">
    >,
  ): Promise<void> {
    const { query, values } = this.buildSelectQuery("shared_teammates", {
      id: sharedTeammateId,
      user_id: userId,
    });
    const sharedTeammate = await this.runQuery<SharedTeammate>(query, values, true);

    if (!sharedTeammate) {
      throw new AssistantError("Shared teammate not found or unauthorized", ErrorType.NOT_FOUND);
    }

    const allowedFields = ["name", "description", "avatar_url", "category", "tags"] as const;

    const result = this.buildUpdateQuery(
      "shared_teammates",
      updates,
      [...allowedFields],
      "id = ?",
      [sharedTeammateId],
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

  public async deleteSharedTeammate(userId: number, sharedTeammateId: string): Promise<void> {
    const { query, values } = this.buildSelectQuery("shared_teammates", {
      id: sharedTeammateId,
      user_id: userId,
    });
    const sharedTeammate = await this.runQuery<SharedTeammate>(query, values, true);

    if (!sharedTeammate) {
      throw new AssistantError("Shared teammate not found or unauthorized", ErrorType.NOT_FOUND);
    }

    const deleteRatings = this.buildDeleteQuery("teammate_ratings", {
      shared_teammate_id: sharedTeammateId,
    });

    if (deleteRatings.query) {
      await this.executeRun(deleteRatings.query, deleteRatings.values);
    }

    const deleteInstalls = this.buildDeleteQuery("teammate_installs", {
      shared_teammate_id: sharedTeammateId,
    });

    if (deleteInstalls.query) {
      await this.executeRun(deleteInstalls.query, deleteInstalls.values);
    }

    const deleteSharedTeammate = this.buildDeleteQuery("shared_teammates", {
      id: sharedTeammateId,
    });

    if (deleteSharedTeammate.query) {
      await this.executeRun(deleteSharedTeammate.query, deleteSharedTeammate.values);
    }
  }

  public async setFeatured(sharedTeammateId: string, featured: boolean): Promise<void> {
    await this.executeRun(
      "UPDATE shared_teammates SET is_featured = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [featured ? 1 : 0, sharedTeammateId],
    );
  }

  public async moderateTeammate(sharedTeammateId: string, isPublic: boolean): Promise<void> {
    await this.executeRun(
      "UPDATE shared_teammates SET is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [isPublic ? 1 : 0, sharedTeammateId],
    );
  }

  public async getCategories(): Promise<string[]> {
    const results = await this.runQuery<{ category: string }>(
      "SELECT DISTINCT category FROM shared_teammates WHERE category IS NOT NULL AND is_public = 1 ORDER BY category",
      [],
    );

    return results.map((r) => r.category);
  }

  public async getPopularTags(limit = 20): Promise<string[]> {
    const results = await this.runQuery<{ tags: string }>(
      "SELECT tags FROM shared_teammates WHERE tags IS NOT NULL AND is_public = 1",
      [],
    );

    const tagCounts: Record<string, number> = {};

    for (const result of results) {
      try {
        const tags = safeParseJson(result.tags) as string[];

        for (const tag of tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      } catch {
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
export type { SharedTeammate, TeammateInstall, TeammateRating };
