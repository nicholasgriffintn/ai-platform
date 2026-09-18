import { getPlatformTeammateBrief } from "@ngriffin_uk/polychat-ai-prompts";
import {
  findPlatformTeammate,
  isPlatformTeammateId,
  PLATFORM_TEAMMATES,
  readToolIds,
  type PlatformTeammate,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { Teammate } from "~/infrastructure/database/schema";
import type { PlatformTeammateRecord } from "~/modules/teammates/infrastructure/TeammateRepository";

import { readTeammateSkillIds } from "./teammateResponse";

export interface PlatformTeammateGrants {
  tools: string[];
  skillIds: string[];
}

export function resolvePlatformTeammateGrants(
  configuration: Record<string, unknown> | undefined,
): PlatformTeammateGrants | null {
  const teammateId = configuration?.teammateId;

  if (typeof teammateId !== "string" || !isPlatformTeammateId(teammateId)) {
    return null;
  }

  const teammate = findPlatformTeammate(teammateId);

  if (!teammate) {
    return null;
  }

  return { tools: [...teammate.tools], skillIds: [...teammate.skillIds] };
}

export async function ensurePlatformTeammates(context: ServiceContext): Promise<void> {
  context.ensureDatabase();
  const existing = await context.repositories.teammates.listPlatformTeammates();
  const existingById = new Map(existing.map((row) => [row.id, row]));
  const drifted = PLATFORM_TEAMMATES.map(toPlatformTeammateRecord).filter((record) => {
    const row = existingById.get(record.id);

    return !row || hasDrifted(row, record);
  });

  if (drifted.length > 0) {
    await context.repositories.teammates.upsertPlatformTeammates(drifted);
  }
}

function toPlatformTeammateRecord(teammate: PlatformTeammate): PlatformTeammateRecord {
  return {
    id: teammate.id,
    kind: teammate.kind,
    name: teammate.name,
    description: teammate.summary,
    avatarUrl: null,
    servers: [],
    model: null,
    temperature: null,
    maxSteps: teammate.maxSteps,
    systemPrompt: getPlatformTeammateBrief(teammate.id),
    fewShotExamples: null,
    enabledTools: [...teammate.tools],
    skillIds: [...teammate.skillIds],
    mode: teammate.mode,
  };
}

function hasDrifted(row: Teammate, record: PlatformTeammateRecord): boolean {
  return (
    row.kind !== record.kind ||
    row.name !== record.name ||
    row.description !== record.description ||
    (row.avatar_url ?? null) !== record.avatarUrl ||
    row.max_steps !== record.maxSteps ||
    (row.system_prompt ?? "") !== record.systemPrompt ||
    row.mode !== record.mode ||
    !sameIds(readToolIds(row.enabled_tools) ?? [], record.enabledTools ?? []) ||
    !sameIds(readTeammateSkillIds(row.skill_ids), record.skillIds ?? [])
  );
}

function sameIds(current: readonly string[], next: readonly string[]): boolean {
  return current.length === next.length && current.every((id, index) => id === next[index]);
}
