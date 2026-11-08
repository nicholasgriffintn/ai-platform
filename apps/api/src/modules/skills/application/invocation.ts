import {
  getBuiltInSkillCatalogue,
  type SkillCatalog,
} from "@ngriffin_uk/polychat-library-skills-catalogue";
import { canModelInvokeSkill, type SkillAvailability } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { PerMessageSkill } from "./per-message";

export function listModelInvocableSkills(
  skills: readonly SkillAvailability[] | undefined,
  invokedSkillId?: string,
): SkillAvailability[] {
  return (skills ?? []).filter(
    (skill) => skill.state === "ready" && canModelInvokeSkill(skill, invokedSkillId),
  );
}

export function resolveInvokedSkill(params: {
  invokedSkillId: string | undefined;
  skills: readonly SkillAvailability[];
  catalog: SkillCatalog | null | undefined;
}): PerMessageSkill | null {
  if (!params.invokedSkillId) {
    return null;
  }

  const skill = params.skills.find(
    (candidate) => candidate.id === params.invokedSkillId && candidate.state === "ready",
  );
  const body = skill?.userInvocable
    ? (params.catalog ?? getBuiltInSkillCatalogue()).loadRuntime(skill.id)?.content.body.trim()
    : undefined;

  if (!skill || !body) {
    throw new AssistantError(
      `The ${params.invokedSkillId} skill cannot be used in this conversation.`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return { id: skill.id, name: skill.name, body };
}

export function withInvokedSkill(
  invoked: PerMessageSkill | null,
  skills: readonly PerMessageSkill[],
): PerMessageSkill[] {
  return invoked ? [invoked, ...skills.filter((skill) => skill.id !== invoked.id)] : [...skills];
}
