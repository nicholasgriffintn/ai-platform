import type { Agent } from "~/lib/database/schema";
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
  ): Promise<Agent> {
    const id = generateId();
    const serversJson = servers ? JSON.stringify(servers) : null;
    const fewShotExamplesJson = fewShotExamples
      ? JSON.stringify(fewShotExamples)
      : null;

    await this.executeRun(
      "INSERT INTO agents (id, user_id, name, description, avatar_url, servers, model, temperature, max_steps, system_prompt, few_shot_examples) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        userId,
        name,
        description,
        avatarUrl,
        serversJson,
        model,
        temperature?.toString(),
        maxSteps,
        systemPrompt,
        fewShotExamplesJson,
      ],
    );
    const now = new Date().toISOString();
    return {
      id,
      user_id: userId,
      name,
      description,
      avatar_url: avatarUrl,
      servers: serversJson,
      model,
      temperature: temperature?.toString(),
      max_steps: maxSteps,
      system_prompt: systemPrompt,
      few_shot_examples: fewShotExamplesJson,
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
      model: string;
      temperature: number;
      max_steps: number;
      system_prompt: string;
      few_shot_examples: any[];
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
    if (data.model !== undefined) {
      sets.push("model = ?");
      params.push(data.model);
    }
    if (data.temperature !== undefined) {
      sets.push("temperature = ?");
      params.push(data.temperature.toString());
    }
    if (data.max_steps !== undefined) {
      sets.push("max_steps = ?");
      params.push(data.max_steps);
    }
    if (data.system_prompt !== undefined) {
      sets.push("system_prompt = ?");
      params.push(data.system_prompt);
    }
    if (data.few_shot_examples !== undefined) {
      sets.push("few_shot_examples = ?");
      params.push(JSON.stringify(data.few_shot_examples));
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
