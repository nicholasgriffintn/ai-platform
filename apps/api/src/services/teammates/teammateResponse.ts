import {
  agentModeSchema,
  teammateResponseSchema,
  fewShotExampleSchema,
  mcpServerSchema,
  DEFAULT_TEAMMATE_KIND,
  readToolIds,
  skillIdSchema,
  teammateKindSchema,
  type TeammateResponse,
} from "@ngriffin_uk/polychat-schemas";

import type { Agent } from "~/lib/database/schema";
import { parseJsonArrayColumn } from "~/utils/json";

export type StoredTeammateRow = Omit<Agent, "mode"> & {
  mode: unknown;
};

export function readTeammateSkillIds(value: unknown): string[] {
  return parseJsonArrayColumn(value, skillIdSchema) ?? [];
}

export function normaliseTeammateResponse(agent: StoredTeammateRow): TeammateResponse {
  const temperature = agent.temperature === null ? null : Number(agent.temperature);

  return teammateResponseSchema.parse({
    ...agent,
    servers: parseJsonArrayColumn(agent.servers, mcpServerSchema) ?? [],
    few_shot_examples: parseJsonArrayColumn(agent.few_shot_examples, fewShotExampleSchema),
    enabled_tools: readToolIds(agent.enabled_tools),
    skill_ids: readTeammateSkillIds(agent.skill_ids),
    mode: agentModeSchema.safeParse(agent.mode).data ?? null,
    kind: teammateKindSchema.safeParse(agent.kind).data ?? DEFAULT_TEAMMATE_KIND,
    temperature: Number.isFinite(temperature) ? temperature : null,
  });
}
