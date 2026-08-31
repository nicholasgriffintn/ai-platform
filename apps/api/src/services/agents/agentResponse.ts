import {
  agentResponseSchema,
  fewShotExampleSchema,
  mcpServerSchema,
  readToolIds,
  type AgentResponse,
} from "@ngriffin_uk/polychat-schemas";

import type { Agent } from "~/lib/database/schema";
import { parseJsonArrayColumn } from "~/utils/json";

export type StoredAgentRow = Omit<Agent, "is_team_agent"> & { is_team_agent: unknown };

export function normaliseAgentResponse(agent: StoredAgentRow): AgentResponse {
  const temperature = agent.temperature === null ? null : Number(agent.temperature);

  return agentResponseSchema.parse({
    ...agent,
    servers: parseJsonArrayColumn(agent.servers, mcpServerSchema) ?? [],
    few_shot_examples: parseJsonArrayColumn(agent.few_shot_examples, fewShotExampleSchema),
    enabled_tools: readToolIds(agent.enabled_tools),
    temperature: Number.isFinite(temperature) ? temperature : null,
    is_team_agent: Boolean(agent.is_team_agent),
  });
}
