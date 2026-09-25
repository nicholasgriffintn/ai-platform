import type { TrainingProviderId, TrainingRecipe } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import { and, desc, eq } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { modelBuild } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export type ModelBuildRecord = typeof modelBuild.$inferSelect;

export class ModelBuildRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async createBuild(input: {
    workspaceId: string;
    projectId: string | null;
    versionId: string;
    baseVersionId: string;
    datasetVersionId: string;
    provider: TrainingProviderId;
    jobName: string;
    recipe: TrainingRecipe;
    createdBy: number;
  }): Promise<ModelBuildRecord> {
    const [record] = await this.database
      .insert(modelBuild)
      .values({
        id: generateId(),
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        version_id: input.versionId,
        base_version_id: input.baseVersionId,
        dataset_version_id: input.datasetVersionId,
        provider: input.provider,
        job_name: input.jobName,
        recipe: input.recipe,
        created_by: input.createdBy,
      })
      .returning();

    return record;
  }

  async listBuilds(workspaceId: string, projectId?: string | null): Promise<ModelBuildRecord[]> {
    return this.database
      .select()
      .from(modelBuild)
      .where(
        projectId
          ? and(eq(modelBuild.workspace_id, workspaceId), eq(modelBuild.project_id, projectId))
          : eq(modelBuild.workspace_id, workspaceId),
      )
      .orderBy(desc(modelBuild.created_at))
      .limit(100);
  }

  async listRunning(limit = 50): Promise<ModelBuildRecord[]> {
    return this.database
      .select()
      .from(modelBuild)
      .where(eq(modelBuild.status, "running"))
      .orderBy(modelBuild.created_at)
      .limit(limit);
  }

  async finish(
    buildId: string,
    status: "completed" | "failed",
    failureReason: string | null,
  ): Promise<void> {
    await this.database
      .update(modelBuild)
      .set({ status, failure_reason: failureReason, completed_at: new Date().toISOString() })
      .where(eq(modelBuild.id, buildId));
  }
}
