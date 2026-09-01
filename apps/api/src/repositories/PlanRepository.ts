import { AssistantError, ErrorType } from "~/utils/errors";

import { BaseRepository } from "./BaseRepository";

export const PLAN_CREDIT_COLUMNS = [
  "included_credits",
  "grace_credits",
  "stripe_meter_id",
  "overage_price_id",
] as const;

export type PlanCreditColumn = (typeof PLAN_CREDIT_COLUMNS)[number];

export type PlanCreditFields = Partial<Record<PlanCreditColumn, number | string | null>>;

export class PlanRepository extends BaseRepository {
  public async getAllPlans(): Promise<Record<string, unknown>[]> {
    const { query, values } = this.buildSelectQuery("plans");

    return this.runQuery<Record<string, unknown>>(query, values);
  }

  public async getPlanById(planId: string): Promise<Record<string, unknown> | null> {
    const { query, values } = this.buildSelectQuery("plans", { id: planId });

    return this.runQuery<Record<string, unknown>>(query, values, true);
  }

  public async updatePlanCredits(planId: string, fields: PlanCreditFields): Promise<boolean> {
    const assignments: string[] = [];
    const values: unknown[] = [];

    for (const column of PLAN_CREDIT_COLUMNS) {
      if (!(column in fields)) {
        continue;
      }

      assignments.push(`${column} = ?`);
      values.push(fields[column] ?? null);
    }

    if (assignments.length === 0) {
      throw new AssistantError("No plan credit fields to update", ErrorType.PARAMS_ERROR);
    }

    values.push(planId);

    const result = await this.executeRun(
      `UPDATE plans
       SET ${assignments.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      values,
    );

    return (result.meta?.changes ?? 0) > 0;
  }
}
