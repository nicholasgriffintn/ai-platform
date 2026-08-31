import type { ProjectCapabilityKind } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { canAccessAgent } from "~/services/agents/access";
import { getRecipeById } from "~/services/apps/recipes";
import { getExperienceCatalog } from "~/services/experiences/config";
import { getSkillDefinition } from "~/services/skills";
import { AssistantError, ErrorType } from "~/utils/errors";

export async function validateCapabilityReference(
  kind: ProjectCapabilityKind,
  capabilityId: string,
  context?: ServiceContext,
): Promise<void> {
  if (kind === "agent") {
    const userId = context?.user?.id;
    const agent =
      context && userId ? await context.repositories.agents.getAgentById(capabilityId) : null;

    if (!context || !userId || !agent) {
      throw new AssistantError("Unknown agent", ErrorType.NOT_FOUND, 404);
    }

    if (!(await canAccessAgent(context, agent, "read", userId))) {
      throw new AssistantError(
        "You can only attach an agent you can access",
        ErrorType.FORBIDDEN,
        403,
      );
    }

    return;
  }

  if (kind === "app") {
    const experiences = getExperienceCatalog();

    if (!experiences.some((experience) => experience.capabilityId === capabilityId)) {
      throw new AssistantError("Unknown experience", ErrorType.NOT_FOUND, 404);
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
