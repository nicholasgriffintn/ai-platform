import type { SkillSummary } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { requireProjectAccess } from "~/services/workspaces/access";

import { listSkillSummaries, resolveSkillCatalog } from "./catalog";
import { resolveProjectSkillGrants } from "./scope";

export async function listScopedSkillSummaries(
  context: ServiceContext,
  userId?: number,
  projectId?: string,
): Promise<SkillSummary[]> {
  if (projectId) {
    await requireProjectAccess(context, projectId);
    const capabilities = await context.repositories.workspaces.listProjectCapabilities(projectId);
    const enabledNames = new Set(resolveProjectSkillGrants(capabilities));

    return (
      await resolveSkillCatalog(context, { type: "project", id: projectId }, enabledNames)
    ).listSummaries();
  }

  if (userId) {
    return (await resolveSkillCatalog(context, { type: "personal", id: userId })).listSummaries();
  }

  return listSkillSummaries();
}
