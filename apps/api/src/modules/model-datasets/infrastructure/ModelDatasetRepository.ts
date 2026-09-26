import { and, eq, inArray } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { modelDatasetProfile } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export type ModelDatasetProfileRecord = typeof modelDatasetProfile.$inferSelect;

export class ModelDatasetRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async create(input: {
    versionId: string;
    workspaceId: string;
    shape: ModelDatasetProfileRecord["shape"];
    mapping: ModelDatasetProfileRecord["mapping"];
    governance: ModelDatasetProfileRecord["governance"];
    collectionMethod: ModelDatasetProfileRecord["collection_method"];
    sourceRef: string;
    request: Record<string, unknown>;
  }): Promise<ModelDatasetProfileRecord> {
    const [record] = await this.database
      .insert(modelDatasetProfile)
      .values({
        version_id: input.versionId,
        workspace_id: input.workspaceId,
        shape: input.shape,
        mapping: input.mapping,
        governance: input.governance,
        collection_method: input.collectionMethod,
        source_ref: input.sourceRef,
        request: input.request,
      })
      .returning();

    return record;
  }

  async get(versionId: string): Promise<ModelDatasetProfileRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelDatasetProfile)
      .where(eq(modelDatasetProfile.version_id, versionId))
      .limit(1);

    return record ?? null;
  }

  async list(workspaceId: string, versionIds?: string[]): Promise<ModelDatasetProfileRecord[]> {
    const conditions = [eq(modelDatasetProfile.workspace_id, workspaceId)];

    if (versionIds) {
      if (versionIds.length === 0) {
        return [];
      }

      return this.selectInChunks(versionIds, (chunk) =>
        this.database
          .select()
          .from(modelDatasetProfile)
          .where(and(...conditions, inArray(modelDatasetProfile.version_id, chunk))),
      );
    }

    return this.database
      .select()
      .from(modelDatasetProfile)
      .where(and(...conditions));
  }

  async update(
    versionId: string,
    changes: Partial<
      Pick<
        ModelDatasetProfileRecord,
        "status" | "stats" | "failure_reason" | "processed_at" | "mapping" | "shape"
      >
    >,
  ): Promise<void> {
    await this.database
      .update(modelDatasetProfile)
      .set(changes)
      .where(eq(modelDatasetProfile.version_id, versionId));
  }
}
