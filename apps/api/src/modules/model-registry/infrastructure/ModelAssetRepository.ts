import type {
  LineageEdge,
  LineageRelation,
  ModelAssetKind,
  ModelAssetSource,
  ModelVersionAttributes,
  ModelVersionStatus,
  WeightFormat,
} from "@ngriffin_uk/polychat-schemas";
import { chunkArray } from "@ngriffin_uk/polychat-utility-core";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import { and, desc, eq, getTableColumns, inArray } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import {
  modelAsset,
  modelAssetFile,
  modelAssetVersion,
  modelLineageEdge,
} from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export type ModelAssetRecord = typeof modelAsset.$inferSelect;
export type ModelVersionRecord = typeof modelAssetVersion.$inferSelect;
export type ModelFileRecord = typeof modelAssetFile.$inferSelect;

export interface CreateVersionInput {
  assetId: string;
  workspaceId: string;
  revision: string;
  attributes: ModelVersionAttributes;
  status: ModelVersionStatus;
  createdBy: number | null;
  files: Array<{ path: string; size: number; sha256: string | null; format: WeightFormat | null }>;
}

const FILE_COLUMN_COUNT = Object.keys(getTableColumns(modelAssetFile)).length;

export class ModelAssetRepository extends BaseRepository<Pick<IEnv, "DB">> {
  private fileInserts(versionId: string, files: CreateVersionInput["files"]) {
    return chunkArray(files, BaseRepository.rowsPerInsert(FILE_COLUMN_COUNT)).map((page) =>
      this.database.insert(modelAssetFile).values(
        page.map((file) => ({
          version_id: versionId,
          path: file.path,
          size: file.size,
          sha256: file.sha256,
          format: file.format,
        })),
      ),
    );
  }

