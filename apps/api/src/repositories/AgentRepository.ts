import type {
  AgentFewShotExample,
  AgentMcpServer,
  AgentMode,
  AgentOwnerScopeType,
} from "@ngriffin_uk/polychat-schemas";

import type { Agent } from "~/lib/database/schema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

export interface CreateAgentRecord {
  userId: number;
  ownerScopeType: AgentOwnerScopeType;
  ownerScopeId: string;
  derivedFromAgentId?: string | null;
  name: string;
  description: string;
  avatarUrl: string | null;
  servers?: AgentMcpServer[];
  model?: string | null;
  temperature?: number | null;
  maxSteps?: number | null;
  systemPrompt?: string | null;
  fewShotExamples?: AgentFewShotExample[] | null;
  enabledTools?: string[] | null;
  skillIds?: string[] | null;
  mode?: AgentMode | null;
}

export class AgentRepository extends BaseRepository {
  public async createAgent(record: CreateAgentRecord): Promise<Agent> {
    const id = generateId();
    const insert = this.buildInsertQuery(
      "agents",
      {
        id,
        user_id: record.userId,
        owner_scope_type: record.ownerScopeType,
        owner_scope_id: record.ownerScopeId,
        derived_from_agent_id: record.derivedFromAgentId ?? null,
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
      throw new AssistantError("Failed to build agent insert query", ErrorType.INTERNAL_ERROR);
    }

    const created = await this.runQuery<Agent>(insert.query, insert.values, true);

    if (!created) {
      throw new AssistantError("Failed to insert agent", ErrorType.INTERNAL_ERROR);
    }

    return created;
  }

  public async getAgentsForScopes(userId: number, workspaceIds: string[]): Promise<Agent[]> {
    const uniqueWorkspaceIds = [...new Set(workspaceIds)];
    const workspaceClause = uniqueWorkspaceIds.length
      ? ` OR (owner_scope_type = 'workspace' AND owner_scope_id IN (${uniqueWorkspaceIds
          .map(() => "?")
          .join(", ")}))`
      : "";

    return this.runQuery<Agent>(
      `SELECT * FROM agents
			 WHERE (owner_scope_type = 'user' AND owner_scope_id = ?)${workspaceClause}
			 ORDER BY created_at DESC`,
      [String(userId), ...uniqueWorkspaceIds],
    );
  }

  public async getAgentsByIds(agentIds: string[]): Promise<Agent[]> {
    const uniqueIds = [...new Set(agentIds)];

    if (uniqueIds.length === 0) {
      return [];
    }

    return this.runQuery<Agent>(
      `SELECT * FROM agents
			 WHERE id IN (${uniqueIds.map(() => "?").join(", ")})
			 ORDER BY created_at DESC`,
      uniqueIds,
    );
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
      avatar_url: string | null;
      servers: AgentMcpServer[];
      model: string;
      temperature: number;
      max_steps: number;
      system_prompt: string;
      few_shot_examples: AgentFewShotExample[];
      enabled_tools: string[];
      skill_ids: string[];
      mode: AgentMode | null;
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
    ];

    const result = this.buildUpdateQuery("agents", data, allowedFields, "id = ?", [agentId], {
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

  public async deleteAgent(agentId: string): Promise<void> {
    const { query, values } = this.buildDeleteQuery("agents", { id: agentId });

    if (!query) {
      return;
    }

    await this.executeRun(query, values);
  }
}
