import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import { and, eq } from "drizzle-orm";

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
}
