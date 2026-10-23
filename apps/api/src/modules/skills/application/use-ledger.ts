import type { LoadedSkillRuntime } from "@ngriffin_uk/polychat-library-skills-catalogue";
import type { SkillUseActivation } from "@ngriffin_uk/polychat-schemas";

import type { Repositories } from "~/infrastructure/database/repositories";
import { AuthoredSkillRepository } from "~/modules/skills/infrastructure/AuthoredSkillRepository";
import {
  SkillUseRepository,
  type SkillUseInput,
} from "~/modules/skills/infrastructure/SkillUseRepository";

import { personalSkillScope, projectSkillScope } from "./management-policy";

export interface SkillUseContext {
  userId: number;
  projectId?: string | null;
  runId?: string | null;
  conversationId: string;
  activation: SkillUseActivation;
}

export async function recordSkillUses(
  repositories: Repositories,
  runtimes: readonly Pick<LoadedSkillRuntime, "provenance">[],
  use: SkillUseContext,
): Promise<void> {
  const skills = repositories.get(AuthoredSkillRepository);
  const uses: SkillUseInput[] = [];

  for (const runtime of runtimes) {
    const provenance = runtime.provenance;

    if (!provenance) {
      continue;
    }

    const scope =
      provenance.scope === "project" && use.projectId
        ? projectSkillScope(use.projectId)
        : personalSkillScope(use.userId);
    const skill = await skills.getByScopeAndName(scope, provenance.skill);

    if (skill) {
      uses.push({
        skillId: skill.id,
        revisionId: provenance.revisionId,
        userId: use.userId,
        runId: use.runId ?? null,
        conversationId: use.conversationId,
        activation: use.activation,
      });
    }
  }

  await repositories.get(SkillUseRepository).record(uses);
}
