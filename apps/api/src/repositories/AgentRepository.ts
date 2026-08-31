import type {
  AgentFewShotExample,
  AgentMcpServer,
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
  teamId?: string | null;
  teamRole?: string | null;
  isTeamAgent?: boolean;
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
        team_id: record.teamId ?? null,
        team_role: record.teamRole ?? null,
        is_team_agent: record.isTeamAgent ? 1 : 0,
      },
      {
        jsonFields: ["servers", "few_shot_examples", "enabled_tools"],
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
      enabled_tools: string[];
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
      "enabled_tools",
      "team_id",
      "team_role",
      "is_team_agent",
    ];

    const result = this.buildUpdateQuery("agents", data, allowedFields, "id = ?", [agentId], {
      jsonFields: ["servers", "few_shot_examples", "enabled_tools"],
      transformer: (field, value) => {
        if (field === "temperature" && value !== undefined && value !== null) {
          return value.toString();
        }

        if (field === "is_team_agent" && typeof value === "boolean") {
          return value ? 1 : 0;
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

  public async getAgentsByTeamAndUser(teamId: string, userId: number): Promise<Agent[]> {
    const { query, values } = this.buildSelectQuery(
      "agents",
      { team_id: teamId, user_id: userId },
      { orderBy: "created_at DESC" },
    );

    return this.runQuery<Agent>(query, values);
  }
}
