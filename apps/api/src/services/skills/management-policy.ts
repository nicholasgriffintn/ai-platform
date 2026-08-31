import type { ServiceContext } from "~/lib/context/serviceContext";
import type { AuthoredSkillScope } from "~/repositories/AuthoredSkillRepository";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

import { parseUserSkillDocument, SkillDocumentError } from "./document";
import { SKILL_CAPABILITY_KIND } from "./scope";

export const personalSkillScope = (userId: number): AuthoredSkillScope => ({
  type: "personal",
  id: userId,
});

export const projectSkillScope = (projectId: string): AuthoredSkillScope => ({
  type: "project",
  id: projectId,
});

export function parseAuthoredSkillDocument(content: string) {
  try {
    return parseUserSkillDocument(content);
  } catch (error) {
    if (error instanceof SkillDocumentError) {
      throw new AssistantError(error.message, ErrorType.PARAMS_ERROR, 400);
    }

    throw error;
  }
}

export async function getPublishedSkillCapability(
  context: ServiceContext,
  projectId: string,
  name: string,
) {
  return (await context.repositories.workspaces.listProjectCapabilities(projectId)).find(
    (capability) => capability.kind === SKILL_CAPABILITY_KIND && capability.capability_id === name,
  );
}

export async function requirePublishedProjectSkill(
  context: ServiceContext,
  projectId: string,
  skillId: string,
) {
  const capability = await getPublishedSkillCapability(context, projectId, skillId);

  if (!capability) {
    throw new AssistantError("Skill not found", ErrorType.NOT_FOUND, 404);
  }

  return capability;
}

export async function requireProjectSkillAdministration(
  context: ServiceContext,
  projectId: string,
  skillId: string,
): ReturnType<typeof requireProjectAccess> {
  const access = await requireProjectAccess(context, projectId, ["owner", "admin"]);

  await requirePublishedProjectSkill(context, projectId, skillId);

  return access;
}
