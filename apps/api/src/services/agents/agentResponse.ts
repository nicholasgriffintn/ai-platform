import {
  agentModeSchema,
  agentResponseSchema,
  fewShotExampleSchema,
  mcpServerSchema,
  readToolIds,
  skillIdSchema,
  type AgentResponse,
} from "@ngriffin_uk/polychat-schemas";

import type { Agent } from "~/lib/database/schema";
import { parseJsonArrayColumn } from "~/utils/json";

export type StoredAgentRow = Omit<Agent, "mode"> & {
  mode: unknown;
};

export function readAgentSkillIds(value: unknown): string[] {
  return parseJsonArrayColumn(value, skillIdSchema) ?? [];
}

export function normaliseAgentResponse(agent: StoredAgentRow): AgentResponse {
  const temperature = agent.temperature === null ? null : Number(agent.temperature);

  return agentResponseSchema.parse({
    ...agent,
    servers: parseJsonArrayColumn(agent.servers, mcpServerSchema) ?? [],
    few_shot_examples: parseJsonArrayColumn(agent.few_shot_examples, fewShotExampleSchema),
    enabled_tools: readToolIds(agent.enabled_tools),
    skill_ids: readAgentSkillIds(agent.skill_ids),
    mode: agentModeSchema.safeParse(agent.mode).data ?? null,
    temperature: Number.isFinite(temperature) ? temperature : null,
  });
}
