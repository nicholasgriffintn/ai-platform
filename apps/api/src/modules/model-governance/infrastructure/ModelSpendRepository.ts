import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import { modelBudget, modelCostEntry, modelSpendRequest } from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export type ModelBudgetRecord = typeof modelBudget.$inferSelect;
export type ModelCostEntryRecord = typeof modelCostEntry.$inferSelect;
export type ModelSpendRequestRecord = typeof modelSpendRequest.$inferSelect;

export const WORKSPACE_BUDGET_SCOPE_KEY = "workspace";

export class ModelSpendRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async listBudgets(workspaceId: string): Promise<ModelBudgetRecord[]> {
    return this.database
      .select()
      .from(modelBudget)
      .where(eq(modelBudget.workspace_id, workspaceId));
  }

  async saveBudget(input: {
    workspaceId: string;
    projectId: string | null;
    monthlyLimitUsd: number;
    softLimitPercent: number;
    hardStop: boolean;
    approvalAboveUsd: number | null;
    idlePauseMinutes: number | null;
    updatedBy: number;
  }): Promise<ModelBudgetRecord> {
    const values = {
      project_id: input.projectId,
      monthly_limit_usd: input.monthlyLimitUsd,
      soft_limit_percent: input.softLimitPercent,
      hard_stop: input.hardStop,
      approval_above_usd: input.approvalAboveUsd,
      idle_pause_minutes: input.idlePauseMinutes,
      updated_by: input.updatedBy,
      updated_at: new Date().toISOString(),
    };
    const [record] = await this.database
      .insert(modelBudget)
      .values({
        id: generateId(),
        workspace_id: input.workspaceId,
        scope_key: input.projectId ?? WORKSPACE_BUDGET_SCOPE_KEY,
        ...values,
      })
      .onConflictDoUpdate({
        target: [modelBudget.workspace_id, modelBudget.scope_key],
        set: values,
      })
      .returning();

    return record;
  }

  async deleteBudget(workspaceId: string, scopeKey: string): Promise<void> {
    await this.database
      .delete(modelBudget)
      .where(and(eq(modelBudget.workspace_id, workspaceId), eq(modelBudget.scope_key, scopeKey)));
  }

  async addCost(input: {
    workspaceId: string;
    projectId: string | null;
    subjectType: ModelCostEntryRecord["subject_type"];
    subjectId: string;
    provider: ModelCostEntryRecord["provider"];
    usd: number;
    basis: ModelCostEntryRecord["basis"];
    periodStart: string;
    periodEnd: string;
  }): Promise<void> {
    if (input.usd <= 0) {
      return;
    }

    await this.database.insert(modelCostEntry).values({
      id: generateId(),
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      provider: input.provider,
      usd: input.usd,
      basis: input.basis,
      period_start: input.periodStart,
      period_end: input.periodEnd,
    });
  }

  async replaceSubjectCost(input: {
    workspaceId: string;
    projectId: string | null;
    subjectType: ModelCostEntryRecord["subject_type"];
    subjectId: string;
    provider: ModelCostEntryRecord["provider"];
    usd: number;
    basis: ModelCostEntryRecord["basis"];
    periodStart: string;
    periodEnd: string;
  }): Promise<void> {
    await this.database
      .delete(modelCostEntry)
      .where(
        and(
          eq(modelCostEntry.subject_type, input.subjectType),
          eq(modelCostEntry.subject_id, input.subjectId),
        ),
      );
    await this.addCost(input);
  }

  async listCosts(workspaceId: string, since: string): Promise<ModelCostEntryRecord[]> {
    return this.database
      .select()
      .from(modelCostEntry)
      .where(
        and(eq(modelCostEntry.workspace_id, workspaceId), gte(modelCostEntry.period_start, since)),
      )
      .orderBy(desc(modelCostEntry.period_start));
  }

  async sumSubjectCost(
    subjectType: ModelCostEntryRecord["subject_type"],
    subjectId: string,
  ): Promise<number> {
    const [row] = await this.database
      .select({ total: sql<number>`coalesce(sum(${modelCostEntry.usd}), 0)` })
      .from(modelCostEntry)
      .where(
        and(eq(modelCostEntry.subject_type, subjectType), eq(modelCostEntry.subject_id, subjectId)),
      );

    return row?.total ?? 0;
  }

  async createSpendRequest(input: {
    workspaceId: string;
    projectId: string | null;
    subjectType: ModelSpendRequestRecord["subject_type"];
    payload: Record<string, unknown>;
    estimateUsd: number | null;
    reason: string | null;
    requestedBy: number;
  }): Promise<ModelSpendRequestRecord> {
    const [record] = await this.database
      .insert(modelSpendRequest)
      .values({
        id: generateId(),
        workspace_id: input.workspaceId,
        project_id: input.projectId,
        subject_type: input.subjectType,
        payload: input.payload,
        estimate_usd: input.estimateUsd,
        reason: input.reason,
        requested_by: input.requestedBy,
      })
      .returning();

    return record;
  }

  async getSpendRequest(workspaceId: string, id: string): Promise<ModelSpendRequestRecord | null> {
    const [record] = await this.database
      .select()
      .from(modelSpendRequest)
      .where(and(eq(modelSpendRequest.workspace_id, workspaceId), eq(modelSpendRequest.id, id)))
      .limit(1);

    return record ?? null;
  }

  async listSpendRequests(
    workspaceId: string,
    states: Array<ModelSpendRequestRecord["state"]> = ["pending"],
  ): Promise<ModelSpendRequestRecord[]> {
    return this.database
      .select()
      .from(modelSpendRequest)
      .where(
        and(
          eq(modelSpendRequest.workspace_id, workspaceId),
          inArray(modelSpendRequest.state, states),
        ),
      )
      .orderBy(desc(modelSpendRequest.created_at));
  }

  async resolveSpendRequest(input: {
    id: string;
    state: "approved" | "rejected";
    decidedBy: number;
    subjectId: string | null;
  }): Promise<void> {
    await this.database
      .update(modelSpendRequest)
      .set({
        state: input.state,
        decided_by: input.decidedBy,
        decided_at: new Date().toISOString(),
        subject_id: input.subjectId,
      })
      .where(and(eq(modelSpendRequest.id, input.id), eq(modelSpendRequest.state, "pending")));
  }
}
