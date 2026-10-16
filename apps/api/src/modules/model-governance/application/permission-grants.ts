import {
  MODEL_PLATFORM_ACTIONS,
  type ModelPlatformAction,
  type WorkspaceRole,
} from "@ngriffin_uk/polychat-schemas";

import type { Repositories } from "~/infrastructure/database/repositories";
import { ModelPermissionRepository } from "~/modules/model-governance/infrastructure/ModelPermissionRepository";

export const DEFAULT_MEMBER_ACTIONS: ModelPlatformAction[] = [
  "view",
  "import",
  "upload",
  "build_datasets",
  "train",
  "deploy",
];

const ALL_ACTIONS = [...MODEL_PLATFORM_ACTIONS];

export interface ResolvedPermissions {
  grants: Record<WorkspaceRole, ModelPlatformAction[]>;
  separationOfDuties: boolean;
  updatedAt: string | null;
  updatedBy: number | null;
}

export function withView(actions: readonly ModelPlatformAction[]): ModelPlatformAction[] {
  return [...new Set<ModelPlatformAction>(["view", ...actions])];
}

export async function loadModelPermissions(
  repositories: Repositories,
  workspaceId: string,
): Promise<ResolvedPermissions> {
  const record = await repositories.get(ModelPermissionRepository).get(workspaceId);

  return {
    grants: {
      owner: ALL_ACTIONS,
      admin: withView(record?.grants.admin ?? ALL_ACTIONS),
      member: withView(record?.grants.member ?? DEFAULT_MEMBER_ACTIONS),
    },
    separationOfDuties: record?.separation_of_duties ?? false,
    updatedAt: record?.updated_at ?? null,
    updatedBy: record?.updated_by ?? null,
  };
}

export function actionsForRole(
  permissions: ResolvedPermissions,
  role: WorkspaceRole,
): ModelPlatformAction[] {
  return permissions.grants[role];
}
