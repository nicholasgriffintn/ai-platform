import {
  toListPage,
  type WorkInboxResponse,
  WORKSPACE_MANAGER_ROLES,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { listWaitingRunInboxItems } from "~/modules/conversations/application/waiting-items";
import { listOutdatedModelChoiceInboxItems } from "~/modules/models/application/choices";
import { listProjectTaskInboxItems } from "~/modules/project-tasks/application/inbox-items";
import { listTeammateInboxItems } from "~/modules/teammates/application/inbox-items";
import { canAccessWork } from "~/modules/workspaces/application/access";
import { listSetupInboxItems } from "~/modules/workspaces/application/onboarding";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

export async function getWorkInbox(context: ServiceContext): Promise<WorkInboxResponse> {
  const user = context.requireUser();
  const workspaces = canAccessWork(user)
    ? await context.repositories.get(WorkspaceRepository).listWorkspaces(user.id)
    : [];
  const workspaceIds = workspaces.map((workspace) => workspace.id);
  const managed = workspaces.filter((workspace) =>
    WORKSPACE_MANAGER_ROLES.includes(workspace.role),
  );
  const [waitingItems, teammateItems, taskItems, modelItems, projects] = await Promise.all([
    listWaitingRunInboxItems(context, { userId: user.id, workspaceIds: new Set(workspaceIds) }),
    listTeammateInboxItems(context, {
      workspaceIds,
      managedWorkspaceIds: new Set(managed.map((workspace) => workspace.id)),
    }),
    listProjectTaskInboxItems(context, { userId: user.id, workspaceIds }),
    listOutdatedModelChoiceInboxItems(context, managed),
    context.repositories.get(WorkspaceRepository).listProjectNamesForWorkspaces(workspaceIds),
  ]);
  const items = [
    ...waitingItems,
    ...teammateItems,
    ...taskItems,
    ...modelItems,
    ...listSetupInboxItems(managed),
  ].sort((left, right) => right.since.localeCompare(left.since));

  return {
    ...toListPage(items, items.length || 1, (item) => item.id),
    places: workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      projects: projects
        .filter((project) => project.workspace_id === workspace.id)
        .map((project) => ({ id: project.id, name: project.name })),
    })),
  };
}
