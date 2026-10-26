import {
  toListPage,
  type WorkInboxResponse,
  WORKSPACE_MANAGER_ROLES,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { listProjectTaskInboxItems } from "~/modules/project-tasks/application/inbox-items";
import { listTeammateInboxItems } from "~/modules/teammates/application/inbox-items";
import { requireWorkAccess } from "~/modules/workspaces/application/access";
import { listSetupInboxItems } from "~/modules/workspaces/application/onboarding";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

export async function getWorkInbox(context: ServiceContext): Promise<WorkInboxResponse> {
  const user = requireWorkAccess(context);
  const workspaces = await context.repositories.get(WorkspaceRepository).listWorkspaces(user.id);
  const workspaceIds = workspaces.map((workspace) => workspace.id);
  const managed = workspaces.filter((workspace) =>
    WORKSPACE_MANAGER_ROLES.includes(workspace.role),
  );
  const [teammateItems, taskItems] = await Promise.all([
    listTeammateInboxItems(context, {
      userId: user.id,
      workspaceIds,
      managedWorkspaceIds: new Set(managed.map((workspace) => workspace.id)),
    }),
    listProjectTaskInboxItems(context, { userId: user.id, workspaceIds }),
  ]);
  const items = [...teammateItems, ...taskItems, ...listSetupInboxItems(managed)].sort(
    (left, right) => right.since.localeCompare(left.since),
  );

  return toListPage(items, items.length || 1, (item) => item.id);
}
