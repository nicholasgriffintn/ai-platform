import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { modelAlias, modelAliasEvent } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export type ModelAliasRecord = typeof modelAlias.$inferSelect;
export type ModelAliasEventRecord = typeof modelAliasEvent.$inferSelect;

export const WORKSPACE_ALIAS_SCOPE_KEY = "workspace";

export class ModelAliasRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async create(input: {
    workspaceId: string;
    projectId: string | null;
    name: string;
    description: string | null;
    routeId: string | null;
    gate: ModelAliasRecord["gate"];
    requiresApproval: boolean;
    updatedBy: number;
  }): Promise<ModelAliasRecord> {
    const [record] = await this.database
      .insert(modelAlias)
      .values({
        id: generateId(),
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        scope_key: input.projectId ?? WORKSPACE_ALIAS_SCOPE_KEY,
        name: input.name,
        description: input.description,
        route_id: input.routeId,
        gate: input.gate,
        requires_approval: input.requiresApproval,
        updated_by: input.updatedBy,
      })
      .returning();

    return record;
  }

  async get(workspaceId: string, id: string): Promise<ModelAliasRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelAlias)
      .where(and(eq(modelAlias.workspace_id, workspaceId), eq(modelAlias.id, id)))
      .limit(1);

    return record ?? null;
  }

  async getById(id: string): Promise<ModelAliasRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelAlias)
      .where(eq(modelAlias.id, id))
      .limit(1);

    return record ?? null;
  }

  async list(workspaceId: string, projectId?: string | null): Promise<ModelAliasRecord[]> {
    const conditions = [eq(modelAlias.workspace_id, workspaceId)];

    const scope = projectId
      ? or(
          eq(modelAlias.project_id, projectId),
          eq(modelAlias.scope_key, WORKSPACE_ALIAS_SCOPE_KEY),
        )
      : undefined;

    if (scope) {
      conditions.push(scope);
    }

    return this.database
      .select()
      .from(modelAlias)
      .where(and(...conditions))
      .orderBy(modelAlias.name);
  }

  async listByRoutes(routeIds: string[]): Promise<ModelAliasRecord[]> {
    if (routeIds.length === 0) {
      return [];
    }

    return this.database
      .select()
      .from(modelAlias)
      .where(
        or(inArray(modelAlias.route_id, routeIds), inArray(modelAlias.canary_route_id, routeIds)),
      );
  }

  async listForMember(workspaceIds: string[]): Promise<ModelAliasRecord[]> {
    if (workspaceIds.length === 0) {
      return [];
    }

    return this.database
      .select()
      .from(modelAlias)
      .where(inArray(modelAlias.workspace_id, workspaceIds));
  }

  async update(
    id: string,
    changes: Partial<
      Pick<
        ModelAliasRecord,
        | "description"
        | "route_id"
        | "canary_route_id"
        | "canary_percent"
        | "gate"
        | "requires_approval"
        | "updated_by"
      >
    >,
  ): Promise<ModelAliasRecord> {
    const [record] = await this.database
      .update(modelAlias)
      .set({ ...changes, updated_at: new Date().toISOString() })
      .where(eq(modelAlias.id, id))
      .returning();

    return record;
  }

  async delete(id: string): Promise<void> {
    await this.database.delete(modelAlias).where(eq(modelAlias.id, id));
  }

  async addEvent(input: {
    aliasId: string;
    kind: ModelAliasEventRecord["kind"];
    fromRouteId: string | null;
    toRouteId: string | null;
    reason: string | null;
    gate: ModelAliasEventRecord["gate"];
    actorUserId: number | null;
  }): Promise<ModelAliasEventRecord> {
    const [record] = await this.database
      .insert(modelAliasEvent)
      .values({
        id: generateId(),
        alias_id: input.aliasId,
        kind: input.kind,
        from_route_id: input.fromRouteId,
        to_route_id: input.toRouteId,
        reason: input.reason,
        gate: input.gate,
        actor_user_id: input.actorUserId,
      })
      .returning();

    return record;
  }

  async listEvents(aliasId: string): Promise<ModelAliasEventRecord[]> {
    return this.database
      .select()
      .from(modelAliasEvent)
      .where(eq(modelAliasEvent.alias_id, aliasId))
      .orderBy(desc(modelAliasEvent.created_at), desc(sql`${modelAliasEvent}.rowid`))
      .limit(100);
  }
}
