import type { ProjectDetail, ProjectStarterSummary } from "@ngriffin_uk/polychat-schemas";
import {
  deriveProjectColour,
  findProjectStarter,
  findTeammateRole,
  PROJECT_STARTERS,
} from "@ngriffin_uk/polychat-schemas";

import { validateCapabilityReference } from "~/lib/capabilities";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { hireTeammate } from "~/services/teammates/hire";
import { getProject } from "~/services/workspaces";
import { requireWorkspaceAccess } from "~/services/workspaces/access";
import { validateProjectToolConfiguration } from "~/services/workspaces/projectTools";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

export function listProjectStarters(): { starters: ProjectStarterSummary[] } {
  return {
    starters: PROJECT_STARTERS.map((starter) => ({
      slug: starter.slug,
      name: starter.name,
      description: starter.description,
      when: starter.when,
      teammates: starter.teammates.map((teammate) => ({
        roleSlug: teammate.roleSlug,
        name: teammate.name,
        title: findTeammateRole(teammate.roleSlug)?.title ?? teammate.name,
      })),
      apps: [...starter.apps],
      tools: [...starter.tools],
    })),
  };
}

export async function instantiateProjectStarter(
  context: ServiceContext,
  userId: number,
  slug: string,
  workspaceId: string,
  name?: string,
): Promise<ProjectDetail> {
  const starter = findProjectStarter(slug);

  if (!starter) {
    throw new AssistantError("Unknown project starter", ErrorType.NOT_FOUND, 404);
  }

  await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);

  const capabilities: Array<{
    id: string;
    kind: "app" | "tool" | "teammate";
    capabilityId: string;
    configuration: Record<string, unknown>;
  }> = [];

  for (const teammate of starter.teammates) {
    const hired = await hireTeammate(context, {
      role_slug: teammate.roleSlug,
      name: teammate.name,
      workspace_id: workspaceId,
    });

    capabilities.push({
      id: generateId(),
      kind: "teammate",
      capabilityId: hired.id,
      configuration: {},
    });
  }

  for (const capabilityId of starter.apps) {
    await validateCapabilityReference("app", capabilityId, context);
    capabilities.push({ id: generateId(), kind: "app", capabilityId, configuration: {} });
  }

  for (const toolId of starter.tools) {
    capabilities.push({
      id: generateId(),
      kind: "tool",
      capabilityId: toolId,
      configuration: validateProjectToolConfiguration(toolId, {}),
    });
  }

  const projectId = generateId();
  const projectName = name ?? starter.name;

  await context.repositories.workspaces.createProjectWithCapabilities(
    {
      id: projectId,
      workspaceId,
      name: projectName,
      description: starter.description,
      instructions: starter.instructions,
      colour: deriveProjectColour(projectName, starter.description),
      createdBy: userId,
    },
    capabilities,
  );
  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "starter.instantiated",
    targetType: "project",
    targetId: projectId,
    metadata: { starterSlug: starter.slug },
  });

  return getProject(context, projectId);
}
