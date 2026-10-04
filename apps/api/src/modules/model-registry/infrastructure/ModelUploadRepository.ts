import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { and, eq, sql } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { modelUpload } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export type ModelUploadRecord = typeof modelUpload.$inferSelect;
export type StoredUploadFile = ModelUploadRecord["files"][number];

export class ModelUploadRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async create(input: {
    workspaceId: string;
    purpose: ModelUploadRecord["purpose"];
    name: string;
    files: StoredUploadFile[];
    partBytes: number;
    createdBy: number;
  }): Promise<ModelUploadRecord> {
    const [record] = await this.database
      .insert(modelUpload)
      .values({
        id: generateId(),
        workspace_id: input.workspaceId,
        purpose: input.purpose,
        name: input.name,
        files: input.files,
        part_bytes: input.partBytes,
        created_by: input.createdBy,
      })
      .returning();

    return record;
  }

  async get(workspaceId: string, id: string): Promise<ModelUploadRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelUpload)
      .where(and(eq(modelUpload.workspace_id, workspaceId), eq(modelUpload.id, id)))
      .limit(1);

    return record ?? null;
  }

  async getById(id: string): Promise<ModelUploadRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelUpload)
      .where(eq(modelUpload.id, id))
      .limit(1);

    return record ?? null;
  }

  async update(
    id: string,
    changes: Partial<
      Pick<ModelUploadRecord, "status" | "files" | "failure_reason" | "consumed_by">
    >,
  ): Promise<void> {
    await this.database
      .update(modelUpload)
      .set({ ...changes, updated_at: new Date().toISOString() })
      .where(eq(modelUpload.id, id));
  }

  async recordPart(input: {
    workspaceId: string;
    uploadId: string;
    fileIndex: number;
    partNumber: number;
    etag: string;
  }): Promise<boolean> {
    const filePath = `$[${input.fileIndex}]`;
    const partsPath = `${filePath}.partsUploaded`;
    const etagPath = `${filePath}.etags."${input.partNumber}"`;
    const [record] = await this.database
      .update(modelUpload)
      .set({
        files: sql`json_set(${modelUpload.files}, ${etagPath}, ${input.etag}, ${partsPath}, json(
          CASE WHEN EXISTS (SELECT 1 FROM json_each(json_extract(${modelUpload.files}, ${partsPath})) WHERE value = ${input.partNumber})
          THEN json_extract(${modelUpload.files}, ${partsPath})
          ELSE json_insert(json_extract(${modelUpload.files}, ${partsPath}), '$[#]', ${input.partNumber}) END
        ))`,
        updated_at: new Date().toISOString(),
      })
      .where(
        and(
          eq(modelUpload.workspace_id, input.workspaceId),
          eq(modelUpload.id, input.uploadId),
          eq(modelUpload.status, "uploading"),
          sql`json_extract(${modelUpload.files}, ${`${filePath}.index`}) = ${input.fileIndex}`,
          sql`${input.partNumber} BETWEEN 1 AND json_extract(${modelUpload.files}, ${`${filePath}.partCount`})`,
        ),
      )
      .returning({ id: modelUpload.id });

    return record !== undefined;
  }
}
