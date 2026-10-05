import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { and, eq, inArray, isNull, or } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import {
  type ModelGraderRecord,
  modelGrader,
  modelGraderChanges,
  modelGraderValues,
} from "~/infrastructure/database/model-storage";
import { modelConfiguration } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export type { ModelGraderRecord } from "~/infrastructure/database/model-storage";

export class ModelGraderRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async create(input: {
    workspaceId: string;
    projectId: string | null;
    name: string;
    metric: string;
    description: string | null;
    config: ModelGraderRecord["config"];
    createdBy: number;
  }): Promise<ModelGraderRecord> {
    const [record] = await this.database
      .insert(modelConfiguration)
      .values(
        modelGraderValues({
          id: generateId(),
          workspace_id: input.workspaceId,
          project_id: input.projectId,
          name: input.name,
          metric: input.metric,
          description: input.description,
          config: input.config,
          created_by: input.createdBy,
        }),
      )
      .returning(modelGrader);

    return record;
  }

  async get(workspaceId: string, id: string): Promise<ModelGraderRecord | null> {
    const [record] = await this.database
      .select(modelGrader)
      .from(modelConfiguration)
      .where(
        and(
          eq(modelConfiguration.kind, "grader"),
          and(eq(modelGrader.workspace_id, workspaceId), eq(modelGrader.id, id)),
        ),
      )
      .limit(1);

    return record ?? null;
  }

  async list(workspaceId: string, projectId?: string | null): Promise<ModelGraderRecord[]> {
    const conditions = [eq(modelGrader.workspace_id, workspaceId)];

    const scope = projectId
      ? or(eq(modelGrader.project_id, projectId), isNull(modelGrader.project_id))
      : undefined;

    if (scope) {
      conditions.push(scope);
    }

    return this.database
      .select(modelGrader)
      .from(modelConfiguration)
      .where(and(eq(modelConfiguration.kind, "grader"), and(...conditions)))
      .orderBy(modelGrader.name);
  }

  async listByIds(ids: string[]): Promise<ModelGraderRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.database
      .select(modelGrader)
      .from(modelConfiguration)
      .where(and(eq(modelConfiguration.kind, "grader"), inArray(modelGrader.id, ids)));
  }

  async update(
    id: string,
    changes: Pick<ModelGraderRecord, "name" | "description" | "config" | "revision">,
  ): Promise<ModelGraderRecord> {
    const [record] = await this.database
      .update(modelConfiguration)
      .set(modelGraderChanges({ ...changes, updated_at: new Date().toISOString() }))
      .where(and(eq(modelConfiguration.kind, "grader"), eq(modelGrader.id, id)))
      .returning(modelGrader);

    return record;
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    await this.database
      .delete(modelConfiguration)
      .where(
        and(
          eq(modelConfiguration.kind, "grader"),
          and(eq(modelGrader.workspace_id, workspaceId), eq(modelGrader.id, id)),
        ),
      );
  }
}
