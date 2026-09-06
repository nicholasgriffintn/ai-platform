import type { ProjectCapabilityKind } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { getRecipeById } from "~/services/apps/recipes";
import { getExperienceCatalog } from "~/services/experiences/config";
import { getSkillDefinition } from "~/services/skills";
import { canAccessTeammate } from "~/services/teammates/access";
import { AssistantError, ErrorType } from "~/utils/errors";

export async function validateCapabilityReference(
  kind: ProjectCapabilityKind,
  capabilityId: string,
  context?: ServiceContext,
): Promise<void> {
  if (kind === "teammate") {
    const userId = context?.user?.id;
    const teammate =
      context && userId ? await context.repositories.teammates.getTeammateById(capabilityId) : null;

    if (!context || !userId || !teammate) {
      throw new AssistantError("Unknown teammate", ErrorType.NOT_FOUND, 404);
    }

    if (!(await canAccessTeammate(context, teammate, "read", userId))) {
      throw new AssistantError(
        "You can only attach an teammate you can access",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    return;
  }

  if (kind === "app") {
    const experience = getExperienceCatalog().find(
      (candidate) => candidate.capabilityId === capabilityId,
    );

    if (!experience) {
      throw new AssistantError("Unknown experience", ErrorType.NOT_FOUND, 404);
    }

    if (experience.scope === "personal") {
      throw new AssistantError(
        experience.scopeReason ?? `${experience.name} can only be used in personal scope.`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    return;
  }

  if (kind === "recipe" && !getRecipeById(capabilityId)) {
    throw new AssistantError("Unknown recipe", ErrorType.NOT_FOUND, 404);
  }

  if (kind === "skill") {
    const skill = await getSkillDefinition(capabilityId);

    if (!skill) {
      throw new AssistantError("Unknown skill", ErrorType.NOT_FOUND, 404);
    }

    if (skill.alwaysOn) {
      throw new AssistantError(
        `${skill.name} is always available and does not need to be enabled.`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }
}
