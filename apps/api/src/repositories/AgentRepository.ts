import type { Agent } from "~/lib/database/schema";
import { generateId } from "~/utils/id";
import { BaseRepository } from "./BaseRepository";

export class AgentRepository extends BaseRepository {
  public async createAgent(
    userId: number,
    name: string,
    description: string,
    avatarUrl: string | null,
    servers: any[],
  ): Promise<Agent> {
    const id = generateId();
    const serversJson = JSON.stringify(servers);
    await this.executeRun(
      "INSERT INTO agents (id, user_id, name, description, avatar_url, servers) VALUES (?, ?, ?, ?, ?, ?)",
      [id, userId, name, description, avatarUrl, serversJson],
    );
    const now = new Date().toISOString();
    return {
      id,
      user_id: userId,
      name,
      description,
      avatar_url: avatarUrl,
      servers: serversJson,
      created_at: now,
      updated_at: now,
    };
  }

  public async getAgentsByUser(userId: number): Promise<Agent[]> {
    return this.runQuery<Agent>(
      "SELECT * FROM agents WHERE user_id = ? ORDER BY created_at DESC",
      [userId],
    );
  }

  public async getAgentById(agentId: string): Promise<Agent | null> {
    return this.runQuery<Agent>(
      "SELECT * FROM agents WHERE id = ?",
      [agentId],
      true,
    );
  }

  public async updateAgent(
    agentId: string,
    data: Partial<{
      name: string;
      description: string;
      avatar_url: string;
      servers: any[];
    }>,
  ): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      sets.push("name = ?");
      params.push(data.name);
    }
    if (data.description !== undefined) {
      sets.push("description = ?");
      params.push(data.description);
    }
    if (data.avatar_url !== undefined) {
      sets.push("avatar_url = ?");
      params.push(data.avatar_url);
    }
    if (data.servers !== undefined) {
      sets.push("servers = ?");
      params.push(JSON.stringify(data.servers));
    }

    if (sets.length === 0) return;
    params.push(agentId);
    const sql = `UPDATE agents SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await this.executeRun(sql, params);
  }

  public async deleteAgent(agentId: string): Promise<void> {
    await this.executeRun("DELETE FROM agents WHERE id = ?", [agentId]);
  }
}
