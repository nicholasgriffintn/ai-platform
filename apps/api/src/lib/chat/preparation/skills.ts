import type { RepositoryManager } from "~/repositories";
import {
  createProjectSkillScope,
  resolvePersonalSkillScope,
  resolveSkillCatalog,
  type RequestSkillScope,
} from "~/services/skills";
import type { ProjectChatContext } from "~/services/workspaces/chatContext";
import type { CoreChatOptions } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/preparation/skills" });

/**
 * Skill configuration is advisory: a failure to read it degrades to the default
 * personal scope rather than failing the turn.
 */
export async function resolveSkillScope(
  projectContext: ProjectChatContext | null,
  repositories: RepositoryManager | null,
  userId?: number,
): Promise<RequestSkillScope> {
  if (projectContext) {
    return createProjectSkillScope(projectContext.enabledSkillIds);
  }

  if (!repositories || !userId) {
    return { scope: "personal" };
  }

  try {
    return await resolvePersonalSkillScope(repositories.capabilityConfigurations, userId);
  } catch (error) {
    logger.warn("Failed to load personal skill configuration", { error, userId });

    return { scope: "personal" };
  }
}

export async function resolveScopedSkillCatalog(
  options: CoreChatOptions,
  projectContext: ProjectChatContext | null,
) {
  const user = options.context?.user;

  if (!options.context || !(projectContext || user?.id)) {
    return null;
  }

  try {
    return await resolveSkillCatalog(
      options.context,
      projectContext
        ? { type: "project", id: projectContext.projectId }
        : { type: "personal", id: user.id },
      projectContext ? new Set(projectContext.enabledSkillIds) : undefined,
    );
  } catch (error) {
    logger.warn("Failed to load authored skills", {
      error,
      projectId: projectContext?.projectId,
      userId: user?.id,
    });

    return null;
  }
}
