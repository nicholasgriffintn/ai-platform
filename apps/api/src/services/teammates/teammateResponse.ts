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

import type { Teammate } from "~/lib/database/schema";
import { parseJsonArrayColumn } from "~/utils/json";

export type StoredTeammateRow = Omit<Teammate, "mode" | "workspace_default"> & {
  mode: unknown;
  workspace_default: unknown;
};

export function readTeammateSkillIds(value: unknown): string[] {
  return parseJsonArrayColumn(value, skillIdSchema) ?? [];
}

export function normaliseTeammateResponse(teammate: StoredTeammateRow): TeammateResponse {
  const temperature = teammate.temperature === null ? null : Number(teammate.temperature);

  return teammateResponseSchema.parse({
    ...teammate,
    servers: parseJsonArrayColumn(teammate.servers, mcpServerSchema) ?? [],
    few_shot_examples: parseJsonArrayColumn(teammate.few_shot_examples, fewShotExampleSchema),
    enabled_tools: readToolIds(teammate.enabled_tools),
    skill_ids: readTeammateSkillIds(teammate.skill_ids),
    mode: agentModeSchema.safeParse(teammate.mode).data ?? null,
    kind: teammateKindSchema.safeParse(teammate.kind).data ?? DEFAULT_TEAMMATE_KIND,
    workspace_default:
      teammate.workspace_default === true || teammate.workspace_default === 1 ? true : false,
    temperature: Number.isFinite(temperature) ? temperature : null,
  });
}
