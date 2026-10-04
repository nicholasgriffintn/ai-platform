import { authorise } from "@ngriffin_uk/polychat-library-policy";
import type { ModelPlatformAction } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { loadModelPermissions } from "~/modules/model-governance/application/permission-grants";
import {
  requireWorkspaceAccess,
  type WorkspaceAccess,
} from "~/modules/workspaces/application/access";

export interface RegistryAccess extends WorkspaceAccess {
  userId: number;
  actions: ReadonlySet<ModelPlatformAction>;
  separationOfDuties: boolean;
}

const ACTION_LABELS: Record<ModelPlatformAction, string> = {
  view: "view models",
  import: "import models and datasets",
  upload: "upload weights and data",
  build_datasets: "build datasets",
  train: "start training runs",
  deploy: "deploy models",
  promote: "move aliases",
  approve: "approve models and spend",
  manage_policy: "change model policy",
  manage_connections: "manage provider connections",
  manage_budgets: "manage budgets",
};

export async function requireModelAction(
  context: ServiceContext,
  workspaceId: string,
  action: ModelPlatformAction,
): Promise<RegistryAccess> {
  const access = await requireWorkspaceAccess(context, workspaceId);
  const permissions = await loadModelPermissions(context.repositories, workspaceId);
  const actions = new Set(permissions.grants[access.role]);

  const isAuthorised = authorise("model.action", {
    member: true,
    role: access.role,
    grants: [...actions],
    requestedAction: action,
  }).allowed;

  if (!isAuthorised) {
    throw new AssistantError(
      `Your role cannot ${ACTION_LABELS[action]} in this workspace`,
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return {
    ...access,
    userId: context.requireUser().id,
    actions,
    separationOfDuties: permissions.separationOfDuties,
  };
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

export function conflict(message: string): AssistantError {
  return new AssistantError(message, ErrorType.CONFLICT_ERROR, 409);
}

export function badRequest(message: string): AssistantError {
  return new AssistantError(message, ErrorType.PARAMS_ERROR, 400);
}
