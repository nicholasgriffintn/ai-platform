import type { ModelPlatformAction } from "@ngriffin_uk/polychat-schemas";
import { eq } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { workspace } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export interface ModelPermissionRecord {
  workspace_id: string;
  grants: { admin: ModelPlatformAction[]; member: ModelPlatformAction[] };
  separation_of_duties: boolean;
  updated_by: number | null;
  updated_at: string;
}

export class ModelPermissionRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async get(workspaceId: string): Promise<ModelPermissionRecord | null> {
    const [record] = await this.database
      .select({
        permissions: workspace.model_permissions,
        updatedBy: workspace.model_permissions_updated_by,
      })
      .from(workspace)
      .where(eq(workspace.id, workspaceId))
      .limit(1);

    return record?.permissions
      ? { workspace_id: workspaceId, ...record.permissions, updated_by: record.updatedBy }
      : null;
  }

  async save(input: {
    workspaceId: string;
    grants: { admin: ModelPlatformAction[]; member: ModelPlatformAction[] };
    separationOfDuties: boolean;
    updatedBy: number;
  }): Promise<ModelPermissionRecord> {
    const permissions = {
      grants: input.grants,
      separation_of_duties: input.separationOfDuties,
      updated_at: new Date().toISOString(),
    };
    const [record] = await this.database
      .update(workspace)
      .set({ model_permissions: permissions, model_permissions_updated_by: input.updatedBy })
      .where(eq(workspace.id, input.workspaceId))
      .returning({ id: workspace.id });

    if (!record) {
      throw new Error("Workspace not found");
    }

    return { workspace_id: record.id, ...permissions, updated_by: input.updatedBy };
  }
}
