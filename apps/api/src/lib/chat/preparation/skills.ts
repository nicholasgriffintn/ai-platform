import type { RepositoryManager } from "~/repositories";
import {
  createProjectSkillScope,
  resolvePersonalSkillScope,
  resolveSkillCatalog,
  type RequestSkillScope,
} from "~/services/skills";
import { seedRequestSkillRuntime } from "~/services/skills/runtime-state";
import type { ProjectChatContext } from "~/services/workspaces/chatContext";
import type { CoreChatOptions } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/preparation/skills" });

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
    const catalog = await resolveSkillCatalog(
      options.context,
      projectContext
        ? { type: "project", id: projectContext.projectId }
        : { type: "personal", id: user.id },
      projectContext ? new Set(projectContext.enabledSkillIds) : undefined,
    );

    seedRequestSkillRuntime(options.context.requestCache, catalog);

    return catalog;
  } catch (error) {
    logger.warn("Failed to load authored skills", {
      error,
      projectId: projectContext?.projectId,
      userId: user?.id,
    });

    return null;
  }
}
