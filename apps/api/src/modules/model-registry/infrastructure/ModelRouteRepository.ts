import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import { and, eq, inArray } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { modelRoute } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export type ModelRouteRecord = typeof modelRoute.$inferSelect;

export class ModelRouteRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async createRoute(input: {
    workspaceId: string;
    versionId: string;
    provider: string;
    providerModelId: string;
    region: string;
    weightsVerified: boolean;
    deploymentRef?: string | null;
    createdBy: number | null;
  }): Promise<ModelRouteRecord> {
    const [record] = await this.database
      .insert(modelRoute)
      .values({
        id: generateId(),
        workspace_id: input.workspaceId,
        version_id: input.versionId,
        provider: input.provider,
        provider_model_id: input.providerModelId,
        region: input.region,
        weights_verified: input.weightsVerified,
        deployment_ref: input.deploymentRef ?? null,
        created_by: input.createdBy,
      })
      .onConflictDoUpdate({
        target: [
          modelRoute.workspace_id,
          modelRoute.version_id,
          modelRoute.provider,
          modelRoute.provider_model_id,
        ],
        set: {
          status: "active",
          region: input.region,
          weights_verified: input.weightsVerified,
          deployment_ref: input.deploymentRef ?? null,
        },
      })
      .returning();

    return record;
  }

  async getRoute(workspaceId: string, routeId: string): Promise<ModelRouteRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelRoute)
      .where(and(eq(modelRoute.workspace_id, workspaceId), eq(modelRoute.id, routeId)))
      .limit(1);

    return record ?? null;
  }

  async getRouteById(routeId: string): Promise<ModelRouteRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelRoute)
      .where(eq(modelRoute.id, routeId))
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
        .select()
        .from(modelRoute)
        .where(
          and(...conditions, ...(versionIds ? [inArray(modelRoute.version_id, versionIds)] : [])),
        );

    const records = filters.versionIds
      ? await this.selectInChunks(filters.versionIds, select)
      : await select();

    return records.sort((left, right) => right.created_at.localeCompare(left.created_at));
  }

  async listActiveRoutesForModel(provider: string, providerModelId: string) {
    return this.database
      .select()
      .from(modelRoute)
      .where(
        and(
          eq(modelRoute.provider, provider),
          eq(modelRoute.provider_model_id, providerModelId),
          eq(modelRoute.status, "active"),
        ),
      );
  }

  async getRouteByDeployment(
    provider: string,
    deploymentRef: string,
  ): Promise<ModelRouteRecord | null> {
    const [route] = await this.database
      .select()
      .from(modelRoute)
      .where(and(eq(modelRoute.provider, provider), eq(modelRoute.deployment_ref, deploymentRef)))
      .limit(1);

    return route ?? null;
  }

  async setStatus(routeId: string, status: "active" | "retired"): Promise<void> {
    await this.database.update(modelRoute).set({ status }).where(eq(modelRoute.id, routeId));
  }
}
