import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { and, eq, inArray, sql } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import {
  type ModelRouteRecord,
  modelRoute,
  modelRouteChanges,
  modelRouteValues,
} from "~/infrastructure/database/model-storage";
import { modelConfiguration } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export type { ModelRouteRecord } from "~/infrastructure/database/model-storage";

export class ModelRouteRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async createRoute(input: {
    workspaceId: string;
    versionId: string;
    provider: string;
    providerModelId: string;
    region: string;
    weightsVerified: boolean;
    deploymentId?: string | null;
    jurisdiction?: ModelRouteRecord["jurisdiction"];
    retention?: ModelRouteRecord["retention"];
    createdBy: number | null;
  }): Promise<ModelRouteRecord> {
    const values = {
      region: input.region,
      weights_verified: input.weightsVerified,
      deployment_id: input.deploymentId ?? null,
      jurisdiction: input.jurisdiction ?? null,
      retention: input.retention ?? null,
    };
    const [record] = await this.database
      .insert(modelConfiguration)
      .values(
        modelRouteValues({
          id: generateId(),
          workspace_id: input.workspaceId,
          version_id: input.versionId,
          provider: input.provider,
          provider_model_id: input.providerModelId,
          created_by: input.createdBy,
          ...values,
        }),
      )
      .onConflictDoUpdate({
        target: [
          modelConfiguration.workspace_id,
          modelConfiguration.version_id,
          modelConfiguration.provider,
          modelConfiguration.provider_model_id,
        ],
        targetWhere: sql`${modelConfiguration.kind} = 'route'`,
        set: modelRouteChanges({ status: "active", ...values }),
      })
      .returning(modelRoute);

    return record;
  }

  async getRoute(workspaceId: string, routeId: string): Promise<ModelRouteRecord | null> {
    const [record] = await this.database
      .select(modelRoute)
      .from(modelConfiguration)
      .where(
        and(
          eq(modelConfiguration.kind, "route"),
          and(eq(modelRoute.workspace_id, workspaceId), eq(modelRoute.id, routeId)),
        ),
      )
      .limit(1);

    return record ?? null;
  }

  async getRouteById(routeId: string): Promise<ModelRouteRecord | null> {
    const [record] = await this.database
      .select(modelRoute)
      .from(modelConfiguration)
      .where(and(eq(modelConfiguration.kind, "route"), eq(modelRoute.id, routeId)))
      .limit(1);

    return record ?? null;
  }

  async listRoutes(
    workspaceId: string,
    filters: { versionIds?: string[]; activeOnly?: boolean } = {},
  ): Promise<ModelRouteRecord[]> {
    const conditions = [eq(modelRoute.workspace_id, workspaceId)];

    if (filters.activeOnly) {
      conditions.push(eq(modelRoute.status, "active"));
    }

    const select = (versionIds?: string[]) =>
      this.database
        .select(modelRoute)
        .from(modelConfiguration)
        .where(
          and(
            eq(modelConfiguration.kind, "route"),
            and(...conditions, ...(versionIds ? [inArray(modelRoute.version_id, versionIds)] : [])),
          ),
        );

    const records = filters.versionIds
      ? await this.selectInChunks(filters.versionIds, select)
      : await select();

    return records.sort((left, right) => right.created_at.localeCompare(left.created_at));
  }

  async listActiveRoutesForModel(provider: string, providerModelId: string) {
    return this.database
      .select(modelRoute)
      .from(modelConfiguration)
      .where(
        and(
          eq(modelConfiguration.kind, "route"),
          and(
            eq(modelRoute.provider, provider),
            eq(modelRoute.provider_model_id, providerModelId),
            eq(modelRoute.status, "active"),
          ),
        ),
      );
  }

  async listByIds(routeIds: string[]): Promise<ModelRouteRecord[]> {
    return this.selectInChunks(routeIds, (chunk) =>
      this.database
        .select(modelRoute)
        .from(modelConfiguration)
        .where(and(eq(modelConfiguration.kind, "route"), inArray(modelRoute.id, chunk))),
    );
  }

  async setStatus(routeId: string, status: "active" | "retired"): Promise<void> {
    await this.database
      .update(modelConfiguration)
      .set(modelRouteChanges({ status }))
      .where(and(eq(modelConfiguration.kind, "route"), eq(modelRoute.id, routeId)));
  }

  async updateLocation(
    routeId: string,
    changes: Pick<ModelRouteRecord, "region" | "jurisdiction">,
  ): Promise<void> {
    await this.database
      .update(modelConfiguration)
      .set(modelRouteChanges(changes))
      .where(and(eq(modelConfiguration.kind, "route"), eq(modelRoute.id, routeId)));
  }
}
