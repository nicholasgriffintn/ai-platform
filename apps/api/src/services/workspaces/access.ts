import type { WorkspaceRole } from "@ngriffin_uk/polychat-schemas";
import { z } from "zod/v4";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ProjectRow, WorkspaceRow } from "~/repositories/WorkspaceRepository";
import { AssistantError, ErrorType } from "~/utils/errors";

export interface WorkspaceAccess {
  workspace: WorkspaceRow;
  role: WorkspaceRole;
}

export const projectScopeQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
});

export function requireWorkAccess(context: ServiceContext) {
  const user = context.requireUser();

  if (user.plan_id !== "pro") {
    throw new AssistantError("Workspaces require a Pro plan", ErrorType.AUTHORISATION_ERROR, 403);
  }

  return user;
}

export async function requireWorkspaceAccess(
  context: ServiceContext,
  workspaceId: string,
  allowedRoles: readonly WorkspaceRole[] = ["owner", "admin", "member"],
): Promise<WorkspaceAccess> {
  const user = requireWorkAccess(context);
  const [workspace, membership] = await Promise.all([
    context.repositories.workspaces.getWorkspace(workspaceId),
    context.repositories.workspaces.getMembership(workspaceId, user.id),
  ]);

  if (!workspace || !membership) {
    throw new AssistantError("Workspace not found", ErrorType.NOT_FOUND, 404);
  }

  if (!allowedRoles.includes(membership.role)) {
    throw new AssistantError("You do not have access to this workspace", ErrorType.FORBIDDEN, 403);
  }

  return { workspace, role: membership.role };
}

export async function requireProjectAccess(
  context: ServiceContext,
  projectId: string,
  allowedRoles: readonly WorkspaceRole[] = ["owner", "admin", "member"],
): Promise<{ project: ProjectRow; role: WorkspaceRole }> {
  requireWorkAccess(context);
  const project = await context.repositories.workspaces.getProject(projectId);

  if (!project) {
    throw new AssistantError("Project not found", ErrorType.NOT_FOUND, 404);
  }

  const { role } = await requireWorkspaceAccess(context, project.workspace_id, allowedRoles);

  return { project, role };
}

export async function requireProjectCapabilityAccess(
  context: ServiceContext,
  projectId: string,
  kind: "app" | "recipe" | "skill" | "tool",
  capabilityId: string,
): Promise<void> {
  await requireProjectAccess(context, projectId);
  const capabilities = await context.repositories.workspaces.listProjectCapabilities(projectId);
  const isEnabled = capabilities.some(
    (capability) => capability.kind === kind && capability.capability_id === capabilityId,
  );

  if (!isEnabled) {
    throw new AssistantError(
      "Capability is not available in this project",
      ErrorType.NOT_FOUND,
      404,
    );
  }
}
