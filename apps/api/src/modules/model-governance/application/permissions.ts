import type {
  ModelPermissions,
  MyModelPermissions,
  SaveModelPermissionsRequest,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireModelAction } from "~/modules/model-registry/application/access";

import { loadModelPermissions, withView } from "./permission-grants";

export async function getModelPermissions(
  context: ServiceContext,
  workspaceId: string,
): Promise<ModelPermissions> {
  await requireModelAction(context, workspaceId, "view");

  const permissions = await loadModelPermissions(context.repositories, workspaceId);

  return { workspaceId, ...permissions };
}

export async function getMyModelPermissions(
  context: ServiceContext,
  workspaceId: string,
): Promise<MyModelPermissions> {
  const access = await requireModelAction(context, workspaceId, "view");

  return {
    role: access.role,
    actions: [...access.actions],
    separationOfDuties: access.separationOfDuties,
  };
}

export async function saveModelPermissions(
  context: ServiceContext,
  workspaceId: string,
  request: SaveModelPermissionsRequest,
): Promise<ModelPermissions> {
  const { userId } = await requireModelAction(context, workspaceId, "manage_policy");

  await context.repositories.modelPermissions.save({
    workspaceId,
    grants: { admin: withView(request.grants.admin), member: withView(request.grants.member) },
    separationOfDuties: request.separationOfDuties,
    updatedBy: userId,
  });
  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_permissions.updated",
    targetType: "model_permissions",
    targetId: workspaceId,
    metadata: { ...request },
  });

  return getModelPermissions(context, workspaceId);
}
