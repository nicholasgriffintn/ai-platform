import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { modelAssetVersion, type ModelDatasetProfileData } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export type ModelDatasetProfileRecord = ModelDatasetProfileData & {
  version_id: string;
  workspace_id: string;
};

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
    const profile: ModelDatasetProfileData = {
      status: "processing",
      shape: input.shape,
      mapping: input.mapping,
      governance: input.governance,
      collection_method: input.collectionMethod,
      source_ref: input.sourceRef,
      request: input.request,
      stats: {},
      failure_reason: null,
      processed_at: null,
      created_at: new Date().toISOString(),
    };
    const [record] = await this.database
      .update(modelAssetVersion)
      .set({ dataset_profile: profile })
      .where(
        and(
          eq(modelAssetVersion.id, input.versionId),
          eq(modelAssetVersion.workspace_id, input.workspaceId),
          isNull(modelAssetVersion.dataset_profile),
        ),
      )
      .returning({ id: modelAssetVersion.id });

    if (!record) {
      throw new Error(
        "Dataset version is missing, belongs to another workspace, or already has a profile",
      );
    }

    return { version_id: record.id, workspace_id: input.workspaceId, ...profile };
  }

  async get(versionId: string): Promise<ModelDatasetProfileRecord | null> {
    const [record] = await this.database
      .select({
        id: modelAssetVersion.id,
        workspace_id: modelAssetVersion.workspace_id,
        profile: modelAssetVersion.dataset_profile,
      })
      .from(modelAssetVersion)
      .where(eq(modelAssetVersion.id, versionId))
      .limit(1);

    return record?.profile
      ? { version_id: record.id, workspace_id: record.workspace_id, ...record.profile }
      : null;
  }

  async list(workspaceId: string, versionIds?: string[]): Promise<ModelDatasetProfileRecord[]> {
    const conditions = [
      eq(modelAssetVersion.workspace_id, workspaceId),
      isNotNull(modelAssetVersion.dataset_profile),
    ];
    const selection = {
      id: modelAssetVersion.id,
      workspace_id: modelAssetVersion.workspace_id,
      profile: modelAssetVersion.dataset_profile,
    };
    const rows = versionIds
      ? await this.selectInChunks(versionIds, (chunk) =>
          this.database
            .select(selection)
            .from(modelAssetVersion)
            .where(and(...conditions, inArray(modelAssetVersion.id, chunk))),
        )
      : await this.database
          .select(selection)
          .from(modelAssetVersion)
          .where(and(...conditions));

    return rows.flatMap((row) =>
      row.profile ? [{ version_id: row.id, workspace_id: row.workspace_id, ...row.profile }] : [],
    );
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
    const updates = Object.entries(changes).filter(([, value]) => value !== undefined);

    if (updates.length === 0) {
      return;
    }

    await this.database
      .update(modelAssetVersion)
      .set({
        dataset_profile: sql`json_set(${modelAssetVersion.dataset_profile}, ${sql.join(
          updates.map(([key, value]) => sql`${`$.${key}`}, json(${JSON.stringify(value)})`),
          sql`, `,
        )})`,
      })
      .where(
        and(eq(modelAssetVersion.id, versionId), isNotNull(modelAssetVersion.dataset_profile)),
      );
  }
}