  async findAssetBySource(input: {
    workspaceId: string;
    kind: ModelAssetKind;
    source: ModelAssetSource;
    sourceRef: string;
  }): Promise<ModelAssetRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelAsset)
      .where(
        and(
          eq(modelAsset.workspace_id, input.workspaceId),
          eq(modelAsset.kind, input.kind),
          eq(modelAsset.source, input.source),
          eq(modelAsset.source_ref, input.sourceRef),
        ),
      )
      .limit(1);

    return record ?? null;
  }

  async createAsset(input: {
    workspaceId: string;
    kind: ModelAssetKind;
    source: ModelAssetSource;
    sourceRef: string;
    displayName: string;
    createdBy: number | null;
  }): Promise<ModelAssetRecord> {
    const [record] = await this.database
      .insert(modelAsset)
      .values({
        id: generateId(),
        workspace_id: input.workspaceId,
        kind: input.kind,
        source: input.source,
        source_ref: input.sourceRef,
        display_name: input.displayName,
        created_by: input.createdBy,
      })
      .onConflictDoNothing()
      .returning();

    if (record) {
      return record;
    }

    const existing = await this.findAssetBySource(input);

    if (!existing) {
      throw new Error("Model asset insert conflicted but no row was found");
    }

    return existing;
  }

  async listAssets(workspaceId: string, kind?: ModelAssetKind): Promise<ModelAssetRecord[]> {
    return this.database
      .select()
      .from(modelAsset)
      .where(
        kind
          ? and(eq(modelAsset.workspace_id, workspaceId), eq(modelAsset.kind, kind))
          : eq(modelAsset.workspace_id, workspaceId),
      )
      .orderBy(desc(modelAsset.created_at));
  }

  async getAsset(workspaceId: string, assetId: string): Promise<ModelAssetRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelAsset)
      .where(and(eq(modelAsset.workspace_id, workspaceId), eq(modelAsset.id, assetId)))
      .limit(1);

    return record ?? null;
  }

  async findVersion(assetId: string, revision: string): Promise<ModelVersionRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelAssetVersion)
      .where(and(eq(modelAssetVersion.asset_id, assetId), eq(modelAssetVersion.revision, revision)))
      .limit(1);

    return record ?? null;
  }

  async createVersion(input: CreateVersionInput): Promise<ModelVersionRecord> {
    const id = generateId();
    const versionInsert = this.database
      .insert(modelAssetVersion)
      .values({
        id,
        asset_id: input.assetId,
        workspace_id: input.workspaceId,
        revision: input.revision,
        status: input.status,
        attributes: input.attributes,
        created_by: input.createdBy,
      })
      .returning();
    const [[record]] = await this.database.batch([
      versionInsert,
      ...this.fileInserts(id, input.files),
    ]);

    return record;
  }

  async getVersion(workspaceId: string, versionId: string): Promise<ModelVersionRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelAssetVersion)
      .where(
        and(eq(modelAssetVersion.workspace_id, workspaceId), eq(modelAssetVersion.id, versionId)),
      )
      .limit(1);

    return record ?? null;
  }

  async getVersionById(versionId: string): Promise<ModelVersionRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelAssetVersion)
      .where(eq(modelAssetVersion.id, versionId))
      .limit(1);

    return record ?? null;
  }

  async getAssetById(assetId: string): Promise<ModelAssetRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelAsset)
      .where(eq(modelAsset.id, assetId))
      .limit(1);

    return record ?? null;
  }

  async listVersions(workspaceId: string, versionIds?: string[]): Promise<ModelVersionRecord[]> {
    if (!versionIds) {
      return this.database
        .select()
        .from(modelAssetVersion)
        .where(eq(modelAssetVersion.workspace_id, workspaceId))
        .orderBy(desc(modelAssetVersion.created_at));
    }

    const records = await this.selectInChunks(versionIds, (page) =>
      this.database
        .select()
        .from(modelAssetVersion)
        .where(
          and(eq(modelAssetVersion.workspace_id, workspaceId), inArray(modelAssetVersion.id, page)),
        ),
    );

    return records.sort((left, right) => right.created_at.localeCompare(left.created_at));
  }

  async listAssetVersions(assetId: string): Promise<ModelVersionRecord[]> {
    return this.database
      .select()
      .from(modelAssetVersion)
      .where(eq(modelAssetVersion.asset_id, assetId))
      .orderBy(desc(modelAssetVersion.created_at));
  }

  async updateVersion(
    versionId: string,
    updates: Partial<Pick<ModelVersionRecord, "status" | "attributes" | "failure_reason">>,
  ): Promise<void> {
    await this.database
      .update(modelAssetVersion)
      .set({ ...updates, updated_at: new Date().toISOString() })
      .where(eq(modelAssetVersion.id, versionId));
  }

  async finaliseRevision(
    versionId: string,
    input: {
      revision: string;
      attributes: ModelVersionAttributes;
      files: CreateVersionInput["files"];
    },
  ): Promise<void> {
    await this.database.batch([
      this.database
        .update(modelAssetVersion)
        .set({
          revision: input.revision,
          attributes: input.attributes,
          status: "inspecting",
          updated_at: new Date().toISOString(),
        })
        .where(eq(modelAssetVersion.id, versionId)),
      ...this.fileInserts(versionId, input.files),
    ]);
  }

  async listFiles(versionId: string): Promise<ModelFileRecord[]> {
    return this.database
      .select()
      .from(modelAssetFile)
      .where(eq(modelAssetFile.version_id, versionId))
      .orderBy(modelAssetFile.path);
  }

  async addLineageEdge(edge: {
    fromVersionId: string;
    toVersionId: string;
    relation: LineageRelation;
  }): Promise<void> {
    await this.database
      .insert(modelLineageEdge)
      .values({
        from_version_id: edge.fromVersionId,
        to_version_id: edge.toVersionId,
        relation: edge.relation,
      })
      .onConflictDoNothing();
  }

  async listLineage(workspaceId: string): Promise<LineageEdge[]> {
    const rows = await this.database
      .select({
        fromVersionId: modelLineageEdge.from_version_id,
        toVersionId: modelLineageEdge.to_version_id,
        relation: modelLineageEdge.relation,
      })
      .from(modelLineageEdge)
      .innerJoin(modelAssetVersion, eq(modelAssetVersion.id, modelLineageEdge.to_version_id))
      .where(eq(modelAssetVersion.workspace_id, workspaceId));

    return rows;
  }
}
