import type { ProjectCapabilityKind } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getRecipeById } from "~/modules/apps/application/recipes";
import { getExperienceCatalog } from "~/modules/experiences/application/config";
import { getSkillDefinition } from "~/modules/skills/application";
import { canAccessTeammate } from "~/modules/teammates/application/access";

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
