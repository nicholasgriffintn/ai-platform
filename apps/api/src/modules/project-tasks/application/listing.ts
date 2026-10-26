import type { ProjectTask } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { requireWorkAccess, requireWorkspaceAccess } from "~/modules/workspaces/application/access";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

export async function listMyWorkTasks(
  context: ServiceContext,
  includeDone = false,
): Promise<{ tasks: ProjectTask[] }> {
  const user = requireWorkAccess(context);
  const workspaces = await context.repositories.get(WorkspaceRepository).listWorkspaces(user.id);
  const tasks = await context.repositories.get(ProjectTaskRepository).listWorkspaceTasks(
    workspaces.map((workspace) => workspace.id),
    { ownerOrResponsibleUserId: user.id, includeDone },
  );

  return { tasks: tasks.filter((task) => task.kind !== "standup") };
}

export async function listWorkspaceWorkTasks(
  context: ServiceContext,
  workspaceId: string,
  filters: { ownerTeammateId?: string; includeDone?: boolean },
): Promise<{ tasks: ProjectTask[] }> {
  await requireWorkspaceAccess(context, workspaceId);

  return {
    tasks: await context.repositories.get(ProjectTaskRepository).listWorkspaceTasks([workspaceId], {
      ...(filters.ownerTeammateId
        ? { ownerTeammateId: filters.ownerTeammateId, reviewerTeammateId: filters.ownerTeammateId }
        : {}),
      includeDone: filters.includeDone,
    }),
  };
}
