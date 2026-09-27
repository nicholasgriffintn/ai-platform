import { ACTIVE_TRAINING_RUN_STATUSES } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { modelTrainingCheckpoint, modelTrainingRun } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export type ModelTrainingRunRecord = typeof modelTrainingRun.$inferSelect;
export type ModelTrainingCheckpointRecord = typeof modelTrainingCheckpoint.$inferSelect;

export class ModelTrainingRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async claimSubmission(id: string): Promise<ModelTrainingRunRecord | null> {
    const now = new Date().toISOString();
    const [record] = await this.database
      .update(modelTrainingRun)
      .set({
        status: "preparing",
        submission_started_at: now,
        last_checked_at: now,
      })
      .where(
        and(
          eq(modelTrainingRun.id, id),
          eq(modelTrainingRun.status, "queued"),
          isNull(modelTrainingRun.provider_job_id),
          isNull(modelTrainingRun.submission_started_at),
        ),
      )
      .returning();

    return record ?? null;
  }

  async requestCancellation(
    workspaceId: string,
    id: string,
  ): Promise<ModelTrainingRunRecord | null> {
    const [record] = await this.database
      .update(modelTrainingRun)
      .set({
        status: sql`CASE WHEN ${modelTrainingRun.submission_started_at} IS NULL AND ${modelTrainingRun.provider_job_id} IS NULL AND ${modelTrainingRun.status} = 'queued' THEN 'cancelled' ELSE 'cancelling' END`,
        failure_reason: "Cancellation requested by a workspace member",
      })
      .where(
        and(
          eq(modelTrainingRun.workspace_id, workspaceId),
          eq(modelTrainingRun.id, id),
          inArray(modelTrainingRun.status, [...ACTIVE_TRAINING_RUN_STATUSES]),
        ),
      )
      .returning();

    return record ?? null;
  }

  async recordProviderState(
    id: string,
    changes: Partial<
      Pick<
        ModelTrainingRunRecord,
        | "status"
        | "provider_job_id"
        | "output_version_id"
        | "cost_usd"
        | "failure_reason"
        | "started_at"
        | "completed_at"
        | "last_checked_at"
      >
    >,
  ): Promise<ModelTrainingRunRecord | null> {
    const [record] = await this.database
      .update(modelTrainingRun)
      .set({
        ...changes,
        ...(changes.status && changes.status !== "cancelled"
          ? {
              status: sql`CASE WHEN ${modelTrainingRun.status} IN ('cancelling', 'cancelled') THEN ${modelTrainingRun.status} ELSE ${changes.status} END`,
            }
          : {}),
      })
      .where(eq(modelTrainingRun.id, id))
      .returning();

    return record ?? null;
  }

  async create(input: {
    workspaceId: string;
    projectId: string | null;
    spec: ModelTrainingRunRecord["spec"];
    specHash: string;
    provider: ModelTrainingRunRecord["provider"];
    trainer: string;
    outputRepository: string | null;
    datasetVersionIds: string[];
    estimate: ModelTrainingRunRecord["estimate"];
    compute: ModelTrainingRunRecord["compute"];
    createdBy: number;
  }): Promise<ModelTrainingRunRecord> {
    const [record] = await this.database
      .insert(modelTrainingRun)
      .values({
        id: generateId(),
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        spec: input.spec,
        spec_hash: input.specHash,
        provider: input.provider,
        trainer: input.trainer,
        output_repository: input.outputRepository,
        dataset_version_ids: input.datasetVersionIds,
        estimate: input.estimate,
        compute: input.compute,
        created_by: input.createdBy,
      })
      .returning();

    return record;
  }

  async get(workspaceId: string, id: string): Promise<ModelTrainingRunRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelTrainingRun)
      .where(and(eq(modelTrainingRun.workspace_id, workspaceId), eq(modelTrainingRun.id, id)))
      .limit(1);

    return record ?? null;
  }

  async getById(id: string): Promise<ModelTrainingRunRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelTrainingRun)
      .where(eq(modelTrainingRun.id, id))
      .limit(1);

    return record ?? null;
  }

  async list(
    workspaceId: string,
    projectId?: string | null,
    activeOnly = false,
  ): Promise<ModelTrainingRunRecord[]> {
    const conditions = [eq(modelTrainingRun.workspace_id, workspaceId)];

    if (projectId) {
      conditions.push(eq(modelTrainingRun.project_id, projectId));
    }

    if (activeOnly) {
      conditions.push(inArray(modelTrainingRun.status, [...ACTIVE_TRAINING_RUN_STATUSES]));
    }

    return this.database
      .select()
      .from(modelTrainingRun)
      .where(and(...conditions))
      .orderBy(desc(modelTrainingRun.created_at))
      .limit(200);
  }

  async listActive(limit = 100): Promise<ModelTrainingRunRecord[]> {
    return this.database
      .select()
      .from(modelTrainingRun)
      .where(inArray(modelTrainingRun.status, [...ACTIVE_TRAINING_RUN_STATUSES]))
      .limit(limit);
  }

  async update(
    id: string,
    changes: Partial<
      Pick<
        ModelTrainingRunRecord,
        | "status"
        | "provider_job_id"
        | "output_version_id"
        | "cost_usd"
        | "compute"
        | "failure_reason"
        | "started_at"
        | "completed_at"
        | "last_checked_at"
      >
    >,
  ): Promise<void> {
    await this.database.update(modelTrainingRun).set(changes).where(eq(modelTrainingRun.id, id));
  }

  async listCheckpoints(runId: string): Promise<ModelTrainingCheckpointRecord[]> {
    return this.database
      .select()
      .from(modelTrainingCheckpoint)
      .where(eq(modelTrainingCheckpoint.run_id, runId))
      .orderBy(modelTrainingCheckpoint.step);
  }

  async upsertCheckpoint(input: {
    runId: string;
    step: number;
    providerRef: string;
    metrics: Record<string, number>;
  }): Promise<ModelTrainingCheckpointRecord> {
    const [record] = await this.database
      .insert(modelTrainingCheckpoint)
      .values({
        id: generateId(),
        run_id: input.runId,
        step: input.step,
        provider_ref: input.providerRef,
        metrics: input.metrics,
      })
      .onConflictDoUpdate({
        target: [modelTrainingCheckpoint.run_id, modelTrainingCheckpoint.step],
        set: { provider_ref: input.providerRef, metrics: input.metrics },
      })
      .returning();

    return record;
  }

  async setCheckpointVersion(id: string, versionId: string): Promise<void> {
    await this.database
      .update(modelTrainingCheckpoint)
      .set({ version_id: versionId })
      .where(eq(modelTrainingCheckpoint.id, id));
  }
}
