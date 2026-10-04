import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { modelDeployment } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export type ModelDeploymentRecord = typeof modelDeployment.$inferSelect;

const LIVE_STATUSES: Array<ModelDeploymentRecord["status"]> = [
  "pending",
  "provisioning",
  "running",
  "scaled_to_zero",
  "paused",
  "updating",
  "deleting",
];

export class ModelDeploymentRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async recordProviderState(
    id: string,
    previousRef: string | null,
    changes: Pick<
      ModelDeploymentRecord,
      "status" | "provider_ref" | "region" | "hourly_usd" | "failure_reason" | "last_checked_at"
    >,
  ): Promise<ModelDeploymentRecord | null> {
    const [record] = await this.database
      .update(modelDeployment)
      .set({
        ...changes,
        ...(changes.provider_ref !== previousRef ? { provisioning_started_at: null } : {}),
        updated_at: new Date().toISOString(),
      })
      .where(
        and(
          eq(modelDeployment.id, id),
          previousRef === null
            ? isNull(modelDeployment.provider_ref)
            : eq(modelDeployment.provider_ref, previousRef),
        ),
      )
      .returning();

    return record ?? this.getById(id);
  }

  async claimProvisioningContinuation(id: string, providerRef: string): Promise<boolean> {
    const [record] = await this.database
      .update(modelDeployment)
      .set({ provisioning_started_at: new Date().toISOString() })
      .where(
        and(
          eq(modelDeployment.id, id),
          eq(modelDeployment.provider_ref, providerRef),
          isNull(modelDeployment.provisioning_started_at),
        ),
      )
      .returning({ id: modelDeployment.id });

    return record !== undefined;
  }

  async claimProvisioning(id: string): Promise<ModelDeploymentRecord | null> {
    const now = new Date().toISOString();
    const [record] = await this.database
      .update(modelDeployment)
      .set({
        status: "provisioning",
        provisioning_started_at: now,
        last_checked_at: now,
        updated_at: now,
      })
      .where(
        and(
          eq(modelDeployment.id, id),
          eq(modelDeployment.status, "pending"),
          eq(modelDeployment.desired_state, "running"),
          isNull(modelDeployment.provider_ref),
          isNull(modelDeployment.provisioning_started_at),
        ),
      )
      .returning();

    return record ?? null;
  }

  async create(input: {
    workspaceId: string;
    projectId: string | null;
    name: string;
    versionId: string;
    spec: ModelDeploymentRecord["spec"];
    specHash: string;
    provider: ModelDeploymentRecord["provider"];
    host: string;
    jurisdiction: ModelDeploymentRecord["jurisdiction"];
    weightsVerified: boolean;
    createdBy: number;
  }): Promise<ModelDeploymentRecord> {
    const [record] = await this.database
      .insert(modelDeployment)
      .values({
        id: generateId(),
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        name: input.name,
        version_id: input.versionId,
        spec: input.spec,
        spec_hash: input.specHash,
        provider: input.provider,
        host: input.host,
        jurisdiction: input.jurisdiction,
        weights_verified: input.weightsVerified,
        created_by: input.createdBy,
      })
      .returning();

    return record;
  }

  async get(workspaceId: string, id: string): Promise<ModelDeploymentRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelDeployment)
      .where(and(eq(modelDeployment.workspace_id, workspaceId), eq(modelDeployment.id, id)))
      .limit(1);

    return record ?? null;
  }

  async getById(id: string): Promise<ModelDeploymentRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelDeployment)
      .where(eq(modelDeployment.id, id))
      .limit(1);

    return record ?? null;
  }

  async list(
    workspaceId: string,
    filters: { projectId?: string | null; liveOnly?: boolean; versionIds?: string[] } = {},
  ) {
    const conditions = [eq(modelDeployment.workspace_id, workspaceId)];

    if (filters.projectId) {
      conditions.push(eq(modelDeployment.project_id, filters.projectId));
    }

    if (filters.liveOnly) {
      conditions.push(inArray(modelDeployment.status, LIVE_STATUSES));
    } else {
      conditions.push(ne(modelDeployment.status, "deleted"));
    }

    if (filters.versionIds) {
      if (filters.versionIds.length === 0) {
        return [];
      }

      conditions.push(inArray(modelDeployment.version_id, filters.versionIds));
    }

    return this.database
      .select()
      .from(modelDeployment)
      .where(and(...conditions))
      .orderBy(desc(modelDeployment.created_at));
  }

  async listLive(limit = 200): Promise<ModelDeploymentRecord[]> {
    return this.database
      .select()
      .from(modelDeployment)
      .where(inArray(modelDeployment.status, LIVE_STATUSES))
      .limit(limit);
  }

  async update(
    id: string,
    changes: Partial<
      Pick<
        ModelDeploymentRecord,
        | "status"
        | "desired_state"
        | "provider_ref"
        | "region"
        | "route_id"
        | "hourly_usd"
        | "failure_reason"
        | "last_checked_at"
        | "billed_until"
        | "spec"
        | "spec_hash"
      >
    >,
  ): Promise<void> {
    await this.database
      .update(modelDeployment)
      .set({ ...changes, updated_at: new Date().toISOString() })
      .where(eq(modelDeployment.id, id));
  }
}
