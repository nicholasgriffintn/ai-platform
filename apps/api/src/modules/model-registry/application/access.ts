import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  requireWorkspaceAccess,
  type WorkspaceAccess,
} from "~/modules/workspaces/application/access";

export interface RegistryAccess extends WorkspaceAccess {
  userId: number;
  canGovern: boolean;
}

export async function requireRegistryMember(
  context: ServiceContext,
  workspaceId: string,
): Promise<RegistryAccess> {
  const access = await requireWorkspaceAccess(context, workspaceId);

  return {
    ...access,
    userId: context.requireUser().id,
    canGovern: access.role === "owner" || access.role === "admin",
  };
}

export async function requireRegistryGovernor(
  context: ServiceContext,
  workspaceId: string,
): Promise<RegistryAccess> {
  const access = await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);

  return { ...access, userId: context.requireUser().id, canGovern: true };
}

export async function requireWorkspaceProject(
  context: ServiceContext,
  workspaceId: string,
  projectId: string | null | undefined,
): Promise<string | null> {
  if (!projectId) {
    return null;
  }

  const project = await context.repositories.workspaces.getProject(projectId);

  if (!project || project.workspace_id !== workspaceId) {
    throw new AssistantError("Project not found in this workspace", ErrorType.NOT_FOUND, 404);
  }

  return project.id;
}

export function notFound(what: string): AssistantError {
  return new AssistantError(`${what} not found`, ErrorType.NOT_FOUND, 404);
}
