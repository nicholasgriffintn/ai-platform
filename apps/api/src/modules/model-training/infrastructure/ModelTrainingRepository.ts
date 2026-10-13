import { ACTIVE_TRAINING_RUN_STATUSES } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import {
  type ModelTrainingRunRecord,
  modelTrainingRun,
  type ModelTrainingCheckpointRecord,
  modelTrainingCheckpoint,
  modelTrainingCheckpointChanges,
  modelTrainingCheckpointValues,
  modelTrainingRunChanges,
  modelTrainingRunValues,
} from "~/infrastructure/database/model-storage";
import { modelOperation, modelRecord } from "~/infrastructure/database/schema";
import { publishModelPlatformChanged } from "~/modules/model-registry/application/sync-events";
import type { IEnv } from "~/types";

export type { ModelTrainingRunRecord } from "~/infrastructure/database/model-storage";
export type { ModelTrainingCheckpointRecord } from "~/infrastructure/database/model-storage";

export class ModelTrainingRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async claimSubmission(id: string): Promise<ModelTrainingRunRecord | null> {
    const now = new Date().toISOString();
    const [record] = await this.database
      .update(modelOperation)
      .set(
        modelTrainingRunChanges({
          status: "preparing",
          submission_started_at: now,
          last_checked_at: now,
        }),
      )
      .where(
        and(
          eq(modelOperation.kind, "training"),
          and(
            eq(modelTrainingRun.id, id),
            eq(modelTrainingRun.status, "queued"),
            isNull(modelTrainingRun.provider_job_id),
            isNull(modelTrainingRun.submission_started_at),
          ),
        ),
      )
      .returning(modelTrainingRun);

    await publishModelPlatformChanged(this.env, record?.workspace_id);

    return record ?? null;
  }

  async requestCancellation(
    workspaceId: string,
    id: string,
  ): Promise<ModelTrainingRunRecord | null> {
    const [record] = await this.database
      .update(modelOperation)
      .set(
        modelTrainingRunChanges({
          status: sql`CASE WHEN ${modelTrainingRun.submission_started_at} IS NULL AND ${modelTrainingRun.provider_job_id} IS NULL AND ${modelTrainingRun.status} = 'queued' THEN 'cancelled' ELSE 'cancelling' END`,
          failure_reason: "Cancellation requested by a workspace member",
        }),
      )
      .where(
        and(
          eq(modelOperation.kind, "training"),
          and(
            eq(modelTrainingRun.workspace_id, workspaceId),
            eq(modelTrainingRun.id, id),
            inArray(modelTrainingRun.status, [...ACTIVE_TRAINING_RUN_STATUSES]),
          ),
        ),
      )
      .returning(modelTrainingRun);

    await publishModelPlatformChanged(this.env, record?.workspace_id);

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
      .update(modelOperation)
      .set(
        modelTrainingRunChanges({
          ...changes,
          ...(changes.status && changes.status !== "cancelled"
            ? {
                status: sql`CASE WHEN ${modelTrainingRun.status} IN ('cancelling', 'cancelled') THEN ${modelTrainingRun.status} ELSE ${changes.status} END`,
              }
            : {}),
        }),
      )
      .where(and(eq(modelOperation.kind, "training"), eq(modelTrainingRun.id, id)))
      .returning(modelTrainingRun);

    await publishModelPlatformChanged(this.env, record?.workspace_id);

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
      .insert(modelOperation)
      .values(
        modelTrainingRunValues({
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
        }),
      )
      .returning(modelTrainingRun);

    await publishModelPlatformChanged(this.env, record?.workspace_id);

    return record;
  }

  async get(workspaceId: string, id: string): Promise<ModelTrainingRunRecord | null> {
    const [record] = await this.database
      .select(modelTrainingRun)
      .from(modelOperation)
      .where(
        and(
          eq(modelOperation.kind, "training"),
          and(eq(modelTrainingRun.workspace_id, workspaceId), eq(modelTrainingRun.id, id)),
        ),
      )
      .limit(1);

    return record ?? null;
  }

  async getById(id: string): Promise<ModelTrainingRunRecord | null> {
    const [record] = await this.database
      .select(modelTrainingRun)
      .from(modelOperation)
      .where(and(eq(modelOperation.kind, "training"), eq(modelTrainingRun.id, id)))
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
      .select(modelTrainingRun)
      .from(modelOperation)
      .where(and(eq(modelOperation.kind, "training"), and(...conditions)))
      .orderBy(desc(modelTrainingRun.created_at))
      .limit(200);
  }

  async listActive(limit = 100): Promise<ModelTrainingRunRecord[]> {
    return this.database
      .select(modelTrainingRun)
      .from(modelOperation)
      .where(
        and(
          eq(modelOperation.kind, "training"),
          inArray(modelTrainingRun.status, [...ACTIVE_TRAINING_RUN_STATUSES]),
        ),
      )
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
    const [changed] = await this.database
      .update(modelOperation)
      .set(modelTrainingRunChanges(changes))
      .where(and(eq(modelOperation.kind, "training"), eq(modelTrainingRun.id, id)))
      .returning({ workspaceId: modelTrainingRun.workspace_id });

    await publishModelPlatformChanged(this.env, changed?.workspaceId);
  }

  async listCheckpoints(runId: string): Promise<ModelTrainingCheckpointRecord[]> {
    return this.database
      .select(modelTrainingCheckpoint)
      .from(modelRecord)
      .where(and(eq(modelRecord.kind, "checkpoint"), eq(modelTrainingCheckpoint.run_id, runId)))
      .orderBy(modelTrainingCheckpoint.step);
  }

  async upsertCheckpoint(input: {
    runId: string;
    step: number;
    providerRef: string;
    metrics: Record<string, number>;
  }): Promise<ModelTrainingCheckpointRecord> {
    const [record] = await this.database
      .insert(modelRecord)
      .values(
        modelTrainingCheckpointValues({
          id: generateId(),
          run_id: input.runId,
          step: input.step,
          provider_ref: input.providerRef,
          metrics: input.metrics,
        }),
      )
      .onConflictDoUpdate({
        target: [modelRecord.operation_id, modelRecord.ordinal],
        set: modelTrainingCheckpointChanges({
          provider_ref: input.providerRef,
          metrics: input.metrics,
        }),
      })
      .returning(modelTrainingCheckpoint);

    const run = await this.getById(input.runId);

    await publishModelPlatformChanged(this.env, run?.workspace_id);

    return record;
  }

  async setCheckpointVersion(id: string, versionId: string): Promise<void> {
    const [checkpoint] = await this.database
      .update(modelRecord)
      .set(modelTrainingCheckpointChanges({ version_id: versionId }))
      .where(and(eq(modelRecord.kind, "checkpoint"), eq(modelTrainingCheckpoint.id, id)))
      .returning(modelTrainingCheckpoint);

    if (checkpoint) {
      const run = await this.getById(checkpoint.run_id);

      await publishModelPlatformChanged(this.env, run?.workspace_id);
    }
  }
}
