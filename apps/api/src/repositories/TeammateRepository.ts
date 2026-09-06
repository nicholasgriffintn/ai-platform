import type {
  TeammateFewShotExample,
  TeammateMcpServer,
  AgentMode,
  TeammateOwnerScopeType,
  TeammateKind,
} from "@ngriffin_uk/polychat-schemas";

import type { Teammate } from "~/lib/database/schema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

export interface CreateTeammateRecord {
  userId: number;
  ownerScopeType: TeammateOwnerScopeType;
  ownerScopeId: string;
  derivedFromTeammateId?: string | null;
  kind?: TeammateKind;
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
			 ORDER BY created_at DESC`,
      [String(userId), ...uniqueWorkspaceIds],
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
    ];

    const result = this.buildUpdateQuery("teammates", data, allowedFields, "id = ?", [teammateId], {
      jsonFields: ["servers", "few_shot_examples", "enabled_tools", "skill_ids"],
      transformer: (field, value) => {
        if (field === "temperature" && value !== undefined && value !== null) {
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
    const { query, values } = this.buildDeleteQuery("teammates", { id: teammateId });

    if (!query) {
      return;
    }

    await this.executeRun(query, values);
  }
}
