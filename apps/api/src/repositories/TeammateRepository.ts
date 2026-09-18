import type {
  TeammateFewShotExample,
  TeammateMcpServer,
  AgentMode,
  TeammateOwnerScopeType,
  TeammateKind,
} from "@ngriffin_uk/polychat-schemas";
import {
  PLATFORM_TEAMMATE_AUTHOR_USER_ID,
  PLATFORM_TEAMMATE_SCOPE_ID,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import type { Teammate } from "~/lib/database/schema";

import { BaseRepository } from "./BaseRepository";

export interface CreateTeammateRecord {
  userId: number;
  ownerScopeType: TeammateOwnerScopeType;
  ownerScopeId: string;
  derivedFromTeammateId?: string | null;
  kind?: TeammateKind;
  workspaceDefault?: boolean;
  name: string;
  description: string;
  avatarUrl: string | null;
  servers?: TeammateMcpServer[];
  model?: string | null;
  temperature?: number | null;
  maxSteps?: number | null;
  systemPrompt?: string | null;
  fewShotExamples?: TeammateFewShotExample[] | null;
  enabledTools?: string[] | null;
  skillIds?: string[] | null;
  mode?: AgentMode | null;
}

export interface PlatformTeammateRecord {
  id: string;
  kind: TeammateKind;
  name: string;
  description: string;
  avatarUrl: string | null;
  servers: TeammateMcpServer[];
  model: string | null;
  temperature: number | null;
  maxSteps: number | null;
  systemPrompt: string;
  fewShotExamples: TeammateFewShotExample[] | null;
  enabledTools: string[] | null;
  skillIds: string[] | null;
  mode: AgentMode | null;
}

export class TeammateRepository extends BaseRepository {
  public async createTeammate(record: CreateTeammateRecord): Promise<Teammate> {
    const id = generateId();
    const insert = this.buildInsertQuery(
      "teammates",
      {
        id,
        user_id: record.userId,
        owner_scope_type: record.ownerScopeType,
        owner_scope_id: record.ownerScopeId,
        derived_from_teammate_id: record.derivedFromTeammateId ?? null,
        kind: record.kind ?? "colleague",
        workspace_default: record.workspaceDefault ?? false,
        name: record.name,
        description: record.description,
        avatar_url: record.avatarUrl ?? null,
        servers: record.servers ?? null,
        model: record.model ?? null,
        temperature:
          record.temperature !== undefined && record.temperature !== null
            ? record.temperature.toString()
            : null,
        max_steps: record.maxSteps ?? null,
        system_prompt: record.systemPrompt ?? null,
        few_shot_examples: record.fewShotExamples ?? null,
        enabled_tools: record.enabledTools ?? null,
        skill_ids: record.skillIds ?? null,
        mode: record.mode ?? null,
      },
      {
        jsonFields: ["servers", "few_shot_examples", "enabled_tools", "skill_ids"],
        returning: "*",
      },
    );

    if (!insert) {
      throw new AssistantError("Failed to build teammate insert query", ErrorType.INTERNAL_ERROR);
    }

    const created = await this.runQuery<Teammate>(insert.query, insert.values, true);

    if (!created) {
      throw new AssistantError("Failed to insert teammate", ErrorType.INTERNAL_ERROR);
    }

    return created;
  }

  public async getTeammatesForScopes(userId: number, workspaceIds: string[]): Promise<Teammate[]> {
    const uniqueWorkspaceIds = [...new Set(workspaceIds)];
    const workspaceClause = uniqueWorkspaceIds.length
      ? ` OR (owner_scope_type = 'workspace' AND owner_scope_id IN (${uniqueWorkspaceIds
          .map(() => "?")
          .join(", ")}))`
      : "";

    return this.runQuery<Teammate>(
      `SELECT * FROM teammates
			 WHERE (owner_scope_type = 'user' AND owner_scope_id = ?)${workspaceClause}
				OR owner_scope_type = 'platform'
			 ORDER BY created_at DESC`,
      [String(userId), ...uniqueWorkspaceIds],
    );
  }

  public async listPlatformTeammates(): Promise<Teammate[]> {
    return this.runQuery<Teammate>(
      `SELECT * FROM teammates
       WHERE owner_scope_type = 'platform'
       ORDER BY id ASC`,
    );
  }

  public async upsertPlatformTeammates(records: PlatformTeammateRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    const statements = records.map((record) =>
      this.env.DB.prepare(
        `INSERT INTO teammates (
          id, user_id, owner_scope_type, owner_scope_id, derived_from_teammate_id, kind,
          workspace_default, name, description, avatar_url, servers, model, temperature,
          max_steps, system_prompt, few_shot_examples, enabled_tools, skill_ids, mode,
          created_at, updated_at
        ) VALUES (?, ?, 'platform', ?, NULL, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          kind = excluded.kind,
          name = excluded.name,
          description = excluded.description,
          avatar_url = excluded.avatar_url,
          servers = excluded.servers,
          model = excluded.model,
          temperature = excluded.temperature,
          max_steps = excluded.max_steps,
          system_prompt = excluded.system_prompt,
          few_shot_examples = excluded.few_shot_examples,
          enabled_tools = excluded.enabled_tools,
          skill_ids = excluded.skill_ids,
          mode = excluded.mode,
          updated_at = CURRENT_TIMESTAMP
        WHERE teammates.owner_scope_type = 'platform'`,
      ).bind(
        record.id,
        PLATFORM_TEAMMATE_AUTHOR_USER_ID,
        PLATFORM_TEAMMATE_SCOPE_ID,
        record.kind,
        record.name,
        record.description,
        record.avatarUrl,
        JSON.stringify(record.servers),
        record.model,
        record.temperature !== null ? record.temperature.toString() : null,
        record.maxSteps,
        record.systemPrompt,
        record.fewShotExamples ? JSON.stringify(record.fewShotExamples) : null,
        record.enabledTools ? JSON.stringify(record.enabledTools) : null,
        record.skillIds ? JSON.stringify(record.skillIds) : null,
        record.mode,
      ),
    );

    await this.executeBatch(statements);
  }

  public async listWorkspaceDefaults(workspaceId: string): Promise<Teammate[]> {
    return this.runQuery<Teammate>(
      `SELECT * FROM teammates
       WHERE owner_scope_type = 'workspace' AND owner_scope_id = ? AND workspace_default = 1
       ORDER BY created_at DESC`,
      [workspaceId],
    );
  }

  public async listForWorkspace(workspaceId: string): Promise<Teammate[]> {
    return this.runQuery<Teammate>(
      `SELECT * FROM teammates
       WHERE owner_scope_type = 'workspace' AND owner_scope_id = ?
       ORDER BY created_at ASC`,
      [workspaceId],
    );
  }

  public async getTeammatesByIds(teammateIds: string[]): Promise<Teammate[]> {
    const uniqueIds = [...new Set(teammateIds)];

    if (uniqueIds.length === 0) {
      return [];
    }

    return this.runQuery<Teammate>(
      `SELECT * FROM teammates
			 WHERE id IN (${uniqueIds.map(() => "?").join(", ")})
			 ORDER BY created_at DESC`,
      uniqueIds,
    );
  }

  public async getTeammateById(teammateId: string): Promise<Teammate | null> {
    const { query, values } = this.buildSelectQuery("teammates", { id: teammateId });

    return this.runQuery<Teammate>(query, values, true);
  }

  public async updateTeammate(
    teammateId: string,
    data: Partial<{
      name: string;
      description: string;
      avatar_url: string | null;
      servers: TeammateMcpServer[];
      model: string;
      temperature: number | null;
      max_steps: number;
      system_prompt: string;
      few_shot_examples: TeammateFewShotExample[];
      enabled_tools: string[];
      skill_ids: string[];
      mode: AgentMode | null;
      kind: TeammateKind;
      workspace_default: boolean;
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
      "enabled_tools",
      "skill_ids",
      "mode",
      "kind",
      "workspace_default",
    ];

    const result = this.buildUpdateQuery("teammates", data, allowedFields, "id = ?", [teammateId], {
      jsonFields: ["servers", "few_shot_examples", "enabled_tools", "skill_ids"],
      transformer: (field, value) => {
        if (field === "temperature" && typeof value === "number") {
          return value.toString();
        }

        return value;
      },
    });

    if (!result) {
      return;
    }

    const queryWithTimestamp = result.query.replace(
      "updated_at = datetime('now')",
      "updated_at = CURRENT_TIMESTAMP",
    );

    await this.executeRun(queryWithTimestamp, result.values);
  }

  public async deleteTeammate(teammateId: string): Promise<void> {
    await this.executeBatch([
      this.env.DB.prepare(
        `UPDATE memory_document
         SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id IN (
           SELECT memory_document_id FROM teammate_context WHERE teammate_id = ?
         ) AND deleted_at IS NULL`,
      ).bind(teammateId),
      this.env.DB.prepare(
        `DELETE FROM conversation
         WHERE id IN (
           SELECT home_conversation_id FROM teammate_context WHERE teammate_id = ?
         )`,
      ).bind(teammateId),
      this.env.DB.prepare("DELETE FROM teammates WHERE id = ?").bind(teammateId),
    ]);
  }
}
