import { SKILL_LOAD_TOOL_NAME, type SkillAvailability } from "@ngriffin_uk/polychat-schemas";

import { listModelInvocableSkills } from "./invocation";

export function getSkillSuggestedToolNames(
  skills: readonly SkillAvailability[] | undefined,
  invokedSkillId?: string,
): string[] {
  return Array.from(
    new Set(
      listModelInvocableSkills(skills, invokedSkillId).flatMap(
        (skill) => skill.requirement.suggestedTools,
      ),
    ),
  );
}

export function mergeSkillSuggestedToolNames(params: {
  enabledTools?: readonly string[];
  skills?: readonly SkillAvailability[];
  deferSuggestedTools?: boolean;
  invokedSkillId?: string;
}): string[] {
  if (params.deferSuggestedTools) {
    return Array.from(new Set(params.enabledTools ?? []));
  }

  return Array.from(
    new Set([
      ...(params.enabledTools ?? []),
      ...getSkillSuggestedToolNames(params.skills, params.invokedSkillId),
    ]),
  );
}

export function mergeSkillLoadToolName(params: {
  enabledTools?: readonly string[];
  skills?: readonly SkillAvailability[];
  invokedSkillId?: string;
}): string[] | undefined {
  if (params.enabledTools === undefined) {
    return undefined;
  }

  if (listModelInvocableSkills(params.skills, params.invokedSkillId).length === 0) {
    return [...params.enabledTools];
  }

  return Array.from(new Set([...params.enabledTools, SKILL_LOAD_TOOL_NAME]));
}
