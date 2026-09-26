import type { ModelPlatformAction } from "@ngriffin_uk/polychat-schemas";
import { eq } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { modelPermission } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export type ModelPermissionRecord = typeof modelPermission.$inferSelect;

export class ModelPermissionRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async get(workspaceId: string): Promise<ModelPermissionRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelPermission)
      .where(eq(modelPermission.workspace_id, workspaceId))
      .limit(1);

    return record ?? null;
  }

  async save(input: {
    workspaceId: string;
    grants: { admin: ModelPlatformAction[]; member: ModelPlatformAction[] };
    separationOfDuties: boolean;
    updatedBy: number;
  }): Promise<ModelPermissionRecord> {
    const values = {
      grants: input.grants,
      separation_of_duties: input.separationOfDuties,
      updated_by: input.updatedBy,
      updated_at: new Date().toISOString(),
    };
    const [record] = await this.database
      .insert(modelPermission)
      .values({ workspace_id: input.workspaceId, ...values })
      .onConflictDoUpdate({ target: modelPermission.workspace_id, set: values })
      .returning();

    return record;
  }
}
