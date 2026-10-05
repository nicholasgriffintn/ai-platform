import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import {
  type ModelBudgetRecord,
  modelBudget,
  type ModelSpendRequestRecord,
  modelSpendRequest,
  modelSpendRequestChanges,
  modelSpendRequestValues,
  modelBudgetValues,
  modelBudgetChanges,
} from "~/infrastructure/database/model-storage";
import {
  modelCostEntry,
  modelConfiguration,
  modelApproval,
} from "~/infrastructure/database/schema";
import type { IEnv } from "~/types";

export type { ModelBudgetRecord } from "~/infrastructure/database/model-storage";
export type ModelCostEntryRecord = typeof modelCostEntry.$inferSelect;
export type { ModelSpendRequestRecord } from "~/infrastructure/database/model-storage";

export const WORKSPACE_BUDGET_SCOPE_KEY = "workspace";

export class ModelSpendRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async listBudgets(workspaceId: string): Promise<ModelBudgetRecord[]> {
    return this.database
      .select(modelBudget)
      .from(modelConfiguration)
      .where(and(eq(modelConfiguration.kind, "budget"), eq(modelBudget.workspace_id, workspaceId)));
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
      .insert(modelConfiguration)
      .values(
        modelBudgetValues({
          id: generateId(),
          workspace_id: input.workspaceId,
          scope_key: input.projectId ?? WORKSPACE_BUDGET_SCOPE_KEY,
          ...values,
        }),
      )
      .onConflictDoUpdate({
        target: [
          modelConfiguration.workspace_id,
          modelConfiguration.kind,
          modelConfiguration.scope_key,
        ],
        set: modelBudgetChanges(values),
      })
      .returning(modelBudget);

    return record;
  }

  async deleteBudget(workspaceId: string, scopeKey: string): Promise<void> {
    await this.database
      .delete(modelConfiguration)
      .where(
        and(
          eq(modelConfiguration.kind, "budget"),
          and(eq(modelBudget.workspace_id, workspaceId), eq(modelBudget.scope_key, scopeKey)),
        ),
      );
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
    const remove = this.database
      .delete(modelCostEntry)
      .where(
        and(
          eq(modelCostEntry.workspace_id, input.workspaceId),
          eq(modelCostEntry.subject_type, input.subjectType),
          eq(modelCostEntry.subject_id, input.subjectId),
        ),
      );

    if (input.usd <= 0) {
      await remove;

      return;
    }

    await this.database.batch([
      remove,
      this.database.insert(modelCostEntry).values({
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
      }),
    ]);
  }

  async accrueDeployment(input: {
    workspaceId: string;
    deploymentId: string;
    expectedBilledUntil: string | null;
    periodStart: string;
    periodEnd: string;
    usd: number;
  }): Promise<void> {
    await this.executeBatch([
      this.env.DB.prepare(`INSERT INTO model_cost_entry
        (id, workspace_id, project_id, subject_type, subject_id, provider, usd, basis, period_start, period_end)
        SELECT ?, workspace_id, project_id, 'deployment', id, provider, ?, 'estimate', ?, ?
        FROM model_operation WHERE kind = 'deployment' AND workspace_id = ? AND id = ? AND billed_until IS ? AND ? > 0`).bind(
        generateId(),
        input.usd,
        input.periodStart,
        input.periodEnd,
        input.workspaceId,
        input.deploymentId,
        input.expectedBilledUntil,
        input.usd,
      ),
      this.env.DB.prepare(`UPDATE model_operation SET billed_until = ?
        WHERE kind = 'deployment' AND workspace_id = ? AND id = ? AND billed_until IS ?`).bind(
        input.periodEnd,
        input.workspaceId,
        input.deploymentId,
        input.expectedBilledUntil,
      ),
    ]);
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
      .insert(modelApproval)
      .values(
        modelSpendRequestValues({
          id: generateId(),
          workspace_id: input.workspaceId,
          project_id: input.projectId,
          subject_type: input.subjectType,
          payload: input.payload,
          estimate_usd: input.estimateUsd,
          reason: input.reason,
          requested_by: input.requestedBy,
        }),
      )
      .returning(modelSpendRequest);

    return record;
  }

  async getSpendRequest(workspaceId: string, id: string): Promise<ModelSpendRequestRecord | null> {
    const [record] = await this.database
      .select(modelSpendRequest)
      .from(modelApproval)
      .where(
        and(
          eq(modelApproval.kind, "spend"),
          and(eq(modelSpendRequest.workspace_id, workspaceId), eq(modelSpendRequest.id, id)),
        ),
      )
      .limit(1);

    return record ?? null;
  }

  async listSpendRequests(
    workspaceId: string,
    states: Array<ModelSpendRequestRecord["state"]> = ["pending"],
  ): Promise<ModelSpendRequestRecord[]> {
    return this.database
      .select(modelSpendRequest)
      .from(modelApproval)
      .where(
        and(
          eq(modelApproval.kind, "spend"),
          and(
            eq(modelSpendRequest.workspace_id, workspaceId),
            inArray(modelSpendRequest.state, states),
          ),
        ),
      )
      .orderBy(desc(modelSpendRequest.created_at));
  }

  async claimSpendRequest(input: {
    id: string;
    workspaceId: string;
    state: "executing" | "rejected";
    decidedBy: number;
  }): Promise<ModelSpendRequestRecord | null> {
    const [record] = await this.database
      .update(modelApproval)
      .set(
        modelSpendRequestChanges({
          state: input.state,
          decided_by: input.decidedBy,
          decided_at: new Date().toISOString(),
        }),
      )
      .where(
        and(
          eq(modelApproval.kind, "spend"),
          and(
            eq(modelSpendRequest.workspace_id, input.workspaceId),
            eq(modelSpendRequest.id, input.id),
            eq(modelSpendRequest.state, "pending"),
          ),
        ),
      )
      .returning(modelSpendRequest);

    return record ?? null;
  }

  async finishSpendRequest(input: {
    id: string;
    workspaceId: string;
    state: "approved" | "failed";
    subjectId: string | null;
  }): Promise<ModelSpendRequestRecord | null> {
    const [record] = await this.database
      .update(modelApproval)
      .set(
        modelSpendRequestChanges({
          state: input.state,
          subject_id: input.subjectId,
          ...(input.state === "failed"
            ? {
                reason:
                  "Execution failed. Check the training runs or deployments before submitting a new request.",
              }
            : {}),
        }),
      )
      .where(
        and(
          eq(modelApproval.kind, "spend"),
          and(
            eq(modelSpendRequest.workspace_id, input.workspaceId),
            eq(modelSpendRequest.id, input.id),
            eq(modelSpendRequest.state, "executing"),
          ),
        ),
      )
      .returning(modelSpendRequest);

    return record ?? null;
  }
}
